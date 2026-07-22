<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Content, useData, useRoute, withBase } from 'vitepress'
import { data as posts } from './posts.data'
import { data as navigationPages } from './pages.data'
import BeaudarComments from './BeaudarComments.vue'

const { frontmatter, page, site, theme, isDark } = useData()
const route = useRoute()
const search = ref('')
const headerSearch = ref('')
const searchOpen = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)
const menuOpen = ref(false)
const tocItems = ref<{ title: string; link: string }[]>([])
const themeMode = ref<'system' | 'light' | 'dark'>('system')
const systemDark = ref(false)
let systemThemeQuery: MediaQueryList | undefined
const homePage = ref(1)
const homePageSize = computed(() => Math.max(1, Number(theme.value.homePageSize) || 5))
const currentYear = new Date().getFullYear()
const footerStartYear = computed(() => Number(theme.value.footerStartYear) || currentYear)
const commentsRepository = computed(() => String(theme.value.beaudarRepository || theme.value.githubRepository || '').trim())
const commentsEnabled = computed(() => theme.value.commentsEnabled !== false && Boolean(commentsRepository.value))

const isHome = computed(() => route.path === withBase('/'))
const isArchive = computed(() => route.path === withBase('/archive') || route.path === withBase('/archive.html'))
const isTags = computed(() => route.path === withBase('/tags') || route.path === withBase('/tags.html'))
const isPost = computed(() => route.path.includes('/posts/'))
const filteredPosts = computed(() => {
  const needle = search.value.trim().toLocaleLowerCase()
  if (!needle) return posts
  return posts.filter((post) =>
    [post.title, post.description, ...post.tags].join(' ').toLocaleLowerCase().includes(needle),
  )
})
const totalHomePages = computed(() => Math.max(1, Math.ceil(posts.length / homePageSize.value)))
const homePosts = computed(() => {
  const start = (homePage.value - 1) * homePageSize.value
  return posts.slice(start, start + homePageSize.value)
})
const displayedPosts = computed(() => isHome.value ? homePosts.value : filteredPosts.value)
const paginationItems = computed(() => {
  const total = totalHomePages.value
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const pages = new Set([1, total, homePage.value - 1, homePage.value, homePage.value + 1])
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b)
  const items: Array<number | string> = []
  sorted.forEach((page, index) => {
    if (index && page - sorted[index - 1] > 1) items.push(`ellipsis-${page}`)
    items.push(page)
  })
  return items
})
const headerSearchResults = computed(() => {
  const needle = headerSearch.value.trim().toLocaleLowerCase()
  if (!needle) return []
  return posts.filter((post) =>
    [post.title, post.description, ...post.tags].join(' ').toLocaleLowerCase().includes(needle),
  ).slice(0, 6)
})
const resolvedDark = computed(() => themeMode.value === 'system' ? systemDark.value : themeMode.value === 'dark')
const themeLabel = computed(() => {
  if (themeMode.value === 'system') return `当前跟随系统（${resolvedDark.value ? '深色' : '浅色'}），点击切换`
  return `当前${themeMode.value === 'dark' ? '深色' : '浅色'}模式，点击切换`
})
const groupedPosts = computed(() => {
  const groups = new Map<string, typeof posts>()
  displayedPosts.value.forEach((post) => {
    const year = post.year || '未注明'
    const yearPosts = groups.get(year) || []
    yearPosts.push(post)
    groups.set(year, yearPosts)
  })
  return [...groups.entries()]
})
const allTags = computed(() => {
  const counts = new Map<string, number>()
  posts.forEach((post) => post.tags.forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1)))
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
})
const articleDate = computed(() => {
  if (!frontmatter.value.date) return ''
  const date = new Date(frontmatter.value.date)
  return Number.isNaN(date.getTime()) ? String(frontmatter.value.date) : date.toISOString().slice(0, 10)
})
const articleLastUpdated = computed(() => {
  const raw = page.value.lastUpdated || frontmatter.value.updated || frontmatter.value.date
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return String(raw)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
})
const staleNotice = computed(() => {
  const mode = String(frontmatter.value.staleNotice || 'auto')
  if (mode === 'never') return null
  const publishedAt = new Date(frontmatter.value.date)
  if (Number.isNaN(publishedAt.getTime())) return null
  const updatedAt = new Date(page.value.lastUpdated || frontmatter.value.updated || frontmatter.value.date)
  const day = 24 * 60 * 60 * 1000
  const publishedDays = Math.max(0, Math.floor((Date.now() - publishedAt.getTime()) / day))
  const updatedDays = Number.isNaN(updatedAt.getTime()) ? publishedDays : Math.max(0, Math.floor((Date.now() - updatedAt.getTime()) / day))
  const threshold = Math.max(1, Number(frontmatter.value.staleAfterDays) || 30)
  if (mode !== 'always' && publishedDays <= threshold) return null
  const custom = String(frontmatter.value.staleMessage || '').trim()
  const message = custom
    ? custom.replaceAll('{publishedDays}', String(publishedDays)).replaceAll('{updatedDays}', String(updatedDays))
    : `请注意，本文编写于 ${publishedDays} 天前，最后修改于 ${updatedDays} 天前，其中某些信息可能已经过时。`
  return { message }
})
const githubEditUrl = computed(() => {
  const repository = String(theme.value.githubRepository || '').trim()
  if (!repository || !page.value.relativePath) return ''
  const branch = String(theme.value.githubBranch || 'master').trim()
  const filePath = `site/${page.value.relativePath}`.split('/').map(encodeURIComponent).join('/')
  return `https://github.com/${repository}/edit/${encodeURIComponent(branch)}/${filePath}`
})

