<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { useEventListener } from '@vueuse/core'

const props = defineProps<{
	el: HTMLImageElement
	caption?: string | Component
	open?: boolean
	style?: CSSProperties
}>()

const emit = defineEmits<{
	close: []
}>()

/**
 * 灯箱。
 *
 * **为什么自己写而不用 `@bikariya/image-viewer`**：那个组件的进出场动画是
 * `el.animate({ top, left, width, height, clipPath })` —— 每一帧都在改布局属性，
 * 长页面（说说时间轴、文章多图）上浏览器被迫逐帧重排，表现就是「卡卡的，
 * 第二次也不见得好」。这里改成 **FLIP**：图片一次性摆到最终位置与尺寸，
 * 之后只动 `transform`（GPU 合成，不触发布局），进出场都是 translate + scale。
 *
 * 另外去掉了两处大面积模糊：遮罩的 `backdrop-filter: blur(4px)`（main.css）
 * 和底部说明的 `blur(1rem) saturate(2)` —— 全屏离屏渲染是动画掉帧的第二大来源。
 */

const DURATION = 380
const EASING = 'cubic-bezier(0.22, 0.68, 0.26, 1)'
const FIT_RATE = 0.9

/** 缩放 / 平移状态：手势只改这几个数，永远只作用在 transform 上 */
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const dragging = ref(false)

/** 图片的最终布局：fixed 居中，尺寸 contain 到视口 FIT_RATE */
const layout = computed(() => {
	const el = props.el
	const nw = el?.naturalWidth || el?.width || 1
	const nh = el?.naturalHeight || el?.height || 1
	const maxW = window.innerWidth * FIT_RATE
	const maxH = window.innerHeight * FIT_RATE
	const ratio = Math.min(maxW / nw, maxH / nh)
	const width = Math.round(nw * ratio)
	const height = Math.round(nh * ratio)
	return {
		left: `${Math.round((window.innerWidth - width) / 2)}px`,
		top: `${Math.round((window.innerHeight - height) / 2)}px`,
		width: `${width}px`,
		height: `${height}px`,
	}
})

const imageSrc = computed(() => props.el?.currentSrc || props.el?.src || '')

const gestureStyle = computed(() => ({
	transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
}))

/** 计算从「源图位置」到「当前灯箱位置」所需的 transform（FLIP 的起点） */
function flipTransform(img: HTMLElement) {
	const from = props.el?.getBoundingClientRect()
	if (!from || !from.width || !from.height)
		return 'scale(0.92)'
	const to = img.getBoundingClientRect()
	// 等比缩放，取较大一边，保证起点能盖住源图而不拉变形
	const scale = Math.max(from.width / to.width, from.height / to.height)
	const dx = from.left + from.width / 2 - (to.left + to.width / 2)
	const dy = from.top + from.height / 2 - (to.top + to.height / 2)
	return `translate(${dx}px, ${dy}px) scale(${scale})`
}

function onEnter(stage: Element, done: () => void) {
	const img = stage.querySelector('.lb-image') as HTMLElement | null
	if (!img) {
		done()
		return
	}
	img.style.transition = 'none'
	img.style.transform = flipTransform(img)
	img.style.opacity = '0.4'
	// 强制重排，让「起点」先落地，再交给 transition
	void img.offsetWidth
	img.style.transition = `transform ${DURATION}ms ${EASING}, opacity ${DURATION}ms ${EASING}`
	img.style.transform = ''
	img.style.opacity = '1'
	let finished = false
	let timer = 0
	const finish = () => {
		if (finished)
			return
		finished = true
		window.clearTimeout(timer)
		// 交还给 CSS：之后手势用短过渡，拖动时由 .is-dragging 关掉
		img.style.transition = ''
		img.style.opacity = ''
		img.style.transform = ''
		done()
	}
	timer = window.setTimeout(finish, DURATION + 60)
	img.addEventListener('transitionend', finish, { once: true })
}

function onLeave(stage: Element, done: () => void) {
	const img = stage.querySelector('.lb-image') as HTMLElement | null
	if (!img) {
		done()
		return
	}
	/**
	 * tooltip 的退场必须在这里做：外层 <Transition :css="false"> 在 leave 期间
	 * 会保留旧 vnode，内层的 v-if="open" 不会更新，它自己的 CSS leave 永远不触发。
	 * 进场由内层 <Transition appear> 负责，两者共用同一条时长曲线。
	 */
	const tooltip = stage.querySelector('.lb-tooltip') as HTMLElement | null
	if (tooltip) {
		tooltip.style.transition = `transform ${DURATION - 80}ms ${EASING}, opacity ${DURATION - 80}ms ${EASING}`
		tooltip.style.opacity = '0'
		tooltip.style.transform = 'translateY(1rem)'
	}
	img.style.transition = `transform ${DURATION - 80}ms ${EASING}, opacity ${DURATION - 80}ms ${EASING}`
	img.style.transform = flipTransform(img)
	img.style.opacity = '0'
	let finished = false
	let timer = 0
	const finish = () => {
		if (finished)
			return
		finished = true
		window.clearTimeout(timer)
		done()
	}
	timer = window.setTimeout(finish, DURATION)
	img.addEventListener('transitionend', finish, { once: true })
}

