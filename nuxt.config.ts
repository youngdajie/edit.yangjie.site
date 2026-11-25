import type { Plugin } from 'vite'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * remark / rehype 插件统一以 file:// URL 注册。
 *
 * 编辑器复用博客同一套插件，保证预览与线上渲染逐字一致。
 * 必须 file:// URL 而非裸绝对路径：Windows ESM loader 只认 file://；
 * 裸路径内联进 .nuxt/mdc-imports.mjs 会把 \43 当八进制转义，rollup 直接崩。
 * 下面 vite/nitro 各注入一个 resolveId 把 URL 还原成真实路径。
 */
function pluginPath(path: string) {
	return pathToFileURL(resolve(import.meta.dirname, `remark-plugins/${path}.ts`)).href
}

function fileUrlResolvePlugin(): Plugin {
	return {
		name: 'resolve-file-url-plugins',
		enforce: 'pre',
		resolveId(id) {
			if (id.startsWith('file://'))
				return fileURLToPath(id)
			return null
		},
	}
}

export default defineNuxtConfig({
	app: {
		head: {
			title: 'blog writing@JIE',
			meta: [
				{ name: 'viewport', content: 'width=device-width, initial-scale=1' },
				{ name: 'color-scheme', content: 'light dark' },
			],
			link: [
				// 站点图标：来自 www.yangjie.site 的胡萝卜
				{ rel: 'icon', type: 'image/svg+xml', href: '/carrot.svg' },
				// KaTeX 样式：与博客 nuxt.config.ts 保持同一版本
				{ rel: 'stylesheet', href: 'https://cdn.jsdmirror.com/npm/katex@0.16.47/dist/katex.min.css' },
			],
		},
		rootAttrs: {
			id: 'blog-root',
		},
	},

	compatibilityDate: '2024-08-03',

	components: [
		{ path: '~/components/partial', prefix: 'Z' },
		'~/components',
	],

	// 与博客同款样式，预览即所见即所得
	css: [
		'@/assets/css/animation.css',
		'@/assets/css/article.css',
		'@/assets/css/color.css',
		'@/assets/css/font.css',
		'@/assets/css/main.css',
		'@/assets/css/reusable.css',
		'@/assets/css/editor.css',
	],

	experimental: {
		typescriptPlugin: true,
	},

	// MDC 组件显式登记：编辑器正文是运行时动态解析的，
	// 不能依赖构建期扫描静态 .md 生成的加载器。
	mdc: {
		components: {
			map: {
				'alert': 'Alert',
				'audio-player': 'AudioPlayer',
				'badge': 'Badge',
				'blur': 'Blur',
				'card-list': 'CardList',
				'chat': 'Chat',
				'copy': 'Copy',
				'emoji-clock': 'EmojiClock',
				'folding': 'Folding',
				'key': 'Key',
				'link-banner': 'LinkBanner',
				'link-card': 'LinkCard',
				'md-title': 'MdTitle',
				'mermaid': 'Mermaid',
				'music-score': 'MusicScore',
				'pics': 'Pics',
				'poetry': 'Poetry',
				'prose-a': 'ProseA',
				'prose-code': 'ProseCode',
				'prose-pre': 'ProsePre',
				'prose-table': 'ProseTable',
				'quote': 'Quote',
				'shuoshuo-item': 'ShuoshuoItem',
				'tab': 'Tab',
				'timeline': 'Timeline',
				'tip': 'Tip',
				'video': 'VideoEmbed',
				'video-embed': 'VideoEmbed',
			},
		},
	},

	content: {
		build: {
			markdown: {
				highlight: false,
				remarkPlugins: {
					[pluginPath('remark-audio')]: {},
					[pluginPath('remark-code-component')]: {
						options: {
							'mermaid': { component: 'mermaid', prop: 'code' },
							'music-abc': { component: 'music-score', prop: 'abc' },
						},
					},
					'remark-math': {},
					[pluginPath('remark-shuoshuo')]: {},
				},
				rehypePlugins: {
					[pluginPath('rehype-meta-slots')]: {},
					'rehype-katex': {},
				},
				toc: { depth: 4, searchDepth: 4 },
			},
		},
		experimental: {
			sqliteConnector: 'native',
		},
	},

	postcss: {
		plugins: {
			'postcss-nesting': {},
		},
	},

	vite: {
		plugins: [fileUrlResolvePlugin()],
		build: {
			chunkSizeWarningLimit: 5000,
			reportCompressedSize: false,
		},
		server: {
			allowedHosts: true,
		},
	},

	modules: [
		'@bikariya/modals',
		'@bikariya/shiki',
		'@nuxt/content',
		'@nuxt/icon',
		'@nuxt/image',
		'@nuxtjs/color-mode',
		'@pinia/nuxt',
		'@vueuse/nuxt',
	],

	colorMode: {
		preference: 'system',
		fallback: 'light',
		classSuffix: '',
	},

	nitro: {
		rollupConfig: {
			plugins: [fileUrlResolvePlugin()],
		},
	},

	icon: {
		provider: 'none',
		fallbackToApi: false,
		clientBundle: {
			scan: {
				globInclude: ['**/*.{vue,jsx,tsx,ts,md,mdc,mdx,json}'],
			},
		},
	},

	image: {
		densities: [1, 1.5, 2],
		format: ['avif', 'webp'],
	},

	hooks: {
		'ready': () => {
			console.info(`\n================================\nblog writing@JIE · 写作工作台\n================================\n`)
		},
	},
})
