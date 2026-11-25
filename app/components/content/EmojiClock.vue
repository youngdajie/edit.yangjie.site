<script setup lang="ts">
import { Temporal } from 'temporal-polyfill'

const props = defineProps<{
	datetime?: string
	rotate?: boolean
}>()

const emojiStatic = ['🕛', '🕧', '🕐', '🕜', '🕑', '🕝', '🕒', '🕞', '🕓', '🕟', '🕔', '🕠', '🕕', '🕡', '🕖', '🕢', '🕗', '🕣', '🕘', '🕤', '🕙', '🕥', '🕚', '🕦']
const emojiRotate = ['🕛', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚']

// 时钟与当前时间有关：水合时先沿用服务端渲染的时刻，挂载后再开始走时
// 同一页面的时钟共用同一时刻，用固定键保证服务端与客户端的 state 一致
const snapshot = useState('emoji-clock:now', () => nowZonedDateTime().toString())
const mounted = useMounted()

// 定时器只能在客户端运行，否则 nuxt generate 不能自动退出。
// 同一页可能有多个时钟（说说列表里每个条目一个），每个实例各开一个 setInterval
// 就是 N 份 temporal-polyfill 计算。改成一个模块级共享的 timer，
// 所有人的 now 引用同一个 ref，谁都不需要自己 tick。
const { now, resume } = useSharedClock()

const datetime = computed(() => props.datetime
	? toZonedTemporal(props.datetime)
	: mounted.value ? now.value : Temporal.ZonedDateTime.from(snapshot.value))

const status = computed(() => {
	const { hour, minute } = datetime.value

	if (!props.rotate) {
		const emojiIndex = (hour * 2 + Math.round(minute / 30)) % emojiStatic.length
		return { emoji: emojiStatic[emojiIndex] }
	}

	const minuteAt = Math.round(minute / 5)
	const emojiIndex = (hour % 12 - minuteAt + emojiRotate.length) % emojiRotate.length
	return { rotate: minuteAt * 30, emoji: emojiRotate[emojiIndex] }
})

whenever(() => !props.datetime, resume)
</script>

<template>
<span
	class="emoji-clock"
	:class="{ rotate }"
	:style="{ '--deg': rotate ? `${status.rotate}deg` : undefined }"
	v-text="status.emoji"
/>
</template>

<style scoped>
.emoji-clock.rotate {
	display: inline-block;
	transform: rotate(var(--deg, 0deg));
}
</style>
