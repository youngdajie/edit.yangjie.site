<script setup lang="ts">
import type { UtilImgProps } from '../util/Img.vue'

interface PicItem {
	src: string
	/** YAML 里写 `caption: 1` 会被解析成数字，所以放开类型、渲染前统一转字符串 */
	caption?: string | number
	alt?: string | number
	width?: string | number
	height?: string | number
	mirror?: UtilImgProps['mirror']
	zoom?: boolean
}

/**
 * 「多图」内容组件 —— **单图和组图都用它**（原来还有个只管单图的 `Pic`，已合并进来）。
 *
 * 版式不用选，按内容自动定：
 * 1. **只有一张图** → 单图：占满整行、**靠左**、保持原始比例（不写 `height` 时）；
 * 2. 多张图、都没写 `height` → **瀑布流**（默认），`cols` 列，每张按原始比例排下去；
 * 3. 多张图里写了 `height` → **等高网格**，每张装进等高格子里按 `cover` 铺满，
 *    整排齐整、边缘会裁掉一点。
 *
 * **为什么单图也走这里**：单图以前默认写死 `height`（`blog.config.ts` 的
 * `image.defaultHeight`），显示比例就和原图对不上了；而灯箱里放的是**完整图** ——
 * 开合的补间动画要在两个比例之间插值，于是画面会在过渡里被拉伸（实测：3200×1440
 * 的图在 266px 高时盒子比例 1.22、原图 2.22，中间那一下特别明显）。
 * 保持原始比例后，动画两端一致，过渡自然顺滑，也不再需要给第三方模块打补丁。
 */
const props = withDefaults(defineProps<{
	/**
	 * 图片数组，支持很多张，不必一个一个写组件。
	 *
	 * 之所以允许字符串：MDC 在文章里会把 YAML 数组原样传进来，但**说说正文**走的是
	 * minimark，数组/对象属性会被压成 JSON 字符串（和 `remark-shuoshuo` 里
	 * 把 tags 拼成字符串是同一个原因），所以这里两种形态都要认。
	 */
	images?: PicItem[] | string
	/** 列数（默认 3），窄屏会自动收敛到 2 列、1 列；只有一张图时固定 1 列 */
	cols?: number | string
	/** 间距，如 0.5rem / 12px */
	gap?: string
	/** 整组公共默认值：未单独设置的图片会继承 */
	zoom?: boolean
	width?: string | number
	height?: string | number
	mirror?: UtilImgProps['mirror']
}>(), {
	images: () => [],
	cols: 3,
	gap: '0.5rem',
	zoom: true,
})

/** 把 images 的各种传入形态统一成数组 */
function normalizeImages(raw: PicItem[] | string | undefined): PicItem[] {
	if (Array.isArray(raw))
		return raw
	if (typeof raw !== 'string' || !raw.trim())
		return []

	const text = raw.trim()
	// minimark 压成的 JSON 字符串，先尝试还原
	if (text.startsWith('[')) {
		try {
			const parsed: unknown = JSON.parse(text)
			if (Array.isArray(parsed))
				return parsed as PicItem[]
		}
		catch {
			// 解析不了就落到下面的纯地址列表
		}
	}
	// 兜底：允许直接写一串空白分隔的图片地址
	return text.split(/\s+/).filter(Boolean).map(src => ({ src }))
}

const items = computed(() => normalizeImages(props.images))

/** 将每张图片的属性只解析一次，避免模板重复构造绑定对象 */
const resolvedItems = computed(() => items.value.map(item => resolve(item)))

/** 只有一张图：走单图版式（单列、靠左、原始比例） */
const isSingle = computed(() => items.value.length === 1)

const imgEls = ref<Record<number, HTMLImageElement | null>>({})
const openLightbox = useLightbox()

function setRef(el: any, i: number) {
	// UtilImg 是组件，公开其内部真实 img 给灯箱做 FLIP 起始位置测量。
	imgEls.value[i] = el ? (unrefElement(el) as HTMLImageElement | null) : null
}

