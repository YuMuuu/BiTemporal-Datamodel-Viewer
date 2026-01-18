# BiTemporal Data Model 概説

- 最終更新: 2026-01-17
- 想定読者: 本リポジトリの「BiTemporal Datemodel Viewer」を設計・実装する開発者

## 要約

- BiTemporal Data Model は「実世界で事実が有効だった期間（valid/application/business time）」と「データベースがその事実をその値として保持していた期間（transaction/system/record time）」の2軸で履歴を管理するモデル。
- 2軸を持つことで、当時のレポート再現（当時DBが知っていた事実）と、後から訂正を反映した“正史”の再計算（実世界の真実）を両立して照会できる。
- SQL:2011 以降、valid（application-time period）と system-versioned（transaction-time）を標準化。多くの主要DBがいずれか/両方を実装している。

## 基本概念と用語

- Valid time（別名: application time, business time）
  - 事実が現実世界で有効だった（または有効になる）期間。
- Transaction time（別名: system time, record time, knowledge time）
  - その値をDBが保持し、問い合わせに対してその通りに応答した期間（監査・証跡）。
- Bitemporal table
  - 上記2軸の期間列（または PERIOD）を持ち、両方の観点で問合せ可能なテーブル。
- 拡張: Decision time
  - 意思決定の根拠としてその値を採用したタイムラインを別軸で管理する拡張（必要な領域でのみ導入）。

### 2軸のイメージ

```
実世界の有効期間（valid）     : |==== 事実A ====)
DBで保持された期間（system）    :   |--- 認識A ---)
視点の切替                      :  レポート再現  vs  正史の再計算
```

## 最小スキーマ設計（概念）

- 代表的な列
  - `valid_from`, `valid_to`（valid/application）
  - `sys_from`, `sys_to`（transaction/system）
- 半開区間 [from, to) を推奨（境界処理を単純化し、連続した期間更新で重複を避けやすい）。
- 期間重複の禁止
  - ベンダによって PERIOD 制約や `WITHOUT OVERLAPS` を持つものがある。未対応DBではトリガや排他ロジックで担保。

### SQL:2011 風のDDL（概念イメージ）

> ベンダ方言により細部が異なるため、実際のDDLは対象DBのマニュアルに従って調整してください。

```sql
CREATE TABLE customer_price (
  customer_id      BIGINT       NOT NULL,
  price            DECIMAL(12,2) NOT NULL,

  -- application/valid time
  valid_from       DATE         NOT NULL,
  valid_to         DATE         NOT NULL,
  PERIOD FOR application_time (valid_from, valid_to),

  -- system/transaction time（自動で設定される列を持つ実装が多い）
  sys_from         TIMESTAMP(6) GENERATED ALWAYS AS ROW START,
  sys_to           TIMESTAMP(6) GENERATED ALWAYS AS ROW END,
  PERIOD FOR system_time (sys_from, sys_to),

  PRIMARY KEY (customer_id, valid_from)
) WITH SYSTEM VERSIONING; -- 対応DBのみ
```

## 代表的なクエリパターン

- 当時DBがどう認識していたか（transaction/system）

```sql
SELECT *
FROM customer_price FOR SYSTEM_TIME AS OF TIMESTAMP '2025-03-01 00:00:00'
WHERE customer_id = 1001;
```

- 実世界のある時点で何が有効だったか（valid/application）

```sql
-- ベンダにより構文は異なる（例: FOR APPLICATION_TIME / FOR BUSINESS_TIME / FOR PORTION OF ...）
SELECT *
FROM customer_price -- FOR APPLICATION_TIME AS OF DATE '2025-03-01'
WHERE customer_id = 1001
  AND valid_from <= DATE '2025-03-01'
  AND DATE '2025-03-01' < valid_to;
```

- 2軸の組合せ（bitemporal）

```sql
-- 例示: 「2025-03-01 時点のDBの認識に基づいて、実世界の 2025-02-01 時点での値を再現」
SELECT *
FROM customer_price FOR SYSTEM_TIME AS OF TIMESTAMP '2025-03-01 00:00:00'
WHERE customer_id = 1001
  AND valid_from <= DATE '2025-02-01'
  AND DATE '2025-02-01' < valid_to;
```

## 主要DBのサポート状況（概要）

- MariaDB
  - `WITH SYSTEM VERSIONING` による system-versioned table。
  - `PERIOD FOR application_time` による application-time（valid）。
  - 両者の組み合わせで bitemporal を構成可能。
- IBM Db2
  - system time（履歴）と business time（valid）をサポート。bitemporal 構成、更新時の自動スプリット等の運用指針あり。
- Oracle Database
  - Flashback（過去時点のデータ閲覧・復元）＋ Temporal Validity（valid）の機能セット。
- SAP HANA
  - system-versioned / application-time / bitemporal をサポート。

