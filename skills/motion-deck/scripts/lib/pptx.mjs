// Builds the parts of an image-based .pptx (ECMA-376, PresentationML) as strings and Buffers. Contract section 13.
// One slide master, one title-only layout, one notes master; every slide is a hidden title placeholder under one full-bleed picture.

export const SLIDE_W = 12192000; // 16:9 in EMU (13.333 in x 7.5 in)
export const SLIDE_H = 6858000;
export const NOTES_W = 6858000;
export const NOTES_H = 9144000;

export const NS = {
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  rels: 'http://schemas.openxmlformats.org/package/2006/relationships',
  ct: 'http://schemas.openxmlformats.org/package/2006/content-types',
};
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
export const REL_TYPES = {
  officeDocument: `${REL}/officeDocument`,
  core: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
  extended: `${REL}/extended-properties`,
  slideMaster: `${REL}/slideMaster`, slideLayout: `${REL}/slideLayout`, slide: `${REL}/slide`, notesMaster: `${REL}/notesMaster`, notesSlide: `${REL}/notesSlide`,
  theme: `${REL}/theme`, presProps: `${REL}/presProps`, viewProps: `${REL}/viewProps`, tableStyles: `${REL}/tableStyles`, image: `${REL}/image`,
};
const PML = 'application/vnd.openxmlformats-officedocument.presentationml';
export const CONTENT_TYPES = {
  presentation: `${PML}.presentation.main+xml`, slideMaster: `${PML}.slideMaster+xml`, slideLayout: `${PML}.slideLayout+xml`, slide: `${PML}.slide+xml`,
  notesMaster: `${PML}.notesMaster+xml`, notesSlide: `${PML}.notesSlide+xml`, presProps: `${PML}.presProps+xml`, viewProps: `${PML}.viewProps+xml`,
  tableStyles: `${PML}.tableStyles+xml`, theme: 'application/vnd.openxmlformats-officedocument.theme+xml',
  core: 'application/vnd.openxmlformats-package.core-properties+xml', extended: 'application/vnd.openxmlformats-officedocument.extended-properties+xml',
};
export const IMAGE_TYPES = { png: 'image/png', jpeg: 'image/jpeg' };
export const IMAGE_EXT = { png: 'png', jpeg: 'jpg' }; // file extension of each format inside the package

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_APR = `xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"`;

// Text for XML: drops characters XML 1.0 cannot hold (controls, lone surrogates, U+FFFE and U+FFFF), then escapes the five specials.
export function xml(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// One line, collapsed whitespace, cut at a word boundary and closed with an ellipsis when longer than max.
export function clip(text, max) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s.,;:\-]+$/, '')}…`;
}

const rels = (list) => `${XML}<Relationships xmlns="${NS.rels}">${list.map(([id, type, target]) => `<Relationship Id="${id}" Type="${type}" Target="${target}"/>`).join('')}</Relationships>`;
const GROUP = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
const COLORS = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
const CLR_MAP = `<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" ${COLORS.slice(4).map((c) => `${c}="${c}"`).join(' ')}/>`;
const FILL = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
const LEVEL = (sz, extra = '') => `<a:lvl1pPr marL="0" indent="0" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1">${extra}<a:buNone/><a:defRPr sz="${sz}" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr>`;
const TITLE_BOX = '<a:xfrm><a:off x="838200" y="365125"/><a:ext cx="10515600" cy="1325563"/></a:xfrm>';

