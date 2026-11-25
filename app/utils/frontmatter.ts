import yaml from 'js-yaml'

/** 文章元数据，字段对齐博客 content.config.ts 的 articleSchema */
export interface ArticleMeta {
	title: string
	description: string
	date: string
	updated: string
	image: string
	permalink: string
	type: string
	categories: string[]
	tags: string[]
	password: string
	aside: string[]
	draft: boolean
}

/** 博客文章类型与分类，取自 blog.config；编辑器直接硬编码避免循环依赖 */
export const ARTICLE_TYPES = ['tech', 'story'] as const
export const DEFAULT_CATEGORIES = ['未分类', '技术', '开发', '安全', '杂谈', '生活', '杂记'] as const

export function emptyMeta(): ArticleMeta {
	const now = formatDateTime(new Date())
	return {
		title: '',
		description: '',
		date: now,
		updated: now,
		image: '',
		permalink: '',
		type: 'tech',
		categories: [],
		tags: [],
		password: '',
		aside: [],
		draft: false,
	}
}

/** 与 scripts/new-blog.ts 同款日期格式：YYYY-MM-DD HH:mm:ss */
export function formatDateTime(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0')
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * frontmatter 日期字符串 → datetime-local 输入值（YYYY-MM-DDTHH:mm）。
 * 兼容 YAML 自动解析出的 Date 对象、以及带引号/不带引号的字符串。
 * 解析失败时返回当前时间，保证 input 不出现空值。
 */
export function toDateTimeLocal(value: unknown): string {
	if (value instanceof Date && !Number.isNaN(value.getTime()))
		return formatDateTime(value).slice(0, 16).replace(' ', 'T')
	const s = typeof value === 'string' ? value.trim() : ''
	if (!s)
		return formatDateTime(new Date()).slice(0, 16).replace(' ', 'T')
	// 已是 T 格式
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s))
		return s.slice(0, 16)
	const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(s)
	return m ? `${m[1]}T${m[2]}` : formatDateTime(new Date()).slice(0, 16).replace(' ', 'T')
}

/** datetime-local 输入值 → frontmatter 日期字符串（YYYY-MM-DD HH:mm:ss，秒补 00） */
export function fromDateTimeLocal(value: string): string {
	if (!value)
		return formatDateTime(new Date())
	return `${value.replace('T', ' ')}:00`
}

/** 拆分 frontmatter 与正文；无 frontmatter 时全部当正文 */
export function splitDocument(source: string): { meta: Record<string, unknown>, body: string } {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source)
	if (!match)
		return { meta: {}, body: source }

	let meta: Record<string, unknown> = {}
	try {
		const loaded = yaml.load(match[1] ?? '') as unknown
		if (loaded && typeof loaded === 'object' && !Array.isArray(loaded))
			meta = loaded as Record<string, unknown>
	}
	catch {
		// frontmatter 写错时保留正文，元数据交给用户修
	}
	return { meta, body: source.slice(match[0].length) }
}

/** 把 frontmatter 对象 + 正文拼成完整 .md */
export function joinDocument(meta: ArticleMeta, body: string): string {
	const fm: Record<string, unknown> = {}
	const set = (key: string, value: unknown) => {
		if (value === undefined || value === null || value === '')
			return
		if (Array.isArray(value) && value.length === 0)
			return
		fm[key] = value
	}

	set('title', meta.title || '无标题')
	set('description', meta.description)
	set('date', meta.date)
	set('updated', meta.updated)
	if (meta.aside.length)
		set('aside', meta.aside)
	set('image', meta.image)
	set('permalink', meta.permalink)
	// type 默认 tech，可省略；story 需显式写
	if (meta.type && meta.type !== 'tech')
		set('type', meta.type)
	set('categories', meta.categories)
	set('tags', meta.tags)
	set('password', meta.password)
	if (meta.draft)
		set('draft', true)

	const yamlText = yaml.dump(fm, { lineWidth: -1, noRefs: true, quotingType: '"', forceQuotes: false }).trimEnd()
	return `---\n${yamlText}\n---\n\n${body.replace(/^\s*\n/, '')}`
}

