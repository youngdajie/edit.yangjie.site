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

	const lines = computed(() => text.value.split('\n').filter(Boolean))

	let showTimer: ReturnType<typeof setTimeout> | null = null
	let current: HTMLElement | null = null

	function place(el: HTMLElement) {
		const rect = el.getBoundingClientRect()
		// 浮层最大宽度 280px，居中后左右各留 8px
		const half = 140
		x.value = Math.min(window.innerWidth - half - 8, Math.max(half + 8, rect.left + rect.width / 2))
		const roomBelow = window.innerHeight - rect.bottom
		above.value = roomBelow < 90
		y.value = above.value ? Math.max(8, rect.top - 9) : rect.bottom + 9
	}

	function show(el: HTMLElement) {
		const value = el.dataset.tip
		if (!value) return
		if (current === el && visible.value) return
		current = el
		clear()
		showTimer = setTimeout(() => {
			text.value = value
			place(el)
			visible.value = true
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

	return { text, lines, visible, x, y, above, clear }
}
