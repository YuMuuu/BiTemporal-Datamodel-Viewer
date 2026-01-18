"use client"
import React, { useMemo, useState } from 'react'
import { computeVersions, normalizeForDisplay, Operation } from '../lib/model'
import { Canvas } from './Canvas'

function useOpsState(initial: Operation[] = []) {
  const [ops, setOps] = useState<Operation[]>(initial)
  const add = (op: Operation) => setOps((old) => [...old, { ...op, id: nextId(old) }].sort((a,b)=>a.tx-b.tx||((a.id??0)-(b.id??0))))
  const remove = (id: number) => setOps((old) => old.filter(o => o.id !== id))
  const clear = () => setOps([])
  return { ops, add, remove, clear }
}

function nextId(list: Operation[]){ return ((list?.at(-1)?.id) ?? 0) + 1 }

export interface AppUIProps {
  initialOps?: Operation[]
  initialAsOf?: number
  initialOrientationUp?: boolean
  initialShowGrid?: boolean
  initialShowHistorical?: boolean
  initialGridMaxTx?: number
  initialGridMaxValid?: number
  initialReplayCount?: number
}

export default function AppUI({
  initialOps = [],
  initialAsOf = 0,
  initialOrientationUp = true,
  initialShowGrid = true,
  initialShowHistorical = false,
  initialGridMaxTx = 5,
  initialGridMaxValid = 5,
  initialReplayCount,
}: AppUIProps){
  const { ops, add, remove, clear } = useOpsState(initialOps)
  const [asOfTx, setAsOfTx] = useState<number>(initialAsOf)
  const [asOfValidInput, setAsOfValidInput] = useState<string>('')
  const [orientationUp, setOrientationUp] = useState<boolean>(initialOrientationUp)
  const [showGrid, setShowGrid] = useState<boolean>(initialShowGrid)
  const [showHistorical, setShowHistorical] = useState<boolean>(initialShowHistorical)
  const [gridMaxTx, setGridMaxTx] = useState<number>(initialGridMaxTx)
  const [gridMaxValid, setGridMaxValid] = useState<number>(initialGridMaxValid)
  const [replayCount, setReplayCount] = useState<number>(initialReplayCount ?? initialOps.length ?? 0)

  React.useEffect(()=>{
    setReplayCount((n)=> {
      const base = typeof n === 'number' && !Number.isNaN(n) ? n : ops.length
      return Math.max(0, Math.min(base, ops.length))
    })
  }, [ops.length])

  const opsForReplay = useMemo(()=> ops.slice(0, Math.max(0, Math.min(replayCount, ops.length))), [ops, replayCount])
  const versions = useMemo(()=> normalizeForDisplay(computeVersions(opsForReplay), opsForReplay, gridMaxTx, gridMaxValid), [opsForReplay, gridMaxTx, gridMaxValid])
  const intervalTip = '区間は半開区間 [start, end) を用います。∞ は開いた期間を表します。valid: [FROM_Z, THRU_Z), system: [IN_Z, OUT_Z)。'

  return (
    <div>
      <header className="app-header">
        <h1>BiTemporal Datemodel Viewer</h1>
        <div className="header-actions">
          <button onClick={()=>loadSample(add, setReplayCount)}>Load Sample</button>
          <button onClick={()=>{ if(confirm('すべての操作を削除しますか？')) clear() }}>Clear</button>
          <label className="asof" title={intervalTip}>AS OF (transaction/IN_Z):
            <input type="number" step={1} value={asOfTx} onChange={(e)=>setAsOfTx(+e.target.value||0)} />
          </label>
        </div>
      </header>

      <main className="app-main">
        <section className="canvas-panel">
          <div className="axes-labels">
            <div className="label-y" title={intervalTip}>{`valid time ${orientationUp ? '▼' : '▲'}`}</div>
            <div className="label-x" title={intervalTip}>transaction time (processing time) ▶</div>
          </div>
          <Canvas
            versions={versions}
            options={{ asOfTx, asOfValid: (asOfValidInput === '' ? undefined : +asOfValidInput), orientationUp, showGrid, showHistorical, gridMaxTx, gridMaxValid }}
          />
        </section>

        <section className="controls-panel">
          <h2>Timeline</h2>
          <div className="row" style={{alignItems:'center'}}>
            <label style={{display:'inline-flex', alignItems:'center', gap:'.5rem'}}>replay 0–{ops.length}
              <input type="range" min={0} max={ops.length} step={1} value={Math.min(replayCount, ops.length)} onChange={(e)=>setReplayCount(+e.target.value)} />
            </label>
            <label>count
              <input type="number" min={0} max={ops.length} step={1} value={Math.min(replayCount, ops.length)} onChange={(e)=>setReplayCount(Math.max(0, Math.min(ops.length, +e.target.value||0)))} />
            </label>
            <button onClick={()=>setReplayCount(ops.length)}>All</button>
          </div>
          <div className="row" style={{alignItems:'center'}}>
            <label className="asof" title={intervalTip}>AS OF (valid time)
              <input type="number" step={1} value={asOfValidInput} onChange={(e)=>setAsOfValidInput(e.target.value)} placeholder="—" />
            </label>
          </div>
          <ol className="ops-list" start={1}>
            {ops.map((op, idx) => (
              <li key={op.id} className={idx < replayCount ? '' : 'inactive'}>
                <span className="badge">{op.id}</span>
                <span>
                  {op.type} IN_Z={op.tx} valid=[FROM_Z:{op.vs}, THRU_Z:{Number.isFinite(op.ve) ? op.ve : '∞'})
                  {op.type === 'insert' || op.type === 'upsert' ? ` value=${op.value ?? ''}` : ''}
                </span>
                <button title="削除" onClick={()=> remove(op.id!)}>×</button>
              </li>
            ))}
          </ol>

          <details open className="op-form">
            <summary>操作を追加</summary>
            <OpForm onAdd={add} />
          </details>

          <details className="view-options">
            <summary>表示オプション</summary>
            <label><input type="checkbox" checked={orientationUp} onChange={(e)=>setOrientationUp(e.target.checked)} /> Y軸を上向きにする（valid↑）</label>
            <label><input type="checkbox" checked={showGrid} onChange={(e)=>setShowGrid(e.target.checked)} /> グリッドを表示</label>
            <label><input type="checkbox" checked={showHistorical} onChange={(e)=>setShowHistorical(e.target.checked)} /> 履歴（AS OFより前のsystem）も描画</label>
            <div className="row">
              <label title={intervalTip}>grid max (transaction/IN_Z)
                <input type="number" min={1} step={1} value={gridMaxTx} onChange={(e)=>setGridMaxTx(Math.max(1, +e.target.value||5))} />
              </label>
              <label title={intervalTip}>grid max (valid time)
                <input type="number" min={1} step={1} value={gridMaxValid} onChange={(e)=>setGridMaxValid(Math.max(1, +e.target.value||5))} />
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

function loadSample(add: (op: Operation) => void, setReplayCount: (n: number)=>void){
  const samples: Operation[] = [
    { type: 'insert', tx: 0, vs: 0, ve: 8, value: 'A' },
    { type: 'insert', tx: 2, vs: 2, ve: 7, value: 'B' },
    { type: 'deactivate',  tx: 3, vs: 4, ve: 5 },
    { type: 'insert', tx: 5, vs: 1, ve: 9, value: 'C' },
  ]
  samples.forEach(add)
  setReplayCount(samples.length)
}

function OpForm({ onAdd }: { onAdd: (op: Operation)=>void }){
  const [type, setType] = useState<Operation['type']>('insert')
  const [tx, setTx] = useState<string>('')
  const [vs, setVs] = useState<string>('')
  const [ve, setVe] = useState<string>('')
  const [openEnd, setOpenEnd] = useState<boolean>(true)
  const [value, setValue] = useState<string>('')

  function submit(e: React.FormEvent){
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
          <select value={type} onChange={(e)=>setType(e.target.value as Operation['type'])}>
            <option value="insert">insert</option>
            <option value="deactivate">deactivate (OUT_Z ← tx)</option>
          </select>
        </label>
        <label>tx
          <input type="number" step={1} value={tx} onChange={(e)=>setTx(e.target.value)} required />
        </label>
      </div>
      <div className="row">
        <label>validStart
          <input type="number" step={1} value={vs} onChange={(e)=>setVs(e.target.value)} required />
        </label>
        <label>validEnd
          <div style={{display:'flex', gap:'.5rem', alignItems:'center'}}>
            <input type="number" step={1} value={ve} onChange={(e)=>setVe(e.target.value)} disabled={openEnd} />
            <label style={{display:'inline-flex', alignItems:'center', gap:'.25rem'}}>
              <input type="checkbox" checked={openEnd} onChange={(e)=>setOpenEnd(e.target.checked)} /> ∞
            </label>
          </div>
        </label>
      </div>
      <div className="row">
        <label>value
          <input type="text" placeholder="e.g., A" value={value} onChange={(e)=>setValue(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <button type="submit">Add</button>
      </div>
    </form>
  )
}
