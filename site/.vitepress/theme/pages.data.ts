import { createContentLoader } from 'vitepress'

export interface NavigationPage {
  title: string
  label: string
  url: string
  order: number
}

declare const data: NavigationPage[]
export { data }

export default createContentLoader('*.md', {
  transform(raw): NavigationPage[] {
    return raw
      .filter(({ url, frontmatter }) => url !== '/' && frontmatter.nav !== false)
      .map(({ url, frontmatter }) => ({
        title: String(frontmatter.title || '无题'),
        label: String(frontmatter.navLabel || frontmatter.title || '页面'),
        url,
        order: Number(frontmatter.navOrder) || 100,
      }))
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'zh-CN'))
  },
})
