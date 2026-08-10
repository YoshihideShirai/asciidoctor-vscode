import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { addPlantUmlToHtmlExport } from '../../features/asciidoctor/plantumlExport.js'

const plantumlBlock =
  "<div class='plantuml kroki'><pre class='plantuml-source' hidden>Alice -&gt; Bob</pre><div id='plantuml-1' class='plantuml-target'></div></div>"

describe('addPlantUmlToHtmlExport', () => {
  test('adds the PlantUML CDN renderer when exported HTML contains a PlantUML block', () => {
    const html = `<html><body>${plantumlBlock}</body></html>`
    const result = addPlantUmlToHtmlExport(html)
    assert.match(
      result,
      /https:\/\/cdn\.jsdelivr\.net\/npm\/@plantuml\/core@1\.2026\.6\/viz-global\.js/,
    )
    assert.match(
      result,
      /import \{ render \} from 'https:\/\/cdn\.jsdelivr\.net\/npm\/@plantuml\/core@1\.2026\.6\/plantuml\.js';/,
    )
    assert.match(result, /normalizePlantUmlLines/)
    assert.match(result, /window\.__asciidocRenderPlantUmlExport/)
    assert.ok(result.indexOf('<script src=') < result.indexOf('</body>'))
  })

  test('wraps source without an explicit @start directive before rendering', () => {
    const result = addPlantUmlToHtmlExport(`<body>${plantumlBlock}</body>`)
    assert.match(result, /return \['@startuml', \.\.\.lines, '@enduml'\];/)
  })

  test('does not add the renderer when there is no PlantUML block', () => {
    const html =
      '<html><body><div class="not-plantuml">text</div></body></html>'
    assert.equal(addPlantUmlToHtmlExport(html), html)
  })

  test('does not add the renderer twice', () => {
    const html = `<html><body>${plantumlBlock}</body></html>`
    const once = addPlantUmlToHtmlExport(html)
    const twice = addPlantUmlToHtmlExport(once)
    assert.equal(twice, once)
  })

  test('appends the renderer when exported HTML has no body element', () => {
    const html = `<main>${plantumlBlock}</main>`
    const result = addPlantUmlToHtmlExport(html)
    assert.match(result, /<\/main>\n<script src=/)
  })
})
