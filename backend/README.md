# Sample Shop (backend)

API Gateway (HTTP API) + Lambda (Node.js 22) + Amazon RDS for MySQL 8.0 で動く、[frontend](../frontend/) 用の REST API です。
認証・認可は Amazon Cognito ユーザープールで行います。
エンドポイントと振る舞いは `frontend/mock/server.cjs` (モック) と同じなので、フロントエンドは接続先を変えるだけで動きます。

```
ブラウザ ──SRP 認証──▶ Cognito ユーザープール (ID トークンを発行)
   │
   └──HTTPS + Bearer <ID トークン>──▶ API Gateway (JWT オーソライザーで検証) ──▶ Lambda (VPC 内) ──3306/TLS──▶ RDS for MySQL
```

### 認証・認可の仕組み

| 項目 | 担当 |
| --- | --- |
| ログイン・パスワード管理・トークン発行 | Cognito (フロントエンドが Amplify で直接やり取りする。API に `/login` はない) |
| トークンの検証 (署名・有効期限・発行元・aud) | API Gateway の JWT オーソライザー。失敗すると Lambda を呼ばずに 401 |
| ロール | Cognito グループ。`admin` グループに入っていれば管理者、それ以外は一般ユーザー |
| 権限チェック | Lambda (`requireUser` / `requireAdmin`)。オーソライザーが渡すクレームを使う |

- Lambda は VPC 内にあり Cognito の公開鍵 (JWKS) を取得できないため、トークンの署名検証はオーソライザーに任せています。ルートにオーソライザーを付け忘れると、そのルートは全リクエストが未ログイン扱い (401) になります。
- 名前・メールアドレスを使うため、API には **ID トークン** を送ります (アクセストークンは `token_use` で拒否します)。
- `users` テーブルは注文から参照するためのプロフィールの写しです。初回ログイン時に Cognito の `sub` で自動作成され、名前・メールアドレスはログインのたびに Cognito の値で更新されます。`cognito_sub` が未設定の行 (シードや移行データ) は、確認済みのメールアドレスが一致する Cognito ユーザーに初回ログイン時に紐付きます。
- グループの変更は、次にトークンが発行された時 (再ログインか、1 時間ごとの自動更新) から反映されます。

## ディレクトリ構成

```
src/
  index.mjs           Lambda ハンドラ。パスとメソッドで各ルートに振り分ける
  http.mjs            レスポンス生成・HttpError
  db.mjs              mysql2 の接続プール・トランザクション
  auth.mjs            オーソライザーのクレームからユーザーを特定・認可チェック
  routes/             /me, /products, /orders の実装
db/
  schema.sql          テーブル定義
  seed.sql            初期データ (モックと同じ)
local/server.mjs      ローカル実行用 (JWT オーソライザーを再現し、HTTP → Lambda イベントに変換)
scripts/package.sh    Lambda にアップロードする zip を作る
```

## ローカルで動かす

