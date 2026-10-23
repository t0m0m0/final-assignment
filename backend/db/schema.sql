-- Sample Shop のテーブル定義 (MySQL 8.0 / Amazon RDS for MySQL)
-- 日時はすべて UTC で保存する

-- クライアントの文字コード設定に関わらず UTF-8 として読み込ませる
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS sample_shop CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE sample_shop;

CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL, -- "<salt hex>:<scrypt hash hex>"
  role          ENUM('user', 'admin') NOT NULL DEFAULT 'user'
);

CREATE TABLE products (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  price       INT UNSIGNED NOT NULL,
  stock       INT UNSIGNED NOT NULL,
  category    VARCHAR(20) NOT NULL,
  INDEX idx_products_category (category)
);

CREATE TABLE orders (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  total      INT UNSIGNED NOT NULL,
  status     ENUM('pending', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at DATETIME(3) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users (id),
  INDEX idx_orders_user (user_id, created_at),
  INDEX idx_orders_status (status, created_at)
);

-- 商品名・単価は注文時点の値を保存する (後で商品が編集・削除されても注文履歴は変わらない)
-- そのため product_id には外部キーを張らない
CREATE TABLE order_items (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id   INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  name       VARCHAR(200) NOT NULL,
  price      INT UNSIGNED NOT NULL,
  quantity   INT UNSIGNED NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
);
