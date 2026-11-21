import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CLIENT_KEYS } from './schemaDefinition.js';

export interface PreviewUser {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'User';
  active: boolean;
  passwordHash: string;
  salt: string;
  sv: number;
  perms: { menus: Record<string, string>; options: { delete: boolean; export: boolean } };
  companyIds: string[] | null;
  createdAt: string;
  lastLogin: string;
}

export interface PreviewCompany {
  id: string;
  name: string;
  legacy: boolean;
  deleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  createdBy: string;
}

interface PreviewStore {
  setupCode: string;
  users: PreviewUser[];
  companies: PreviewCompany[];
  companyData: Record<string, Record<string, { rev: number; value: string }>>;
  sessions: Record<string, { userId: string; sv: number; expiresAt: number }>;
  auditLogs: Array<{ time: string; who: string; action: string; detail: string }>;
  backups: Record<string, Array<{ id: string; name: string; size: number; created: string; payload: string }>>;
  emailLogs: Array<{
    time: string;
    by: string;
    action: string;
    doc: string;
    ref: string;
    to: string;
    cc: string;
    subject: string;
    files: string;
  }>;
  connectors: { gmail: boolean; drive: boolean; gmailAt: string; driveAt: string; by: string };
}

const MENU_DEF: Record<string, { read: string[]; write: string[] }> = {
  dashboard: { read: ['vendors', 'purchase_orders', 'work_orders'], write: [] },
  vendors: { read: ['vendors', 'company_profile'], write: ['vendors'] },
  'vendor-import': { read: ['vendors'], write: ['vendors'] },
  po: { read: ['purchase_orders', 'vendors', 'terms_templates', 'company_profile'], write: ['purchase_orders'] },
  wo: { read: ['work_orders', 'vendors', 'terms_templates', 'company_profile'], write: ['work_orders'] },
  proforma: { read: ['proforma_invoices', 'vendors', 'services', 'company_profile'], write: ['proforma_invoices'] },
  services: { read: ['services'], write: ['services'] },
  inventory: {
    read: ['inventory_items', 'material_entries', 'vendors', 'purchase_orders', 'work_orders', 'company_profile'],
    write: ['inventory_items', 'material_entries'],
  },
  gatepass: { read: ['gate_passes', 'company_profile'], write: ['gate_passes'] },
  bills: { read: ['bills', 'vendors', 'purchase_vouchers', 'company_profile'], write: ['bills', 'purchase_vouchers'] },
  paysheets: { read: ['bills', 'payment_sheets', 'vendors', 'company_profile'], write: ['bills', 'payment_sheets'] },
  vouchers: { read: ['payment_vouchers', 'bills', 'vendors', 'company_profile'], write: ['payment_vouchers'] },
  salesv: { read: ['sales_vouchers', 'receipt_vouchers', 'vendors', 'company_profile'], write: ['sales_vouchers'] },
  purchasev: { read: ['purchase_vouchers', 'purchase_orders', 'vendors', 'company_profile'], write: ['purchase_vouchers'] },
  receiptv: { read: ['receipt_vouchers', 'sales_vouchers', 'vendors', 'company_profile'], write: ['receipt_vouchers'] },
  terms: { read: ['terms_templates'], write: ['terms_templates'] },
  company: { read: ['company_profile'], write: ['company_profile'] },
  reports: {
    read: ['vendors', 'purchase_orders', 'work_orders', 'bills', 'payment_sheets', 'company_profile'],
    write: [],
  },
  ledger: { read: ['vendors', 'bills', 'payment_sheets', 'payment_vouchers', 'company_profile'], write: [] },
  groups: { read: ['vendors', 'acc_books', 'company_profile'], write: ['acc_books'] },
  ledgers: {
    read: [
      'vendors',
      'bills',
      'payment_sheets',
      'payment_vouchers',
      'sales_vouchers',
      'purchase_vouchers',
      'receipt_vouchers',
      'journal_vouchers',
      'acc_books',
      'company_profile',
    ],
    write: ['acc_books'],
  },
  journal: {
    read: [
      'vendors',
      'bills',
      'payment_sheets',
      'payment_vouchers',
      'sales_vouchers',
      'purchase_vouchers',
      'receipt_vouchers',
      'journal_vouchers',
      'acc_books',
      'company_profile',
    ],
    write: ['journal_vouchers'],
  },
  trialbal: {
    read: [
      'vendors',
      'bills',
      'payment_sheets',
      'payment_vouchers',
      'sales_vouchers',
      'purchase_vouchers',
      'receipt_vouchers',
      'journal_vouchers',
      'acc_books',
      'company_profile',
    ],
    write: [],
  },
  placc: {
    read: [
      'vendors',
      'bills',
      'payment_sheets',
      'payment_vouchers',
      'sales_vouchers',
      'purchase_vouchers',
      'receipt_vouchers',
      'journal_vouchers',
      'acc_books',
      'company_profile',
    ],
    write: [],
  },
  balsheet: {
    read: [
      'vendors',
      'bills',
      'payment_sheets',
      'payment_vouchers',
      'sales_vouchers',
      'purchase_vouchers',
      'receipt_vouchers',
      'journal_vouchers',
      'acc_books',
      'company_profile',
    ],
    write: [],
  },
};

