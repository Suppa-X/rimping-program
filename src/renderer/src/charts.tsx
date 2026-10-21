import { useState } from 'react'

/** Small, dependency-free SVG charts following the dataviz rules: thin marks, one axis, hover tooltips, recessive grid. */

const C1 = '#2b7bc4' // primary series (this period)
const C2 = '#f08a33' // comparison series (previous period) — always shipped with a legend + table
const GRID = '#e3eaf2'
const INK = '#6b7f93'

const compact = (n: number): string =>
  Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : Math.abs(n) >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n))

function niceMax(v: number): number {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p
  return 10 * p
}

interface Tip {
  x: number
  y: number
  lines: string[]
}

/** tip.x is a percentage of the chart width; tip.y is pixels from the top. */
function Tooltip({ tip }: { tip: Tip | null; width?: number }) {
  if (!tip) return null
  const left = `clamp(0px, calc(${tip.x}% - 85px), calc(100% - 170px))`
  return (
    <div style={{ position: 'absolute', left, top: Math.max(tip.y - 64, 0), width: 170, background: '#1b3a66', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, pointerEvents: 'none', boxShadow: '0 6px 18px rgba(0,0,0,.18)' }}>
      {tip.lines.map((l, i) => <div key={i} style={i === 0 ? { fontWeight: 700 } : undefined}>{l}</div>)}
    </div>
  )
}

export function BarChart(props: {
  data: { label: string; value: number; tip?: string[] }[]
  height?: number
  highlight?: number
  line?: { value: number }[]
  lineLabel?: string
  barLabel?: string
}) {
  const W = 720
  const H = props.height ?? 220
  const pad = { l: 44, r: 10, t: 14, b: 26 }
  const [tip, setTip] = useState<Tip | null>(null)
  const max = niceMax(Math.max(1, ...props.data.map((d) => d.value), ...(props.line ?? []).map((d) => d.value)))
  const n = props.data.length
  const band = (W - pad.l - pad.r) / Math.max(n, 1)
  const bw = Math.min(24, band * 0.6)
  const y = (v: number): number => pad.t + (H - pad.t - pad.b) * (1 - Math.max(v, 0) / max)
  const cx = (i: number): number => pad.l + band * i + band / 2
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const every = Math.ceil(n / 12)
  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setTip(null)}>
      {(props.line || props.barLabel) && (
        <div className="row small" style={{ gap: 16, marginBottom: 4 }}>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: C1, verticalAlign: -1 }} /> {props.barLabel ?? 'ยอดขาย'}</span>
          {props.line && <span><span style={{ display: 'inline-block', width: 14, height: 2, background: C2, verticalAlign: 3 }} /> {props.lineLabel}</span>}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={INK}>{compact(t)}</text>
          </g>
        ))}
        {props.data.map((d, i) => {
          const top = y(d.value)
          const h = Math.max(H - pad.b - top, d.value > 0 ? 2 : 0)
          const r = Math.min(4, h)
          const x = cx(i) - bw / 2
          return (
            <g key={i}>
              <path
                d={`M${x},${H - pad.b} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${H - pad.b} Z`}
                fill={C1}
                opacity={props.highlight === undefined || props.highlight === i ? 1 : 0.55}
              />
              {i % every === 0 && <text x={cx(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={INK}>{d.label}</text>}
              <rect x={pad.l + band * i} y={pad.t} width={band} height={H - pad.t - pad.b} fill="transparent"
                onMouseEnter={(e) => {
                  const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
                  setTip({ x: (cx(i) / W) * 100, y: (top / H) * box.height, lines: d.tip ?? [d.label, d.value.toLocaleString()] })
                }} />
            </g>
          )
        })}
        {props.line && (
          <polyline
            points={props.line.map((d, i) => `${cx(i)},${y(d.value)}`).join(' ')}
            fill="none" stroke={C2} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" pointerEvents="none"
          />
        )}
        {props.line?.length ? <circle cx={cx(props.line.length - 1)} cy={y(props.line[props.line.length - 1].value)} r={4} fill={C2} stroke="#fff" strokeWidth={2} /> : null}
      </svg>
      <Tooltip tip={tip} width={W} />
    </div>
  )
}

/** Two aligned series (e.g. this month vs last month by day of month). */
export function LineCompare(props: { a: number[]; b: number[]; aLabel: string; bLabel: string; xLabels: string[]; height?: number }) {
  const W = 720
  const H = props.height ?? 220
  const pad = { l: 44, r: 12, t: 14, b: 26 }
  const [hover, setHover] = useState<number | null>(null)
  const n = Math.max(props.a.length, props.b.length)
  const max = niceMax(Math.max(1, ...props.a, ...props.b))
  const x = (i: number): number => pad.l + ((W - pad.l - pad.r) * i) / Math.max(n - 1, 1)
  const y = (v: number): number => pad.t + (H - pad.t - pad.b) * (1 - v / max)
  const path = (s: number[]): string => s.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  return (
    <div style={{ position: 'relative' }}>
      <div className="row small" style={{ gap: 16, marginBottom: 4 }}>
        <span><span style={{ display: 'inline-block', width: 14, height: 3, background: C1, verticalAlign: 3 }} /> {props.aLabel}</span>
        <span><span style={{ display: 'inline-block', width: 14, height: 3, background: C2, verticalAlign: 3 }} /> {props.bLabel}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - box.left) / box.width) * W
          setHover(Math.min(Math.max(Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1)), 0), n - 1))
        }}
        onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={INK}>{compact(t)}</text>
          </g>
        ))}
        {props.xLabels.map((l, i) => (i % Math.ceil(n / 10) === 0 ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={INK}>{l}</text> : null))}
        <path d={path(props.b)} fill="none" stroke={C2} strokeWidth={2} strokeLinejoin="round" />
        <path d={path(props.a)} fill="none" stroke={C1} strokeWidth={2} strokeLinejoin="round" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#9fb3c8" strokeWidth={1} />
            {props.b[hover] !== undefined && <circle cx={x(hover)} cy={y(props.b[hover])} r={4} fill={C2} stroke="#fff" strokeWidth={2} />}
            {props.a[hover] !== undefined && <circle cx={x(hover)} cy={y(props.a[hover])} r={4} fill={C1} stroke="#fff" strokeWidth={2} />}
          </g>
        )}
      </svg>
      {hover !== null && (
        <Tooltip width={W} tip={{
          x: (x(hover) / W) * 100,
          y: 40,
          lines: [`วันที่ ${props.xLabels[hover]}`, `${props.aLabel}: ${(props.a[hover] ?? 0).toLocaleString()}`, `${props.bLabel}: ${(props.b[hover] ?? 0).toLocaleString()}`]
        }} />
      )}
    </div>
  )
}

/** Tiny trend line for a KPI tile. */
export function Spark({ values, color = C1 }: { values: number[]; color?: string }) {
  const W = 120
  const H = 34
  const max = Math.max(1, ...values)
  const pts = values.map((v, i) => `${(W * i) / Math.max(values.length - 1, 1)},${H - 3 - ((H - 6) * v) / max}`)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.length > 0 && <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r={3.5} fill={color} stroke="#fff" strokeWidth={2} />}
    </svg>
  )
}
