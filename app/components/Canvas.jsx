"use client"
import React, { useMemo } from 'react'
import { extents } from '../lib/model.js'

const PADDING = { left: 60, right: 30, top: 30, bottom: 50 }

export function Canvas({ versions, options }){
  const width = 1000, height = 800
  const { tmin, tmax, vmin, vmax } = useMemo(()=>{
    const ex = extents(versions)
    const txMax = Number.isFinite(options?.gridMaxTx) ? Math.max(1, options.gridMaxTx) : ex.tmax
    const vMax = Number.isFinite(options?.gridMaxValid) ? Math.max(1, options.gridMaxValid) : ex.vmax
    return { tmin: 0, tmax: txMax, vmin: 0, vmax: vMax }
  }, [versions, options?.gridMaxTx, options?.gridMaxValid])
  const tRange = Math.max(1, tmax - tmin)
  const vRange = Math.max(1, vmax - vmin)
  const innerW = width - PADDING.left - PADDING.right
  const innerH = height - PADDING.top - PADDING.bottom
  const xOf = (t) => PADDING.left + ((t - tmin) / tRange) * innerW
  const yOf = (v) => options?.orientationUp
    ? PADDING.top + ((vmax - v) / vRange) * innerH
    : PADDING.top + ((v - vmin) / vRange) * innerH

  const drawVersions = React.useMemo(() => {
    return [...versions].sort((a,b)=> (a._sysOpen===b._sysOpen?0:(a._sysOpen?1:-1)))
  }, [versions])

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-label="bitemporal canvas">
      <defs>
        <pattern id="hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <path d="M 0 0 L 0 8" stroke="#ff6b6b" strokeWidth="2" opacity="0.6" />
        </pattern>
      </defs>
      {options?.showGrid && (
        <g stroke="#2b3645" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity="0.35">
          {gridLines(tmin, tmax, 1).map((t)=>{
            const x = xOf(t)
            return <line key={`vx-${t}`} x1={x} y1={PADDING.top} x2={x} y2={height - PADDING.bottom} />
          })}
          {gridLines(vmin, vmax, 1).map((v)=>{
            const y = yOf(v)
            return <line key={`hy-${v}`} x1={PADDING.left} y1={y} x2={width - PADDING.right} y2={y} />
          })}
        </g>
      )}

      <g stroke="#4b5563" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
        <line x1={PADDING.left} y1={PADDING.top} x2={PADDING.left} y2={height - PADDING.bottom} />
        <line x1={PADDING.left} y1={height - PADDING.bottom} x2={width - PADDING.right} y2={height - PADDING.bottom} />
      </g>

      <g fill="#8b949e" fontSize="11">
        {gridLines(tmin, tmax, 1).map((t)=>{
          const x = xOf(t)
          return <text key={`tx-${t}`} x={x + 2} y={height - PADDING.bottom + 16}>{t}</text>
        })}
        {gridLines(vmin, vmax, 1).map((v)=>{
          const y = yOf(v)
          return <text key={`ty-${v}`} x={PADDING.left - 24} y={y + 4}>{v}</text>
        })}
      </g>

      {drawVersions.map((r, idx) => {
        const x0 = xOf(r.ss), x1 = xOf(r.se)
        const y0 = yOf(r.vs), y1 = yOf(r.ve)
        const x = Math.min(x0, x1)
        const y = Math.min(y0, y1)
        const w = Math.abs(x1 - x0)
        const h = Math.abs(y1 - y0)
        const color = colorForValue(r.value)
        const asOf = typeof options?.asOfTx === 'number' ? options.asOfTx : undefined
        const active = asOf == null ? true : (r.ss <= asOf && asOf < (r._sysOpen ? Number.POSITIVE_INFINITY : r.se))
        const show = options?.showHistorical || active
        return (
          <rect key={idx} x={x} y={y} width={Math.max(0,w)} height={Math.max(0,h)} rx="2" ry="2"
            fill={active ? color : 'url(#hatch)'} stroke={color} strokeWidth="1.5" opacity={show ? 1 : 0.15}>
            <title>{`value=${r.value ?? '∅'}\nvalid=[${r.vs}, ${r._validOpen ? '∞' : r.ve})\nsystem=[${r.ss}, ${r._sysOpen ? '∞' : r.se})`}</title>
          </rect>
        )
      })}
    </svg>
  )
}

function gridLines(min, max, stepRaw){
  const step = Math.max(1, Math.floor(stepRaw || 1))
  const start = Math.ceil(min / step) * step
  const lines = []
  for (let t = start; t <= max; t += step) lines.push(t)
  if (min % step === 0 && !lines.includes(min)) lines.unshift(min) // include boundary if aligned
  return lines
}

function colorForValue(value){
  if (value == null) return '#8892a0'
  const palette = ['#6ee7b7', '#93c5fd', '#fca5a5', '#fcd34d', '#c4b5fd', '#f9a8d4', '#fdba74']
  const s = String(value)
  let h = 0; for (let i=0;i<s.length;i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}
