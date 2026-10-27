// ───────────────────────── Présentations Rumeur (port de deckkit.py) ─────────────────────────
// Construit un .pptx à partir du modèle « Rumeur crea template » et d'une spec JSON.
// Les images viennent du Drive (file_id). Le .pptx s'ouvre dans Keynote avec la police Aeonik.
const DK = { E: 12700, W: 1920, H: 1080, RED: '971B19', REL: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships' };

function dkEsc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function dkShapes(x) {
  const re = /<p:(sp|pic)>[\s\S]*?<\/p:\1>/g; const out = []; let m;
  while ((m = re.exec(x))) out.push({ start: m.index, end: m.index + m[0].length, s: m[0] });
  return out;
}
function dkText(s) { const out = []; const re = /<a:t>([^<]*)<\/a:t>/g; let m; while ((m = re.exec(s))) out.push(m[1]); return out.join(''); }
function dkNorm(t) { return String(t).replace(/&amp;/g, '&').replace(/\s+/g, '').toUpperCase(); }
function dkPos(s) {
  const m = s.match(/<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/);
  return m ? m.slice(1).map(v => parseInt(v, 10) / DK.E) : null;
}
function dkIsFrame(s) {
  if (s.indexOf('<p:sp>') !== 0) return false;
  const sppr = s.match(/<p:spPr>[\s\S]*?<\/p:spPr>/);
  return !!(sppr && sppr[0].indexOf('<a:solidFill><a:srgbClr val="' + DK.RED + '"') >= 0);
}
function dkSetLines(s, lines) {
  if (s.indexOf('<p:txBody>') < 0) return s;
  const body = s.match(/<p:txBody>[\s\S]*<\/p:txBody>/)[0];
  const head = body.match(/^<p:txBody>([\s\S]*?)(?=<a:p>|<a:p )/)[1];
  const p1 = body.match(/<a:p>[\s\S]*?<\/a:p>|<a:p [\s\S]*?<\/a:p>/)[0];
  const ppr = (p1.match(/<a:pPr[^>]*\/>|<a:pPr[^>]*[^\/]>[\s\S]*?<\/a:pPr>/) || [''])[0];
  const rpr = (p1.match(/<a:rPr[^>]*\/>|<a:rPr[^>]*[^\/]>[\s\S]*?<\/a:rPr>/) || [''])[0];
  if (!lines || !lines.length) lines = [''];
  const ps = lines.map(l => '<a:p>' + ppr + '<a:r>' + rpr + '<a:t xml:space="preserve">' + dkEsc(l) + '</a:t></a:r></a:p>').join('');
  return s.replace(body, () => '<p:txBody>' + head + ps + '</p:txBody>');
}
function dkMove(s, X, Y) {
  return s.replace(/<a:off x="-?\d+" y="-?\d+"\/>/, '<a:off x="' + Math.trunc(X * DK.E) + '" y="' + Math.trunc(Y * DK.E) + '"/>');
}
function dkEdit(x, pred, fn) {
  const sh = dkShapes(x);
  for (let i = sh.length - 1; i >= 0; i--) if (pred(sh[i].s)) x = x.slice(0, sh[i].start) + fn(sh[i].s) + x.slice(sh[i].end);
  return x;
}
function dkKeyPred(k) {
  const nk = dkNorm(k);
  return s => s.indexOf('<p:txBody>') >= 0 && !dkIsFrame(s) && nk !== '' && dkNorm(dkText(s)).indexOf(nk) === 0;
}
function dkReading(a, b) { const pa = dkPos(a) || [0, 0], pb = dkPos(b) || [0, 0]; return (Math.round(pa[1] / 60) - Math.round(pb[1] / 60)) || (pa[0] - pb[0]); }

/** Taille en pixels d'un JPEG ou PNG (lecture de l'en-tête). */
function dkImageSize(bytes) {
  const b = i => bytes[i] & 0xFF;
  if (b(0) === 0x89 && b(1) === 0x50) return [(b(16) << 24) | (b(17) << 16) | (b(18) << 8) | b(19), (b(20) << 24) | (b(21) << 16) | (b(22) << 8) | b(23)];
  if (b(0) === 0xFF && b(1) === 0xD8) {
    let i = 2;
    while (i < bytes.length) {
      if (b(i) !== 0xFF) { i++; continue; }
      const marker = b(i + 1);
      if (marker >= 0xC0 && marker <= 0xCF && [0xC4, 0xC8, 0xCC].indexOf(marker) < 0) return [(b(i + 7) << 8) | b(i + 8), (b(i + 5) << 8) | b(i + 6)];
      i += 2 + ((b(i + 2) << 8) | b(i + 3));
    }
  }
  return [1600, 1000];
}

function DkDeck(templateBlob) {
  this.files = {};
  Utilities.unzip(templateBlob).forEach(bl => { this.files[bl.getName()] = /\.(xml|rels)$/.test(bl.getName()) ? bl.getDataAsString('UTF-8') : bl; });
  this.pres = this.files['ppt/presentation.xml'];
  this.prels = this.files['ppt/_rels/presentation.xml.rels'];
  this.ct = this.files['[Content_Types].xml'];
  const rid2file = {}; let m; const re = /Id="(rId\d+)"[^>]*Target="slides\/(slide\d+\.xml)"/g;
  while ((m = re.exec(this.prels))) rid2file[m[1]] = m[2];
  this.order = []; const re2 = /<p:sldId id="\d+" r:id="(rId\d+)"\/>/g;
  while ((m = re2.exec(this.pres))) this.order.push(rid2file[m[1]]);
  this.next = Math.max.apply(null, this.order.map(f => parseInt(f.match(/\d+/)[0], 10))) + 1;
  this.pid = 5000;
}
DkDeck.prototype.clone = function (n) {
  const src = this.order[n - 1];
  if (!src) throw new Error('Diapositive modèle inexistante : ' + n + ' (1 à ' + this.order.length + ')');
  const nw = 'slide' + (this.next++) + '.xml';
  this.files['ppt/slides/' + nw] = this.files['ppt/slides/' + src];
  this.files['ppt/slides/_rels/' + nw + '.rels'] = this.files['ppt/slides/_rels/' + src + '.rels'];
  return nw;
};
DkDeck.prototype.addMedia = function (slide, img) {
  const name = img.base.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 40) + '_' + (this.pid++) + '.' + img.ext;
  this.files['ppt/media/' + name] = img.blob;
  const rp = 'ppt/slides/_rels/' + slide + '.rels'; let r = this.files[rp];
  const ids = (r.match(/Id="rId(\d+)"/g) || []).map(s => parseInt(s.match(/\d+/)[0], 10));
  const n = (ids.length ? Math.max.apply(null, ids) : 0) + 1;
  this.files[rp] = r.replace('</Relationships>', '<Relationship Id="rId' + n + '" Type="' + DK.REL + '/image" Target="../media/' + name + '"/></Relationships>');
  return 'rId' + n;
};
DkDeck.prototype.pic = function (rid, size, x, y, w, h, name) {
  const a = size[0] / size[1], f = w / h; let l = 0, t = 0;
  if (a > f) l = Math.trunc((1 - f / a) / 2 * 100000); else t = Math.trunc((1 - a / f) / 2 * 100000);
  this.pid++;
  return '<p:pic><p:nvPicPr><p:cNvPr id="' + this.pid + '" name="' + dkEsc(name) + '"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>' +
    '<p:blipFill><a:blip r:embed="' + rid + '"/><a:srcRect l="' + l + '" t="' + t + '" r="' + l + '" b="' + t + '"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
    '<p:spPr><a:xfrm><a:off x="' + Math.trunc(x * DK.E) + '" y="' + Math.trunc(y * DK.E) + '"/><a:ext cx="' + Math.trunc(w * DK.E) + '" cy="' + Math.trunc(h * DK.E) + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
};
DkDeck.prototype.finish = function (slides, outName) {
  let rels = this.prels.replace(/<Relationship Id="rId\d+" Type="[^"]*\/slide" Target="slides\/slide\d+\.xml"\/>/g, '');
  let ct = this.ct.replace(/<Override PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g, '');
  if (ct.indexOf('Extension="jpg"') < 0) ct = ct.replace('<Default Extension="xml"', '<Default Extension="jpg" ContentType="image/jpeg"/><Default Extension="xml"');
  const ids = [];
  slides.forEach((f, i) => {
    const rid = 'rId' + (9000 + i);
    rels = rels.replace('</Relationships>', '<Relationship Id="' + rid + '" Type="' + DK.REL + '/slide" Target="slides/' + f + '"/></Relationships>');
    ct = ct.replace('</Types>', '<Override PartName="/ppt/slides/' + f + '" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>');
    ids.push('<p:sldId id="' + (256 + i) + '" r:id="' + rid + '"/>');
  });
  this.files['ppt/presentation.xml'] = this.pres.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, () => '<p:sldIdLst>' + ids.join('') + '</p:sldIdLst>');
  this.files['ppt/_rels/presentation.xml.rels'] = rels;
  this.files['[Content_Types].xml'] = ct;
  const keep = {}; slides.forEach(f => keep[f] = 1);
  Object.keys(this.files).forEach(k => {
    const m = k.match(/^ppt\/slides\/(slide\d+\.xml)$/) || k.match(/^ppt\/slides\/_rels\/(slide\d+\.xml)\.rels$/);
    if (m && !keep[m[1]]) delete this.files[k];
  });
  const used = {};
  Object.keys(this.files).forEach(k => {
    if (/\.rels$/.test(k) && /^ppt\/(slides|slideLayouts|slideMasters)\//.test(k)) {
      const re = /media\/([^"]+)"/g; let m; while ((m = re.exec(this.files[k]))) used[m[1]] = 1;
    }
  });
  Object.keys(this.files).forEach(k => { const m = k.match(/^ppt\/media\/(.+)$/); if (m && !used[m[1]]) delete this.files[k]; });
  const names = Object.keys(this.files).sort((a, b) => (a === '[Content_Types].xml' ? -1 : b === '[Content_Types].xml' ? 1 : 0));
  const blobs = names.map(k => {
    const v = this.files[k];
    const bl = typeof v === 'string' ? Utilities.newBlob(v, 'application/xml', k) : v.copyBlob();
    bl.setName(k); return bl;
  });
  return Utilities.zip(blobs, outName).setContentType('application/vnd.openxmlformats-officedocument.presentationml.presentation');
};

function dkFillFrames(deck, slide, x, images) {
  const frames = dkShapes(x).filter(m => dkIsFrame(m.s)).sort((a, b) => dkReading(a.s, b.s));
  const geo = frames.map(m => dkPos(m.s) || [0, 0, DK.W, DK.H]);
  const n = images.length;
  if (n > frames.length) throw new Error('La diapositive modèle n\'a que ' + frames.length + ' cadre(s) photo pour ' + n + ' image(s) : choisissez un autre modèle ou répartissez sur deux diapositives.');
  let used = geo.slice(0, n);
  if (n > 0 && n < frames.length) {
    const top = Math.min.apply(null, geo.map(g => g[1]));
    if (geo.every(g => Math.abs(g[1] - top) < 40)) {
      const x0 = Math.min.apply(null, geo.map(g => g[0])), x1 = Math.max.apply(null, geo.map(g => g[0] + g[2]));
      const sorted = geo.slice().sort((a, b) => a[0] - b[0]);
      const gap = sorted.length > 1 ? sorted[1][0] - (sorted[0][0] + sorted[0][2]) : 40;
      const tot = used.reduce((s, g) => s + g[2], 0), k = (x1 - x0 - gap * (n - 1)) / tot;
      let cx = x0; used = used.map(g => { const r = [cx, g[1], g[2] * k, g[3]]; cx += g[2] * k + gap; return r; });
    }
  }
  let full = used.reduce((s, g) => s + g[2] * g[3], 0) >= 0.9 * DK.W * DK.H;
  const firstIdx = frames.length ? frames[0].start : null;
  frames.slice().sort((a, b) => b.start - a.start).forEach(m => { x = x.slice(0, m.start) + x.slice(m.end); });
  let pics = '';
  used.forEach((g, i) => {
    let fx = g[0], fy = g[1], fw = g[2], fh = g[3];
    const img = images[i];
    const rid = deck.addMedia(slide, img);
    if (fw >= DK.W * 0.95 && fh >= DK.H * 0.95) { full = true; fx = 0; fy = 0; fw = DK.W; fh = DK.H; }
    pics += deck.pic(rid, img.size, fx, fy, fw, fh, img.base);
  });
  if (full) pics += '<p:sp><p:nvSpPr><p:cNvPr id="4999" name="Veil"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + DK.W * DK.E + '" cy="' + DK.H * DK.E + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="000000"><a:alpha val="30000"/></a:srgbClr></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr></p:sp>';
  if (firstIdx !== null && pics) {
    const at = full ? x.indexOf('</p:grpSpPr>') + '</p:grpSpPr>'.length : firstIdx;
    x = x.slice(0, at) + pics + x.slice(at);
  }
  return { x, full };
}

function dkWhiten(x) {
  return x.replace(/<p:(sp|pic)>[\s\S]*?<\/p:\1>/g, s => {
    if (!(s.indexOf('pasted-image') >= 0 || (s.indexOf('<p:txBody>') >= 0 && !dkIsFrame(s)))) return s;
    if (s.indexOf('name="Veil"') >= 0) return s;
    s = s.replace(/val="000000"/g, 'val="FFFFFF"');
    s = s.replace(/<a:rPr([^>]*)\/>/g, '<a:rPr$1><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr>');
    s = s.replace(/(<a:blip r:embed="rId\d+">)<a:extLst\/>/g, '$1<a:lum bright="100000"/>');
    if (s.indexOf('pasted-image') >= 0) s = s.replace(/<a:blip (r:embed="rId\d+")\/>/g, '<a:blip $1><a:lum bright="100000"/></a:blip>');
    return s;
  });
}

/** spec.slides[].images = liste d'objets {blob, ext, size, base}. Renvoie {blob, leftovers}. */
function dkBuild(templateBlob, spec, outName) {
  const deck = new DkDeck(templateBlob);
  let campaign = spec.campaign || ['NAME OF THE', 'CAMPAIGN'];
  if (typeof campaign === 'string') campaign = [campaign];
  const brand = spec.brand || 'LOGO OF THE BRAND';
  const files = [], entries = [], indexSlides = [];
  spec.slides.forEach((sd, i) => {
    const num = i + 1, two = (num < 10 ? '0' : '') + num;
    const f = deck.clone(sd.from); let x = deck.files['ppt/slides/' + f];
    x = dkEdit(x, s => { const p = dkPos(s); return p && (p[0] + p[2] <= 0 || p[1] + p[3] <= 0 || p[0] >= DK.W || p[1] >= DK.H); }, () => '');
    let full = false;
    if (sd.images && sd.images.length) { const r = dkFillFrames(deck, f, x, sd.images); x = r.x; full = r.full; }
    Object.keys(sd.move || {}).forEach(k => { const mv = sd.move[k]; x = dkEdit(x, dkKeyPred(k), s => dkMove(s, mv[0], mv[1])); });
    Object.keys(sd.texts || {}).forEach(k => {
      let lines = sd.texts[k];
      if (typeof lines === 'string') lines = [lines];
      if (lines && lines.length && Array.isArray(lines[0])) {
        const ms = dkShapes(x).filter(m => dkKeyPred(k)(m.s));
        const order = ms.map((m, j) => j).sort((a, b) => dkReading(ms[a].s, ms[b].s));
        const vals = {}; order.forEach((j, idx) => { vals[j] = idx < lines.length ? lines[idx] : []; });
        ms.map((m, j) => j).sort((a, b) => ms[b].start - ms[a].start).forEach(j => { const m = ms[j]; x = x.slice(0, m.start) + dkSetLines(m.s, vals[j]) + x.slice(m.end); });
      } else {
        x = dkEdit(x, dkKeyPred(k), s => dkSetLines(s, lines));
      }
    });
    x = dkEdit(x, s => { const p = dkPos(s); return p && p[1] < 40 && p[0] > 1800 && s.indexOf('<p:txBody>') >= 0; }, s => dkSetLines(s, [two]));
    if (sd.label) x = dkEdit(x, s => { const p = dkPos(s); return p && p[1] < 40 && p[0] > 900 && p[0] < 1500 && s.indexOf('<p:txBody>') >= 0; }, s => dkSetLines(s, [sd.label]));
    x = dkEdit(x, s => { const p = dkPos(s); return p && p[1] > 990 && dkNorm(dkText(s)).indexOf('NAMEOFTHE') === 0; }, s => dkSetLines(s, campaign));
    x = dkEdit(x, s => { const p = dkPos(s); const t = dkNorm(dkText(s)); return p && p[1] > 990 && (t.indexOf('LOGOOFTHEBRAND') === 0 || t.indexOf('LOFOOFTHEBRAND') === 0); }, s => dkSetLines(s, [brand]));
    if (sd.from === 1) x = dkEdit(x, s => dkNorm(dkText(s)).indexOf('LOGOOFTHEBRAND') === 0, s => dkSetLines(s, [brand]));
    if (full || sd.white_text) x = dkWhiten(x);
    deck.files['ppt/slides/' + f] = x; files.push(f);
    if (sd.index_entry) entries.push([sd.index_entry, num]);
    if (sd.index) indexSlides.push(f);
  });
  indexSlides.forEach(f => {
    let x = deck.files['ppt/slides/' + f];
    const labels = entries.map(e => e[0]), nums = entries.map(e => (e[1] < 10 ? '0' : '') + e[1]);
    x = dkEdit(x, s => { const t = dkNorm(dkText(s)); const p = dkPos(s); return t.indexOf('INTRO') === 0 || ((s.match(/<a:p>/g) || []).length > 3 && !/^\d\d/.test(t) && t.indexOf('INDEX') < 0 && p && p[1] > 500); }, s => dkSetLines(s, labels));
    x = dkEdit(x, s => { const p = dkPos(s); return /^\d{4}/.test(dkNorm(dkText(s))) && p && p[1] > 500; }, s => dkSetLines(s, nums));
    deck.files['ppt/slides/' + f] = x;
  });
  const leftovers = [];
  files.forEach((f, i) => {
    const t = dkText(deck.files['ppt/slides/' + f]);
    ['Lorem', 'NAME OF THE', 'LOGO OF THE', 'LOFO', 'PHOTO OR VIDEO', 'PHOTO / VIDEO', 'Nom de la sc'].forEach(bad => { if (t.indexOf(bad) >= 0) leftovers.push('diapo ' + (i + 1) + ' : « ' + bad + ' »'); });
  });
  return { blob: deck.finish(files, outName), leftovers, slides: files.length };
}

// ───────── Branchement avec le Drive et l'assistant ─────────
const DECK_TPL_NAME = 'Rumeur_crea_template_CLEAN.pptx';

function deckTemplateBlob() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('DECK_TEMPLATE_ID');
  if (id) { try { return DriveApp.getFileById(id).getBlob(); } catch (e) {} }
  const it = DriveApp.searchFiles("title = '" + DECK_TPL_NAME + "' and trashed = false");
  if (!it.hasNext()) throw new Error('Modèle de présentation introuvable : déposez « ' + DECK_TPL_NAME + ' » dans le Drive (dossier 99 · SYSTÈME).');
  const f = it.next();
  props.setProperty('DECK_TEMPLATE_ID', f.getId());
  return f.getBlob();
}

