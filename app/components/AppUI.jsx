"use client"
import React, { useMemo, useState } from 'react'
import { computeVersions, normalizeForDisplay } from '../lib/model.js'
import { Canvas } from './Canvas.jsx'

function useOpsState(initial=[]) {
  const [ops, setOps] = useState(initial)
  const add = (op) => setOps((old) => [...old, { ...op, id: nextId(old) }].sort((a,b)=>a.tx-b.tx||a.id-b.id))
  const remove = (id) => setOps((old) => old.filter(o => o.id !== id))
  const clear = () => setOps([])
  return { ops, add, remove, clear }
}

function nextId(list){ return (list?.at(-1)?.id ?? 0) + 1 }

export default function AppUI({
  initialOps = [],
  initialAsOf = 0,
  initialOrientationUp = true,
  initialShowGrid = true,
  initialShowHistorical = false,
  initialGridMaxTx = 5,
  initialGridMaxValid = 5,
  initialReplayCount,
} = {}){
  const { ops, add, remove, clear } = useOpsState(initialOps)
  const [asOfTx, setAsOfTx] = useState(initialAsOf)
  const [orientationUp, setOrientationUp] = useState(initialOrientationUp)
  const [showGrid, setShowGrid] = useState(initialShowGrid)
  const [showHistorical, setShowHistorical] = useState(initialShowHistorical)
  const [gridMaxTx, setGridMaxTx] = useState(initialGridMaxTx)
  const [gridMaxValid, setGridMaxValid] = useState(initialGridMaxValid)
  const [replayCount, setReplayCount] = useState(initialReplayCount ?? initialOps.length ?? 0)

  // clamp replayCount when ops change
  React.useEffect(()=>{
    setReplayCount((n)=> Math.min(n || ops.length, ops.length))
  }, [ops.length])

  const opsForReplay = useMemo(()=> ops.slice(0, replayCount || ops.length), [ops, replayCount])
  const versions = useMemo(()=> normalizeForDisplay(computeVersions(opsForReplay), opsForReplay, gridMaxTx, gridMaxValid), [opsForReplay, gridMaxTx, gridMaxValid])

  return (
    <div>
      <header className="app-header">
        <h1>BiTemporal Datemodel Viewer</h1>
        <div className="header-actions">
          <button onClick={()=>loadSample(add, setReplayCount)}>Load Sample</button>
          <button onClick={()=>{ if(confirm('すべての操作を削除しますか？')) clear() }}>Clear</button>
          <label className="asof">AS OF (transaction):
            <input type="number" step="1" value={asOfTx} onChange={e=>setAsOfTx(+e.target.value||0)} />
          </label>
        </div>
      </header>

      <main className="app-main">
        <section className="canvas-panel">
          <div className="axes-labels">
            <div className="label-y">{`valid time ${orientationUp ? '▼' : '▲'}`}</div>
            <div className="label-x">transaction time ▶</div>
          </div>
          <Canvas
            versions={versions}
            options={{ asOfTx, orientationUp, showGrid, showHistorical, gridMaxTx, gridMaxValid }}
          />
        </section>

        <section className="controls-panel">
          <h2>Timeline</h2>
          <div className="row" style={{alignItems:'center'}}>
            <label style={{display:'inline-flex', alignItems:'center', gap:'.5rem'}}>replay 0–{ops.length}
              <input type="range" min={0} max={ops.length} step={1} value={Math.min(replayCount, ops.length)} onChange={e=>setReplayCount(+e.target.value)} />
            </label>
            <label>count
              <input type="number" min={0} max={ops.length} step={1} value={Math.min(replayCount, ops.length)} onChange={e=>setReplayCount(Math.max(0, Math.min(ops.length, +e.target.value||0)))} />
            </label>
            <button onClick={()=>setReplayCount(ops.length)}>All</button>
          </div>
          <ol className="ops-list" start={1}>
            {ops.map((op, idx) => (
              <li key={op.id} className={idx < (replayCount || ops.length) ? '' : 'inactive'}>
                <span className="badge">{op.id}</span>
                <span>
                  {op.type} tx={op.tx} valid=[{op.vs},{Number.isFinite(op.ve) ? op.ve : '∞'})
                  {op.type === 'upsert' ? ` value=${op.value ?? ''}` : ''}
                </span>
                <button title="削除" onClick={()=>remove(op.id)}>×</button>
              </li>
            ))}
          </ol>

          <details open className="op-form">
            <summary>操作を追加</summary>
            <OpForm onAdd={add} />
          </details>

          <details className="view-options">
            <summary>表示オプション</summary>
            <label><input type="checkbox" checked={orientationUp} onChange={e=>setOrientationUp(e.target.checked)} /> Y軸を上向きにする（valid↑）</label>
            <label><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)} /> グリッドを表示</label>
            <label><input type="checkbox" checked={showHistorical} onChange={e=>setShowHistorical(e.target.checked)} /> 過去（AS OFより左）も描画</label>
            <div className="row">
              <label>grid max (transaction)
                <input type="number" min="1" step="1" value={gridMaxTx} onChange={e=>setGridMaxTx(Math.max(1, +e.target.value||5))} />
              </label>
              <label>grid max (valid)
                <input type="number" min="1" step="1" value={gridMaxValid} onChange={e=>setGridMaxValid(Math.max(1, +e.target.value||5))} />
              </label>
            </div>
          </details>
        </section>
      </main>

      <footer className="app-footer">
        <small>Next.js (app router). 半開区間 [start, end) / txは整数軸。</small>
      </footer>
    </div>
  )
}

