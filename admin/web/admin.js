const csrf = document.querySelector('meta[name="csrf-token"]').content
const state = { posts: [], pages: [], current: null, dirty: false, statusFilter: 'all', mode: 'posts' }
const $ = (selector) => document.querySelector(selector)
const fields = ['title', 'date', 'slug', 'status', 'description', 'tags', 'staleNotice', 'staleAfterDays', 'staleMessage', 'navLabel', 'navOrder', 'navVisible', 'content']
const recoveryKey = 'mori-local-admin-recovery'

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, ...(options.headers || {}) },
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || '操作失败')
  return body
}

function toast(message) {
  const element = $('#toast')
  element.textContent = message
  element.classList.add('show')
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => element.classList.remove('show'), 2600)
}

function publishStatus(message = '', type = 'info') {
  const element = $('#publish-status')
  element.textContent = message
  element.dataset.type = type
  element.classList.toggle('hidden', !message)
}

function slugify(value) {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

function renderInline(source) {
  return escapeHtml(source)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
}

function renderMarkdown(source) {
  return source.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n')
    if (/^```/.test(lines[0]) && /^```\s*$/.test(lines.at(-1))) return `<pre><code>${escapeHtml(lines.slice(1, -1).join('\n'))}</code></pre>`
    if (lines.every((line) => /^[-*]\s+/.test(line))) return `<ul>${lines.map((line) => `<li>${renderInline(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`
    if (lines.every((line) => /^\d+\.\s+/.test(line))) return `<ol>${lines.map((line) => `<li>${renderInline(line.replace(/^\d+\.\s+/, ''))}</li>`).join('')}</ol>`
    if (lines.every((line) => /^>\s?/.test(line))) return `<blockquote>${lines.map((line) => renderInline(line.replace(/^>\s?/, ''))).join('<br>')}</blockquote>`
    if (/^###\s+/.test(block)) return `<h3>${renderInline(block.replace(/^###\s+/, ''))}</h3>`
    if (/^##\s+/.test(block)) return `<h2>${renderInline(block.replace(/^##\s+/, ''))}</h2>`
    if (/^#\s+/.test(block)) return `<h1>${renderInline(block.replace(/^#\s+/, ''))}</h1>`
    if (/^---\s*$/.test(block)) return '<hr>'
    return `<p>${renderInline(block).replaceAll('\n', '<br>')}</p>`
  }).join('')
}

function frontmatter() {
  const quoted = (value) => JSON.stringify(String(value || ''))
  if (state.mode === 'pages') {
    return `---\ntitle: ${quoted($('#title').value)}\ndescription: ${quoted($('#description').value)}\nnav: ${$('#navVisible').value === 'true'}\nnavLabel: ${quoted($('#navLabel').value || $('#title').value)}\nnavOrder: ${Math.max(1, Number($('#navOrder').value) || 100)}\n---\n\n${$('#content').value.trim()}\n`
  }
  const tags = $('#tags').value.split(',').map((tag) => tag.trim()).filter(Boolean)
  return `---\ntitle: ${quoted($('#title').value)}\ndate: ${$('#date').value}\ndescription: ${quoted($('#description').value)}\ntags:\n${tags.map((tag) => `  - ${quoted(tag)}`).join('\n')}\nstaleNotice: ${$('#staleNotice').value}\nstaleAfterDays: ${Math.max(1, Number($('#staleAfterDays').value) || 30)}\nstaleMessage: ${quoted($('#staleMessage').value)}\ndraft: false\n---\n\n${$('#content').value.trim()}\n`
}

function parseDocument(document) {
  const match = document.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  if (!match) return { data: {}, content: document }
  const data = {}
  const lines = match[1].split('\n')
  let collectingTags = false
  for (const line of lines) {
    const item = line.match(/^\s*-\s*["']?(.*?)["']?\s*$/)
    if (collectingTags && item) { (data.tags ||= []).push(item[1]); continue }
    const property = line.match(/^(\w+):\s*(.*)$/)
    if (!property) continue
    collectingTags = property[1] === 'tags'
    if (!collectingTags) data[property[1]] = property[2].replace(/^["']|["']$/g, '')
  }
  return { data, content: match[2].trim() }
}

function formPath() {
  const slug = slugify($('#slug').value || $('#title').value) || 'untitled'
  if (state.mode === 'pages') return `${slug}.md`
  const date = $('#date').value || new Date().toISOString().slice(0, 10)
  return `${date.slice(0, 4)}/${slug}.md`
}

function markDirty() {
  state.dirty = true
  $('#save-state').textContent = '有尚未保存的修改'
  updateWordCount()
  clearTimeout(markDirty.timer)
  markDirty.timer = setTimeout(saveRecovery, 500)
}

function updateWordCount() {
  $('#word-count').textContent = `${$('#content').value.replace(/\s/g, '').length} 字`
}

function formSnapshot() {
  return Object.fromEntries(fields.map((id) => [id, $(`#${id}`).value]))
}

function saveRecovery() {
  localStorage.setItem(recoveryKey, JSON.stringify({ savedAt: new Date().toISOString(), current: state.current, fields: formSnapshot() }))
  $('#save-state').textContent = '修改已自动备份到本机'
}

function clearRecovery() {
  localStorage.removeItem(recoveryKey)
  $('#recovery-bar').classList.add('hidden')
}

function showRecoveryIfNeeded() {
  if (localStorage.getItem(recoveryKey)) $('#recovery-bar').classList.remove('hidden')
}

function restoreRecovery() {
  try {
    const recovery = JSON.parse(localStorage.getItem(recoveryKey) || '{}')
    if (!recovery.fields) return clearRecovery()
    fields.forEach((id) => { if (recovery.fields[id] != null) $(`#${id}`).value = recovery.fields[id] })
    state.current = recovery.current || null
    state.mode = state.current?.status === 'page' ? 'pages' : 'posts'
    applyModeUi()
    $('#current-title').textContent = $('#title').value || (state.mode === 'pages' ? '未保存页面' : '未保存文章')
    $('#delete-post').disabled = !state.current
    $('#duplicate-post').disabled = !state.current
    updateStaleControls()
    markDirty()
    $('#recovery-bar').classList.add('hidden')
    toast('已恢复上次未保存的内容')
  } catch { clearRecovery() }
}

function insertMarkdown(type) {
  const textarea = $('#content')
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const selected = textarea.value.slice(start, end)
  const patterns = {
    heading: { before: '## ', after: '', fallback: '小标题' },
    bold: { before: '**', after: '**', fallback: '重点文字' },
    italic: { before: '*', after: '*', fallback: '斜体文字' },
    quote: { before: '> ', after: '', fallback: '引用内容' },
    'inline-code': { before: '`', after: '`', fallback: '代码' },
    'code-block': { before: '```\n', after: '\n```', fallback: '代码内容' },
    link: { before: '[', after: '](https://)', fallback: '链接文字' },
    divider: { before: '\n\n---\n\n', after: '', fallback: '' },
  }
  if (type === 'unordered-list' || type === 'ordered-list') {
    const content = selected || '列表项目'
    const replacement = content.split('\n').map((line, index) => type === 'ordered-list' ? `${index + 1}. ${line}` : `- ${line}`).join('\n')
    textarea.setRangeText(replacement, start, end, 'end')
    textarea.focus()
    markDirty()
    return
  }
  const pattern = patterns[type]
  if (!pattern) return
  const replacement = `${pattern.before}${selected || pattern.fallback}${pattern.after}`
  textarea.setRangeText(replacement, start, end, 'end')
  textarea.focus()
  markDirty()
}

function updateStaleControls() {
  const disabled = $('#staleNotice').value === 'never'
  $('#staleAfterDays').disabled = disabled
  $('#staleMessage').disabled = disabled
}

async function loadPosts() {
  const { posts } = await api('/api/posts')
  state.posts = posts
  renderPostList()
}

async function loadPages() {
  const { pages } = await api('/api/pages')
  state.pages = pages
  renderPostList()
}

async function openSettings() {
  const settings = await api('/api/settings')
  $('#setting-title').value = settings.title || ''
  $('#setting-author').value = settings.author || ''
  $('#setting-description').value = settings.description || ''
  $('#setting-page-size').value = settings.homePageSize || 5
  $('#setting-footer-year').value = settings.footerStartYear || new Date().getFullYear()
  $('#setting-footer-link-label').value = settings.footerLinkLabel || ''
  $('#setting-footer-link-url').value = settings.footerLinkUrl || ''
  $('#setting-footer-note').value = settings.footerNote || ''
  $('#setting-footer-quote').value = settings.footerQuote || ''
  $('#setting-github-repo').value = settings.githubRepository || ''
  $('#setting-github-branch').value = settings.githubBranch || 'master'
  $('#setting-comments-enabled').value = settings.commentsEnabled === false ? 'false' : 'true'
  $('#setting-beaudar-repo').value = settings.beaudarRepository || settings.githubRepository || ''
  $('#setting-beaudar-branch').value = settings.beaudarBranch || settings.githubBranch || 'master'
  $('#settings-dialog').showModal()
}

async function saveSettings(event) {
  event.preventDefault()
  const settings = {
    title: $('#setting-title').value,
    author: $('#setting-author').value,
    description: $('#setting-description').value,
    homePageSize: $('#setting-page-size').value,
    footerStartYear: $('#setting-footer-year').value,
    footerLinkLabel: $('#setting-footer-link-label').value,
    footerLinkUrl: $('#setting-footer-link-url').value,
    footerNote: $('#setting-footer-note').value,
    footerQuote: $('#setting-footer-quote').value,
    githubRepository: $('#setting-github-repo').value,
    githubBranch: $('#setting-github-branch').value,
    commentsEnabled: $('#setting-comments-enabled').value === 'true',
    beaudarRepository: $('#setting-beaudar-repo').value,
    beaudarBranch: $('#setting-beaudar-branch').value,
  }
  await api('/api/settings', { method: 'POST', body: JSON.stringify(settings) })
  $('#settings-dialog').close()
  toast('站点设置已保存')
}

async function openTrash() {
  const { items } = await api('/api/trash')
  $('#trash-list').innerHTML = items.map((item) => `
    <div class="trash-item">
      <div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.path)} · ${new Date(item.deletedAt).toLocaleString('zh-CN')}</span></div>
      <button type="button" data-restore-id="${escapeHtml(item.id)}">恢复</button>
    </div>`).join('') || '<p>回收站是空的。</p>'
  $('#trash-dialog').showModal()
}

async function restoreTrashItem(id) {
  await api('/api/trash/restore', { method: 'POST', body: JSON.stringify({ id }) })
  await loadPosts()
  await openTrash()
  toast('文章已恢复')
}

function renderPostList() {
  const needle = $('#filter').value.trim().toLowerCase()
  if (state.mode === 'pages') {
    const visible = state.pages.filter((page) => [page.title, page.description, page.navLabel].join(' ').toLowerCase().includes(needle))
    $('#post-count').textContent = visible.length
    $('#post-list').innerHTML = visible.map((page) => `
      <button class="post-item ${state.current?.path === page.path && state.current?.status === 'page' ? 'active' : ''}" data-page-path="${escapeHtml(page.path)}">
        <strong>${escapeHtml(page.title)}</strong>
        <span><time>/${escapeHtml(page.path.replace(/\.md$/, ''))}</time><em>${page.nav ? `导航 ${escapeHtml(String(page.navOrder))}` : '已隐藏'}</em></span>
      </button>`).join('') || '<p style="color:var(--muted);font-size:11px">还没有独立页面。</p>'
    return
  }
  const visible = state.posts.filter((post) => {
    const matchesStatus = state.statusFilter === 'all' || post.status === state.statusFilter
    const matchesSearch = [post.title, post.description, ...post.tags].join(' ').toLowerCase().includes(needle)
    return matchesStatus && matchesSearch
  })
  $('#post-count').textContent = visible.length
  $('#post-list').innerHTML = visible.map((post, index) => `
    <button class="post-item ${state.current?.path === post.path && state.current?.status === post.status ? 'active' : ''}" data-index="${state.posts.indexOf(post)}">
      <strong>${escapeHtml(post.title)}</strong>
      <span><time>${escapeHtml(post.date || '未注明日期')}</time><em>${post.status === 'draft' ? '草稿' : '已发布'}</em></span>
    </button>`).join('') || '<p style="color:var(--muted);font-size:11px">还没有文章。</p>'
}

function applyModeUi() {
  const isPage = state.mode === 'pages'
  document.querySelectorAll('.article-only').forEach((element) => element.classList.toggle('hidden', isPage))
  document.querySelectorAll('.page-only').forEach((element) => element.classList.toggle('hidden', !isPage))
  document.querySelectorAll('[data-content-mode]').forEach((button) => button.classList.toggle('active', button.dataset.contentMode === state.mode))
  $('#status-tabs').classList.toggle('hidden', isPage)
  $('#content-kind').textContent = isPage ? '页面' : '文章'
  $('#new-post').textContent = isPage ? '＋ 新建页面' : '＋ 新建文章'
  $('#filter').placeholder = isPage ? '搜索页面' : '搜索文章'
  $('#save-post').textContent = isPage ? '保存页面' : '保存文章'
  $('#open-trash').classList.toggle('hidden', isPage)
}

function switchMode(mode) {
  if (mode === state.mode) return
  if (state.dirty && !confirm('当前修改尚未保存，确定切换内容类型吗？')) return
  state.mode = mode
  state.current = null
  state.dirty = false
  applyModeUi()
  newPost()
}

function newPost() {
  const isPage = state.mode === 'pages'
  if (state.dirty && !confirm(`当前修改尚未保存，确定新建${isPage ? '页面' : '文章'}吗？`)) return
  const today = new Date().toISOString().slice(0, 10)
  state.current = null
  $('#title').value = ''
  $('#date').value = today
  $('#slug').value = ''
  $('#slug').disabled = false
  $('#status').value = 'draft'
  $('#description').value = ''
  $('#tags').value = ''
  $('#staleNotice').value = 'auto'
  $('#staleAfterDays').value = '30'
  $('#staleMessage').value = ''
  $('#navLabel').value = ''
  $('#navOrder').value = '100'
  $('#navVisible').value = 'true'
  updateStaleControls()
  $('#content').value = ''
  $('#current-title').textContent = isPage ? '新页面' : '新文章'
  $('#delete-post').disabled = true
  $('#duplicate-post').disabled = true
  state.dirty = false
  $('#word-count').textContent = '0 字'
  $('#save-state').textContent = '所有修改保存在本地'
  $('#title').focus()
  renderPostList()
}

async function openPost(post) {
  if (state.dirty && !confirm('当前修改尚未保存，确定切换文章吗？')) return
  const result = await api(`/api/post?status=${post.status}&path=${encodeURIComponent(post.path)}`)
  const parsed = parseDocument(result.content)
  state.current = { path: result.path, status: result.status }
  $('#title').value = parsed.data.title || ''
  $('#date').value = parsed.data.date || ''
  $('#slug').value = result.path.split('/').pop().replace(/\.md$/, '')
  $('#slug').disabled = false
  $('#status').value = result.status
  $('#description').value = parsed.data.description || ''
  $('#tags').value = (parsed.data.tags || []).join(', ')
  $('#staleNotice').value = ['auto', 'always', 'never'].includes(parsed.data.staleNotice) ? parsed.data.staleNotice : 'auto'
  $('#staleAfterDays').value = parsed.data.staleAfterDays || '30'
  $('#staleMessage').value = parsed.data.staleMessage || ''
  updateStaleControls()
  $('#content').value = parsed.content
  $('#current-title').textContent = parsed.data.title || '无题'
  $('#delete-post').disabled = false
  $('#duplicate-post').disabled = false
  state.dirty = false
  $('#save-state').textContent = '所有修改保存在本地'
  updateWordCount()
  renderPostList()
}

async function openPage(page) {
  if (state.dirty && !confirm('当前修改尚未保存，确定切换页面吗？')) return
  const result = await api(`/api/page?path=${encodeURIComponent(page.path)}`)
  const parsed = parseDocument(result.content)
  state.current = { path: result.path, status: 'page', protected: result.protected }
  $('#title').value = parsed.data.title || ''
  $('#slug').value = result.path.replace(/\.md$/, '')
  $('#slug').disabled = Boolean(result.protected)
  $('#description').value = parsed.data.description || ''
  $('#navLabel').value = parsed.data.navLabel || parsed.data.title || ''
  $('#navOrder').value = parsed.data.navOrder || '100'
  $('#navVisible').value = parsed.data.nav === 'false' ? 'false' : 'true'
  $('#content').value = parsed.content
  $('#current-title').textContent = parsed.data.title || '无题页面'
  $('#delete-post').disabled = Boolean(result.protected)
  $('#duplicate-post').disabled = false
  state.dirty = false
  $('#save-state').textContent = '所有修改保存在本地'
  updateWordCount()
  renderPostList()
}

function duplicatePost() {
  if (!state.current) return
  const originalTitle = $('#title').value.trim() || '无题'
  state.current = null
  $('#slug').disabled = false
  $('#title').value = `${originalTitle}（副本）`
  $('#slug').value = `${slugify($('#slug').value || originalTitle)}-copy`
  if (state.mode === 'posts') $('#status').value = 'draft'
  $('#current-title').textContent = `${originalTitle}（副本）`
  $('#delete-post').disabled = true
  $('#duplicate-post').disabled = true
  markDirty()
  renderPostList()
  toast(state.mode === 'pages' ? '页面副本已建立，保存后加入导航' : '副本已建立，保存后写入草稿')
}

async function savePost() {
  if (!$('#title').value.trim()) return toast(`请先填写${state.mode === 'pages' ? '页面' : '文章'}标题`)
  if (state.mode === 'pages') {
    const body = { path: formPath(), content: frontmatter(), previousPath: state.current?.path }
    const result = await api('/api/page', { method: 'POST', body: JSON.stringify(body) })
    state.current = { path: result.path, status: 'page', protected: result.protected }
    state.dirty = false
    clearRecovery()
    $('#current-title').textContent = $('#title').value
    $('#save-state').textContent = '所有修改保存在本地'
    $('#delete-post').disabled = Boolean(result.protected)
    $('#duplicate-post').disabled = false
    await loadPages()
    toast('页面已保存，顶部导航会自动更新')
    return
  }
  const body = {
    path: formPath(),
    status: $('#status').value,
    content: frontmatter(),
    previousPath: state.current?.path,
    previousStatus: state.current?.status,
  }
  const result = await api('/api/post', { method: 'POST', body: JSON.stringify(body) })
  state.current = { path: result.path, status: result.status }
  state.dirty = false
  clearRecovery()
  $('#current-title').textContent = $('#title').value
  $('#save-state').textContent = '所有修改保存在本地'
  $('#delete-post').disabled = false
  $('#duplicate-post').disabled = false
  await loadPosts()
  toast(result.status === 'draft' ? '草稿已保存' : '文章已保存，等待发布')
}

async function uploadImage(file) {
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const mode = $('#image-mode').value
      toast(mode === 'original' ? '正在保存原图……' : '正在压缩图片……')
      const result = await api('/api/media', { method: 'POST', body: JSON.stringify({ fileName: file.name, data: reader.result, mode, slug: slugify($('#slug').value || $('#title').value || 'article') }) })
      const insertion = `\n![图片说明](${result.path})\n`
      const textarea = $('#content')
      textarea.setRangeText(insertion, textarea.selectionStart, textarea.selectionEnd, 'end')
      markDirty()
      toast(result.mode === 'original' ? '原图已插入内容' : '图片已压缩为 WebP 并插入内容')
    } catch (error) { toast(error.message) }
  }
  reader.readAsDataURL(file)
}

$('#post-list').addEventListener('click', (event) => {
  const pageButton = event.target.closest('[data-page-path]')
  if (pageButton) {
    const page = state.pages.find((item) => item.path === pageButton.dataset.pagePath)
    if (page) openPage(page).catch((error) => toast(error.message))
    return
  }
  const button = event.target.closest('[data-index]')
  if (button) openPost(state.posts[Number(button.dataset.index)]).catch((error) => toast(error.message))
})
document.querySelectorAll('[data-content-mode]').forEach((button) => button.addEventListener('click', () => switchMode(button.dataset.contentMode)))
$('#filter').addEventListener('input', renderPostList)
document.querySelectorAll('[data-status-filter]').forEach((button) => button.addEventListener('click', () => {
  state.statusFilter = button.dataset.statusFilter
  document.querySelectorAll('[data-status-filter]').forEach((item) => item.classList.toggle('active', item === button))
  renderPostList()
}))
$('#new-post').addEventListener('click', newPost)
$('#duplicate-post').addEventListener('click', duplicatePost)
$('#refresh').addEventListener('click', () => Promise.all([loadPosts(), loadPages()]).catch((error) => toast(error.message)))
$('#save-post').addEventListener('click', () => savePost().catch((error) => toast(error.message)))
$('#image-input').addEventListener('change', (event) => uploadImage(event.target.files[0]))
document.querySelectorAll('[data-markdown]').forEach((button) => button.addEventListener('click', () => insertMarkdown(button.dataset.markdown)))
$('#title').addEventListener('input', () => { if (!state.current) $('#slug').value = slugify($('#title').value); markDirty() })
fields.filter((id) => id !== 'title').forEach((id) => $(`#${id}`).addEventListener('input', markDirty))
$('#staleNotice').addEventListener('change', updateStaleControls)
$('#delete-post').addEventListener('click', async () => {
  if (!state.current) return
  if (state.mode === 'pages') {
    if (state.current.protected) return toast('内置页面不能删除')
    if (!confirm('确定永久删除这个独立页面吗？')) return
    try {
      await api('/api/page', { method: 'DELETE', body: JSON.stringify({ path: state.current.path }) })
      state.dirty = false; newPost(); await loadPages(); toast('独立页面已删除')
    } catch (error) { toast(error.message) }
    return
  }
  if (!confirm('确定将这篇文章移到回收站吗？')) return
  try {
    await api('/api/post', { method: 'DELETE', body: JSON.stringify(state.current) })
    newPost(); state.dirty = false; $('#save-state').textContent = '所有修改保存在本地'; await loadPosts(); toast('文章已移到回收站')
  } catch (error) { toast(error.message) }
})
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('active', item === button))
  const preview = button.dataset.view === 'preview'
  $('#content').classList.toggle('hidden', preview)
  $('#markdown-preview').classList.toggle('hidden', !preview)
  if (preview) $('#markdown-preview').innerHTML = renderMarkdown($('#content').value)
}))
$('#open-preview').addEventListener('click', () => {
  const route = state.mode === 'pages' && $('#slug').value ? `/${slugify($('#slug').value)}` : ''
  window.open(`http://127.0.0.1:4173${route}`, '_blank', 'noopener')
})
$('#publish-all').addEventListener('click', async () => {
  try {
    if (state.dirty) await savePost()
    const { changes, branch, remote, projectRoot } = await api('/api/git/status')
    $('#git-changes').textContent = changes.join('\n') || '没有待提交的修改'
    $('#git-branch').textContent = branch
    $('#git-remote').textContent = remote || '尚未配置'
    $('#git-project-root').textContent = projectRoot
    publishStatus(remote ? '' : `当前项目目录尚未配置远程仓库，请在 ${projectRoot} 中执行 git remote add origin。`, 'error')
    $('#publish-dialog').showModal()
  } catch (error) { toast(error.message) }
})
$('#open-settings').addEventListener('click', () => openSettings().catch((error) => toast(error.message)))
$('#settings-form').addEventListener('submit', (event) => saveSettings(event).catch((error) => toast(error.message)))
$('#cancel-settings').addEventListener('click', () => $('#settings-dialog').close())
$('#create-backup').addEventListener('click', async () => {
  const button = $('#create-backup')
  button.disabled = true; button.textContent = '正在备份……'
  try { const result = await api('/api/backup', { method: 'POST' }); toast(`备份已保存到 ${result.path}`) }
  catch (error) { toast(error.message) }
  finally { button.disabled = false; button.textContent = '创建本地备份' }
})
$('#open-trash').addEventListener('click', () => openTrash().catch((error) => toast(error.message)))
$('#trash-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-restore-id]')
  if (button) restoreTrashItem(button.dataset.restoreId).catch((error) => toast(error.message))
})
$('#check-build').addEventListener('click', async () => {
  const button = $('#check-build')
  button.disabled = true; button.textContent = '正在检查……'
  publishStatus('正在检查博客能否正常构建……')
  try { const result = await api('/api/build', { method: 'POST' }); publishStatus(result.message, 'success') }
  catch (error) { publishStatus(error.message, 'error') }
  finally { button.disabled = false; button.textContent = '检查构建' }
})
$('#confirm-publish').addEventListener('click', async (event) => {
  event.preventDefault()
  const button = event.currentTarget
  button.disabled = true; button.textContent = '正在检查并发布……'
  publishStatus('正在构建博客并准备 Git 提交，请不要关闭页面……')
  try {
    const result = await api('/api/publish', { method: 'POST', body: JSON.stringify({ message: $('#commit-message').value }) })
    $('#publish-dialog').close(); toast(result.message || '已经推送到 GitHub，网站正在更新')
  } catch (error) { publishStatus(error.message, 'error') }
  finally { button.disabled = false; button.textContent = '确认发布' }
})
window.addEventListener('beforeunload', (event) => { if (state.dirty) event.preventDefault() })
window.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    savePost().catch((error) => toast(error.message))
  }
})
$('#restore-recovery').addEventListener('click', restoreRecovery)
$('#dismiss-recovery').addEventListener('click', clearRecovery)

applyModeUi()
newPost()
Promise.all([loadPosts(), loadPages()]).catch((error) => toast(error.message))
showRecoveryIfNeeded()