> バージョン・エディションで差異があります。実装時は対象DBのバージョンと機能可否を必ず確認してください。

## 設計・運用の実務ヒント

- 期間表現
  - 半開区間 [start, end) を徹底。`end` は常に「非包含」。
  - 「無限大」は `NULL` ではなく、最大日付（例: `9999-12-31`）を使う設計が運用しやすいケースが多い（ベンダのPERIOD仕様と整合させる）。
- 主キー/制約
  - 自然キーに valid 期間を組み合わせた複合キーを検討（同一キーで期間重複を禁止）。
  - ベンダの PERIOD/OVERLAPS 制約が使えない場合、トリガで重複チェック。
- インデックス/パーティショニング
  - よく使う軸（valid vs system）に応じて、`(id, valid_from)` や `(id, sys_from)` などを張り分け。
  - 系列が長期化するテーブルは時間軸でのパーティショニングを検討。
- 更新ポリシー
  - 過去修正（back-dated）の到着や将来効力（future-dated）を許容する前提で、更新時の行分割（row split）を設計。
  - 履歴の物理削除は原則禁止（監査要件）。物理整理はパーティション・アーカイブで行う。

## ユースケース

- 規制・監査（金融、保険、公共）における報告値の再現と証跡の完全化。
- 給与・住所・商品価格など、遡及訂正や将来効力が日常的に発生するマスタ管理。
- データウェアハウス/レポーティングでの「当時のレポート再現」と「正史の再計算」の切替。

## 落とし穴とトレードオフ

- ストレージ・行数の増加（あらゆる変更が新バージョンとして累積）。
- 期間重複やギャップの取り扱い（境界値、タイムゾーン、夏時間の影響）。
- ベンダ方言の差（キーワード、デフォルトの閉区間/半開区間、トリガ動作）。
- クエリの複雑化（最適化・統計・結合戦略に注意）。

## 参考資料（外部リンク）

> 参照日: 2026-01-17（各リンク先の仕様・記述は変更される場合があります）

- Wikipedia: Bitemporal modeling — https://en.wikipedia.org/wiki/Bitemporal_modeling
- Wikipedia: Valid time — https://en.wikipedia.org/wiki/Valid_time
- Wikipedia: SQL:2011 — https://en.wikipedia.org/wiki/SQL%3A2011
- Martin Fowler: Bitemporal History — https://martinfowler.com/articles/bitemporal-history.html
- MariaDB Docs: Bitemporal Tables — https://mariadb.com/docs/server/reference/sql-structure/temporal-tables/bitemporal-tables/
- IBM Db2: Temporal Tables（概説記事など） — 例: https://www.dbta.com/Columns/DBA-Corner/Supporting-Temporal-Data-in-the-Database-80450.aspx
- Oracle Database: Flashback, Temporal Validity — https://docs.oracle.com/
- SAP HANA SQL Ref: CREATE TABLE（period/system versioning） — https://help.sap.com/
- 書籍: Tom Johnston, “Bitemporal Data: Theory and Practice”.

---

## 付録A: 典型操作フロー（概念）

- 新規登録（将来効力の例）
```sql
INSERT INTO customer_price (
  customer_id, price, valid_from, valid_to
) VALUES
  (1001, 120.00, DATE '2026-02-01', DATE '9999-12-31');
```

- 価格改定（valid の締め＋新バージョン挿入）
```sql
-- 旧バージョンを締める
UPDATE customer_price
   SET valid_to = DATE '2026-06-01'
 WHERE customer_id = 1001
   AND valid_from = DATE '2026-02-01'
   AND DATE '2026-06-01' < valid_to;

-- 新バージョンを追加（半開区間）
INSERT INTO customer_price (
  customer_id, price, valid_from, valid_to
) VALUES
  (1001, 135.00, DATE '2026-06-01', DATE '9999-12-31');
```

- 遡及訂正（back-dated）の例
```sql
-- 実世界では 2026-03-15 から 128.00 だったと後日判明
-- system-time は自動で更新履歴が残る（対応DB）
UPDATE customer_price
   SET valid_to = DATE '2026-03-15'
 WHERE customer_id = 1001
   AND valid_from = DATE '2026-02-01'
   AND DATE '2026-03-15' < valid_to;

INSERT INTO customer_price (
  customer_id, price, valid_from, valid_to
) VALUES
  (1001, 128.00, DATE '2026-03-15', DATE '2026-06-01');
```

## 付録B: Viewer要件のたたき台

- 2軸タイムスライサ（valid と system を独立に指定）。
- 断面比較（例: 「提出日2025-03-01時点の見え方」vs「正史」）。
- 行バージョンの時系列タイリング表示（ギャント風）。
- `AS OF`／期間フィルタのSQL生成ヘルパ。
- 重複・ギャップの検知ビュー（期間品質チェック）。

