<script setup lang="ts">
import type { Temporal } from 'temporal-polyfill'

const props = withDefaults(defineProps<{
	icon?: string
	date?: string | Temporal.ZonedDateTime
	format?: dateTimeFormatOptions
	absolute?: boolean
	relative?: boolean
	nospace?: boolean
	tipFormat?: dateTimeFormatOptions
	tipTransform?: (formattedDate: string) => string
}>(), {
	tipTransform: String,
})

const today = todayPlainDate()
const zdt = computed(() => {
	try {
		return typeof props.date === 'string' ? toZonedTemporal(props.date) : props.date
	}
	catch {
		return null
	}
})

const relative = computed(() => props.absolute || !zdt.value
	? false
	: props.relative || today.since(zdt.value, { largestUnit: 'week' }).weeks < 1,
)

/**
 * 悬浮提示里的完整时间。
 *
 * 这一段改过两次，都是为了消除水合不匹配（SSR 的 HTML 与客户端算出来的不一致）：
 *
 * 1. 原来用 `useMounted()` 当闸门——服务端渲染原始字符串、客户端挂载后再换成
 *    格式化后的字符串，同一个 `title` 属性两边不一样。现在两边都直接算格式化结果
 *    （`toZdtLocaleString` 的时区与语言都已固定，结果是确定的），解析不出日期时
 *    退回原始输入。
 * 2. 模板里从 `:title` 改成 `v-tip`——vue-tippy 的指令会把 `title` 读走并删掉，
 *    服务端渲出 title、客户端渲不出，同样会 mismatch。
 *
 * 图标与文字之间原本还有个 nbsp 实体标签，它在 SSR 下是空片段、客户端却是字符，
 * 同样会 mismatch，现在改由 `.util-date-icon` 的 margin 控制。
 */
const tooltip = computed(() => zdt.value
	? props.tipTransform(toZdtLocaleString(zdt.value, props.tipFormat))
	: props.date as string,
)
</script>

<template>
<!-- tooltip 用 v-tip 而非 :title（vue-tippy 会读走并删掉 title），图标间距交给 CSS，两者都影响水合一致性，详见上面脚本注释 -->
<span v-tip="tooltip" class="util-date" :class="[{ 'util-date-nospace': nospace }]">
	<Icon v-if="icon" :name="icon" class="util-date-icon" />

	<span v-if="!zdt">Invalid Date</span>

	<time
		v-else-if="format"
		:datetime="toInstantString(zdt)"
		v-text="toZdtLocaleString(zdt, format)"
	/>

	<NuxtTime
		v-else
		:datetime="toInstantString(zdt)"
		:relative
		:year="zdt.year === today.year ? undefined : '2-digit'"
		month="long"
		day="numeric"
		numeric="auto"
	/>
</span>
</template>

<style scoped>
.util-date-icon {
	margin-right: 0.3em;
}

.util-date-nospace .util-date-icon {
	margin-right: 0;
}
</style>
