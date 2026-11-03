// Assembles the single output file in the order and with the ids of contract section 7, items 1 to 6.
export const GENERATOR_VERSION = '1';

export const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Inlined CSS and JS must not be able to close their own element.
export const safeInline = (s) => s.replace(/<\/(script|style)/gi, '<\\/$1');

// JSON for a script element: every `<` is written as a unicode escape, which also rules out `</script` and `<!--`.
export const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

export function compose({ config, themeName, license, fontCss, engineCss, themeCss, customCss, slides, diagramJs, engineJs, themeJs }) {
  const description = config.description ?? config.subtitle ?? config.title;
  return [
    '<!doctype html>',
    `<html lang="${escapeHtml(config.lang)}" data-theme="${escapeHtml(themeName)}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    `<meta name="generator" content="motion-deck ${GENERATOR_VERSION}">`,
    `<title>${escapeHtml(config.title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    license,
    `<style id="deck-fonts">\n${safeInline(fontCss)}\n</style>`,
    `<style id="deck-engine">\n${safeInline(engineCss)}\n</style>`,
    `<style id="deck-theme">\n${safeInline(themeCss)}\n</style>`,
    `<style id="deck-custom">\n${safeInline(customCss.join('\n'))}\n</style>`,
    '</head>',
    '<body class="deck">',
    '<canvas id="ambient" aria-hidden="true"></canvas>',
    '<div id="viewport"><div id="stage">',
    ...slides,
    '</div></div>',
    `<script id="deck-config" type="application/json">${safeJson(config)}</script>`,
    `<script id="deck-diagram">\n${safeInline(diagramJs)}\n</script>`,
    `<script id="deck-engine-js">\n${safeInline(engineJs)}\n</script>`,
    `<script id="deck-theme-js">\n${safeInline(themeJs)}\n</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}
