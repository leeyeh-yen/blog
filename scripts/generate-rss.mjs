import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import matter from 'gray-matter'

const root = process.cwd()
const siteUrl = (process.env.SITE_URL || 'https://example.com').replace(/\/$/, '')
const base = process.env.BASE_PATH || '/'
const files = await fg('site/posts/**/*.md', { cwd: root, absolute: true })
const escapeXml = (value = '') => String(value).replace(/[<>&'\"]/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[char])

const posts = await Promise.all(files.map(async (file) => {
  const source = await readFile(file, 'utf8')
  const { data } = matter(source)
  const relative = path.relative(path.join(root, 'site'), file).replaceAll('\\', '/').replace(/\.md$/, '')
  return { ...data, url: `${siteUrl}${base}${relative}` }
}))

const items = posts
  .filter((post) => !post.draft)
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .map((post) => `  <item>\n    <title>${escapeXml(post.title)}</title>\n    <link>${escapeXml(post.url)}</link>\n    <guid>${escapeXml(post.url)}</guid>\n    <pubDate>${new Date(post.date).toUTCString()}</pubDate>\n    <description>${escapeXml(post.description)}</description>\n  </item>`)
  .join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n  <title>未名手记</title>\n  <link>${siteUrl}${base}</link>\n  <description>关于生活、技术与缓慢思考的个人记录。</description>\n${items}\n</channel>\n</rss>\n`

const output = path.join(root, 'site/.vitepress/dist/rss.xml')
await mkdir(path.dirname(output), { recursive: true })
await writeFile(output, xml)
