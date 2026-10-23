# Sample Shop (frontend)

React + TypeScript + Vite で作成した、一般ユーザー画面と管理者画面を持つ EC サンプルです。
データはバックエンドの REST API から取得します。開発用に `json-server` のモック API を同梱しています。

## 起動

```bash
npm install
npm run dev        # モックAPI (:3001) と Vite (:5173) を同時起動
```

http://localhost:5173 を開きます。

| ロール | メールアドレス | パスワード |
| --- | --- | --- |
| 一般ユーザー | user@example.com | user123 |
| 管理者 | admin@example.com | admin123 |

モックのデータを初期状態に戻すには `npm run mock:reset` を実行します。

## 画面

| パス | 画面 | 権限 |
| --- | --- | --- |
| `/` | 商品一覧 (キーワード・カテゴリ検索) | 誰でも |
| `/products/:id` | 商品詳細・注文 | 閲覧は誰でも / 注文はログイン |
| `/orders` | 自分の注文履歴 | ログイン |
| `/login` | ログイン | 誰でも |
| `/admin` | ダッシュボード (売上・未発送・在庫わずか) | 管理者 |
| `/admin/products` | 商品の追加・編集・削除 | 管理者 |
| `/admin/orders` | 注文一覧・ステータス変更 | 管理者 |

## 想定している API

ベース URL は環境変数 `VITE_API_BASE_URL` で変更できます (未設定時は `/api`)。
認証は `Authorization: Bearer <token>` ヘッダーで行います。

| メソッド | パス | 説明 |
| --- | --- | --- |
| POST | `/login` | `{ email, password }` → `{ token, user }` |
| GET | `/me` | ログイン中のユーザー |
| GET | `/products?q=&category=` | 商品一覧 |
| GET | `/products/:id` | 商品詳細 |
| POST / PUT / DELETE | `/products[/:id]` | 商品の作成・更新・削除 (管理者) |
| GET | `/orders?status=` | 注文一覧 (一般ユーザーは自分の注文のみ) |
| POST | `/orders` | `{ items: [{ productId, quantity }] }` で注文。金額と在庫はサーバー側で計算 |
| PATCH | `/orders/:id` | `{ status }` でステータス変更 (管理者) |

型定義は [src/types.ts](src/types.ts)、API 呼び出しは [src/api/](src/api/) にまとまっています。
実際のバックエンドに接続する場合は、この 2 か所をバックエンドの仕様に合わせてください。

## ディレクトリ構成

```
mock/                 モックAPIサーバーと初期データ
src/
  api/                fetch ラッパーとエンドポイント定義
  auth/               認証コンテキスト・ルートガード
  hooks/useApi.ts     データ取得フック (ローディング/エラー/再取得/中断)
  components/         共通コンポーネント
  layouts/            ユーザー用・管理者用レイアウト
  pages/user/         一般ユーザー画面
  pages/admin/        管理者画面 (遅延読み込み)
```

> 注意: フロントエンドのルートガードは表示の出し分けにすぎません。権限チェックは必ずバックエンドで行ってください。
> モックのトークンやパスワードの平文保存は開発用の簡略化です。
