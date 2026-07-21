import { createContentLoader } from 'vitepress'

export interface Post {
  title: string
  url: string
  date: string
  year: string
  description: string
  tags: string[]
  cover?: string
}

declare const data: Post[]
export { data }

export default createContentLoader('posts/**/*.md', {
  excerpt: true,
  transform(raw): Post[] {
    return raw
      .filter(({ frontmatter }) => !frontmatter.draft)
      .map(({ url, frontmatter, excerpt }) => {
        const rawDate = frontmatter.date ? new Date(frontmatter.date) : new Date(0)
        const date = Number.isNaN(rawDate.getTime()) ? '' : rawDate.toISOString().slice(0, 10)
        return {
          title: frontmatter.title || '无题',
          url,
          date,
          year: date.slice(0, 4),
          description: frontmatter.description || excerpt || '',
          tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
          cover: frontmatter.cover,
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  },
})
