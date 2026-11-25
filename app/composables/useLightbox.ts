import PopoverLightbox from '~/components/popover/Lightbox.vue'

/**
 * 打开图片灯箱。
 *
 * **静态导入，不做运行时动态拉取。**
 * 早先用 `defineAsyncComponent(() => import(...))`，会让灯箱的 JS/CSS 变成一个
 * 独立 chunk，只有第一次点开图片时才去下载（dev 下还要现场编译），于是
 * 「第一次卡一下、第二次很顺」。空闲预取也只是把下载提前，仍需一次运行时请求，
 * 且用户手快时根本等不到 idle。
 *
 * 现在改为直接打进模块图：连同 `@bikariya/image-viewer` / `@bikariya/modals`
 * 一起随页面 chunk 加载，点开图片时不再有任何网络/编译等待。
 * 代价是这几个 chunk 变大（gzip 约 20KB 量级），换来「第一次也不卡」——
 * 灯箱是文章页/说说页的高频交互，这个交换是值得的。
 *
 * 组件本身只在客户端通过 `h()` 创建（`modalStore.use`），SSR 不会渲染它，
 * 所以静态导入不会引入服务端 DOM 访问。
 *
 * 内容组件（`Pics`）和文章封面（`PostHeader`）共用这一套逻辑，
 * `unique: true` 保证同一时刻只有一个模态。
 */
export function useLightbox() {
	const modalStore = useModalStore()

	return function openLightbox(el: HTMLImageElement | null | undefined, caption?: string) {
		if (!el)
			return
		const { open } = modalStore.use(
			() => h(PopoverLightbox, { el, caption }),
			{ unique: true },
		)
		open()
	}
}
