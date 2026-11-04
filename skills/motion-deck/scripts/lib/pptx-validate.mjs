// Structural validator for the .pptx the export writes (contract section 13.4). It reads the zip, parses every XML part with the browser's
// DOMParser (Node has no XML parser) and checks the package the way PowerPoint's loader does: content types, relationships, ids, counts, images.
// It proves the package is consistent. It does not prove that PowerPoint opens it: that needs PowerPoint (see the contract).
import { posix } from 'node:path';
import { CONTENT_TYPES, IMAGE_TYPES, NS, REL_TYPES, SLIDE_H, SLIDE_W } from './pptx.mjs';
import { readZip } from './zip.mjs';

// Reads width and height from the file header. Returns { type: 'png'|'jpeg', width, height } or null when the bytes are neither.
export function imageInfo(buf) {
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a && buf.toString('latin1', 12, 16) === 'IHDR') {
    return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    for (let p = 2; p + 9 < buf.length;) {
      if (buf[p] !== 0xff) return null;
      const marker = buf[p + 1];
      if (marker === 0xff) { p++; continue; }
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { type: 'jpeg', height: buf.readUInt16BE(p + 5), width: buf.readUInt16BE(p + 7) };
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { p += 2; continue; }
      p += 2 + buf.readUInt16BE(p + 2);
    }
  }
  return null;
}

// Runs in the page: XML text -> plain trees { n: tag, ns, a: attributes, c: children, t: own text }, or { error }.
function treesInPage(parts) {
  const out = {};
  const convert = (el) => {
    const a = {};
    for (const at of el.attributes) a[at.name] = at.value;
    const c = [];
    let t = '';
    for (const node of el.childNodes) {
      if (node.nodeType === 1) c.push(convert(node));
      else if (node.nodeType === 3 || node.nodeType === 4) t += node.nodeValue;
    }
    return { n: el.tagName, ns: el.namespaceURI, a, c, t };
  };
  for (const [name, text] of Object.entries(parts)) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const bad = doc.querySelector('parsererror');
    out[name] = bad ? { error: bad.textContent.trim().slice(0, 200) } : convert(doc.documentElement);
  }
  return out;
}

// page: a connected page (any page will do). Returns the parse function validatePackage wants.
export const browserXml = (page) => (parts) => page.evaluate(`(${treesInPage.toString()})(${JSON.stringify(parts)})`);

const kids = (node, tag) => (node ? node.c.filter((x) => x.n === tag) : []);
const kid = (node, tag) => kids(node, tag)[0];
const walk = (node, fn) => { fn(node); node.c.forEach((x) => walk(x, fn)); };
const textOf = (node) => { let s = ''; walk(node, (x) => { if (x.n === 'a:t') s += x.t; }); return s; };
const paragraphs = (body) => kids(body, 'a:p').map((p) => { let s = ''; walk(p, (x) => { if (x.n === 'a:t') s += x.t; }); return s; });

const PART_TYPES = [
  [/^ppt\/presentation\.xml$/, CONTENT_TYPES.presentation], [/^ppt\/slideMasters\/slideMaster\d+\.xml$/, CONTENT_TYPES.slideMaster],
  [/^ppt\/slideLayouts\/slideLayout\d+\.xml$/, CONTENT_TYPES.slideLayout], [/^ppt\/slides\/slide\d+\.xml$/, CONTENT_TYPES.slide],
  [/^ppt\/notesMasters\/notesMaster\d+\.xml$/, CONTENT_TYPES.notesMaster], [/^ppt\/notesSlides\/notesSlide\d+\.xml$/, CONTENT_TYPES.notesSlide],
  [/^ppt\/theme\/theme\d+\.xml$/, CONTENT_TYPES.theme], [/^ppt\/presProps\.xml$/, CONTENT_TYPES.presProps], [/^ppt\/viewProps\.xml$/, CONTENT_TYPES.viewProps],
  [/^ppt\/tableStyles\.xml$/, CONTENT_TYPES.tableStyles], [/^docProps\/core\.xml$/, CONTENT_TYPES.core], [/^docProps\/app\.xml$/, CONTENT_TYPES.extended],
];
const ROOTS = { 'ppt/presentation.xml': 'p:presentation', 'ppt/presProps.xml': 'p:presentationPr', 'ppt/viewProps.xml': 'p:viewPr', 'ppt/tableStyles.xml': 'a:tblStyleLst' };
const KNOWN_RELS = new Set(Object.values(REL_TYPES));
const slideNo = (name) => Number((/slide(\d+)\.xml$/.exec(name) || [])[1]);

