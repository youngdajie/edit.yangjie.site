/**
 * 把编辑器里的 Markdown 源码解析成 Nuxt Content 的 AST。
 *
 * 关键：parseMarkdown 是 Nitro/server 侧能力，会套用 nuxt.config.ts 里
 * 注册的全部 remark/rehype 插件（remark-math、mermaid、music-abc、audio、
 * meta-slots、katex），所以这里产出的 AST 与博客构建文章时完全一致。
 * 浏览器拿到 AST 后交给 <ContentRenderer> 渲染即所见即所得。
 */
export default defineEventHandler(async (event) => {
	const body = await readBody(event)
	const source = typeof body?.source === 'string' ? body.source : ''

	if (!source.trim())
		return { body: { type: 'minimark', value: [] }, meta: {} }

	try {
		const parsed = await parseMarkdown(source)
		return {
			body: parsed.body,
			// MDCParserResult 未声明 meta，运行时确实可能带；安全读取
			meta: (parsed as typeof parsed & { meta?: Record<string, unknown> }).meta ?? {},
		}
	}
	catch (error) {
		throw createError({
			statusCode: 422,
			statusMessage: 'Markdown 解析失败',
			data: error instanceof Error ? error.message : String(error),
		})
	}
})
