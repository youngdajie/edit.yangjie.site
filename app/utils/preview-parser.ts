/**
 * 浏览器端预览解析器。
 *
 * 线上是 EdgeOne 静态托管，没有 server 运行时（/api/* 不会被转发），
 * 所以把解析搬到客户端。parseMarkdown 本身来自 @nuxtjs/mdc（纯 JS），
 * 只要把 nuxt.config 里 content.build.markdown 的插件按同一份配置显式传进来，
 * 产出的 AST 就与博客构建时一致。
 *
 * 两个关键点：
 * 1. 必须从 `runtime/parser` 子路径导入 —— runtime 总入口会连带 shiki 等
 *    服务端模块，打进浏览器会报 util.inherits / stream 不存在；
 * 2. 全部走动态导入 —— unified / katex 体积不小，只在首次需要预览时加载。
 *
 * 注意：插件清单必须与 nuxt.config.ts 的 content.build.markdown 保持一致。
 */
import type { MdcParser } from '@nuxtjs/mdc/runtime/parser'

export interface PreviewParseResult {
	body: unknown
	meta: Record<string, unknown>
}

let parserPromise: Promise<MdcParser> | null = null

/** 解析器初始化有 unified/remark 全套依赖，懒加载并只创建一次 */
async function createParser(): Promise<MdcParser> {
	const [
		{ createMarkdownParser },
		{ default: remarkMath },
		{ default: rehypeKatex },
		{ default: remarkAudio },
		{ default: remarkCodeComponent },
		{ default: remarkShuoshuo },
		{ default: rehypeMetaSlots },
	] = await Promise.all([
		import('@nuxtjs/mdc/runtime/parser'),
		import('remark-math'),
		import('rehype-katex'),
		import('~~/remark-plugins/remark-audio'),
		import('~~/remark-plugins/remark-code-component'),
		import('~~/remark-plugins/remark-shuoshuo'),
		import('~~/remark-plugins/rehype-meta-slots'),
	])

	return createMarkdownParser({
		highlight: false,
		toc: { depth: 4, searchDepth: 4 },
		remark: {
			plugins: {
				'remark-audio': { instance: remarkAudio, options: {} },
				'remark-code-component': {
					instance: remarkCodeComponent,
					options: {
						mermaid: { component: 'mermaid', prop: 'code' },
						'music-abc': { component: 'music-score', prop: 'abc' },
					},
				},
				'remark-math': { instance: remarkMath, options: {} },
				'remark-shuoshuo': { instance: remarkShuoshuo, options: {} },
			},
		},
		rehype: {
			plugins: {
				'rehype-meta-slots': { instance: rehypeMetaSlots, options: {} },
				'rehype-katex': { instance: rehypeKatex, options: {} },
			},
		},
	} as never)
}

function getParser(): Promise<MdcParser> {
	parserPromise ||= createParser()
	return parserPromise
}

/** 把 Markdown 源码解析成 minimark AST，交给 <ContentRenderer> 渲染 */
export async function parsePreviewMarkdown(source: string): Promise<PreviewParseResult> {
	if (!source.trim())
		return { body: { type: 'minimark', value: [] }, meta: {} }
	const parser = await getParser()
	const parsed = await parser(source)
	return { body: parsed.body, meta: parsed.data ?? {} }
}
