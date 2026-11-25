import type { Heading, Paragraph, Parent, Root, RootContent } from 'mdast'
import { parseShuoshuoHeading, SHUOSHUO_PLUS_MARKER_RE, stripShuoshuoMarker } from '../shared/utils/shuoshuo-heading.ts'

/**
 * 把 `shuoshuo.md` 里的分隔标记切分成一条条说说。
 *
 * 分隔标记只有一种写法：
 *
 *   ++++++ 2026-09-19 16:30 泸州 ~平静 #随笔
 *
 * 每条说说从分隔标记开始，直到下一个分隔标记为止的兄弟节点都属于它。
 * 转换后每条说说变成一个 `shuoshuoItem` 节点，元数据放进 hProperties，
 * 正文作为子节点保留原样 —— 于是正文里的 MDC 语法（`::alert`、`::pic` 等）
 * 完全不受影响，渲染交给 `content/ShuoshuoItem.vue`。
 *
 * **标题不再参与切分**，`#` 各级标题一律属于正文。
 * 标记解析不出日期时保持原样，于是正文里以加号开头的普通段落、
 * 以及任何标题都不会被误当成一条说说。
 */

interface ShuoshuoItemNode extends Parent {
	type: 'shuoshuoItem'
}

declare module 'mdast' {
	interface RootContentMap {
		shuoshuoItem: ShuoshuoItemNode
	}
}

export interface RemarkShuoshuoOptions {
	/**
	 * 只处理文件路径（不含扩展名）与这些值相等的 Markdown。
	 *
	 * remark 插件在 `nuxt.config.ts` 里全局注册，所有 Markdown 都会过一遍，
	 * 所以必须自己收窄范围 —— 否则别的文件里只要出现一行
	 * `++++++ 2026-09-19`，就会被误判成说说。
	 */
	include?: string[]
}

/** 取行内子节点的纯文本并拼接 */
function inlineText(children: readonly { type: string, value?: string }[]): string {
	return children
		.map(child => (child.type === 'text' || child.type === 'inlineCode' ? child.value ?? '' : ''))
		.join('')
}

/**
 * 取一个节点的纯文本。
 *
 * 分隔标记写成普通段落，但解析后内容会挂在 `children` 上而不是 `node.value`，
 * 所以要按节点类型分别取。标题同理（仅用于判断它是不是标记，不再用于切分）。
 */
function nodeText(node: RootContent): string {
	switch (node.type) {
		case 'text':
		case 'inlineCode':
			return node.value
		case 'paragraph':
			return inlineText((node as Paragraph).children)
		case 'heading':
			return inlineText((node as Heading).children)
		default:
			return ''
	}
}

/**
 * 这个节点是不是一条说说的开头？
 *
 * 分隔标记写成普通段落，判定条件是「整段以加号标记开头**且**能解析出日期」。
 * 两个条件都要满足，所以正文里随便出现的加号不会被误判。
 *
 * 标题不参与判定 —— `#` 各级标题都留给正文当小标题用。
 */
function matchMarker(node: RootContent) {
	if (node.type !== 'paragraph')
		return null
	const text = nodeText(node)
	if (!SHUOSHUO_PLUS_MARKER_RE.test(text))
		return null
	const parsed = parseShuoshuoHeading(stripShuoshuoMarker(text))
	return parsed ? { parsed } : null
}

/**
 * 取 vfile 对应的内容路径。
 *
 * Content 传进来的 `file.path` 是**拼在 CWD 后面的相对路径**
 * （如 `<仓库根>/content/shuoshuo.md`），不是干净的 `content/shuoshuo.md`，
 * 而且换个启动目录就变。所以从 `history` 里截取 `content/` 之后的部分，
 * 再抹掉扩展名，得到与集合 source 写法一致的 `shuoshuo`。
 */
