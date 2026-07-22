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
