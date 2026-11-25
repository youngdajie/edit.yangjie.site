<script setup lang="ts">
import { parseShuoshuoTags } from '~~/shared/utils/shuoshuo-heading'

/**
 * 说说条目（内容组件）
 *
 * 单个 `content/shuoshuo.md` 里的每条说说，经 `remark-shuoshuo` 转成
 * `<ShuoshuoItem anchor date location mood tags>`，正文作为子节点透传进来。
 * 走的是和 `::alert`、`::timeline` 完全相同的内容组件机制，
 * 因此正文里还能继续写任何 MDC 语法（`::alert`、`::pic`、图片、公式……）。
 *
 * 版式是「时间轴节点」：左侧一条竖轨穿到底，每个节点在轨道上有一个圆点，
 * 圆点与这条说说的时间行齐平；右侧是内容卡片。
 * 立体感来自三件事：竖轨、节点圆点、以及卡片自身的层次（底色 + 描边 + 行内分隔）。
 */
const props = withDefaults(defineProps<{
	/** 锚点 id，由标题里的日期时间生成，如 `2026-09-19-1630` */
	anchor?: string
	/** 规范化后的日期时间，`YYYY-MM-DD HH:mm:ss` */
	date?: string
	location?: string
	mood?: string
	/**
	 * 标签。取回来是空格拼接的字符串（minimark 存不下数组属性），
	 * 到渲染端再拆开，写法见 `parseShuoshuoTags`。
	 */
	tags?: string
	/**
	 * 该条目所在分组的年月键（如 `2026-09`），由列表页传下来。
	 *
	 * 分组标题是**跨条目共享**的，不能放在单条说说里，否则同一个月会重复显示。
	 * 但圆点和它的对齐又必须发生在条目内部，所以这里只接一个「本月第一条」的标记，
	 * 由列表页算好，避免条目自己去猜前后邻居。
	 */
	groupKey?: string
	/**
	 * 本月第一条：要渲染分组标题（年月），圆点也改为强调样式。
	 *
	 * **类型是 string 而不是 boolean，这是必须的。**
	 * 属性从 minimark 里取出来一定是字符串，而 Vue 对 `type: Boolean` 的 prop
	 * 会把**非空以外的任何字符串都当 true**，包括空串 `''`
	 * （实测：`''` → `true`，`'false'` → `false`）。
	 * 于是「不是分组首条」的条目也会被判成首条，分组标题就重复了。
	 * 声明成 string、由组件自己判定，语义才可控。
	 */
	groupHead?: string
}>(), {
	location: '',
	mood: '',
	groupKey: '',
	groupHead: '',
})

/** 只有显式传 `'true'` 才算分组首条 */
const isGroupHead = computed(() => props.groupHead === 'true')

const tagList = computed(() => parseShuoshuoTags(props.tags))

const zdt = computed(() => {
	try {
		return props.date ? toZonedTemporal(props.date) : null
	}
	catch {
		return null
	}
})