async function collectHeadings() {
  await nextTick()
  if (typeof document === 'undefined') return
  requestAnimationFrame(() => {
    tocItems.value = [...document.querySelectorAll<HTMLElement>('.article-content h2, .article-content h3')]
      .filter((heading) => heading.id)
      .map((heading) => ({ title: heading.textContent?.replace(/\s*#$/, '').trim() || '', link: `#${heading.id}` }))
  })
}

async function openSearch() {
  searchOpen.value = true
  await nextTick()
  searchInput.value?.focus()
}

function closeSearch() {
  searchOpen.value = false
  headerSearch.value = ''
}

function submitHeaderSearch() {
  const first = headerSearchResults.value[0]
  if (first && typeof window !== 'undefined') window.location.assign(withBase(first.url))
}

function toggleTheme() {
  themeMode.value = resolvedDark.value ? 'light' : 'dark'
}

function handleSystemThemeChange(event: MediaQueryListEvent) {
  systemDark.value = event.matches
  themeMode.value = 'system'
}

function pageFromLocation() {
  if (typeof window === 'undefined') return 1
  const value = Number(new URL(window.location.href).searchParams.get('page') || '1')
  return Number.isInteger(value) ? Math.min(Math.max(value, 1), totalHomePages.value) : 1
}

function syncPageFromLocation() {
  homePage.value = pageFromLocation()
}

function setHomePage(pageNumber: number) {
  const nextPage = Math.min(Math.max(pageNumber, 1), totalHomePages.value)
  homePage.value = nextPage
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href)
    if (nextPage === 1) url.searchParams.delete('page')
    else url.searchParams.set('page', String(nextPage))
    window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

onMounted(() => {
  systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemDark.value = systemThemeQuery.matches
  systemThemeQuery.addEventListener('change', handleSystemThemeChange)
  const stored = localStorage.getItem('blog-theme-mode')
  if (stored === 'light' || stored === 'dark' || stored === 'system') themeMode.value = stored
  syncPageFromLocation()
  window.addEventListener('popstate', syncPageFromLocation)
  collectHeadings()
})

onBeforeUnmount(() => {
  systemThemeQuery?.removeEventListener('change', handleSystemThemeChange)
  window.removeEventListener('popstate', syncPageFromLocation)
})
watch(resolvedDark, (value) => { isDark.value = value })
watch(themeMode, (value) => {
  if (typeof window !== 'undefined') localStorage.setItem('blog-theme-mode', value)
})
watch(() => route.path, () => { menuOpen.value = false; search.value = ''; closeSearch(); collectHeadings() })
</script>

<template>
  <div class="site-shell">
    <header class="site-header">
      <a class="brand" :href="withBase('/')" aria-label="返回首页">
        <span>{{ site.title }}</span>
      </a>
      <button class="menu-toggle" :class="{ open: menuOpen }" type="button" :aria-label="menuOpen ? '关闭导航' : '打开导航'" @click="menuOpen = !menuOpen">
        <span></span><span></span><span></span>
      </button>
      <nav class="site-nav" :class="{ open: menuOpen }" aria-label="主导航">
        <div class="header-search" :class="{ open: searchOpen }">
          <button v-if="!searchOpen" class="search-trigger" type="button" aria-label="搜索文章" title="搜索文章" @click="openSearch">
            搜索
          </button>
          <form v-else class="header-search-form" role="search" @submit.prevent="submitHeaderSearch" @keydown.esc="closeSearch">
            <input ref="searchInput" v-model="headerSearch" type="search" placeholder="搜索文章" aria-label="搜索文章" />
            <button class="search-close" type="button" aria-label="关闭搜索" @click="closeSearch">×</button>
            <div v-if="headerSearch" class="header-search-results">
              <a v-for="post in headerSearchResults" :key="post.url" :href="withBase(post.url)" @click="closeSearch">
                <span>{{ post.title }}</span><time>{{ post.date }}</time>
              </a>
              <p v-if="!headerSearchResults.length">没有找到匹配的文章</p>
            </div>
          </form>
        </div>
        <a v-for="navPage in navigationPages" :key="navPage.url" :href="withBase(navPage.url)">{{ navPage.label }}</a>
        <button class="theme-toggle" type="button" :aria-label="themeLabel" :title="themeLabel" @click="toggleTheme">
          <span aria-hidden="true"></span>
        </button>
      </nav>
    </header>

    <main>
      <template v-if="isHome || isArchive">
        <section class="post-index" :class="{ 'home-index': isHome }">
          <div v-if="isArchive" class="section-heading">
            <div>
              <p class="eyebrow">ARCHIVE</p>
              <h2>{{ frontmatter.title || '所有文章' }}</h2>
              <p v-if="frontmatter.description" class="section-description">{{ frontmatter.description }}</p>
            </div>
            <label class="search-box">
              <span>检索</span>
              <input v-model="search" type="search" placeholder="标题、摘要或标签" />
            </label>
          </div>

          <Content v-if="isArchive" class="vp-doc article-content archive-intro" />

          <div v-if="displayedPosts.length" class="year-groups">
            <section v-for="[year, yearPosts] in groupedPosts" :key="year" class="year-group">
              <div class="year-watermark" aria-hidden="true">{{ year.split('').join('\n') }}</div>
              <div class="post-list">
                <article v-for="post in yearPosts" :key="post.url" class="post-card">
                  <a :href="withBase(post.url)" class="post-link">
                    <div class="post-meta">
                      <time :datetime="post.date">{{ post.date.slice(5).replace('-', '-') }}</time>
                      <span v-if="post.tags[0]">{{ post.tags[0] }}</span>
                    </div>
                    <h3>{{ post.title }}</h3>
                    <p>{{ post.description }}</p>
                  </a>
                </article>
              </div>
            </section>
          </div>
          <p v-else class="empty-state">没有找到匹配的文章。</p>
          <nav v-if="isHome && totalHomePages > 1" class="home-pagination" aria-label="首页分页">
            <a :class="{ disabled: homePage === 1 }" :href="homePage > 2 ? `?page=${homePage - 1}` : '?'" :aria-disabled="homePage === 1" @click.prevent="homePage > 1 && setHomePage(homePage - 1)">上一页</a>
            <template v-for="item in paginationItems" :key="item">
              <span v-if="typeof item === 'string'" class="pagination-ellipsis">···</span>
              <a v-else :class="{ active: item === homePage }" :href="item === 1 ? '?' : `?page=${item}`" :aria-current="item === homePage ? 'page' : undefined" @click.prevent="setHomePage(item)">{{ item }}</a>
            </template>
            <a :class="{ disabled: homePage === totalHomePages }" :href="`?page=${homePage + 1}`" :aria-disabled="homePage === totalHomePages" @click.prevent="homePage < totalHomePages && setHomePage(homePage + 1)">下一页</a>
          </nav>
        </section>
      </template>

      <template v-else-if="isTags">
        <section class="simple-page tags-page">
          <p class="eyebrow">TAGS</p>
          <h1>{{ frontmatter.title || '从一个词开始。' }}</h1>
          <p v-if="frontmatter.description" class="page-description">{{ frontmatter.description }}</p>
          <Content class="vp-doc article-content tags-intro" />
          <div class="tag-cloud">
            <button v-for="([tag, count]) in allTags" :key="tag" @click="search = search === tag ? '' : tag">
              <span>{{ tag }}</span><sup>{{ count }}</sup>
            </button>
          </div>
          <div v-if="search" class="tag-results">
            <p class="result-caption">“{{ search }}”下的文章</p>
            <a v-for="post in filteredPosts" :key="post.url" :href="withBase(post.url)">
              <time>{{ post.date }}</time><span>{{ post.title }}</span>
            </a>
          </div>
        </section>
      </template>

      <template v-else-if="isPost">
        <article class="article-page">
          <header class="article-header" :class="{ 'has-stale-notice': staleNotice }">
            <a class="back-link" :href="withBase('/')">← 返回文章</a>
            <h1>{{ frontmatter.title }}</h1>
            <p v-if="frontmatter.description" class="article-description">{{ frontmatter.description }}</p>
            <div class="article-meta">
              <time>{{ articleDate }}</time>
              <span v-if="page.lastUpdated">更新于 {{ new Date(page.lastUpdated).toLocaleDateString('zh-CN') }}</span>
              <span v-for="tag in frontmatter.tags || []" :key="tag"># {{ tag }}</span>
            </div>
            <aside v-if="staleNotice" class="stale-notice" role="note">{{ staleNotice.message }}</aside>
          </header>
          <div class="article-grid">
            <div class="article-main">
              <Content class="vp-doc article-content" />
              <footer class="article-endbar">
                <a v-if="githubEditUrl" :href="githubEditUrl" target="_blank" rel="noopener noreferrer">在 GitHub 编辑此页</a>
                <span v-else class="article-edit-disabled" title="部署到 GitHub 后自动启用编辑链接">在 GitHub 编辑此页</span>
                <time v-if="articleLastUpdated">本页最后更新时间: {{ articleLastUpdated }}</time>
              </footer>
              <BeaudarComments
                v-if="commentsEnabled && frontmatter.comments !== false"
                :key="route.path"
                :repo="commentsRepository"
                :branch="String(theme.beaudarBranch || theme.githubBranch || 'master')"
                :dark="resolvedDark"
              />
            </div>
            <aside v-if="tocItems.length" class="toc">
              <p>本页目录</p>
              <a v-for="heading in tocItems" :key="heading.link" :href="heading.link">{{ heading.title }}</a>
            </aside>
          </div>
        </article>
      </template>

      <template v-else>
        <article class="simple-page prose-page">
          <header v-if="frontmatter.title" class="page-header">
            <p class="eyebrow">PAGE</p>
            <h1>{{ frontmatter.title }}</h1>
            <p v-if="frontmatter.description">{{ frontmatter.description }}</p>
          </header>
          <Content class="vp-doc article-content" />
        </article>
      </template>
    </main>

    <footer class="site-footer">
      <p>© {{ footerStartYear }}-{{ currentYear }} <a :href="withBase('/')">{{ site.title }}</a><i>|</i><a :href="withBase('/rss.xml')">RSS</a><i>|</i><a :href="theme.footerLinkUrl" target="_blank" rel="noopener noreferrer">{{ theme.footerLinkLabel }}</a></p>
      <p>Design With <a href="https://www.yanliye.cn/" target="_blank" rel="noopener noreferrer">Leeyeh</a><i>|</i>{{ theme.footerNote }}</p>
      <p v-if="theme.footerQuote">{{ theme.footerQuote }}</p>
    </footer>
  </div>
</template>
