/** CSS 时间转为 WAAPI 使用的毫秒，兼容构建压缩前后的 s / ms。 */
export function parseCssTime(value: string) {
	const time = value.trim()
	return Number.parseFloat(time) * (time.endsWith('ms') ? 1 : 1000)
}

export const getFixedDelay = (s: number, fixed = 2) => ({ '--delay': `${s.toFixed(fixed)}s` })