function theme(name) {
  const colors = ['<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>', '<a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>']
    .concat(['dk2:44546A', 'lt2:E7E6E6', 'accent1:4472C4', 'accent2:ED7D31', 'accent3:A5A5A5', 'accent4:FFC000', 'accent5:5B9BD5', 'accent6:70AD47', 'hlink:0563C1', 'folHlink:954F72']
      .map((s) => { const [n, v] = s.split(':'); return `<a:${n}><a:srgbClr val="${v}"/></a:${n}>`; })).join('');
  const font = (tag) => `<a:${tag}><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:${tag}>`;
  const line = (w) => `<a:ln w="${w}" cap="flat" cmpd="sng" algn="ctr">${FILL}<a:prstDash val="solid"/></a:ln>`;
  return `${XML}<a:theme xmlns:a="${NS.a}" name="${xml(name)}"><a:themeElements><a:clrScheme name="${xml(name)}">${colors}</a:clrScheme><a:fontScheme name="${xml(name)}">${font('majorFont')}${font('minorFont')}</a:fontScheme><a:fmtScheme name="${xml(name)}"><a:fillStyleLst>${FILL}${FILL}${FILL}</a:fillStyleLst><a:lnStyleLst>${line(9525)}${line(19050)}${line(28575)}</a:lnStyleLst><a:effectStyleLst>${'<a:effectStyle><a:effectLst/></a:effectStyle>'.repeat(3)}</a:effectStyleLst><a:bgFillStyleLst>${FILL}${FILL}${FILL}</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
}

function slideMaster() {
  const title = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr>${TITLE_BOX}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0" anchor="ctr"><a:normAutofit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Click to edit Master title style</a:t></a:r></a:p></p:txBody></p:sp>`;
  const titleStyle = `<p:titleStyle>${LEVEL(4400, '<a:lnSpc><a:spcPct val="90000"/></a:lnSpc><a:spcBef><a:spcPct val="0"/></a:spcBef>').replaceAll('+mn-', '+mj-')}</p:titleStyle>`;
  return `${XML}<p:sldMaster ${NS_APR}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${GROUP}${title}</p:spTree></p:cSld>${CLR_MAP}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles>${titleStyle}<p:bodyStyle>${LEVEL(2800)}</p:bodyStyle><p:otherStyle>${LEVEL(1800)}</p:otherStyle></p:txStyles></p:sldMaster>`;
}

