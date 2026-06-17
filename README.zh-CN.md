# AgentRadar 中文文档

中文主文档现在默认展示在仓库首页：

- [打开中文版 README](./README.md)
- [Open English README](./README.en.md)

如果你是从旧链接进入这里，之后直接使用首页的 [README.md](./README.md) 即可。

```

Before deploying a UI or report-rendering fix, rehearse the production artifact locally instead of using the `tsx` dev server. This catches issues that only appear after `dist/` is built:

```bash
corepack pnpm build
corepack pnpm check:mojibake
VISUAL_CONSOLE_PORT=3210 corepack pnpm start:prod:web
```

Then open the target route on `http://127.0.0.1:3210` and verify the built page payload. `corepack pnpm visual-console:web` is useful for development, but it does not simulate the production `node dist/app/server.js` entrypoint.