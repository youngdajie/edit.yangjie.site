import type { BundledLanguage, CodeToHastOptions, HighlighterCore, ShikiTransformer } from 'shiki'
import { transformerColorizedBrackets } from '@shikijs/colorized-brackets'
import { transformerNotationDiff, transformerNotationErrorLevel, transformerNotationFocus, transformerNotationHighlight, transformerNotationWordHighlight, transformerRenderIndentGuides, transformerRenderWhitespace } from '@shikijs/transformers'

type TransformerOptions = Array<
	| 'ignoreColorizedBrackets'
	| 'ignoreRenderWhitespace'
	| 'ignoreRenderIndentGuides'
>
type ShikiOptions = CodeToHastOptions<BundledLanguage, string>

const plainTextLanguages = new Set(['ansi', 'log', 'text'])

interface ShikiCodeOptions {
	language: string
	transformerOptions?: TransformerOptions
	shikiOptions?: Omit<ShikiOptions, 'lang'>
}

type ShikiHtmlOptions = ShikiCodeOptions & {
	embeddedLanguages?: boolean
}

function getEmbeddedMarkdownLanguages(code: string, language: string) {
	if (language !== 'markdown' && !language.startsWith('md'))
		return []

	// 处理 Markdown 高亮内代码块中的语言
	// 加载 TeX 语言有概率导致 LaTeX 语言高亮炸掉
	const mdLangRegex = /^\s*`{3,}(\S+)/gm
	return [...new Set(
		Array
			.from(code.matchAll(mdLangRegex), match => match[1])
			.filter(lang => lang !== undefined),
	)]
}

function transformerUnwrap(): ShikiTransformer {
	return {
		root: (hast) => {
			const lines = (hast.children[0] as any).children[0].children

			return {
				type: 'root',
				children: lines,
			}
		},
		line(node, line) {
			node.properties['data-line'] = line
		},
	}
}

function getTransformers(options: ShikiCodeOptions): ShikiTransformer[] {
	const ignored = new Set(options.transformerOptions)
	const inline = options.shikiOptions?.structure === 'inline'
	const ignoreInvisibleChars = inline || plainTextLanguages.has(options.language)

	return [
		transformerNotationDiff(),
		transformerNotationHighlight(),
		transformerNotationWordHighlight(),
		transformerNotationFocus(),
		transformerNotationErrorLevel(),
		ignored.has('ignoreRenderIndentGuides') || ignoreInvisibleChars ? {} : transformerRenderIndentGuides(),
		ignored.has('ignoreRenderWhitespace') || ignoreInvisibleChars ? {} : transformerRenderWhitespace(),
		ignored.has('ignoreColorizedBrackets') ? {} : transformerColorizedBrackets(),
		inline ? {} : transformerUnwrap(),
	]
}

/**
 * 正在加载 / 已加载的语言，模块级共享。
 *
 * 存的是 **Promise** 而不是「加载过的标记」—— 这一点很关键。
 *
 * 原先存 `Set<string>`：第一个代码块把语言名塞进去、开始 `await`，
 * 第二个同语言的代码块看到名字已在 Set 里就**立刻返回**，
 * 可那时语言还没装好，`getOptions()` 拿 `getLoadedLanguages()` 一查没有，
 * 就回退成 `text` —— 于是**一篇多代码块的文章里，只有第一个着色，其余全是纯文本**
 * （示例文 17 个 `mdc` 块只有 2 个上色，就是这么来的）。
 *
 * 改成存 Promise 之后，后来者 await 的是同一个加载任务，装完再一起高亮。
 * 失败时从表里删掉，允许下一次重试。
 */
const langLoads = new Map<string, Promise<unknown>>()

export default function useShiki() {
	const shikiStore = useShikiStore()
	let shiki: HighlighterCore

	async function loadLang(...langs: string[]) {
		// 高亮器已经装上的语言不必再问一遍（重新进页面时 store 可能已被复用过）
		const loaded = shiki?.getLoadedLanguages?.() ?? []
		const missing = langs.filter(lang => lang && !loaded.includes(lang))
		if (!missing.length)
			return

		await Promise.all(missing.map((lang) => {
			let loading = langLoads.get(lang)
			if (!loading) {
				loading = shikiStore.loadLang(lang).catch((error) => {
					// 加载失败要允许下次重试，否则该语言会永远被跳过
					langLoads.delete(lang)
					throw error
				})
				langLoads.set(lang, loading)
			}
			return loading
		}))
	}

	function getOptions(options: ShikiCodeOptions): ShikiOptions {
		// Shiki 未收录的语言会在高亮时抛错，回退为纯文本
		// ansi 是内置特殊语言，不在已加载语法列表中
		const language = options.language === 'ansi' || shiki.getLoadedLanguages().includes(options.language) ? options.language : 'text'

		return {
			...shikiStore.options,
			lang: language,
			transformers: getTransformers({ ...options, language }),
			...options.shikiOptions,
		}
	}

	async function codeToHtml(code: string, language: string): Promise<string>
	async function codeToHtml(code: string, options: ShikiHtmlOptions): Promise<string>
	async function codeToHtml(code: string, languageOrOptions: string | ShikiHtmlOptions): Promise<string> {
		const options = typeof languageOrOptions === 'string' ? { language: languageOrOptions } : languageOrOptions
		shiki = await shikiStore.load()

		if (typeof languageOrOptions !== 'string' && languageOrOptions.embeddedLanguages)
			await loadLang(options.language, ...getEmbeddedMarkdownLanguages(code, options.language))
		else
			await loadLang(options.language)

		return shiki.codeToHtml(code, getOptions(options))
	}

	async function mountPlain(target: HTMLElement, language: string): Promise<void>
	async function mountPlain(target: HTMLElement, options: ShikiCodeOptions): Promise<void>
	async function mountPlain(target: HTMLElement, languageOrOptions: string | ShikiCodeOptions): Promise<void> {
		const options = typeof languageOrOptions === 'string' ? { language: languageOrOptions } : languageOrOptions
		shiki = await shikiStore.load()
		const { createPlainShiki } = await import('plain-shiki')

		await loadLang(options.language)
		createPlainShiki(shiki).mount(target, getOptions(options))
	}

	async function mountInline(target: HTMLElement, code: string, options: ShikiCodeOptions): Promise<void> {
		target.classList.add('shiki')
		target.insertAdjacentHTML('afterbegin', await codeToHtml(code, {
			...options,
			shikiOptions: {
				...options.shikiOptions,
				structure: 'inline',
			},
		}))
	}

	return {
		codeToHtml,
		mountInline,
		mountPlain,
	}
}