// buf: the .pptx bytes. expected: { slides: [{ title, notes: string[] (text compared) | true (a notes slide must exist) | null (none), ext: 'png'|'jpeg' }], width, height (image pixels), transition, meta: { title, author, lang } }.
// parseXml: async (parts: { name: xmlText }) => { name: tree | { error } }, see browserXml. Returns { errors: string[], stats }.
export async function validatePackage(buf, expected, parseXml) {
  const errors = [];
  const err = (message) => errors.push(message);
  let zip;
  try {
    zip = readZip(buf);
  } catch (e) {
    return { errors: [`zip: ${e.message}`], stats: {} };
  }
  const names = zip.entries.map((e) => e.name);
  const set = new Set(names);
  if (set.size !== names.length) err('zip: duplicate entry names');
  if (names[0] !== '[Content_Types].xml') err(`zip: the first entry is ${names[0]}, expected [Content_Types].xml`);
  const data = new Map();
  for (const name of names) {
    if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').some((s) => s === '' || s === '.' || s === '..') || name.endsWith('/')) err(`zip: unsafe entry name ${JSON.stringify(name)}`);
    try { data.set(name, zip.read(name)); } catch (e) { err(`zip: ${e.message}`); }
  }
  const parts = names.filter((n) => n !== '[Content_Types].xml' && !n.endsWith('.rels'));
  const xmlNames = names.filter((n) => data.has(n) && (n.endsWith('.xml') || n.endsWith('.rels')));
  const trees = await parseXml(Object.fromEntries(xmlNames.map((n) => [n, data.get(n).toString('utf8')])));
  for (const n of xmlNames) if (!trees[n] || trees[n].error) err(`${n}: not well-formed XML (${trees[n] ? trees[n].error : 'not parsed'})`);
  const tree = (n) => (trees[n] && !trees[n].error ? trees[n] : null);

  // content types
  const ct = tree('[Content_Types].xml');
  const defaults = new Map();
  const overrides = new Map();
  if (!ct) err('[Content_Types].xml is missing or unreadable');
  else {
    if (ct.n !== 'Types' || ct.ns !== NS.ct) err('[Content_Types].xml: the root is not <Types> in the content-types namespace');
    for (const d of kids(ct, 'Default')) {
      const ext = (d.a.Extension || '').toLowerCase();
      if (defaults.has(ext)) err(`[Content_Types].xml: Default for .${ext} is repeated`);
      defaults.set(ext, d.a.ContentType);
    }
    for (const o of kids(ct, 'Override')) {
      if (overrides.has(o.a.PartName)) err(`[Content_Types].xml: Override for ${o.a.PartName} is repeated`);
      overrides.set(o.a.PartName, o.a.ContentType);
      if (!set.has(o.a.PartName.slice(1))) err(`[Content_Types].xml: Override names ${o.a.PartName}, which is not in the package`);
    }
  }
  const typeOf = (name) => overrides.get(`/${name}`) || defaults.get(name.slice(name.lastIndexOf('.') + 1).toLowerCase());
  for (const name of names.filter((n) => n !== '[Content_Types].xml')) {
    const type = typeOf(name);
    if (!type) err(`${name}: no content type (no Override, no Default for its extension)`);
    const rule = PART_TYPES.find(([re]) => re.test(name));
    if (rule && type !== rule[1]) err(`${name}: content type is ${type}, expected ${rule[1]}`);
    if (name.endsWith('.rels') && type !== 'application/vnd.openxmlformats-package.relationships+xml') err(`${name}: content type is ${type}`);
  }
  for (const [name, root] of Object.entries(ROOTS)) {
    const t = tree(name);
    if (t && t.n !== root) err(`${name}: the root is <${t.n}>, expected <${root}>`);
  }

  // relationships
  const relsOf = new Map(); // source part ('' for the package) -> [{ id, type, target }]
  for (const name of names.filter((n) => n.endsWith('.rels'))) {
    const m = /^(.*?)\/?_rels\/([^/]*)\.rels$/.exec(name);
    if (!m) { err(`${name}: a .rels part outside a _rels folder`); continue; }
    const source = m[2] ? posix.join(m[1], m[2]) : '';
    if (source && !set.has(source)) err(`${name}: its source part ${source} is not in the package`);
    const t = tree(name);
    if (!t) continue;
    if (t.n !== 'Relationships' || t.ns !== NS.rels) err(`${name}: the root is not <Relationships> in the relationships namespace`);
    const list = [];
    const ids = new Set();
    for (const r of kids(t, 'Relationship')) {
      if (ids.has(r.a.Id)) err(`${name}: Id ${r.a.Id} is repeated`);
      ids.add(r.a.Id);
      if (r.a.TargetMode === 'External') { err(`${name}: ${r.a.Id} is an external link, the export has none`); continue; }
      const target = r.a.Target.startsWith('/') ? r.a.Target.slice(1) : posix.normalize(posix.join(posix.dirname(source), r.a.Target));
      if (!set.has(target)) err(`${name}: ${r.a.Id} points to ${target}, which is not in the package`);
      if (!KNOWN_RELS.has(r.a.Type)) err(`${name}: ${r.a.Id} has an unknown type ${r.a.Type}`);
      list.push({ id: r.a.Id, type: r.a.Type, target });
    }
    relsOf.set(source, list);
  }
  const reached = new Set();
  const queue = [''];
  while (queue.length) {
    for (const r of relsOf.get(queue.pop()) || []) if (!reached.has(r.target)) { reached.add(r.target); queue.push(r.target); }
  }
  for (const p of parts) if (!reached.has(p)) err(`${p}: no relationship leads to this part`);
  const relTarget = (source, id) => (relsOf.get(source) || []).find((r) => r.id === id)?.target;
  const relsByType = (source, type) => (relsOf.get(source) || []).filter((r) => r.type === type);

  // presentation: ids, order, size
  const pres = tree('ppt/presentation.xml');
  const slideParts = [];
  if (pres) {
    const order = pres.c.map((x) => x.n);
    const want = ['p:sldMasterIdLst', 'p:notesMasterIdLst', 'p:sldIdLst', 'p:sldSz', 'p:notesSz'];
    if (JSON.stringify(order.filter((n) => want.includes(n))) !== JSON.stringify(want)) err(`ppt/presentation.xml: children are ${order.join(', ')}, expected ${want.join(', ')} in this order`);
    const ids = new Set();
    for (const m of kids(kid(pres, 'p:sldMasterIdLst'), 'p:sldMasterId')) {
      if (Number(m.a.id) < 2147483648) err(`ppt/presentation.xml: sldMasterId ${m.a.id} is below 2147483648`);
      ids.add(m.a.id);
      if (relTarget('ppt/presentation.xml', m.a['r:id']) !== 'ppt/slideMasters/slideMaster1.xml') err(`ppt/presentation.xml: sldMasterId ${m.a['r:id']} does not point to a slide master`);
    }
    const nm = kids(kid(pres, 'p:notesMasterIdLst'), 'p:notesMasterId');
    if (nm.length !== 1 || relTarget('ppt/presentation.xml', nm[0].a['r:id']) !== 'ppt/notesMasters/notesMaster1.xml') err('ppt/presentation.xml: notesMasterIdLst must hold one notes master');
    const slideIds = new Set();
    for (const s of kids(kid(pres, 'p:sldIdLst'), 'p:sldId')) {
      const id = Number(s.a.id);
      if (!(id >= 256 && id < 2147483648)) err(`ppt/presentation.xml: sldId ${s.a.id} is outside 256..2147483647`);
      if (slideIds.has(id)) err(`ppt/presentation.xml: sldId ${id} is repeated`);
      slideIds.add(id);
      slideParts.push(relTarget('ppt/presentation.xml', s.a['r:id']));
    }
    const size = kid(pres, 'p:sldSz');
    if (!size || Number(size.a.cx) !== SLIDE_W || Number(size.a.cy) !== SLIDE_H) err(`ppt/presentation.xml: slide size is ${size && size.a.cx} x ${size && size.a.cy}, expected ${SLIDE_W} x ${SLIDE_H}`);
    const master = tree('ppt/slideMasters/slideMaster1.xml');
    for (const l of kids(kid(master, 'p:sldLayoutIdLst'), 'p:sldLayoutId')) {
      if (Number(l.a.id) < 2147483648 || ids.has(l.a.id)) err(`ppt/slideMasters/slideMaster1.xml: layout id ${l.a.id} is below 2147483648 or repeats another id`);
      ids.add(l.a.id);
      if (relTarget('ppt/slideMasters/slideMaster1.xml', l.a['r:id']) !== 'ppt/slideLayouts/slideLayout1.xml') err(`ppt/slideMasters/slideMaster1.xml: ${l.a['r:id']} does not point to the layout`);
    }
  } else err('ppt/presentation.xml is missing or unreadable');

  // slides
  const want = expected.slides;
  const allSlides = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  const allNotes = names.filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n));
  const allImages = names.filter((n) => n.startsWith('ppt/media/'));
  if (slideParts.length !== want.length) err(`presentation lists ${slideParts.length} slides, expected ${want.length}`);
  if (allSlides.length !== want.length) err(`package holds ${allSlides.length} slide parts, expected ${want.length}`);
  const noted = (w) => w.notes === true || (Array.isArray(w.notes) && w.notes.length > 0);
  const wantNotes = want.filter(noted).length;
  if (allNotes.length !== wantNotes) err(`package holds ${allNotes.length} notes slides, expected ${wantNotes}`);
  if (allImages.length !== want.length) err(`package holds ${allImages.length} images, expected ${want.length}`);
  const imageBytes = { total: 0 };
  want.forEach((w, i) => {
    const part = `ppt/slides/slide${i + 1}.xml`;
    const at = `slide ${i + 1}`;
    if (slideParts[i] !== part) err(`${at}: sldIdLst entry ${i + 1} points to ${slideParts[i]}, expected ${part}`);
    const t = tree(part);
    if (!t) return;
    if (t.n !== 'p:sld' || t.ns !== NS.p) err(`${at}: the root is not <p:sld>`);
    const rootOrder = t.c.map((x) => x.n);
    if (JSON.stringify(rootOrder) !== JSON.stringify(expected.transition ? ['p:cSld', 'p:clrMapOvr', 'p:transition'] : ['p:cSld', 'p:clrMapOvr'])) err(`${at}: children are ${rootOrder.join(', ')}`);
    if (expected.transition) {
      const tr = kid(t, 'p:transition');
      if (!tr || !kid(tr, 'p:fade')) err(`${at}: no fade transition`);
    }
    const tree1 = kid(kid(t, 'p:cSld'), 'p:spTree');
    const shapes = tree1 ? tree1.c.filter((x) => x.n === 'p:sp' || x.n === 'p:pic') : [];
    if (shapes.map((x) => x.n).join() !== 'p:sp,p:pic') err(`${at}: shapes are ${shapes.map((x) => x.n).join()}, expected a title p:sp under one p:pic`);
    const ids = [];
    if (tree1) walk(tree1, (x) => { if (x.n === 'p:cNvPr') ids.push(x.a.id); });
    if (new Set(ids).size !== ids.length) err(`${at}: shape ids repeat (${ids.join(',')})`);
    const title = shapes.find((x) => x.n === 'p:sp');
    const ph = title && kid(kid(kid(title, 'p:nvSpPr'), 'p:nvPr'), 'p:ph');
    if (!ph || ph.a.type !== 'title') err(`${at}: the first shape is not a title placeholder`);
    else if (textOf(kid(title, 'p:txBody')) !== w.title) err(`${at}: title text is ${JSON.stringify(textOf(kid(title, 'p:txBody')))}, expected ${JSON.stringify(w.title)}`);
    const pic = shapes.find((x) => x.n === 'p:pic');
    if (pic) {
      const descr = kid(kid(pic, 'p:nvPicPr'), 'p:cNvPr')?.a.descr;
      if (!descr || !descr.trim()) err(`${at}: the picture has no alt text`);
      const xfrm = kid(kid(pic, 'p:spPr'), 'a:xfrm');
      const off = kid(xfrm, 'a:off');
      const ext = kid(xfrm, 'a:ext');
      if (!off || off.a.x !== '0' || off.a.y !== '0' || !ext || Number(ext.a.cx) !== SLIDE_W || Number(ext.a.cy) !== SLIDE_H) err(`${at}: the picture does not cover the slide`);
      const blip = kid(kid(pic, 'p:blipFill'), 'a:blip');
      const image = blip && relTarget(part, blip.a['r:embed']);
      if (!image) err(`${at}: the picture's r:embed does not resolve to a part`);
      else {
        const bytes = data.get(image);
        const info = bytes && imageInfo(bytes);
        imageBytes.total += bytes ? bytes.length : 0;
        if (!info) err(`${at}: ${image} is neither a PNG nor a JPEG by its first bytes`);
        else {
          if (info.type !== w.ext) err(`${at}: ${image} is a ${info.type}, expected ${w.ext}`);
          if (info.width !== expected.width || info.height !== expected.height) err(`${at}: ${image} is ${info.width} x ${info.height} px, expected ${expected.width} x ${expected.height}`);
          if (typeOf(image) !== IMAGE_TYPES[info.type]) err(`${at}: ${image} has content type ${typeOf(image)}, expected ${IMAGE_TYPES[info.type]}`);
        }
      }
    }
    if (relsByType(part, REL_TYPES.slideLayout).length !== 1) err(`${at}: it must have exactly one layout relationship`);
    const notesRel = relsByType(part, REL_TYPES.notesSlide);
    const hasNotes = noted(w);
    if (notesRel.length !== (hasNotes ? 1 : 0)) err(`${at}: has ${notesRel.length} notes relationships, expected ${hasNotes ? 1 : 0}`);
    if (hasNotes && notesRel.length === 1) {
      const nt = tree(notesRel[0].target);
      if (!nt) return;
      if (nt.n !== 'p:notes' || nt.ns !== NS.p) err(`${at}: its notes part is not <p:notes>`);
      const phs = [];
      walk(nt, (x) => { if (x.n === 'p:ph') phs.push(x.a.type); });
      if (!phs.includes('sldImg') || !phs.includes('body')) err(`${at}: the notes slide lacks the slide image or the body placeholder`);
      let body = null;
      walk(nt, (x) => { if (x.n === 'p:sp' && kid(kid(kid(x, 'p:nvSpPr'), 'p:nvPr'), 'p:ph')?.a.type === 'body') body = kid(x, 'p:txBody'); });
      if (Array.isArray(w.notes) && JSON.stringify(body ? paragraphs(body) : null) !== JSON.stringify(w.notes)) err(`${at}: notes text differs from the deck's notes`);
      const back = relsByType(notesRel[0].target, REL_TYPES.slide).map((r) => r.target);
      if (back.length !== 1 || back[0] !== part) err(`${at}: its notes slide points back to ${back.join()}, expected ${part}`);
      if (relsByType(notesRel[0].target, REL_TYPES.notesMaster).length !== 1) err(`${at}: its notes slide has no notes master relationship`);
    }
  });
  allSlides.forEach((n) => { if (slideNo(n) > want.length) err(`${n}: an extra slide part`); });

  // document properties
  const core = tree('docProps/core.xml');
  const prop = (tag) => kid(core, tag)?.t;
  if (core) {
    if (prop('dc:title') !== expected.meta.title) err(`docProps/core.xml: title is ${JSON.stringify(prop('dc:title'))}, expected ${JSON.stringify(expected.meta.title)}`);
    if ((prop('dc:creator') ?? '') !== (expected.meta.author || '')) err(`docProps/core.xml: creator is ${JSON.stringify(prop('dc:creator'))}`);
    if (prop('dc:language') !== expected.meta.lang) err(`docProps/core.xml: language is ${JSON.stringify(prop('dc:language'))}, expected ${JSON.stringify(expected.meta.lang)}`);
  } else err('docProps/core.xml is missing or unreadable');
  const app = tree('docProps/app.xml');
  if (app && kid(app, 'Slides')?.t !== String(want.length)) err(`docProps/app.xml: Slides is ${kid(app, 'Slides')?.t}, expected ${want.length}`);

  return { errors, stats: { parts: names.length, slides: allSlides.length, notes: allNotes.length, images: allImages.length, imageBytes: imageBytes.total, bytes: buf.length } };
}
