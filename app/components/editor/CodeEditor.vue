<script setup lang="ts">
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { bracketMatching, indentOnInput, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search'
import { completionKeymap, snippet } from '@codemirror/autocomplete'
import { EditorState, RangeSetBuilder, type Extension } from '@codemirror/state'
import { Decoration, drawSelection, dropCursor, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers, placeholder, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { tags } from '@lezer/highlight'

export interface EditorHandle {
	insertSnippet: (template: string) => void
	wrapSelection: (before: string, after: string, fallback: string) => void
	focus: () => void
	setValue: (text: string) => void
	undo: () => void
	redo: () => void
	setHeading: (level: number) => void
	toggleLinePrefix: (kind: 'quote' | 'ul' | 'ol' | 'task') => void
	/** 按比例滚动到指定位置（0-1），供父页面同步预览 */
	scrollToRatio: (ratio: number) => void
}

const props = defineProps<{
	modelValue: string
}>()

const emit = defineEmits<{
	'update:modelValue': [value: string]
	/** 编辑器滚动比例（0-1） */
	scroll: [ratio: number]
	/** 光标所在行的原文，用于让预览滚动到对应段落 */
	'cursor-line': [text: string]
	save: []
	palette: []
}>()

const host = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null

/**
 * 语法高亮：颜色一律用 --cm-* 变量，亮/暗两套值定义在 editor.css。
 * 这样切换主题无需重建 EditorView，也无需注入多套 theme。
 */
const mdHighlight = HighlightStyle.define([
	{ tag: tags.heading, color: 'var(--cm-heading)', fontWeight: '700' },
	{ tag: tags.heading1, color: 'var(--cm-heading)', fontWeight: '700' },
	{ tag: tags.heading2, color: 'var(--cm-heading)', fontWeight: '700' },
	{ tag: tags.strong, color: 'var(--cm-strong)', fontWeight: '700' },
	{ tag: tags.emphasis, color: 'var(--cm-em)', fontStyle: 'italic' },
	{ tag: tags.strikethrough, color: 'var(--cm-faint)', textDecoration: 'line-through' },
	{ tag: tags.link, color: 'var(--cm-link)', textDecoration: 'underline' },
	{ tag: tags.url, color: 'var(--cm-link)' },
	{ tag: tags.monospace, color: 'var(--cm-code)' },
	{ tag: tags.quote, color: 'var(--cm-quote)' },
	{ tag: tags.list, color: 'var(--cm-attr)' },
	{ tag: tags.meta, color: 'var(--cm-attr)' },
	{ tag: tags.processingInstruction, color: 'var(--cm-attr)' },
	{ tag: tags.contentSeparator, color: 'var(--cm-faint)' },
	{ tag: tags.comment, color: 'var(--cm-faint)', fontStyle: 'italic' },
	{ tag: tags.keyword, color: 'var(--cm-keyword)' },
	{ tag: tags.string, color: 'var(--cm-string)' },
	{ tag: tags.number, color: 'var(--cm-number)' },
	{ tag: tags.bool, color: 'var(--cm-number)' },
	{ tag: tags.variableName, color: 'var(--cm-text)' },
	{ tag: tags.punctuation, color: 'var(--cm-faint)' },
])

/**
 * frontmatter 区域统一着色。
 * Markdown 解析器会把首尾 --- 当成不同语法（首行 meta / 末行 setext 分隔），
 * 还把 [杂记] 当成链接加下划线，导致颜色杂乱。这里用专用 decoration 接管整块。
 */
const frontmatterHighlight = ViewPlugin.fromClass(class {
	decorations: DecorationSet
	constructor(v: EditorView) { this.decorations = buildFrontmatter(v) }
	update(u: ViewUpdate) {
		if (u.docChanged || u.viewportChanged)
			this.decorations = buildFrontmatter(u.view)
	}
}, { decorations: plugin => plugin.decorations })

function buildFrontmatter(v: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>()
	const doc = v.state.doc
	if (doc.lines < 2)
		return builder.finish()
	const first = doc.line(1)
	if (first.text.trim() !== '---')
		return builder.finish()

	// 找结束的 ---
	let endLine = 0
	for (let n = 2; n <= doc.lines; n++) {
		if (doc.line(n).text.trim() === '---') { endLine = n; break }
	}
	if (!endLine)
		return builder.finish()

	for (let n = 1; n <= endLine; n++) {
		const line = doc.line(n)
		const isFence = n === 1 || n === endLine
		if (isFence) {
			// 两行分隔符用同一个 class，保证颜色一致
			builder.add(line.from, line.to, Decoration.mark({ class: 'cm-fm-fence' }))
			continue
		}
		// key: value —— key 用主色，value 用普通文字色，统一不带下划线
		const colon = line.text.indexOf(':')
		if (colon > 0) {
			builder.add(line.from, line.from + colon + 1, Decoration.mark({ class: 'cm-fm-key' }))
			if (colon + 1 < line.text.length)
				builder.add(line.from + colon + 1, line.to, Decoration.mark({ class: 'cm-fm-value' }))
		}
		else {
			builder.add(line.from, line.to, Decoration.mark({ class: 'cm-fm-value' }))
		}
	}
	return builder.finish()
}

/** MDC 语法着色：::block / :inline，跳过代码围栏内部 */
const mdcHighlight = ViewPlugin.fromClass(class {
	decorations: DecorationSet
	constructor(v: EditorView) { this.decorations = build(v) }
	update(u: ViewUpdate) {
		if (u.docChanged || u.viewportChanged)
			this.decorations = build(u.view)
	}
}, { decorations: plugin => plugin.decorations })

function build(v: EditorView): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>()
	let inFence = false
	for (let n = 1; n <= v.state.doc.lines; n++) {
		const l = v.state.doc.line(n)
		const text = l.text
		if (/^\s*```/.test(text)) { inFence = !inFence; continue }
		if (inFence) continue

		const blockMatch = /^(\s*)(::[\w-]+)(\{[^}]*\})?/.exec(text)
		if (blockMatch) {
			const indent = blockMatch[1] ?? ''
			const tag = blockMatch[2] ?? ''
			const attrs = blockMatch[3] ?? ''
			const from = l.from + indent.length
			builder.add(from, from + tag.length, Decoration.mark({ class: 'cm-mdc-tag' }))
			if (attrs)
				builder.add(from + tag.length, from + tag.length + attrs.length, Decoration.mark({ class: 'cm-mdc-attr' }))
		}
		const inlineRe = /(^|[\s(])(:[\w-]+)(\[)/g
		let m: RegExpExecArray | null
		while ((m = inlineRe.exec(text))) {
			const lead = m[1] ?? ''
			const tag = m[2] ?? ''
			const from = l.from + m.index + lead.length
			builder.add(from, from + tag.length, Decoration.mark({ class: 'cm-mdc-inline' }))
		}
	}
	return builder.finish()
}

const PREFIX_RE: Record<'quote' | 'ul' | 'ol' | 'task', RegExp> = {
	quote: /^(\s*)> ?/,
	ul: /^(\s*)[-*+] (?!\[[ xX]\] )/,
	ol: /^(\s*)\d+[.)] /,
	task: /^(\s*)[-*+] \[[ xX]\] /,
}
const ANY_PREFIX = /^(\s*)(?:> ?|[-*+] \[[ xX]\] |[-*+] |\d+[.)] )/

function wrap(v: EditorView, before: string, after: string, fallback: string) {
	const { from, to } = v.state.selection.main
	if (from !== to && v.state.sliceDoc(from - before.length, from) === before && v.state.sliceDoc(to, to + after.length) === after) {
		v.dispatch({
			changes: [
				{ from: from - before.length, to: from, insert: '' },
				{ from: to, to: to + after.length, insert: '' },
			],
			selection: { anchor: from - before.length, head: to - before.length },
		})
		v.focus()
		return true
	}
	const text = v.state.sliceDoc(from, to) || fallback
	v.dispatch({
		changes: { from, to, insert: before + text + after },
		selection: { anchor: from + before.length, head: from + before.length + text.length },
	})
	v.focus()
	return true
}

/** 光标若停在 frontmatter 里，插到正文首行——避免 MDC 片段污染 YAML */
function safeInsertPos(v: EditorView, pos: number): number {
	const text = v.state.doc.toString()
	const fm = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(text)
	if (fm && pos <= fm[0].length)
		return fm[0].length
	return pos
}

function insertSnippet(v: EditorView, template: string) {
	const raw = v.state.selection.main
	const from = safeInsertPos(v, raw.from)
	const to = raw.from === raw.to ? from : safeInsertPos(v, raw.to)
	const cursorOffset = template.indexOf('$0')
	const text = cursorOffset >= 0 ? template.replace('$0', '') : template
	const full = v.state.doc.toString()
	const fm = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(full)
	const prefix = fm && from === fm[0].length ? '\n' : ''
	const insert = prefix + text
	const insertAt = cursorOffset >= 0 ? from + prefix.length + cursorOffset : from + insert.length
	v.dispatch({
		changes: { from, to, insert },
		selection: { anchor: insertAt },
		scrollIntoView: true,
	})
	v.focus()
}

function setHeading(v: EditorView, level: number) {
	const { from } = v.state.selection.main
	const line = v.state.doc.lineAt(from)
	const stripped = line.text.replace(/^#{1,6}\s*/, '')
	const prefix = '#'.repeat(level) + ' '
	v.dispatch({
		changes: { from: line.from, to: line.to, insert: prefix + stripped },
		selection: { anchor: line.from + prefix.length + stripped.length },
	})
	v.focus()
}

function toggleLinePrefix(v: EditorView, kind: 'quote' | 'ul' | 'ol' | 'task') {
	const { from } = v.state.selection.main
	const line = v.state.doc.lineAt(from)
	const prefix = { quote: '> ', ul: '- ', ol: '1. ', task: '- [ ] ' }[kind]
	if (PREFIX_RE[kind].test(line.text)) {
		v.dispatch({ changes: { from: line.from, to: line.to, insert: line.text.replace(PREFIX_RE[kind], '$1') } })
	}
	else {
		const base = line.text.replace(ANY_PREFIX, '$1')
		v.dispatch({ changes: { from: line.from, to: line.to, insert: prefix + base } })
	}
	v.focus()
}

function scrollToRatio(v: EditorView, ratio: number) {
	const el = v.scrollDOM
	const max = el.scrollHeight - el.clientHeight
	if (max > 0)
		el.scrollTop = max * Math.min(1, Math.max(0, ratio))
}

const handle: EditorHandle = {
	insertSnippet: (template) => { if (view) insertSnippet(view, template) },
	wrapSelection: (before, after, fallback) => { if (view) wrap(view, before, after, fallback) },
	focus: () => view?.focus(),
	setValue: (text) => { if (view) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }) },
	undo: () => { if (view) undo(view) },
	redo: () => { if (view) redo(view) },
	setHeading: (level) => { if (view) setHeading(view, level) },
	toggleLinePrefix: (kind) => { if (view) toggleLinePrefix(view, kind) },
	scrollToRatio: (ratio) => { if (view) scrollToRatio(view, ratio) },
}
defineExpose(handle)

const cb = ref({ emit })
watchEffect(() => { cb.value = { emit } })

onMounted(() => {
	if (!host.value) return
	const extensions: Extension[] = [
		lineNumbers(),
		highlightActiveLineGutter(),
		history(),
		drawSelection(),
		dropCursor(),
		indentOnInput(),
		bracketMatching(),
		highlightActiveLine(),
		highlightSelectionMatches(),
		search({ top: true }),
		EditorView.lineWrapping,
		placeholder('从这里开始写。Ctrl+/ 打开 MDC 组件库'),
		markdown({ base: markdownLanguage, codeLanguages: languages }),
		syntaxHighlighting(mdHighlight),
		frontmatterHighlight,
		mdcHighlight,
		keymap.of([
			{ key: 'Mod-s', preventDefault: true, run: () => (cb.value.emit('save'), true) },
			{ key: 'Mod-/', preventDefault: true, run: () => (cb.value.emit('palette'), true) },
			{ key: 'Mod-b', run: v => wrap(v, '**', '**', '粗体') },
			{ key: 'Mod-i', run: v => wrap(v, '*', '*', '斜体') },
			...completionKeymap,
			...searchKeymap,
			...historyKeymap,
			...defaultKeymap,
			indentWithTab,
		]),
		EditorView.updateListener.of((u) => {
			if (u.docChanged)
				cb.value.emit('update:modelValue', u.state.doc.toString())
			// 编辑或移动光标时上报当前行，预览据此滚到对应段落
			if (u.docChanged || u.selectionSet) {
				const line = u.state.doc.lineAt(u.state.selection.main.head)
				cb.value.emit('cursor-line', line.text)
			}
		}),
		EditorView.domEventHandlers({
			scroll: (_event, v) => {
				const el = v.scrollDOM
				const max = el.scrollHeight - el.clientHeight
				cb.value.emit('scroll', max > 0 ? el.scrollTop / max : 0)
			},
		}),
	]
	view = new EditorView({ parent: host.value, state: EditorState.create({ doc: props.modelValue, extensions }) })
})

/**
 * 外部改写 source（文章设置抽屉改 frontmatter、切换文章、新建等）时同步回编辑器。
 * 只有内容确实不同才 dispatch，避免与 updateListener 形成回环。
 */
watch(() => props.modelValue, (next) => {
	if (!view) return
	const current = view.state.doc.toString()
	if (current === next) return
	const head = view.state.selection.main.head
	view.dispatch({
		changes: { from: 0, to: view.state.doc.length, insert: next },
		selection: { anchor: Math.min(head, next.length) },
	})
})

onBeforeUnmount(() => { view?.destroy(); view = null })
</script>

<template>
	<div ref="host" class="writing-editor-host" />
</template>
