"use client";
import React, { useMemo, useState } from "react";
import { computeVersions, normalizeForDisplay, Operation } from "../lib/model";
import {
  SelectionSpec,
  selectVersions,
  AggregationSpec,
  aggregateByTime,
  ValueSpec,
} from "../lib/transform";
import { Canvas } from "./Canvas";

function useOpsState(initial: Operation[] = []) {
  const [ops, setOps] = useState<Operation[]>(initial);
  const add = (op: Operation) =>
    setOps((old) =>
      [...old, { ...op, id: nextId(old) }].sort((a, b) => a.tx - b.tx || (a.id ?? 0) - (b.id ?? 0)),
    );
  const remove = (id: number) => setOps((old) => old.filter((o) => o.id !== id));
  const clear = () => setOps([]);
  return { ops, add, remove, clear };
}

function nextId(list: Operation[]) {
  return (list?.at(-1)?.id ?? 0) + 1;
}

export interface AppUIProps {
  initialOps?: Operation[];
  initialAsOf?: number;
  initialOrientationUp?: boolean;
  initialShowGrid?: boolean;
  initialShowHistorical?: boolean;
  initialGridMaxTx?: number;
  initialGridMaxValid?: number;
  initialReplayCount?: number;
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
}: AppUIProps) {
  const { ops, add, remove, clear } = useOpsState(initialOps);
  const [asOfTx, setAsOfTx] = useState<number>(initialAsOf);
  const [asOfValidInput, setAsOfValidInput] = useState<string>("");
  const [orientationUp, setOrientationUp] = useState<boolean>(initialOrientationUp);
  const [showGrid, setShowGrid] = useState<boolean>(initialShowGrid);
  const [showHistorical, setShowHistorical] = useState<boolean>(initialShowHistorical);
  const [gridMaxTx, setGridMaxTx] = useState<number>(initialGridMaxTx);
  const [gridMaxValid, setGridMaxValid] = useState<number>(initialGridMaxValid);
  const [replayCount, setReplayCount] = useState<number>(
    initialReplayCount ?? initialOps.length ?? 0,
  );

  React.useEffect(() => {
    setReplayCount((n) => {
      const base = typeof n === "number" && !Number.isNaN(n) ? n : ops.length;
      return Math.max(0, Math.min(base, ops.length));
    });
  }, [ops.length]);

  const opsForReplay = useMemo(
    () => ops.slice(0, Math.max(0, Math.min(replayCount, ops.length))),
    [ops, replayCount],
  );
  const versions = useMemo(
    () => normalizeForDisplay(computeVersions(opsForReplay), opsForReplay, gridMaxTx, gridMaxValid),
    [opsForReplay, gridMaxTx, gridMaxValid],
  );
  const intervalTip =
    "区間は半開区間 [start, end) を用います。∞ は開いた期間を表します。valid: [FROM_Z, THRU_Z), system: [IN_Z, OUT_Z)。";

  // Transform: Selection & Aggregation (Phase 1)
  const [selectionEnabled, setSelectionEnabled] = useState<boolean>(false);
  const [selection, setSelection] = useState<SelectionSpec>({
    valid: { mode: "overlap", clip: true },
    system: undefined,
    value: undefined,
  });
  const selectedVersions = useMemo(
    () => (selectionEnabled ? selectVersions(versions, selection) : versions),
    [versions, selectionEnabled, selection],
  );

  const [aggEnabled, setAggEnabled] = useState<boolean>(false);
  const [agg, setAgg] = useState<AggregationSpec>({
    axis: "valid",
    binWidth: 2,
    align: "zero",
    func: "last",
  });
  const aggregated = useMemo(
    () => (aggEnabled ? aggregateByTime(selectedVersions, agg) : []),
    [selectedVersions, aggEnabled, agg],
  );

  return (
    <div>
      <header className="app-header">
        <h1>BiTemporal Datemodel Viewer</h1>
        <div className="header-actions">
          <button onClick={() => loadSample(add, setReplayCount)}>Load Sample</button>
          <button
            onClick={() => {
              if (confirm("すべての操作を削除しますか？")) clear();
            }}
          >
            Clear
          </button>
          <label className="asof" title={intervalTip}>
            AS OF (transaction/IN_Z):
            <input
              type="number"
              step={1}
              value={asOfTx}
              onChange={(e) => setAsOfTx(+e.target.value || 0)}
            />
          </label>
        </div>
      </header>

      <main className="app-main">
        <section className="canvas-panel">
          <div className="axes-labels">
            <div
              className="label-y"
              title={intervalTip}
            >{`valid time(business time) ${orientationUp ? "▼" : "▲"}`}</div>
            <div className="label-x" title={intervalTip}>
              transaction time (processing time) ▶
            </div>
          </div>
          <Canvas
            versions={selectedVersions}
            options={{
              asOfTx,
              asOfValid: asOfValidInput === "" ? undefined : +asOfValidInput,
              orientationUp,
              showGrid,
              showHistorical,
              gridMaxTx,
              gridMaxValid,
            }}
          />
        </section>

        <section className="controls-panel">
          <h2>Timeline</h2>
          <div className="row" style={{ alignItems: "center" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: ".5rem" }}>
              replay 0–{ops.length}
              <input
                type="range"
                min={0}
                max={ops.length}
                step={1}
                value={Math.min(replayCount, ops.length)}
                onChange={(e) => setReplayCount(+e.target.value)}
              />
            </label>
            <label>
              count
              <input
                type="number"
                min={0}
                max={ops.length}
                step={1}
                value={Math.min(replayCount, ops.length)}
                onChange={(e) =>
                  setReplayCount(Math.max(0, Math.min(ops.length, +e.target.value || 0)))
                }
              />
            </label>
            <button onClick={() => setReplayCount(ops.length)}>All</button>
          </div>
          <div className="row" style={{ alignItems: "center" }}>
            <label className="asof" title={intervalTip}>
              AS OF (valid time(business time))
              <input
                type="number"
                step={1}
                value={asOfValidInput}
                onChange={(e) => setAsOfValidInput(e.target.value)}
                placeholder="—"
              />
            </label>
          </div>
          <ol className="ops-list" start={1}>
            {ops.map((op, idx) => (
              <li key={op.id} className={idx < replayCount ? "" : "inactive"}>
                <span className="badge">{op.id}</span>
                <span>
                  {op.type} IN_Z={op.tx} valid=[FROM_Z:{op.vs}, THRU_Z:
                  {Number.isFinite(op.ve) ? op.ve : "∞"})
                  {op.type === "insert" ? ` value=${op.value ?? ""}` : ""}
                </span>
                <button title="削除" onClick={() => remove(op.id!)}>
                  ×
                </button>
              </li>
            ))}
          </ol>

          <details open className="op-form">
            <summary>操作を追加</summary>
            <OpForm onAdd={add} />
          </details>

          <details className="view-options">
            <summary>表示オプション</summary>
            <label>
              <input
                type="checkbox"
                checked={orientationUp}
                onChange={(e) => setOrientationUp(e.target.checked)}
              />{" "}
              Y軸を上向きにする（valid↑）
            </label>
            <label>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />{" "}
              グリッドを表示
            </label>
            <label>
              <input
                type="checkbox"
                checked={showHistorical}
                onChange={(e) => setShowHistorical(e.target.checked)}
              />{" "}
              履歴（AS OFより前のsystem）も描画
            </label>
            <div className="row">
              <label title={intervalTip}>
                grid max (transaction/IN_Z)
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={gridMaxTx}
                  onChange={(e) => setGridMaxTx(Math.max(1, +e.target.value || 5))}
                />
              </label>
              <label title={intervalTip}>
                grid max (valid time(business time))
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={gridMaxValid}
                  onChange={(e) => setGridMaxValid(Math.max(1, +e.target.value || 5))}
                />
              </label>
            </div>
          </details>

          <details className="transform-panel">
            <summary>Transform（Selection / Aggregation）</summary>
            <section
              style={{ borderTop: "1px dashed #445", paddingTop: ".5rem", marginTop: ".5rem" }}
            >
              <label style={{ display: "inline-flex", gap: ".5rem", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={selectionEnabled}
                  onChange={(e) => setSelectionEnabled(e.target.checked)}
                />
                Selection を有効化
              </label>
              {selectionEnabled && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: "1rem",
                    marginTop: ".5rem",
                  }}
                >
                  <fieldset>
                    <legend>valid time</legend>
                    <div className="row">
                      <label title={intervalTip}>
                        FROM_Z
                        <input
                          type="number"
                          value={selection.valid?.start ?? ""}
                          onChange={(e) =>
                            setSelection((s) => ({
                              ...s,
                              valid: {
                                ...(s.valid ?? { mode: "overlap", clip: true }),
                                start: e.target.value === "" ? undefined : +e.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label title={intervalTip}>
                        TO_Z
                        <input
                          type="number"
                          value={selection.valid?.end ?? ""}
                          onChange={(e) =>
                            setSelection((s) => ({
                              ...s,
                              valid: {
                                ...(s.valid ?? { mode: "overlap", clip: true }),
                                end: e.target.value === "" ? undefined : +e.target.value,
                              },
                            }))
                          }
                          placeholder="∞"
                        />
                      </label>
                    </div>
                    <div className="row" style={{ alignItems: "center", gap: ".75rem" }}>
                      <label>
                        <input
                          type="radio"
                          checked={(selection.valid?.mode ?? "overlap") === "overlap"}
                          onChange={() =>
                            setSelection((s) => ({
                              ...s,
                              valid: { ...(s.valid ?? { clip: true }), mode: "overlap" },
                            }))
                          }
                        />{" "}
                        overlap
                      </label>
                      <label>
                        <input
                          type="radio"
                          checked={(selection.valid?.mode ?? "overlap") === "contain"}
                          onChange={() =>
                            setSelection((s) => ({
                              ...s,
                              valid: { ...(s.valid ?? { clip: true }), mode: "contain" },
                            }))
                          }
                        />{" "}
                        contain
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={selection.valid?.clip ?? true}
                          onChange={(e) =>
                            setSelection((s) => ({
                              ...s,
                              valid: {
                                ...(s.valid ?? { mode: "overlap" }),
                                clip: e.target.checked,
                              },
                            }))
                          }
                        />{" "}
                        clip
                      </label>
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend>transaction time</legend>
                    <div className="row">
                      <label title={intervalTip}>
                        IN_Z
                        <input
                          type="number"
                          value={selection.system?.start ?? ""}
                          onChange={(e) =>
                            setSelection((s) => ({
                              ...s,
                              system: {
                                ...(s.system ?? { mode: "overlap", clip: false }),
                                start: e.target.value === "" ? undefined : +e.target.value,
                              },
                            }))
                          }
                        />
                      </label>
                      <label title={intervalTip}>
                        OUT_Z
                        <input
                          type="number"
                          value={selection.system?.end ?? ""}
                          onChange={(e) =>
                            setSelection((s) => ({
                              ...s,
                              system: {
                                ...(s.system ?? { mode: "overlap", clip: false }),
                                end: e.target.value === "" ? undefined : +e.target.value,
                              },
                            }))
                          }
                          placeholder="∞"
                        />
                      </label>
                    </div>
                    <div className="row" style={{ alignItems: "center", gap: ".75rem" }}>
                      <label>
                        <input
                          type="radio"
                          checked={(selection.system?.mode ?? "overlap") === "overlap"}
                          onChange={() =>
                            setSelection((s) => ({
                              ...s,
                              system: { ...(s.system ?? { clip: false }), mode: "overlap" },
                            }))
                          }
                        />{" "}
                        overlap
                      </label>
                      <label>
                        <input
                          type="radio"
                          checked={(selection.system?.mode ?? "overlap") === "contain"}
                          onChange={() =>
                            setSelection((s) => ({
                              ...s,
                              system: { ...(s.system ?? { clip: false }), mode: "contain" },
                            }))
                          }
                        />{" "}
                        contain
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={selection.system?.clip ?? false}
                          onChange={(e) =>
                            setSelection((s) => ({
                              ...s,
                              system: {
                                ...(s.system ?? { mode: "overlap" }),
                                clip: e.target.checked,
                              },
                            }))
                          }
                        />{" "}
                        clip
                      </label>
                    </div>
                  </fieldset>

                  <div style={{ gridColumn: "1 / -1" }} className="row">
                    <label>
                      value filter
                      <select
                        value={selection.value?.kind ?? "contains"}
                        onChange={(e) =>
                          setSelection((s) => ({
                            ...s,
                            value: {
                              kind: e.target.value as ValueSpec["kind"],
                              pattern: s.value?.pattern ?? "",
                            },
                          }))
                        }
                      >
                        <option value="contains">contains</option>
                        <option value="equals">equals</option>
                      </select>
                      <input
                        type="text"
                        placeholder="pattern"
                        value={selection.value?.pattern ?? ""}
                        onChange={(e) =>
                          setSelection((s) => ({
                            ...s,
                            value: {
                              kind: (s.value?.kind ?? "contains") as ValueSpec["kind"],
                              pattern: e.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setSelection({ valid: { mode: "overlap", clip: true } })}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section
              style={{ borderTop: "1px dashed #445", paddingTop: ".5rem", marginTop: ".75rem" }}
            >
              <label style={{ display: "inline-flex", gap: ".5rem", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={aggEnabled}
                  onChange={(e) => setAggEnabled(e.target.checked)}
                />
                Aggregation を有効化
              </label>
              {aggEnabled && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: "1rem",
                    marginTop: ".5rem",
                  }}
                >
                  <div className="row" style={{ alignItems: "center", gap: ".75rem" }}>
                    <label>
                      axis
                      <select
                        value={agg.axis}
                        onChange={(e) =>
                          setAgg((a) => ({ ...a, axis: e.target.value as AggregationSpec["axis"] }))
                        }
                      >
                        <option value="valid">business time</option>
                        <option value="system">system time</option>
                      </select>
                    </label>
                    <label>
                      bin width
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={agg.binWidth}
                        onChange={(e) =>
                          setAgg((a) => ({ ...a, binWidth: Math.max(1, +e.target.value || 1) }))
                        }
                      />
                    </label>
                    <label>
                      align
                      <select
                        value={agg.align}
                        onChange={(e) =>
                          setAgg((a) => ({
                            ...a,
                            align: e.target.value as AggregationSpec["align"],
                          }))
                        }
                      >
                        <option value="zero">zero</option>
                        <option value="min">min</option>
                      </select>
                    </label>
                    <label>
                      func
                      <select
                        value={agg.func}
                        onChange={(e) =>
                          setAgg((a) => ({ ...a, func: e.target.value as AggregationSpec["func"] }))
                        }
                      >
                        <option value="last">last</option>
                        <option value="count">count</option>
                      </select>
                    </label>
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <AggregationTable rows={aggregated} />
                  </div>
                </div>
              )}
            </section>
          </details>
        </section>
      </main>

      <footer className="app-footer">
        <small>Next.js (app router). 半開区間 [start, end) / txは整数軸。</small>
      </footer>
    </div>
  );
}

function AggregationTable({ rows }: { rows: ReturnType<typeof aggregateByTime> }) {
  if (!rows?.length) return <div style={{ opacity: 0.7 }}>— aggregation result —</div>;
  return (
    <div style={{ maxHeight: 200, overflow: "auto" }}>
      <table className="agg-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", borderBottom: "1px solid #334" }}>t0</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #334" }}>t1</th>
            <th style={{ textAlign: "left", borderBottom: "1px solid #334" }}>value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.t0}</td>
              <td>{r.t1}</td>
              <td>{r.value ?? "∅"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function loadSample(add: (op: Operation) => void, setReplayCount: (n: number) => void) {
  const samples: Operation[] = [
    { type: "insert", tx: 0, vs: 0, ve: 8, value: "A" },
    { type: "insert", tx: 2, vs: 2, ve: 7, value: "B" },
    { type: "deactivate", tx: 3, vs: 4, ve: 5 },
    { type: "insert", tx: 5, vs: 1, ve: 9, value: "C" },
  ];
  samples.forEach(add);
  setReplayCount(samples.length);
}

function OpForm({ onAdd }: { onAdd: (op: Operation) => void }) {
  const [type, setType] = useState<Operation["type"]>("insert");
  const [tx, setTx] = useState<string>("");
  const [vs, setVs] = useState<string>("");
  const [ve, setVe] = useState<string>("");
  const [openEnd, setOpenEnd] = useState<boolean>(true);
  const [value, setValue] = useState<string>("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const nTx = +tx,
      nVs = +vs,
      nVe = openEnd ? Number.POSITIVE_INFINITY : +ve;
    if (!Number.isFinite(nTx) || !Number.isFinite(nVs)) {
      alert("tx, validStart を正しく入力してください");
      return;
    }
    if (!openEnd && (!Number.isFinite(nVe) || nVe <= nVs)) {
      alert("validEnd を正しく入力してください（end > start）");
      return;
    }
    onAdd({ type, tx: nTx, vs: nVs, ve: nVe, value: value || undefined });
    setTx("");
    setVs("");
    setVe("");
    setOpenEnd(true);
    setValue("");
  }

  return (
    <form onSubmit={submit}>
      <div className="row">
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value as Operation["type"])}>
            <option value="insert">insert</option>
            <option value="deactivate">deactivate (OUT_Z ← tx)</option>
          </select>
        </label>
        <label>
          tx
          <input
            type="number"
            step={1}
            value={tx}
            onChange={(e) => setTx(e.target.value)}
            required
          />
        </label>
      </div>
      <div className="row">
        <label>
          validStart
          <input
            type="number"
            step={1}
            value={vs}
            onChange={(e) => setVs(e.target.value)}
            required
          />
        </label>
        <label>
          validEnd
          <div style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
            <input
              type="number"
              step={1}
              value={ve}
              onChange={(e) => setVe(e.target.value)}
              disabled={openEnd}
            />
            <label style={{ display: "inline-flex", alignItems: "center", gap: ".25rem" }}>
              <input
                type="checkbox"
                checked={openEnd}
                onChange={(e) => setOpenEnd(e.target.checked)}
              />{" "}
              ∞
            </label>
          </div>
        </label>
      </div>
      <div className="row">
        <label>
          value
          <input
            type="text"
            placeholder="e.g., A"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
      </div>
      <div className="row">
        <button type="submit">Add</button>
      </div>
    </form>
  );
}
