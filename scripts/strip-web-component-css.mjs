/**
 * Copies NLDS web component IIFE bundles from node_modules to static/js/web-components/,
 * stripping the CSS injection calls so they comply with style-src 'self' CSP.
 *
 * Two patterns are removed from each bundle:
 *  1. styleInject(css_...);          — creates a <style> element in <head>
 *  2. const stylesheet = new CSSStyleSheet(); ... adoptedStyleSheets = [...];
 *                                    — injects CSS into the shadow DOM
 *
 * The web component's JS event-handling behavior is preserved unchanged.
 * All relevant CSS is already bundled in ds.css via @gemeentenijmegen/components-css.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const components = [
  'nijmegen-header',
  'nijmegen-mobile-menu',
  'nijmegen-accordion',
  'nijmegen-toolbar-button',
];

const srcDir = resolve('node_modules/@gemeentenijmegen/web-components/dist');
const outDir = resolve('src/app/static-resources/static/js/web-components');

mkdirSync(outDir, { recursive: true });

for (const name of components) {
  let src = readFileSync(resolve(srcDir, `${name}.js`), 'utf8');

  const before = src;

  // Remove the styleInject() call (leaves the function definition as dead code)
  src = src.replace(/\n  styleInject\([^)]+\);\n/, '\n');

  // Remove the adoptedStyleSheets block (3 consecutive lines inside the constructor)
  src = src.replace(
    /\n\s+const stylesheet = new CSSStyleSheet\(\);\n\s+stylesheet\.replaceSync\([^)]+\);\n\s+shadowRoot\.adoptedStyleSheets = \[stylesheet\];/,
    '',
  );

  if (src === before) {
    console.error(`WARNING: no CSS injection patterns found in ${name}.js — check if the dist format changed`);
    process.exitCode = 1;
  }

  writeFileSync(resolve(outDir, `${name}.js`), src);
  console.log(`stripped: ${name}.js`);
}
