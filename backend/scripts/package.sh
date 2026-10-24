#!/bin/sh
# Lambda にアップロードする zip (dist/function.zip) を作る。
# マネジメントコンソールの「アップロード元 → .zip ファイル」や aws lambda update-function-code で使う。
set -eu
cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist/build
cp -R src package.json package-lock.json dist/build/
# 本番に必要な依存だけを入れる。Lambda (arm64 / x86_64) どちらでも動く純 JS のライブラリのみ
(cd dist/build && npm ci --omit=dev --silent)
(cd dist/build && zip -qr ../function.zip .)
rm -rf dist/build

echo "作成しました: dist/function.zip ($(du -h dist/function.zip | cut -f1))"
echo "ハンドラ: src/index.handler / ランタイム: Node.js 22.x"
