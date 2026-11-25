import blogConfig from '~~/blog.config'

/**
 * 编辑器应用层配置。
 *
 * 摊入 blog.config 是为了让复用的 MDC 组件（getCategoryIcon、codeblock、
 * alert 等）读到的值与博客完全一致；编辑器自身不消费导航/页脚等博客配置。
 */
export default defineAppConfig({
	...blogConfig,

	component: {
		alert: {
			defaultStyle: 'card' as 'card' | 'flat',
		},
		codeblock: {
			triggerRows: 32,
			collapsedRows: 16,
			enableIndentGuide: true,
			indent: 4,
			tabSize: 3,
		},
		excerpt: {
			animation: true,
			caret: '_',
		},
	},
})
