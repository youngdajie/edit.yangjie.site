// @keep-sorted
const services = {
	baidu: 'https://image.baidu.com/search/down?url=',
	/** https://webp.se/fly/ */
	fly: 'https://fly.webp.se/?url=',
	/** https://wsrv.nl/docs/ */
	weserv: 'https://wsrv.nl/?url=',
}

export type ImgService = keyof typeof services | boolean

// https://docs.webp.se/public-services/github-avatar/
export function getGithubAvatar(name = '', options = { size: 120 }) {
	return `https://avatars-githubusercontent-webp.webp.se/${name}?s=${options.size}`
}

interface GstaticFaviconOptions {
	provider?: 'gstatic'
	size?: 16 | 32 | 64 | 96 | 128 | 256 | 512
}

interface WebpseFaviconOptions {
	provider: 'google' | 'duckduckgo' | 'microlink'
	size?: number
}

// https://github.com/microlinkhq/unavatar
// https://docs.webp.se/public-services/unavatar/
export function getFavicon(domain: string, options?: GstaticFaviconOptions | WebpseFaviconOptions) {
	const { provider = 'gstatic', size = 32 } = options || {}
	if (provider === 'gstatic')
		return `https://t0.gstatic.cn/faviconV2?client=SOCIAL&fallback_opts=SIZE&url=http://${domain}&size=${size}`
	return `https://unavatar.webp.se/${provider}/${domain}?w=${size}`
}

export function getImgUrl(src: string, service?: ImgService | true) {
	if (!service)
		return src
	if (service === true)
		service = 'fly'
	if (service in services)
		return services[service] + src
	return src
}
