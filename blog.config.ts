import type { AsideName } from './app/types/widget'

const basicConfig = {
	title: '小杰杂记',
	subtitle: '记录技术与生活',
	// 长 description 利好于 SEO
	description: '分享学习笔记、技术实践与日常生活。',
	author: {
		name: '小杰',
		avatar: 'https://cdn.jsdmirror.com/cnb/youngdajie/static@main/box/img/about/avatar.jpg',
		email: 'ok@yangjie.site',
		homepage: 'https://www.yangjie.site/',
	},
	copyright: {
		abbr: 'CC BY-NC-SA 4.0',
		name: '署名-非商业性使用-相同方式共享 4.0 国际',
		url: 'https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh-hans',
	},
	favicon: 'https://cdn.jsdmirror.com/cnb/youngdajie/static@main/box/favicon.ico',
	language: 'zh-CN',
	timeEstablished: '2026-09-10',
	timeZone: 'Asia/Shanghai',
	url: 'https://box.yangjie.site/',
	defaultCategory: '未分类',
}

// 存储 nuxt.config 和 app.config 共用的配置
// 此处为启动时需要的配置，启动后可变配置位于 app/app.config.ts
// @keep-sorted
const blogConfig = {
	...basicConfig,

	/**
	 * 关于页「生于 / 当前」那张卡，鼠标悬停时浮出来的竖排短句。
	 *
	 * 用 `\n` 分成两行 —— 竖排（`writing-mode: vertical-rl`）时这两行会并排站好，
	 * 所以别写太长，两行各六七个字在卡片里最好看。
	 * 触屏没有 hover，这条只在桌面端出现。
	 */
	aboutQuote: '永远年轻\n永远热泪盈眶',

	article: {
		/**
		 * 文章分类。
		 *
		 * 颜色只用作图标色与卡片渐变（不是正文），所以不必满足正文对比度，
		 * 但要**和主色拉开色相**：主色是 #1296db（色相 200.6deg），
		 * 这里统一避开了 195~215 这段蓝，否则分类色看着像「被冲淡的主色」。
		 * 括号里是各自的色相角，加新分类时照这个思路挑。
		 */
		categories: {
			[basicConfig.defaultCategory]: { icon: 'tabler:circle-dashed' },
			/** 实践可复用操作经验：工具/系统/部署/排障 */
			技术: { icon: 'tabler:mouse', color: '#4ea630' }, // 绿 105deg
			/** 编程：代码实现/工程实践/开发方法 */
			开发: { icon: 'tabler:code', color: '#7777ff' }, // 紫蓝 240deg
			/** 安全：漏洞/CTF/恶意软件/安全事件分析 */
			安全: { icon: 'tabler:bug', color: '#ff7733' }, // 橙 20deg
			/** 思考：观点讨论/复盘反思/行业或产品观察 */
			杂谈: { icon: 'tabler:message', color: '#33bbaa' }, // 青 173deg
			/** 记录叙事：个人经历/校园家庭/日常片段 */
			生活: { icon: 'tabler:leaf', color: '#ff7777' }, // 红 0deg
			/** 杂记：随笔/感悟/其他 */
			杂记: { icon: 'tabler:note', color: '#1296db' }, // 主题色
		},
		/** 文章版式，首个为默认版式 */
		types: {
			tech: {},
			story: {},
		},
		/** 分类排序方式，键为排序字段，值为显示名称 */
		order: {
			date: '创建日期',
			updated: '更新日期',
			// title: '标题',
		},
		/** 使用 pnpm new 新建文章时自动生成自定义链接（permalink/abbrlink） */
		useRandomPremalink: false,
		/** 隐藏基于文件路由（不是自定义链接）的 URL /post 路径前缀 */
		hidePostPrefix: true,
		/** 禁止搜索引擎收录的路径 */
		robotsNotIndex: ['/preview', '/previews/*'],
	},

	aside: {
		/** 首页（文章列表） */
		home: ['jinrishici', 'blog-stats', 'blog-tech'],
		/** 文章详情；文章 front-matter 里的 `aside` 会排在这一组前面 */
		article: ['back-top'],
		/** 归档页 */
		archive: ['blog-log'],
		/** 友链页 */
		link: ['contact'],
		/** 说说页 */
		shuoshuo: ['contact', 'back-top'],
		/** 预览页 */
		preview: ['blog-log'],
		/** 收藏页（收藏的网站）：只要技术信息与回到顶部 */
		coll: ['blog-tech', 'back-top'],
	} satisfies Record<string, AsideName[]>,

	/**
	 * 每一页的右侧栏显示哪些组件、按什么顺序。
	 *
	 * 值就是 `app/components/widget/` 下组件的文件名（kebab-case），
	 * 名单和型别在 `app/types/widget.ts`，注册表在 `app/composables/useWidgets.ts`；
	 * 顺序即显示顺序，想关掉某一页的侧栏就写成空数组。
	 * 名字写错、或者加了名字没注册组件，都会被类型检查拦下来。
	 */
	/**
	 * 「收藏」页（收藏的网站，路由 `/coll`）
	 *
	 * 条目本身在 `content/coll.json`（**一个文件装下全部**，一个链接一项），
	 * 加站点用 `pnpm coll <网址>`。这里只管**分类的显示名与顺序**：
	 * 没配到的分类会按原 key 显示、排在最后，所以开新分类不用改代码。
	 */
	coll: {
		title: '收藏',
		desc: '平时会用到的一些站点，随手收在这里。',
		categories: [
			{ key: '官网', name: '官网' },
			{ key: '工具', name: '工具' },
			{ key: '找资源', name: '找资源' },
			{ key: '好东西', name: '好东西' },
			{ key: '杂七杂八', name: '杂七杂八' },
		],
	},

	/** 加密文章（front-matter 写 password）相关配置 */
	encrypted: {
		/**
		 * 是否把加密文章收录进 feed / sitemap / llms.txt。
		 * 默认 false：不把需要密码的文章公告给订阅者、爬虫和 LLM。
		 */
		indexable: false,
	},

	/** 博客 Atom 订阅源 */
	feed: {
		/** 订阅源最大文章数量 */
		limit: 50,
		/** 订阅源是否启用XSLT样式 */
		enableStyle: true,
	},

	/**
	 * /follow 追番页配置
	 *
	 * 数据**只在本地拉取**：`pnpm follow` 会经反代请求 Bangumi，
	 * 把结果写进 `app/follow/data.json`，看完 diff 和工作区一起提交就行。
	 * 构建期与流水线都不联网、不拉取、不回写 —— 拉取是手动动作。
	 *
	 * 这份 data.json 必须一直在仓库里：`app/pages/follow.vue` 是静态 import 它的，
	 * 缺文件构建直接失败。`pnpm init-project` 会补一份空占位兜底。
	 */
	follow: {
		/** Bangumi 用户名（bgm.tv 个人主页地址里的那段），留空则不拉取、功能整体关闭 */
		bangumiUser: 'youngdajie',
		/**
		 * Bangumi API 反代前缀，实际请求形如 `{proxy}https://api.bgm.tv/v0/...`。
		 * api.bgm.tv 与封面域名 lain.bgm.tv 国内直连不通，所以拉取时要经反代。
		 * 换成自己的反代时记得保留结尾的 `/`。
		 */
		bangumiProxy: 'https://api-bgm-tv.shinya.click/',
		/** 单个状态最多拉取多少条，超过部分不再翻页（0 = 不限制） */
		maxPerStatus: 500,
		/** 补拉作品完整简介的并发数 */
		concurrency: 5,
	},

	/**
	 * 内容里的图片
	 *
	 * 单图和多图现在都由 `app/components/content/Pics.vue` 一个组件负责：
	 * 不写 `height` 就保持**原始比例**（单图靠左、多图瀑布流），
	 * 写了 `height` 才按固定高度用 `cover` 裁切排成等高网格。
	 *
	 * 这里原先有个 `defaultHeight`（给单图写死 266px）—— 它会让正文里的显示比例
	 * 偏离原图，灯箱开合的动画就会在两种比例间插值、画面被拉伸，所以去掉了。
	 * 单张图想固定高度，在它的 YAML 里显式写 `height` 即可。
	 */

	/**
	 * 字体
	 *
	 * 默认**一个字体文件都不引**，全站走系统字体（Windows 上微软雅黑、macOS 上苹方，
	 * 也就是 Edge / Chrome 默认的中文）：少几个跨域请求、首屏更快，
	 * 也不受第三方字体 CDN 抽风影响。字体栈的兜底顺序写在 `app/assets/css/font.css`，
	 * 这里只管「要不要额外拉一个自定义字体」。
	 *
	 * **CDN 样式表统一写在 `stylesheets` 里，一份可以被多个槽位共用** ——
	 * 槽位只负责说「这里要用哪个字体名（family）」，不用各自重复贴链接。
	 * 想再加一个字体（比如代码用 JetBrains Mono），往数组里加一条、再把
	 * `monospace.family` 指过去就行。
	 *
	 * 六个槽位对应站内六处用字，**各管各的、互不影响** —— 填了才生效，没填的继续用系统字体：
	 *
	 * | 槽位       | 管哪儿                                | CSS 变量             |
	 * | ---------- | ------------------------------------- | -------------------- |
	 * | basic      | 全局正文、导航、侧栏等大多数文字         | `--font-basic`       |
	 * | serif      | 故事类文章的标题、诗歌（`.md-story`）   | `--font-serif`       |
	 * | creative   | 正文标题 h1~h6、首页与侧栏的大字         | `--font-creative`    |
	 * | strokeFree | 归档页强调字、订阅卡片标题               | `--font-stroke-free` |
	 * | monospace  | 代码块、行内代码                        | `--font-monospace`   |
	 * | header     | 站点头部那个大标题                      | `--font-header`      |
	 *
	 * ⚠️ 示例地址是 6 个 `@import` 的链条（文楷 + 文楷等宽，各 3 个字重），
	 * 每个子样式表约 200KB，首屏会明显变重。只想要正文一种，可以换成包内单个子表：
	 * `…/@callmebill/lxgw-wenkai-web@latest/lxgwwenkai-regular/result.css`
	 */
	font: {
		/** 总开关：false = 不引入任何字体文件，全站用系统字体 */
		enable: false,
		/**
		 * 要引入的 CDN 样式表（里面是 `@font-face` 定义）。
		 * 数组可以有多个，**同一份被几个槽位用到都只请求一次** ✓。
		 */
		stylesheets: ['https://cdn.jsdmirror.com/npm/@callmebill/lxgw-wenkai-web@latest/style.css'],
		/** 全局正文、导航、侧栏等大多数文字（字体名要和样式表里 font-family 一致） */
		basic: { family: '"LXGW WenKai"' },
		/** 故事类文章标题、诗歌（留空则用系统字体） */
		serif: { family: '' },
		/** 正文标题 h1~h6、首页与侧栏大字（留空则用系统字体） */
		creative: { family: '' },
		/** 归档页强调字、订阅卡片标题（留空则用系统字体） */
		strokeFree: { family: '' },
		/** 代码块、行内代码（留空则用系统字体） */
		monospace: { family: '' },
		/** 站点头部大标题（留空则用系统字体） */
		header: { family: '' },
	},

	/**
	 * 向 <head> 中添加脚本。
	 *
	 * Twikoo 不在这里：它只在「有评论区的页面」才需要，放全局 `<head>` 会让
	 * 首页 / 归档 / 文档 / 追番等页面白下 340KB+。改由 `Comment.vue` 在页面
	 * 挂载时按需注入，见下方 `twikoo.src`。
	 */
	scripts: [] as { src: string, defer?: boolean }[],

	/** 文章统计配置 */
	stats: {
		/**
		 * 统计范围，匹配 content 下不含扩展名的路径（stem）；空数组统计全部内容
		 * 使用 SQL LIKE 语法：% 匹配任意长度字符，_ 匹配单个字符
		 * 多个范围取并集，如 ['posts/%', 'book/%']
		 */
		includePaths: [] as string[],
	},

	/** 自己部署的 Twikoo 服务 */
	twikoo: {
		envId: 'https://twikoo.yangjie.site/',
		/**
		 * 评论区脚本地址。留空 = 关闭评论（`Comment.vue` 不会注入任何脚本）。
		 *
		 * 只在真正渲染评论区的页面（文章 / 友链 / 关于）由客户端动态插入，
		 * 不再进全局 `<head>`；`envId` 会额外用作 preconnect，首次加载不额外吃 DNS 时间。
		 *
		 * 用 `@latest` 是有意的：twikoo 更新频繁，固定版本还得手动跟。
		 * CDN 偶尔返回残缺文件（UMD 首行就把 `window.twikoo` 设成空对象）的风险
		 * 由 `useTwikoo` 兜底 —— 它判的是 `typeof window.twikoo?.init === 'function'`，
		 * 不是只看有没有值，撞上残缺文件会重置 loader 再试。
		 *
		 * 样式（`.tk-*`）写在 `Comment.vue` 的 scoped CSS 里，跟着主题走，
		 * 不需要另外引 Twikoo 的 CSS。
		 */
		src: 'https://cdn.jsdmirror.com/npm/twikoo@latest/dist/twikoo.min.js',
	},

	/** 侧栏各组件的文案 */
	widget: {
		/**
		 * 右栏「今日诗词」。
		 *
		 * 数据来自今日诗词（`https://www.jinrishici.com`），进页面时取一条，
		 * **点一下卡片就换一首**。只挂在首页侧栏（`aside.home`），其他页不显示。
		 * 取数据在浏览器里做（`onMounted`），静态构建期不去请求第三方。
		 *
		 * 面板上「—— 出处」那半句是「朝代 作者《篇名》」，缺哪个就省哪个。
		 */
		jinrishici: {
			title: '今日诗词',
			/**
			 * 用哪一版接口，`'v1'` 或 `'v2'`。
			 *
			 * - `'v1'`（默认）：`https://v1.jinrishici.com/all`，不带任何身份，
			 *   **每次都是纯随机**的一句。出处只有「作者《篇名》」，没有朝代。
			 * - `'v2'`：`https://v2.jinrishici.com/one.json`，首次请求时服务端**自动签发**
			 *   一个 Token，之后存在 `localStorage` 里一直沿用，按它做推荐。
			 *   出处带朝代。**不需要手填任何 Token。**
			 *
			 * 想每次都随机就别动它；想要「按访客口味推荐」再把这里改成 `'v2'`。
			 */
			version: 'v1' as 'v1' | 'v2',
			/**
			 * 接口地址（不含查询串），不给就用上面对应版本那一版。
			 * 换服务才改这里，返回结构要能对上（V1 字段平铺在顶层，V2 的在 `data` 里）。
			 */
			api: '',
			/** 钉死的查询参数，一般留空 */
			apiParams: {} as Record<string, string>,
			/**
			 * 调用方标识，对应 V2 查询串的 `client`。
			 * 跟官网 SDK 一个写法，服务端靠它知道这是浏览器在取内容。V1 用不上。
			 */
			client: 'browser-sdk/1.2',
		},

		/**
		 * 右栏「更新日志」。
		 *
		 * 按时间正序写；`label` 和 `value` 里都能用 `{timeEstablished}` 占位符，
		 * 会被上面配置的建站日期替换掉。
		 */
		blogLog: {
			title: '更新日志',
			items: [
				{ label: '2023-10-13', value: '博客在这一天，正式创立' },
				{ label: '{timeEstablished}', value: '从 Hexo 迁移到 Nuxt，使用 Clarity 主题' },
				{ label: '2026-09-30', value: '借助 AI 优化了 Clarity 主题，使其更符合自己使用习惯' },
			],
		},

		/**
		 * 右栏「加我好友」。
		 *
		 * **不限定 QQ** —— `items` 想放几条放几条，微信 / 电报 / 邮箱都行：
		 * - `icon`：整张卡片的背景。写图片地址（https）或图标名（如 `simple-icons:qq`）都可以，
		 *   它会铺满卡片、四周由 CSS 渐隐，只留中间一块清晰；留空则没有背景。
		 * - `items[].icon`：这一条的图标名（`ri:qq-fill`、`ri:wechat-fill`、`ri:telegram-fill`…）；
		 * - `items[].value`：页面上显示、点一下可复制的内容（QQ 号 / 微信号 / @用户名）；
		 * - `items` 为空数组则**整张卡片不渲染**（不想露联系方式时清掉即可）。
		 */
		contact: {
			title: '加我好友',
			heading: '开始接入',
			icon: 'https://cdn.jsdmirror.com/cnb/youngdajie/static@main/box/img/other/qq.svg',
			items: [
				{ icon: 'ri:qq-fill', value: '434871910' },
			],
		},
	},
}

export default blogConfig
