/** 友链架构图标映射 */
// @keep-sorted
const archIcons = {
	'Astro': 'simple-icons:astro',
	'Cloudflare': 'simple-icons:cloudflare',
	'Deno Deploy': 'simple-icons:deno',
	'EdgeOne': 'zi:tencentcloud', // 不准确
	'Express': 'simple-icons:express',
	'Fly': 'tabler:air-balloon',
	'Framer': 'simple-icons:framer',
	'Ghost': 'simple-icons:ghost',
	'GitHub Pages': 'simple-icons:github',
	'Golang': 'simple-icons:go',
	'Gridea': 'tabler:square-rounded-letter-g-filled', // 不准确
	'Halo': 'tabler:square-rounded-letter-h-filled', // 不准确
	'Hexo': 'simple-icons:hexo',
	'HTML': 'simple-icons:html5',
	'Hugo': 'simple-icons:hugo',
	'Jekyll': 'simple-icons:jekyll',
	'Material for MkDocs': 'simple-icons:materialformkdocs',
	'Netlify': 'simple-icons:netlify',
	'Next.js': 'simple-icons:nextdotjs',
	'Notion': 'simple-icons:notion',
	'NotionNext': 'simple-icons:notion',
	'Nuxt': 'simple-icons:nuxt',
	'PHP': 'simple-icons:php',
	'Python': 'simple-icons:python',
	'React': 'simple-icons:react',
	'Typecho': 'tabler:square-rounded-letter-t-filled', // 不准确 // 不准确
	'Valaxy': 'tabler:letter-v', // 不准确
	'Vercel': 'simple-icons:vercel',
	'VitePress': 'simple-icons:vitepress',
	'Vue': 'simple-icons:vuedotjs',
	'VuePress': 'simple-icons:vuedotjs',
	'WordPress': 'simple-icons:wordpress',
	'Zeabur': 'tabler:square-letter-z-filled', // 不准确
	'国内 CDN': 'tabler:cloud-data-connection',
	'服务器': 'tabler:server',
	'虚拟主机': 'tabler:cloud-upload',
}

export type Arch = keyof typeof archIcons

export function getArchIcon(arch: Arch) {
	return archIcons[arch] ?? ''
}

/** BlogTech Widget 构建平台图标映射 */
// @keep-sorted
export const ciIcons: Record<string, string> = {
	'Cloudflare Pages': 'simple-icons:cloudflarepages',
	'Cloudflare Workers': 'simple-icons:cloudflareworkers',
	'EdgeOne': 'zi:tencentcloud',
	'GitHub Actions': 'ri:github-fill',
	'Netlify CI': 'catppuccin:netlify',
	'Vercel': 'ri:vercel-fill',
}

/** 主域名图标映射 */
// @keep-sorted
const mainDomainIcons: Record<string, string> = {
	'bilibili.com': 'ri:bilibili-fill',
	'creativecommons.org': 'ri:creative-commons-line',
	'feishu.cn': 'zi:new-lark',
	'github.com': 'ri:github-fill',
	'github.io': 'ri:github-fill',
	'google.cn': 'ri:google-fill',
	'google.com': 'ri:google-fill',
	'jd.com': 'zi:jd-sports',
	'larkoffice.com': 'zi:new-lark',
	'microsoft.com': 'ri:microsoft-fill',
	'netlify.app': 'simple-icons:netlify',
	'pages.dev': 'simple-icons:cloudflare',
	'qq.com': 'ri:qq-fill',
	'taobao.com': 'ri:taobao-fill',
	'thisis.host': 'tabler:star-filled',
	'tmall.com': 'ri:taobao-fill',
	'v2ex.com': 'simple-icons:v2ex',
	'vercel.app': 'simple-icons:vercel',
	'zabaur.app': 'tabler:square-letter-z-filled',
	'zhihu.com': 'ri:zhihu-line',
}

/** 专门域名图标映射，优先级高于主域名图标 */
// @keep-sorted
export const domainIcons: Record<string, string> = {
	'developer.mozilla.org': 'simple-icons:mdnwebdocs',
	'h5.qzone.qq.com': 'simple-icons:qzone',
	'mp.weixin.qq.com': 'ri:wechat-fill',
}

export function getDomainIcon(url: string) {
	const domain = getDomain(url)
	if (domain in domainIcons)
		return domainIcons[domain]
	/**
	 * 从**最长**的后缀开始逐段剥离，命中映射表就用。
	 *
	 * 原来这里是 `getMainDomain(url, true)`（走 parse-domain 算 eTLD+1），
	 * 但映射表的键本来就是「站点后缀」：`xxx.github.io` 剥两段到 `github.io` 正是想要的，
	 * 而 `www.bilibili.com` 剥到 `bilibili.com` 也对。
	 * 用后缀匹配替掉整个 Public Suffix List 之后，这个函数就不再依赖 `parse-domain`，
	 * 正文链接（`ProseA`）和文章首屏也就不用跟着下载那 89 KB 了。
	 *
	 * 对表里没有的域名会一路试到只剩顶级域，最后返回 `undefined`，
	 * 和原来「查不到就是 undefined」的行为一致。
	 */
	const labels = domain.split('.')
	for (let index = 1; index < labels.length; index++) {
		const candidate = labels.slice(index).join('.')
		if (candidate in mainDomainIcons)
			return mainDomainIcons[candidate]
	}
	return undefined
}