/**
 * 整组（或某一张）写了固定高度就走「等高网格」，否则走「瀑布流」。
 *
 * 「固定高度」这个判断决定版式，所以放在 `resolve()` 前面。
 * 单图同理：写了 `height` 就按固定高度裁切（显式选择），没写就按原始比例。
 */
const hasFixedHeight = computed(() => items.value.some(item => (item.height ?? props.height) != null))

/** 实际用哪种排布 —— 只看有没有固定高度，没有别的开关 */
const mode = computed(() => hasFixedHeight.value ? 'equal' : 'masonry')

const rootStyle = computed(() => {
	// 单图固定 1 列：否则它会挤在 3 列里的第一列，只有三分之一宽
	const cols = isSingle.value ? 1 : (Number(props.cols) || 3)
	return {
		'--pics-gap': props.gap,
		'--pics-cols': String(cols),
		// 等高网格用的最小列宽：让 auto-fit 在窄屏自然退到 2 列 / 1 列
		'--min-col': `calc((100% - ${cols - 1} * ${props.gap}) / ${cols})`,
	}
})

async function open(i: number, item: ReturnType<typeof resolve>) {
	const el = imgEls.value[i]
	const resolved = resolve(item)
	if (!el || !resolved.zoom)
		return

	// 灯箱进入动画会根据原图尺寸计算目标矩形；尺寸未知时第一次打开会先渲染
	// 0 尺寸/错误比例并触发布局修正。等待 decode 后再启动动画，后续打开直命中缓存。
	try {
		if (typeof el.decode === 'function')
			await el.decode()
	}
	catch {
		// 图片已加载/浏览器不支持解码承诺时，仍允许灯箱尝试打开。
	}
	if (!el.isConnected)
		return
	openLightbox(el, resolved.caption ?? resolved.alt)
}

function resolve(item: PicItem) {
	// 说明文字统一转成字符串：`alt` 是 String 类型的 prop，传数字 Vue 会告警
	const caption = item.caption == null ? undefined : String(item.caption)
	return {
		src: item.src,
		alt: item.alt == null ? (caption ?? '') : String(item.alt),
		caption,
		mirror: item.mirror ?? props.mirror,
		zoom: item.zoom ?? props.zoom,
		width: item.width ?? props.width,
		height: item.height ?? props.height,
	}
}
</script>

<template>
<div v-if="items.length" class="pics" :class="[mode, { single: isSingle }]" :style="rootStyle">
	<figure v-for="(item, i) in resolvedItems" :key="i" class="pic-item">
		<UtilImg
			:ref="(el) => setRef(el, i)"
			class="image"
			:style="{ cursor: item.zoom ? 'zoom-in' : undefined }"
			:src="item.src"
			:alt="item.alt"
			:width="item.width"
			:height="item.height"
			:mirror="item.mirror"
			@click="item.zoom && open(i, item)"
		/>
		<figcaption v-if="item.caption" aria-hidden>
			{{ item.caption }}
		</figcaption>
	</figure>
</div>
</template>

<style scoped>
.pics {
	margin: 1rem 0;
}

.pic-item {
	min-width: 0;
	margin: 0;
}

.pic-item :deep(.image) {
	display: block;
	width: 100%;
	height: auto;
	margin: 0;
	border-radius: 0.5rem;
}

.pic-item figcaption {
	margin-top: 0.3em;
	font-size: 0.8em;
	text-align: center;
	color: var(--c-text-2);
}

/* ---------- masonry：瀑布流，默认形态 ---------- */

/**
 * 兜底：老浏览器走 CSS 多列。
 *
 * 缺点是它的填充顺序**按列**走、还要把各列高度拉平，于是会出现
 * 「右下孤零零一张、左下明明有位置却空着」（比如 4 张里第 4 张是矮图时）。
 * 能支持的浏览器会走下面那段原生 masonry。
 */
.pics.masonry {
	column-count: var(--pics-cols);
	column-gap: var(--pics-gap);
}

.pics.masonry .pic-item {
	/* 不让单张图被拆到两列里去 */
	break-inside: avoid;
	margin-bottom: var(--pics-gap);
}

