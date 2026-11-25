import { defineCollection, z } from '@nuxt/content'

/**
 * 编辑器本身不维护 content 集合 —— 文章来自编辑区输入，经 /api/preview 解析。
 * 但 @nuxt/content v3 在没有集合时会刷 "No content configuration found" 警告并
 * 回退到默认集合，所以这里声明一个只匹配占位目录的最小集合。
 */
export const collections = {
	editor: defineCollection({
		type: 'page',
		source: 'editor/**/*.md',
		schema: z.object({
			title: z.string().optional(),
		}),
	}),
}
