import { describe, expect, it } from 'vitest'
import { markdownExcerpt, renderMarkdown } from '../../app/utils/markdown'

describe('markdown rendering', () => {
  it('renders headings, lists, and line breaks', () => {
    const html = renderMarkdown('# 标题\n\n- 第一项\n- 第二项\n\n正文')

    expect(html).toContain('<h1>标题</h1>')
    expect(html).toContain('<li>第一项</li>')
    expect(html).toContain('<p>正文</p>')
  })

  it('does not render raw HTML', () => {
    const html = renderMarkdown('<script>alert(1)</script>')

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('makes a readable excerpt from markdown', () => {
    expect(markdownExcerpt('[链接](https://example.com) **加粗** `代码`'))
      .toBe('链接 加粗 代码')
  })
})