/** 由 frontmatter 对象还原编辑器表单模型 */
export function metaFromRecord(record: Record<string, unknown>): ArticleMeta {
	// YAML 会把裸日期解析成 Date，必须格式化回博客的 YYYY-MM-DD HH:mm:ss
	const dateStr = (v: unknown) => {
		if (v instanceof Date && !Number.isNaN(v.getTime()))
			return formatDateTime(v)
		return typeof v === 'string' ? v : v == null ? '' : String(v)
	}
	const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
	const arr = (v: unknown): string[] => {
		if (Array.isArray(v))
			return v.map(str).filter(Boolean)
		if (typeof v === 'string' && v.trim())
			return v.split(/[,，]/).map(s => s.trim()).filter(Boolean)
		return []
	}
	return {
		title: str(record.title),
		description: str(record.description),
		date: dateStr(record.date),
		updated: dateStr(record.updated),
		image: str(record.image),
		permalink: str(record.permalink),
		type: str(record.type) || 'tech',
		categories: arr(record.categories),
		tags: arr(record.tags),
		password: str(record.password),
		aside: arr(record.aside),
		draft: record.draft === true || str(record.draft) === 'true',
	}
}

/**
 * 严格按博客规范生成文件名：纯英文（A-Z a-z 0-9 -）、连字符连接。
 * 大小写原样保留，不做首字母大写转换；中文等非英文字符会被剔除；
 * 若结果为空则回退 Untitled。输入可带或不带 .md 后缀，输出永远带 .md。
 */
export function toFileName(input: string): string {
	const raw = input.trim().replace(/\.md$/i, '')
	// 非英文字符（含中文、空格、标点）统一当作分隔符
	const words = raw
		.normalize('NFKD')
		.replace(/[^\x00-\x7F]/g, ' ')
		.split(/[^A-Za-z0-9]+/)
		.filter(Boolean)
	if (!words.length)
		return 'Untitled.md'
	const named = words.join('-')
	return `${named}.md`
}

/** 校验文件名是否符合纯英文规范（供导出输入框实时提示） */
export function isValidFileName(input: string): boolean {
	const raw = input.trim().replace(/\.md$/i, '')
	return /^[A-Za-z][A-Za-z0-9-]*$/.test(raw)
}

export interface FileNameCheck {
	/** 规范化后的名字（不含 .md），大小写原样保留 */
	value: string
	/** 含中文等非 ASCII 字符 */
	hasForeign: boolean
	/** 非 ASCII 原文，用于搜狗翻译跳转 */
	foreignText: string
	/** 是否允许创建 / 导出 */
	valid: boolean
}

/**
 * 输入框里的文件名规范化：
 * - 英文句子 → 连字符（Infinite possibilities in the future → Infinite-possibilities-in-the-future）
 * - 所有符号、空格、连续分隔符合并为一个连字符，首尾连字符去掉
 * - 大小写原样保留，不强制首字母大写/小写
 * - 含中文等非 ASCII 字符：原样保留输入并标记错误，交由 UI 提示去翻译
 */
export function checkFileName(input: string): FileNameCheck {
	const raw = input.trim().replace(/\.md$/i, '')
	if (/[^\x00-\x7F]/.test(raw))
		return { value: raw, hasForeign: true, foreignText: raw, valid: false }

	const value = raw
		.replace(/[^A-Za-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-')
	return {
		value,
		hasForeign: false,
		foreignText: '',
		valid: /^[A-Za-z][A-Za-z0-9-]*$/.test(value),
	}
}

/** 搜狗翻译跳转（把中文原文带过去） */
export function sogouTranslateUrl(text: string): string {
	return `https://fanyi.sogou.com/text?keyword=${encodeURIComponent(text || '未来无限可能')}`
}
