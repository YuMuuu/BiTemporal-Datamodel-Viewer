import { Version } from "./model";

// Selection types
export type RangeMode = "overlap" | "contain";

export interface TimeRangeSpec {
  start?: number;
  end?: number; // half-open end; if undefined => open
  mode: RangeMode;
  clip: boolean;
}

export interface ValueSpec {
  kind: "contains" | "equals";
  pattern: string;
}

export interface SelectionSpec {
  valid?: TimeRangeSpec;
  system?: TimeRangeSpec;
  value?: ValueSpec;
}

function overlaps(a0: number, a1: number, b0: number, b1: number): boolean {
  return Math.max(a0, b0) < Math.min(a1, b1);
}

function contains(a0: number, a1: number, b0: number, b1: number): boolean {
  return a0 <= b0 && b1 <= a1;
}

function applyTimeFilter(
  rows: Version[],
  axis: "valid" | "system",
  spec?: TimeRangeSpec,
): Version[] {
  if (!spec) return rows;
  const r0 = Number.isFinite(spec.start) ? (spec.start as number) : Number.NEGATIVE_INFINITY;
  const r1 = Number.isFinite(spec.end) ? (spec.end as number) : Number.POSITIVE_INFINITY;
  const pick = (v: Version) => (axis === "valid" ? { s0: v.vs, s1: v.ve } : { s0: v.ss, s1: v.se });

  const out: Version[] = [];
  for (const row of rows) {
    const { s0, s1 } = pick(row);
    const ok = spec.mode === "overlap" ? overlaps(s0, s1, r0, r1) : contains(r0, r1, s0, s1);
    if (!ok) continue;
    if (!spec.clip) {
      out.push(row);
    } else {
      // clip only along the selected axis; keep the other axis as-is
      if (axis === "valid") {
        out.push({ ...row, vs: Math.max(s0, r0), ve: Math.min(s1, r1) });
      } else {
        out.push({ ...row, ss: Math.max(s0, r0), se: Math.min(s1, r1) });
      }
    }
  }
  return out;
}

export function selectVersions(rows: Version[], spec?: SelectionSpec): Version[] {
  if (!spec) return rows;
  let cur = [...rows];
  cur = applyTimeFilter(cur, "valid", spec.valid);
  cur = applyTimeFilter(cur, "system", spec.system);
  if (spec.value && spec.value.pattern) {
    const p = spec.value.pattern;
    if (spec.value.kind === "contains") {
      cur = cur.filter((r) => (r.value ?? "").includes(p));
    } else if (spec.value.kind === "equals") {
      cur = cur.filter((r) => (r.value ?? "") === p);
    }
  }
  return cur;
}

// Aggregation types (Phase 1)
export interface AggregationSpec {
  axis: "valid" | "system";
  binWidth: number; // positive integer
  align: "zero" | "min";
  func: "last" | "count";
}

export interface AggregationRow {
  t0: number;
  t1: number;
  value: number | string | null;
}

export function aggregateByTime(rows: Version[], spec: AggregationSpec): AggregationRow[] {
  if (!rows.length) return [];
  const isValid = spec.axis === "valid";
  const t0 = Math.min(...rows.map((r) => (isValid ? r.vs : r.ss)));
  const t1 = Math.max(...rows.map((r) => (isValid ? r.ve : r.se)));
  const width = Math.max(1, Math.floor(spec.binWidth || 1));
  const start = spec.align === "zero" ? Math.floor(t0 / width) * width : t0;
  const bins: AggregationRow[] = [];
  for (let b0 = start; b0 < t1; b0 += width) {
    const b1 = b0 + width;
    const inBin = rows.filter((r) =>
      overlaps(isValid ? r.vs : r.ss, isValid ? r.ve : r.se, b0, b1),
    );
    let out: number | string | null = null;
    if (spec.func === "count") {
      out = inBin.length;
    } else if (spec.func === "last") {
      // pick value active at (b1-1)
      const tPick = b1 - 1;
      const active = inBin.filter((r) =>
        isValid ? r.vs <= tPick && tPick < r.ve : r.ss <= tPick && tPick < r.se,
      );
      out = active.length ? (active[active.length - 1].value ?? null) : null;
    }
    bins.push({ t0: b0, t1: b1, value: out });
  }
  return bins;
}
