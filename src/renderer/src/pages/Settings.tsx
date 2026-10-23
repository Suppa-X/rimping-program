import { Settings as SettingsIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, thDate, todayStr, monthStart, ROLE_LABEL, TH_DAYS, parseClosed } from '../api'
import { useApi, useAction, useSession, Modal, Field, Empty } from '../ui'

export default function Settings() {
  const { can } = useSession()
  const admin = can('settings')
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') ?? (admin ? 'shop' : 'me'))
  return (
    <>
      <div className="page-head">
        <div className="grow"><h1 className="title-ico"><span className="gem slate"><SettingsIcon /></span> ตั้งค่า</h1><div className="lead">ข้อมูลร้าน ภาษี ผู้ใช้งาน และการสำรองข้อมูล</div></div>
      </div>
      <div className="subtabs">
        {admin && <button className={tab === 'shop' ? 'active' : ''} onClick={() => setTab('shop')}>ข้อมูลร้าน & VAT</button>}
        {admin && <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>ผู้ใช้งาน</button>}
        {admin && <button className={tab === 'vaccines' ? 'active' : ''} onClick={() => setTab('vaccines')}>ชนิดวัคซีน</button>}
        {can('void') && <button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}>ประวัติการใช้งาน</button>}
        <button className={tab === 'system' ? 'active' : ''} onClick={() => setTab('system')}>สำรองข้อมูล</button>
        <button className={tab === 'me' ? 'active' : ''} onClick={() => setTab('me')}>เปลี่ยน PIN</button>
      </div>
      {tab === 'shop' && <ShopSettings />}
      {tab === 'users' && <Users />}
      {tab === 'vaccines' && <VaccineTypes />}
      {tab === 'audit' && <AuditLog />}
      {tab === 'system' && <SystemInfo />}
      {tab === 'me' && <ChangePin />}
    </>
  )
}

function ShopSettings() {
  const [s, setS] = useState<any>(null)
  const act = useAction()
  useEffect(() => {
    api('settings.get').then(setS)
  }, [])
  if (!s) return null
  const set = (k: string, v: string): void => setS((x: any) => ({ ...x, [k]: v }))
  const save = (): Promise<unknown> => act(() => api('settings.save', s), 'บันทึกการตั้งค่าแล้ว')
  const vatOn = s.vat_enabled === '1'
  return (
    <div className="grid g2">
      <div className="card stack">
        <h2>ข้อมูลร้าน (แสดงบนใบเสร็จ)</h2>
        <Field label="ชื่อร้าน">
          <input value={s.shop_name} onChange={(e) => set('shop_name', e.target.value)} />
        </Field>
        <Field label="ชื่อร้าน (อังกฤษ)">
          <input value={s.shop_name_en} onChange={(e) => set('shop_name_en', e.target.value)} />
        </Field>
        <Field label="ที่อยู่">
          <textarea value={s.shop_address} onChange={(e) => set('shop_address', e.target.value)} />
        </Field>
        <Field label="เบอร์โทร">
          <input value={s.shop_phone} onChange={(e) => set('shop_phone', e.target.value)} />
        </Field>
        <Field label="เลขพร้อมเพย์ (เบอร์มือถือ หรือ เลขบัตรประชาชน/เลขผู้เสียภาษี) — ใช้สร้าง QR รับเงิน">
          <input value={s.promptpay_id} onChange={(e) => set('promptpay_id', e.target.value)} />
        </Field>
        <Field label="ข้อความท้ายใบเสร็จ">
          <input value={s.receipt_footer} onChange={(e) => set('receipt_footer', e.target.value)} />
        </Field>
        <Field label="วันหยุดประจำสัปดาห์ (ปฏิทินจะแสดงว่าร้านหยุด และเตือนเมื่อนัดลูกค้าตรงวันหยุด)">
          <div className="chips">
            {TH_DAYS.map((d, i) => {
              const days = parseClosed(s.closed_weekdays)
              const on = days.includes(i)
              return (
                <button key={d} className={`chip ${on ? 'active' : ''}`} onClick={() => set('closed_weekdays', (on ? days.filter((x) => x !== i) : [...days, i]).sort().join(','))}>
                  {d}
                </button>
              )
            })}
          </div>
        </Field>
        <div className="row end">
          <button onClick={save}>บันทึก</button>
        </div>
      </div>
      <div className="card stack">
        <h2>ภาษีมูลค่าเพิ่ม (VAT)</h2>
        <div className="alert info small">
          ตอนนี้ร้านยังไม่ได้จด VAT ให้ปิดไว้ก่อน เมื่อจดแล้วค่อยเปิด บิลเก่าจะไม่ถูกเปลี่ยนย้อนหลัง
        </div>
        <label className="check">
          <input type="checkbox" checked={vatOn} onChange={(e) => set('vat_enabled', e.target.checked ? '1' : '0')} />
          <b>เปิดใช้ VAT</b> (ใบเสร็จจะเปลี่ยนเป็น "ใบเสร็จรับเงิน/ใบกำกับภาษีอย่างย่อ")
        </label>
        {vatOn && (
          <>
            <Field label="เลขประจำตัวผู้เสียภาษีของร้าน (13 หลัก)">
              <input value={s.shop_tax_id} onChange={(e) => set('shop_tax_id', e.target.value)} />
            </Field>
            <div className="grid g2">
              <Field label="อัตรา VAT (%)">
                <input type="number" value={s.vat_rate} onChange={(e) => set('vat_rate', e.target.value)} />
              </Field>
              <Field label="วันที่เริ่มจด VAT">
                <input type="date" value={s.vat_start_date} onChange={(e) => set('vat_start_date', e.target.value)} />
              </Field>
            </div>
            <Field label="ราคาสินค้าในระบบ">
              <select value={s.vat_inclusive} onChange={(e) => set('vat_inclusive', e.target.value)}>
                <option value="1">รวม VAT แล้ว (ลูกค้าจ่ายเท่าราคาป้าย)</option>
                <option value="0">ยังไม่รวม VAT (บวก VAT เพิ่มตอนคิดเงิน)</option>
              </select>
            </Field>
          </>
        )}
        <div className="muted small">ตั้งค่าว่าสินค้า/บริการใดมี VAT หรือได้รับยกเว้นได้ที่หน้า "สินค้า/คลัง" — ควรปรึกษานักบัญชีเรื่องค่ารักษาสัตว์</div>
        <div className="row end">
          <button onClick={save}>บันทึก</button>
        </div>
      </div>
    </div>
  )
}