function slideLayout() {
  const title = '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/><a:t>Click to edit Master title style</a:t></a:r></a:p></p:txBody></p:sp>';
  return `${XML}<p:sldLayout ${NS_APR} type="titleOnly" preserve="1"><p:cSld name="Title Only"><p:spTree>${GROUP}${title}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
}

function notesMaster() {
  const image = '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1143000"/><a:ext cx="5486400" cy="3086100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="12700"><a:solidFill><a:prstClr val="black"/></a:solidFill></a:ln></p:spPr></p:sp>';
  const body = '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4400550"/><a:ext cx="5486400" cy="3600450"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0"/><a:lstStyle/><a:p><a:pPr lvl="0"/><a:r><a:rPr lang="en-US"/><a:t>Click to edit Master text styles</a:t></a:r></a:p></p:txBody></p:sp>';
  return `${XML}<p:notesMaster ${NS_APR}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${GROUP}${image}${body}</p:spTree></p:cSld>${CLR_MAP}<p:notesStyle>${LEVEL(1200)}</p:notesStyle></p:notesMaster>`;
}

const TRANSITION = '<p:transition spd="fast"><p:fade/></p:transition>';

function slidePart(s, n, { transition, lang }) {
  const title = `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr><a:normAutofit/></a:bodyPr><a:lstStyle/><a:p><a:r><a:rPr lang="${xml(lang)}"/><a:t>${xml(s.title)}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const pic = `<p:pic><p:nvPicPr><p:cNvPr id="3" name="Slide ${n} picture" descr="${xml(s.alt)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${SLIDE_W}" cy="${SLIDE_H}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
  return `${XML}<p:sld ${NS_APR}><p:cSld><p:spTree>${GROUP}${title}${pic}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${transition ? TRANSITION : ''}</p:sld>`;
}

function notesPart(paragraphs, lang) {
  const text = paragraphs.map((t) => `<a:p><a:r><a:rPr lang="${xml(lang)}"/><a:t>${xml(t)}</a:t></a:r></a:p>`).join('');
  const image = '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>';
  const body = `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${text}</p:txBody></p:sp>`;
  return `${XML}<p:notes ${NS_APR}><p:cSld><p:spTree>${GROUP}${image}${body}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`;
}

function docProps(meta, counts, now) {
  const iso = now.toISOString().replace(/\.\d+Z$/, 'Z');
  const core = `${XML}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xml(meta.title)}</dc:title>${meta.subtitle ? `<dc:subject>${xml(meta.subtitle)}</dc:subject>` : ''}<dc:creator>${xml(meta.author || '')}</dc:creator><cp:lastModifiedBy>${xml(meta.author || '')}</cp:lastModifiedBy><dc:language>${xml(meta.lang)}</dc:language><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`;
  const app = `${XML}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><TotalTime>0</TotalTime><Application>motion-deck</Application><PresentationFormat>Widescreen</PresentationFormat><Slides>${counts.slides}</Slides><Notes>${counts.notes}</Notes><HiddenSlides>0</HiddenSlides></Properties>`;
  return { core, app };
}

// slides: [{ title, alt, notes: string[], image: { data: Buffer, ext: 'png'|'jpeg' } }]
// meta: { title, subtitle?, author?, lang }, options: { transition: boolean, notes: boolean, now?: Date }
// Returns zip entries [{ name, data, store? }] in package order ([Content_Types].xml first).
export function buildPackage(slides, meta, { transition = true, notes = true, now = new Date() } = {}) {
  if (!slides.length) throw new Error('a presentation needs at least one slide');
  const lang = meta.lang || 'en';
  const hasNotes = slides.map((s) => notes && !!(s.notes && s.notes.length)); // every state of a slide with notes gets its own notes page
  const noteSlides = hasNotes.filter(Boolean).length;
  const formats = [...new Set(slides.map((s) => s.image.ext))];
  const { core, app } = docProps(meta, { slides: slides.length, notes: noteSlides }, now);

  const overrides = [
    ['/ppt/presentation.xml', CONTENT_TYPES.presentation], ['/ppt/slideMasters/slideMaster1.xml', CONTENT_TYPES.slideMaster],
    ['/ppt/slideLayouts/slideLayout1.xml', CONTENT_TYPES.slideLayout], ['/ppt/notesMasters/notesMaster1.xml', CONTENT_TYPES.notesMaster],
    ['/ppt/theme/theme1.xml', CONTENT_TYPES.theme], ['/ppt/theme/theme2.xml', CONTENT_TYPES.theme],
    ['/ppt/presProps.xml', CONTENT_TYPES.presProps], ['/ppt/viewProps.xml', CONTENT_TYPES.viewProps], ['/ppt/tableStyles.xml', CONTENT_TYPES.tableStyles],
    ['/docProps/core.xml', CONTENT_TYPES.core], ['/docProps/app.xml', CONTENT_TYPES.extended],
    ...slides.map((_, i) => [`/ppt/slides/slide${i + 1}.xml`, CONTENT_TYPES.slide]),
    ...slides.flatMap((_, i) => (hasNotes[i] ? [[`/ppt/notesSlides/notesSlide${i + 1}.xml`, CONTENT_TYPES.notesSlide]] : [])),
  ];
  const contentTypes = `${XML}<Types xmlns="${NS.ct}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${formats.map((f) => `<Default Extension="${IMAGE_EXT[f]}" ContentType="${IMAGE_TYPES[f]}"/>`).join('')}${overrides.map(([name, type]) => `<Override PartName="${name}" ContentType="${type}"/>`).join('')}</Types>`;

  const slideRids = slides.map((_, i) => `rId${7 + i}`);
  const presentation = `${XML}<p:presentation ${NS_APR} autoCompressPictures="0"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst><p:sldIdLst>${slideRids.map((rid, i) => `<p:sldId id="${256 + i}" r:id="${rid}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${SLIDE_W}" cy="${SLIDE_H}"/><p:notesSz cx="${NOTES_W}" cy="${NOTES_H}"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:defaultTextStyle></p:presentation>`;
  const presRels = rels([
    ['rId1', REL_TYPES.slideMaster, 'slideMasters/slideMaster1.xml'], ['rId2', REL_TYPES.notesMaster, 'notesMasters/notesMaster1.xml'],
    ['rId3', REL_TYPES.presProps, 'presProps.xml'], ['rId4', REL_TYPES.viewProps, 'viewProps.xml'], ['rId5', REL_TYPES.theme, 'theme/theme1.xml'], ['rId6', REL_TYPES.tableStyles, 'tableStyles.xml'],
    ...slideRids.map((rid, i) => [rid, REL_TYPES.slide, `slides/slide${i + 1}.xml`]),
  ]);
  const viewProps = `${XML}<p:viewPr ${NS_APR}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:slideViewPr><p:cSldViewPr><p:cViewPr varScale="1"><p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale><p:origin x="0" y="0"/></p:cViewPr><p:guideLst/></p:cSldViewPr></p:slideViewPr><p:notesTextViewPr><p:cViewPr><p:scale><a:sx n="1" d="1"/><a:sy n="1" d="1"/></p:scale><p:origin x="0" y="0"/></p:cViewPr></p:notesTextViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`;

  const entries = [
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rels([['rId1', REL_TYPES.officeDocument, 'ppt/presentation.xml'], ['rId2', REL_TYPES.core, 'docProps/core.xml'], ['rId3', REL_TYPES.extended, 'docProps/app.xml']]) },
    { name: 'docProps/core.xml', data: core },
    { name: 'docProps/app.xml', data: app },
    { name: 'ppt/presentation.xml', data: presentation },
    { name: 'ppt/_rels/presentation.xml.rels', data: presRels },
    { name: 'ppt/presProps.xml', data: `${XML}<p:presentationPr ${NS_APR}/>` },
    { name: 'ppt/viewProps.xml', data: viewProps },
    { name: 'ppt/tableStyles.xml', data: `${XML}<a:tblStyleLst xmlns:a="${NS.a}" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>` },
    { name: 'ppt/theme/theme1.xml', data: theme('motion-deck') },
    { name: 'ppt/theme/theme2.xml', data: theme('motion-deck notes') },
    { name: 'ppt/slideMasters/slideMaster1.xml', data: slideMaster() },
    { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: rels([['rId1', REL_TYPES.slideLayout, '../slideLayouts/slideLayout1.xml'], ['rId2', REL_TYPES.theme, '../theme/theme1.xml']]) },
    { name: 'ppt/slideLayouts/slideLayout1.xml', data: slideLayout() },
    { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: rels([['rId1', REL_TYPES.slideMaster, '../slideMasters/slideMaster1.xml']]) },
    { name: 'ppt/notesMasters/notesMaster1.xml', data: notesMaster() },
    { name: 'ppt/notesMasters/_rels/notesMaster1.xml.rels', data: rels([['rId1', REL_TYPES.theme, '../theme/theme2.xml']]) },
  ];
  const media = [];
  slides.forEach((s, i) => {
    const n = i + 1;
    const image = `image${n}.${IMAGE_EXT[s.image.ext]}`;
    entries.push({ name: `ppt/slides/slide${n}.xml`, data: slidePart(s, n, { transition, lang }) });
    entries.push({
      name: `ppt/slides/_rels/slide${n}.xml.rels`,
      data: rels([['rId1', REL_TYPES.slideLayout, '../slideLayouts/slideLayout1.xml'], ['rId2', REL_TYPES.image, `../media/${image}`], ...(hasNotes[i] ? [['rId3', REL_TYPES.notesSlide, `../notesSlides/notesSlide${n}.xml`]] : [])]),
    });
    if (hasNotes[i]) {
      entries.push({ name: `ppt/notesSlides/notesSlide${n}.xml`, data: notesPart(s.notes, lang) });
      entries.push({ name: `ppt/notesSlides/_rels/notesSlide${n}.xml.rels`, data: rels([['rId1', REL_TYPES.notesMaster, '../notesMasters/notesMaster1.xml'], ['rId2', REL_TYPES.slide, `../slides/slide${n}.xml`]]) });
    }
    media.push({ name: `ppt/media/${image}`, data: s.image.data, store: true });
  });
  return entries.concat(media);
}
