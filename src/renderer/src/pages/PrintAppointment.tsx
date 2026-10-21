import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import logo from '../assets/logo.png'
import { api, longDate } from '../api'

const T = {
  th: { title: 'ใบนัด', pet: 'ชื่อสัตว์เลี้ยง', owner: 'เจ้าของ', date: 'วันนัด', time: 'เวลา', topic: 'นัดเพื่อ', vet: 'สัตวแพทย์', note: 'หมายเหตุ', foot: 'หากไม่สะดวกตามนัด กรุณาโทรแจ้งล่วงหน้า' },
  en: { title: 'Appointment Card', pet: 'Pet', owner: 'Owner', date: 'Date', time: 'Time', topic: 'Purpose', vet: 'Veterinarian', note: 'Note', foot: 'If you cannot attend, please call us in advance.' }
}

/** Appointment card in Thai or English, printed on A5 like the old program's ใบนัด. */
export default function PrintAppointment() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const lang = params.get('lang') === 'en' ? 'en' : 'th'
  const t = T[lang]
  const [a, setA] = useState<any>(null)
  const [s, setS] = useState<any>(null)
  useEffect(() => {
    api('appointments.get', { id }).then(setA)
    api('settings.get').then(setS)
  }, [id])
  if (!a || !s) return null
  const row = (k: string, v?: string | null) =>
    v ? (
      <div style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: '1px dotted #bbb' }}>
        <span style={{ width: 110, color: '#555' }}>{k}</span>
        <b style={{ flex: 1 }}>{v}</b>
      </div>
    ) : null
  return (
    <>
      <div className="print-toolbar">
        <button onClick={() => window.print()}>🖨️ พิมพ์ใบนัด</button>
        <button className="secondary" onClick={() => window.close()}>ปิด</button>
      </div>
      <div className="print-page" style={{ minHeight: 'auto', fontSize: 14 }}>
        <div className="print-head">
          <img src={logo} alt="" />
          <div style={{ flex: 1 }}>
            <h1>{lang === 'th' ? s.shop_name : s.shop_name_en}</h1>
            {s.shop_address && <div>{s.shop_address}</div>}
            {s.shop_phone && <div>{lang === 'th' ? 'โทร' : 'Tel.'} {s.shop_phone}</div>}
          </div>
          <b style={{ fontSize: 20 }}>{t.title}</b>
        </div>
        {row(t.pet, `${a.pet_name}${a.pet_code ? ` (${a.pet_code})` : ''}`)}
        {row(t.owner, a.owner_name)}
        {row(t.date, longDate(a.appt_date, lang))}
        {row(t.time, a.appt_time ? `${a.appt_time}${lang === 'th' ? ' น.' : ''}` : null)}
        {row(t.topic, a.topic)}
        {row(t.vet, a.vet_name)}
        {row(t.note, a.detail)}
        <div className="center" style={{ marginTop: 16, color: '#555' }}>{t.foot}</div>
      </div>
    </>
  )
}
