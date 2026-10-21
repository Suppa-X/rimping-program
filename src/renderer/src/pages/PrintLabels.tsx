import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, thDate } from '../api'

/** Drug labels (one per medicine line), laid out 2 per row on A5 for cutting or on a label printer. */
export default function PrintLabels() {
  const { id } = useParams()
  const [inv, setInv] = useState<any>(null)
  const [s, setS] = useState<any>(null)
  const [products, setProducts] = useState<Record<string, any>>({})
  useEffect(() => {
    api('invoices.get', { id }).then(setInv)
    api('settings.get').then(setS)
    api<any[]>('products.list', { includeInactive: true }).then((l) => setProducts(Object.fromEntries(l.map((p) => [p.id, p]))))
  }, [id])
  if (!inv || !s) return null
  const meds = inv.items.filter((it: any) => it.category === 'medicine')
  return (
    <>
      <div className="print-toolbar">
        <button onClick={() => window.print()}>🖨️ พิมพ์ฉลากยา ({meds.length})</button>
        <button className="secondary" onClick={() => window.close()}>ปิด</button>
      </div>
      <div className="print-page" style={{ minHeight: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4mm', alignContent: 'start' }}>
        {meds.map((it: any) => {
          const p = products[it.product_id] ?? {}
          return (
            <div key={it.id} style={{ border: '1px solid #000', borderRadius: 4, padding: '3mm', fontSize: 11, breakInside: 'avoid' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #000', paddingBottom: 2, marginBottom: 3 }}>
                <b>{s.shop_name}</b>
                <span>{s.shop_phone}</span>
              </div>
              <div>ชื่อสัตว์: <b>{inv.pet_name ?? '-'}</b> · เจ้าของ: {inv.customer_name ?? '-'}</div>
              <div style={{ fontSize: 13, margin: '2px 0' }}><b>{it.name}</b> × {it.qty} {it.unit}</div>
              {p.drug_group && <div>{p.drug_group}</div>}
              <div style={{ fontSize: 12.5, fontWeight: 700, margin: '3px 0' }}>{it.instruction || p.label_th || 'ใช้ตามคำแนะนำของสัตวแพทย์'}</div>
              {p.label_en && <div style={{ fontStyle: 'italic' }}>{p.label_en}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3, color: '#444' }}>
                <span>{thDate(inv.issued_at)}</span>
                <span>{it.vet_name ?? ''}</span>
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
