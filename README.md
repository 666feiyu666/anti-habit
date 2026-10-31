# Anti-Habit

一个按天记录目标的极简工具。建立一个目标，标记每天完成或未完成；写下的文字会连成一篇随笔，后来的日子可以回应以前的想法。随笔支持 Markdown 写作和导出；导入的 Markdown 会作为这个议题下的写作材料保存，不会改动每日记录。还可以给每个目标设定“连续 xx 天”或“累积 xx 天”，从目标创建当天开始计算。

## 本地运行

需要 Node.js 22 以上和 pnpm。首次先安装依赖：

```bash
pnpm install
```

日常使用：

```bash
pnpm build
pnpm preview
```

打开 http://localhost:3000。数据保存在 `.data/anti-habit.db`。

开发：

```bash
pnpm dev
```

打开 http://localhost:3001。开发使用单独的 `.data/anti-habit.dev.db`，不会碰日常数据。两个实例可以同时运行；日常实例用 `pnpm preview`，不要在两个端口各开一个 `pnpm dev`（Nuxt 同一个项目只允许一个 dev server）。改完代码后重新 `pnpm build` 再 `pnpm preview`。

首次启动会自动创建数据库并完成迁移。备份 `.data` 目录就能保留数据。
