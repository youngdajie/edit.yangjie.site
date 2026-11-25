import { formatDateTime } from '~/utils/frontmatter'

/** 本地文章库：每篇文章独立保存，新建不覆盖旧文章 */

const LIBRARY_KEY = 'clarity-writing:library'
const CURRENT_KEY = 'clarity-writing:current'

export interface LibraryArticle {
	id: string
	fileName: string
	source: string
	updatedAt: string
}

function makeId(): string {
	return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useArticleLibrary() {
	/** 库内所有文章，按更新时间倒序 */
	const articles = shallowRef<LibraryArticle[]>([])
	const currentId = ref<string>('')

	function load() {
		if (!import.meta.client)
			return
		try {
			const raw = localStorage.getItem(LIBRARY_KEY)
			const list: LibraryArticle[] = raw ? (JSON.parse(raw) as LibraryArticle[]) : []
			const valid: LibraryArticle[] = Array.isArray(list)
				? list.filter((a: LibraryArticle) => a && typeof a.id === 'string' && typeof a.source === 'string')
				: []
			articles.value = valid
		}
		catch { articles.value = [] as LibraryArticle[] }
		currentId.value = localStorage.getItem(CURRENT_KEY) || articles.value[0]?.id || ''
	}

	function persist() {
		if (!import.meta.client)
			return
		try {
			localStorage.setItem(LIBRARY_KEY, JSON.stringify(articles.value))
			if (currentId.value)
				localStorage.setItem(CURRENT_KEY, currentId.value)
			else
				localStorage.removeItem(CURRENT_KEY)
		}
		catch { /* 存储写满时静默失败，当前编辑不受影响 */ }
	}

	/** 新增或更新一篇（按 id），source 为完整 .md 文本 */
	function save(article: Pick<LibraryArticle, 'id' | 'fileName' | 'source'>) {
		const now = formatDateTime(new Date())
		const idx = articles.value.findIndex(a => a.id === article.id)
		const entry: LibraryArticle = {
			...article,
			updatedAt: now,
		}
		if (idx >= 0)
			articles.value[idx] = entry
		else
			articles.value.unshift(entry)
		persist()
	}

	function remove(id: string) {
		articles.value = articles.value.filter(a => a.id !== id)
		if (currentId.value === id)
			currentId.value = articles.value[0]?.id || ''
		persist()
	}

	function setCurrent(id: string) {
		currentId.value = id
		persist()
	}

	function get(id: string): LibraryArticle | undefined {
		return articles.value.find(a => a.id === id)
	}

	/** 当前文章是否已在库中 */
	const hasCurrent = computed(() => !!currentId.value && articles.value.some(a => a.id === currentId.value))

	load()

	return {
		articles,
		currentId,
		hasCurrent,
		load,
		save,
		remove,
		setCurrent,
		get,
		makeId,
	}
}
