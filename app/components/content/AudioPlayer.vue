<script setup lang="ts">
const props = defineProps<{
	/** 音频地址，MDC 写法 `::audio-player{src="..."}` */
	src: string
	/** 曲名，不填时从 src 的文件名推断（会自动解码 URL 编码的中文） */
	name?: string
}>()

const audio = useTemplateRef('audio')
const playing = ref(false)
const current = ref(0)
const duration = ref(0)
const failed = ref(false)

const displayName = computed(() => {
	if (props.name)
		return props.name
	if (!props.src)
		return '音频'
	try {
		const url = new URL(props.src, 'https://example.com')
		const file = decodeURIComponent(url.pathname.split('/').pop() || '')
		return file.replace(/\.[^.]+$/, '') || '音频'
	}
	catch {
		return '音频'
	}
})

const progress = computed(() => duration.value > 0 ? (current.value / duration.value) * 100 : 0)

function formatTime(seconds: number) {
	if (!Number.isFinite(seconds) || seconds < 0)
		return '0:00'
	const total = Math.floor(seconds)
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function togglePlay() {
	const el = audio.value
	if (!el)
		return
	if (el.paused) {
		el.play().catch(() => {
			failed.value = true
		})
	}
	else {
		el.pause()
	}
}

function seek(event: Event) {
	const el = audio.value
	if (!el || !duration.value)
		return
	el.currentTime = (Number((event.target as HTMLInputElement).value) / 100) * duration.value
}

function onPlay() {
	playing.value = true
	failed.value = false
}

function onLoadedMetadata() {
	duration.value = audio.value?.duration || 0
}

function onEnded() {
	playing.value = false
	current.value = 0
}
</script>

<template>
<div class="audio-player" :class="{ playing }">
	<button
		class="audio-play"
		type="button"
		:aria-label="playing ? '暂停' : '播放'"
		@click="togglePlay"
	>
		<!-- 自己画圆角 SVG：播放三角用圆角描边撑圆，暂停用圆角矩形，比图标集的直角更贴合播放条 -->
		<svg v-if="!playing" class="audio-icon" viewBox="0 0 24 24" aria-hidden="true">
			<path
				d="M8 5.4 19 12 8 18.6Z"
				fill="currentColor"
				stroke="currentColor"
				stroke-width="4"
				stroke-linejoin="round"
			/>
		</svg>
		<svg v-else class="audio-icon" viewBox="0 0 24 24" aria-hidden="true">
			<rect x="6.5" y="5" width="4" height="14" rx="2" fill="currentColor" />
			<rect x="13.5" y="5" width="4" height="14" rx="2" fill="currentColor" />
		</svg>
	</button>

	<div class="audio-track">
		<div class="audio-meta">
			<span class="audio-name" :title="displayName">{{ displayName }}</span>
			<span class="audio-time">{{ formatTime(current) }} / {{ formatTime(duration) }}</span>
		</div>
		<input
			class="audio-progress"
			type="range"
			min="0"
			max="100"
			step="0.1"
			:style="{ '--fill': `${progress}%` }"
			:aria-label="`${displayName} 播放进度`"
			:value="progress"
			@input="seek"
		>
		<span v-if="failed" class="audio-error">音频加载失败，请检查网络</span>
	</div>

	<audio
		ref="audio"
		preload="metadata"
		:src
		@play="onPlay"
		@pause="playing = false"
		@timeupdate="current = audio?.currentTime ?? 0"
		@loadedmetadata="onLoadedMetadata"
		@ended="onEnded"
		@error="failed = true"
	/>
</div>
</template>

<style scoped>
.audio-player {
	display: flex;
	align-items: center;
	gap: 0.75rem;
	margin: 1.5rem auto;
	padding: 0.6rem 0.9rem;
	border: 1px solid var(--c-border);
	border-radius: 0.7rem;
	box-shadow: var(--box-shadow-2);
	background: var(--ld-bg-card);

	article & {
		max-width: 40rem;
	}
}

.audio-play {
	display: flex;
	flex-shrink: 0;
	align-items: center;
	justify-content: center;
	width: 2rem;
	height: 2rem;
	padding: 0;
	border: none;
	border-radius: 50%;
	background: var(--c-primary);
	font-size: 1.05rem;
	color: var(--c-bg);
	transition: filter 0.2s var(--motion-easing), transform 0.2s var(--motion-easing);
	cursor: pointer;

	&:hover {
		transform: scale(1.06);
		filter: brightness(1.15);
	}
}

.audio-track {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: 0.35rem;
	min-width: 0;
}

.audio-meta {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 0.75rem;
}

.audio-name {
	overflow: hidden;
	font-size: 0.9rem;
	font-weight: 600;
	white-space: nowrap;
	text-overflow: ellipsis;
	color: var(--c-text-1);
}

.audio-time {
	flex-shrink: 0;
	font-size: 0.72rem;
	font-variant-numeric: tabular-nums;
	color: var(--c-text-3);
}

.audio-icon {
	width: 1.1em;
	height: 1.1em;
}

.audio-progress {
	width: 100%;
	height: 4px;
	margin: 0;
	border-radius: 999px;
	background: linear-gradient(to right, var(--c-primary) var(--fill), var(--c-border) var(--fill));
	appearance: none;
	cursor: pointer;

	&::-webkit-slider-thumb {
		width: 0.8rem;
		height: 0.8rem;
		border: none;
		border-radius: 50%;
		background: var(--c-primary);
		appearance: none;
	}

	&::-moz-range-thumb {
		width: 0.8rem;
		height: 0.8rem;
		border: none;
		border-radius: 50%;
		background: var(--c-primary);
	}
}

.audio-error {
	font-size: 0.72rem;
	color: var(--c-error, hsl(0 100% 70%));
}

audio {
	display: none;
}
</style>
