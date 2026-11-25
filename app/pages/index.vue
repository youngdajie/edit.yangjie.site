<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { EditorHandle } from '~/components/editor/CodeEditor.vue'
import {
	checkFileName,
	emptyMeta,
	formatDateTime,
	isValidFileName,
	joinDocument,
	metaFromRecord,
	sogouTranslateUrl,
	splitDocument,
	toFileName,
	type ArticleMeta,
} from '~/utils/frontmatter'
import { SNIPPETS, SNIPPET_GROUPS, type Snippet } from '~/utils/snippets'
import { SAMPLE_BODY, STARTER_BODY } from '~/utils/sample'

type View = 'edit' | 'split' | 'preview'

const PREFS_KEY = 'clarity-writing:prefs'
const THEME_KEY = 'clarity-writing:theme'
const lib = useArticleLibrary()
// 模板不会解包嵌套对象里的 ref，取到顶层变量
const articles = lib.articles
const currentId = lib.currentId
const persistFailed = lib.persistFailed

// ---------- 本地存储用量 ----------
/** 浏览器 localStorage 按 origin 计算，主流浏览器约 5 MB（按 UTF-16 字节估） */
const STORAGE_QUOTA = 5 * 1024 * 1024
const storageUsed = ref(0)
const storageRatio = computed(() => Math.min(1, storageUsed.value / STORAGE_QUOTA))
const storagePercent = computed(() => Math.round(storageRatio.value * 100))
const storageNearLimit = computed(() => storageRatio.value >= 0.9)
/** 写入失败或接近配额时禁止新建，避免文章丢失 */
const storageFull = computed(() => persistFailed.value || storageNearLimit.value)

