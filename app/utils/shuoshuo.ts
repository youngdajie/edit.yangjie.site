/**
 * 说说（shuoshuo）
 *
 * 所有说说都写在单个 `content/shuoshuo.md` 里，一条一段，以分隔标记开头：
 *
 *   ++++++ 2026-09-19 16:30 泸州 ~平静 #随笔
 *
 * 标记被 `remark-shuoshuo` 解析后，每条说说在正文里就变成一个
 * `<ShuoshuoItem>` 组件节点。好处是**元数据随正文一起走**：
 * 列表页只要拿到这一个文件，就能既知道有哪些说说、又知道每条的时间地点心情，
 * 不需要再为每条说说建一个 md、安排一个 path。
 *
 * 于是这里不再需要「条目 → 一条说说」的映射，只需要从正文里
 * 把每条说说的锚点与日期摘出来，供分组、筛选、分页使用。
 */
import { parseShuoshuoTags } from '~~/shared/utils/shuoshuo-heading'

/** 从 `ShuoshuoItem` 组件节点上摘下的最小信息 */
export interface ShuoshuoMeta {
	/** 锚点 id，形如 `2026-09-19-1630`；DOM 元素的 id 与它完全一致 */
	anchor: string
	/** 规范化后的日期时间，`YYYY-MM-DD HH:mm:ss` */
	date: string
	location?: string
	mood?: string
	tags: string[]
}

/** 合法锚点：`YYYY-MM-DD-HHmm`，同一分钟连发多条时末尾直接跟 a/b/c…（无短横线） */
const SHUOSHUO_ANCHOR_RE = /^\d{4}-\d{2}-\d{2}-\d{4}[a-z]?$/

/** hash 是否是一条说说的锚点 */
export function isShuoshuoAnchor(value: string) {
	return SHUOSHUO_ANCHOR_RE.test(value)
}

/** 说说文件的访问路径，锚点形如 `/shuoshuo#2026-09-19-1630` */
export const SHUOSHUO_PATH = '/shuoshuo'

/** 说说条目在正文里的标签名，与 remark 插件的 `hName` 保持一致 */
export const SHUOSHUO_TAG = 'shuoshuo-item'

/** minimark 里一个节点形如 `["p", { props }, ...children]` */
type MinimarkNode = [string, Record<string, unknown>?, ...unknown[]]

/**
 * 从正文里摘出每条说说的元信息。
 *
 * 正文是 `minimark` 格式的嵌套数组，`ShuoshuoItem` 节点自带
 * `anchor` / `date` / `location` / `mood` / `tags` 属性。
 * 这里只做深度遍历，不关心具体排版，所以正文里怎么嵌套都不影响。
 */
export function extractShuoshuoMeta(body?: { type?: string, value?: unknown }): ShuoshuoMeta[] {
	if (!body || body.type !== 'minimark' || !Array.isArray(body.value))
		return []

	const list: ShuoshuoMeta[] = []
	walk(body.value, list)
	return list
}

function walk(nodes: unknown, list: ShuoshuoMeta[]) {
	if (!Array.isArray(nodes))
		return

	for (const node of nodes) {
		if (!Array.isArray(node))
			continue

		const [tag, props] = node as MinimarkNode
		if (tag === SHUOSHUO_TAG && props) {
			const anchor = props.anchor
			const date = props.date
			if (typeof anchor === 'string' && typeof date === 'string') {
				list.push({
					anchor,
					date,
					location: typeof props.location === 'string' ? props.location : undefined,
					mood: typeof props.mood === 'string' ? props.mood : undefined,
					tags: parseShuoshuoTags(
						typeof props.tags === 'string' || Array.isArray(props.tags)
							? props.tags as string | string[]
							: undefined,
					),
				})
				continue
			}
		}

		// 组件节点把正文放在第 2 个下标之后，容器节点同理，一起递归
		for (let i = 1; i < node.length; i++)
			walk(node[i], list)
	}
}

/** 从日期取年月键，供时间轴分组使用；解析失败返回空串 */
export function getShuoshuoMonthKey(date?: string) {
	if (!date)
		return ''
	try {
		const zdt = toZonedTemporal(date)
		return `${zdt.year}-${zdt.month.toString().padStart(2, '0')}`
	}
	catch {
		return ''
	}
}

/** 从日期取年份，供年份筛选使用；解析失败返回空串 */
export function getShuoshuoYear(date?: string) {
	return getShuoshuoMonthKey(date).slice(0, 4)
}

/** 时间轴分组的完整标题，如「2026 年 9 月」；解析失败时原样返回键 */
export function formatShuoshuoMonthFull(key: string) {
	const [year, month] = key.split('-')
	return year && month ? `${year} 年 ${Number(month)} 月` : key
}