Docker の MySQL を使います。トークンの検証には本物の Cognito ユーザープールが必要なので、
先に [3. Cognito ユーザープールを作成する](#3-cognito-ユーザープールを作成する) の手順でユーザープールを作り、ユーザーを登録しておいてください。

```bash
cd backend
npm install
cp .env.example .env     # COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID を設定する
npm run db:up            # MySQL 起動。初回は db/*.sql が自動で流れる
npm run dev              # http://localhost:3001/api

# 別ターミナルで frontend をモックなしで起動 (Vite が /api を :3001 に転送する)
cd ../frontend && npm run dev:web
```

DB を初期状態に戻すには `npm run db:down && npm run db:up` を実行します。

`local/server.mjs` は API Gateway の JWT オーソライザーと同じように、`GET /api/products[/:id]` 以外のリクエストでトークンを検証し、
検証済みのクレームを `requestContext.authorizer.jwt.claims` に入れて Lambda ハンドラを呼びます。

> 既存の DB (`password_hash` / `role` 列がある旧スキーマ) は `npm run db:down && npm run db:up` で作り直してください。

## AWS にデプロイする (マネジメントコンソール)

すべてのリソースをマネジメントコンソールから手で作ります。リージョンはすべて同じにしてください (以下の例は東京 `ap-northeast-1`)。

| 順番 | リソース | 主な設定 |
| --- | --- | --- |
| 1 | VPC・サブネット・セキュリティグループ | Lambda 用 SG と RDS 用 SG。RDS 用は Lambda 用 SG からの 3306 だけを許可 |
| 2 | RDS for MySQL | プライベートサブネット、パブリックアクセスなし |
| 3 | Cognito ユーザープール | SPA 用アプリクライアント、`admin` グループ、ユーザー |
| 4 | Lambda | zip をアップロード。VPC 内に配置し、DB の接続情報を環境変数で渡す |
| 5 | API Gateway (HTTP API) | ルート 3 つ、JWT オーソライザー、CORS |
| 6 | フロントエンドの `.env` | API の URL と Cognito の ID |

作業中に控えておく値:

| 値 | 控える手順 | 使う手順 |
| --- | --- | --- |
| RDS のエンドポイント・アプリ用 DB ユーザーのパスワード | 2 | 4 (Lambda の環境変数) |
| ユーザープール ID (`ap-northeast-1_XXXXXXXXX`) | 3 | 5 (オーソライザー)、6、ローカル実行用の `.env` |
| アプリクライアント ID | 3 | 5 (オーソライザー)、6、ローカル実行用の `.env` |
| API の URL (`https://xxxxxxxx.execute-api.ap-northeast-1.amazonaws.com`) | 5 | 6 |

### 1. VPC とセキュリティグループを作成する

**VPC** (既存の VPC を使ってもかまいません)

- 「VPC など」で作成すると、サブネットやルートテーブルもまとめて作れます。
- アベイラビリティーゾーン 2 つ、プライベートサブネット 2 つ以上 (RDS のサブネットグループは 2 つ以上の AZ が必要です)。
- **NAT ゲートウェイは不要** です。Lambda がインターネットに出る必要はありません。トークンは API Gateway が検証するため、Lambda から Cognito を呼ぶことはありません。NAT ゲートウェイは時間単位で課金されます。

**セキュリティグループ** (EC2 コンソール → セキュリティグループ) を 2 つ作ります。

| 名前 (例) | インバウンド | アウトバウンド |
| --- | --- | --- |
| `sample-shop-lambda` | なし | すべて (既定のまま) |
| `sample-shop-rds` | MySQL/Aurora (TCP 3306)、ソース = `sample-shop-lambda` の SG ID | 既定のまま |

ソースに IP アドレスではなく SG を指定すると、「その SG が付いたものからだけ」接続を受け付けます。

### 2. RDS を作成する

1. RDS コンソール → **サブネットグループ** → 手順 1 のプライベートサブネットを指定して作成
2. **データベースの作成**

| 設定 | 値 |
| --- | --- |
| エンジン | MySQL 8.0 |
| テンプレート | 無料利用枠 (学習用) |
| マスターユーザー名 | `admin` など。パスワードは控える |
| VPC / サブネットグループ | 手順 1 の VPC と、上で作ったサブネットグループ |
| パブリックアクセス | なし |
| セキュリティグループ | `sample-shop-rds` (default は外す) |

3. 作成後、テーブルと初期データを流します。RDS はインターネットから届かないので、**CloudShell の VPC 環境** を使います。
   - CloudShell → 「アクション」→「VPC 環境を作成」で、手順 1 の VPC・プライベートサブネットと、新しく作ったセキュリティグループ (例 `sample-shop-cloudshell`) を指定する
   - `sample-shop-rds` のインバウンドに「3306、ソース = `sample-shop-cloudshell`」を追加する (作業が終わったら削除する)
   - 「アクション」→「ファイルのアップロード」で `db/schema.sql` と `db/seed.sql` をアップロードし、次を実行する

```bash
sudo dnf install -y mariadb105    # mysql クライアント
mysql -h <RDSエンドポイント> -u admin -p < schema.sql
mysql -h <RDSエンドポイント> -u admin -p < seed.sql
```

4. Lambda 用のアプリユーザーを作ります (マスターユーザーを Lambda に持たせないため)。

```sql
-- mysql -h <RDSエンドポイント> -u admin -p で接続して実行
CREATE USER 'shop_app'@'%' IDENTIFIED BY '<強いパスワード>';
GRANT SELECT, INSERT, UPDATE, DELETE ON sample_shop.* TO 'shop_app'@'%';
```

### 3. Cognito ユーザープールを作成する

Cognito のコンソールで「ユーザープールを作成」を選び、次の設定で作成します。

| 設定 | 値 | 理由 |
| --- | --- | --- |
| アプリケーションタイプ | シングルページアプリケーション (SPA) | ブラウザに秘密を置けないため、クライアントシークレットなしのアプリクライアントが作られる |
| サインイン識別子 | メールアドレス | ログイン画面はメールアドレスとパスワードで入力する |
| 自己登録 (セルフサインアップ) | 無効 | サインアップ画面はないので、ユーザーは管理者が作成する |
| 必須属性 | `email` (`name` は任意) | `name` があると注文一覧などにその名前が表示される (ないときはメールアドレス) |

作成後、次の項目を確認・設定します。

1. **アプリクライアント** → 作成されたクライアント → 「認証フロー」で `ALLOW_USER_SRP_AUTH` と `ALLOW_REFRESH_TOKEN_AUTH` が有効になっていること (フロントエンドの Amplify は SRP 認証を使う)。
   ほかのフロー (`ALLOW_USER_PASSWORD_AUTH` など) は使わないので無効にしておくと安全です。
   「クライアントシークレット」がないことと、「ユーザー存在エラーの防止」が有効なことも確認します。
2. **グループ** → グループ名 `admin` で作成 (src/auth.mjs の `ADMIN_GROUP`)。
3. **ユーザー** → 「ユーザーを作成」。メールアドレスを「検証済み」にし、仮パスワードを設定します。
   - 作成後、ユーザーの詳細で属性 `name` (例: 山田 花子) を追加できます。
   - 管理者にするユーザーは、詳細画面からグループ `admin` に追加します。
   - 仮パスワードで初回ログインすると、アプリに新しいパスワードの設定画面が表示されます。

シードの `user@example.com` / `admin@example.com` と同じメールアドレスで作ると、初回ログイン時にシードの注文履歴と紐付きます。

**ユーザープール ID** (概要に表示) と **クライアント ID** (アプリクライアントに表示) を控えます。

### 4. Lambda を作成する

1. 手元で zip を作ります。

```bash
npm run package          # dist/function.zip を作成
```

2. Lambda コンソール → **関数の作成** (一から作成)

| 設定 | 値 |
| --- | --- |
| ランタイム | Node.js 22.x |
| アーキテクチャ | arm64 (x86_64 でも動きます) |
| 実行ロール | 基本的な Lambda アクセス権限で新しいロールを作成 |
| 詳細設定 → VPC を有効化 | 手順 1 の VPC・プライベートサブネット・`sample-shop-lambda` SG |

VPC を有効にすると、ネットワークインターフェイスを作るための権限 (`AWSLambdaVPCAccessExecutionRole` 相当) が実行ロールに必要です。作成後に IAM で実行ロールを開き、付いていなければ追加してください。

3. 作成後の設定

| 場所 | 設定 |
| --- | --- |
| コード → アップロード元 | `.zip ファイル` で `dist/function.zip` |
| コード → ランタイム設定 → ハンドラ | `src/index.handler` (既定の `index.handler` から変更する) |
| 設定 → 一般設定 | メモリ 512 MB、タイムアウト 10 秒 (既定の 3 秒だとコールドスタート時の DB 接続で失敗しやすい) |
| 設定 → 環境変数 | 下の表 |

| 環境変数 | 値 |
| --- | --- |
| `DB_HOST` | RDS のエンドポイント |
| `DB_USER` / `DB_PASSWORD` | `shop_app` と、そのパスワード |
| `DB_NAME` | `sample_shop` |
| `NODE_EXTRA_CA_CERTS` | `/var/runtime/ca-cert.pem` (Node.js 20 以降のランタイムは RDS の CA 証明書を既定で読み込まないため) |

Cognito の ID は Lambda には不要です。

4. **テスト** タブで次のイベントを実行し、商品一覧が返れば DB まで届いています。

```json
{
  "rawPath": "/api/products",
  "requestContext": { "http": { "method": "GET" } }
}
```

タイムアウトする場合は、セキュリティグループ (`sample-shop-rds` のインバウンド) とサブネットを見直してください。

### 5. API Gateway (HTTP API) を作成する

1. API Gateway コンソール → **HTTP API** の「構築」
   - 統合: Lambda → 手順 4 の関数 (ペイロード形式は 2.0)
   - ルートはここでは作らず、次の手順で作ります
   - ステージ: `$default` (自動デプロイ有効)
2. **ルート** を 3 つ作り、すべて手順 4 の Lambda に統合します。

| ルート | オーソライザー | 用途 |
| --- | --- | --- |
| `ANY /api/{proxy+}` | Cognito (下で作成) | ログインが必要な API すべて |
| `GET /api/products` | なし | 商品一覧 (誰でも) |
| `GET /api/products/{id}` | なし | 商品詳細 (誰でも) |

HTTP API はより具体的なルートを優先するので、`GET /api/products` は `ANY /api/{proxy+}` より先に一致し、オーソライザーを通りません。

3. **認可** → オーソライザーを作成し、`ANY /api/{proxy+}` に **だけ** アタッチします。

| 設定 | 値 |
| --- | --- |
| タイプ | JWT |
| 名前 | `cognito` など |
| ID ソース | `$request.header.Authorization` |
| 発行者 URL | `https://cognito-idp.ap-northeast-1.amazonaws.com/<ユーザープール ID>` |
| 対象者 | アプリクライアント ID |

トークンの署名・有効期限・発行者・対象者 (`aud`) を API Gateway が確認し、通ったリクエストだけ Lambda が呼ばれます (失敗すると `{"message":"Unauthorized"}` の 401)。

4. **CORS**

| 設定 | 値 |
| --- | --- |
| Access-Control-Allow-Origin | フロントエンドのオリジン (ローカル確認なら `http://localhost:5173`) |
| Access-Control-Allow-Headers | `content-type`, `authorization` |
| Access-Control-Allow-Methods | `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS` |
| Access-Control-Max-Age | `600` |

CORS を設定すると、ブラウザのプリフライト (`OPTIONS`) には API Gateway が直接応答します。オーソライザーも Lambda も通らないので、`ANY` ルートにオーソライザーを付けてもプリフライトは失敗しません。

5. 動作確認 (API の URL は API の詳細画面の「URL を呼び出す」)

```bash
curl https://xxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/api/products   # 200 と商品一覧
curl https://xxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/api/me         # 401 {"message":"Unauthorized"}
```

### 6. フロントエンドを接続する

frontend の `.env` に設定します。`VITE_API_BASE_URL` は API の URL の末尾に `/api` を付けたものです。

```
VITE_API_BASE_URL=https://xxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/api
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_XXXXXXXXX
VITE_COGNITO_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

### コードを更新したとき

`npm run package` で zip を作り直し、Lambda コンソールの「アップロード元 → .zip ファイル」でアップロードします。CLI なら次のコマンドでも差し替えられます。

```bash
aws lambda update-function-code --function-name <関数名> --zip-file fileb://dist/function.zip
```

### 片付け

RDS と (作った場合は) NAT ゲートウェイは、使っていなくても課金されます。不要になったら次の順に削除します。

1. API Gateway の API
2. Lambda 関数 (VPC のネットワークインターフェイスが消えるまで数十分かかることがあります)
3. RDS インスタンス → サブネットグループ
4. CloudShell の VPC 環境 → セキュリティグループ (`sample-shop-*`)
5. Cognito ユーザープール
6. VPC (新しく作った場合)

## API

| メソッド | パス | 権限 | 説明 |
| --- | --- | --- | --- |
| GET | `/api/me` | ログイン | ログイン中のユーザー `{ id, name, email, role }` (role は Cognito グループから決まる) |
| GET | `/api/products?q=&category=` | 誰でも | 商品一覧 (q は商品名・説明の部分一致) |
| GET | `/api/products/:id` | 誰でも | 商品詳細 |
| POST / PUT / DELETE | `/api/products[/:id]` | 管理者 | 商品の作成・更新・削除 |
| GET | `/api/orders?status=` | ログイン | 管理者は全件、一般ユーザーは自分の注文のみ。新しい順 |
| POST | `/api/orders` | ログイン | `{ items: [{ productId, quantity }] }`。金額・在庫はサーバーで計算し、行ロックで在庫の取り合いを防ぐ |
| PATCH | `/api/orders/:id` | 管理者 | `{ status }` でステータス変更 |

「ログイン」の API には `Authorization: Bearer <Cognito の ID トークン>` が必要です。
エラー時は `{ "message": "..." }` を返します (400 / 401 / 403 / 404 / 409 / 500)。トークンが無効な場合はオーソライザーが `{ "message": "Unauthorized" }` (401) を返します。

## 本番運用に向けて

- **認証情報の管理**: DB パスワードは Lambda の環境変数に入れています。より安全にするなら Secrets Manager に置き、起動時に取得してください (VPC 内からは Secrets Manager の VPC エンドポイントが必要)。
- **接続数**: 同時実行が増えると Lambda の数だけ DB 接続が増えます。アクセスが多い場合は RDS Proxy を挟むと安定します (`DB_HOST` をプロキシのエンドポイントに変えるだけで動きます)。
- **トークン**: ID トークンの有効期限は既定で 1 時間、リフレッシュトークンは 30 日です (アプリクライアントの設定で変更できます)。ログアウトしてもすでに発行された ID トークンは期限まで API Gateway で有効なので、即時失効が必要なら有効期限を短くするか、Lambda で失効リストを確認してください。
- **Cognito のセキュリティ機能**: MFA や、漏えいしたパスワード・不審なサインインの検知 (脅威保護、Plus プラン) はユーザープールの設定で有効にできます。
