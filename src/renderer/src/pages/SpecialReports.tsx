import { useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { money, thDate, todayStr, CATEGORY_LABEL, SEX_LABEL, age } from '../api'
import { useApi, Empty } from '../ui'

const REPORTS = [
  { key: 'controlled', label: 'ยาควบคุม (ข.ย.)', api: 'reports.controlled' },
  { key: 'rabies', label: 'ส่งกรมปศุสัตว์ (พิษสุนัขบ้า)', api: 'reports.rabies' },
  { key: 'stock', label: 'สินค้าคงเหลือ', api: 'reports.stock' }
] as const

type Col = [string, (r: any) => string | number]

const COLS: Record<string, Col[]> = {
  controlled: [
    ['วันที่', (r) => thDate(r.day)],
    ['เลขที่', (r) => r.ref],
    ['ชื่อยา', (r) => r.name],
    ['จำนวน', (r) => `${r.qty} ${r.unit ?? ''}`],
    ['สัตว์', (r) => `${r.pet_name ?? '-'} (${r.species ?? '-'})`],
    ['เจ้าของ', (r) => r.owner_name ?? '-'],
    ['ที่อยู่', (r) => r.address ?? '-'],
    ['สัตวแพทย์', (r) => r.vet_name ?? '-']
  ],
  rabies: [
    ['วันที่ฉีด', (r) => thDate(r.given_date)],
    ['ชื่อสัตว์', (r) => `${r.pet_name} ${r.pet_code ? `(${r.pet_code})` : ''}`],
    ['ชนิด/พันธุ์', (r) => `${r.species}${r.breed ? ` / ${r.breed}` : ''}`],
    ['เพศ', (r) => SEX_LABEL[r.sex] ?? '-'],
    ['อายุ', (r) => age(r.birth_date)],
    ['สี', (r) => r.color ?? '-'],
    ['เจ้าของ', (r) => r.owner_name],
    ['ที่อยู่', (r) => [r.address, r.province].filter(Boolean).join(' ') || '-'],
    ['โทร', (r) => r.phone ?? '-'],
    ['Lot', (r) => r.lot_no ?? '-'],
    ['สัตวแพทย์ (ใบอนุญาต)', (r) => `${r.vet_name ?? '-'}${r.license_no ? ` (${r.license_no})` : ''}`]
  ],
  stock: [
    ['รหัส', (r) => r.sku ?? '-'],
    ['สินค้า', (r) => `${r.name}${r.controlled ? ' [ยาควบคุม]' : ''}`],
    ['หมวด', (r) => CATEGORY_LABEL[r.category]],
    ['คงเหลือ', (r) => `${r.stock_qty} ${r.unit}`],
    ['ขั้นต่ำ', (r) => r.min_stock],
    ['ทุนเฉลี่ย', (r) => money(r.avg_cost)],
    ['มูลค่าทุน', (r) => money(r.value)]
  ]
}

/** Registers the old program produced (ข.ย.11, Department of Livestock rabies report, stock) — with Excel (CSV) export. */
export default function SpecialReports() {
  const [kind, setKind] = useState<(typeof REPORTS)[number]['key']>('controlled')
  const [from, setFrom] = useState(todayStr().slice(0, 8) + '01')
  const [to, setTo] = useState(todayStr())
  const rep = REPORTS.find((r) => r.key === kind)!
  const [rows] = useApi<any[]>(rep.api, { from, to }, [kind, from, to])
  const cols = COLS[kind]

  const exportCsv = (): void => {
    const esc = (v: unknown): string => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [cols.map((c) => esc(c[0])).join(','), ...(rows ?? []).map((r) => cols.map((c) => esc(c[1](r))).join(','))].join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    a.download = `${rep.label}-${from}-${to}.csv`
    a.click()
  }

  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="chips">
          {REPORTS.map((r) => (
            <button key={r.key} className={`chip ${kind === r.key ? 'active' : ''}`} onClick={() => setKind(r.key)}>{r.label}</button>
          ))}
        </div>
        <div className="grow" />
        {kind !== 'stock' && (
          <>
            <input type="date" style={{ width: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} />
            <span>ถึง</span>
            <input type="date" style={{ width: 160 }} value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        )}
        <button className="secondary" onClick={exportCsv}><Download /> ส่งออก Excel</button>
        <button className="secondary" onClick={() => window.print()}><Printer /> พิมพ์</button>
      </div>
      {!rows?.length ? (
        <Empty text={kind === 'controlled' ? 'ไม่มีการจ่ายยาควบคุมในช่วงนี้ (ตั้งค่ายาควบคุมได้ที่ คลังสินค้า → แก้ไขสินค้า)' : 'ไม่มีข้อมูลในช่วงนี้'} />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>#</th>{cols.map((c) => <th key={c[0]}>{c[0]}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}><td className="muted">{i + 1}</td>{cols.map((c) => <td key={c[0]}>{c[1](r)}</td>)}</tr>
              ))}
            </tbody>
          </table>
          <div className="muted small" style={{ marginTop: 8 }}>ทั้งหมด {rows.length} รายการ</div>
        </div>
      )}
    </div>
  )
}
