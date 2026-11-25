/**
 * 轻量自定义 tooltip：替代浏览器原生 title。
 * 事件委托到 document，Teleport 到 body，因此不会被顶栏/工具栏的 overflow:hidden 裁掉。
 * 首行当标题、其余行当说明，悬停短延迟出现，离开即隐藏；触摸设备不显示。
 */
export function useTooltip() {
	const text = ref('')
	const visible = ref(false)
	const x = ref(0)
	const y = ref(0)
	const above = ref(false)
	/** 箭头相对浮层左边缘的位置：浮层被推到一边时，箭头仍指着触发元素 */
	const arrowLeft = ref(0)
	/** 绑到浮层根节点，用于测量真实宽度 */
	const tipEl = ref<HTMLElement | null>(null)

	const lines = computed(() => text.value.split('\n').filter(Boolean))

	let showTimer: ReturnType<typeof setTimeout> | null = null
	let current: HTMLElement | null = null

	const EDGE = 8

	/** 按浮层实际宽度修正水平位置，并同步箭头偏移 */
	function align(el: HTMLElement) {
		const rect = el.getBoundingClientRect()
		const width = tipEl.value?.offsetWidth || 160
		const half = width / 2
		const center = rect.left + rect.width / 2
		const left = Math.min(window.innerWidth - half - EDGE, Math.max(half + EDGE, center))
		x.value = left
		// 箭头落在浮层内的位置，留出圆角空间避免贴边
		arrowLeft.value = Math.min(width - 16, Math.max(16, center - (left - half)))

		const roomBelow = window.innerHeight - rect.bottom
		above.value = roomBelow < 90
		y.value = above.value ? Math.max(EDGE, rect.top - 9) : rect.bottom + 9
	}

	function show(el: HTMLElement) {
		const value = el.dataset.tip
		if (!value) return
		if (current === el && visible.value) return
		current = el
		clear()
		showTimer = setTimeout(async () => {
			text.value = value
			// 先按触发元素中心粗定位渲染出来，再依据真实宽度精修一次
			const rect = el.getBoundingClientRect()
			x.value = rect.left + rect.width / 2
			y.value = rect.bottom + 9
			above.value = false
			visible.value = true
			await nextTick()
			align(el)
		}, 90)
	}

	function clear() {
		if (showTimer) clearTimeout(showTimer)
		showTimer = null
		visible.value = false
		current = null
	}

	function onOver(e: MouseEvent) {
		// 触摸设备没有 hover，直接跳过
		if (window.matchMedia('(hover: none)').matches) return
		const el = (e.target as HTMLElement)?.closest?.('[data-tip]') as HTMLElement | null
		if (!el) { clear(); return }
		show(el)
	}

	function onOut(e: MouseEvent) {
		const el = (e.target as HTMLElement)?.closest?.('[data-tip]') as HTMLElement | null
		if (!el) return
		const next = e.relatedTarget as HTMLElement | null
		// 在同一提示块内部移动不隐藏
		if (next && el.contains(next)) return
		clear()
	}

	function onFocusIn(e: FocusEvent) {
		const el = (e.target as HTMLElement)?.closest?.('[data-tip]') as HTMLElement | null
		if (el) show(el)
	}
	function onScroll() { clear() }

	onMounted(() => {
		document.addEventListener('mouseover', onOver)
		document.addEventListener('mouseout', onOut)
		document.addEventListener('focusin', onFocusIn)
		document.addEventListener('focusout', clear)
		window.addEventListener('scroll', onScroll, true)
	})
	onBeforeUnmount(() => {
		document.removeEventListener('mouseover', onOver)
		document.removeEventListener('mouseout', onOut)
		document.removeEventListener('focusin', onFocusIn)
		document.removeEventListener('focusout', clear)
		window.removeEventListener('scroll', onScroll, true)
		clear()
	})

	return { text, lines, visible, x, y, above, arrowLeft, tipEl, clear }
}
