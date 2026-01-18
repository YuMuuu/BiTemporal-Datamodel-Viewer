// BiTemporal operations and versioning model (front-end only)
// Time domain: integer steps. Intervals are half-open [start, end).

export const INF = Number.POSITIVE_INFINITY;

// Operation: { id, type: 'upsert'|'delete', tx, vs, ve, value? }
// Version (row): { vs, ve, ss, se, value, createdBy }

export function sortOps(ops) {
  // Stable sort by tx then id
  return [...ops].sort((a, b) => (a.tx - b.tx) || (a.id - b.id));
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

export function computeVersions(ops) {
  const ordered = sortOps(ops);
  /** @type {Array<{vs:number, ve:number, ss:number, se:number, value?:string, createdBy:number}>} */
  const closed = [];
  /** current open rows for latest system time */
  /** @type {Array<{vs:number, ve:number, ss:number, se:number, value?:string, createdBy:number}>} */
  let open = [];

  for (const op of ordered) {
    const tx = op.tx;
    const range = [op.vs, op.ve];
    const nextOpen = [];

    // 1) close and split affected open rows
    for (const row of open) {
      if (!overlaps(row.vs, row.ve, range[0], range[1])) {
        // unaffected, carry forward
        nextOpen.push(row);
        continue;
      }

      // close the current row at tx
      closed.push({ ...row, se: tx });

      // left remainder (below range)
      if (row.vs < range[0]) {
        nextOpen.push({
          vs: row.vs,
          ve: Math.min(range[0], row.ve),
          ss: tx,
          se: INF,
          value: row.value,
          createdBy: op.id,
        });
      }

      // right remainder (above range)
      if (range[1] < row.ve) {
        nextOpen.push({
          vs: Math.max(range[1], row.vs),
          ve: row.ve,
          ss: tx,
          se: INF,
          value: row.value,
          createdBy: op.id,
        });
      }
    }

    // 2) apply operation in the overlapped portion
    if (op.type === 'upsert') {
      nextOpen.push({
        vs: range[0],
        ve: range[1],
        ss: tx,
        se: INF,
        value: op.value,
        createdBy: op.id,
      });
    } else if (op.type === 'delete' || op.type === 'close' || op.type === 'invalidate') {
      // deletion: nothing to add = remove overlapped area
    }

    open = mergeAdjacent(nextOpen);
  }

  // flush remaining open rows as open (se = INF)
  return [...closed, ...open];
}

function mergeAdjacent(rows) {
  // merge adjacent rows in valid dimension with identical value & ss/se to keep count small
  if (rows.length <= 1) return rows;
  const cmp = (x, y) => x === y ? 0 : (x === INF ? 1 : (y === INF ? -1 : x - y));
  rows.sort((a, b) => {
    const c1 = cmp(a.vs, b.vs); if (c1) return c1;
    const c2 = cmp(a.ve, b.ve); if (c2) return c2;
    return cmp(a.ss, b.ss);
  });
  const out = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (last && last.ss === r.ss && last.se === r.se && last.value === r.value && last.ve === r.vs) {
      last.ve = r.ve; // extend
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

export function extents(items) {
  const arr = Array.isArray(items) ? items : [];
  let tmin = INF, tmax = -INF, vmin = INF, vmax = -INF;
  for (const it of arr) {
    const vStart = it.vs ?? 0;
    const vEnd = it.ve ?? 1;
    const ss = it.ss ?? it.tx ?? 0;
    const se = it.se ?? it.tx ?? 0;
    tmin = Math.min(tmin, ss);
    tmax = Math.max(tmax, se);
    vmin = Math.min(vmin, vStart);
    vmax = Math.max(vmax, vEnd);
  }
  if (tmin === INF) { tmin = 0; tmax = 10; }
  if (vmin === INF) { vmin = 0; vmax = 10; }
  return { tmin, tmax, vmin, vmax };
}

export function normalizeForDisplay(versions, ops, txMaxOverride, vMaxOverride) {
  // Convert Infinity ends into finite walls for plotting while keeping flags
  const txMax = Number.isFinite(txMaxOverride) ? txMaxOverride : Math.max(0, ...ops.map(o => o.tx));
  const vMax = Number.isFinite(vMaxOverride) ? vMaxOverride : Math.max(0, ...versions.map(v => v.ve === INF ? 0 : v.ve));
  const wallX = txMax + 1; // open system-time extends one tick beyond
  const wallY = vMax + 1;  // open valid-time extends one tick beyond
  return versions.map(v => ({
    ...v,
    se: v.se === INF ? wallX : v.se,
    ve: v.ve === INF ? wallY : v.ve,
    _sysOpen: v.se === INF,
    _validOpen: v.ve === INF,
  }));
}
