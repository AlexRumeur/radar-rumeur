/* Extraction des photos et des textes d'une présentation (PDF ou PowerPoint) dans le navigateur.
   window.RumeurExtract.deck(file, onStep) → { images: File[] (nommées « <deck> — p<N> — <k>.jpg »), text: File|null, pages, kind }
   Les photos sont extraites telles qu'elles sont dans le fichier (pas de capture d'écran de la diapo). */
(function () {
  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  const JSZIP = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
  const MAX_IMG = 140, MAX_SIDE = 2400, MIN_SIDE = 260;
  const loaded = {};
  function script(src) {
    if (!loaded[src]) loaded[src] = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = src; s.onload = res;
      s.onerror = () => { delete loaded[src]; rej(new Error("module indisponible (" + src.split("/").pop() + ")")); };
      document.head.appendChild(s);
    });
    return loaded[src];
  }
  async function pdfjs() { await script(PDFJS + "pdf.min.js"); window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; return window.pdfjsLib; }

  const baseName = (n) => String(n || "presentation").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 60);
  function toJpeg(canvas) { return new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.86)); }
  function fit(w, h) { const k = Math.min(1, MAX_SIDE / Math.max(w, h)); return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))]; }

  // Image pdf.js (ImageBitmap ou pixels bruts) → canvas
  function imgToCanvas(img) {
    if (!img || !img.width || !img.height) return null;
    const src = document.createElement("canvas"); src.width = img.width; src.height = img.height;
    const ctx = src.getContext("2d");
    if (img.bitmap) ctx.drawImage(img.bitmap, 0, 0);
    else if (img.data && (img.kind === 2 || img.kind === 3)) {
      const id = ctx.createImageData(img.width, img.height), d = id.data, s = img.data;
      if (img.kind === 3) d.set(s.subarray(0, d.length));
      else for (let i = 0, j = 0; j < d.length; i += 3, j += 4) { d[j] = s[i]; d[j + 1] = s[i + 1]; d[j + 2] = s[i + 2]; d[j + 3] = 255; }
      ctx.putImageData(id, 0, 0);
    } else return null;
    const [w, h] = fit(img.width, img.height);
    if (w === img.width && h === img.height) return src;
    const out = document.createElement("canvas"); out.width = w; out.height = h;
    out.getContext("2d").drawImage(src, 0, 0, w, h);
    return out;
  }
  // Évite les aplats (fonds unis, dégradés) : écart-type de luminance sur un échantillon.
  function isFlat(canvas) {
    const c = document.createElement("canvas"); c.width = 24; c.height = 24;
    const x = c.getContext("2d"); x.drawImage(canvas, 0, 0, 24, 24);
    const d = x.getImageData(0, 0, 24, 24).data; let m = 0, v = 0; const L = [];
    for (let i = 0; i < d.length; i += 4) L.push(0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]);
    L.forEach((l) => (m += l)); m /= L.length; L.forEach((l) => (v += (l - m) * (l - m)));
    return Math.sqrt(v / L.length) < 6;
  }

  async function fromPdf(file, onStep, opts) {
    opts = opts || {};
    const lib = await pdfjs();
    const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const O = lib.OPS, IMG = [O.paintImageXObject, O.paintJpegXObject, O.paintImageXObjectRepeat].filter((x) => x !== undefined);
    const base = baseName(file.name), images = [], texts = [], seen = new Set();
    for (let n = 1; n <= doc.numPages && images.length < MAX_IMG; n++) {
      onStep && onStep("Lecture de la page " + n + "/" + doc.numPages + "…");
      const page = await doc.getPage(n);
      let txt = ""; try { txt = (await page.getTextContent()).items.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim(); } catch (e) {}
      let links = []; try { links = (await page.getAnnotations()).map((a) => a.url || a.unsafeUrl).filter((u) => /^https?:\/\//.test(u || "")); } catch (e) {}
      texts.push("— Page " + n + " —\n" + (txt || "(pas de texte)") + (links.length ? "\nLiens : " + [...new Set(links)].join(" ") : ""));
      if (opts.textOnly) { page.cleanup && page.cleanup(); continue; }
      const ops = await page.getOperatorList();
      let k = 0, failed = 0;
      for (let i = 0; i < ops.fnArray.length && images.length < MAX_IMG; i++) {
        if (!IMG.includes(ops.fnArray[i])) continue;
        const id = ops.argsArray[i][0];
        if (typeof id !== "string" || seen.has(id)) continue;
        seen.add(id);
        try {
          const store = id.indexOf("g_") === 0 ? page.commonObjs : page.objs;
          const img = await Promise.race([new Promise((res) => store.get(id, res)), new Promise((res) => setTimeout(() => res(null), 8000))]);
          if (!img || Math.min(img.width, img.height) < MIN_SIDE || img.width * img.height < 160000) continue;
          const cv = imgToCanvas(img);
          if (!cv) { failed++; continue; }
          if (isFlat(cv)) continue;
          const blob = await toJpeg(cv);
          if (blob) { k++; const f = new File([blob], base + " — p" + n + " — " + k + ".jpg", { type: "image/jpeg" }); f.page = n; images.push(f); }
        } catch (e) { failed++; }
      }
      if (!k && failed) {   // images illisibles une à une : on prend la page entière
        const v0 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: 1600 / Math.max(v0.width, v0.height) });
        const cv = document.createElement("canvas"); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
        const ctx = cv.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const blob = await toJpeg(cv);
        if (blob) { const f = new File([blob], base + " — p" + n + " — page.jpg", { type: "image/jpeg" }); f.page = n; images.push(f); }
      }
      page.cleanup && page.cleanup();
    }
    return { images, text: new File([texts.join("\n\n")], base + " — textes.txt", { type: "text/plain" }), pages: doc.numPages, kind: "pdf" };
  }

  async function fromPptx(file, onStep, opts) {
    opts = opts || {};
    await script(JSZIP);
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const slides = Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a, b) => +a.match(/(\d+)\.xml/)[1] - +b.match(/(\d+)\.xml/)[1]);
    const base = baseName(file.name), images = [], texts = [], seen = new Set();
    for (let s = 0; s < slides.length && images.length < MAX_IMG; s++) {
      const n = s + 1;
      onStep && onStep("Lecture de la diapo " + n + "/" + slides.length + "…");
      const xml = await zip.file(slides[s]).async("string");
      const txt = (xml.match(/<a:t>([^<]*)<\/a:t>/g) || []).map((t) => t.replace(/<\/?a:t>/g, "")).join(" ")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/\s+/g, " ").trim();
      const relsF = zip.file(slides[s].replace("slides/", "slides/_rels/") + ".rels");
      const rels = relsF ? await relsF.async("string") : "", map = {}, links = [];
      (rels.match(/<Relationship [^>]+>/g) || []).forEach((r) => { const id = (r.match(/Id="([^"]+)"/) || [])[1], t = (r.match(/Target="([^"]+)"/) || [])[1]; if (id && t) map[id] = t.replace(/&amp;/g, "&"); if (/hyperlink"/.test(r) && /^https?:/.test(t || "")) links.push(t.replace(/&amp;/g, "&")); });
      texts.push("— Page " + n + " —\n" + (txt || "(pas de texte)") + (links.length ? "\nLiens : " + [...new Set(links)].join(" ") : ""));
      if (!relsF || opts.textOnly) continue;
      const embeds = (xml.match(/r:embed="([^"]+)"/g) || []).map((x) => x.slice(9, -1));
      let k = 0;
      for (const rid of embeds) {
        const target = map[rid]; if (!target) continue;
        const path = "ppt/" + target.replace(/^\.\.\//, "");
        if (seen.has(path) || !/\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(path)) continue;
        seen.add(path);
        const f = zip.file(path); if (!f) continue;
        const blob0 = await f.async("blob");
        if (blob0.size < 20000) continue;
        try {
          const bmp = await createImageBitmap(blob0);
          if (Math.min(bmp.width, bmp.height) < MIN_SIDE) continue;
          const [w, h] = fit(bmp.width, bmp.height);
          const cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
          if (isFlat(cv)) continue;
          const blob = await toJpeg(cv);
          if (blob) { k++; const out = new File([blob], base + " — p" + n + " — " + k + ".jpg", { type: "image/jpeg" }); out.page = n; images.push(out); }
        } catch (e) {}
        if (images.length >= MAX_IMG) break;
      }
    }
    return { images, text: new File([texts.join("\n\n")], base + " — textes.txt", { type: "text/plain" }), pages: slides.length, kind: "pptx" };
  }

  function kindOf(file) {
    const n = String(file.name || "").toLowerCase();
    if (file.type === "application/pdf" || n.endsWith(".pdf")) return "pdf";
    if (/presentationml/.test(file.type) || n.endsWith(".pptx")) return "pptx";
    if (n.endsWith(".key")) return "key";
    return "";
  }
  async function deck(file, onStep, opts) {
    const k = kindOf(file);
    if (k === "pdf") return fromPdf(file, onStep, opts);
    if (k === "pptx") return fromPptx(file, onStep, opts);
    if (k === "key") throw new Error("Keynote : exportez d'abord en PDF ou PowerPoint (Fichier → Exporter vers).");
    return null;
  }
  // Photo trop lourde (iPhone, appareil photo) : réduite à 2400 px en JPEG avant l'envoi. Sinon, fichier inchangé.
  async function shrink(file) {
    try {
      if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type || "") || file.size < 900 * 1024) return file;
      const bmp = await createImageBitmap(file);
      const big = Math.max(bmp.width, bmp.height);
      if (big <= 2400 && file.size < 2.5 * 1024 * 1024 && !/heic|heif/i.test(file.type)) return file;
      const [w, h] = (function () { const k = Math.min(1, 2400 / big); return [Math.round(bmp.width * k), Math.round(bmp.height * k)]; })();
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(bmp, 0, 0, w, h);
      const blob = await toJpeg(cv);
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], String(file.name || "photo").replace(/\.[a-z0-9]{2,5}$/i, "") + ".jpg", { type: "image/jpeg" });
    } catch (e) { return file; }
  }
  // Exécute fn sur chaque élément, n à la fois.
  async function pool(items, n, fn) {
    const out = new Array(items.length); let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
    return out;
  }
  window.RumeurExtract = { deck, kindOf, shrink, pool };
})();
