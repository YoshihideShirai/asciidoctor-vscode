const PLANTUML_CORE_VERSION = '1.2026.6'
const PLANTUML_CDN_BASE = `https://cdn.jsdelivr.net/npm/@plantuml/core@${PLANTUML_CORE_VERSION}`
const PLANTUML_VIZ_CDN_URL = `${PLANTUML_CDN_BASE}/viz-global.js`
const PLANTUML_MODULE_CDN_URL = `${PLANTUML_CDN_BASE}/plantuml.js`

const PLANTUML_EXPORT_SCRIPT = `<script src="${PLANTUML_VIZ_CDN_URL}"></script>
<script type="module">
import { render } from '${PLANTUML_MODULE_CDN_URL}';

const waitForSvg = (target) => new Promise((resolve) => {
  if (target.querySelector('svg')) {
    resolve();
    return;
  }
  const observer = new MutationObserver(() => {
    if (target.querySelector('svg')) {
      observer.disconnect();
      resolve();
    }
  });
  observer.observe(target, { childList: true, subtree: true });
  setTimeout(() => {
    observer.disconnect();
    resolve();
  }, 10000);
});

const normalizePlantUmlLines = (source) => {
  const lines = source.split(/\\r\\n|\\r|\\n/);
  if (lines.some((line) => /^\\s*@start\\w*/.test(line))) {
    return lines;
  }
  return ['@startuml', ...lines, '@enduml'];
};

window.__asciidocRenderPlantUmlExport = async () => {
  const plantumlNodes = Array.from(document.querySelectorAll('.plantuml'));
  let sequence = 0;
  for (const node of plantumlNodes) {
    const source = node.querySelector('.plantuml-source');
    const target = node.querySelector('.plantuml-target');
    if (!source || !target) {
      continue;
    }
    if (!target.id) {
      target.id = \`plantuml-export-\${++sequence}\`;
    }
    target.textContent = '';
    try {
      render(normalizePlantUmlLines(source.textContent || ''), target.id);
      await waitForSvg(target);
    } catch (e) {
      console.error('PlantUML rendering failed', e);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.__asciidocRenderPlantUmlExport();
});
</script>`

function hasPlantUmlDiagram(html: string): boolean {
  const classAttributePattern = /class=(['"])(.*?)\1/g
  for (const match of html.matchAll(classAttributePattern)) {
    if (match[2].split(/\s+/).includes('plantuml')) {
      return true
    }
  }
  return false
}

export function addPlantUmlToHtmlExport(html: string): string {
  if (!hasPlantUmlDiagram(html) || html.includes(PLANTUML_MODULE_CDN_URL)) {
    return html
  }
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${PLANTUML_EXPORT_SCRIPT}\n</body>`)
  }
  return `${html}\n${PLANTUML_EXPORT_SCRIPT}`
}
