import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { convert, Extensions } from '@asciidoctor/core'
import { plantumlJSProcessor } from '../../features/preview/plantuml.js'

async function convertWithPlantUml(input: string): Promise<string> {
  const registry = Extensions.create()
  registry.block('plantuml', plantumlJSProcessor())
  const output = await convert(input, {
    extension_registry: registry,
    safe: 'safe',
  })
  return String(output)
}

async function convertWithPlantUmlAttributes(
  input: string,
  attributes: Record<string, string>,
): Promise<string> {
  const registry = Extensions.create()
  registry.block('plantuml', plantumlJSProcessor())
  const output = await convert(input, {
    attributes,
    extension_registry: registry,
    safe: 'unsafe',
  })
  return String(output)
}

describe('plantumlJSProcessor', () => {
  test('wraps a [plantuml] listing block in a PlantUML render container', async () => {
    const html = await convertWithPlantUml(
      '[plantuml]\n----\n@startuml\nAlice -> Bob\n@enduml\n----',
    )
    assert.match(
      html,
      /<div class='imageblock kroki'><div class='content'><div class='plantuml kroki'/,
    )
    assert.match(
      html,
      /<pre class='plantuml-source' hidden>@startuml\nAlice -&gt; Bob\n@enduml<\/pre>/,
    )
    assert.match(html, /<div id='plantuml-1' class='plantuml-target'><\/div>/)
  })

  test('handles a [plantuml] literal block (delimited with dots)', async () => {
    const html = await convertWithPlantUml(
      '[plantuml]\n....\n@startuml\nBob -> Alice\n@enduml\n....',
    )
    assert.match(
      html,
      /<pre class='plantuml-source' hidden>@startuml\nBob -&gt; Alice\n@enduml<\/pre>/,
    )
  })

  test('renders an AsciiDoc block title like asciidoctor-kroki', async () => {
    const html = await convertWithPlantUml(
      '.Login flow <draft>\n[plantuml]\n----\nAlice -> Bob\n----',
    )
    assert.match(
      html,
      /<div class='imageblock kroki'><div class='content'><div class='plantuml kroki'[\s\S]*<\/div><\/div><div class='title'>Figure 1\. Login flow &lt;draft&gt;<\/div><\/div>/,
    )
  })

  test('uses custom figure-caption in the diagram title', async () => {
    const html = await convertWithPlantUmlAttributes(
      '.Login flow\n[plantuml]\n----\nAlice -> Bob\n----',
      { 'figure-caption': 'Fig.' },
    )
    assert.match(html, /<div class='title'>Fig\. 1\. Login flow<\/div>/)
  })

  test('uses an explicit caption without numbering', async () => {
    const html = await convertWithPlantUml(
      '[caption="Diagram: "]\n.Login flow\n[plantuml]\n----\nAlice -> Bob\n----',
    )
    assert.match(html, /<div class='title'>Diagram: Login flow<\/div>/)
  })

  test('numbers multiple diagram titles like figures', async () => {
    const html = await convertWithPlantUml(
      '.First\n[plantuml]\n----\nAlice -> Bob\n----\n\n.Second\n[plantuml]\n----\nBob -> Alice\n----',
    )
    assert.match(
      html,
      /<div class='title'>Figure 1\. First<\/div>[\s\S]*<div class='title'>Figure 2\. Second<\/div>/,
    )
  })

  test('accepts Kroki positional target and format attributes', async () => {
    const html = await convertWithPlantUml(
      '[plantuml, sequence, png]\n----\nAlice -> Bob\n----',
    )
    assert.match(html, /class='plantuml kroki'/)
    assert.match(html, /data-plantuml-format='png'/)
    assert.match(html, /data-plantuml-options='\{\}'/)
  })

  test('uses kroki-default-format when the block has no format', async () => {
    const html = await convertWithPlantUmlAttributes(
      '[plantuml]\n----\nAlice -> Bob\n----',
      { 'kroki-default-format': 'png' },
    )
    assert.match(html, /data-plantuml-format='png'/)
  })

  test('matches asciidoctor-kroki role formatting when a role is present', async () => {
    const html = await convertWithPlantUml(
      '[plantuml,role=wide]\n----\nAlice -> Bob\n----',
    )
    assert.match(html, /class='imageblock wide kroki-format-svg kroki'/)
    assert.match(html, /class='plantuml wide kroki-format-svg kroki'/)
  })

  test('applies subs like asciidoctor-kroki', async () => {
    const html = await convertWithPlantUmlAttributes(
      '[plantuml,subs=attributes]\n----\nAlice -> {receiver}\n----',
      { receiver: 'Bob' },
    )
    assert.match(
      html,
      /<pre class='plantuml-source' hidden>Alice -&gt; Bob<\/pre>/,
    )
  })

  test('prepends kroki-plantuml-include in unsafe mode', async () => {
    const html = await convertWithPlantUmlAttributes(
      '[plantuml]\n----\nAlice -> Bob\n----',
      { 'kroki-plantuml-include': 'common.puml' },
    )
    assert.match(
      html,
      /<pre class='plantuml-source' hidden>!include common\.puml\nAlice -&gt; Bob<\/pre>/,
    )
  })

  test('passes custom Kroki options through as metadata', async () => {
    const html = await convertWithPlantUml(
      '[plantuml,theme=sketchy,opts=inline]\n----\nAlice -> Bob\n----',
    )
    assert.match(html, /inline-option/)
    assert.match(html, /data-plantuml-options='\{"theme":"sketchy"\}'/)
  })

  test('HTML-escapes the diagram source before storing it in the preview DOM', async () => {
    const html = await convertWithPlantUml(
      '[plantuml]\n----\n@startuml\nAlice -> Bob : <ok> & done\n@enduml\n----',
    )
    assert.ok(
      html.includes('Alice -&gt; Bob : &lt;ok&gt; &amp; done'),
      `expected escaped diagram text, got: ${html}`,
    )
  })

  test('does not touch listing blocks that are not plantuml', async () => {
    const html = await convertWithPlantUml('----\nplain listing\n----')
    assert.doesNotMatch(html, /class='plantuml'/)
    assert.match(html, /plain listing/)
  })
})
