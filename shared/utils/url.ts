/**
 * 轻量 URL 工具。
 *
 * 这里只放**首屏会用到**的函数，一个重依赖都不许有。
 *
 * 早先这些全在 `shared/utils/link.ts` 里，那个文件顶部 `import { parseDomain }
 * from 'parse-domain'` —— 于是布局里的 `BlogSidebar` 只为了判一个外链，
 * 就把整个 Public Suffix List（打出来 89 KB）拖进了首屏。
 * 拆开之后 `parse-domain` 只留在 `link.ts`，只有友链页那种懒加载页面才会碰。
 */
/**
 * 本地实现的「路径是否是带扩展名的文件」判断。
 * 编辑器无需引入 site-config-stack 整包，只为这一个函数。
 */
function isPathFile(path: string): boolean {
	const clean = path.split(/[?#]/)[0] ?? ''
	const last = clean.split('/').pop() ?? ''
	return /\.[A-Za-z0-9]{1,8}$/.test(last)
}

export function getDomain(url: string) {
	try {
		return new URL(url).hostname
	}
	catch {
		return url
	}
}

export function isExtLink(url?: string) {
	return url
		? url.includes(':') || url.startsWith('//') || !!isPathFile(url)
		: false
}

export function safelyDecodeUriComponent(str: string) {
	try {
		return decodeURIComponent(str)
	}
	catch {
		return str
	}
}

/** 静态托管添加的尾斜杠不应改变页面身份或 Content 缓存键。 */
export function normalizeContentPath(path: string) {
	return path.replace(/\/+$/, '') || '/'
}

const githubUsernameRegex = /github\.com\/([a-zA-Z0-9-]+)(?:\/[^/]+)?(\/?)$/

export function getGithubUsername(url?: string) {
	if (!url)
		return ''
	return url.match(githubUsernameRegex)?.[1] ?? ''
}
