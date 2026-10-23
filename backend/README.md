# Sample Shop (backend)

API Gateway (HTTP API) + Lambda (Node.js 22) + Amazon RDS for MySQL 8.0 で動く、[frontend](../frontend/) 用の REST API です。
エンドポイントと振る舞いは `frontend/mock/server.cjs` (モック) と同じなので、フロントエンドは接続先を変えるだけで動きます。

```
ブラウザ ──HTTPS──▶ API Gateway (ANY /api/{proxy+}) ──▶ Lambda (VPC 内) ──3306/TLS──▶ RDS for MySQL
```

## ディレクトリ構成

```
src/
  index.mjs           Lambda ハンドラ。パスとメソッドで各ルートに振り分ける
  http.mjs            レスポンス生成・HttpError
  db.mjs              mysql2 の接続プール・トランザクション
  auth.mjs            パスワード (scrypt)・トークン (JWT HS256)・認可チェック
  routes/             /login, /me, /products, /orders の実装
db/
  schema.sql          テーブル定義
  seed.sql            初期データ (モックと同じ)
local/server.mjs      ローカル実行用 (HTTP → Lambda イベントに変換)
scripts/package.sh    Lambda にアップロードする zip を作る
template.yaml         AWS SAM テンプレート (Lambda + HTTP API + セキュリティグループ)
```

## ローカルで動かす

Docker の MySQL を使います。

```bash
cd backend
npm install
cp .env.example .env
npm run db:up            # MySQL 起動。初回は db/*.sql が自動で流れる
npm run dev              # http://localhost:3001/api

# 別ターミナルで frontend をモックなしで起動 (Vite が /api を :3001 に転送する)
cd ../frontend && npm run dev:web
```

DB を初期状態に戻すには `npm run db:down && npm run db:up` を実行します。

## AWS にデプロイする

### 1. RDS を作成する

- エンジン: MySQL 8.0、Lambda と同じ VPC のプライベートサブネットに配置 (パブリックアクセスなし)
- 作成後、踏み台 (EC2 や CloudShell の VPC 環境) から SQL を流します

```bash
mysql -h <RDSエンドポイント> -u admin -p < db/schema.sql
mysql -h <RDSエンドポイント> -u admin -p < db/seed.sql
```

- アプリ用のユーザーを作っておくと安全です (マスターユーザーを Lambda に持たせない)

```sql
CREATE USER 'shop_app'@'%' IDENTIFIED BY '<強いパスワード>';
GRANT SELECT, INSERT, UPDATE, DELETE ON sample_shop.* TO 'shop_app'@'%';
```

### 2. Lambda と API Gateway をデプロイする

#### 方法 A: SAM でまとめてデプロイ (おすすめ)

Lambda・API Gateway・セキュリティグループのルールを 1 コマンドで作成・更新できます。
[AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) が必要です (`brew install aws-sam-cli`)。

```bash
npm run deploy:guided    # 初回: パラメータを対話で入力し、samconfig.toml に保存される
npm run deploy           # 2 回目以降: コードを変更したらこれだけ
```

聞かれるパラメータ:

| パラメータ | 内容 |
| --- | --- |
| VpcId / SubnetIds | RDS と同じ VPC と、Lambda を置くプライベートサブネット |
| DbSecurityGroupId | RDS のセキュリティグループ。Lambda からの 3306 を許可するルールが自動で追加される |
| DbHost / DbUser / DbPassword / DbName | RDS の接続情報 |
| JwtSecret | `openssl rand -hex 32` などで生成した 32 文字以上の文字列 |
| AllowedOrigin | フロントエンドのオリジン (CORS)。ローカル確認なら `http://localhost:5173` |

#### 方法 B: zip を作って手動でアップロード

コンソールで Lambda や API Gateway を自分で作る場合は、zip を作ってアップロードします。

```bash
npm run package          # dist/function.zip を作成
```

| 設定 | 値 |
| --- | --- |
| ランタイム / ハンドラ | Node.js 22.x / `src/index.handler` |
| VPC | RDS に到達できるプライベートサブネットとセキュリティグループ |
| 環境変数 | `DB_HOST` `DB_USER` `DB_PASSWORD` `DB_NAME` `JWT_SECRET`、および `NODE_EXTRA_CA_CERTS=/var/runtime/ca-cert.pem` (RDS の TLS 証明書の検証に必要) |
| タイムアウト | 10 秒程度 (既定の 3 秒だとコールドスタート時の DB 接続で失敗しやすい) |
| API Gateway | HTTP API にルート `ANY /api/{proxy+}` を作り、この Lambda に統合 (ペイロード形式 2.0)。CORS でフロントのオリジンと `Content-Type`, `Authorization` ヘッダーを許可 |

コードを更新したら `npm run package` のあと、次のコマンドで差し替えられます。

```bash
aws lambda update-function-code --function-name <関数名> --zip-file fileb://dist/function.zip
```

### 3. フロントエンドを接続する

デプロイ後に表示される `ApiBaseUrl` (方法 B の場合は `https://<API ID>.execute-api.<リージョン>.amazonaws.com/api`) を frontend の `.env` に設定します。

```
VITE_API_BASE_URL=https://xxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/api
```

## API

| メソッド | パス | 権限 | 説明 |
| --- | --- | --- | --- |
| POST | `/api/login` | 誰でも | `{ email, password }` → `{ token, user }` |
| GET | `/api/me` | ログイン | ログイン中のユーザー |
| GET | `/api/products?q=&category=` | 誰でも | 商品一覧 (q は商品名・説明の部分一致) |
| GET | `/api/products/:id` | 誰でも | 商品詳細 |
| POST / PUT / DELETE | `/api/products[/:id]` | 管理者 | 商品の作成・更新・削除 |
| GET | `/api/orders?status=` | ログイン | 管理者は全件、一般ユーザーは自分の注文のみ。新しい順 |
| POST | `/api/orders` | ログイン | `{ items: [{ productId, quantity }] }`。金額・在庫はサーバーで計算し、行ロックで在庫の取り合いを防ぐ |
| PATCH | `/api/orders/:id` | 管理者 | `{ status }` でステータス変更 |

エラー時は `{ "message": "..." }` を返します (400 / 401 / 403 / 404 / 409 / 500)。

## 本番運用に向けて

- **認証情報の管理**: DB パスワードと JWT 秘密鍵は Lambda の環境変数に入れています。より安全にするなら Secrets Manager に置き、起動時に取得してください (VPC 内からは Secrets Manager の VPC エンドポイントが必要)。
- **接続数**: 同時実行が増えると Lambda の数だけ DB 接続が増えます。アクセスが多い場合は RDS Proxy を挟むと安定します (`DB_HOST` をプロキシのエンドポイントに変えるだけで動きます)。
- **トークン**: 有効期限は 8 時間です。ログアウトはフロント側でトークンを破棄するだけなので、即時失効が必要なら失効リストなどを追加してください。
