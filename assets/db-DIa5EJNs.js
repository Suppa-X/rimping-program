import{n as e,r as t}from"./index-DaCrQ4JP.js";var n=t(),r=()=>globalThis.crypto.randomUUID(),i=e=>n.Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(e)));function a(e,t,r){let i=n.Buffer.alloc(r),a=2166136261,o=e+n.Buffer.from(t).toString(`hex`);for(let e=0;e<r;e++){for(let t of o+e)a=Math.imul(a^t.charCodeAt(0),16777619);i[e]=a&255}return i}var o=(e,t)=>e.length===t.length&&e.every((e,n)=>e===t[n]),s,c=[`users`,`customers`,`pets`,`visits`,`vaccine_types`,`vaccinations`,`products`,`stock_moves`,`invoices`,`invoice_items`,`payments`,`shifts`,`queue`,`attachments`,`admissions`,`admission_charges`,`appointments`],l=[`
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
  `,`
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
  `,`
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
  `,`
  ALTER TABLE queue ADD COLUMN appointment_id TEXT REFERENCES appointments(id);
  `];function u(){return c.map(e=>`
    CREATE TRIGGER IF NOT EXISTS trg_${e}_ins AFTER INSERT ON ${e}
    BEGIN INSERT INTO sync_outbox (tbl,row_id,op) VALUES ('${e}', NEW.id, 'upsert'); END;
    CREATE TRIGGER IF NOT EXISTS trg_${e}_upd AFTER UPDATE ON ${e}
    BEGIN INSERT INTO sync_outbox (tbl,row_id,op) VALUES ('${e}', NEW.id, 'upsert'); END;`).join(`
`)}function d(t){s=new e(t),s.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;`);let{user_version:n}=s.prepare(`PRAGMA user_version`).get();s.exec(`PRAGMA foreign_keys = OFF`);for(let e=n;e<l.length;e++)v(()=>{if(s.exec(l[e]),s.prepare(`PRAGMA foreign_key_check`).all().length)throw Error(`migration ${e+1} broke foreign keys`);s.exec(`PRAGMA user_version = ${e+1}`)});return s.exec(`PRAGMA foreign_keys = ON`),s.exec(u()),M(),N(),s}function f(){return s}var p=()=>r(),m=()=>{let e=new Date,t=e=>String(e).padStart(2,`0`);return`${e.getFullYear()}-${t(e.getMonth()+1)}-${t(e.getDate())} ${t(e.getHours())}:${t(e.getMinutes())}:${t(e.getSeconds())}`},h=()=>m().slice(0,10),g=e=>Math.round((e+2**-52)*100)/100,_=0;function v(e){if(_>0)return e();_++,s.exec(`BEGIN IMMEDIATE`);try{let t=e();return s.exec(`COMMIT`),t}catch(e){throw s.exec(`ROLLBACK`),e}finally{_--}}function y(e,...t){return s.prepare(e).all(...t)}function b(e,...t){return s.prepare(e).get(...t)}function x(e,...t){s.prepare(e).run(...t)}function S(e,t){let n=Object.keys(t).filter(e=>t[e]!==void 0),r=`INSERT INTO ${e} (${n.join(`,`)}) VALUES (${n.map(()=>`?`).join(`,`)})`;s.prepare(r).run(...n.map(e=>w(t[e])))}function C(e,t,n){let r=Object.keys(n).filter(e=>n[e]!==void 0&&e!==`id`),i=`UPDATE ${e} SET ${[...r.map(e=>`${e} = ?`),`updated_at = ?`].join(`, `)} WHERE id = ?`;s.prepare(i).run(...r.map(e=>w(n[e])),m(),t)}function w(e){return typeof e==`boolean`?+!!e:e===``?null:e}function T(e,t=``){return b(`SELECT value FROM settings WHERE key = ?`,e)?.value??t}function E(e,t){x(`INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,e,t)}function D(e,t,n,r,i){x(`INSERT INTO audit_log (user_id,action,entity,entity_id,detail) VALUES (?,?,?,?,?)`,e,t,n??null,r??null,i===void 0?null:JSON.stringify(i))}function O(e,t=4){let n=(b(`SELECT last_no FROM doc_counters WHERE prefix = ?`,e)?.last_no??0)+1;return x(`INSERT INTO doc_counters (prefix,last_no) VALUES (?,?) ON CONFLICT(prefix) DO UPDATE SET last_no = excluded.last_no`,e,n),`${e}-${String(n).padStart(t,`0`)}`}function k(e){let t=(b(`SELECT last_no FROM doc_counters WHERE prefix = ?`,e)?.last_no??0)+1;return x(`INSERT INTO doc_counters (prefix,last_no) VALUES (?,?) ON CONFLICT(prefix) DO UPDATE SET last_no = excluded.last_no`,e,t),t}var A=(e=new Date)=>String(e.getFullYear()+543).slice(2);function j(){let e=A();for(;;){let t=`${e}/${k(`PET${e}`)}`;if(!b(`SELECT 1 FROM pets WHERE code = ?`,t))return t}}function M(){let e=y(`SELECT id FROM pets WHERE code IS NULL ORDER BY created_at`);e.length&&v(()=>{for(let t of e)C(`pets`,t.id,{code:j()})})}function N(){for(let[e,t]of Object.entries({shop_name:`ริมปิงสัตวแพทย์`,shop_name_en:`Rimping Veterinary Clinic`,shop_address:`เลขที่ 99 ถ.เทศา 1 ต.ในเมือง อ.เมืองกำแพงเพชร จ.กำแพงเพชร 62000`,shop_phone:``,shop_tax_id:``,promptpay_id:``,vat_enabled:`0`,vat_inclusive:`1`,vat_rate:`7`,vat_start_date:``,receipt_footer:`ขอบคุณที่ไว้วางใจ ริมปิงสัตวแพทย์ 🐾`,closed_weekdays:`2`,backup_dir:``}))x(`INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)`,e,t);b(`SELECT COUNT(*) AS n FROM products`).n>0||v(()=>{let e=(e,t,n,r,i={})=>{let a=p(),o=[`service`,`procedure`].includes(t);return S(`products`,{id:a,name:e,category:t,price:n,unit:r,track_stock:i.track??+!o,vat_type:i.vat??`vat`,needs_vet:i.vet??(o||t===`vaccine`?1:0)}),a};e(`ค่าตรวจรักษา`,`service`,200,`ครั้ง`),e(`ค่าบริการทางการแพทย์`,`service`,100,`ครั้ง`),e(`ฉีดยา`,`procedure`,150,`ครั้ง`),e(`ทำแผล`,`procedure`,200,`ครั้ง`);let t=e(`วัคซีนพิษสุนัขบ้า`,`vaccine`,300,`เข็ม`),n=e(`วัคซีนรวมสุนัข (5 โรค)`,`vaccine`,550,`เข็ม`),r=e(`วัคซีนรวมแมว (4 โรค)`,`vaccine`,550,`เข็ม`),i=(e,t,n,r)=>S(`vaccine_types`,{id:p(),name:e,species:t,interval_days:n,product_id:r});i(`พิษสุนัขบ้า`,null,365,t),i(`รวม 5 โรค (สุนัข)`,`สุนัข`,365,n),i(`รวม 4 โรค (แมว)`,`แมว`,365,r),i(`ถ่ายพยาธิ`,null,90,null),i(`ป้องกันเห็บหมัด`,null,30,null)})}export{y as all,D as audit,A as beYear,f as getDb,T as getSetting,S as insert,a as n,k as nextCounter,O as nextDocNo,j as nextPetCode,m as now,b as one,d as openDb,o as r,g as r2,x as run,E as setSetting,i as t,h as today,v as tx,p as uid,C as update};