function Users() {
  const [rows, reload] = useApi<any[]>('users.list')
  const [edit, setEdit] = useState<any | null>(null)
  return (
    <div className="card">
      <div className="card-head">
        <h2 className="grow">ผู้ใช้งาน</h2>
        <button onClick={() => setEdit({ role: 'staff', max_discount_pct: 0, is_vet: false, active: true })}>➕ เพิ่มผู้ใช้</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>ชื่อ</th>
            <th>ชื่อผู้ใช้</th>
            <th>ตำแหน่ง</th>
            <th>สัตวแพทย์</th>
            <th className="num">ลดได้สูงสุด</th>
            <th>สถานะ</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows?.map((u) => (
            <tr key={u.id}>
              <td className="bold">{u.display_name}</td>
              <td>{u.username}</td>
              <td>{ROLE_LABEL[u.role]}</td>
              <td>{u.is_vet ? `✔ ${u.license_no ?? ''}` : '-'}</td>
              <td className="num">{u.role === 'owner' ? 'ไม่จำกัด' : `${u.max_discount_pct}%`}</td>
              <td>{u.active ? <span className="badge ok">ใช้งาน</span> : <span className="badge grey">ปิด</span>}</td>
              <td><button className="ghost" onClick={() => setEdit(u)}>แก้ไข</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="muted small" style={{ marginTop: 10 }}>
        สิทธิ์: <b>เจ้าของร้าน</b> ทำได้ทุกอย่าง · <b>ผู้จัดการ</b> ยกเลิกบิล/แก้สต็อก/ดูรายงาน · <b>สัตวแพทย์</b> บันทึกการรักษา/ดูรายงาน ·{' '}
        <b>พนักงาน</b> ขายและดูแลลูกค้า
      </div>
      {edit && <UserForm initial={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload() }} />}
    </div>
  )
}

function UserForm(props: { initial: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({ ...props.initial, is_vet: !!props.initial.is_vet, active: props.initial.active !== 0 })
  const act = useAction()
  const set = (k: string, v: any): void => setF((x: any) => ({ ...x, [k]: v }))
  const save = async (): Promise<void> => {
    if (await act(() => api('users.save', f), 'บันทึกผู้ใช้แล้ว')) props.onSaved()
  }
  return (
    <Modal
      title={f.id ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้'}
      onClose={props.onClose}
      footer={
        <>
          <button className="secondary" onClick={props.onClose}>ยกเลิก</button>
          <button onClick={save}>บันทึก</button>
        </>
      }
    >
      <div className="grid g2">
        <Field label="ชื่อที่แสดง" required>
          <input value={f.display_name ?? ''} onChange={(e) => set('display_name', e.target.value)} />
        </Field>
        <Field label="ชื่อผู้ใช้" required>
          <input value={f.username ?? ''} onChange={(e) => set('username', e.target.value)} />
        </Field>
        <Field label="ตำแหน่ง">
          <select value={f.role} onChange={(e) => set('role', e.target.value)}>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="ส่วนลดสูงสุดที่ให้ได้เอง (%)">
          <input type="number" value={f.max_discount_pct} onChange={(e) => set('max_discount_pct', e.target.value)} />
        </Field>
        <Field label={f.id ? 'รหัส PIN ใหม่ (เว้นว่าง = ไม่เปลี่ยน)' : 'รหัส PIN'} required={!f.id}>
          <input type="password" inputMode="numeric" value={f.pin ?? ''} onChange={(e) => set('pin', e.target.value)} />
        </Field>
        <Field label="เลขใบอนุญาตสัตวแพทย์">
          <input value={f.license_no ?? ''} disabled={!f.is_vet} onChange={(e) => set('license_no', e.target.value)} />
        </Field>
      </div>
      <div className="row">
        <label className="check">
          <input type="checkbox" checked={f.is_vet} onChange={(e) => set('is_vet', e.target.checked)} /> เป็นสัตวแพทย์ (เลือกเป็นผู้ทำรายการ/คิด DF ได้)
        </label>
        {f.id && (
          <label className="check">
            <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} /> เปิดใช้งาน
          </label>
        )}
      </div>
    </Modal>
  )
}

function VaccineTypes() {
  const [rows, reload] = useApi<any[]>('vaccineTypes.list')
  const [products] = useApi<any[]>('products.list', { category: 'vaccine' })
  const [edit, setEdit] = useState<any | null>(null)
  const act = useAction()
  const save = async (): Promise<void> => {
    if (await act(() => api('vaccineTypes.save', edit), 'บันทึกแล้ว')) {
      setEdit(null)
      reload()
    }
  }
  return (
    <div className="card">
      <div className="card-head">
        <h2 className="grow">ชนิดวัคซีน/ยาป้องกัน และรอบนัด</h2>
        <button onClick={() => setEdit({ interval_days: 365 })}>➕ เพิ่ม</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>ชื่อ</th>
            <th>ใช้กับ</th>
            <th className="num">นัดครั้งถัดไปทุก</th>
            <th>สินค้าที่ผูก (ขายแล้วบันทึกอัตโนมัติ)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows?.map((v) => (
            <tr key={v.id}>
              <td className="bold">{v.name}</td>
              <td>{v.species ?? 'ทุกชนิด'}</td>
              <td className="num">{v.interval_days} วัน</td>
              <td>{v.product_name ?? <span className="muted">-</span>}</td>
              <td><button className="ghost" onClick={() => setEdit(v)}>แก้ไข</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {edit && (
        <Modal
          title={edit.id ? 'แก้ไขชนิดวัคซีน' : 'เพิ่มชนิดวัคซีน'}
          onClose={() => setEdit(null)}
          footer={
            <>
              <button className="secondary" onClick={() => setEdit(null)}>ยกเลิก</button>
              <button onClick={save}>บันทึก</button>
            </>
          }
        >
          <Field label="ชื่อ" required>
            <input value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
          </Field>
          <div className="grid g2">
            <Field label="ใช้กับชนิดสัตว์ (เว้นว่าง = ทุกชนิด)">
              <input value={edit.species ?? ''} onChange={(e) => setEdit({ ...edit, species: e.target.value })} />
            </Field>
            <Field label="นัดครั้งถัดไปทุก (วัน)">
              <input type="number" value={edit.interval_days} onChange={(e) => setEdit({ ...edit, interval_days: e.target.value })} />
            </Field>
          </div>
          <Field label="สินค้าวัคซีนที่ผูก">
            <select value={edit.product_id ?? ''} onChange={(e) => setEdit({ ...edit, product_id: e.target.value })}>
              <option value="">— ไม่ผูก —</option>
              {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </Modal>
      )}
    </div>
  )
}

const ACTION_LABEL: Record<string, string> = {
  'auth.login': 'เข้าสู่ระบบ',
  'auth.logout': 'ออกจากระบบ',
  'invoice.create': 'ออกบิล',
  'invoice.void': 'ยกเลิกบิล',
  'invoice.pay': 'รับชำระยอดค้าง',
  'deposit.add': 'รับมัดจำ',
  'deposit.refund': 'คืนมัดจำ',
  'shift.open': 'เปิดกะ',
  'shift.close': 'ปิดกะ',
  'stock.receive': 'รับสินค้าเข้า',
  'stock.adjust': 'ปรับสต็อก',
  'product.update': 'แก้ไขสินค้า',
  'product.create': 'เพิ่มสินค้า',
  'settings.update': 'แก้ไขการตั้งค่า',
  'user.create': 'เพิ่มผู้ใช้',
  'user.update': 'แก้ไขผู้ใช้'
}

function AuditLog() {
  const [from, setFrom] = useState(monthStart())
  const [to, setTo] = useState(todayStr())
  const [action, setAction] = useState('')
  const [rows] = useApi<any[]>('reports.audit', { from, to, action }, [from, to, action])
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 12 }}>
        <input type="date" style={{ width: 170 }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <span>ถึง</span>
        <input type="date" style={{ width: 170 }} value={to} onChange={(e) => setTo(e.target.value)} />
        <select style={{ width: 220 }} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">ทุกรายการ</option>
          <option value="invoice">บิล</option>
          <option value="invoice.void">เฉพาะยกเลิกบิล</option>
          <option value="shift">กะ</option>
          <option value="stock">สต็อก</option>
          <option value="settings">การตั้งค่า</option>
          <option value="user">ผู้ใช้</option>
        </select>
      </div>
      {!rows?.length ? (
        <Empty text="ไม่มีรายการ" />
      ) : (
        <table>
          <thead>
            <tr>
              <th>เวลา</th>
              <th>ผู้ใช้</th>
              <th>การกระทำ</th>
              <th>รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{thDate(r.created_at, true)}</td>
                <td>{r.user_name ?? '-'}</td>
                <td>{ACTION_LABEL[r.action] ?? r.action}</td>
                <td className="small muted" style={{ wordBreak: 'break-all' }}>{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function SystemInfo() {
  const [info, reload] = useApi<any>('system.info')
  const act = useAction()
  if (!info) return null
  return (
    <div className="card stack" style={{ maxWidth: 720 }}>
      <h2>สำรองข้อมูล</h2>
      <dl className="kv">
        <dt>เวอร์ชันโปรแกรม</dt>
        <dd>{info.version}</dd>
        <dt>ฐานข้อมูล</dt>
        <dd className="small">{info.db_path}</dd>
        <dt>โฟลเดอร์สำรอง</dt>
        <dd className="small">{info.backup_dir}</dd>
        <dt>สำรองล่าสุด</dt>
        <dd>{info.last_backup ? thDate(info.last_backup.replace('T', ' ').slice(0, 19), true) : 'ยังไม่เคย'}</dd>
        <dt>รอซิงก์ขึ้น Cloud</dt>
        <dd>{info.pending_sync} รายการ (ระบบออนไลน์จะเปิดใช้ในขั้นถัดไป)</dd>
      </dl>
      <div className="alert info small">
        ระบบสำรองอัตโนมัติทุก 12 ชั่วโมงและทุกครั้งที่ปิดโปรแกรม เก็บไว้ 60 ชุดล่าสุด — แนะนำให้คัดลอกโฟลเดอร์สำรองไปเก็บใน Flash drive/Google Drive เป็นระยะ
      </div>
      <div className="row">
        <button onClick={async () => (await act(() => api('system.backupNow'), 'สำรองข้อมูลแล้ว')) && reload()}>💾 สำรองข้อมูลเดี๋ยวนี้</button>
      </div>
    </div>
  )
}

function ChangePin() {
  const [f, setF] = useState({ old_pin: '', new_pin: '', new_pin2: '' })
  const act = useAction()
  const save = async (): Promise<void> => {
    if (f.new_pin !== f.new_pin2) return void act(() => Promise.reject(new Error('รหัส PIN ใหม่ทั้งสองช่องไม่ตรงกัน')))
    if (await act(() => api('auth.changePin', f), 'เปลี่ยนรหัส PIN แล้ว')) setF({ old_pin: '', new_pin: '', new_pin2: '' })
  }
  return (
    <div className="card stack" style={{ maxWidth: 420 }}>
      <h2>เปลี่ยนรหัส PIN ของฉัน</h2>
      <Field label="รหัส PIN เดิม">
        <input type="password" value={f.old_pin} onChange={(e) => setF({ ...f, old_pin: e.target.value })} />
      </Field>
      <Field label="รหัส PIN ใหม่ (ตัวเลข 4–8 หลัก)">
        <input type="password" value={f.new_pin} onChange={(e) => setF({ ...f, new_pin: e.target.value })} />
      </Field>
      <Field label="ยืนยันรหัส PIN ใหม่">
        <input type="password" value={f.new_pin2} onChange={(e) => setF({ ...f, new_pin2: e.target.value })} />
      </Field>
      <button onClick={save}>บันทึก</button>
    </div>
  )
}
