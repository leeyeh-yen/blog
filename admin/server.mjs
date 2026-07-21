import http from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { execFile } from 'node:child_process'
import { cp, mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import matter from 'gray-matter'
import sharp from 'sharp'

const exec = promisify(execFile)
const root = process.cwd()
const adminDir = path.join(root, 'admin', 'web')
const siteDir = path.join(root, 'site')
const postsDir = path.join(root, 'site', 'posts')
const draftsDir = path.join(root, 'site', 'drafts')
const imagesDir = path.join(root, 'site', 'public', 'images')
const settingsFile = path.join(root, 'site', 'settings.json')
const trashDir = path.join(root, 'site', '.trash')
const historyDir = path.join(root, 'site', '.history')
const backupsDir = path.join(root, 'site', '.backups')
const port = Number(process.env.ADMIN_PORT || 4174)
const host = '127.0.0.1'
const csrfToken = randomBytes(24).toString('hex')
const maxBodySize = 20 * 1024 * 1024
const protectedPages = new Set(['archive.md', 'tags.md', 'about.md'])

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
}

function send(response, status, body, contentType = 'application/json; charset=utf-8') {
  response.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' })
  response.end(contentType.startsWith('application/json') ? JSON.stringify(body) : body)
}

function safeEqual(value, expected) {
  const a = Buffer.from(String(value || ''))
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

function normalizeRelative(value) {
  const normalized = String(value || '').replaceAll('\\', '/').replace(/^\/+/, '')
  if (!normalized || normalized.includes('..') || path.isAbsolute(normalized)) throw new Error('路径无效')
  return normalized
}

function resolveInside(base, relative) {
  const target = path.resolve(base, normalizeRelative(relative))
  if (!target.startsWith(`${path.resolve(base)}${path.sep}`)) throw new Error('路径越界')
  return target
}

async function readJsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBodySize) throw new Error('请求内容过大')
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function walkMarkdown(base, status) {
  try {
    const entries = await readdir(base, { recursive: true, withFileTypes: true })
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    return Promise.all(files.map(async (entry) => {
      const absolute = path.join(entry.parentPath, entry.name)
      const content = await readFile(absolute, 'utf8')
      const parsed = matter(content)
      return {
        path: path.relative(base, absolute).replaceAll('\\', '/'),
        status,
        title: parsed.data.title || '无题',
        date: parsed.data.date ? new Date(parsed.data.date).toISOString().slice(0, 10) : '',
        description: parsed.data.description || '',
        tags: parsed.data.tags || [],
        updatedAt: (await stat(absolute)).mtime.toISOString(),
      }
    }))
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function listPosts() {
  const [published, drafts] = await Promise.all([
    walkMarkdown(postsDir, 'published'),
    walkMarkdown(draftsDir, 'draft'),
  ])
  return [...published, ...drafts].sort((a, b) => b.date.localeCompare(a.date))
}

function safePageRelative(value) {
  const relative = normalizeRelative(value)
  if (relative.includes('/') || !relative.endsWith('.md') || relative === 'index.md') throw new Error('页面路径无效')
  return relative
}

async function listPages() {
  const entries = await readdir(siteDir, { withFileTypes: true })
  const pages = await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'index.md')
    .map(async (entry) => {
      const content = await readFile(path.join(siteDir, entry.name), 'utf8')
      const parsed = matter(content)
      return {
        path: entry.name,
        title: parsed.data.title || '无题页面',
        description: parsed.data.description || '',
        navLabel: parsed.data.navLabel || parsed.data.title || '页面',
        navOrder: Number(parsed.data.navOrder) || 100,
        nav: parsed.data.nav !== false,
        protected: protectedPages.has(entry.name),
      }
    }))
  return pages.sort((a, b) => a.navOrder - b.navOrder || a.title.localeCompare(b.title, 'zh-CN'))
}

