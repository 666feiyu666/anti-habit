#!/bin/bash
# 启动 Anti-Habit 日常实例：端口 3000，数据 .data/anti-habit.db
# 双击桌面的 Anti-Habit.command，或在终端里运行本脚本。

set -uo pipefail

# 双击 .command 时不会加载 shell 配置，显式补上 Homebrew 的路径
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR" || exit 1

PORT=3000
URL="http://localhost:$PORT"

open_browser() {
  if [ "${NO_OPEN:-0}" != "1" ]; then
    open "$URL"
  fi
}

# 服务已经在跑：只打开浏览器，不重复启动
if curl -fsS -o /dev/null --max-time 2 "$URL/" 2>/dev/null; then
  echo "==> 日常实例已经在运行，打开 $URL"
  open_browser
  sleep 1
  exit 0
fi

# 端口被别的程序占着：说清楚，不擅自结束别人的进程
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "端口 $PORT 已被其他程序占用："
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN
  echo
  echo "先停掉占用该端口的程序，再重新打开本快捷方式。"
  read -r -p "按回车关闭窗口..." _
  exit 1
fi

# 没有构建产物时先构建
if [ ! -f .output/server/index.mjs ]; then
  echo "==> 还没有构建产物，先执行 pnpm build"
  pnpm build || { echo "构建失败。"; read -r -p "按回车关闭窗口..." _; exit 1; }
fi

# 代码比构建产物新时只提醒，不擅自重新构建
if [ -n "$(find app server shared nuxt.config.ts package.json -newer .output/server/index.mjs -print -quit 2>/dev/null)" ]; then
  echo "提示：代码比 .output 里的构建产物新，本次仍运行旧构建。需要时先执行 pnpm build。"
  echo
fi

echo "==> 启动日常实例 $URL （数据：.data/anti-habit.db）"
echo "    关闭这个终端窗口或按 Ctrl+C 即可停止。"
echo

# 等服务就绪后自动打开浏览器
(
  for _ in $(seq 1 120); do
    if curl -fsS -o /dev/null --max-time 2 "$URL/" 2>/dev/null; then
      open_browser
      exit 0
    fi
    sleep 0.5
  done
) &
waiter=$!

trap 'kill "$waiter" 2>/dev/null' EXIT
trap 'exit 130' INT TERM

pnpm preview
