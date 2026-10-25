import MarkdownIt from 'markdown-it'

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
})

const renderLinkOpen = markdown.renderer.rules.link_open
  ?? ((tokens, index, options, env, self) => self.renderToken(tokens, index, options))

markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  tokens[index]?.attrSet('target', '_blank')
  tokens[index]?.attrSet('rel', 'noopener noreferrer')
  return renderLinkOpen(tokens, index, options, env, self)
}

export function renderMarkdown(source: string): string {
  return markdown.render(source ?? '')
}

export function markdownExcerpt(source: string, maxLength = 120): string {
  const plain = source
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*[>*+-][ \t]+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return plain.length > maxLength ? `${plain.slice(0, maxLength)}…` : plain
}