const ADMIN_ONLY_MENUS = ['sheets', 'connectors', 'connected', 'gmail', 'gdrive', 'users'];

export class PreviewRpcBackend {
  private store: PreviewStore;
  private storeFile: string;
  private uploadDir: string;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.storeFile = path.join(dataDir, 'preview-db.json');
    this.uploadDir = path.join(dataDir, 'uploads');
    fs.mkdirSync(this.uploadDir, { recursive: true });
    this.store = this.loadOrInit();
  }

  private createFreshStore(): PreviewStore {
    return {
      setupCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
      users: [],
      companies: [
        {
          id: 'co_main',
          name: 'Main Company',
          legacy: true,
          deleted: false,
          createdAt: new Date().toISOString(),
          createdBy: 'system',
        },
      ],
      companyData: { co_main: {} },
      sessions: {},
      auditLogs: [],
      backups: {},
      emailLogs: [],
      connectors: { gmail: false, drive: false, gmailAt: '', driveAt: '', by: '' },
    };
  }

  private loadOrInit(): PreviewStore {
    try {
      if (fs.existsSync(this.storeFile)) {
        const parsed = JSON.parse(fs.readFileSync(this.storeFile, 'utf8'));
        if (parsed && Array.isArray(parsed.companies)) {
          return parsed;
        }
      }
    } catch {
      // fall through to fresh store
    }
    const fresh = this.createFreshStore();
    this.save(fresh);
    return fresh;
  }

  private save(nextStore = this.store): void {
    this.store = nextStore;
    fs.writeFileSync(this.storeFile, JSON.stringify(this.store, null, 2), 'utf8');
  }

  public reset(): { setupCode: string } {
    const fresh = this.createFreshStore();
    this.save(fresh);
    return { setupCode: fresh.setupCode };
  }

  public getInfo() {
    const mainData = this.store.companyData['co_main'] || {};
    let vendorCount = 0;
    let poCount = 0;
    try {
      vendorCount = JSON.parse(mainData.vendors?.value || '[]').length;
    } catch {
      vendorCount = 0;
    }
    try {
      poCount = JSON.parse(mainData.purchase_orders?.value || '[]').length;
    } catch {
      poCount = 0;
    }
    return {
      hasUsers: this.store.users.length > 0,
      setupCode: this.store.users.length === 0 ? this.store.setupCode : null,
      companiesCount: this.store.companies.filter((c) => !c.deleted).length,
      vendorCount,
      poCount,
    };
  }

  private hashPw(pw: string, salt: string): string {
    return crypto.scryptSync(pw, salt, 32).toString('hex');
  }

  private verifyPw(u: PreviewUser, pw: string): boolean {
    const derived = crypto.scryptSync(pw, u.salt, 32);
    const stored = Buffer.from(u.passwordHash, 'hex');
    return derived.length === stored.length && crypto.timingSafeEqual(derived, stored);
  }

  private splitToken(token?: string): { tok: string; co: string } {
    const raw = String(token || '');
    const i = raw.indexOf('~');
    return i < 0 ? { tok: raw, co: '' } : { tok: raw.slice(0, i), co: raw.slice(i + 1) };
  }

  private accessFor(u: PreviewUser) {
    const read = new Set<string>();
    const write = new Set<string>();
    const menus: Record<string, string> = {};
    if (u.role === 'Admin') {
      [...Object.keys(MENU_DEF), ...ADMIN_ONLY_MENUS].forEach((m) => (menus[m] = 'edit'));
      CLIENT_KEYS.forEach((k) => {
        read.add(k);
        write.add(k);
      });
      return { menus, read: [...read], write: [...write], options: { delete: true, export: true } };
    }
    for (const m of Object.keys(MENU_DEF)) {
      const lvl = u.perms?.menus?.[m] || 'none';
      menus[m] = lvl;
      if (lvl !== 'none') MENU_DEF[m].read.forEach((k) => read.add(k));
      if (lvl === 'edit')
        MENU_DEF[m].write.forEach((k) => {
          write.add(k);
          read.add(k);
        });
    }
    ADMIN_ONLY_MENUS.forEach((m) => (menus[m] = 'none'));
    return {
      menus,
      read: [...read],
      write: [...write],
      options: { delete: !!u.perms?.options?.delete, export: !!u.perms?.options?.export },
    };
  }

  private sessionUser(u: PreviewUser) {
    return { id: u.id, name: u.name, email: u.email, role: u.role, access: this.accessFor(u) };
  }

  private publicUser(u: PreviewUser) {
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      companyIds: u.companyIds,
      perms: u.perms,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin,
    };
  }

  private requireUser(token?: string): PreviewUser {
    const { tok } = this.splitToken(token);
    if (!tok) throw new Error('AUTH: Please sign in.');
    const sess = this.store.sessions[tok];
    if (!sess || sess.expiresAt < Date.now()) {
      delete this.store.sessions[tok];
      this.save();
      throw new Error('AUTH: Your session has expired. Please sign in again.');
    }
    const u = this.store.users.find((x) => x.id === sess.userId);
    if (!u || !u.active || u.sv !== sess.sv) {
      delete this.store.sessions[tok];
      this.save();
      throw new Error('AUTH: This session is no longer valid. Please sign in again.');
    }
    sess.expiresAt = Date.now() + 21600 * 1000;
    return u;
  }

  private requireCompany(u: PreviewUser, token?: string) {
    const { co } = this.splitToken(token);
    const allowed = this.store.companies.filter(
      (c) => !c.deleted && (u.role === 'Admin' || !u.companyIds || u.companyIds.includes(c.id))
    );
    const picked = co ? allowed.find((c) => c.id === co) : allowed[0];
    if (!picked) throw new Error('PERM: You do not have access to this company.');
    return picked;
  }

  private audit(who: string, action: string, detail = '') {
    this.store.auditLogs.unshift({ time: new Date().toISOString(), who, action, detail });
    if (this.store.auditLogs.length > 200) this.store.auditLogs.length = 200;
  }

  private dbGetAllFor(u: PreviewUser, co: PreviewCompany) {
    const acc = this.accessFor(u);
    const bucket = this.store.companyData[co.id] || {};
    const data: Record<string, string> = {};
    const revs: Record<string, number> = {};
    for (const k of acc.read) {
      if (bucket[k]) {
        data[k] = bucket[k].value;
        revs[k] = bucket[k].rev;
      }
    }
    return { data, revs, access: acc, co: { id: co.id, name: co.name }, serverTime: new Date().toISOString() };
  }

  public dispatch(fn: string, tokenArg: string, args: any[]): any {
    switch (fn) {
      case 'authStatus':
        return { hasUsers: this.store.users.length > 0 };

      case 'authSetupFirstAdmin': {
        const [name, email, password, setupCode] = args;
        if (this.store.users.length > 0) throw new Error('An administrator already exists. Sign in instead.');
        if (!String(name || '').trim()) throw new Error("Enter the administrator's name.");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim())) throw new Error('Enter a valid email address.');
        if (String(password || '').length < 8) throw new Error('Use at least 8 characters for the password.');
        if (String(setupCode || '').trim().toUpperCase() !== this.store.setupCode) {
          throw new Error('That setup code is not correct.');
        }
        const salt = crypto.randomBytes(16).toString('hex');
        const user: PreviewUser = {
          id: 'usr-' + crypto.randomBytes(4).toString('hex'),
          name: String(name).trim(),
          email: String(email).trim().toLowerCase(),
          role: 'Admin',
          active: true,
          salt,
          passwordHash: this.hashPw(String(password), salt),
          sv: 0,
          perms: { menus: {}, options: { delete: true, export: true } },
          companyIds: null,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };
        this.store.users.push(user);
        const tok = crypto.randomBytes(24).toString('hex');
        this.store.sessions[tok] = { userId: user.id, sv: 0, expiresAt: Date.now() + 21600 * 1000 };
        this.audit(user.email, 'Administrator account created', 'live preview setup');
        this.save();
        return { token: tok, user: this.sessionUser(user) };
      }

      case 'authLogin': {
        const [email, password] = args;
        const norm = String(email || '').trim().toLowerCase();
        const u = this.store.users.find((x) => x.email === norm);
        if (!u || !this.verifyPw(u, String(password || ''))) {
          this.audit(norm, 'Sign-in failed', '');
          this.save();
          throw new Error('Incorrect email or password.');
        }
        if (!u.active) throw new Error('This account is disabled.');
        u.lastLogin = new Date().toISOString();
        const tok = crypto.randomBytes(24).toString('hex');
        this.store.sessions[tok] = { userId: u.id, sv: u.sv, expiresAt: Date.now() + 21600 * 1000 };
        this.audit(u.email, 'Signed in', '');
        this.save();
        return { token: tok, user: this.sessionUser(u) };
      }

      case 'authResume': {
        const u = this.requireUser(tokenArg);
        return { user: this.sessionUser(u) };
      }

      case 'authLogout': {
        const { tok } = this.splitToken(tokenArg);
        delete this.store.sessions[tok];
        this.save();
        return { ok: true };
      }

      case 'authChangePassword': {
        const u = this.requireUser(tokenArg);
        const [oldPw, newPw] = args;
        if (String(newPw || '').length < 8) throw new Error('New password must be at least 8 characters.');
        if (!this.verifyPw(u, String(oldPw || ''))) throw new Error('Current password is incorrect.');
        u.salt = crypto.randomBytes(16).toString('hex');
        u.passwordHash = this.hashPw(String(newPw), u.salt);
        u.sv += 1;
        const tok = crypto.randomBytes(24).toString('hex');
        this.store.sessions[tok] = { userId: u.id, sv: u.sv, expiresAt: Date.now() + 21600 * 1000 };
        this.audit(u.email, 'Password changed', '');
        this.save();
        return { token: tok };
      }

      case 'appBoot': {
        const [prefCo] = args;
        if (this.splitToken(tokenArg).tok) {
          try {
            return { hasUsers: true, enter: this.dispatch('appEnter', tokenArg, [prefCo]) };
          } catch (e: any) {
            if (!String(e.message).startsWith('AUTH:')) throw e;
          }
        }
        return { hasUsers: this.store.users.length > 0, enter: null };
      }

      case 'appEnter': {
        const u = this.requireUser(tokenArg);
        const [prefCo] = args;
        const companies = this.store.companies.filter(
          (c) => !c.deleted && (u.role === 'Admin' || !u.companyIds || u.companyIds.includes(c.id))
        );
        const pick = companies.find((c) => c.id === prefCo) || companies[0];
        if (!pick) throw new Error('PERM: No company available.');
        const db = this.dbGetAllFor(u, pick);
        return {
          user: this.sessionUser(u),
          companies,
          coId: pick.id,
          db,
          email: { gmail: this.store.connectors.gmail, drive: this.store.connectors.drive, from: 'noreply@localhost' },
          ai: { enabled: false },
        };
      }

      case 'dbGetAll': {
        const u = this.requireUser(tokenArg);
        const co = this.requireCompany(u, tokenArg);
        return this.dbGetAllFor(u, co);
      }

      case 'dbSetMany': {
        const u = this.requireUser(tokenArg);
        const co = this.requireCompany(u, tokenArg);
        const acc = this.accessFor(u);
        const [items = {}, expectedRevs = {}, force = false] = args;
        const bucket = (this.store.companyData[co.id] = this.store.companyData[co.id] || {});
        const revs: Record<string, number> = {};
        const conflicts: string[] = [];

        for (const k of Object.keys(items)) {
          if (!CLIENT_KEYS.includes(k as any)) throw new Error('PERM: Unknown key ' + k);
          if (!acc.write.includes(k)) throw new Error('PERM: No write access to ' + k);
          const cur = bucket[k];
          const curRev = cur ? cur.rev : 0;
          if (!force && curRev !== (Number(expectedRevs[k]) || 0)) {
            revs[k] = curRev;
            conflicts.push(k);
            continue;
          }
          const newRev = curRev + 1;
          bucket[k] = { rev: newRev, value: String(items[k]) };
          revs[k] = newRev;
        }
        this.save();
        return { revs, conflicts, co: co.id };
      }

      case 'companyList': {
        const u = this.requireUser(tokenArg);
        const active = this.store.companies.filter(
          (c) => !c.deleted && (u.role === 'Admin' || !u.companyIds || u.companyIds.includes(c.id))
        );
        return u.role === 'Admin'
          ? { companies: active, deleted: this.store.companies.filter((c) => c.deleted) }
          : { companies: active };
      }

      case 'companyCreate': {
        const u = this.requireUser(tokenArg);
        if (u.role !== 'Admin') throw new Error('PERM: Administrator access is required.');
        const [input = {}] = args;
        const name = String(input.name || '').trim();
        if (!name) throw new Error('Enter the company name.');
        const id = 'co_' + crypto.randomBytes(4).toString('hex');
        this.store.companies.push({
          id,
          name,
          legacy: false,
          deleted: false,
          createdAt: new Date().toISOString(),
          createdBy: u.email,
        });
        this.store.companyData[id] = {
          company_profile: { rev: 1, value: JSON.stringify({ companyName: name }) },
        };
        this.audit(u.email, 'Company created', name);
        this.save();
        return { id, lists: this.dispatch('companyList', tokenArg, []) };
      }

      case 'companyRename': {
        const u = this.requireUser(tokenArg);
        if (u.role !== 'Admin') throw new Error('PERM: Administrator access is required.');
        const [id, newName] = args;
        const c = this.store.companies.find((x) => x.id === id && !x.deleted);
        if (!c) throw new Error('Company not found.');
        c.name = String(newName || '').trim() || c.name;
        this.save();
        return this.dispatch('companyList', tokenArg, []);
      }

      case 'companyDelete': {
        const u = this.requireUser(tokenArg);
        if (u.role !== 'Admin') throw new Error('PERM: Administrator access is required.');
        const [id, confirmName] = args;
        const c = this.store.companies.find((x) => x.id === id && !x.deleted);
        if (!c || c.legacy) throw new Error('Cannot delete this company.');
        if (String(confirmName || '').trim() !== c.name) throw new Error('Type the company name exactly.');
        c.deleted = true;
        c.deletedAt = new Date().toISOString();
        c.deletedBy = u.email;
        this.save();
        return this.dispatch('companyList', tokenArg, []);
      }

      case 'companyRestore': {
        const u = this.requireUser(tokenArg);
        if (u.role !== 'Admin') throw new Error('PERM: Administrator access is required.');
        const [id] = args;
        const c = this.store.companies.find((x) => x.id === id && x.deleted);
        if (!c) throw new Error('Company not in deleted list.');
        c.deleted = false;
        this.save();
        return this.dispatch('companyList', tokenArg, []);
      }

      case 'usersList': {
        const u = this.requireUser(tokenArg);
        if (u.role !== 'Admin') throw new Error('PERM: Administrator access is required.');
        return this.store.users.map((x) => this.publicUser(x));
      }

      case 'userSave': {
        const me = this.requireUser(tokenArg);
        if (me.role !== 'Admin') throw new Error('PERM: Administrator access is required.');
        const [input = {}, password = ''] = args;
        const email = String(input.email || '').trim().toLowerCase();
        const name = String(input.name || '').trim();
        if (!name || !email) throw new Error('Name and email are required.');
        if (input.id) {
          const target = this.store.users.find((x) => x.id === input.id);
          if (!target) throw new Error('User not found.');
          target.name = name;
          target.email = email;
          target.role = input.role === 'Admin' ? 'Admin' : 'User';
          target.active = input.active !== false;
          target.perms = input.perms || target.perms;
          if (password) {
            target.salt = crypto.randomBytes(16).toString('hex');
            target.passwordHash = this.hashPw(String(password), target.salt);
            target.sv += 1;
          }
        } else {
          if (!password || String(password).length < 8) throw new Error('Set a password (min 8 chars).');
          const salt = crypto.randomBytes(16).toString('hex');
          this.store.users.push({
            id: 'usr-' + crypto.randomBytes(4).toString('hex'),
            name,
            email,
            role: input.role === 'Admin' ? 'Admin' : 'User',
            active: input.active !== false,
            salt,
            passwordHash: this.hashPw(String(password), salt),
            sv: 0,
            perms: input.perms || { menus: {}, options: { delete: false, export: true } },
            companyIds: Array.isArray(input.companyIds) ? input.companyIds : null,
            createdAt: new Date().toISOString(),
            lastLogin: '',
          });
        }
        this.save();
        return this.store.users.map((x) => this.publicUser(x));
      }

      case 'userDelete': {
        const me = this.requireUser(tokenArg);
        if (me.role !== 'Admin') throw new Error('PERM: Administrator access is required.');
        const [id] = args;
        if (id === me.id) throw new Error('Cannot delete your own account.');
        this.store.users = this.store.users.filter((x) => x.id !== id);
        this.save();
        return this.store.users.map((x) => this.publicUser(x));
      }

      case 'auditList': {
        const me = this.requireUser(tokenArg);
        if (me.role !== 'Admin') throw new Error('PERM: Administrator access is required.');
        return this.store.auditLogs;
      }

      case 'syncPing':
        return { status: 'ok', message: 'Vendor Register PHP/MySQL backend is live.' };

      case 'syncListTables': {
        const u = this.requireUser(tokenArg);
        const co = this.requireCompany(u, tokenArg);
        const bucket = this.store.companyData[co.id] || {};
        return {
          status: 'ok',
          tables: CLIENT_KEYS.map((k) => {
            let count = 0;
            try {
              const p = JSON.parse(bucket[k]?.value || '[]');
              count = Array.isArray(p) ? p.length : 1;
            } catch {
              count = 0;
            }
            return { name: k, rows: count };
          }),
        };
      }

      case 'listBackups': {
        const u = this.requireUser(tokenArg);
        const co = this.requireCompany(u, tokenArg);
        return (this.store.backups[co.id] || []).map(({ id, name, size, created }) => ({ id, name, size, created }));
      }

      case 'getBackupStatus': {
        const u = this.requireUser(tokenArg);
        const co = this.requireCompany(u, tokenArg);
        const list = this.store.backups[co.id] || [];
        return {
          triggerInstalled: false,
          lastBackup: list[0]?.created || null,
          folderUrl: '',
          spreadsheetUrl: '',
          company: co.name,
        };
      }

      case 'createManualBackup': {
        const u = this.requireUser(tokenArg);
        const co = this.requireCompany(u, tokenArg);
        const payload = JSON.stringify({ company: co, data: this.store.companyData[co.id] || {} });
        const bk = {
          id: 'bk_' + crypto.randomBytes(4).toString('hex'),
          name: `VendorRegister_${co.id}_${Date.now()}_manual.json`,
          size: Buffer.byteLength(payload),
          created: new Date().toISOString(),
          payload,
        };
        this.store.backups[co.id] = [bk, ...(this.store.backups[co.id] || [])];
        this.save();
        return { id: bk.id, name: bk.name, size: bk.size };
      }

      case 'uploadLogo': {
        const u = this.requireUser(tokenArg);
        const co = this.requireCompany(u, tokenArg);
        const [payload = {}] = args;
        const bin = Buffer.from(String(payload.data || ''), 'base64');
        const safeName = `${co.id}-${crypto.randomBytes(4).toString('hex')}.png`;
        fs.writeFileSync(path.join(this.uploadDir, safeName), bin);
        return {
          status: 'ok',
          fileId: safeName,
          url: `/live-app/uploads/${safeName}`,
          directUrl: `/live-app/uploads/${safeName}`,
        };
      }

      case 'connectorsStatus':
        return { ...this.store.connectors, from: 'noreply@localhost', quota: null, folderUrl: '', log: this.store.emailLogs };
      case 'emailStatus':
        return { gmail: this.store.connectors.gmail, drive: this.store.connectors.drive, from: 'noreply@localhost' };
      case 'emailLogList':
        return this.store.emailLogs;
      case 'aiStatus':
        return { enabled: false };
      case 'aiAdminStatus':
        return { enabled: false, hasKey: false, keyHint: '', model: 'claude-sonnet-5-5' };

      default:
        throw new Error(`Method "${fn}" is implemented in the PHP export package.`);
    }
  }
}
