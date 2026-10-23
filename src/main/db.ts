import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'

let db: DatabaseSync

/** Tables mirrored to the cloud. Every insert/update is queued in sync_outbox by trigger. */
export const SYNCED_TABLES = [
  'users',
  'customers',
  'pets',
  'visits',
  'vaccine_types',
  'vaccinations',
  'products',
  'stock_moves',
  'invoices',
  'invoice_items',
  'payments',
  'shifts',
  'queue',
  'attachments',
  'admissions',
  'admission_charges',
  'appointments'
] as const

const MIGRATIONS: string[] = [
  /* 1 — initial schema */ `
  CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE users (
    id               TEXT PRIMARY KEY,
    username         TEXT NOT NULL UNIQUE,
    display_name     TEXT NOT NULL,
    role             TEXT NOT NULL CHECK (role IN ('owner','manager','vet','staff')),
    pin_hash         TEXT NOT NULL,
    max_discount_pct REAL NOT NULL DEFAULT 0,
    is_vet           INTEGER NOT NULL DEFAULT 0,
    license_no       TEXT,
    active           INTEGER NOT NULL DEFAULT 1,
    created_at       TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at       TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE customers (
    id              TEXT PRIMARY KEY,
    code            TEXT UNIQUE,
    name            TEXT NOT NULL,
    phone           TEXT,
    phone2          TEXT,
    line_id         TEXT,
    address         TEXT,
    tax_id          TEXT,
    note            TEXT,
    pdpa_consent_at TEXT,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX idx_customers_phone ON customers(phone);
  CREATE INDEX idx_customers_name  ON customers(name);

  CREATE TABLE pets (
    id           TEXT PRIMARY KEY,
    customer_id  TEXT NOT NULL REFERENCES customers(id),
    name         TEXT NOT NULL,
    species      TEXT NOT NULL,
    breed        TEXT,
    sex          TEXT CHECK (sex IN ('M','F','U')) DEFAULT 'U',
    neutered     INTEGER NOT NULL DEFAULT 0,
    birth_date   TEXT,
    color        TEXT,
    microchip    TEXT,
    weight_kg    REAL,
    allergy_note TEXT,
    warning_note TEXT,
    note         TEXT,
    deceased     INTEGER NOT NULL DEFAULT 0,
    active       INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX idx_pets_customer ON pets(customer_id);
  CREATE INDEX idx_pets_name     ON pets(name);

  CREATE TABLE visits (
    id          TEXT PRIMARY KEY,
    pet_id      TEXT NOT NULL REFERENCES pets(id),
    vet_id      TEXT REFERENCES users(id),
    visit_date  TEXT NOT NULL,
    weight_kg   REAL,
    temp_c      REAL,
    heart_rate  INTEGER,
    resp_rate   INTEGER,
    subjective  TEXT,
    objective   TEXT,
    assessment  TEXT,
    plan        TEXT,
    invoice_id  TEXT,
    created_by  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX idx_visits_pet ON visits(pet_id, visit_date);

  CREATE TABLE products (
    id          TEXT PRIMARY KEY,
    sku         TEXT UNIQUE,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL CHECK (category IN ('service','procedure','vaccine','medicine','food','supply','other')),
    unit        TEXT NOT NULL DEFAULT 'ชิ้น',
    price       REAL NOT NULL DEFAULT 0,
    avg_cost    REAL NOT NULL DEFAULT 0,
    stock_qty   REAL NOT NULL DEFAULT 0,
    min_stock   REAL NOT NULL DEFAULT 0,
    track_stock INTEGER NOT NULL DEFAULT 1,
    vat_type    TEXT NOT NULL DEFAULT 'vat' CHECK (vat_type IN ('vat','exempt')),
    needs_vet   INTEGER NOT NULL DEFAULT 0,
    note        TEXT,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX idx_products_name ON products(name);

  CREATE TABLE vaccine_types (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    species       TEXT,
    interval_days INTEGER NOT NULL DEFAULT 365,
    product_id    TEXT REFERENCES products(id),
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE vaccinations (
    id              TEXT PRIMARY KEY,
    pet_id          TEXT NOT NULL REFERENCES pets(id),
    vaccine_type_id TEXT REFERENCES vaccine_types(id),
    name            TEXT NOT NULL,
    given_date      TEXT NOT NULL,
    next_due_date   TEXT,
    lot_no          TEXT,
    vet_id          TEXT REFERENCES users(id),
    invoice_id      TEXT,
    done_followup   INTEGER NOT NULL DEFAULT 0,
    note            TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX idx_vacc_pet ON vaccinations(pet_id, given_date);
  CREATE INDEX idx_vacc_due ON vaccinations(next_due_date);

  CREATE TABLE shifts (
    id            TEXT PRIMARY KEY,
    opened_by     TEXT NOT NULL REFERENCES users(id),
    opened_at     TEXT NOT NULL,
    opening_cash  REAL NOT NULL DEFAULT 0,
    closed_by     TEXT REFERENCES users(id),
    closed_at     TEXT,
    expected_cash REAL,
    counted_cash  REAL,
    diff          REAL,
    note          TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE invoices (
    id              TEXT PRIMARY KEY,
    invoice_no      TEXT NOT NULL UNIQUE,
    doc_type        TEXT NOT NULL DEFAULT 'receipt',
    customer_id     TEXT REFERENCES customers(id),
    pet_id          TEXT REFERENCES pets(id),
    visit_id        TEXT,
    status          TEXT NOT NULL CHECK (status IN ('paid','partial','unpaid','void')),
    subtotal        REAL NOT NULL,
    line_discount   REAL NOT NULL DEFAULT 0,
    bill_discount   REAL NOT NULL DEFAULT 0,
    vat_enabled     INTEGER NOT NULL DEFAULT 0,
    vat_inclusive   INTEGER NOT NULL DEFAULT 1,
    vat_rate        REAL NOT NULL DEFAULT 0,
    vatable_amount  REAL NOT NULL DEFAULT 0,
    exempt_amount   REAL NOT NULL DEFAULT 0,
    vat_amount      REAL NOT NULL DEFAULT 0,
    total           REAL NOT NULL,
    paid_amount     REAL NOT NULL DEFAULT 0,
    cost_total      REAL NOT NULL DEFAULT 0,
    note            TEXT,
    discount_approved_by TEXT,
    shift_id        TEXT REFERENCES shifts(id),
    created_by      TEXT NOT NULL REFERENCES users(id),
    issued_at       TEXT NOT NULL,
    void_reason     TEXT,
    void_by         TEXT,
    void_approved_by TEXT,
    void_at         TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX idx_invoices_issued   ON invoices(issued_at);
  CREATE INDEX idx_invoices_customer ON invoices(customer_id);
  CREATE INDEX idx_invoices_status   ON invoices(status);

  CREATE TABLE invoice_items (
    id          TEXT PRIMARY KEY,
    invoice_id  TEXT NOT NULL REFERENCES invoices(id),
    seq         INTEGER NOT NULL,
    product_id  TEXT REFERENCES products(id),
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,
    unit        TEXT,
    qty         REAL NOT NULL,
    unit_price  REAL NOT NULL,
    discount    REAL NOT NULL DEFAULT 0,
    line_total  REAL NOT NULL,
    unit_cost   REAL NOT NULL DEFAULT 0,
    vat_type    TEXT NOT NULL DEFAULT 'vat',
    vet_id      TEXT REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX idx_items_invoice ON invoice_items(invoice_id);
  CREATE INDEX idx_items_vet     ON invoice_items(vet_id);

  -- kind: payment (pays an invoice) | deposit (money held for a customer) | refund (money returned)
  -- method: cash | transfer | promptpay | deposit (spending a held deposit)
  CREATE TABLE payments (
    id          TEXT PRIMARY KEY,
    invoice_id  TEXT REFERENCES invoices(id),
    customer_id TEXT REFERENCES customers(id),
    kind        TEXT NOT NULL CHECK (kind IN ('payment','deposit','refund')),
    method      TEXT NOT NULL CHECK (method IN ('cash','transfer','promptpay','deposit')),
    amount      REAL NOT NULL,
    note        TEXT,
    shift_id    TEXT REFERENCES shifts(id),
    created_by  TEXT NOT NULL REFERENCES users(id),
    paid_at     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX idx_payments_invoice  ON payments(invoice_id);
  CREATE INDEX idx_payments_shift    ON payments(shift_id);
  CREATE INDEX idx_payments_customer ON payments(customer_id);

  -- type: receive | sale | adjust | void_return
  CREATE TABLE stock_moves (
    id         TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    type       TEXT NOT NULL,
    qty        REAL NOT NULL,
    unit_cost  REAL NOT NULL DEFAULT 0,
    ref_id     TEXT,
    note       TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX idx_moves_product ON stock_moves(product_id, created_at);

  CREATE TABLE doc_counters (
    prefix  TEXT PRIMARY KEY,
    last_no INTEGER NOT NULL
  );

  CREATE TABLE audit_log (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT,
    action     TEXT NOT NULL,
    entity     TEXT,
    entity_id  TEXT,
    detail     TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE sync_outbox (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    tbl        TEXT NOT NULL,
    row_id     TEXT NOT NULL,
    op         TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    synced_at  TEXT
  );
  CREATE INDEX idx_outbox_pending ON sync_outbox(synced_at);
  `,
  /* 2 — today's queue (front desk → exam → payment) */ `
  CREATE TABLE queue (
    id          TEXT PRIMARY KEY,
    queue_no    INTEGER NOT NULL,
    queue_date  TEXT NOT NULL,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    pet_id      TEXT NOT NULL REFERENCES pets(id),
    reason      TEXT,
    status      TEXT NOT NULL CHECK (status IN ('waiting','in_exam','to_pay','done','cancelled')),
    vet_id      TEXT REFERENCES users(id),
    visit_id    TEXT,
    invoice_id  TEXT,
    created_by  TEXT REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX idx_queue_date ON queue(queue_date, queue_no);
  `,
  /* 3 — features from the old VETSERVER program */ `
  ALTER TABLE customers ADD COLUMN province TEXT;
  ALTER TABLE customers ADD COLUMN postcode TEXT;
  ALTER TABLE customers ADD COLUMN member_since TEXT;
  ALTER TABLE customers ADD COLUMN member_expire TEXT;

  ALTER TABLE pets ADD COLUMN code TEXT;
  CREATE UNIQUE INDEX idx_pets_code ON pets(code);

  ALTER TABLE visits ADD COLUMN history TEXT;
  ALTER TABLE visits ADD COLUMN blood_result TEXT;
  ALTER TABLE visits ADD COLUMN xray TEXT;
  ALTER TABLE visits ADD COLUMN lab_other TEXT;
  ALTER TABLE visits ADD COLUMN diff_diag TEXT;
  ALTER TABLE visits ADD COLUMN treatment TEXT;
  ALTER TABLE visits ADD COLUMN prescription TEXT;

  CREATE TABLE attachments (
    id         TEXT PRIMARY KEY,
    pet_id     TEXT NOT NULL REFERENCES pets(id),
    visit_id   TEXT,
    kind       TEXT,
    file_name  TEXT NOT NULL,
    stored_as  TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX idx_attach_pet ON attachments(pet_id, visit_id);

  -- products: new categories (grooming, boarding) + drug label + controlled drug flag
  CREATE TABLE products_v3 (
    id          TEXT PRIMARY KEY,
    sku         TEXT UNIQUE,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL CHECK (category IN ('service','procedure','vaccine','medicine','food','supply','grooming','boarding','other')),
    unit        TEXT NOT NULL DEFAULT 'ชิ้น',
    price       REAL NOT NULL DEFAULT 0,
    avg_cost    REAL NOT NULL DEFAULT 0,
    stock_qty   REAL NOT NULL DEFAULT 0,
    min_stock   REAL NOT NULL DEFAULT 0,
    track_stock INTEGER NOT NULL DEFAULT 1,
    vat_type    TEXT NOT NULL DEFAULT 'vat' CHECK (vat_type IN ('vat','exempt')),
    needs_vet   INTEGER NOT NULL DEFAULT 0,
    drug_group  TEXT,
    label_th    TEXT,
    label_en    TEXT,
    controlled  INTEGER NOT NULL DEFAULT 0,
    note        TEXT,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  INSERT INTO products_v3 (id,sku,name,category,unit,price,avg_cost,stock_qty,min_stock,track_stock,vat_type,needs_vet,note,active,created_at,updated_at)
    SELECT id,sku,name,category,unit,price,avg_cost,stock_qty,min_stock,track_stock,vat_type,needs_vet,note,active,created_at,updated_at FROM products;
  DROP TABLE products;
  ALTER TABLE products_v3 RENAME TO products;
  CREATE INDEX idx_products_name ON products(name);

  -- payments: add card
  CREATE TABLE payments_v3 (
    id          TEXT PRIMARY KEY,
    invoice_id  TEXT REFERENCES invoices(id),
    customer_id TEXT REFERENCES customers(id),
    kind        TEXT NOT NULL CHECK (kind IN ('payment','deposit','refund')),
    method      TEXT NOT NULL CHECK (method IN ('cash','transfer','promptpay','card','deposit')),
    amount      REAL NOT NULL,
    note        TEXT,
    shift_id    TEXT REFERENCES shifts(id),
    created_by  TEXT NOT NULL REFERENCES users(id),
    paid_at     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  INSERT INTO payments_v3 SELECT * FROM payments;
  DROP TABLE payments;
  ALTER TABLE payments_v3 RENAME TO payments;
  CREATE INDEX idx_payments_invoice  ON payments(invoice_id);
  CREATE INDEX idx_payments_shift    ON payments(shift_id);
  CREATE INDEX idx_payments_customer ON payments(customer_id);

  ALTER TABLE invoice_items ADD COLUMN instruction TEXT;
  ALTER TABLE invoice_items ADD COLUMN from_admission INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE invoices ADD COLUMN admission_id TEXT;

  -- Admit / boarding: a stay that collects daily charges and is billed at discharge
  CREATE TABLE admissions (
    id            TEXT PRIMARY KEY,
    admit_no      TEXT NOT NULL UNIQUE,
    pet_id        TEXT NOT NULL REFERENCES pets(id),
    customer_id   TEXT NOT NULL REFERENCES customers(id),
    kind          TEXT NOT NULL DEFAULT 'ipd' CHECK (kind IN ('ipd','boarding')),
    cage          TEXT,
    reason        TEXT,
    vet_id        TEXT REFERENCES users(id),
    admitted_at   TEXT NOT NULL,
    expected_out  TEXT,
    discharged_at TEXT,
    status        TEXT NOT NULL DEFAULT 'admitted' CHECK (status IN ('admitted','discharged','cancelled')),
    invoice_id    TEXT REFERENCES invoices(id),
    note          TEXT,
    created_by    TEXT REFERENCES users(id),
    created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX idx_admissions_status ON admissions(status);

  CREATE TABLE admission_charges (
    id           TEXT PRIMARY KEY,
    admission_id TEXT NOT NULL REFERENCES admissions(id),
    charge_date  TEXT NOT NULL,
    product_id   TEXT NOT NULL REFERENCES products(id),
    name         TEXT NOT NULL,
    category     TEXT NOT NULL,
    unit         TEXT,
    qty          REAL NOT NULL,
    unit_price   REAL NOT NULL,
    discount     REAL NOT NULL DEFAULT 0,
    unit_cost    REAL NOT NULL DEFAULT 0,
    vet_id       TEXT REFERENCES users(id),
    note         TEXT,
    voided       INTEGER NOT NULL DEFAULT 0,
    created_by   TEXT REFERENCES users(id),
    created_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at   TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX idx_charges_admission ON admission_charges(admission_id, charge_date);

  CREATE TABLE appointments (
    id          TEXT PRIMARY KEY,
    pet_id      TEXT NOT NULL REFERENCES pets(id),
    customer_id TEXT NOT NULL REFERENCES customers(id),
    appt_date   TEXT NOT NULL,
    appt_time   TEXT,
    topic       TEXT NOT NULL,
    detail      TEXT,
    vet_id      TEXT REFERENCES users(id),
    status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','cancelled','no_show')),
    called_at   TEXT,
    visit_id    TEXT,
    created_by  TEXT REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
  CREATE INDEX idx_appt_date ON appointments(appt_date, status);
  `,
  // Link a queue entry to the appointment it came from (blank = walk-in)
  `
  ALTER TABLE queue ADD COLUMN appointment_id TEXT REFERENCES appointments(id);
  `
]

