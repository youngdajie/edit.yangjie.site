<script setup lang="ts">
/** 自定义下拉框：替代原生 select，样式与博客主题一致 */
export interface SelectOption {
	label: string
	value: string
	desc?: string
}

const props = defineProps<{
	modelValue: string
	options: SelectOption[]
	placeholder?: string
}>()

const emit = defineEmits<{
	'update:modelValue': [value: string]
}>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const current = computed(() => props.options.find(o => o.value === props.modelValue))

function pick(option: SelectOption) {
	emit('update:modelValue', option.value)
	open.value = false
}

function onDocClick(e: MouseEvent) {
	if (root.value && !root.value.contains(e.target as Node))
		open.value = false
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
	<div ref="root" class="w-select">
		<button
			type="button"
			class="w-select-trigger"
			:class="{ 'is-open': open }"
			:aria-expanded="open"
			@click="open = !open"
		>
			<span>{{ current?.label ?? placeholder ?? '请选择' }}</span>
			<Icon name="tabler:chevron-down" class="w-select-chevron" />
		</button>
		<div v-if="open" class="w-select-menu" role="listbox">
			<button
				v-for="option in options"
				:key="option.value"
				type="button"
				class="w-select-option"
				:class="{ 'is-selected': option.value === modelValue }"
				role="option"
				:aria-selected="option.value === modelValue"
				@click="pick(option)"
			>
				<span class="w-select-option-label">{{ option.label }}</span>
				<span v-if="option.desc" class="w-select-option-desc">{{ option.desc }}</span>
				<Icon v-if="option.value === modelValue" name="tabler:check" class="w-select-option-check" />
			</button>
		</div>
	</div>
</template>
