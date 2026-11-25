<script setup lang="ts">
import { joinURL, withLeadingSlash, withTrailingSlash } from 'ufo'
import ImageComponent from '#build/mdc-image-component.mjs'

export interface UtilImgProps {
	src: string
	width?: string | number
	height?: string | number
	alt?: string
	densities?: string
	mirror?: ImgService
	filter?: string
}

const props = withDefaults(defineProps<UtilImgProps>(), {
	alt: '',
})

const src = computed(() => {
	// 编辑器里写到一半的 MDC 片段可能还没有 src，空值直接透传，避免预览崩溃
	if (!props.src)
		return ''
	if (props.src.startsWith('/') && !props.src.startsWith('//')) {
		const _base = withLeadingSlash(withTrailingSlash(useRuntimeConfig().app.baseURL))
		if (_base !== '/' && !props.src.startsWith(_base))
			return joinURL(_base, props.src)
	}
	if (props.mirror)
		return getImgUrl(props.src, props.mirror)
	return props.src
})

/**
 * 尺寸必须用「内联样式」下发，而不是只靠 <img> 的 width/height 属性。
 * 因为 article.css 里有 `img { height: auto }`，作者样式表会覆盖 HTML 属性，
 * 导致直接写 height 不生效；内联样式优先级更高，能真正压过它。
 * 只下发用户显式设置的那个维度，另一个维度保持 auto，避免破坏响应式与宽高比。
 */
const sizeStyle = computed(() => {
	const style: Record<string, string> = {}
	const apply = (key: 'width' | 'height', val?: string | number) => {
		if (val == null)
			return
		style[key] = typeof val === 'number' ? `${val}px` : val
	}
	apply('width', props.width)
	apply('height', props.height)
	return style
})

const mergedStyle = computed(() => ({
	...(props.filter ? { filter: props.filter } : {}),
	...sizeStyle.value,
}))
</script>

<template>
<component
	:is="ImageComponent"
	:src :alt :width :height :densities
	:style="mergedStyle"
	:referrerpolicy="mirror ? 'no-referrer' : undefined"
/>
</template>
