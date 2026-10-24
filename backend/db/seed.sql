-- 初期データ (frontend/mock/db.seed.json と同じ内容)
-- ユーザーは cognito_sub 未設定で登録しておき、同じメールアドレスの Cognito ユーザーが初回ログインした時に紐付く
-- (Cognito ユーザーの作成方法は README.md を参照)
USE sample_shop;

-- クライアントの文字コード設定に関わらず UTF-8 として読み込ませる
SET NAMES utf8mb4;

INSERT INTO users (id, name, email) VALUES
  (1, '管理者 太郎', 'admin@example.com'),
  (2, '山田 花子', 'user@example.com');

INSERT INTO products (id, name, description, price, stock, category) VALUES
  (1, 'ワイヤレスイヤホン', 'ノイズキャンセリング対応。最大24時間再生。', 12800, 15, '家電'),
  (2, '電気ケトル 1.0L', '温度調節機能付き。コーヒーやお茶に最適。', 6980, 4, '家電'),
  (3, 'はじめてのReact', 'コンポーネント設計から状態管理まで丁寧に解説。', 3080, 30, '書籍'),
  (4, 'TypeScript実践ガイド', '型安全なアプリケーション開発のための一冊。', 3520, 2, '書籍'),
  (5, 'スペシャルティコーヒー豆 200g', 'エチオピア産。華やかな香りと酸味。', 1680, 50, '食品'),
  (6, 'ステンレスマグカップ', '真空断熱で温かさが長持ち。', 2200, 0, '雑貨');

INSERT INTO orders (id, user_id, total, status, created_at) VALUES
  (1, 2, 3080, 'delivered', '2026-10-01 10:15:00.000'),
  (2, 2, 5560, 'pending', '2026-10-20 08:30:00.000');

INSERT INTO order_items (order_id, product_id, name, price, quantity) VALUES
  (1, 3, 'はじめてのReact', 3080, 1),
  (2, 5, 'スペシャルティコーヒー豆 200g', 1680, 2),
  (2, 6, 'ステンレスマグカップ', 2200, 1);