function syncTriggers(): string {
  return SYNCED_TABLES.map(
    (t) => `
    CREATE TRIGGER IF NOT EXISTS trg_${t}_ins AFTER INSERT ON ${t}
    BEGIN INSERT INTO sync_outbox (tbl,row_id,op) VALUES ('${t}', NEW.id, 'upsert'); END;
    CREATE TRIGGER IF NOT EXISTS trg_${t}_upd AFTER UPDATE ON ${t}
    BEGIN INSERT INTO sync_outbox (tbl,row_id,op) VALUES ('${t}', NEW.id, 'upsert'); END;`
  ).join('\n')
}

export function openDb(file: string): DatabaseSync {
  db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
  const { user_version } = db.prepare('PRAGMA user_version').get() as { user_version: number }
  // Some migrations rebuild tables (to widen CHECK lists), which needs FK enforcement off.
  db.exec('PRAGMA foreign_keys = OFF')
  for (let v = user_version; v < MIGRATIONS.length; v++) {
    tx(() => {
      db.exec(MIGRATIONS[v])
      const broken = db.prepare('PRAGMA foreign_key_check').all()
      if (broken.length) throw new Error(`migration ${v + 1} broke foreign keys`)
      db.exec(`PRAGMA user_version = ${v + 1}`)
    })
  }
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(syncTriggers())
  backfillPetCodes()
  seedDefaults()
  return db
}

