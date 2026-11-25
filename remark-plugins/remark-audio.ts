import type { Parent, Root } from 'mdast'
import { visit } from 'unist-util-visit'

interface AudioComponentNode extends Parent {
	type: 'audioComponent'
}

declare module 'mdast' {
	interface RootContentMap {
		audioComponent: AudioComponentNode
	}
}

const AUDIO_OPEN_RE = /<audio\b([^>]*)>/i
const AUDIO_CLOSE_RE = /<\/audio\s*>/gi

function readAttr(attributes: string, name: string): string | undefined {
	const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i')
	const match = attributes.match(re)
	return match?.[1] ?? match?.[2] ?? match?.[3]
}

/**
 * 把正文里原生写的 `<audio controls src="...">` 转成 AudioPlayer 内容组件节点。
 *
 * remark 阶段拿到的是 html 节点（rehype-raw 还没跑），所以这里只处理
 * 「整段 html 只是一条 audio」的情况，混合了其它标签的内容保持原样，避免误伤。
 */
export default function remarkAudio() {
	return (tree: Root) => {
		visit(tree, 'html', (node, index, parent) => {
			if (!parent || index === undefined)
				return

			const value = node.value.trim()
			const open = value.match(AUDIO_OPEN_RE)
			if (!open)
				return

			const rest = value.replace(AUDIO_OPEN_RE, '').replace(AUDIO_CLOSE_RE, '').replace(/[\s\u200B]/g, '')
			if (rest)
				return

			const src = readAttr(open[1] ?? '', 'src')
			if (!src)
				return

			const hProperties: Record<string, string> = { src }
			const title = readAttr(open[1] ?? '', 'title')
			if (title)
				hProperties.name = title

			parent.children.splice(index, 1, {
				type: 'audioComponent',
				children: [],
				data: {
					hName: 'audio-player',
					hProperties,
				},
			})
		})
	}
}
