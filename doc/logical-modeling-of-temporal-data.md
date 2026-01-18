# Logical Modeling of Temporal Data（Segev & Shoshani, 1987）要約

- 最終更新: 2026-01-18
- 論文: Logical Modeling of Temporal Data, Arie Segev, Arie Shoshani, SIGMOD Record 16(4), 1987. DOI: 10.1145/38713.38760
- フォーカス: Operations over TSCs（Time Sequence Collections）

## 1. 位置づけ（論文の狙い）

関係/ERなど既存データモデルの制約から離れ、時間データの意味論を上位レベルで定義する“Temporal Data Model (TDM)”を提示する。核は個体ごとの「時系列（TS: Time Sequence）」と、その集合「TSC: Time Sequence Collection」。TSCに対する演算（Operations over TSCs）を、合成しやすい一般枠組みで体系化する。

## 2. 基本概念

- TS（Time Sequence）: 単一サロゲート（実体）に紐づく時間順序付きの値の列。
  - 特性: 値型、時間粒度、ライフスパン、変化様式（step‑wise constant / discrete / continuous など）。
- TSC（Time Sequence Collection）: 同クラスに属するTSの集合。非時間属性（部門など）を併せ持つ。
- 時間点 (t) とサロゲート (s)、および値 (a) で、TS/TSCは概念的に三つ組 (s, t, a) の集合として扱える。

## 3. Operations over TSCs（本論の中核）

あらゆる演算は次の「3部構成」で記述され、入力TSCから1つの出力TSCを生成する。

- Target specification: 出力TSCのどの (s, t) 点を作るかを指定（例: s=従業員, t=各月初 など）。
- Mapping: 各出力点に対応づける入力点（複数可）の集め方（例: その月に入る全ての日次点）。
- Function: 集めた入力点から出力値を作る関数（例: sum/avg/last/補間/ユーザー定義）。

この枠に落とすことで、演算はパイプライン合成が容易になり、性質（粒度/型/連続性）の継承や変換を明示できる。

### 3.1 代表演算（分類）

- Selection（選択）
  - Target: 条件を満たす (s, t) を選ぶ。
  - Mapping: 恒等（その点の値をそのまま参照）。
  - Function: 恒等または属性変換。
  - 用途: 期間/値条件での切り出し、属性フィルタ。

- Restrict（制約）
  - Target: サロゲート集合を別TSCや述語で制約。
  - Mapping: 恒等。
  - Function: 恒等。
  - 用途: 「コミッション>1000の従業員の給与履歴」のような間接絞り込み。

- Aggregation（集約）
  - Target: 時間軸やサロゲートでグルーピング（例: 日次→月次）。
  - Mapping: 各出力点（例: 月初）に入る入力点（例: 当月の日次）を収集。
  - Function: sum/avg/min/max/count 等。結果の粒度や値型が変化する。

- Accumulation（累積）
  - Target: 入力TSの時系列順に同一 (s)・全 t を対象。
  - Mapping: 先行点を巻き込む累積集合。
  - Function: 累積和/累積最大/ランニング統計など。

- Composition（合成）
  - 目的: 複数TSCの列を「時間合わせ」して算術・比較・条件適用を行う。
  - Target: 対応させる (s, t)（必要に応じ補間して整合）。
  - Mapping: 出力時点 t に対応する各入力列の点集合（ステップ保持・線形補間などのポリシー）。
  - Function: 算術（+, −, ×, ÷）/比較/論理/ユーザー定義。
  - 例: 「割引率TS（全サロゲート共通）を価格TSに適用→数量TSと乗算→売上TS」。

- General（一般）
  - Target/Mapping/Function をすべてユーザー定義として束ねる拡張。近傍探索、スムージング、物理量の計算など複雑処理を1演算にカプセル化。

### 3.2 構文の雛形（論文の擬似言語イメージ）

```
OPERATOR <name>
  INTO   <target TSC spec>
  FROM   <source TSCs>
  WHERE  <target specification over (s,t)>
  MAP    <mapping rule over input points>
  APPLY  <function over mapped set>
```

実装系では SQL 等に写像され、`GROUP BY`（Aggregation）、ウィンドウ/ランニング（Accumulation）、結合＋補間（Composition）などに相当する。

## 4. プロパティと補間

- 補間（interpolation）はTS/TSCの性質として宣言し、Composition/Aggregation時に参照する（step‑wise constant がデフォルト想定）。
- 粒度・タイプの変換（例: 日次→月次、連続→離散）を演算ごとに定義し、結果TSCに反映させる。

## 5. リレーショナル環境への写像

- Selection/Restrict は結合・選択の合成で表現可能。
- Aggregation は時間階層の正規化が鍵（カレンダー表や生成列の併用）。
- Accumulation はウィンドウ関数で部分的に表現（ただしTSの意味論管理が別途必要）。
- Composition は“時間合わせ＋補間”が本質で、SQL標準の範囲外（UDF/再帰/専用演算子で補うのが現実的）。

## 6. 本プロジェクト（Viewer）への設計含意

- 操作ノードは「Target / Mapping / Function」を明示したUIで構成し、合成可能なパイプラインとして保存できるようにする。
- 補間ポリシー（step/線形/先勝ちなど）をTSCのプロパティとして保持し、Composition時に参照。
- 代表ノードの最小セット
  - Selection（区間・値フィルタ）
  - Aggregation（例: 日→月、id→グループ）
  - Accumulation（ランニング合計）
  - Composition（時間合わせ＋算術/比較）
  - Restrict（補助条件によるサロゲート絞り込み）
- ノードの出力は常に「TSC」とし、キャンバスや表で可視化できる。

## 7. 参考

- Arie Segev, Arie Shoshani, “Logical Modeling of Temporal Data,” SIGMOD Record 16(4), 1987. DOI: 10.1145/38713.38760.
- 関連: “Temporal Data Management” (VLDB 1986), 先行する TS/演算の定式化。

---

この要約は Viewer 実装のための要点抽出です。より厳密な定義や図表・擬似コードは原論文本文を参照してください。

