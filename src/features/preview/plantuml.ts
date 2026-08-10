import type { BlockProcessorDslInterface } from '@asciidoctor/core'

const SAFE_MODE_SECURE = 20
const BUILTIN_ATTRIBUTES = new Set([
  'target',
  'width',
  'height',
  'format',
  'fallback',
  'link',
  'float',
  'align',
  'role',
  'title',
  'caption',
  'cloaked-context',
  '$positional',
  'subs',
  'opts',
])

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;')
}

function isNumeric(value: string): boolean {
  return /^\d+$/.test(value)
}

function optionFrom(
  attrs: Record<string, unknown>,
  doc: any,
): string | undefined {
  for (const option of ['inline', 'interactive', 'none']) {
    if (attrs[`${option}-option`] === '') {
      return option
    }
  }
  return doc.getAttribute('kroki-default-options')
}

function krokiRole(attrs: Record<string, unknown>, format: string): string {
  const role = typeof attrs.role === 'string' ? attrs.role : ''
  return role ? `${role} kroki-format-${format} kroki` : 'kroki'
}

function userOptions(attrs: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(attrs).filter(
      ([key]) =>
        !key.endsWith('-option') &&
        !BUILTIN_ATTRIBUTES.has(key) &&
        !isNumeric(key),
    ),
  ) as Record<string, string>
}

function captionedFigureTitle(
  title: string | undefined,
  explicitCaption: string | undefined,
  doc: any,
): string {
  if (title === undefined) {
    return ''
  }
  const docAttributes = doc.getAttributes()
  const globalCaption = docAttributes.caption
  let caption = ''
  if (explicitCaption !== undefined || globalCaption !== undefined) {
    caption = explicitCaption !== undefined ? explicitCaption : globalCaption
  } else {
    const figureCaption = docAttributes['figure-caption']
    if (figureCaption) {
      caption = `${figureCaption} ${doc.counter('figure-number')}. `
    }
  }
  return `<div class='title'>${escapeHtml(`${caption}${title}`)}</div>`
}

export function plantumlJSProcessor() {
  let diagramSequence = 0
  return function (this: BlockProcessorDslInterface) {
    this.onContext(['listing', 'literal'])
    this.positionalAttributes('target', 'format')
    ;(this as any).process(async (parent: any, reader: any, attrs: any) => {
      const doc = parent.getDocument() as any
      const id = `plantuml-${++diagramSequence}`
      let diagramText = reader.getString()
      if (attrs.subs) {
        diagramText = await (parent as any).applySubs(
          diagramText,
          (parent as any).resolveSubs(attrs.subs),
        )
      }
      if (doc.getSafe() < SAFE_MODE_SECURE) {
        const plantUmlIncludeFile = doc.getAttribute('kroki-plantuml-include')
        if (plantUmlIncludeFile) {
          diagramText = `!include ${plantUmlIncludeFile}\n${diagramText}`
        }
      }
      const format = String(
        attrs.format || doc.getAttribute('kroki-default-format') || 'svg',
      )
      const blockAttrs = { ...attrs }
      const option = optionFrom(attrs, doc)
      blockAttrs.role = krokiRole(attrs, format)
      blockAttrs.format = format
      delete blockAttrs.title
      delete blockAttrs.caption
      delete blockAttrs.opts
      if (option && option !== 'none') {
        blockAttrs[`${option}-option`] = ''
      }
      const classes = ['plantuml', ...krokiRole(attrs, format).split(/\s+/)]
      if (option && option !== 'none') {
        classes.push(`${option}-option`)
      }
      const diagramTextAttribute = escapeHtml(diagramText)
      const optionsAttribute = escapeAttribute(
        JSON.stringify(userOptions(attrs)),
      )
      const title = captionedFigureTitle(attrs.title, attrs.caption, doc)
      return this.createBlock(
        parent,
        'pass',
        `<div class='imageblock ${escapeAttribute(krokiRole(attrs, format))}'><div class='content'><div class='${escapeAttribute(classes.join(' '))}' data-plantuml-target='${id}' data-plantuml-format='${escapeAttribute(format)}' data-plantuml-options='${optionsAttribute}'><pre class='plantuml-source' hidden>${diagramTextAttribute}</pre><div id='${id}' class='plantuml-target'></div></div></div>${title}</div>`,
        blockAttrs,
      )
    })
  }
}