/** 悬停提示里给出精确到分钟的绝对时间 */
const absoluteTime = computed(() => zdt.value
	? toZdtLocaleString(zdt.value, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' })
	: props.date,
)

/** 分组标题，如「2026 年 9 月」 */
const groupCaption = computed(() => props.groupKey ? formatShuoshuoMonthFull(props.groupKey) : '')

/**
 * 锚点指向「整条说说」而不是卡片内部，
 * 这样 `#2026-09-19-1630` 跳进来时，时间与正文一起进入视口。
 * DOM id 就是裸锚点本身，与复制出去的短链完全一致。
 */
const id = computed(() => props.anchor || undefined)

/**
 * 卡片右上角「复制本条链接」用的完整地址。
 * 站点根域名取自 blogConfig（已摊进 appConfig），拼出来形如
 * `https://box.yangjie.site/shuoshuo#2026-11-17-2147`。
 */
const appConfig = useAppConfig()
const permalink = computed(() => props.anchor
	? new URL(`${SHUOSHUO_PATH}#${props.anchor}`, appConfig.url).href
	: '')
const { copy, copied } = useCopy(permalink.value)

/**
 * 折叠后的**卡片总高**（px）。
 *
 * 一条说说带两三张竖图时，手机上图片组是上下堆叠的，一整条能撑到 900px 以上，
 * 时间轴会被一张卡片占满。超过这个高度就默认收起，留一个「展开」。
 *
 * 约束直接加在 `.shuoshuo-card` 上（`max-height`），卡片内部用 flex 分配：
 * 元信息行和「展开」按钮按内容占高，中间那层正文吃掉剩余空间。
 * 这样不用在 JS 里算「380 减去边框、内边距、元信息行」——
 * 那种算法依赖测量时机，字体或行数一变就偏，实测差了 40 多像素。
 */
const CLIP_HEIGHT = 380

/**
 * 展开 / 收起过渡时长（毫秒）。
 *
 * 必须与 `.shuoshuo-card` 上的 `--clip-duration` 一致 —— 这里用它给
 * `transitionend` 兜底：过渡被取消、元素不可见、或者样式被外部改写时
 * 结束事件都不会来，只能靠超时把 `max-height` 收尾成 `none`。
 */
const CLIP_DURATION = 400

/** 内容自然高度所在的元素：它在裁切容器内部，量到的始终是完整高度 */
const innerEl = ref<HTMLElement | null>(null)
const clipEl = ref<HTMLElement | null>(null)
const cardEl = ref<HTMLElement | null>(null)
const expanded = ref(false)
/** 内容是否真的超过可用高度 —— 决定要不要出按钮 */
const overflowing = ref(false)
/**
 * 卡片当前的 `max-height` 取值，有且只有三种：
 * `380px`（收起）、`<measure>px`（正在过渡到实测高度）、`none`（展开到位）。
 *
 * **为什么展开到位后是 `none` 而不是像素值**：展开之后内容高度仍会变 ——
 * 正文里的图片可能还在下载、手机横竖屏切换会重新排版。只要 `max-height`
 * 还钉在某个像素上，这两种情况要么把内容裁掉，要么逼着 `ResizeObserver`
 * 在过渡中途改写高度，于是出现「展开到一半又跳一下」。放成 `none` 之后
 * 高度由内容自己撑，过渡只发生在「380 ↔ 实测高度」这一段，曲线不会再被改写。
 */
const maxHeight = ref(`${CLIP_HEIGHT}px`)

let resizeObserver: ResizeObserver | null = null
let settleTimer: ReturnType<typeof setTimeout> | undefined

function cancelSettle() {
	if (settleTimer !== undefined) {
		clearTimeout(settleTimer)
		settleTimer = undefined
	}
}

/** 过渡结束后收尾：把像素高度放成 `auto`，此后内容再长也不会被裁 */
function settleExpanded() {
	cancelSettle()
	if (expanded.value)
		maxHeight.value = 'none'
}

/** 卡片上还挂着 border-color / background-color / box-shadow，只认 max-height */
function onCardTransitionEnd(event: TransitionEvent) {
	if (event.propertyName === 'max-height' && event.target === cardEl.value)
		settleExpanded()
}

/**
 * 卡片完全展开时的高度。
 *
 * 不能用 `card.scrollHeight` —— 卡片是 `overflow: hidden` + `max-height: 380`，
 * 滚动高度同样被钳在 380，拿它当展开上限等于没展开（实测展开后还是 378px）。
 * 得自己算：当前可见高度 + 被裁掉的那部分。
 */
function naturalCardHeight() {
	const card = cardEl.value
	const clip = clipEl.value
	const inner = innerEl.value
	if (!card || !clip || !inner)
		return CLIP_HEIGHT
	return card.offsetHeight + Math.max(0, inner.offsetHeight - clip.clientHeight)
}

/**
 * 重新测量。
 *
 * 判断依据是「正文需要多高」对比「裁切层实际给了多高」：
 * 不能读 `card.scrollHeight` —— 卡片是 flex 容器 + `overflow: hidden`，
 * 子元素被压缩后并不会产生溢出，scrollHeight 恒等于 380，永远判不出超没超。
 *
 * 说话说里的图片是 `loading="lazy"`，滚到视口才开始下载、下载完高度才确定，
 * 所以不能只在挂载时量一次 —— 用 ResizeObserver 盯住内容元素，图片撑开时再量。
 *
 * **展开态直接返回**：此时 `max-height` 是 `none`（或正在过渡到实测值），
 * 高度本来就跟内容走，再改写只会打断过渡曲线。
 */
function measure() {
	const inner = innerEl.value
	const clip = clipEl.value
	if (!inner || !clip)
		return

	if (expanded.value)
		return

	overflowing.value = inner.offsetHeight > clip.clientHeight + 1
}

onMounted(async () => {
	await nextTick()
	measure()

	if (innerEl.value && typeof ResizeObserver !== 'undefined') {
		resizeObserver = new ResizeObserver(() => measure())
		resizeObserver.observe(innerEl.value)
	}
})

onUnmounted(() => {
	resizeObserver?.disconnect()
	resizeObserver = null
	cancelSettle()
})

/**
 * 每次点击自增的令牌，用来丢弃「已被后续点击接管」的那次操作。
 *
 * 收起路径中间有一句 `await nextTick()`（要先把 `none` 落成像素高度，见下），
 * 微任务恢复前同一帧里的后续点击会插进来。没有令牌时的事故是这样：
 *   1. 第一次点击收起 → 挂起在 await 上，`expanded` 已经是 false；
 *   2. 同一帧第二次点击 → 看到 false 就走展开分支，把目标设成实测高度并挂上
 *      settle 定时器；
 *   3. 第一次点击的微任务恢复 → 继续把 `max-height` 写成 `380px`；
 *   4. 卡片收回到 380，约 480ms 后定时器触发 → 放成 `none` → 一帧瞬弹回全高。
 * 所以恢复时校验令牌：这次操作如果已经不是最新的，就什么都不要再改。
 */
let toggleToken = 0

/**
 * 展开 / 收起。
 *
 * 两条都要注意「起点」：`max-height` 从 `none` 变到 `380px` 是不可插值的，
 * 浏览器会直接瞬跳。所以**收起时必须先把 `none` 落成当前像素高度**，
 * 强制一次重排把该值记为过渡起点，再改到 380 —— 否则收起就是「啪」地一下。
 */
async function toggleClip() {
	cancelSettle()
	const card = cardEl.value
	const token = ++toggleToken

	if (!expanded.value) {
		// 展开：先量真实高度再交给 CSS 过渡，目标值是确定的，中途不再改写
		expanded.value = true
		maxHeight.value = `${naturalCardHeight()}px`
		// transitionend 兜底（过渡被取消时不会触发）
		settleTimer = setTimeout(settleExpanded, CLIP_DURATION + 80)
		return
	}

	expanded.value = false
	// 只有「展开到位」（max-height 已放成 none）才需要先钉成像素高度拿过渡起点；
	// 过渡中途反向点击时当前值本来就是像素，直接改目标值即可，少等一帧更跟手
	if (card && maxHeight.value === 'none') {
		maxHeight.value = `${card.offsetHeight}px`
		await nextTick()
		// 这一帧里又点过（收起 → 展开）：后来的那次说了算，这里不能再写 380px
		if (token !== toggleToken)
			return
		// 强制重排：让浏览器把「当前像素高度」记为过渡起点
		void card.offsetHeight
	}
	maxHeight.value = `${CLIP_HEIGHT}px`
}

const cardStyle = computed(() => ({
	maxHeight: maxHeight.value,
}))
</script>

<template>
<article :id class="shuoshuo-item" :class="{ 'shuoshuo-item-head': isGroupHead }">
	<!-- 轨道：竖线 + 圆点。装饰性内容，对读屏隐藏 -->
	<div class="shuoshuo-rail" aria-hidden="true">
		<span class="shuoshuo-dot" />
	</div>

	<div class="shuoshuo-main">
		<!-- 分组标题：本月第一条才出现，圆点与这一行对齐 -->
		<p v-if="isGroupHead && groupCaption" class="shuoshuo-caption">
			{{ groupCaption }}
		</p>

		<div ref="cardEl" class="shuoshuo-card" :style="cardStyle" @transitionend="onCardTransitionEnd">
			<header class="shuoshuo-meta">
				<UtilDate
					v-if="date"
					:tip-transform="() => `发布于${absoluteTime}`"
					:date
					icon="tabler:clock"
				/>

				<span v-if="location" class="shuoshuo-meta-item">
					<Icon name="tabler:map-pin" />
					{{ location }}
				</span>

				<span v-if="mood" class="shuoshuo-meta-item">
					<Icon name="tabler:mood-edit" />
					{{ mood }}
				</span>

				<button
					v-if="anchor"
					v-tip="copied ? '已复制到剪贴板' : '复制本条链接'"
					class="shuoshuo-permalink"
					type="button"
					:aria-label="copied ? '链接已复制' : `复制本条说说的链接：${absoluteTime}`"
					@click="copy()"
				>
					<Icon :name="copied ? 'tabler:check' : 'tabler:link'" />
				</button>
			</header>

			<!--
				正文折叠：超出 CLIP_HEIGHT 时默认收起。
				用 max-height 裁切而不是 v-show 整块隐藏 —— 收起时仍能读到开头几句和第一张图，
				读者据此决定要不要展开；整块藏起来会让人不知道这条说说有没有内容。
			-->
			<div
				ref="clipEl"
				class="shuoshuo-clip"
				:class="{ 'is-clipped': overflowing && !expanded }"
			>
				<div ref="innerEl" class="shuoshuo-clip-inner">
					<div class="article shuoshuo-body">
						<slot />
					</div>

					<footer v-if="tagList.length" class="shuoshuo-tags">
						<span v-for="tag in tagList" :key="tag" class="shuoshuo-tag">
							#{{ tag }}
						</span>
					</footer>
				</div>
			</div>

			<button
				v-if="overflowing"
				class="shuoshuo-more"
				type="button"
				:aria-expanded="expanded"
				@click="toggleClip"
			>
				<Icon class="more-icon" :class="{ expanded }" name="tabler:chevrons-down" />
				<span>{{ expanded ? '收起' : '展开' }}</span>
			</button>
		</div>
	</div>
</article>
</template>

<style scoped>
/**
 * 轨道几何。数值集中在这里，改粗细只需动这几个变量。
 *
 * `--rail` 是轨道列的宽度，`--dot` 是圆点直径，
 * `--caption-size` / `--caption-leading` 是分组标题的字号与行高 ——
 * 圆点的垂直位置由它们算出，所以标题样式必须引用同一组变量。
 *
 * 颜色刻意比 `--c-border` 重一档：分隔线太浅时整条时间轴会「看不见」，
 * 立体感也就没了。轨道用 `--c-text-3` 的淡版本，靠透明度拉开层次。
 */
.shuoshuo-item {
	/* 与 color.css 的 --c-primary-soft 透明度保持一致（浅 15% / 深 22%），用来把聚焦底色混成不透明色；改那边时记得同步这里 */
	--focus-tint: 15%;
	--rail: 30px;
	--line-w: 2px;
	--dot: 11px;
	--caption-size: 0.95rem;
	--caption-leading: 1.5;
	--rail-color: var(--c-text-3);
	/* 竖线的不透明度。调低会「消失」，调高会抢正文注意力，0.55 是实测的平衡点 */
	--rail-line-opacity: 0.55;

	display: grid;
	grid-template-columns: var(--rail) minmax(0, 1fr);
	align-items: start;
	/* 锚点跳转时给头部留出呼吸位，避免标题行紧贴页面顶端 */
	scroll-margin-top: 1.5rem;

	@media (width <= 480px) {
		--rail: 24px;
		--dot: 9px;
	}
}

/* Vue scoped 会把 `:global(.dark) .shuoshuo-item` 编译成孤立的 `.dark{}`，
   必须把整条选择器都包进 :global()，否则深色下的 22% 根本落不到条目上 */
:global(.dark .shuoshuo-item) {
	--focus-tint: 22%;
}

/**
 * 轨道列。
 *
 * 竖线用 `::before` 画满整列（top: 0 到 bottom: 0），
 * 这样它天然贯穿分组边界、也不需要知道整条时间轴有多高；
 * 圆点用 `::after` 定位到分组标题的首行中心。
 *
 * 首尾两端的处理：第一条的线从圆点开始，最后一条的线到圆点结束，
 * 否则列表上下会各拖出半截「无主」的线。
 */
.shuoshuo-rail {
	align-self: stretch;
	justify-self: center;
	position: relative;
	width: var(--line-w);

	/* 竖线。用当前文字色加透明度而不是 --c-border：后者太浅，整条轴线会看不见 */
	&::before {
		content: "";
		position: absolute;
		opacity: var(--rail-line-opacity);
		inset: 0;
		background-color: var(--rail-color);
	}

	/* 圆点。分组首条实心强调，同组的其余条目用空心小点，层次拉开 */
	&::after {
		content: "";
		position: absolute;
		top: calc(var(--caption-size) * var(--caption-leading) / 2 - var(--dot) / 2);
		left: 50%;
		width: var(--dot);
		height: var(--dot);
		border-radius: 50%;
		/* 与页面底色描一圈，让竖线在节点处断开，避免线从点中间穿过 */
		box-shadow: 0 0 0 3px var(--c-bg);
		background-color: var(--rail-color);
		translate: -50% 0;
	}

	/* 没有分组标题的条目，圆点改与时间行的行盒中心对齐 */
	.shuoshuo-item:not(.shuoshuo-item-head) &::after {
		--meta-size: 0.82rem;
		--meta-leading: 1.4;
		top: calc(var(--meta-size) * var(--meta-leading) / 2 - var(--dot) / 2);
		box-shadow: 0 0 0 2px var(--rail-color);
		background-color: var(--c-bg);
	}
}

.shuoshuo-main {
	min-width: 0;
	/* 内容列与轨道之间留出间距 */
	padding-left: 0.9rem;
}

.shuoshuo-caption {
	margin: 0 0 0.7rem;
	/* 字号与行高必须与轨道列的对齐算式共用同一组变量，否则圆点会漂移 */
	font-size: var(--caption-size);
	font-weight: 550;
	line-height: var(--caption-leading);
	color: var(--c-text-2);
}

/**
 * 卡片主体。
 *
 * 立体感靠三层叠出来：底色抬一档、描边收边、再压一层很淡的投影。
 * 投影用 `--c-text-3` 的低透明度而不是纯黑，
 * 这样暗色模式下也不会糊成一团黑边。
 *
 * 同分组内的后续条目保持同样的卡片，但左侧贴近轨道处收一点圆角，
 * 读起来像「挂在同一根轴上的一串」。
 *
 * 折叠 / 展开的时长与曲线放在 `--clip-duration` / `--clip-easing`：
 * 底部遮罩（`.shuoshuo-clip::after`）与卡片共用这一组，两者才会同时开始、同时结束。
 *
 * 曲线原来用的是 `cubic-bezier(0.22, 1, 0.36, 1)`（easeOutQuint）—— 开头极快、尾巴拖长。
 * 实测 390×844 下 380 → 2484 的展开，头 48ms 就冲掉了 37% 的距离（380 → 1171），
 * 后面 400ms 只在慢慢爬，观感是「先猛跳一下、再缓缓蹭开」；收起同理
 * （2484 → 1133 只花了 90ms，像被一下拍回去）。换成 Material 的标准曲线后
 * 起步与收尾都更匀，配 0.4s 读起来是「推开」而不是「弹开」。
 */
.shuoshuo-card {
	--clip-duration: 0.4s;
	--clip-easing: cubic-bezier(0.4, 0, 0.2, 1);
	/* 卡片当前底色：折叠遮罩渐变必须引用它 —— 聚焦时卡片换成 --c-primary-soft，写死默认底色会露出色带 */
	--card-bg: var(--c-bg-2);

	/* 隔离内部布局/绘制：展开动画每帧都在改高度，不让它把重排扩散到时间轴之外 */
	contain: layout;
	display: flex;
	flex-direction: column;
	position: relative;
	overflow: hidden;
	padding: 0.85rem 1rem;
	border: 1px solid var(--c-border);
	border-radius: 0.6rem;
	box-shadow: 0 1px 2px color-mix(in srgb, var(--c-text-3) 12%, transparent);
	background-color: var(--card-bg);
	/* max-height 由 `cardStyle` 写入：收起是常量 380，展开先到实测高度、到位后放成 none */
	transition: max-height var(--clip-duration) var(--clip-easing), border-color 0.2s, background-color 0.3s, box-shadow 0.2s;
	z-index: 0;

	&::before {
		opacity: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		&::before { animation: none !important; }
	}

	&:hover {
		box-shadow: 0 2px 8px color-mix(in srgb, var(--c-text-3) 20%, transparent);
	}
}

/* 命中锚点时整条短暂高亮，帮助定位 */
.shuoshuo-item:target .shuoshuo-card {
	/* 用不透明的主题色按 soft 的透明度混到页面底色上：卡片与底部遮罩共用这一个不透明色，渐隐才和正常状态一样盖得住文字（直接拿 soft 色渐变 = 15%→0 不透明度，几乎没有遮盖力） */
	--card-bg: color-mix(in srgb, var(--c-primary) var(--focus-tint), var(--c-bg));

	border-color: var(--c-primary);
	box-shadow: 0 0 0 3px color-mix(in srgb, var(--c-primary) 12%, transparent), 0 4px 18px color-mix(in srgb, var(--c-primary) 12%, transparent);
	/* 聚焦态只保留展开高度的过渡：背景/边框/阴影立即到位，不再和 glow、正文展开抢节奏 */
	transition: max-height var(--clip-duration) var(--clip-easing);
}

/* 直达锚点时，柔和高亮整条正文；blur 在单独伪元素层，避免影响卡片文字清晰度。 */
.shuoshuo-item:target .shuoshuo-card::before {
	content: "";
	position: absolute;
	inset: -0.5rem;
	border-radius: inherit;
	background: color-mix(in srgb, var(--c-primary) 16%, transparent);
	animation: shuoshuo-focus-glow 1.2s ease-out both;
	filter: blur(1rem);
	pointer-events: none;
	z-index: -1;
}

@keyframes shuoshuo-focus-glow {
	0% {
		opacity: 0;
		transform: scale(0.96);
	}

	25% {
		opacity: 1;
		transform: scale(1);
	}

	100% {
		opacity: 0;
		transform: scale(1.04);
	}
}

.shuoshuo-meta {
	display: flex;
	/* 卡片收紧时元信息行不该被压扁，只有正文那层可以缩 */
	flex-shrink: 0;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.2rem 0.9rem;
	margin-bottom: 0.6em;
	font-size: 0.82em;
	line-height: 1.4;
	color: var(--c-text-3);

	> :where(span, a) {
		display: inline-flex;
		align-items: center;
		gap: 0.25em;
	}
}

.shuoshuo-permalink {
	display: flex;
	flex-shrink: 0;
	align-items: center;
	opacity: 0;
	margin-inline-start: auto;
	padding: 0;
	border: none;
	background: none;
	color: var(--c-text-3);
	transition: opacity 0.2s, color 0.2s;
	cursor: pointer;

	.shuoshuo-item:hover &, &:focus-visible {
		opacity: 0.7;
	}

	&:hover {
		color: var(--c-primary);
	}
}

/**
 * 折叠容器。
 *
 * 自身**不设 max-height**：高度由外层卡片的 `max-height` 决定，
 * 它靠 `flex: 1 1 auto` 吃掉「380 减去元信息行和按钮」之后的剩余空间。
 * 这样「总高 380」由浏览器算，不受字体、换行、内边距变化影响。
 *
 * 底部渐隐层常驻、只切 `opacity`：直接靠 class 增删 `::after` 的话，
 * 展开的瞬间遮罩会「啪」地消失，和 max-height 的缓动对不上。
 *
 * 时长与曲线跟卡片共用 `--clip-duration` / `--clip-easing`：
 * 原来遮罩是 0.3s、内容是 0.45s 且曲线不同，观感是「遮罩先没了、内容还没铺开」。
 */
.shuoshuo-clip {
	flex: 1 1 auto;
	position: relative;
	overflow: hidden;
	min-height: 0;

	&::after {
		content: "";
		position: absolute;
		opacity: 0;
		inset-inline: 0;
		bottom: 0;
		height: 4.5rem;
		background: linear-gradient(to top, var(--card-bg), transparent);
		transition: opacity var(--clip-duration) var(--clip-easing);
		pointer-events: none;
	}

	&.is-clipped::after {
		opacity: 1;
	}

	/* 收起时图片不响应点击：看到的只是半张图，点开灯箱没意义；展开后才允许放大。pointer-events 会连带收掉 cursor: zoom-in */
	&.is-clipped :deep(img) {
		pointer-events: none;
	}
}

/**
 * 展开 / 收起按钮：样式对齐 `UtilExpand`（居中、小字、无边框），
 * 只多一层 hover 底色 —— 在卡片里光靠变色太弱，点不准。
 */
.shuoshuo-more {
	display: flex;
	/* 按钮也不能被压：它是唯一能把内容展开的入口 */
	flex-shrink: 0;
	align-items: center;
	gap: 0.25em;
	width: fit-content;
	margin: 0.7rem auto 0;
	padding: 0.28em 0.7em;
	border-radius: 999px;
	font-size: 0.9em;
	color: var(--c-text-2);
	transition: color var(--motion-duration) var(--motion-easing), background-color var(--motion-duration) var(--motion-easing);

	&:hover {
		background-color: var(--c-bg-3);
		color: var(--c-primary);
	}
}

.more-icon {
	font-size: 1.05em;
	transition: transform 0.3s var(--motion-easing);

	&.expanded {
		transform: scaleY(-1);
	}
}

/**
 * 正文复用 `.article` 的排版（字号、行高、标题、列表、引用、代码块等），
 * 这里只做减法：清掉卡片首尾元素的外边距，避免卡片内出现多余的上下留白。
 * 其余任何排版差异都应改在 article.css，而不是在这里覆盖。
 */
.shuoshuo-body {
	margin: 0;

	> :first-child {
		margin-top: 0;
	}

	> :last-child {
		margin-bottom: 0;
	}
}

.shuoshuo-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 0.4rem;
	margin-top: 0.7em;
	font-size: 0.8em;
	color: var(--c-primary);
}
</style>
