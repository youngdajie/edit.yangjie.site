/**
 * 编辑器本身不维护 content 集合——文章来自编辑器的输入，经 /api/preview 解析。
 * 这里保留一个空 schema 只为满足 @nuxt/content 模块约定。
 */
export const collections = {}