function measureStorage() {
	if (!import.meta.client) return
	let bytes = 0
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i)
			if (!key) continue
			bytes += (key.length + (localStorage.getItem(key)?.length ?? 0)) * 2
		}
	}
	catch { /* 隐私模式下可能读不到，忽略 */ }
	storageUsed.value = bytes
}
function formatBytes(bytes: number) {
	return bytes < 1024 * 1024
		? `${(bytes / 1024).toFixed(1)} KB`
		: `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/** Markdown 基础语法：工具栏一行图标 */
const MARKDOWN_SNIPPETS = SNIPPETS.filter(s => s.group === '基础')
/** MDC 特殊组件：独立的标签库弹层 */
const MDC_SNIPPETS = SNIPPETS.filter(s => s.group !== '基础')

/** 设计好的示例文章：首次打开与文章库删空后都用这一篇占位 */
function makeSampleDoc(): string {
	const now = formatDateTime(new Date())
	return `---
title: 示例文章
description: 从 Markdown 基础语法到 MDC 组件，一篇看懂写作工作台的用法
date: ${now}
categories: [杂记]
tags: [写作, MDC, 示例]
type: tech
---

${SAMPLE_BODY}`
}

// useState 让 SSR 与 CSR 共用同一份初值，避免两处 new Date() 造成水合不一致
const source = useState('blog-writing:source', () => makeSampleDoc())

const meta = ref<ArticleMeta>(emptyMeta())
const view = ref<View>('split')
const showMeta = ref(false)
const showLibrary = ref(false)
const currentArticleId = ref('')
const showPalette = ref(false)
const paletteQuery = ref('')
const paletteCursor = ref(0)
const showExportDialog = ref(false)
const exportNameInput = ref('')
const showAbout = ref(false)
/** 新建文章弹窗：标题 + .md 命名 */
const showNewDialog = ref(false)
const newTitleInput = ref('')
const newNameInput = ref('')
const newNameTouched = ref(false)
const status = ref('就绪')
const statusError = ref(false)
const savedAt = ref('')
const fileName = ref('example.md')
const toast = ref('')
const previewAst = shallowRef<any>(null)
const previewLoading = ref(false)
const editorRef = ref<ComponentPublicInstance<EditorHandle> | null>(null)
const previewHost = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

// ---------- 左右分栏可拖拽 ----------
const SPLIT_KEY = 'clarity-writing:split'
const bodyRef = ref<HTMLElement | null>(null)
const splitRatio = ref(0.5)
let draggingSplit = false

function onSplitDown(e: PointerEvent) {
	draggingSplit = true
	;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
	e.preventDefault()
}
function onSplitMove(e: PointerEvent) {
	if (!draggingSplit || !bodyRef.value) return
	const rect = bodyRef.value.getBoundingClientRect()
	if (!rect.width) return
	const ratio = (e.clientX - rect.left) / rect.width
	splitRatio.value = Math.min(0.8, Math.max(0.2, ratio))
}
function onSplitUp(e: PointerEvent) {
	if (!draggingSplit) return
	draggingSplit = false
	;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
	if (import.meta.client)
		localStorage.setItem(SPLIT_KEY, splitRatio.value.toFixed(3))
}
function resetSplit() {
	splitRatio.value = 0.5
	if (import.meta.client)
		localStorage.removeItem(SPLIT_KEY)
}

// ---------- 自定义 tooltip ----------
const {
	visible: tipVisible,
	lines: tipLines,
	x: tipX,
	y: tipY,
	above: tipAbove,
} = useTooltip()

// ---------- 主题 ----------
const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
function toggleTheme() {
	const next = isDark.value ? 'light' : 'dark'
	colorMode.preference = next
	if (import.meta.client)
		localStorage.setItem(THEME_KEY, next)
}

// ---------- frontmatter ----------
const TYPE_OPTIONS = [
	{ label: 'tech · 技术文', value: 'tech', desc: '标题带 # 圆角标' },
	{ label: 'story · 叙事文', value: 'story', desc: '标题居中衬线' },
]
const DRAFT_OPTIONS = [
	{ label: '公开', value: 'false', desc: '构建后正常发布' },
	{ label: '草稿', value: 'true', desc: '不进入列表与订阅' },
]

function loadMetaFromSource() {
	meta.value = metaFromRecord(splitDocument(source.value).meta)
}

/** 抽屉改表单时跳过一次反向解析，避免把正在输入的值覆盖掉 */
let skipMetaSync = false

function syncMetaToSource() {
	const body = splitDocument(source.value).body
	const next = joinDocument(meta.value, body)
	if (next !== source.value) {
		skipMetaSync = true
		source.value = next
	}
}

loadMetaFromSource()

function onMetaChange() { syncMetaToSource() }

// ---------- 文件命名（新建后随时可改） ----------
const fileNameInput = ref('')
watch(fileName, (value) => { fileNameInput.value = value.replace(/\.md$/i, '') }, { immediate: true })
const fileNameCheck = computed(() => checkFileName(fileNameInput.value))
const fileNameSogouUrl = computed(() => sogouTranslateUrl(fileNameCheck.value.foreignText))

function applyFileName() {
	const result = fileNameCheck.value
	if (result.hasForeign || !result.valid) {
		showToast('文件名不合规，未修改')
		fileNameInput.value = fileName.value.replace(/\.md$/i, '')
		return
	}
	const next = toFileName(result.value)
	fileName.value = next
	fileNameInput.value = result.value
	lib.save({ id: currentArticleId.value, fileName: next, source: source.value })
	showToast(`文件名已改为 ${next}`)
}

function setList(field: 'categories' | 'tags' | 'aside', value: string) {
	meta.value[field] = value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
	onMetaChange()
}

function listText(field: 'categories' | 'tags' | 'aside') {
	return meta.value[field].join(', ')
}

function setDate(field: 'date' | 'updated', value: string) {
	meta.value[field] = value
	onMetaChange()
}

function setDateNow(field: 'date' | 'updated') {
	meta.value[field] = formatDateTime(new Date())
	onMetaChange()
	showToast(`${field === 'date' ? '发布日期' : '更新日期'}已设为现在`)
}

// ---------- 文章库 ----------
interface Prefs { view: View }

function saveDraft() {
	const ok = lib.save({ id: currentArticleId.value, fileName: fileName.value, source: source.value })
	measureStorage()
	if (!ok) {
		status.value = '本地存储已满，无法保存！请立即导出 .md 并删除旧文章'
		statusError.value = true
		showToast('本地存储已满，请及时导出文章')
		return
	}
	savedAt.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
	status.value = `已保存 ${savedAt.value}`
	statusError.value = false
}

function openArticle(id: string) {
	if (id === currentArticleId.value) return
	saveDraft()
	const article = lib.get(id)
	if (!article) return
	currentArticleId.value = article.id
	source.value = article.source
	fileName.value = article.fileName
	lib.setCurrent(id)
	editorRef.value?.setValue(source.value)
	loadMetaFromSource()
	showLibrary.value = false
	nextTick(() => requestPreview())
	showToast(`已打开「${meta.value.title || fileName.value}」`)
}

/** 打开新建弹窗：先问标题与文件名 */
function openNewDialog() {
	if (storageFull.value) {
		showToast('本地存储已满，请先导出 .md 并删除旧文章')
		return
	}
	newTitleInput.value = ''
	newNameInput.value = ''
	newNameTouched.value = false
	showNewDialog.value = true
}

/** 英文标题自动带出合规文件名（用户手动改过就不再覆盖） */
watch(newTitleInput, (title) => {
	if (!newNameTouched.value)
		newNameInput.value = isValidFileName(title) ? toFileName(title).replace(/\.md$/i, '') : ''
})

const newNameCheck = computed(() => checkFileName(newNameInput.value))
const newNameValid = computed(() => newNameCheck.value.valid)
const newNameHasForeign = computed(() => newNameCheck.value.hasForeign)
const newSogouUrl = computed(() => sogouTranslateUrl(newNameCheck.value.foreignText))
const normalizedNewName = computed(() => toFileName(newNameCheck.value.value))
/** 失焦时把英文句子自动转成连字符格式写回输入框 */
function onNewNameBlur() {
	if (!newNameCheck.value.hasForeign)
		newNameInput.value = newNameCheck.value.value
}

/** 确认新建：标题写进 frontmatter，合规文件名直接作为文章库里的文件名 */
function confirmNewArticle() {
	if (storageFull.value) {
		showToast('本地存储已满，无法新建文章')
		return
	}
	const title = newTitleInput.value.trim()
	const finalName = normalizedNewName.value
	saveDraft()
	const id = lib.makeId()
	currentArticleId.value = id
	const now = formatDateTime(new Date())
	// 标题留空就真的留空，不往 frontmatter 里塞占位文字
	source.value = `---\ntitle: ${title}\ndescription: \ndate: ${now}\nupdated: ${now}\ntype: tech\ncategories: [技术]\ntags: []\n---\n\n${STARTER_BODY}`
	fileName.value = finalName
	lib.setCurrent(id)
	lib.save({ id, fileName: finalName, source: source.value })
	editorRef.value?.setValue(source.value)
	loadMetaFromSource()
	showNewDialog.value = false
	showLibrary.value = false
	nextTick(() => requestPreview())
	showToast(`已新建「${title || finalName}」· ${finalName}`)
}

function deleteArticle(id: string) {
	const article = lib.get(id)
	const label = article ? (splitDocument(article.source).meta.title as string || article.fileName) : '这篇文章'
	if (!confirm(`确定删除「${label}」吗？此操作不可撤销`))
		return
	lib.remove(id)
	if (currentArticleId.value === id) {
		const next = articles.value[0]
		if (next) {
			currentArticleId.value = next.id
			source.value = next.source
			fileName.value = next.fileName
			lib.setCurrent(next.id)
		}
		else {
			// 文章库删空后，用设计好的示例文章占位（而不是 Untitled 空白页），并立刻入库
			currentArticleId.value = lib.makeId()
			source.value = makeSampleDoc()
			fileName.value = 'example.md'
			lib.setCurrent(currentArticleId.value)
			lib.save({ id: currentArticleId.value, fileName: fileName.value, source: source.value })
		}
		editorRef.value?.setValue(source.value)
		loadMetaFromSource()
		nextTick(() => requestPreview())
	}
	showToast('已删除')
}

onMounted(() => {
	lib.load()
	measureStorage()
	// 恢复主题（color-mode 自己也持久化，这里做双保险）
	const savedTheme = localStorage.getItem(THEME_KEY)
	if (savedTheme === 'dark' || savedTheme === 'light')
		colorMode.preference = savedTheme
	// 恢复左右分栏比例
	const savedSplit = Number.parseFloat(localStorage.getItem(SPLIT_KEY) || '')
	if (Number.isFinite(savedSplit) && savedSplit >= 0.2 && savedSplit <= 0.8)
		splitRatio.value = savedSplit

	const firstId = lib.makeId()
	if (!articles.value.length) {
		currentArticleId.value = firstId
		lib.setCurrent(firstId)
		lib.save({ id: firstId, fileName: fileName.value, source: source.value })
	}
	else {
		const current = lib.get(currentId.value) || articles.value[0]
		if (current) {
			currentArticleId.value = current.id
			source.value = current.source
			fileName.value = current.fileName
			lib.setCurrent(current.id)
			editorRef.value?.setValue(source.value)
			loadMetaFromSource()
		}
	}
	try {
		const raw = localStorage.getItem(PREFS_KEY)
		if (raw) {
			const prefs = JSON.parse(raw) as Prefs
			if (prefs.view) view.value = prefs.view
		}
	}
	catch { /* ignore */ }
	window.addEventListener('keydown', onGlobalKey)
	nextTick(() => requestPreview())
})

onBeforeUnmount(() => {
	window.removeEventListener('keydown', onGlobalKey)
	if (saveTimer) clearTimeout(saveTimer)
	if (previewTimer) clearTimeout(previewTimer)
})

function setView(next: View) {
	view.value = next
	localStorage.setItem(PREFS_KEY, JSON.stringify({ view: next }))
	if (next !== 'edit')
		requestPreview()
}

// ---------- 预览 ----------
let previewTimer: ReturnType<typeof setTimeout> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let previewSeq = 0

watch(source, () => {
	// 用户在编辑器里直接改 frontmatter（含清空全文）时，表单跟着同步
	if (skipMetaSync)
		skipMetaSync = false
	else
		loadMetaFromSource()

	// 每次内容变化都主动自动保存（600ms 防抖，避免每个字符都写 localStorage）
	if (!statusError.value) {
		status.value = '保存中…'
		statusError.value = false
	}
	if (saveTimer) clearTimeout(saveTimer)
	saveTimer = setTimeout(saveDraft, 600)
	if (previewTimer) clearTimeout(previewTimer)
	previewTimer = setTimeout(() => {
		if (view.value !== 'edit')
			requestPreview()
	}, 300)
})

async function requestPreview() {
	const seq = ++previewSeq
	previewLoading.value = true
	try {
		const data = await $fetch<{ body: any }>('/api/preview', {
			method: 'POST',
			body: { source: source.value },
		})
		if (seq === previewSeq)
			previewAst.value = data.body
	}
	catch (error) {
		if (seq === previewSeq) {
			status.value = `预览失败：${error instanceof Error ? error.message : String(error)}`
			statusError.value = true
		}
	}
	finally {
		if (seq === previewSeq) previewLoading.value = false
	}
}

/** 没有 title 时用文件名占位，不再把「未命名文章」写进文件 */
const displayTitle = computed(() => meta.value.title.trim() || fileName.value.replace(/\.md$/i, '') || '未命名')

const resolvedFileName = computed(() => {
	// 新建/打开文件时已定的合规名优先（导出时只检查，不重新命名）
	if (fileName.value && fileName.value !== 'Untitled.md' && isValidFileName(fileName.value))
		return toFileName(fileName.value)
	// 否则尝试用英文标题生成
	const fromTitle = toFileName(meta.value.title.trim())
	if (fromTitle !== 'Untitled.md')
		return fromTitle
	return fileName.value || 'Untitled.md'
})

// ---------- 编辑器命令 ----------
function run(fn: (h: EditorHandle) => void) {
	if (editorRef.value) fn(editorRef.value)
}

function showToast(message: string) {
	toast.value = message
	setTimeout(() => { if (toast.value === message) toast.value = '' }, 2200)
}

function insertSnippet(snippet: Snippet) {
	run((h) => {
		if (snippet.wrap)
			h.wrapSelection(snippet.wrap[0], snippet.wrap[1], snippet.fallback ?? '文字')
		else
			h.insertSnippet(snippet.template)
	})
	showPalette.value = false
	showToast(`已插入「${snippet.label}」`)
}

// ---------- 滚动同步 ----------
let syncLock = false
function onEditorScroll(ratio: number) {
	if (syncLock || view.value === 'edit' || !previewHost.value) return
	const el = previewHost.value
	const max = el.scrollHeight - el.clientHeight
	if (max <= 0) return
	syncLock = true
	el.scrollTop = max * ratio
	requestAnimationFrame(() => { syncLock = false })
}
function onPreviewScroll() {
	if (syncLock || view.value === 'preview' || !previewHost.value) return
	const el = previewHost.value
	const max = el.scrollHeight - el.clientHeight
	if (max <= 0) return
	syncLock = true
	editorRef.value?.scrollToRatio(el.scrollTop / max)
	requestAnimationFrame(() => { syncLock = false })
}

// ---------- MDC 标签库弹层（左列表 + 右详情） ----------
const filteredSnippets = computed<Snippet[]>(() => {
	const q = paletteQuery.value.trim().toLowerCase()
	return q
		? MDC_SNIPPETS.filter(s => `${s.label} ${s.desc} ${s.syntax} ${s.group}`.toLowerCase().includes(q))
		: MDC_SNIPPETS
})
const currentSnippet = computed(() => filteredSnippets.value[paletteCursor.value] ?? filteredSnippets.value[0])

function openPalette() {
	paletteQuery.value = ''
	paletteCursor.value = 0
	showPalette.value = true
}

function onPaletteKey(e: KeyboardEvent) {
	const list = filteredSnippets.value
	if (e.key === 'Escape') { showPalette.value = false; return }
	if (e.key === 'ArrowDown') { e.preventDefault(); paletteCursor.value = (paletteCursor.value + 1) % Math.max(list.length, 1); return }
	if (e.key === 'ArrowUp') { e.preventDefault(); paletteCursor.value = (paletteCursor.value - 1 + list.length) % Math.max(list.length, 1); return }
	if (e.key === 'Enter' && currentSnippet.value) { e.preventDefault(); insertSnippet(currentSnippet.value) }
}
watch(paletteQuery, () => { paletteCursor.value = 0 })

function onGlobalKey(e: KeyboardEvent) {
	if ((e.ctrlKey || e.metaKey) && e.key === '/') {
		e.preventDefault()
		openPalette()
	}
	if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
		e.preventDefault()
		syncMetaToSource()
		saveDraft()
		showToast('草稿已保存')
	}
	if (e.key === 'Escape') {
		showPalette.value = false
		showMeta.value = false
		showLibrary.value = false
		showExportDialog.value = false
		showNewDialog.value = false
		showAbout.value = false
	}
}

// ---------- 文件 ----------
function openFile(e: Event) {
	const input = e.target as HTMLInputElement
	const file = input.files?.[0]
	if (!file) return
	const reader = new FileReader()
	reader.onload = () => {
		source.value = String(reader.result || '')
		fileName.value = file.name
		editorRef.value?.setValue(source.value)
		loadMetaFromSource()
		showToast(`已打开 ${file.name}`)
	}
	reader.readAsText(file)
	input.value = ''
}

function openExportDialog() {
	syncMetaToSource()
	exportNameInput.value = resolvedFileName.value.replace(/\.md$/i, '')
	showExportDialog.value = true
}

const exportNameCheck = computed(() => checkFileName(exportNameInput.value))
const exportNameValid = computed(() => exportNameCheck.value.valid)
const exportNameHasForeign = computed(() => exportNameCheck.value.hasForeign)
const exportSogouUrl = computed(() => sogouTranslateUrl(exportNameCheck.value.foreignText))
const normalizedExportName = computed(() => toFileName(exportNameCheck.value.value))
function onExportNameBlur() {
	if (!exportNameCheck.value.hasForeign)
		exportNameInput.value = exportNameCheck.value.value
}

function confirmExport() {
	const finalName = normalizedExportName.value
	const blob = new Blob([source.value], { type: 'text/markdown;charset=utf-8' })
	const url = URL.createObjectURL(blob)
	const a = document.createElement('a')
	a.href = url
	a.download = finalName
	a.click()
	URL.revokeObjectURL(url)
	fileName.value = finalName
	lib.save({ id: currentArticleId.value, fileName: finalName, source: source.value })
	showExportDialog.value = false
	showToast(`已导出 ${finalName}`)
}

function copySource() {
	syncMetaToSource()
	navigator.clipboard.writeText(source.value).then(
		() => showToast('Markdown 已复制'),
		() => showToast('复制失败'),
	)
}

async function copyHtml() {
	const host = document.querySelector('.w-preview-host > .article')
	if (!host) return
	try {
		await navigator.clipboard.writeText(host.innerHTML)
		showToast('正文 HTML 已复制')
	}
	catch { showToast('复制失败') }
}

const wordCount = computed(() => {
	const body = splitDocument(source.value).body
	const cjk = (body.match(/[\u3400-\u9FFF]/g) || []).length
	const latin = (body.match(/[A-Za-z0-9]+/g) || []).length
	return cjk + latin
})
const readMinutes = computed(() => Math.max(1, Math.ceil(wordCount.value / 300)))
</script>

<template>
	<div class="writing-app">
		<!-- ======== 顶栏 ======== -->
		<header class="w-top">
			<div class="w-logo"><img src="/carrot.svg" alt="blog writing@jie"></div>
			<span class="w-brand">blog writing@jie</span>
			<span class="w-sep" />
			<div class="w-doc">
				<strong class="w-doc-title" :data-tip="displayTitle">{{ displayTitle }}</strong>
				<span class="w-doc-sub">{{ savedAt ? `已保存 ${savedAt}` : status }}<span class="w-doc-extra"> · {{ wordCount }} 字 · 约 {{ readMinutes }} 分钟</span></span>
			</div>

			<span class="w-spacer" />

			<!-- 两个图标都渲染，靠 .dark 用 CSS 切换，避免 SSR/CSR 主题值不同导致水合不一致 -->
			<button class="w-icon-btn w-theme-btn" data-tip="切换主题" @click="toggleTheme">
				<Icon name="tabler:moon" class="w-theme-light" />
				<Icon name="tabler:sun" class="w-theme-dark" />
			</button>
			<button class="w-icon-btn" data-tip="文章库" @click="showLibrary = !showLibrary">
				<Icon name="tabler:books" />
				<span v-if="articles.length" class="w-badge">{{ articles.length }}</span>
			</button>
			<button class="w-icon-btn" data-tip="文章设置" @click="showMeta = !showMeta"><Icon name="tabler:settings" /></button>
			<button class="w-icon-btn w-hide-mobile" data-tip="关于本站" @click="showAbout = true"><Icon name="tabler:info-circle" /></button>
			<button class="w-icon-btn w-hide-mobile" :data-tip="storageFull ? '本地存储已满，请先导出旧文章' : '新建文章'" :disabled="storageFull" @click="openNewDialog"><Icon name="tabler:file-plus" /></button>
			<button class="w-icon-btn w-hide-mobile" data-tip="打开 .md" @click="fileInput?.click()"><Icon name="tabler:folder-open" /></button>
			<input ref="fileInput" type="file" accept=".md,.markdown,text/markdown" hidden @change="openFile">

			<span class="w-sep" />

			<div class="w-segment" role="group" aria-label="视图">
				<button :class="{ 'is-active': view === 'edit' }" data-tip="只看编辑区" @click="setView('edit')"><Icon name="tabler:pencil" /></button>
				<button :class="{ 'is-active': view === 'split' }" data-tip="左右对照" @click="setView('split')"><Icon name="tabler:columns-2" /></button>
				<button :class="{ 'is-active': view === 'preview' }" data-tip="只看预览" @click="setView('preview')"><Icon name="tabler:eye" /></button>
			</div>
			<button class="w-publish" data-tip="导出 .md 到博客目录" @click="openExportDialog">
				<Icon name="tabler:download" /><span class="w-publish-label">导出 .md</span>
			</button>
		</header>

		<!-- ======== 一行 Markdown 工具栏 ======== -->
		<div class="w-toolbar">
			<button class="w-tool" data-tip="撤销 (Ctrl+Z)" @click="run(h => h.undo())"><Icon name="tabler:arrow-back-up" /></button>
			<button class="w-tool" data-tip="重做 (Ctrl+Y)" @click="run(h => h.redo())"><Icon name="tabler:arrow-forward-up" /></button>
			<span class="w-sep" />
			<button
				v-for="s in MARKDOWN_SNIPPETS"
				:key="s.label"
				class="w-tool"
				:class="{ 'is-inline': !!s.wrap }"
				:data-tip="`${s.label}\n${s.desc}`"
				@click="insertSnippet(s)"
			>
				<Icon :name="s.icon" />
			</button>
			<span class="w-spacer" />
			<button class="w-mdc-trigger" data-tip="MDC 组件库" @click="openPalette">
				<Icon name="tabler:box-multiple" /><span>MDC 组件</span><kbd>Ctrl+/</kbd>
			</button>
		</div>

		<!-- ======== 编辑 / 预览（占满剩余高度） ======== -->
		<main
			ref="bodyRef"
			class="w-body"
			:data-view="view"
			:style="{ '--split': `${splitRatio * 100}%` }"
		>
			<section class="w-pane w-pane-editor">
				<span class="w-pane-tag">Markdown</span>
				<EditorCodeEditor
					ref="editorRef"
					v-model="source"
					@scroll="onEditorScroll"
					@save="saveDraft"
					@palette="openPalette"
				/>
			</section>
			<div
				class="w-resizer"
				role="separator"
				aria-orientation="vertical"
				data-tip="拖动改宽度 · 双击复位"
				@pointerdown="onSplitDown"
				@pointermove="onSplitMove"
				@pointerup="onSplitUp"
				@pointercancel="onSplitUp"
				@dblclick="resetSplit"
			>
				<span class="w-resizer-grip" />
			</div>
			<section class="w-pane w-pane-preview">
				<span class="w-pane-tag">预览<Icon v-if="previewLoading" name="tabler:loader-2" class="w-spin" /></span>
				<div ref="previewHost" class="w-preview-host" @scroll="onPreviewScroll">
					<ContentRenderer
						v-if="previewAst"
						:value="previewAst"
						tag="article"
						class="article"
						:class="`md-${meta.type}`"
					/>
					<p v-else class="w-preview-placeholder">预览加载中…</p>
				</div>
			</section>
		</main>

		<!-- ======== 状态栏 ======== -->
		<footer class="w-status">
			<span class="w-autosave" :class="{ 'is-error': statusError }">
				<Icon :name="statusError ? 'tabler:alert-triangle' : 'tabler:cloud-upload'" />
				<span>自动保存</span>
				<span class="w-autosave-state">{{ status }}</span>
			</span>
			<span class="w-status-sep w-hide-mobile" />
			<span class="w-hide-mobile">{{ wordCount }} 字 · 约 {{ readMinutes }} 分钟</span>
			<span class="w-status-sep w-hide-mobile" />
			<span class="w-hide-mobile">导出为 <code>{{ resolvedFileName }}</code></span>
			<span class="w-spacer" />
			<span
				class="w-storage"
				:class="{ 'is-warn': storageNearLimit, 'is-full': storageFull }"
				:data-tip="`文章只存在本浏览器的 localStorage\n已用 ${formatBytes(storageUsed)} / 5 MB（${storagePercent}%）· 不上传云端`"
			>
				<Icon name="tabler:database" />
				<span class="w-storage-label">本地 {{ formatBytes(storageUsed) }} / 5 MB</span>
				<span class="w-storage-bar"><i :style="{ width: `${Math.max(2, storagePercent)}%` }" /></span>
				<span class="w-storage-pct">{{ storagePercent }}%</span>
			</span>
			<button class="w-status-btn" data-tip="复制 Markdown" @click="copySource"><Icon name="tabler:clipboard" /></button>
			<button class="w-status-btn" data-tip="复制正文 HTML" @click="copyHtml"><Icon name="tabler:code" /></button>
			<span class="is-ok w-hide-mobile"><Icon name="tabler:circle-check" /> 预览与博客同源渲染</span>
		</footer>

		<!-- ======== 文章库抽屉 ======== -->
		<div v-if="showLibrary" class="w-scrim" @click.self="showLibrary = false">
			<aside class="w-drawer">
				<header class="w-drawer-head">
					<div>
						<h2><Icon name="tabler:books" /> 文章库</h2>
						<p>文章保存在此浏览器本地，新建不会覆盖旧文章</p>
					</div>
					<button class="w-icon-btn" data-tip="关闭" @click="showLibrary = false"><Icon name="tabler:x" /></button>
				</header>
				<div class="w-drawer-body">
					<button class="w-new-article" :disabled="storageFull" @click="openNewDialog">
						<Icon name="tabler:file-plus" /><span>{{ storageFull ? '存储已满，无法新建' : '新建文章' }}</span><small>当前文章会自动存入库</small>
					</button>
					<div v-if="!articles.length" class="w-empty">
						<Icon name="tabler:inbox" /><p>文章库还是空的</p>
					</div>
					<div v-else class="w-article-list">
						<div
							v-for="article in articles"
							:key="article.id"
							class="w-article-item"
							:class="{ 'is-current': article.id === currentArticleId }"
							@click="openArticle(article.id)"
						>
							<div class="w-article-main">
								<strong>{{ (splitDocument(article.source).meta.title as string) || article.fileName.replace(/\.md$/i, '') }}</strong>
								<span>{{ article.updatedAt }} · {{ article.fileName }}</span>
							</div>
							<button class="w-article-del" data-tip="删除这篇文章" @click.stop="deleteArticle(article.id)">
								<Icon name="tabler:trash" /><span>删除</span>
							</button>
						</div>
					</div>
				</div>
				<footer class="w-drawer-foot">
					<span class="w-foot-note">共 {{ articles.length }} 篇 · 仅存于本机浏览器</span>
					<button class="w-btn w-about-entry" @click="showAbout = true"><Icon name="tabler:info-circle" /> 关于本站</button>
				</footer>
			</aside>
		</div>

		<!-- ======== 文章设置抽屉 ======== -->
		<div v-if="showMeta" class="w-scrim" @click.self="showMeta = false">
			<aside class="w-drawer">
				<header class="w-drawer-head">
					<div>
						<h2><Icon name="tabler:settings" /> 文章设置</h2>
						<p>对应文章开头的 frontmatter，改动会实时写回源码</p>
					</div>
					<button class="w-icon-btn" data-tip="关闭" @click="showMeta = false"><Icon name="tabler:x" /></button>
				</header>
				<div class="w-drawer-body">
					<section class="w-fieldset">
						<h3>基本信息</h3>
						<div class="w-field">
							<label for="wm-title">标题 <code>title</code></label>
							<input id="wm-title" v-model="meta.title" placeholder="我的第一篇文章" @input="onMetaChange">
							<small>显示在文章页顶部与列表卡片</small>
						</div>
						<div class="w-field">
							<label for="wm-desc">简介 <code>description</code></label>
							<textarea id="wm-desc" v-model="meta.description" rows="2" placeholder="一句话介绍，会显示在列表和搜索结果里" @input="onMetaChange" />
							<small>不显示在文章页，用于列表摘要与 SEO</small>
						</div>
					</section>
					<section class="w-fieldset">
						<h3>文件命名</h3>
						<div class="w-field">
							<label for="wm-filename">.md 文件名（纯英文）</label>
							<div class="w-datetime">
								<input
									id="wm-filename"
									v-model="fileNameInput"
									placeholder="example"
									@blur="applyFileName"
									@keydown.enter="applyFileName"
								>
								<button class="w-now-btn" data-tip="应用文件名" @click="applyFileName"><Icon name="tabler:check" />应用</button>
							</div>
							<small>空格与符号自动转连字符，大小写原样保留；改名后会同步到文章库</small>
						</div>
						<div v-if="fileNameCheck.hasForeign" class="w-name-error">
							<Icon name="tabler:alert-circle" />
							<div>
								<strong>文件名不能包含中文</strong>
								<a :href="fileNameSogouUrl" target="_blank" rel="noopener noreferrer">去搜狗翻译 <Icon name="tabler:external-link" /></a>
							</div>
						</div>
					</section>
					<section class="w-fieldset">
						<h3>归档</h3>
						<div class="w-field">
							<label for="wm-cats">分类 <code>categories</code></label>
							<input id="wm-cats" :value="listText('categories')" placeholder="生活" @change="setList('categories', ($event.target as HTMLInputElement).value)">
							<small>多个分类用逗号分隔</small>
						</div>
						<div class="w-field">
							<label for="wm-tags">标签 <code>tags</code></label>
							<input id="wm-tags" :value="listText('tags')" placeholder="随笔, 记录" @change="setList('tags', ($event.target as HTMLInputElement).value)">
							<small>多个标签用逗号分隔</small>
						</div>
						<div class="w-field w-field-row">
							<div>
								<label>版式 <code>type</code></label>
								<EditorSelectMenu v-model="meta.type" :options="TYPE_OPTIONS" @update:model-value="onMetaChange" />
							</div>
							<div>
								<label>状态 <code>draft</code></label>
								<EditorSelectMenu
									:model-value="String(meta.draft)"
									:options="DRAFT_OPTIONS"
									@update:model-value="(v: string) => { meta.draft = v === 'true'; onMetaChange() }"
								/>
							</div>
						</div>
					</section>
					<section class="w-fieldset">
						<h3>时间</h3>
						<div class="w-field">
							<label>发布日期 <code>date</code></label>
							<div class="w-datetime">
								<EditorDateTimePicker :model-value="meta.date" @update:model-value="setDate('date', $event)" />
								<button class="w-now-btn" data-tip="设为当前时间" @click="setDateNow('date')"><Icon name="tabler:clock" />现在</button>
							</div>
						</div>
						<div class="w-field">
							<label>更新日期 <code>updated</code></label>
							<div class="w-datetime">
								<EditorDateTimePicker :model-value="meta.updated" @update:model-value="setDate('updated', $event)" />
								<button class="w-now-btn" data-tip="设为当前时间" @click="setDateNow('updated')"><Icon name="tabler:clock" />现在</button>
							</div>
						</div>
						<small class="w-field-note">点击日期框弹出选择器，写回格式为 YYYY-MM-DD HH:mm:ss</small>
					</section>
					<section class="w-fieldset">
						<h3>高级选项</h3>
						<div class="w-field">
							<label for="wm-image">封面 <code>image</code></label>
							<input id="wm-image" v-model="meta.image" placeholder="https://…（推荐 2:1）" @input="onMetaChange">
						</div>
						<div class="w-field">
							<label for="wm-permalink">自定义链接 <code>permalink</code></label>
							<input id="wm-permalink" v-model="meta.permalink" placeholder="/posts/xxx" @input="onMetaChange">
						</div>
						<div class="w-field">
							<label for="wm-password">访问密码 <code>password</code></label>
							<input id="wm-password" v-model="meta.password" type="password" placeholder="留空则不加密" @input="onMetaChange">
						</div>
						<div class="w-field">
							<label for="wm-aside">侧栏组件 <code>aside</code></label>
							<input id="wm-aside" :value="listText('aside')" placeholder="toc" @change="setList('aside', ($event.target as HTMLInputElement).value)">
						</div>
					</section>
				</div>
				<footer class="w-drawer-foot">
					<button class="w-btn is-primary" @click="showMeta = false"><Icon name="tabler:check" /> 完成</button>
				</footer>
			</aside>
		</div>

		<!-- ======== MDC 组件库：独立弹层（左列表 + 右详情） ======== -->
		<div v-if="showPalette" class="w-palette-scrim" @click.self="showPalette = false">
			<div class="w-palette">
				<div class="w-palette-search">
					<span class="w-palette-prompt">::</span>
					<input
						v-model="paletteQuery"
						autofocus
						placeholder="搜索 MDC 组件，例如 alert、pics、mermaid"
						@keydown="onPaletteKey"
					>
					<kbd>Esc</kbd>
				</div>
				<div class="w-palette-body">
					<div class="w-palette-list">
						<template v-for="group in SNIPPET_GROUPS" :key="group">
							<h3 v-if="filteredSnippets.some(s => s.group === group)">{{ group }}</h3>
							<button
								v-for="s in filteredSnippets.filter(x => x.group === group)"
								:key="s.label"
								class="w-palette-item"
								:class="{ 'is-active': currentSnippet?.label === s.label }"
								@mouseenter="paletteCursor = filteredSnippets.indexOf(s)"
								@click="insertSnippet(s)"
							>
								<Icon :name="s.icon" />
								<span class="w-palette-name">{{ s.label }}</span>
								<span class="w-palette-desc">{{ s.desc }}</span>
							</button>
						</template>
						<p v-if="!filteredSnippets.length" class="w-palette-empty">没有找到相关组件</p>
					</div>
					<aside v-if="currentSnippet" class="w-palette-detail">
						<p class="w-palette-detail-title">
							{{ currentSnippet.label }} <span>{{ currentSnippet.syntax }}</span>
						</p>
						<p class="w-palette-label">语法</p>
						<code class="w-palette-syntax">{{ currentSnippet.syntax }}</code>
						<p class="w-palette-label">将插入</p>
						<pre class="w-palette-preview">{{ currentSnippet.template.replace('$0', '') }}</pre>
						<p class="w-palette-hint">点击或回车插入 · ↑↓ 选择 · Esc 关闭</p>
					</aside>
				</div>
			</div>
		</div>

		<!-- ======== 关于本站 ======== -->
		<div v-if="showAbout" class="w-scrim w-export-scrim" @click.self="showAbout = false">
			<div class="w-about">
				<header class="w-about-head">
					<img src="/carrot.svg" alt="">
					<div>
						<h2>关于 blog writing@jie</h2>
						<p>为博客 box.yangjie.site 写的专用写作工作台</p>
					</div>
					<button class="w-icon-btn" data-tip="关闭" @click="showAbout = false"><Icon name="tabler:x" /></button>
				</header>

				<div class="w-about-body">
					<p class="w-about-lead">
						左边写 Markdown 与 MDC 组件，右边实时预览成博客文章的样子。预览复用博客同一套 remark/rehype 插件与组件，所见即所得，不是近似渲染。
					</p>

					<div class="w-about-warning">
						<Icon name="tabler:alert-triangle" />
						<div>
							<strong>文章不上传云端，只保存在你自己的浏览器里</strong>
							<p>
								使用浏览器本地存储（localStorage）自动保存，有容量上限。
								<b>请不要清除本站缓存 / 站点数据</b>，清除后文章无法恢复。
								请养成习惯：写完及时点「导出 .md」，把文件放进博客仓库，才算真正安全。
							</p>
						</div>
					</div>

					<dl class="w-about-meta">
						<div><dt>作者</dt><dd><a href="https://www.yangjie.site" target="_blank" rel="noopener noreferrer">youngdajie <Icon name="tabler:external-link" /></a></dd></div>
						<div><dt>作者主页</dt><dd><a href="https://www.yangjie.site" target="_blank" rel="noopener noreferrer">www.yangjie.site <Icon name="tabler:external-link" /></a></dd></div>
						<div><dt>项目地址</dt><dd><a href="https://cnb.cool/youngdajie/edit.yangjie.site" target="_blank" rel="noopener noreferrer">cnb.cool/youngdajie/edit.yangjie.site <Icon name="tabler:external-link" /></a></dd></div>
						<div><dt>线上站点</dt><dd><a href="https://edit.yangjie.site" target="_blank" rel="noopener noreferrer">edit.yangjie.site <Icon name="tabler:external-link" /></a></dd></div>
						<div><dt>开源协议</dt><dd>MIT · 启发自 stellar-writing</dd></div>
					</dl>
				</div>

				<footer class="w-about-foot">
					<button class="w-btn is-primary" @click="showAbout = false"><Icon name="tabler:check" /> 知道了</button>
				</footer>
			</div>
		</div>

		<!-- ======== 新建文章弹窗 ======== -->
		<div v-if="showNewDialog" class="w-scrim w-export-scrim" @click.self="showNewDialog = false">
			<div class="w-export-dialog">
				<header class="w-export-head">
					<Icon name="tabler:file-plus" />
					<div>
						<h2>新建文章</h2>
						<p>先定好标题与文件名；当前文章会自动存入文章库</p>
					</div>
				</header>
				<div class="w-export-body">
					<div class="w-field">
						<label for="wm-new-title">① 文章标题</label>
						<input id="wm-new-title" v-model="newTitleInput" autofocus placeholder="我的第一篇文章">
						<small>会写入 frontmatter 的 title，可随时在「文章设置」里改</small>
					</div>
					<div class="w-field">
						<label for="wm-new-name">② .md 文件名（纯英文）</label>
						<input
							id="wm-new-name"
							v-model="newNameInput"
							placeholder="Infinite possibilities in the future"
							@input="newNameTouched = true"
							@blur="onNewNameBlur"
							@keydown.enter="confirmNewArticle"
						>
						<small>纯英文、字母开头；空格与符号自动转成连字符，大小写原样保留；导出前还会再检查一次</small>
					</div>
					<!-- 含中文：报错 + 搜狗翻译跳转，且禁止创建 -->
					<div v-if="newNameHasForeign" class="w-name-error">
						<Icon name="tabler:alert-circle" />
						<div>
							<strong>文件名不能包含中文</strong>
							<p>请先用搜狗翻译成英文，再粘贴回这里</p>
							<a :href="newSogouUrl" target="_blank" rel="noopener noreferrer">
								去搜狗翻译 <Icon name="tabler:external-link" />
							</a>
						</div>
					</div>
					<p v-else class="w-export-hint" :class="{ 'is-valid': newNameValid, 'is-invalid': !newNameValid }">
						<template v-if="!newNameValid"><Icon name="tabler:alert-circle" /> 请填写纯英文文件名（字母开头）</template>
						<template v-else><Icon name="tabler:circle-check" /> 合规</template>
					</p>
					<div v-if="!newNameHasForeign" class="w-export-preview">
						<span>将创建</span><code>{{ normalizedNewName }}</code>
						<small>对应博客 content/posts/&lt;年份&gt;/ 下的文件</small>
					</div>
				</div>
				<footer class="w-export-foot">
					<button class="w-btn" @click="showNewDialog = false">取消</button>
					<button class="w-btn is-primary" :disabled="!newNameValid" @click="confirmNewArticle">
						<Icon name="tabler:check" /> 创建
					</button>
				</footer>
			</div>
		</div>

		<!-- ======== 导出重命名弹窗 ======== -->
		<div v-if="showExportDialog" class="w-scrim w-export-scrim" @click.self="showExportDialog = false">
			<div class="w-export-dialog">
				<header class="w-export-head">
					<Icon name="tabler:file-export" />
					<div>
						<h2>导出 Markdown 文件</h2>
						<p>文件名必须符合博客规范：纯英文、字母开头、连字符分隔，大小写随意</p>
					</div>
				</header>
				<div class="w-export-body">
					<label for="wm-export-name">文件名（不带 .md）</label>
					<input
						id="wm-export-name"
						v-model="exportNameInput"
						autofocus
						placeholder="Infinite possibilities in the future"
						@blur="onExportNameBlur"
						@keydown.enter="confirmExport"
					>
					<div v-if="exportNameHasForeign" class="w-name-error">
						<Icon name="tabler:alert-circle" />
						<div>
							<strong>文件名不能包含中文</strong>
							<p>请先用搜狗翻译成英文，再粘贴回这里</p>
							<a :href="exportSogouUrl" target="_blank" rel="noopener noreferrer">
								去搜狗翻译 <Icon name="tabler:external-link" />
							</a>
						</div>
					</div>
					<p v-else class="w-export-hint" :class="{ 'is-valid': exportNameValid, 'is-invalid': !exportNameValid }">
						<template v-if="!exportNameValid"><Icon name="tabler:alert-circle" /> 只能使用英文字母、数字和连字符，且以字母开头</template>
						<template v-else><Icon name="tabler:circle-check" /> 合规</template>
					</p>
					<div v-if="!exportNameHasForeign" class="w-export-preview">
						<span>实际导出为</span><code>{{ normalizedExportName }}</code>
						<small>空格与符号会自动转成连字符，大小写原样保留</small>
					</div>
				</div>
				<footer class="w-export-foot">
					<button class="w-btn" @click="showExportDialog = false">取消</button>
					<button class="w-btn is-primary" :disabled="!exportNameValid" @click="confirmExport"><Icon name="tabler:download" /> 导出</button>
				</footer>
			</div>
		</div>

		<Transition name="toast">
			<div v-if="toast" class="w-toast"><Icon name="tabler:circle-check" />{{ toast }}</div>
		</Transition>

		<!-- 自定义 tooltip：Teleport 到 body，不受顶栏 overflow 裁剪 -->
		<Teleport to="body">
			<Transition name="tip">
				<div
					v-if="tipVisible"
					class="w-tip"
					:class="{ 'is-above': tipAbove }"
					:style="{ left: `${tipX}px`, top: `${tipY}px` }"
				>
					<strong v-if="tipLines[0]">{{ tipLines[0] }}</strong>
					<span v-for="(line, i) in tipLines.slice(1)" :key="i">{{ line }}</span>
				</div>
			</Transition>
		</Teleport>
	</div>
</template>