/** Vignette Drive redimensionnée (JPEG/PNG), ou null. Gère HEIC, gros fichiers, etc. */
function driveThumb(fileId, size) {
  try {
    const tok = ScriptApp.getOAuthToken();
    const meta = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?fields=thumbnailLink&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true });
    if (meta.getResponseCode() !== 200) return null;
    const link = JSON.parse(meta.getContentText()).thumbnailLink;
    if (!link) return null;
    const r = UrlFetchApp.fetch(link.replace(/=s\d+[^/]*$/, '=s' + size), { headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true });
    if (r.getResponseCode() !== 200) return null;
    const b = r.getBlob();
    return /image\/(jpeg|png)/.test(b.getContentType()) ? b : null;
  } catch (e) { return null; }
}

function deckImage(fileId, cache) {
  if (cache[fileId]) return cache[fileId];
  const f = DriveApp.getFileById(fileId);
  let blob = driveThumb(fileId, 2400);
  if (!blob) {
    if (!/^image\/(jpeg|png)$/.test(f.getMimeType())) throw new Error(f.getName() + ' : image illisible (JPEG ou PNG attendu).');
    blob = f.getBlob();
  }
  const img = { blob: blob, ext: /png/.test(blob.getContentType()) ? 'png' : 'jpeg', size: dkImageSize(blob.getBytes()), base: f.getName().replace(/\.[^.]+$/, '') };
  cache[fileId] = img;
  return img;
}

