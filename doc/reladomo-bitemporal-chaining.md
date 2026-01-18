# Reladomo Tour Guide — Chapter 10. Bitemporal Chaining 要約

- 最終更新: 2026-01-18
- 出典: Reladomo Tour Guide, Chapter 10 “Bitemporal Chaining”
- 参照URL: https://goldmansachs.github.io/reladomo-kata/reladomo-tour-docs/tour-guide.html#N4055F

## 概要

Reladomo の “Bitemporal Chaining” は、レコードの有効性を二つの時間軸で管理する手法。
- ビジネス時点（valid/business time）: `FROM_Z` ～ `THRU_Z`
- 処理時点（processing/system time）: `IN_Z` ～ `OUT_Z`

更新は「無効化（close）」と「追加（insert）」だけで表現し、上書き・物理削除は行わない。これにより、遅延到着や遡及修正があっても、
- 当時のDBが知っていた状態（processing視点）
- 後から判明した正しい歴史（business視点）
を両立して再現できる。

## チェイニング更新の基本規則（2ステップ）

1) 影響を受ける既存行を「処理時点=今日」でクローズ
- 対象: 新しい事実により世界観が変わる区間と重なる既存行
- 処理: 対象行の `OUT_Z` に「今日(処理日)」を設定

2) 新しい世界観（ビジネス時点上の正史）を表す行を挿入
- 挿入行の `IN_Z` は「今日(処理日)」
- 現行行は `OUT_Z = ∞`（開いている）
- ビジネス時点の区間は必要に応じて分割（row split）して挿入

> ポイント: 「クローズして複製し、必要箇所を分割して差し替える」というチェイン（鎖）のような履歴が形成される。

## 例（SlowBank 口座）

初期: 1/1 開設、残高 100
- 行A: `FROM_Z=1/1, THRU_Z=∞, IN_Z=1/1, OUT_Z=∞`, 値=100

1/20 に 200 入金が確定
- ステップ1: 行A をクローズ（`OUT_Z=1/20`）
- ステップ2: 新しい2行を追加（`IN_Z=1/20`）
  - 行B: `FROM_Z=1/1, THRU_Z=1/20` 値=100
  - 行C: `FROM_Z=1/20, THRU_Z=∞` 値=300 (=100+200)

1/25 に 1/17 の 50 入金が遅れて到着（遡及修正）
- ステップ1: 行B/行C をクローズ（`OUT_Z=1/25`）
- ステップ2: 新しい3行を追加（`IN_Z=1/25`）
  - 行D: `FROM_Z=1/1,  THRU_Z=1/17` 値=100
  - 行E: `FROM_Z=1/17, THRU_Z=1/20` 値=150 (=100+50)
  - 行F: `FROM_Z=1/20, THRU_Z=∞`   値=350 (=100+50+200)

この結果、任意の処理日（例: 1/20時点、1/25時点）から見た断面と、ビジネス時点の正史を両立して照会できる。

## Operation over TSCs との関係

Reladomo のチェイニングは、Segev & Shoshani の“Operations over TSCs”の枠組み（Target/Mapping/Function）でも解釈できる。
- Target: 出力すべき (s, t)（サロゲートs、ビジネス時点t）の点集合。遡及修正時は t 区間を細分化。
- Mapping: その (s, t) に対応する旧行の点集合（processing視点でのバージョン群）。
- Function: 値の算定（例: 残高再計算）と、処理時点境界の更新（`IN_Z/OUT_Z` 付与）。

## 擬似コード（概念）

```
function applyBusinessChange(now /*処理日*/, affectedInterval /*[fromZ, thruZ)*/, recomputeValue) {
  // 1) close old rows at processing time
  for each row in openRowsOverlapping(affectedInterval):
    row.OUT_Z = now

  // 2) insert new rows with splits over business time
  for each sub in splitByBoundaries(affectedInterval, existingBoundaries):
    insert({ FROM_Z: sub.from, THRU_Z: sub.to, IN_Z: now, OUT_Z: ∞, value: recomputeValue(sub) })
}
```

実装では、`openRowsOverlapping` が `FROM_Z/THRU_Z` の半開区間で判定し、`splitByBoundaries` が既存の境界と新たな事実の境界で行を分割する。

## 実務上の注意

- 区間は原則「半開区間 [start, end)」で管理（境界の一貫性）
- `∞` を使って「開いている行」を表現（`OUT_Z=∞` / `THRU_Z=∞`）
- 参照系は `AS OF (IN_Z/OUT_Z)`、正史は `AS OF (FROM_Z/THRU_Z)` の組み合わせで切替
- インデックス: `(surrogate, FROM_Z)` と `(surrogate, IN_Z)` を基本に、問合せ頻度で最適化

---

この要約は Viewer 実装の設計資料として作成しました。元ドキュメントの図やSQL例が必要であれば追記します。