export function getDb(): DatabaseSync {
  return db
}

export const uid = (): string => randomUUID()

export const now = (): string => {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export const today = (): string => now().slice(0, 10)

/** Round to satang to avoid floating point drift in money totals. */
export const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

let txDepth = 0
export function tx<T>(fn: () => T): T {
  if (txDepth > 0) return fn()
  txDepth++
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    db.exec('COMMIT')
    return result
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  } finally {
    txDepth--
  }
}

export function all<T = any>(sql: string, ...params: any[]): T[] {
  return db.prepare(sql).all(...params) as T[]
}

export function one<T = any>(sql: string, ...params: any[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined
}

export function run(sql: string, ...params: any[]): void {
  db.prepare(sql).run(...params)
}

/** Insert a row from a plain object. Undefined values are skipped. */
export function insert(table: string, row: Record<string, any>): void {
  const keys = Object.keys(row).filter((k) => row[k] !== undefined)
  const sql = `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`
  db.prepare(sql).run(...keys.map((k) => normalize(row[k])))
}

/** Update a row by id from a plain object, always bumping updated_at. */
export function update(table: string, id: string, patch: Record<string, any>): void {
  const keys = Object.keys(patch).filter((k) => patch[k] !== undefined && k !== 'id')
  const sets = [...keys.map((k) => `${k} = ?`), `updated_at = ?`]
  const sql = `UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`
  db.prepare(sql).run(...keys.map((k) => normalize(patch[k])), now(), id)
}

function normalize(v: any): any {
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v === '') return null
  return v
}

