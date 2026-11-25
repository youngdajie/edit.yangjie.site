![blog writing@JIE](./hero.svg)

**blog writing@JIE** — 为博客 [box.yangjie.site](https://box.yangjie.site) 写的专用写作工作台。

线上地址：**https://edit.yangjie.site**

## 项目启发

从 [stellar-writing](https://github.com/SeqCrafter/stellar-writing) 重构而来。原项目为 Hexo Stellar 主题写了 45 个 `{% %}` 标签来模拟主题样式；本项目把整套标签换成博客自己的 Nuxt Content MDC 组件，直接复用博客的 remark/rehype 插件、组件与 CSS —— 预览**不是近似渲染**，就是线上文章页的同一套渲染。

图标来自 [www.yangjie.site](https://www.yangjie.site) 的胡萝卜。

## 有何用

- 左边写 Markdown / MDC，右边实时预览成博客文章的样子
- 一行工具栏插 Markdown 语法，独立组件库插 MDC（`Ctrl+/`）
- frontmatter 表单、文章库（浏览器本地）、导出 `.md` 到 `content/posts/<年>/`
- 深色模式、双向滚动同步、可拖拽分栏、移动端适配，与博客一致的 Shiki / KaTeX / Mermaid 渲染
- **自动保存到浏览器 localStorage**（状态栏显示保存状态与用量），不上传云端 —— 请勿清除本站缓存，写完及时导出 `.md`

## 开发

Node `^22.19 || ^24.11 || >=26`，pnpm `>=10`。

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

## 构建

```bash
pnpm typecheck
pnpm build      # 产物 .output（Nitro Node server）
```

预览在**浏览器里**用 `@nuxtjs/mdc` 解析（见 `app/utils/preview-parser.ts`），不依赖 server 运行时。早期版本走 `/api/preview`，但 EdgeOne Makers 对含 `@nuxt/content` 的项目会强制静态化（构建日志里的 `No server-handler detected`），API 不会转发，所以解析必须留在客户端。新增 MDC 插件时，`nuxt.config.ts` 与 `preview-parser.ts` 两处要保持一致。

`edgeone.json` 里的 `nodeVersion` 必须 ≥ 22.19（平台预装的 `22.21.1` / `24.11.0` 都可用）。低于 22.12 时 pnpm 会跳过 rolldown 的平台原生绑定，安装阶段直接报 `Cannot find native binding` 导致构建失败。

## 代码库

- CNB：https://cnb.cool/youngdajie/edit.yangjie.site
- GitHub：https://github.com/youngdajie/edit.yangjie.site

## 协议

[MIT](./LICENSE) © 2026 [youngdajie](https://www.yangjie.site)
