# 本地开发与日常使用

## 端口与数据

| 用途 | 端口 | 启动方式 | 数据 |
| --- | --- | --- | --- |
| 日常使用 | 3000 | `pnpm build`，然后 `pnpm preview` | `.data/anti-habit.db` |
| 开发 | 3001 | `pnpm dev` | `.data/anti-habit.dev.db` |

- 两个实例可以同时运行，端口和数据库都分开。
- Nuxt 同一个项目只允许一个 `pnpm dev`。日常实例必须用 `pnpm preview`，不要再开第二个 dev；如果 3000 上还有旧的 dev 进程，先停掉它，再按上面的方式启动。
- `pnpm dev` 不会读取日常数据库；不要用开发实例验证或修改日常数据。
- 日常实例运行的是 `.output` 里的上一次构建。代码改动后，重新 `pnpm build` 再 `pnpm preview`。
- `.data/` 是本地数据，不是演示数据。不要删除、覆盖或重置 `.data/anti-habit.db`，除非用户明确要求并先备份。
- 需要把开发数据带到日常实例时，先停止两个进程，备份后用 `.data/anti-habit.dev.db*` 替换 `.data/anti-habit.db*`。
- 端口被占用时，先停掉占用进程，不要用清空数据的方式解决。
