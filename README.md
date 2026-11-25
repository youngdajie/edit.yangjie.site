![blog writing@jie](./hero.svg)

**blog writing@jie** — 为博客 [box.yangjie.site](https://box.yangjie.site) 写的专用写作工作台。

线上地址：**https://edit.yangjie.site**

## 项目启发

从 [stellar-writing](https://github.com/SeqCrafter/stellar-writing) 重构而来。原项目为 Hexo Stellar 主题写了 45 个 `{% %}` 标签来模拟主题样式；本项目把整套标签换成博客自己的 Nuxt Content MDC 组件，直接复用博客的 remark/rehype 插件、组件与 CSS —— 预览**不是近似渲染**，就是线上文章页的同一套渲染。

图标来自 [www.yangjie.site](https://www.yangjie.site) 的胡萝卜。

## 有何用

- 左边写 Markdown / MDC，右边实时预览成博客文章的样子
- 一行工具栏插 Markdown 语法，独立组件库插 MDC（`Ctrl+/`）
- frontmatter 表单、文章库（浏览器本地）、导出 `.md` 到 `content/posts/<年>/`
- 深色模式、双向滚动同步，与博客一致的 Shiki / KaTeX / Mermaid 渲染

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

预览依赖 Nitro 的 `parseMarkdown`，部署时按 Nuxt 全栈应用处理（EdgeOne Makers 支持 SSR），不要用 `pnpm generate` 当纯静态站。

## 代码库

- CNB：https://cnb.cool/youngdajie/edit.yangjie.site
- GitHub：https://github.com/youngdajie/edit.yangjie.site

## 协议

[MIT](./LICENSE) © 2026 [youngdajie](https://www.yangjie.site)
