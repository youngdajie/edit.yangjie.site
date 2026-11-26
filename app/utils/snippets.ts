/** 一个可插入的 MDC 片段 */
export interface Snippet {
	label: string
	group: '基础' | '组件' | '媒体' | '布局'
	/** 卡片上的简短描述 */
	desc: string
	/** Tabler 图标名（@nuxt/icon） */
	icon: string
	/** 语法速览，卡片副标题 */
	syntax: string
	/** 插入模板，含完整可用示例；$0 标记光标落点 */
	template: string
	/** 行内格式：选中文字时包裹选区，未选中时插入 fallback 示例 */
	wrap?: [string, string]
	/** wrap 模式无选区时的示例文字 */
	fallback?: string
	/** 用法提醒，显示在详情面板语法下方 */
	note?: string
	/** 冻结：编辑器不渲染这类结构，条目保留仅为说明语法，点击不插入 */
	frozen?: boolean
	/** 冻结原因，显示在卡片角标与点击提示里 */
	frozenNote?: string
}

/**
 * 博客实际支持的 MDC 语法，取自 content/previews/example.md 与
 * app/components/content/ 下的组件清单。模板给完整示例值，插入即可看到效果。
 * 基础组含全部 Markdown 行内/块级语法，与 MDC 组件统一在工具栏横排管理。
 */