/** 文件名后缀图标映射，优先级高于代码块语言图标映射 */
// @keep-sorted
const file2icon: Record<string, string> = {
	'.babelrc.js': 'catppuccin:babel',
	'.babelrc': 'catppuccin:babel',
	'.crt': 'catppuccin:certificate',
	'.editorconfig': 'catppuccin:editorconfig',
	'.env': 'catppuccin:env',
	'.gitattributes': 'catppuccin:git',
	'.gitconfig': 'catppuccin:git',
	'.gitignore': 'catppuccin:git',
	'.gitkeep': 'catppuccin:git',
	'.gitlab-ci.yml': 'catppuccin:gitlab',
	'.gitmodules': 'catppuccin:git',
	'.key': 'catppuccin:key',
	'.npmrc': 'catppuccin:npm',
	'.patch': 'catppuccin:git',
	'.prettierrc': 'catppuccin:prettier',
	'astro.config.mjs': 'catppuccin:astro-config',
	'CHANGELOG.md': 'catppuccin:changelog',
	'CODE_OF_CONDUCT.md': 'catppuccin:code-of-conduct',
	'CODEOWNERS': 'catppuccin:codeowners',
	'CONTRIBUTING.md': 'catppuccin:contributing',
	'docker-compose.yml': 'catppuccin:docker-compose',
	'eslint.config.js': 'catppuccin:eslint',
	'eslint.config.mjs': 'catppuccin:eslint',
	'LICENSE': 'catppuccin:license',
	'netlify.toml': 'catppuccin:netlify',
	'next.config.ts': 'catppuccin:next',
	'nuxt.config.ts': 'catppuccin:nuxt',
	'package.json': 'catppuccin:package-json',
	'pnpm-workspace.yaml': 'catppuccin:pnpm',
	'postcss.config.js': 'catppuccin:postcss',
	'prettier.config.js': 'catppuccin:prettier',
	'pyproject.toml': 'catppuccin:python-config',
	'README.md': 'catppuccin:readme',
	'renovate.json': 'catppuccin:renovate',
	'requirements.txt': 'catppuccin:python-config',
	'robots.txt': 'catppuccin:robots',
	'rollup.config.js': 'catppuccin:rollup',
	'SECURITY.md': 'catppuccin:security',
	'stylelint.config.js': 'catppuccin:stylelint',
	'stylelint.config.mjs': 'catppuccin:stylelint',
	'tailwind.config.js': 'catppuccin:tailwind',
	'tsconfig.json': 'catppuccin:typescript-config',
	'verccel.json': 'catppuccin:vercel',
	'vite.config.js': 'catppuccin:vite',
	'vite.config.ts': 'catppuccin:vite',
	'webpack.config.js': 'catppuccin:webpack',
	'yarn.lock': 'catppuccin:yarn',
}

export function getFileIcon(filename?: string) {
	if (!filename)
		return undefined
	const extension = Object.keys(file2icon).find(ext => filename.endsWith(ext))
	return extension ? file2icon[extension] : undefined
}

/**
 * 代码块语言简写或别名到 Catppuccin 图标库中的语言名映射
 *
 * 将 `blogConfig.shiki.langs` 的部分后缀名简写
 * 转换为代码块语言对应的 Iconify Catppuccin 图标
 */
// @keep-sorted
const ext2lang: Record<string, string> = {
	'bat': 'catppuccin:batch',
	'c': 'catppuccin:c',
	'c++': 'catppuccin:cpp',
	'cpp': 'catppuccin:cpp',
	'css': 'catppuccin:css',
	'diff': 'catppuccin:diff',
	'dockerfile': 'catppuccin:docker',
	'gql': 'catppuccin:graphql',
	'hs': 'catppuccin:haskell',
	'html': 'catppuccin:html',
	'ini': 'catppuccin:properties',
	'java': 'catppuccin:java',
	'js': 'catppuccin:javascript',
	'json': 'catppuccin:json',
	'jsonc': 'catppuccin:json',
	'jsx': 'catppuccin:javascript-react',
	'log': 'catppuccin:log',
	'make': 'catppuccin:makefile',
	'makefile': 'catppuccin:makefile',
	'matlab': 'catppuccin:matlab',
	'md': 'catppuccin:markdown',
	'mdc': 'catppuccin:markdown',
	'mdx': 'catppuccin:markdown',
	'mermaid': 'catppuccin:mermaid',
	'mmd': 'catppuccin:mermaid',
	'powershell': 'catppuccin:powershell',
	'ps': 'catppuccin:powershell',
	'ps1': 'catppuccin:powershell',
	'py': 'catppuccin:python',
	'python': 'catppuccin:python',
	'rs': 'catppuccin:rust',
	'scss': 'catppuccin:sass',
	'sh': 'catppuccin:bash',
	'shell': 'catppuccin:bash',
	'shellscript': 'catppuccin:bash',
	'sql': 'catppuccin:database',
	'ssh-config': 'catppuccin:properties',
	'ssh': 'catppuccin:properties',
	'toml': 'catppuccin:toml',
	'ts': 'catppuccin:typescript',
	'tsx': 'catppuccin:typescript-react',
	'vb': 'catppuccin:visual-studio',
	'vue': 'catppuccin:vue',
	'xml': 'catppuccin:xml',
	'yaml': 'catppuccin:yaml',
	'yml': 'catppuccin:yaml',
	'zsh': 'catppuccin:bash',
}

export function getLangIcon(extension = 'file') {
	return ext2lang[extension] ?? 'catppuccin:file'
}