function resetGesture() {
	zoom.value = 1
	panX.value = 0
	panY.value = 0
}

watch(() => props.open, (open) => {
	if (open)
		resetGesture()
})

/** 滚轮缩放：只改 transform 数值 */
function onWheel(event: WheelEvent) {
	event.preventDefault()
	const next = zoom.value * (event.deltaY > 0 ? 0.9 : 1.1)
	zoom.value = Math.min(6, Math.max(0.5, next))
}

/** 双击：1x ↔ 2x */
function onDoubleClick() {
	if (zoom.value > 1) {
		resetGesture()
		return
	}
	zoom.value = 2
}

let dragStart: { x: number, y: number, panX: number, panY: number } | null = null

function onPointerDown(event: PointerEvent) {
	if (event.button !== 0)
		return
	dragging.value = true
	dragStart = { x: event.clientX, y: event.clientY, panX: panX.value, panY: panY.value }
	;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
	if (!dragging.value || !dragStart)
		return
	panX.value = dragStart.panX + (event.clientX - dragStart.x)
	panY.value = dragStart.panY + (event.clientY - dragStart.y)
}

function onPointerUp() {
	dragging.value = false
	dragStart = null
}

useEventListener('keydown', (event: KeyboardEvent) => {
	if (props.open && event.key === 'Escape')
		emit('close')
})
</script>

<template>
<Transition :css="false" @enter="onEnter" @leave="onLeave">
	<div v-if="open" class="lb-stage" :style="style">
		<img
			class="lb-image"
			:class="{ 'is-dragging': dragging }"
			:src="imageSrc"
			:style="{ ...layout, ...gestureStyle }"
			draggable="false"
			alt=""
			@wheel="onWheel"
			@dblclick="onDoubleClick"
			@pointerdown="onPointerDown"
			@pointermove="onPointerMove"
			@pointerup="onPointerUp"
			@pointercancel="onPointerUp"
		>

		<!-- appear：stage 是 v-if 新建的，子 Transition 要靠 appear 才会播放首次进场 -->
		<Transition appear>
			<div v-if="open" class="lb-tooltip">
				<span v-if="caption" class="caption">
					<component :is="() => toValue(caption)" />
				</span>
				<button class="close" aria-label="关闭灯箱" @click="emit('close')">
					<Icon name="tabler:x" />
				</button>
			</div>
		</Transition>
	</div>
</Transition>
</template>

<style scoped>
.lb-stage {
	position: fixed;
	inset: 0;
	pointer-events: none;
}

/**
 * 图片的 left/top/width/height 只在布局里给一次，
 * 之后进场、缩放、拖动全部走 transform（合成层，不重排）。
 * 平时用 180ms 短过渡让缩放平滑；拖动时由 .is-dragging 关掉过渡避免跟不上手。
 */
.lb-image {
	position: fixed;
	max-width: none;
	margin: 0;
	border-radius: 0.2rem;
	box-shadow: 0 8px 40px rgb(0 0 0 / 25%);
	transition: transform 0.18s ease-out;
	will-change: transform;
	cursor: zoom-in;
	pointer-events: auto;
	touch-action: none;
	user-select: none;
	z-index: 1;

	&.is-dragging {
		transition: none;
		cursor: grabbing;
	}
}

.lb-tooltip {
	display: flex;
	align-items: center;
	position: fixed;
	inset-inline: 0;
	bottom: clamp(2rem, 10vh, 5rem);
	width: fit-content;
	max-width: min(40rem, 80%);
	margin-inline: auto;
	border: 1px solid var(--c-border);
	border-radius: 0.5em;
	box-shadow: var(--box-shadow-2);
	/* 不做 backdrop-filter：全屏模糊比动画本身还贵 */
	background-color: var(--ld-bg-card);
	/* 说明条/关闭叉的进出场：从下往上淡入淡出。旧版动 bottom（布局属性，每帧重排），改用 transform 达到同样观感且不重排 */
	transition: transform var(--delay) var(--motion-easing), opacity var(--delay) var(--motion-easing);
	pointer-events: auto;
	z-index: 2;

	&.v-enter-from,
	&.v-leave-to {
		opacity: 0;
		transform: translateY(1rem);
	}

	.caption {
		margin-inline-end: -0.5em;
		padding: 0.5em 1em;
	}

	.close {
		align-self: stretch;
		padding: 0.5em;
		cursor: pointer;
	}
}
</style>