export const SNIPPETS: Snippet[] = [
	// ---------- 基础（Markdown 全量语法） ----------
	{
		label: '二级标题', group: '基础', icon: 'tabler:h-2',
		desc: '章节标题', syntax: '## 标题',
		template: '## $0章节标题',
	},
	{
		label: '三级标题', group: '基础', icon: 'tabler:h-3',
		desc: '小节标题', syntax: '### 标题',
		template: '### $0小节标题',
	},
	{
		label: '加粗', group: '基础', icon: 'tabler:bold',
		desc: '选中后包裹加粗', syntax: '**文字**',
		template: '**$0重点文字**', wrap: ['**', '**'], fallback: '重点文字',
	},
	{
		label: '斜体', group: '基础', icon: 'tabler:italic',
		desc: '选中后包裹斜体', syntax: '*文字*',
		template: '*$0斜体文字*', wrap: ['*', '*'], fallback: '斜体文字',
	},
	{
		label: '删除线', group: '基础', icon: 'tabler:strikethrough',
		desc: '选中后加删除线', syntax: '~~文字~~',
		template: '~~$0删除的文字~~', wrap: ['~~', '~~'], fallback: '删除的文字',
	},
	{
		label: '下划线', group: '基础', icon: 'tabler:underline',
		desc: 'HTML 下划线标签', syntax: '<u>文字</u>',
		template: '<u>$0下划线文字</u>', wrap: ['<u>', '</u>'], fallback: '下划线文字',
	},
	{
		label: '行内代码', group: '基础', icon: 'tabler:code',
		desc: '选中后变行内代码', syntax: '`code`',
		template: '`$0code`', wrap: ['`', '`'], fallback: 'code',
	},
	{
		label: '链接', group: '基础', icon: 'tabler:link',
		desc: '超链接', syntax: '[文字](地址)',
		template: '[$0链接文字](https://example.com)',
	},
	{
		label: '图片', group: '基础', icon: 'tabler:photo',
		desc: '单张图片', syntax: '![说明](地址)',
		template: '![$0图片说明](https://example.com/a.jpg)',
	},
	{
		label: '引用', group: '基础', icon: 'tabler:blockquote',
		desc: '引用段落', syntax: '> 内容',
		template: '> $0引用内容',
	},
	{
		label: '无序列表', group: '基础', icon: 'tabler:list',
		desc: '符号列表', syntax: '- 项目',
		template: '- $0第一项\n- 第二项\n- 第三项',
	},
	{
		label: '有序列表', group: '基础', icon: 'tabler:list-numbers',
		desc: '编号列表', syntax: '1. 项目',
		template: '1. $0第一项\n2. 第二项\n3. 第三项',
	},
	{
		label: '任务列表', group: '基础', icon: 'tabler:list-check',
		desc: '待办勾选', syntax: '- [ ] 项目',
		template: '- [ ] $0待办事项\n- [x] 已完成事项',
	},
	{
		label: '代码块', group: '基础', icon: 'tabler:codeblock',
		desc: '带语言高亮', syntax: '```ts',
		template: '```ts\nconst message = \'$0Hello, Clarity!\'\nconsole.log(message)\n```',
	},
	{
		label: '表格', group: '基础', icon: 'tabler:table',
		desc: 'Markdown 表格', syntax: '| 列 | 列 |',
		template: '| 项目 | 说明 |\n| --- | --- |\n| $0第一项 | 这里写说明 |\n| 第二项 | 这里写说明 |',
	},
	{
		label: '分割线', group: '基础', icon: 'tabler:separator',
		desc: '章节分隔', syntax: '---',
		template: '\n---\n$0',
	},

	// ---------- 组件 ----------
	{
		label: '提示框', group: '组件', icon: 'tabler:alert-circle',
		desc: '彩色提示卡片，支持 tip/info/question/warning/error', syntax: '::alert{type="info"}',
		template: '::alert{type="info" title="提示标题"}\n这里写提示内容，支持 **Markdown** 语法。\n$0\n::',
	},
	{
		label: '气泡提示', group: '组件', icon: 'tabler:info-circle',
		desc: '鼠标悬停显示补充说明', syntax: ':tip[文字]{tip="内容"}',
		template: ':tip[$0悬停这里]{tip="这里是补充说明的内容"}',
		note: '行内组件前面要留空格，紧跟中文或标点不会被识别',
	},
	{
		label: '折叠块', group: '组件', icon: 'tabler:chevrons-down',
		desc: '点击展开隐藏内容', syntax: '::folding{title="标题"}',
		template: '::folding{title="$0点我展开"}\n这里是折叠起来的内容。\n::',
	},
	{
		label: '标签页', group: '组件', icon: 'tabler:layout-navbar',
		desc: '多标签切换内容', syntax: '::tab{:tabs=\'[...]\'}',
		template: '::tab{:tabs=\'["说明","代码"]\'}\n#tab1\n这里是说明内容。\n#tab2\n```ts\nconst demo = $0true\n```\n::',
	},
	{
		label: '时间线', group: '组件', icon: 'tabler:timeline',
		desc: '按时间轴排版事件，标题与内容各占一段', syntax: '::timeline',
		template: '::timeline\n{$0第一阶段}\n\n这里写这一阶段的说明。\n\n{第二阶段}\n\n这里写第二阶段的说明。\n::',
	},
	{
		label: '对话', group: '组件', icon: 'tabler:messages',
		desc: '聊天气泡：{.我} 自己 / {:系统} 居中 / {对方} 普通', syntax: '::chat',
		template: '::chat\n{:系统消息，对话开始}\n\n{.我}\n\n$0你好，这是我发送的消息\n\n{对方}\n\n这是对方的回复内容\n::',
	},
	{
		label: '引言', group: '组件', icon: 'tabler:quote',
		desc: '带图标的醒目引言', syntax: ':quote[文字]',
		template: ':quote[$0有些话值得单独放一行。]',
	},
	{
		label: '快捷键', group: '组件', icon: 'tabler:keyboard',
		desc: '键盘按键样式', syntax: ':key{cmd}',
		template: '按 :key{cmd code="$0k"} 打开命令面板',
	},
	{
		label: '马赛克', group: '组件', icon: 'tabler:eye-off',
		desc: '悬停才显示的文字', syntax: ':blur[文字]',
		template: ':blur[$0这里是被遮住的文字]',
		note: '行内组件前面要留空格，紧跟中文或标点不会被识别',
	},
	{
		label: '卡片列表', group: '组件', icon: 'tabler:layout-grid',
		desc: '把列表变成卡片网格', syntax: '::card-list',
		template: '::card-list\n- $0第一张卡片\n- 第二张卡片\n- 第三张卡片\n::',
	},
	{
		label: '徽章', group: '组件', icon: 'tabler:certificate',
		desc: '带图标的小标签', syntax: ':badge{text="..."}',
		template: ':badge{text="$0项目名" link="https://github.com"}',
	},
	{
		label: '复制命令', group: '组件', icon: 'tabler:copy',
		desc: '一键复制的代码行', syntax: ':copy{code="..."}',
		template: ':copy{code="$0pnpm install"}',
	},
	{
		label: '诗歌', group: '组件', icon: 'tabler:book',
		desc: '居中诗文样式', syntax: '::poetry{title="..."}',
		template: '::poetry{title="$0标题" author="作者"}\n正文第一行\n正文第二行\n::',
	},
	{
		label: '大标题', group: '组件', icon: 'tabler:heading',
		desc: '文章内的装饰标题', syntax: '::md-title',
		template: '::md-title\n$0这里是大标题\n::',
	},

	// ---------- 媒体 ----------
	{
		label: '图片组', group: '媒体', icon: 'tabler:photo',
		desc: '多图瀑布流，支持灯箱', syntax: '::pics',
		template: '::pics\n---\nimages:\n  - src: https://example.com/photo-1.jpg\n    caption: $0第一张图的说明\n  - src: https://example.com/photo-2.jpg\n    caption: 第二张图的说明\n---\n::',
	},
	{
		label: 'Mermaid 图', group: '媒体', icon: 'tabler:hierarchy',
		desc: '流程图/时序图', syntax: '```mermaid',
		template: '```mermaid\ngraph TD\n  A[$0开始] --> B[处理]\n  B --> C[结束]\n```',
	},
	{
		label: '乐谱', group: '媒体', icon: 'tabler:music',
		desc: 'ABC 记谱法渲染', syntax: '```music-abc',
		template: '```music-abc\nX:1\nT:示例\nM:4/4\nL:1/8\nK:C\n$0C D E F|G A B c|\n```',
	},
	{
		label: '音频播放条', group: '媒体', icon: 'tabler:headphones',
		desc: '内嵌音频播放器', syntax: ':audio-player{src="..."}',
		template: ':audio-player{src="$0https://example.com/audio.mp3" name="曲名"}',
	},
	{
		label: '视频嵌入', group: '媒体', icon: 'tabler:video',
		desc: 'B站/YouTube/抖音视频', syntax: ':video{type="bilibili"}',
		template: ':video{type="bilibili" id="$0BV1xx411c7mD"}',
	},
	{
		label: '表情时钟', group: '媒体', icon: 'tabler:clock',
		desc: '按时间变表情的时钟', syntax: ':emoji-clock{datetime="..."}',
		template: ':emoji-clock{datetime="$02026-01-01 12:00"}',
	},
	{
		label: '链接横幅', group: '媒体', icon: 'tabler:rectangle',
		desc: '大图 + 标题的推广横幅', syntax: '::link-banner',
		template: '::link-banner\n---\ntitle: $0站点名称\nlink: "https://example.com"\ndescription: 一句话介绍\nbanner: https://example.com/banner.jpg\n---\n::',
	},
	{
		label: '链接卡片', group: '媒体', icon: 'tabler:credit-card',
		desc: '带图标的推荐卡片', syntax: '::link-card',
		template: '::link-card\n---\ntitle: $0站点名称\nlink: "https://example.com"\ndescription: 一句话介绍\n---\n::',
	},

	// ---------- 布局 ----------
	{
		label: '块级公式', group: '布局', icon: 'tabler:math',
		desc: '居中的数学公式', syntax: '$$ ... $$',
		template: '$$\nE = mc^2\n$0\n$$',
	},
	{
		label: '行内公式', group: '布局', icon: 'tabler:math-function',
		desc: '段落内的数学公式', syntax: '$ ... $',
		template: '质能方程 $E=mc^2$ 说明$0质量与能量的关系',
	},
	{
		// 冻结：侧栏属于博客页面模板，写作工作台只渲染正文，这里插入不会有任何效果
		label: '自定义侧栏', group: '布局', icon: 'tabler:layout-sidebar',
		desc: '往右栏插入自定义内容', syntax: '<meta-aside-名称>',
		template: '<meta-aside-自定义>\n$0这里的内容会显示在该页右侧栏\n</meta-aside-自定义>',
		frozen: true,
		frozenNote: '侧栏交给博客模板处理',
	},
]

export const SNIPPET_GROUPS = ['基础', '组件', '媒体', '布局'] as const
