# Sample Shop (frontend)

React + TypeScript + Vite で作成した、一般ユーザー画面と管理者画面を持つ EC サンプルです。
データはバックエンドの REST API から取得します。開発用に `json-server` のモック API を同梱しています。
ログインは Amazon Cognito ユーザープールで行います (Amplify の `aws-amplify/auth` を使用)。

## 起動

モック API を使う場合もログインには本物の Cognito ユーザープールが必要です。
[backend の README](../backend/README.md#3-cognito-ユーザープールを作成する) の手順でマネジメントコンソールからユーザープールを作り、ユーザーを登録してから `.env` を作成します。

```bash
npm install
cp .env.example .env   # VITE_COGNITO_USER_POOL_ID / VITE_COGNITO_USER_POOL_CLIENT_ID を設定する
npm run dev            # モックAPI (:3001) と Vite (:5173) を同時起動
```

http://localhost:5173 を開き、Cognito に登録したユーザーでログインします。
Cognito の `admin` グループに入っているユーザーが管理者になります。
Cognito の設定がなくても、ログイン不要の商品一覧・詳細は表示できます。

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
認証は `Authorization: Bearer <Cognito の ID トークン>` ヘッダーで行います。

| メソッド | パス | 説明 |
| --- | --- | --- |
| GET | `/me` | ログイン中のユーザー (`role` は Cognito グループから決まる) |
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
  auth/               Cognito の設定 (cognito.ts)・認証コンテキスト・ルートガード
  hooks/useApi.ts     データ取得フック (ローディング/エラー/再取得/中断)
  components/         共通コンポーネント
  layouts/            ユーザー用・管理者用レイアウト
  pages/user/         一般ユーザー画面
  pages/admin/        管理者画面 (遅延読み込み)
```

## 認証の流れ

1. ログイン画面で入力したメールアドレスとパスワードで、Cognito に SRP 認証でサインインする (パスワード自体は送信されない)
2. 管理者が作成したユーザーは、初回ログイン時に新しいパスワードの設定画面が表示される
3. サインインが完了したら `/me` を呼び、ロールを含むユーザー情報を取得する
4. 以降の API 呼び出しでは、リクエストのたびに `fetchAuthSession()` で ID トークンを取得して送る。期限 (1 時間) が切れていれば Amplify がリフレッシュトークンで自動更新する
5. ログアウトでは `signOut()` で端末のトークンを削除する

トークンは Amplify が localStorage に保存するため、リロードしてもログイン状態が続きます。

> 注意: フロントエンドのルートガードは表示の出し分けにすぎません。権限チェックは必ずバックエンドで行ってください。
> モック API はトークンの署名を検証せず、中身を読むだけです (開発用の簡略化)。本番では API Gateway の JWT オーソライザーが検証します。
