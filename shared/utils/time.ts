import { Temporal } from 'temporal-polyfill'
import blogConfig from '~~/blog.config'

/**
 * 当前时刻，固定使用博客配置的时区。
 * 服务端渲染与访客的时区可能不同，直接用系统时区会导致水合不匹配。
 */
export function nowZonedDateTime() {
	return Temporal.Now.zonedDateTimeISO(blogConfig.timeZone)
}

/** 当前日期，固定使用博客配置的时区。 */
export function todayPlainDate() {
	return Temporal.Now.plainDateISO(blogConfig.timeZone)
}

/** unit 用受限字符串，避开 temporal-polyfill / temporal-spec 类型差异 */
type DateTimeUnit = 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second'

export function isSameUnit(date1: string, date2: string, unit: DateTimeUnit) {
	try {
		const p1 = toZonedTemporal(date1).toPlainDateTime()
		const p2 = toZonedTemporal(date2).toPlainDateTime()
		return p1.until(p2, {
			largestUnit: unit,
			smallestUnit: unit,
			roundingMode: 'trunc',
		}).blank
	}
	catch {
		return false
	}
}

/** 检查两个时间相对现在是否相差显著 */
export function isTimeDiffSignificant(
	date1?: string,
	date2?: string,
	/** 对于时间差的敏感程度，0~1 之间，1:不同则认为显著，>1:始终认为显著 */
	threshold = 0.6,
) {
	if (!date1 || !date2 || threshold <= 0)
		return false
	if (threshold > 1)
		return true
	try {
		const now = Temporal.Now.instant().epochMilliseconds
		const diff1 = now - toZonedTemporal(date1).epochMilliseconds
		const diff2 = now - toZonedTemporal(date2).epochMilliseconds
		return diff1 / diff2 < threshold || diff2 / diff1 < threshold
	}
	catch {
		return true
	}
}

const timeIntervals = [
	{ label: '世纪', threshold: 60 * 60 * 24 * 365.2422 * 100 },
	{ label: '年', threshold: 60 * 60 * 24 * 365.2422 },
	{ label: '个月', threshold: 60 * 60 * 24 * 30.44 },
	{ label: '天', threshold: 60 * 60 * 24 },
	{ label: '小时', threshold: 60 * 60 },
	{ label: '分', threshold: 60 },
	{ label: '秒', threshold: 1 },
]

export function timeElapse(date: string | Temporal.PlainDateTime, maxDepth = 2) {
	let timeString = ''
	let secRemained = nowZonedDateTime().toPlainDateTime().since(date, { largestUnit: 'second' }).seconds
	for (const interval of timeIntervals) {
		const count = Math.floor(secRemained / interval.threshold)
		if (count <= 0)
			continue
		timeString += `${count}${interval.label}`
		secRemained -= count * interval.threshold
		if (--maxDepth <= 0)
			break
	}
	return timeString || '刚刚'
}

export function toInstantString(date: string | Temporal.ZonedDateTime) {
	return (typeof date === 'string' ? toZonedTemporal(date) : date).toInstant().toString()
}

export function toZonedTemporal(date: string) {
	try {
		return Temporal.ZonedDateTime.from(date)
	}
	catch {
		try {
			return Temporal.Instant.from(date).toZonedDateTimeISO(blogConfig.timeZone)
		}
		catch {
			return Temporal.PlainDateTime.from(date).toZonedDateTime(blogConfig.timeZone)
		}
	}
}

export const dateTimeFormat = {
	date: {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	},
	monthDay: {
		month: '2-digit',
		day: '2-digit',
	},
	full: {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		weekday: 'long',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		timeZoneName: 'long',
	},
} satisfies Record<string, Intl.DateTimeFormatOptions>

export type dateTimeFormatOptions = keyof typeof dateTimeFormat | Intl.DateTimeFormatOptions

export function toZdtLocaleString(date: string | Temporal.ZonedDateTime, format: dateTimeFormatOptions = 'full') {
	// 语言必须写死：传 undefined 会拿到「运行时的默认语言」，
	// 服务端与浏览器不一样时，同一时间会格式化成不同字符串，水合就会 mismatch。
	return (typeof date === 'string' ? toZonedTemporal(date) : date)
		.toLocaleString(blogConfig.language, typeof format === 'string' ? dateTimeFormat[format] : format)
}
