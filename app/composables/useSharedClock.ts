import type { Temporal } from 'temporal-polyfill'

/**
 * 全站共享的「当前时间」，30 秒一跳。
 *
 * 说说列表里每条都有一个 `EmojiClock`，每个实例各起一个 `setInterval`
 * 就要各自算一遍 `nowZonedDateTime()`（temporal-polyfill 的计算不便宜）。
 * 这里把 ref 与定时器都提到模块级：实例再多也只有一个 timer、一份计算。
 *
 * 水合安全：`EmojiClock` 在挂载前用的是 `useState` 里那份服务端快照，
 * 挂载后才读这里的 `now`，所以服务端与首帧客户端渲染不依赖它。
 *
 * 定时器只在客户端跑，且 `resume()` 幂等——重复调用不会叠加 timer，
 * 服务端（含 `nuxt generate`）永远不会开 timer。
 */
let nowRef: Ref<Temporal.ZonedDateTime> | null = null
let timer: ReturnType<typeof setInterval> | null = null

export function useSharedClock() {
	// 挂载后才读，服务端与构建期都不会取到这块值
	nowRef ??= shallowRef(nowZonedDateTime())

	/** 开始走时；重复调用无副作用 */
	function resume() {
		if (!import.meta.client || timer)
			return
		timer = setInterval(() => nowRef!.value = nowZonedDateTime(), 30000)
	}

	return { now: nowRef, resume }
}
