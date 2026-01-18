export const INF = Number.POSITIVE_INFINITY;

export type OpType = "insert" | "deactivate";

export interface Operation {
  id?: number;
  type: OpType;
  tx: number; // transaction time
  vs: number; // valid start
  ve: number; // valid end (Infinity allowed)
  value?: string;
}

export interface Version {
  vs: number;
  ve: number;
  ss: number; // system start
  se: number; // system end (Infinity allowed)
  value?: string;
  createdBy: number;
  _sysOpen?: boolean;
  _validOpen?: boolean;
}

export function sortOps(ops: Operation[]): Operation[] {
  return [...ops].sort((a, b) => a.tx - b.tx || (a.id ?? 0) - (b.id ?? 0));
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

export function computeVersions(ops: Operation[]): Version[] {
  const ordered = sortOps(ops);
  const closed: Version[] = [];
  let open: Version[] = [];

  for (const op of ordered) {
    const tx = op.tx;
    const range: [number, number] = [op.vs, op.ve];
    const nextOpen: Version[] = [];

    // close and split affected open rows
    for (const row of open) {
      if (!overlaps(row.vs, row.ve, range[0], range[1])) {
        nextOpen.push(row);
        continue;
      }
      // close the current row at tx
      closed.push({ ...row, se: tx });

      // left remainder
      if (row.vs < range[0]) {
        nextOpen.push({
          vs: row.vs,
          ve: Math.min(range[0], row.ve),
          ss: tx,
          se: INF,
          value: row.value,
          createdBy: op.id ?? -1,
        });
      }
      // right remainder
      if (range[1] < row.ve) {
        nextOpen.push({
          vs: Math.max(range[1], row.vs),
          ve: row.ve,
          ss: tx,
          se: INF,
          value: row.value,
          createdBy: op.id ?? -1,
        });
      }
    }

    // apply operation
    const isInsert = op.type === "insert";
    const isDeactivate = op.type === "deactivate";

    if (isInsert) {
      nextOpen.push({
        vs: range[0],
        ve: range[1],
        ss: tx,
        se: INF,
        value: op.value,
        createdBy: op.id ?? -1,
      });
    } else if (isDeactivate) {
      // close only (no new value). Behavior already achieved by closing/splitting above.
    }

    open = mergeAdjacent(nextOpen);
  }

  return [...closed, ...open];
}

function mergeAdjacent(rows: Version[]): Version[] {
  if (rows.length <= 1) return rows;
  const cmp = (x: number, y: number) => (x === y ? 0 : x === INF ? 1 : y === INF ? -1 : x - y);
  rows.sort((a, b) => {
    const c1 = cmp(a.vs, b.vs);
    if (c1) return c1;
    const c2 = cmp(a.ve, b.ve);
    if (c2) return c2;
    return cmp(a.ss, b.ss);
  });
  const out: Version[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    if (
      last &&
      last.ss === r.ss &&
      last.se === r.se &&
      last.value === r.value &&
      last.ve === r.vs
    ) {
      last.ve = r.ve;
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

export function extents(items: Version[]): {
  tmin: number;
  tmax: number;
  vmin: number;
  vmax: number;
} {
  const arr = Array.isArray(items) ? items : [];
  let tmin = INF,
    tmax = -INF,
    vmin = INF,
    vmax = -INF;
  for (const it of arr) {
    const vStart = it.vs ?? 0;
    const vEnd = it.ve ?? 1;
    const ss = it.ss ?? 0;
    const se = it.se ?? 0;
    tmin = Math.min(tmin, ss);
    tmax = Math.max(tmax, se);
    vmin = Math.min(vmin, vStart);
    vmax = Math.max(vmax, vEnd);
  }
  if (tmin === INF) {
    tmin = 0;
    tmax = 10;
  }
  if (vmin === INF) {
    vmin = 0;
    vmax = 10;
  }
  return { tmin, tmax, vmin, vmax };
}

export function normalizeForDisplay(
  versions: Version[],
  ops: Operation[],
  txMaxOverride?: number,
  vMaxOverride?: number,
): Version[] {
  const txMax = Number.isFinite(txMaxOverride)
    ? (txMaxOverride as number)
    : Math.max(0, ...ops.map((o) => o.tx));
  const vMax = Number.isFinite(vMaxOverride)
    ? (vMaxOverride as number)
    : Math.max(0, ...versions.map((v) => (v.ve === INF ? 0 : v.ve)));
  const wallX = txMax + 1;
  const wallY = vMax + 1;
  return versions.map((v) => ({
    ...v,
    se: v.se === INF ? wallX : v.se,
    ve: v.ve === INF ? wallY : v.ve,
    _sysOpen: v.se === INF,
    _validOpen: v.ve === INF,
  }));
}
