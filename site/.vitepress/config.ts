import { defineConfig } from 'vitepress'
import settings from '../settings.json'

const githubRepository = process.env.GITHUB_REPOSITORY || process.env.GITHUB_REPO || settings.githubRepository || ''
const repository = githubRepository.split('/')[1] ?? ''
const githubBranch = process.env.GITHUB_BRANCH || settings.githubBranch || 'master'
const defaultBase = repository && !repository.endsWith('.github.io') ? `/${repository}/` : '/'
const base = process.env.BASE_PATH || defaultBase
const siteUrl = (process.env.SITE_URL || 'https://example.com').replace(/\/$/, '')

export default defineConfig({
  lang: 'zh-CN',
  title: settings.title,
  description: settings.description,
  base,
  cleanUrls: true,
  srcExclude: ['drafts/**'],
  lastUpdated: true,
  sitemap: {
    hostname: siteUrl,
  },
  head: [
    ['script', {}, `(function(){try{var mode=localStorage.getItem('blog-theme-mode')||'system';var dark=mode==='dark'||(mode==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark)}catch(e){}})()`],
    ['meta', { name: 'theme-color', content: '#ffffff', media: '(prefers-color-scheme: light)' }],
    ['meta', { name: 'theme-color', content: '#000000', media: '(prefers-color-scheme: dark)' }],
    ['meta', { name: 'color-scheme', content: 'light dark' }],
    ['link', { rel: 'alternate', type: 'application/rss+xml', title: `${settings.title} RSS`, href: `${base}rss.xml` }],
  ],
  markdown: {
    lineNumbers: true,
    theme: { light: 'github-light', dark: 'github-dark' },
    config(md) {
      const renderImage = md.renderer.rules.image ?? ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options))
      const renderParagraphOpen = md.renderer.rules.paragraph_open ?? ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options))
      const renderParagraphClose = md.renderer.rules.paragraph_close ?? ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options))
      const standaloneImage = (tokens, paragraphIndex) => {
        const inline = tokens[paragraphIndex + 1]?.type === 'inline' ? tokens[paragraphIndex + 1] : tokens[paragraphIndex - 1]
        return inline?.children?.length === 1 && inline.children[0].type === 'image' ? inline.children[0] : null
      }

      md.renderer.rules.paragraph_open = (tokens, index, options, env, self) => {
        const image = standaloneImage(tokens, index)
        if (!image) return renderParagraphOpen(tokens, index, options, env, self)
        image.meta = { ...image.meta, standalone: true }
        return '<figure class="article-figure">'
      }
      md.renderer.rules.paragraph_close = (tokens, index, options, env, self) => (
        standaloneImage(tokens, index) ? '</figure>' : renderParagraphClose(tokens, index, options, env, self)
      )
      md.renderer.rules.image = (tokens, index, options, env, self) => {
        const image = tokens[index]
        const rendered = renderImage(tokens, index, options, env, self)
        if (!image.meta?.standalone || !image.content.trim()) return rendered
        return `${rendered}<figcaption>${md.utils.escapeHtml(image.content.trim())}</figcaption>`
      }
    },
  },
  themeConfig: {
    siteTitle: settings.title,
    author: settings.author,
    homePageSize: settings.homePageSize,
    footerStartYear: settings.footerStartYear,
    footerLinkLabel: settings.footerLinkLabel,
    footerLinkUrl: settings.footerLinkUrl,
    footerNote: settings.footerNote,
    footerQuote: settings.footerQuote,
    githubRepository,
    githubBranch,
    commentsEnabled: settings.commentsEnabled,
    beaudarRepository: settings.beaudarRepository,
    beaudarBranch: settings.beaudarBranch,
  },
})
