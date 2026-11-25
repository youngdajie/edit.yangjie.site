/**
 * 侧栏组件名。
 *
 * **和 `app/components/widget/` 下的文件名一一对应**，只是写成 kebab-case：
 * `BlogLog.vue` → `blog-log`、`BackTop.vue` → `back-top`。
 *
 * 为什么不在代码里直接写 `BlogLog`：
 * - 侧栏名字在**配置和内容**里出现（`blog.config.ts` 的 `aside`、
 *   文章 front-matter 的 `aside: [toc, blog-log]`），kebab-case 是内容侧
 *   一直沿用的写法，两边保持同一套名字，不必记两种写法；
 * - `app/composables/useWidgets.ts` 的注册表就以这个名字为键，
 *   `Record<AsideName, Component>` 会强制「加了名字就必须注册组件」，
 *   漏注册是类型错误，而不是页面上悄悄少一块。
 *
 * 新增一个侧栏组件：建 `app/components/widget/Xxx.vue` → 把 `xxx` 加到这里 →
 * 在注册表里补一行。
 */
export type AsideName
	= | 'back-top'
		| 'blog-log'
		| 'blog-stats'
		| 'blog-tech'
		| 'contact'
		| 'empty'
		| 'jinrishici'
		| 'toc'
