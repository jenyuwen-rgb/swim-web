#!/bin/bash
# switch-api.sh
# 用來切換前端 API 指向本機或雲端

if [ "$1" = "local" ]; then
  echo "切換到本機 API..."
  cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
EOF
elif [ "$1" = "cloud" ]; then
  echo "切換到雲端 API..."
  cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://swimming-record.onrender.com
EOF
else
  echo "用法: ./switch-api.sh local|cloud"
fi