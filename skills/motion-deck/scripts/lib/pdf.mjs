// PDF export through the DevTools protocol, and a cheap reader for page count and page size.

// Counts page objects (/Type /Page but not /Pages) and reads the first MediaBox (points -> CSS px).
export function inspectPdf(buffer) {
  const text = buffer.toString('latin1');
  const pages = (text.match(/\/Type\s*\/Page(?![A-Za-z])/g) || []).length;
  const box = /\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/.exec(text);
  let widthPx = null, heightPx = null;
  if (box) {
    widthPx = ((+box[3]) - (+box[1])) * 4 / 3;
    heightPx = ((+box[4]) - (+box[2])) * 4 / 3;
  }
  return { pages, widthPx, heightPx };
}

export async function printPdf(page, timeout) {
  const { data } = await page.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true }, { timeout });
  const buffer = Buffer.from(data, 'base64');
  return { buffer, ...inspectPdf(buffer) };
}