/** Renvoie des blocs image (vignettes 800 px) pour que l'assistant voie les photos. */
function viewImages(ids) {
  const blocks = [];
  (ids || []).slice(0, 16).forEach((id, i) => {
    try {
      const f = DriveApp.getFileById(id);
      let b = driveThumb(id, 800);
      if (!b && /^image\/(jpeg|png)$/.test(f.getMimeType()) && f.getSize() < 3500000) b = f.getBlob();
      if (!b) { blocks.push({ type: 'text', text: (i + 1) + '. ' + f.getName() + ' (file_id ' + id + ') : aperçu indisponible' }); return; }
      const s = dkImageSize(b.getBytes());
      blocks.push({ type: 'text', text: (i + 1) + '. ' + f.getName() + ' — file_id ' + id + ' — ' + (s[0] >= s[1] ? 'paysage' : 'portrait') });
      blocks.push({ type: 'image', source: { type: 'base64', media_type: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) } });
    } catch (e) { blocks.push({ type: 'text', text: (i + 1) + '. ' + id + ' : ' + e.message }); }
  });
  return { __blocks: blocks.length ? blocks : [{ type: 'text', text: 'Aucune image.' }] };
}

function createDeck(p, user) {
  if (!p || !p.slides || !p.slides.length) throw new Error('Spec vide : il faut au moins une diapositive.');
  const cache = {};
  const spec = {
    campaign: p.campaign, brand: p.brand,
    slides: p.slides.map(s => Object.assign({}, s, { from: Number(s.from), images: (s.images || []).map(id => deckImage(String(id).trim(), cache)) })),
  };
  const stamp = Utilities.formatDate(new Date(), TZ, 'dd.MM.yy_HH\'h\'mm');
  const name = String(p.titre || ((p.brand || 'Rumeur') + '_Deck')).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) + '_' + stamp + '.pptx';
  const built = dkBuild(deckTemplateBlob(), spec, name);
  let folder, projectFolder = null;
  if (p.code) { const pr = findProject(p.code); projectFolder = pr.folder; folder = subfolder(pr.folder, '2.DA & PROPOSITIONS'); }
  else folder = DriveApp.getFolderById(IDS.presentations);
  const file = folder.createFile(built.blob);
  if (p.remplace_file_id) { try { DriveApp.getFileById(p.remplace_file_id).setTrashed(true); } catch (e) {} }
  if (projectFolder) addJournal(projectFolder, 'Présentation créée : ' + name + ' — ' + file.getUrl(), user);
  logAction(user, 'Présentation créée : ' + name + ' — ' + file.getUrl(), 'Projet');
  return {
    fichier: name, file_id: file.getId(), lien: file.getUrl(),
    telecharger: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
    dossier: folder.getUrl(), diapositives: built.slides,
    textes_modele_restants: built.leftovers,
    consigne: built.leftovers.length ? 'Corrige ces textes du modèle restés en place puis rappelle creer_presentation avec remplace_file_id=' + file.getId() : 'OK',
  };
}
