#!/bin/bash

# 1. Cài đặt và Build Frontend (Game)
echo "--- BUILDING FRONTEND (GAME) ---"
cd frontend
npm install
npm run build
cd ..

# 2. Cài đặt và Build Docs
echo "--- BUILDING DOCS ---"
npm install
npm run docs:build

# 3. Gộp kết quả build vào thư mục dist ở gốc
echo "--- COMBINING BUILD RESULTS ---"
rm -rf dist
mkdir -p dist/docs
cp -r frontend/dist/* dist/
cp -r docs/.vitepress/dist/* dist/docs/

echo "--- DEPLOYMENT READY ---"
