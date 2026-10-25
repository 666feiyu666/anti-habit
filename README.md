# Anti-Habit

一个按天记录目标的极简工具。建立一个目标，标记每天完成或未完成；写下的文字会连成一篇随笔，后来的日子可以回应以前的想法。随笔支持 Markdown 写作、导入和导出。

## 本地运行

需要 Node.js 22 以上和 pnpm。

```bash
pnpm install
pnpm dev
```

打开 http://localhost:3000。

想在本地长期使用，可以构建后启动：

```bash
pnpm build
pnpm preview
```

## 数据

记录保存在 `.data/anti-habit.db`。首次启动会自动创建数据库并完成迁移；备份这个文件就能保留数据。
