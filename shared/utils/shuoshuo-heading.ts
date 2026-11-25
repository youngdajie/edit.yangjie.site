/**
 * 说说条目分隔标记的解析规则
 *
 * 单个 `shuoshuo.md` 里，每条说说以一行分隔标记开头，形如：
 *
 *   ++++++ 2026-09-19 16:30 泸州
 *   ++++++ 2026-09-19 16:30 @泸州 ~平静 #随笔 #生活
 *
 * 日期必备，时间与其余维度都可选：
 * - 日期 `YYYY-MM-DD`（必需，分隔符支持 `-` `/` `.`）
 * - 时间 `HH:mm`（可选，省略时按 00:00 处理）
 * - 地点 `@地点` 或末尾裸文本（可选）
 * - 心情 `~心情`（可选）
 * - 标签 `#标签`（可选，可多个）
 *
 * 这个模块只做纯字符串解析，不依赖 mdast，便于单独测试。
 */

export interface ParsedShuoshuoHeading {
	/** 原始分隔标记文本 */
	raw: string
	/** 规范化后的日期时间，`YYYY-MM-DD HH:mm:ss` */
	date: string
	/** 锚点 id，形如 `2026-09-19-1630` */
	anchor: string
	location?: string
	mood?: string
	tags: string[]
	/** 分隔标记里出现过的、未识别的片段，用来提示写法问题 */
	extras: string[]
}

/** 匹配开头的日期，分隔符允许 `-` `/` `.` */
const DATE_RE = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/
/** 匹配紧随日期的时间，允许 `16:30`、`16:30:00`，也容忍 `9:5` 这种单位数写法 */
const TIME_RE = /^\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?=\s|$)/
/** 匹配 `@地点` */
const LOCATION_AT_RE = /(?:^|\s)@(\S+)/
/** 匹配 `~心情` */
const MOOD_RE = /(?:^|\s)~(\S+)/
/** 匹配 `#标签` */
const TAG_RE = /(?:^|\s)#(\S+)/g

/**
 * 分隔标记：一行里 4 个及以上的加号，后面跟空格再跟内容。
 *
 * 用 4 个而不是固定 6 个作下限，是因为手写时很难数准；
 * 但下限压到 3 又会撞上 `+++` 这类常见强调写法，4 是个安全的折中。
 * 加号与内容之间的空格是必需的 —— 没空格就不认，避免把 `+++abc` 误当分隔。
 */
export const SHUOSHUO_PLUS_MARKER_RE = /^\s*\+{4,}\s+/

/**
 * 从分隔标记里剥出真正要解析的文本。
 *
 * 只剥开头那段加号，其余原样返回。不含日期时解析器随后会自行判定为
 * 「不是一条说说」，因而标题（`#` 开头）与普通段落都会落回默认处理。
 */
export function stripShuoshuoMarker(input: string): string {
	return input.replace(SHUOSHUO_PLUS_MARKER_RE, '')
}

/**
 * 把标签字符串拆成数组。
 *
 * 标签取回来是空格拼接的一个字符串（minimark 存不下数组属性），
 * 拆回数组的逻辑两处都要用，放这里统一。
 */
export function parseShuoshuoTags(input?: string | string[]) {
	if (!input)
		return []
	if (Array.isArray(input))
		return input.filter(Boolean)
	return input.split(/\s+/).filter(Boolean)
}

function pad(n: number, len = 2) {
	return n.toString().padStart(len, '0')
}

/**
 * 解析一条说说的分隔标记。
 *
 * 解析不出日期时返回 `null`，调用方据此判断这不是一条说说
 * （比如正文里的小标题、或写错的加号行），从而保留为普通段落。
 *
 * 入参可以带 `++++++` 前缀，本函数会自行剥掉。
 */
export function parseShuoshuoHeading(input: string): ParsedShuoshuoHeading | null {
	const raw = stripShuoshuoMarker(input).trim()
	const dateMatch = raw.match(DATE_RE)
	if (!dateMatch)
		return null

	const year = Number(dateMatch[1])
	const month = Number(dateMatch[2])
	const day = Number(dateMatch[3])
	if (!year || month < 1 || month > 12 || day < 1 || day > 31)
		return null

	// 日期之后的剩余部分依次摘掉时间、地点、心情、标签
	let rest = raw.slice(dateMatch[0].length)
	let hour = 0
	let minute = 0
	let second = 0

	const timeMatch = rest.match(TIME_RE)
	if (timeMatch) {
		hour = Number(timeMatch[1])
		minute = Number(timeMatch[2])
		second = Number(timeMatch[3] ?? 0)
		if (hour > 23 || minute > 59 || second > 59)
			return null
		rest = rest.slice(timeMatch[0].length)
	}

	const tags = [...rest.matchAll(TAG_RE)].map(m => m[1]!).filter(Boolean)
	const mood = rest.match(MOOD_RE)?.[1]
	const locationAt = rest.match(LOCATION_AT_RE)?.[1]

	// 摘掉所有已识别的片段，剩下的裸文本若存在，按地点处理
	const bare = rest
		.replace(TAG_RE, ' ')
		.replace(MOOD_RE, ' ')
		.replace(LOCATION_AT_RE, ' ')
		.trim()

	const location = locationAt ?? (bare || undefined)
	// bare 已被用作地点，未识别片段只看没被消耗的部分
	const extras = locationAt && bare ? [bare] : []

	return {
		raw,
		date: `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`,
		anchor: `${year}-${pad(month)}-${pad(day)}-${pad(hour)}${pad(minute)}`,
		location,
		mood,
		tags,
		extras,
	}
}