function contentPathOf(file?: { path?: string, history?: string[] }) {
	const candidates = [...(file?.history ?? []), file?.path]
		.filter((item): item is string => typeof item === 'string')

	for (const item of candidates) {
		const normalized = item.replaceAll('\\', '/')
		const index = normalized.lastIndexOf('/content/')
		if (index < 0)
			continue
		const relative = normalized.slice(index + '/content/'.length)
		return relative.replace(/\.mdx?$/i, '')
	}
	return undefined
}

export default function remarkShuoshuo(options: RemarkShuoshuoOptions = {}) {
	const include = options.include ?? ['shuoshuo']

	return (tree: Root, file?: { path?: string, history?: string[] }) => {
		// 认不出文件就不猜，宁可不动、也不误伤文章
		if (!include.includes(contentPathOf(file) ?? ''))
			return

		const children = tree.children
		const out: RootContent[] = []
		/** 同一分钟可能连着发两条，锚点要去重，否则 DOM id 会撞 */
		const seenAnchor = new Map<string, number>()

		for (let i = 0; i < children.length; i++) {
			const node = children[i]!

			// 只从「能解析出日期」的标记开始分组，其余节点原样透传
			const matched = matchMarker(node)
			if (!matched) {
				out.push(node)
				continue
			}
			const { parsed } = matched

			/**
			 * 收集直到下一个标记为止的兄弟节点。
			 *
			 * 加号标记是**唯一**的边界，标题只当正文，所以条目里可以
			 * 随意写 `#` / `##` / `###` 小标题，层级怎么用都行。
			 */
			const body: RootContent[] = []
			let j = i + 1
			while (j < children.length) {
				const sibling = children[j]!
				if (matchMarker(sibling))
					break
				body.push(sibling)
				j++
			}

			const count = seenAnchor.get(parsed.anchor) ?? 0
			seenAnchor.set(parsed.anchor, count + 1)
			// 同一分钟连发多条：直接追加 a/b/c…，与用户复制出去的短链格式一致
			const anchor = count === 0 ? parsed.anchor : `${parsed.anchor}${String.fromCharCode(96 + count)}`

			out.push({
				type: 'shuoshuoItem',
				children: body as Parent['children'],
				data: {
					/**
					 * 标签名用连字符写法。
					 *
					 * minimark 会把标签名写成全小写（`shuoshuoitem`），
					 * 而渲染端是靠 `pascalCase(tag)` 去找组件的，
					 * `pascalCase('shuoshuoitem')` 得到的是 `Shuoshuoitem`，
					 * 跟 `ShuoshuoItem.vue` 对不上，组件就会退化成原始 HTML 标签。
					 * 写成 `shuoshuo-item` 后 pascalCase 能得到 `ShuoshuoItem`。
					 */
					hName: 'shuoshuo-item',
					hProperties: {
						anchor,
						date: parsed.date,
						location: parsed.location ?? '',
						mood: parsed.mood ?? '',
						/**
						 * 标签用空格拼成一个字符串，而不是传数组。
						 *
						 * minimark 会把数组属性压扁成空格拼接的字符串
						 * （`['随笔','生活']` → `"随笔 生活"`），传数组等于少一层信息、
						 * 还得在渲染端猜怎么拆回来。这里主动拼好，两端都按字符串处理。
						 * 标签本身不允许有空格（标题里 `#标签` 以空白分隔），反解无歧义。
						 */
						tags: parsed.tags.join(' '),
						/**
						 * 顺手把锚点挂到 `<article>` 上。
						 *
						 * Content 在 remark 之后还会给标题补自增 id，但我们的标题
						 * 已经并入 `shuoshuoItem`、不再是顶层节点，补不到 id，
						 * 于是没有 `#` 可以跳转过来。这里自己给一个稳定 id。
						 */
						id: anchor,
					},
				},
			})

			i = j - 1
		}

		tree.children = out
	}
}

/** 供测试与调试：只统计能识别成说说的标记数量 */
export function countShuoshuoHeadings(tree: Root) {
	let count = 0
	for (const node of tree.children) {
		if (matchMarker(node))
			count++
	}
	return count
}
