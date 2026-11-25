<script setup lang="ts">
/**
 * 自定义日期时间选择器。
 * 不用原生 datetime-local（浏览器内部字段是灰方块、方角，无法与主题统一），
 * 全部样式走博客 --c-* 变量，浅色/深色自动适配。
 * v-model 值格式与 frontmatter 一致：YYYY-MM-DD HH:mm:ss
 */
const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const root = ref<HTMLElement | null>(null)
const open = ref(false)

const pad = (n: number, len = 2) => String(Math.trunc(n) || 0).padStart(len, '0')

/** 把 YYYY-MM-DD HH:mm:ss 拆成可编辑的字段 */
function parse(value: string) {
	const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value ?? '')
	if (m)
		return {
			y: Number(m[1] ?? 2026),
			mo: Number(m[2] ?? 1),
			d: Number(m[3] ?? 1),
			h: Number(m[4] ?? 0),
			mi: Number(m[5] ?? 0),
		}
	const now = new Date()
	return { y: now.getFullYear(), mo: now.getMonth() + 1, d: now.getDate(), h: now.getHours(), mi: now.getMinutes() }
}

const fields = reactive(parse(props.modelValue))
const display = computed(() => {
	const p = parse(props.modelValue)
	return `${p.y}-${pad(p.mo)}-${pad(p.d)}  ${pad(p.h)}:${pad(p.mi)}`
})

function syncFrom() {
	Object.assign(fields, parse(props.modelValue))
}
watch(() => props.modelValue, syncFrom)

function openPanel() {
	syncFrom()
	open.value = true
}

function clamp() {
	fields.mo = Math.min(12, Math.max(1, fields.mo || 1))
	const lastDay = new Date(fields.y || 2026, fields.mo, 0).getDate()
	fields.d = Math.min(lastDay, Math.max(1, fields.d || 1))
	fields.h = Math.min(23, Math.max(0, fields.h || 0))
	fields.mi = Math.min(59, Math.max(0, fields.mi || 0))
	fields.y = Math.min(9999, Math.max(1970, fields.y || 2026))
}

function commit() {
	clamp()
	emit('update:modelValue', `${fields.y}-${pad(fields.mo)}-${pad(fields.d)} ${pad(fields.h)}:${pad(fields.mi)}:00`)
	open.value = false
}

function setNow() {
	const now = new Date()
	Object.assign(fields, { y: now.getFullYear(), mo: now.getMonth() + 1, d: now.getDate(), h: now.getHours(), mi: now.getMinutes() })
	commit()
}

function onDocClick(e: MouseEvent) {
	if (root.value && !root.value.contains(e.target as Node))
		open.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
	<div ref="root" class="dt-picker">
		<button type="button" class="dt-trigger" :class="{ 'is-open': open }" @click="open ? open = false : openPanel()">
			<Icon name="tabler:calendar-event" class="dt-icon" />
			<span class="dt-value">{{ display }}</span>
			<Icon name="tabler:chevron-down" class="dt-chevron" />
		</button>

		<div v-if="open" class="dt-panel">
			<div class="dt-panel-title">选择日期时间</div>
			<div class="dt-row">
				<label class="dt-field dt-field-year">
					<span>年</span>
					<input v-model.number="fields.y" type="number" min="1970" max="9999" inputmode="numeric">
				</label>
				<label class="dt-field">
					<span>月</span>
					<input v-model.number="fields.mo" type="number" min="1" max="12" inputmode="numeric">
				</label>
				<label class="dt-field">
					<span>日</span>
					<input v-model.number="fields.d" type="number" min="1" max="31" inputmode="numeric">
				</label>
			</div>
			<div class="dt-row">
				<label class="dt-field">
					<span>时</span>
					<input v-model.number="fields.h" type="number" min="0" max="23" inputmode="numeric">
				</label>
				<label class="dt-field">
					<span>分</span>
					<input v-model.number="fields.mi" type="number" min="0" max="59" inputmode="numeric">
				</label>
				<div class="dt-field dt-field-hint">秒固定为 00</div>
			</div>
			<div class="dt-actions">
				<button type="button" class="dt-now" @click="setNow"><Icon name="tabler:clock" />现在</button>
				<span class="dt-spacer" />
				<button type="button" class="dt-cancel" @click="open = false">取消</button>
				<button type="button" class="dt-confirm" @click="commit">确定</button>
			</div>
		</div>
	</div>
</template>