async function archiveVersion(file, relative) {
  try {
    const content = await readFile(file, 'utf8')
    const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
    const name = `${stamp}-${relative.replaceAll('/', '__')}`
    await mkdir(historyDir, { recursive: true })
    await writeFile(path.join(historyDir, name), content, 'utf8')
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
}

async function listTrash() {
  try {
    const entries = await readdir(trashDir)
    const metadata = entries.filter((name) => name.endsWith('.json'))
    return Promise.all(metadata.map(async (name) => JSON.parse(await readFile(path.join(trashDir, name), 'utf8'))))
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function gitStatus() {
  try {
    const { stdout } = await exec('git', ['status', '--short'], { cwd: root })
    return stdout.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

async function gitInfo() {
  const changes = await gitStatus()
  const readGit = async (args) => {
    try { return (await exec('git', args, { cwd: root })).stdout.trim() }
    catch { return '' }
  }
  const [branch, remote] = await Promise.all([
    readGit(['branch', '--show-current']),
    readGit(['remote', 'get-url', 'origin']),
  ])
  return { changes, branch: branch || '未命名分支', remote, projectRoot: root }
}

async function handleApi(request, response, url) {
  const unsafe = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)
  if (unsafe) {
    const origin = request.headers.origin
    if (origin && ![`http://${host}:${port}`, `http://localhost:${port}`].includes(origin)) {
      return send(response, 403, { error: '来源校验失败' })
    }
    if (!safeEqual(request.headers['x-csrf-token'], csrfToken)) {
      return send(response, 403, { error: '安全令牌无效，请刷新管理页面' })
    }
  }

  if (request.method === 'GET' && url.pathname === '/api/posts') {
    return send(response, 200, { posts: await listPosts() })
  }

  if (request.method === 'GET' && url.pathname === '/api/pages') {
    return send(response, 200, { pages: await listPages() })
  }

  if (request.method === 'GET' && url.pathname === '/api/page') {
    const relative = safePageRelative(url.searchParams.get('path'))
    const content = await readFile(resolveInside(siteDir, relative), 'utf8')
    return send(response, 200, { content, path: relative, protected: protectedPages.has(relative) })
  }

  if (request.method === 'POST' && url.pathname === '/api/page') {
    const body = await readJsonBody(request)
    const relative = safePageRelative(body.path)
    const target = resolveInside(siteDir, relative)
    if (protectedPages.has(relative) && body.previousPath !== relative) throw new Error('该路径属于内置页面，请换一个路径')
    if (body.previousPath && body.previousPath !== relative && protectedPages.has(safePageRelative(body.previousPath))) throw new Error('内置页面不能修改路径')
    if (body.previousPath !== relative) {
      const occupied = await stat(target).then(() => true).catch((error) => { if (error.code === 'ENOENT') return false; throw error })
      if (occupied) throw new Error('该页面路径已经存在')
    }
    matter.test(String(body.content || ''))
    await archiveVersion(target, `page__${relative}`)
    await writeFile(target, String(body.content || ''), 'utf8')
    if (body.previousPath && body.previousPath !== relative) {
      const previousRelative = safePageRelative(body.previousPath)
      await unlink(resolveInside(siteDir, previousRelative)).catch((error) => { if (error.code !== 'ENOENT') throw error })
    }
    return send(response, 200, { ok: true, path: relative, protected: protectedPages.has(relative) })
  }

  if (request.method === 'DELETE' && url.pathname === '/api/page') {
    const body = await readJsonBody(request)
    const relative = safePageRelative(body.path)
    if (protectedPages.has(relative)) throw new Error('归档、标签和关于页面不能删除')
    await unlink(resolveInside(siteDir, relative))
    return send(response, 200, { ok: true })
  }

  if (request.method === 'GET' && url.pathname === '/api/settings') {
    return send(response, 200, JSON.parse(await readFile(settingsFile, 'utf8')))
  }

  if (request.method === 'POST' && url.pathname === '/api/settings') {
    const body = await readJsonBody(request)
    const settings = {
      title: String(body.title || '').trim() || '未名手记',
      description: String(body.description || '').trim(),
      author: String(body.author || '').trim() || '博主',
      homePageSize: Math.min(20, Math.max(1, Number(body.homePageSize) || 5)),
      footerStartYear: Math.min(new Date().getFullYear(), Math.max(1970, Number(body.footerStartYear) || new Date().getFullYear())),
      footerLinkLabel: String(body.footerLinkLabel || '').trim(),
      footerLinkUrl: String(body.footerLinkUrl || '').trim(),
      footerNote: String(body.footerNote || '').trim(),
      footerQuote: String(body.footerQuote || '').trim(),
      githubRepository: String(body.githubRepository || '').trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, ''),
      githubBranch: String(body.githubBranch || '').trim() || 'master',
    }
    await writeFile(settingsFile, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
    return send(response, 200, { ok: true, settings })
  }

  if (request.method === 'GET' && url.pathname === '/api/post') {
    const status = url.searchParams.get('status') === 'draft' ? 'draft' : 'published'
    const base = status === 'draft' ? draftsDir : postsDir
    const file = resolveInside(base, url.searchParams.get('path'))
    const content = await readFile(file, 'utf8')
    return send(response, 200, { content, status, path: path.relative(base, file).replaceAll('\\', '/') })
  }

  if (request.method === 'POST' && url.pathname === '/api/post') {
    const body = await readJsonBody(request)
    const nextStatus = body.status === 'draft' ? 'draft' : 'published'
    const base = nextStatus === 'draft' ? draftsDir : postsDir
    const target = resolveInside(base, body.path)
    matter.test(String(body.content || ''))
    await mkdir(path.dirname(target), { recursive: true })
    await archiveVersion(target, body.path)
    await writeFile(target, String(body.content || ''), 'utf8')

    if (body.previousPath && body.previousStatus) {
      const previousBase = body.previousStatus === 'draft' ? draftsDir : postsDir
      const previous = resolveInside(previousBase, body.previousPath)
      if (previous !== target) await unlink(previous).catch((error) => { if (error.code !== 'ENOENT') throw error })
    }
    return send(response, 200, { ok: true, path: body.path, status: nextStatus })
  }

  if (request.method === 'DELETE' && url.pathname === '/api/post') {
    const body = await readJsonBody(request)
    const base = body.status === 'draft' ? draftsDir : postsDir
    const source = resolveInside(base, body.path)
    const content = await readFile(source, 'utf8')
    const parsed = matter(content)
    const id = `${Date.now()}-${randomBytes(4).toString('hex')}`
    await mkdir(trashDir, { recursive: true })
    await rename(source, path.join(trashDir, `${id}.md`))
    const metadata = { id, path: body.path, status: body.status === 'draft' ? 'draft' : 'published', title: parsed.data.title || '无题', deletedAt: new Date().toISOString() }
    await writeFile(path.join(trashDir, `${id}.json`), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8')
    return send(response, 200, { ok: true, recoverable: true })
  }

  if (request.method === 'GET' && url.pathname === '/api/trash') {
    const items = await listTrash()
    return send(response, 200, { items: items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)) })
  }

  if (request.method === 'POST' && url.pathname === '/api/trash/restore') {
    const body = await readJsonBody(request)
    const id = normalizeRelative(body.id)
    const metadataFile = resolveInside(trashDir, `${id}.json`)
    const metadata = JSON.parse(await readFile(metadataFile, 'utf8'))
    const base = metadata.status === 'draft' ? draftsDir : postsDir
    const target = resolveInside(base, metadata.path)
    await mkdir(path.dirname(target), { recursive: true })
    await rename(resolveInside(trashDir, `${id}.md`), target)
    await unlink(metadataFile)
    return send(response, 200, { ok: true })
  }

  if (request.method === 'POST' && url.pathname === '/api/backup') {
    const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
    const destination = path.join(backupsDir, stamp)
    await mkdir(destination, { recursive: true })
    await Promise.all([
      cp(postsDir, path.join(destination, 'posts'), { recursive: true }),
      cp(draftsDir, path.join(destination, 'drafts'), { recursive: true }),
      cp(settingsFile, path.join(destination, 'settings.json')),
    ])
    return send(response, 200, { ok: true, path: path.relative(root, destination).replaceAll('\\', '/') })
  }

  if (request.method === 'POST' && url.pathname === '/api/media') {
    const body = await readJsonBody(request)
    const slug = normalizeRelative(body.slug).replaceAll('/', '-')
    const originalName = path.basename(normalizeRelative(body.fileName))
    const stem = originalName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || `image-${Date.now()}`
    const folder = resolveInside(imagesDir, `${new Date().getFullYear()}/${slug}`)
    const buffer = Buffer.from(String(body.data || '').replace(/^data:[^;]+;base64,/, ''), 'base64')
    const metadata = await sharp(buffer).metadata()
    if (!metadata.format) throw new Error('无法识别图片格式')
    await mkdir(folder, { recursive: true })
    if (body.mode === 'original') {
      const extensions = { jpeg: '.jpg', png: '.png', webp: '.webp', gif: '.gif', avif: '.avif' }
      const extension = extensions[metadata.format]
      if (!extension) throw new Error('保留原图仅支持 JPG、PNG、WebP、GIF 和 AVIF')
      await writeFile(path.join(folder, `${stem}${extension}`), buffer)
      return send(response, 200, { path: `/images/${new Date().getFullYear()}/${slug}/${stem}${extension}`, mode: 'original' })
    }
    await sharp(buffer).rotate().resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(path.join(folder, `${stem}.webp`))
    return send(response, 200, { path: `/images/${new Date().getFullYear()}/${slug}/${stem}.webp`, mode: 'compressed' })
  }

  if (request.method === 'GET' && url.pathname === '/api/git/status') {
    return send(response, 200, await gitInfo())
  }

  if (request.method === 'POST' && url.pathname === '/api/build') {
    await exec('pnpm', ['build'], { cwd: root, shell: process.platform === 'win32', maxBuffer: 10 * 1024 * 1024 })
    return send(response, 200, { ok: true, message: '博客构建检查通过' })
  }

  if (request.method === 'POST' && url.pathname === '/api/publish') {
    const body = await readJsonBody(request)
    const message = String(body.message || '').trim() || `发布博客 ${new Date().toLocaleString('zh-CN')}`
    const info = await gitInfo()
    if (!info.remote) throw new Error('尚未配置 Git 远程仓库，请先完成 GitHub 仓库设置')
    await exec('pnpm', ['build'], { cwd: root, shell: process.platform === 'win32', maxBuffer: 10 * 1024 * 1024 })
    await exec('git', ['add', '--all'], { cwd: root })
    const changes = await gitStatus()
    if (!changes.length) return send(response, 200, { ok: true, pushed: false, message: '没有需要发布的变更' })
    await exec('git', ['commit', '-m', message], { cwd: root })
    await exec('git', ['push'], { cwd: root })
    return send(response, 200, { ok: true, pushed: true })
  }

  return send(response, 404, { error: '接口不存在' })
}

async function serveStatic(response, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1)
  const file = resolveInside(adminDir, relative)
  const content = await readFile(file)
  const extension = path.extname(file)
  const body = extension === '.html' ? content.toString('utf8').replaceAll('__CSRF_TOKEN__', csrfToken) : content
  send(response, 200, body, mimeTypes[extension] || 'application/octet-stream')
}

await Promise.all([mkdir(postsDir, { recursive: true }), mkdir(draftsDir, { recursive: true }), mkdir(imagesDir, { recursive: true }), mkdir(trashDir, { recursive: true }), mkdir(historyDir, { recursive: true }), mkdir(backupsDir, { recursive: true })])

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${host}:${port}`)
    if (url.pathname.startsWith('/api/')) return await handleApi(request, response, url)
    await serveStatic(response, url.pathname)
  } catch (error) {
    const status = error.code === 'ENOENT' ? 404 : 500
    send(response, status, { error: status === 404 ? '内容不存在' : error.message || '服务器错误' })
  }
})

server.listen(port, host, () => {
  console.log(`本地博客管理器：http://${host}:${port}`)
})