/**
 * 保持原始比例铺满列宽；很长的图（长截图之类）再高也只用 80vh，
 * 按比例缩小后水平居中，既不拉伸也不裁切。
 */
.pics.masonry .pic-item :deep(.image) {
	width: auto;
	max-width: 100%;
	max-height: 80vh;
	margin-inline: auto;
}

/**
 * 原生 CSS 瀑布流（规范名 **CSS Grid Lanes**）：**Safari 26.4+ / iOS 26.4+ 已默认支持**
 * （WebKit 官方发布说明：https://webkit.org/blog/17862/webkit-features-for-safari-26-4/）。
 *
 * 正式语法是 `display: grid-lanes`，**不是**早期草稿的 `grid-template-rows: masonry`
 * —— 后者只有 Firefox 的手动开关和 Chromium 140~154 的旧实验开关认，
 * Edge 155 起那个开关已被撤掉，所以这里只判新语法。
 *
 * 生效后的差别正是用户能一眼看出来的那点：它不是「按列填 + 拉平各列高度」
 * （多列方案的毛病），而是把每张图放进当前最矮的一条 lane，于是左边先填满、
 * 不会出现「右下孤零零一张」。Chromium（Chrome/Edge）目前仍在把实现更新到这套
 * 最终语法，尚未默认支持，所以那边继续走上面的多列方案。
 */
@supports (display: grid-lanes) {
	.pics.masonry {
		display: grid-lanes;
		grid-template-columns: repeat(var(--pics-cols), minmax(0, 1fr));
		gap: var(--pics-gap);
		/* 退掉多列方案的属性 */
		column-count: unset;
		column-gap: unset;
	}

	/* 网格里行距交给 gap，别再叠 margin */
	.pics.masonry .pic-item {
		margin-bottom: 0;
	}

	@media (max-width: 768px) {
		.pics.masonry {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 480px) {
		.pics.masonry {
			grid-template-columns: minmax(0, 1fr);
		}
	}
}

/* ---------- equal：等高网格，写了 height 才用 ---------- */

.pics.equal {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--min-col, 12rem)), 1fr));
	gap: var(--pics-gap);
}

/**
 * 图片「铺满」等高格子：`cover` 保证按原始比例缩放到填满格子、居中裁切。
 *
 * 原先是 `contain`（完整显示、不裁切），实测视觉上很难看：格子 213×200 时，
 * 2:1 的横图只占 106px 高、0.62 的竖图只占 124px 宽，四周大片留白，
 * 看着就像图「被挤窄、变形」了（其实 contain 不会拉伸，只是空得慌）。
 * 改成 `cover` 后每格都被填满、整排齐整，代价是边缘裁掉一点 ——
 * 点开灯箱仍然能看到完整图。
 *
 * ⚠️ 裁切会让显示比例与原图不一致，灯箱开合的那一下就会在两种比例之间插值
 * （画面会轻微拉伸）。单图**别写 `height`** 就没这个问题；多图为了整齐只能用。
 */
.pics.equal .pic-item :deep(.image) {
	object-fit: cover;
}

/* ---------- 窄屏收敛列数（多列兜底方案用） ---------- */

@media (max-width: 768px) {
	.pics.masonry {
		column-count: min(2, var(--pics-cols));
	}
}

@media (max-width: 480px) {
	.pics.masonry {
		column-count: 1;
	}
}

/* ---------- single：只有一张图 ---------- */

/**
 * 单图：占满整行、**靠左**、保持原始比例。
 *
 * 这几条必须放在**所有媒体查询之后**：上面的 768/480 会把列数拉回 2 列 / 1 列，
 * 与 `.pics.single` 同优先级（都是 0,2,0），只能靠源顺序压住它们。
 */
.pics.single {
	grid-template-columns: minmax(0, 1fr);
	column-count: 1;
}

/* 单图不居中，跟着正文左边缘走；题注同理 */
.pics.single .pic-item :deep(.image) {
	margin-inline: 0;
}

.pics.single .pic-item figcaption {
	text-align: left;
}
</style>