export function getSetting(key: string, fallback = ''): string {
  const row = one<{ value: string }>('SELECT value FROM settings WHERE key = ?', key)
  return row?.value ?? fallback
}

export function setSetting(key: string, value: string): void {
  run(
    'INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  )
}

export function audit(
  userId: string | null,
  action: string,
  entity?: string,
  entityId?: string,
  detail?: unknown
): void {
  run(
    'INSERT INTO audit_log (user_id,action,entity,entity_id,detail) VALUES (?,?,?,?,?)',
    userId,
    action,
    entity ?? null,
    entityId ?? null,
    detail === undefined ? null : JSON.stringify(detail)
  )
}

/** Next running number for a prefix — never reused, never skipped (runs inside the caller's transaction). */
export function nextDocNo(prefix: string, width = 4): string {
  const row = one<{ last_no: number }>('SELECT last_no FROM doc_counters WHERE prefix = ?', prefix)
  const next = (row?.last_no ?? 0) + 1
  run(
    'INSERT INTO doc_counters (prefix,last_no) VALUES (?,?) ON CONFLICT(prefix) DO UPDATE SET last_no = excluded.last_no',
    prefix,
    next
  )
  return `${prefix}-${String(next).padStart(width, '0')}`
}

/** Raw running counter (no formatting). */
export function nextCounter(key: string): number {
  const row = one<{ last_no: number }>('SELECT last_no FROM doc_counters WHERE prefix = ?', key)
  const next = (row?.last_no ?? 0) + 1
  run(
    'INSERT INTO doc_counters (prefix,last_no) VALUES (?,?) ON CONFLICT(prefix) DO UPDATE SET last_no = excluded.last_no',
    key,
    next
  )
  return next
}

/** Buddhist-era 2-digit year, e.g. 2026 → "69". */
export const beYear = (d = new Date()): string => String(d.getFullYear() + 543).slice(2)

/** Pet codes follow the old program: <BE year>/<running number of that year>, e.g. 69/15. */
export function nextPetCode(): string {
  const yy = beYear()
  for (;;) {
    const code = `${yy}/${nextCounter(`PET${yy}`)}`
    if (!one('SELECT 1 FROM pets WHERE code = ?', code)) return code
  }
}

function backfillPetCodes(): void {
  const missing = all<{ id: string }>('SELECT id FROM pets WHERE code IS NULL ORDER BY created_at')
  if (!missing.length) return
  tx(() => {
    for (const p of missing) update('pets', p.id, { code: nextPetCode() })
  })
}

function seedDefaults(): void {
  const defaults: Record<string, string> = {
    shop_name: 'ริมปิงสัตวแพทย์',
    shop_name_en: 'Rimping Veterinary Clinic',
    shop_address: '',
    shop_phone: '',
    shop_tax_id: '',
    promptpay_id: '',
    vat_enabled: '0',
    vat_inclusive: '1',
    vat_rate: '7',
    vat_start_date: '',
    receipt_footer: 'ขอบคุณที่ไว้วางใจ ริมปิงสัตวแพทย์ 🐾',
    closed_weekdays: '2', // 0 = Sunday … 6 = Saturday; the clinic closes on Tuesdays
    backup_dir: ''
  }
  for (const [k, v] of Object.entries(defaults)) {
    run('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)', k, v)
  }

  const hasProducts = one<{ n: number }>('SELECT COUNT(*) AS n FROM products')!.n > 0
  if (hasProducts) return
  tx(() => {
    const p = (
      name: string,
      category: string,
      price: number,
      unit: string,
      opts: Partial<{ track: number; vat: string; vet: number }> = {}
    ): string => {
      const id = uid()
      const service = ['service', 'procedure'].includes(category)
      insert('products', {
        id,
        name,
        category,
        price,
        unit,
        track_stock: opts.track ?? (service ? 0 : 1),
        vat_type: opts.vat ?? 'vat',
        needs_vet: opts.vet ?? (service || category === 'vaccine' ? 1 : 0)
      })
      return id
    }
    p('ค่าตรวจรักษา', 'service', 200, 'ครั้ง')
    p('ค่าบริการทางการแพทย์', 'service', 100, 'ครั้ง')
    p('ฉีดยา', 'procedure', 150, 'ครั้ง')
    p('ทำแผล', 'procedure', 200, 'ครั้ง')
    const rabies = p('วัคซีนพิษสุนัขบ้า', 'vaccine', 300, 'เข็ม')
    const dhppl = p('วัคซีนรวมสุนัข (5 โรค)', 'vaccine', 550, 'เข็ม')
    const fvrcp = p('วัคซีนรวมแมว (4 โรค)', 'vaccine', 550, 'เข็ม')
    const vt = (name: string, species: string | null, days: number, productId: string | null): void =>
      insert('vaccine_types', { id: uid(), name, species, interval_days: days, product_id: productId })
    vt('พิษสุนัขบ้า', null, 365, rabies)
    vt('รวม 5 โรค (สุนัข)', 'สุนัข', 365, dhppl)
    vt('รวม 4 โรค (แมว)', 'แมว', 365, fvrcp)
    vt('ถ่ายพยาธิ', null, 90, null)
    vt('ป้องกันเห็บหมัด', null, 30, null)
  })
}
