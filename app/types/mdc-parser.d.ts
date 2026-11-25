/**
 * @nuxtjs/mdc 的 package exports 把 ./runtime/* 映射到 dist/runtime/*.d.ts，
 * 但 parser 是目录（dist/runtime/parser/index.js），类型解析不到，这里补一个声明。
 * 只声明我们在浏览器端用到的部分。
 */
declare module '@nuxtjs/mdc/runtime/parser' {
	export interface MdcParseResult {
		body: unknown
		data?: Record<string, unknown>
		toc?: unknown
	}
	export type MdcParser = (markdown: string) => Promise<MdcParseResult>
	export function createMarkdownParser(options?: Record<string, unknown>): Promise<MdcParser>
}