function loadSample(add, setReplayCount){
  const samples = [
    { type: 'upsert', tx: 0, vs: 0, ve: 8, value: 'A' },
    { type: 'upsert', tx: 2, vs: 2, ve: 7, value: 'B' },
    { type: 'close',  tx: 3, vs: 4, ve: 5 },
    { type: 'upsert', tx: 5, vs: 1, ve: 9, value: 'C' },
  ]
  samples.forEach(add)
  setReplayCount(samples.length)
}

function OpForm({ onAdd }){
  const [type, setType] = useState('upsert')
  const [tx, setTx] = useState('')
  const [vs, setVs] = useState('')
  const [ve, setVe] = useState('')
  const [openEnd, setOpenEnd] = useState(true)
  const [value, setValue] = useState('')

  function submit(e){
    e.preventDefault()
    const nTx = +tx, nVs = +vs, nVe = openEnd ? Number.POSITIVE_INFINITY : +ve
    if (!Number.isFinite(nTx) || !Number.isFinite(nVs)) {
      alert('tx, validStart を正しく入力してください')
      return
    }
    if (!openEnd && (!Number.isFinite(nVe) || nVe <= nVs)) {
      alert('validEnd を正しく入力してください（end > start）')
      return
    }
    onAdd({ type, tx:nTx, vs:nVs, ve:nVe, value: value || undefined })
    setTx(''); setVs(''); setVe(''); setOpenEnd(true); setValue('')
  }

  return (
    <form onSubmit={submit}>
      <div className="row">
        <label>Type
          <select value={type} onChange={e=>setType(e.target.value)}>
            <option value="upsert">upsert</option>
            <option value="close">close (set OUT_Z=tx)</option>
          </select>
        </label>
        <label>tx
          <input type="number" step="1" value={tx} onChange={e=>setTx(e.target.value)} required />
        </label>
      </div>
      <div className="row">
        <label>validStart
          <input type="number" step="1" value={vs} onChange={e=>setVs(e.target.value)} required />
        </label>
        <label>validEnd
          <div style={{display:'flex', gap:'.5rem', alignItems:'center'}}>
            <input type="number" step="1" value={ve} onChange={e=>setVe(e.target.value)} disabled={openEnd} />
            <label style={{display:'inline-flex', alignItems:'center', gap:'.25rem'}}>
              <input type="checkbox" checked={openEnd} onChange={e=>setOpenEnd(e.target.checked)} /> ∞
            </label>
          </div>
        </label>
      </div>
      <div className="row">
        <label>value
          <input type="text" placeholder="e.g., A" value={value} onChange={e=>setValue(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <button type="submit">Add</button>
      </div>
    </form>
  )
}
