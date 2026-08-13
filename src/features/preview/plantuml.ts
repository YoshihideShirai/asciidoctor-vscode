import type {
  AbstractBlock,
  BlockProcessorDslInterface,
  Reader,
} from '@asciidoctor/core'

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

export const PLANTUML_SOURCE_DATA_URI_PREFIX =
  'data:application/vnd.asciidoctor-vscode.plantuml+json;base64,'

interface EncodedPlantUmlDiagram {
  source: string
  targetId: string
  format: string
  options: Record<string, string>
  role: string
  option?: string
}

export function encodePlantUmlDiagram(diagram: EncodedPlantUmlDiagram): string {
  return `${PLANTUML_SOURCE_DATA_URI_PREFIX}${Buffer.from(JSON.stringify(diagram), 'utf8').toString('base64')}`
}

export function decodePlantUmlDiagram(
  target: unknown,
): EncodedPlantUmlDiagram | undefined {
  if (
    typeof target !== 'string' ||
    !target.startsWith(PLANTUML_SOURCE_DATA_URI_PREFIX)
  ) {
    return undefined
  }
  try {
    const decoded = JSON.parse(
      Buffer.from(
        target.slice(PLANTUML_SOURCE_DATA_URI_PREFIX.length),
        'base64',
      ).toString('utf8'),
    ) as Partial<EncodedPlantUmlDiagram>
    if (
      typeof decoded.source !== 'string' ||
      typeof decoded.targetId !== 'string' ||
      typeof decoded.format !== 'string' ||
      typeof decoded.role !== 'string' ||
      decoded.options === undefined ||
      typeof decoded.options !== 'object'
    ) {
      return undefined
    }
    return {
      source: decoded.source,
      targetId: decoded.targetId,
      format: decoded.format,
      options: decoded.options as Record<string, string>,
      role: decoded.role,
      option: typeof decoded.option === 'string' ? decoded.option : undefined,
    }
  } catch {
    return undefined
  }
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

export function plantumlJSProcessor() {
  let diagramSequence = 0
  return function (this: BlockProcessorDslInterface) {
    this.onContext(['listing', 'literal'])
    this.positionalAttributes('target', 'format')
    ;(this as any).process(
      async (
        parent: AbstractBlock,
        reader: Reader,
        attrs: Record<string, unknown>,
      ) => {
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
        const role = krokiRole(attrs, format)
        blockAttrs.role = role
        blockAttrs.target = encodePlantUmlDiagram({
          source: diagramText,
          targetId: id,
          format,
          options: userOptions(attrs),
          role,
          option,
        })
        blockAttrs.alt =
          typeof attrs.title === 'string' ? attrs.title : 'PlantUML diagram'
        delete blockAttrs.title
        delete blockAttrs.caption
        delete blockAttrs.format
        delete blockAttrs.opts
        delete blockAttrs['inline-option']
        delete blockAttrs['interactive-option']
        delete blockAttrs['none-option']
        const block = (this as any).createImageBlock(parent, blockAttrs)
        if (typeof attrs.title === 'string') {
          block.title = attrs.title
        }
        if (typeof attrs.id === 'string') {
          block.id = attrs.id
        }
        block.assignCaption(
          typeof attrs.caption === 'string' ? attrs.caption : undefined,
          'figure',
        )
        return block
      },
    )
  }
}

export function plantUmlDiagramToHtml(diagram: EncodedPlantUmlDiagram): string {
  const classes = ['plantuml', ...diagram.role.split(/\s+/)]
  if (diagram.option && diagram.option !== 'none') {
    classes.push(`${diagram.option}-option`)
  }
  return `<div class='${escapeAttribute(classes.join(' '))}' data-plantuml-target='${escapeAttribute(diagram.targetId)}' data-plantuml-format='${escapeAttribute(diagram.format)}' data-plantuml-options='${escapeAttribute(JSON.stringify(diagram.options))}'><pre class='plantuml-source' hidden>${escapeHtml(diagram.source)}</pre><div id='${escapeAttribute(diagram.targetId)}' class='plantuml-target'></div></div>`
}
