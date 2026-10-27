/* Sélections clients (lieux, casting, moodboard) à partager aux clients (page « #lieux » et éditeur « #sel-<id> »).
   Le producteur dépose une présentation (PDF / PowerPoint), des photos ou un mail d'agence : l'assistant
   en tire une fiche par lieu (nom, photos, prix, infos, liens). Il vérifie, puis publie un lien client. */
(function () {
  const T = window.RumeurTeam;
  if (!T) return;
  const { esc } = T;
  const SITE = location.origin + location.pathname.replace(/[^/]*$/, "");
  let st = { list: null, listLoading: false, sel: null, selId: "", loading: false, err: "", thumbs: {}, big: {}, busy: "", pending: [], draft: "", dirty: false, saving: false, open: {} };

  // Libellés par type de sélection
  const TYPES = {
    lieux: { label: "Lieux", un: "lieu", des: "lieux", prefixe: "Option", nom: "Nom du lieu", zone: "Zone", zonePh: "Ville, quartier", prix: "Prix", prixPh: "ex. 1 800 € HT / jour", adresse: "Adresse", adressePh: "Pour la carte (optionnel)", dispo: "Disponibilités", desc: "Description pour le client", details: "« Surface : 200 m² »", drop: "Glissez ici la présentation de repérages (PDF ou PowerPoint ; Keynote : exportez en PDF), des photos, ou collez le mail d'une agence de lieux avec ses liens.", titre: "Repérages — Campagne X", intro: "Ex. Voici notre première sélection de lieux pour le tournage du 14 novembre. Dites-nous vos préférences avec ♥ et vos commentaires." },
    casting: { label: "Casting", un: "talent", des: "talents", prefixe: "", nom: "Prénom Nom", zone: "Agence", zonePh: "Agence ou contact", prix: "Cachet", prixPh: "ex. 1 500 € / jour + droits 1 an", adresse: "Ville", adressePh: "Ville", dispo: "Disponibilités", desc: "Profil pour le client", details: "« Âge : 28 », « Taille : 1,78 m », « Instagram : @… »", drop: "Glissez ici la présentation casting (PDF ou PowerPoint), une planche de photos, des photos, ou collez le mail d'une agence avec les liens des books.", titre: "Casting — Campagne X", intro: "Ex. Voici notre première sélection casting. Dites-nous vos préférences avec ♥ et vos commentaires." },
    moodboard: { label: "Moodboard", un: "planche", des: "planches", prefixe: "", nom: "Titre de la planche (ex. Lumière)", zone: "Sous-titre", zonePh: "optionnel", prix: "", prixPh: "", adresse: "", adressePh: "", dispo: "", desc: "Texte d'intention", details: "« Référence : … »", drop: "Glissez ici la présentation d'intentions, le traitement ou des images de référence.", titre: "Moodboard — Campagne X", intro: "Ex. Voici les grandes intentions visuelles du projet." },
  };
  const TY = (s) => TYPES[(s && s.type) || "lieux"] || TYPES.lieux;

  function el() { return document.getElementById("v-lieux"); }
  function selIdFromHash() { const h = decodeURIComponent(location.hash.replace("#", "")); return h.indexOf("sel-") === 0 ? h.slice(4) : ""; }
  const publicLink = (s) => (s && s.token ? SITE + "lieux.html#" + s.token : "");
  const ago = (iso) => { if (!iso) return ""; const t = typeof iso === "number" ? iso : Date.parse(iso); const d = (Date.now() - t) / 1000; if (d < 3600) return Math.max(1, Math.round(d / 60)) + " min"; if (d < 86400) return Math.round(d / 3600) + " h"; if (d < 86400 * 7) return Math.round(d / 86400) + " j"; return new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); };

  function render() {
    const root = el(); if (!root) return;
    const id = selIdFromHash();
    if (id) return renderEditor(root, id);
    renderList(root);
  }

  // ───────── Liste ─────────
  async function loadList() {
    st.listLoading = true;
    try { st.list = (await T.api("sel_list")).selections || []; } catch (e) { st.err = e.message; st.list = st.list || []; }
    finally { st.listLoading = false; render(); }
  }
  function renderList(root) {
    if (!st.list && !st.listLoading) loadList();
    const L = st.list || [];
    root.innerHTML = `<div class="in sels">
      <header class="vhead"><p class="eyebrow">Sélections</p><h1>Sélections clients.</h1>
        <p>Déposez une présentation (repérages, casting, moodboard), des photos ou le mail d'une agence : l'assistant crée une page à partager au client, avec chaque lieu ou talent, ses photos, son prix et ses liens. Vous vérifiez, puis vous publiez le lien.</p>
        <div class="row"><button type="button" class="btn primary" data-sel-new="lieux">+ Lieux</button><button type="button" class="btn primary" data-sel-new="casting">+ Casting</button><button type="button" class="btn ghost" data-sel-new="moodboard">+ Moodboard</button>
        <button type="button" class="btn ghost" data-ask="Crée un lien client pour présenter ce casting : " data-noauto="1">Depuis le chat</button></div>
      </header>
      ${st.listLoading && !L.length ? `<div class="loading">Chargement…</div>` : ""}
      ${!st.listLoading && !L.length ? `<div class="empty">Aucune sélection pour l'instant. Créez la première, ou glissez une présentation dans le chat en demandant « crée un lien client pour ce casting » (ou ces lieux).</div>` : ""}
      <div class="selgrid">${L.map((s) => `<a class="selcard plain" href="#sel-${esc(s.id)}">
        <div class="selcard-top"><span><span class="tag">${esc(TY(s).label)}</span> <span class="tag ${s.publie ? "ok" : ""}">${s.publie ? "Publié" : "Brouillon"}</span></span><span class="mini">${esc(ago(s.maj))}</span></div>
        <h3>${esc(s.titre || "Sélection")}</h3>
        <p class="mini">${[s.client, s.code].filter(Boolean).map(esc).join(" · ") || "&nbsp;"}</p>
        <p class="selstats"><b>${s.n || 0}</b> ${esc(TY(s).des)}${s.publie ? ` · <b>${s.vues || 0}</b> vue(s) · <b>${s.retours || 0}</b> retour(s)` : ""}</p>
        <p class="mini">${esc(String(s.owner || "").split("@")[0])}</p></a>`).join("")}</div>
    </div>`;
    wire(root);
  }

  // ───────── Éditeur ─────────
  async function loadSel(id) {
    st.loading = true; st.err = "";
    try { st.sel = (await T.api("sel_get", { id })).selection; st.selId = id; st.dirty = false; }
    catch (e) { st.err = e.message; }
    finally { st.loading = false; render(); }
  }
  function renderEditor(root, id) {
    if (st.selId !== id) { st = Object.assign(st, { sel: null, selId: id, thumbs: st.thumbs, pending: [], draft: "", busy: "", err: "", open: {} }); loadSel(id); }
    const s = st.sel;
    if (!s) { root.innerHTML = `<div class="in"><p class="back"><a href="#lieux">← Sélections</a></p>${st.err ? `<div class="gate"><h2>Sélection indisponible.</h2><p>${esc(st.err)}</p></div>` : `<div class="loading">Ouverture…</div>`}</div>`; return; }
    const link = publicLink(s);
    const fb = s.retours || [];
    const likes = {}, comments = {};
    fb.forEach((r) => { if (r.type === "like") likes[r.lieu] = (likes[r.lieu] || 0) + 1; if (r.type === "comment") (comments[r.lieu] = comments[r.lieu] || []).push(r); });
    const shown = s.lieux.filter((l) => !l.masque).length;
    const projets = (T.getDash && T.getDash() && T.getDash().projets) || [];
    const ty = TY(s);
    root.innerHTML = `<div class="in seled">
      <p class="back"><a href="#lieux">← Sélections</a> <span class="tag">${esc(ty.label)}</span></p>
      <header class="sel-head">
        <input class="sel-title" data-f="titre" value="${esc(s.titre)}" aria-label="Titre de la sélection" placeholder="Titre (ex. ${esc(ty.titre)})">
        <div class="sel-meta">
          <label>Client<input data-f="client" value="${esc(s.client || "")}" placeholder="Nom du client"></label>
          <label>Projet<input data-f="code" value="${esc(s.code || "")}" placeholder="Code projet" list="sel-codes"></label>
          <datalist id="sel-codes">${projets.map((p) => `<option value="${esc(p["Code projet"] || "")}">${esc(p["Nom du projet"] || "")}</option>`).join("")}</datalist>
          <label class="pref">Numérotation<input data-f="prefixe" value="${esc(s.prefixe === undefined ? ty.prefixe : s.prefixe)}" placeholder="vide = numéro seul" title="Affiché devant le numéro : « Option 1 », « Décor 1 »… Vide = numéro seul"></label>
          ${ty.prix ? `<label class="chk"><input type="checkbox" data-f="show_prix" ${s.show_prix !== false ? "checked" : ""}> Montrer les ${ty === TYPES.casting ? "cachets" : "prix"} au client</label>` : ""}
        </div>
        <label class="sel-intro">Mot d'introduction pour le client<textarea data-f="intro" rows="2" placeholder="${esc(ty.intro)}">${esc(s.intro || "")}</textarea></label>
      </header>

      <section class="pubbar ${s.publie ? "on" : ""}">
        <div>${s.publie
          ? `<b>Lien client publié</b> · ${s.vues || 0} vue(s)${s.derniere_vue ? ", dernière il y a " + esc(ago(s.derniere_vue)) : ""} · ${fb.filter((r) => r.type === "like").length} ♥ · ${fb.filter((r) => r.type === "comment").length} commentaire(s)<div class="linkrow"><input readonly value="${esc(link)}" aria-label="Lien client" id="sel-link"><button type="button" class="btn small primary" data-sel-copy="1">Copier le lien</button><a class="btn small ghost" href="${esc(link)}" target="_blank" rel="noopener">Voir comme le client ↗</a></div>`
          : `<b>Brouillon</b> · ${shown} ${esc(ty.des)} visibles. Vérifiez noms, prix et photos, puis publiez : le client n'a pas besoin de compte.`}</div>
        <div class="pubbtns">${s.publie ? `<button type="button" class="btn small ghost" data-sel-unpub="1">Dépublier</button>` : `<button type="button" class="btn primary" data-sel-pub="1" ${shown ? "" : "disabled"}>Publier le lien client</button>`}
          <span class="mini savestate">${st.saving ? "Enregistrement…" : st.dirty ? "Modifications non enregistrées" : "Enregistré"}</span></div>
      </section>

      <section class="wsdrop seldrop" id="sel-drop">
        <label for="sel-text" class="drop-h">${s.lieux.length ? "Ajouter des " + esc(ty.des) : "Importer la présentation"} <span class="mini">— une présentation déposée est analysée automatiquement, puis les photos HD sont cherchées sur les liens</span></label>
        <textarea id="sel-text" rows="3" placeholder="${esc(ty.drop)}">${esc(st.draft)}</textarea>
        <div class="pending">${st.pending.map((f, i) => `<span class="tag ${f.status === "error" ? "hot" : ""}">${f.preview ? `<img src="${f.preview}" alt="">` : "📎"} ${esc(f.label || f.name)}${f.status === "uploading" ? " …" : ""}<button type="button" data-sel-unpend="${i}" aria-label="Retirer">×</button></span>`).join("")}</div>
        ${st.busy ? `<p class="busy">${esc(st.busy)}</p>` : ""}
        <div class="drop-bar">
          <span><button type="button" class="btn ghost small" data-sel-attach="1">Ajouter des fichiers</button>
          ${projets.length ? `<select data-sel-ws aria-label="Importer depuis un workspace projet"><option value="">Importer d'un workspace projet…</option>${projets.map((p) => `<option value="${esc(p["Code projet"] || "")}">${esc((p["Code projet"] || "") + " — " + (p["Nom du projet"] || ""))}</option>`).join("")}</select>` : ""}</span>
          <button type="button" class="btn primary" data-sel-analyze="1" ${st.busy || st.pending.some((f) => f.status === "uploading") ? "disabled" : ""}>Analyser et créer les fiches</button>
        </div>
        <input type="file" id="sel-file" multiple hidden accept="application/pdf,.pptx,.key,image/*,.txt,.doc,.docx">
        <input type="file" id="sel-photo" multiple hidden accept="image/*">
      </section>

      ${s.lieux.length ? `<div class="sel-tools"><h3>${s.lieux.length} ${esc(ty.des)}</h3>${s.lieux.some((l) => (l.liens || []).length) ? `<button type="button" class="btn small ghost" data-sel-hd="1" ${st.busy ? "disabled" : ""}>Photos HD depuis les liens</button>` : ""}<span class="mini">La première photo est la couverture. Glissez les photos pour les réordonner, ou cliquez ★ pour en faire la couverture.</span></div>` : ""}
      <div class="lieux-ed">${s.lieux.map((l, i) => lieuCard(l, i, s.lieux.length, likes[l.id] || 0, comments[l.id] || [])).join("")}</div>

      <p class="mini" style="margin-top:28px"><button type="button" class="linkbtn danger" data-sel-del="1">Supprimer cette sélection</button></p>
    </div>`;
    wire(root);
    fetchThumbs();
  }

  function lieuCard(l, i, n, nLikes, comms) {
    const ph = l.photos || [], ty = TY(st.sel);
    const fld = (k, lab, phd) => lab ? `<label>${esc(lab)}<input data-l="${i}" data-k="${k}" value="${esc(l[k] || "")}" placeholder="${esc(phd || "optionnel")}"></label>` : "";
    return `<article class="led ${l.masque ? "dim" : ""}" data-i="${i}">
      <div class="led-photos" data-photos="${i}">
        ${ph.map((p, k) => `<figure class="lph ${k === 0 ? "lph-main" : ""}" draggable="true" data-ph="${i}:${k}"><img data-thumb="${esc(p)}" data-big="${k === 0 ? 1 : ""}" alt="" ${(k === 0 && st.big[p]) || st.thumbs[p] ? `src="${(k === 0 && st.big[p]) || st.thumbs[p]}"` : ""}><div class="lph-b">${k ? `<button type="button" data-ph-cover="${i}:${k}" title="Mettre en couverture" aria-label="Mettre en couverture">★</button>` : `<span>Couverture</span>`}<button type="button" data-ph-del="${i}:${k}" title="Retirer la photo" aria-label="Retirer la photo">×</button></div></figure>`).join("")}
        <button type="button" class="lph add" data-ph-add="${i}">+ Photo</button>
      </div>
      <div class="led-body">
        <div class="led-row"><span class="led-n" title="${esc(((st.sel.prefixe === undefined ? ty.prefixe : st.sel.prefixe) + " " + (i + 1)).trim())}">${i + 1}</span><input class="led-name" data-l="${i}" data-k="nom" value="${esc(l.nom)}" placeholder="${esc(ty.nom)}" aria-label="${esc(ty.nom)}"></div>
        <div class="led-grid">
          ${fld("zone", ty.zone, ty.zonePh)}${fld("prix", ty.prix, ty.prixPh)}${fld("adresse", ty.adresse, ty.adressePh)}${fld("dispo", ty.dispo, "optionnel")}
        </div>
        <label>${esc(ty.desc)}<textarea data-l="${i}" data-k="description" rows="3">${esc(l.description || "")}</textarea></label>
        <label>Infos clés <span class="mini">(une par ligne, ${esc(ty.details)})</span><textarea data-l="${i}" data-k="details" rows="2">${esc(Object.keys(l.details || {}).map((k) => k + " : " + l.details[k]).join("\n"))}</textarea></label>
        <label>Liens <span class="mini">(${ty === TYPES.casting ? "book, agence, Instagram" : "galerie, site, Google Maps"} — un par ligne)</span><textarea data-l="${i}" data-k="liens" rows="1">${esc((l.liens || []).join("\n"))}</textarea></label>
        <label class="internal">Note interne <span class="mini">(jamais montrée au client)</span><textarea data-l="${i}" data-k="note_interne" rows="1">${esc(l.note_interne || "")}</textarea></label>
        ${nLikes || comms.length ? `<div class="led-fb"><b>Retours client :</b> ${nLikes ? `♥ ${nLikes}` : ""}${comms.map((c) => `<p><b>${esc(c.nom || "Client")}</b> <span class="mini">${esc(ago(c.date))}</span><br>${esc(c.texte)}</p>`).join("")}</div>` : ""}
        <div class="led-foot">
          <span><button type="button" class="iconbtn" data-l-move="${i}:-1" ${i ? "" : "disabled"} title="Monter" aria-label="Monter">↑</button><button type="button" class="iconbtn" data-l-move="${i}:1" ${i < n - 1 ? "" : "disabled"} title="Descendre" aria-label="Descendre">↓</button></span>
          ${(l.liens || []).length ? `<button type="button" class="linkbtn" data-l-hd="${esc(l.id)}" ${st.busy ? "disabled" : ""}>Photos HD du lien</button>` : ""}
          <label class="chk"><input type="checkbox" data-l="${i}" data-k="masque" ${l.masque ? "checked" : ""}> Masquer au client</label>
          <button type="button" class="linkbtn danger" data-l-del="${i}">Supprimer</button>
        </div>
      </div>
    </article>`;
  }

  // ───────── Vignettes ─────────
  async function fetchThumbs() {
    // couvertures en 900 px (écrans Retina), le reste en 480
    const bigs = [...document.querySelectorAll("#v-lieux img[data-big='1']")].map((im) => im.dataset.thumb).filter((id) => !st.big[id]);
    for (let k = 0; k < bigs.length; k += 6) {
      try { const out = (await T.api("sel_thumbs", { id: st.selId, ids: bigs.slice(k, k + 6), size: 900 })).thumbs || {}; Object.assign(st.big, out); document.querySelectorAll("#v-lieux img[data-big='1']").forEach((im) => { if (out[im.dataset.thumb]) im.src = out[im.dataset.thumb]; }); } catch (e) { break; }
    }
    const imgs = [...document.querySelectorAll("#v-lieux img[data-thumb]:not([data-big='1'])")];
    const need = [...new Set(imgs.map((im) => im.dataset.thumb).filter((id) => !st.thumbs[id]))];
    for (let k = 0; k < need.length; k += 12) {
      try {
        const out = (await T.api("sel_thumbs", { id: st.selId, ids: need.slice(k, k + 12), size: 480 })).thumbs || {};
        Object.assign(st.thumbs, out);
        document.querySelectorAll("#v-lieux img[data-thumb]").forEach((im) => { if (out[im.dataset.thumb]) im.src = out[im.dataset.thumb]; });
      } catch (e) { break; }
    }
  }

  // ───────── Enregistrement ─────────
  let saveT = null;
  function markDirty(now) { st.dirty = true; updSaveState(); clearTimeout(saveT); saveT = setTimeout(save, now ? 0 : 1200); }
  function updSaveState() { const e = document.querySelector("#v-lieux .savestate"); if (e) e.textContent = st.saving ? "Enregistrement…" : st.dirty ? "Modifications non enregistrées" : "Enregistré"; }
  async function save() {
    if (!st.sel || st.saving) { if (st.saving) saveT = setTimeout(save, 800); return; }
    st.saving = true; updSaveState();
    const s = st.sel;
    try {
      const out = (await T.api("sel_save", { id: s.id, titre: s.titre, client: s.client, code: s.code, intro: s.intro, show_prix: s.show_prix !== false, prefixe: s.prefixe === undefined ? "Option" : s.prefixe, lieux: s.lieux })).selection;
      // garde l'état local (saisie en cours) mais reprend les photos validées par le serveur
      out.lieux.forEach((l, i) => { if (s.lieux[i]) s.lieux[i].photos = l.photos, s.lieux[i].id = l.id; });
      st.dirty = false;
    } catch (e) { T.toast("Enregistrement impossible : " + e.message); }
    finally { st.saving = false; updSaveState(); }
  }
  async function flush() { clearTimeout(saveT); if (st.dirty) await save(); }

  // ───────── Dépôt et analyse ─────────
  async function upload(f, extra) {
    const item = Object.assign({ name: f.name || "photo.jpg", status: "uploading", preview: "" }, extra || {});
    if (/^image\//.test(f.type) && !item.hidden) { try { item.preview = URL.createObjectURL(f); } catch (e) {} }
    st.pending.push(item);
    try {
      const g = window.RumeurExtract && /^image\//.test(f.type || "") ? await window.RumeurExtract.shrink(f) : f;
      const out = await T.api("upload", { file: { name: g.name || item.name, mimeType: g.type || "application/octet-stream", data: await T.readB64(g) } });
      Object.assign(item, { id: out.file.id, status: "ok" });
    } catch (e) { item.status = "error"; T.toast(item.name + " : " + e.message); }
    return item;
  }
  async function addFiles(files) {
    for (const f of files) {
      if (f.size > 60 * 1024 * 1024) { T.toast(f.name + " : 60 Mo maximum"); continue; }
      const kind = window.RumeurExtract && window.RumeurExtract.kindOf(f);
      if (kind) {
        try {
          st.busy = "Lecture de " + f.name + "…"; render();
          const r = await window.RumeurExtract.deck(f, (t) => { st.busy = f.name + " : " + t; const b = document.querySelector("#v-lieux .busy"); if (b) b.textContent = st.busy; });
          if (f.size < 20 * 1024 * 1024 && kind === "pdf") { await upload(f, { label: f.name }); }
          if (r.text) await upload(r.text, { label: "textes de " + f.name, hidden: true });
          const head = { name: f.name, label: r.images.length + " photo(s) extraites de " + f.name + " (" + r.pages + " pages)", status: "uploading", group: [] };
          st.pending.push(head);
          let done = 0;
          for (let k = 0; k < r.images.length; k += 4) {
            const ids = await Promise.all(r.images.slice(k, k + 4).map(async (im) => {
              try { return (await T.api("upload", { file: { name: im.name, mimeType: "image/jpeg", data: await T.readB64(im) } })).file.id; } catch (e) { return null; }
            }));
            ids.filter(Boolean).forEach((id) => head.group.push(id)); done += ids.length;
            st.busy = "Envoi des photos " + done + "/" + r.images.length + "…"; const b = document.querySelector("#v-lieux .busy"); if (b) b.textContent = st.busy;
          }
          head.status = "ok";
          if (!r.images.length) T.toast("Aucune photo trouvée dans " + f.name + " : le texte sera quand même analysé.");
        } catch (e) { T.toast(f.name + " : " + e.message); }
        st.busy = ""; render();
        st.autoGo = true;
      } else { await upload(f); render(); }
    }
    // Présentation déposée : on lance l'analyse tout de suite (le texte éventuel est pris aussi).
    if (st.autoGo && !st.pending.some((x) => x.status === "uploading")) { st.autoGo = false; analyze(); }
  }
  function pendingIds() {
    const ids = [];
    st.pending.filter((f) => f.status === "ok").forEach((f) => { if (f.id) ids.push({ id: f.id, name: f.name }); (f.group || []).forEach((id) => ids.push({ id, name: "photo" })); });
    return ids;
  }
  async function analyze() {
    const text = (st.draft || "").trim(), files = pendingIds();
    if (!text && !files.length) { T.toast("Déposez une présentation, des photos ou un texte."); return; }
    await flush();
    st.busy = "L'assistant lit la présentation et crée les fiches (30 s à 2 min)…"; render();
    try {
      st.sel = (await T.api("sel_analyze", { id: st.sel.id, files, text })).selection;
      st.pending = []; st.draft = ""; st.dirty = false;
      T.toast(st.sel.lieux.length + " " + TY(st.sel).des + " dans la sélection");
    } catch (e) { T.toast(e.message); st.busy = ""; render(); return; }
    st.busy = ""; render();
    // Automatique : si des lieux ont un lien, on va chercher leurs photos en haute définition.
    if (st.sel.lieux.some((l) => (l.liens || []).length)) await fetchHd("");
  }
  async function fetchHd(lieu) {
    await flush();
    st.busy = (lieu ? "Recherche des photos HD sur le lien…" : "Recherche des photos en haute définition sur les liens (1 à 2 min)…"); render();
    try {
      const r = await T.api("sel_hd", { id: st.sel.id, lieu: lieu || "" });
      st.sel = r.selection; st.dirty = false;
      T.toast(r.message || "Terminé");
    } catch (e) { T.toast(e.message); }
    finally { st.busy = ""; render(); }
  }
  async function importWs(code) {
    if (!code) return;
    await flush();
    st.busy = "Import du workspace " + code + "…"; render();
    try { st.sel = (await T.api("sel_from_ws", { id: st.sel.id, code })).selection; T.toast("Import terminé"); }
    catch (e) { T.toast(e.message); }
    finally { st.busy = ""; render(); }
  }

  // ───────── Événements ─────────
  let photoFor = -1, drag = null;
  function wire(root) {
    const s = st.sel;
    const ta = document.getElementById("sel-text");
    if (ta) ta.oninput = () => { st.draft = ta.value; };
    const drop = document.getElementById("sel-drop");
    if (drop) {
      drop.ondragover = (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); drop.classList.add("over"); } };
      drop.ondragleave = () => drop.classList.remove("over");
      drop.ondrop = (e) => { drop.classList.remove("over"); if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); addFiles([...e.dataTransfer.files]); } };
    }
    if (ta) ta.onpaste = (e) => { const fs = [...(e.clipboardData && e.clipboardData.files || [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } };
    const fi = document.getElementById("sel-file"); if (fi) fi.onchange = (e) => { const fs = [...e.target.files]; e.target.value = ""; addFiles(fs); };
    const pf = document.getElementById("sel-photo");
    if (pf) pf.onchange = async (e) => {
      const fs = [...e.target.files].filter((f) => /^image\//.test(f.type)); e.target.value = "";
      const i = photoFor; if (i < 0 || !fs.length) return;
      T.toast("Envoi de " + fs.length + " photo(s)…");
      for (const f0 of fs) { try { const f = window.RumeurExtract ? await window.RumeurExtract.shrink(f0) : f0; const id = (await T.api("upload", { file: { name: f.name, mimeType: f.type, data: await T.readB64(f) } })).file.id; s.lieux[i].photos.push(id); try { st.thumbs[id] = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); }); } catch (x) {} } catch (err) { T.toast(err.message); } }
      markDirty(true); render();
    };
    if (root.dataset.wired) return;
    root.dataset.wired = "1";
    root.addEventListener("input", (e) => {
      const t = e.target, S = st.sel; if (!S) return;
      if (t.dataset.f) { S[t.dataset.f] = t.type === "checkbox" ? t.checked : t.value; markDirty(); return; }
      if (t.dataset.l !== undefined) {
        const l = S.lieux[+t.dataset.l], k = t.dataset.k;
        if (k === "masque") { l.masque = t.checked; markDirty(); render(); return; }
        if (k === "liens") l.liens = t.value.split(/\s*\n\s*/).filter(Boolean);
        else if (k === "details") { const d = {}; t.value.split(/\n/).forEach((ln) => { const m = ln.match(/^\s*([^:]{1,60})\s*:\s*(.+)$/); if (m) d[m[1].trim()] = m[2].trim(); }); l.details = d; }
        else l[k] = t.value;
        markDirty();
      }
    });
    root.addEventListener("change", (e) => {
      const t = e.target;
      if (t.matches("[data-sel-ws]")) { importWs(t.value); t.value = ""; }
      if (t.dataset.f === "show_prix") { st.sel.show_prix = t.checked; markDirty(true); }
    });
    root.addEventListener("click", async (e) => {
      const q = (a) => e.target.closest(a);
      const S = st.sel;
      if (q("[data-sel-new]")) { const type = q("[data-sel-new]").dataset.selNew || "lieux"; try { const s2 = (await T.api("sel_create", { type })).selection; st.list = null; location.hash = "sel-" + s2.id; } catch (err) { T.toast(err.message); } return; }
      if (!S) return;
      if (q("[data-sel-attach]")) return document.getElementById("sel-file").click();
      if (q("[data-sel-unpend]")) { st.pending.splice(+q("[data-sel-unpend]").dataset.selUnpend, 1); return render(); }
      if (q("[data-sel-analyze]")) return analyze();
      if (q("[data-sel-hd]")) return fetchHd("");
      if (q("[data-l-hd]")) return fetchHd(q("[data-l-hd]").dataset.lHd);
      if (q("[data-sel-copy]")) { const v = publicLink(S); try { await navigator.clipboard.writeText(v); T.toast("Lien copié"); } catch (err) { const i = document.getElementById("sel-link"); i.select(); T.toast("Copiez le lien sélectionné"); } return; }
      if (q("[data-sel-pub]")) { await flush(); try { st.sel = (await T.api("sel_publish", { id: S.id })).selection; st.list = null; T.toast("Lien client publié"); render(); } catch (err) { T.toast(err.message); } return; }
      if (q("[data-sel-unpub]")) { try { st.sel = (await T.api("sel_publish", { id: S.id, publie: false })).selection; st.list = null; T.toast("Le lien ne fonctionne plus pour le client"); render(); } catch (err) { T.toast(err.message); } return; }
      if (q("[data-sel-del]")) { if (!q("[data-sel-del]").dataset.sure) { const b = q("[data-sel-del]"); b.dataset.sure = "1"; b.textContent = "Confirmer la suppression (le lien client ne marchera plus)"; return; } try { await T.api("sel_delete", { id: S.id }); st.list = null; st.sel = null; st.selId = ""; location.hash = "lieux"; } catch (err) { T.toast(err.message); } return; }
      const mv = q("[data-l-move]"); if (mv) { const [i, d] = mv.dataset.lMove.split(":").map(Number); const a = S.lieux; [a[i], a[i + d]] = [a[i + d], a[i]]; markDirty(true); return render(); }
      const dl = q("[data-l-del]"); if (dl) { const b = dl; if (!b.dataset.sure) { b.dataset.sure = "1"; b.textContent = "Confirmer"; return; } S.lieux.splice(+b.dataset.lDel, 1); markDirty(true); return render(); }
      const pc = q("[data-ph-cover]"); if (pc) { const [i, k] = pc.dataset.phCover.split(":").map(Number); const p = S.lieux[i].photos; p.unshift(p.splice(k, 1)[0]); markDirty(true); return render(); }
      const pd = q("[data-ph-del]"); if (pd) { const [i, k] = pd.dataset.phDel.split(":").map(Number); S.lieux[i].photos.splice(k, 1); markDirty(true); return render(); }
      const pa = q("[data-ph-add]"); if (pa) { photoFor = +pa.dataset.phAdd; return document.getElementById("sel-photo").click(); }
    });
    // Glisser-déposer des photos (dans un lieu ou d'un lieu à l'autre)
    root.addEventListener("dragstart", (e) => { const f = e.target.closest("[data-ph]"); if (!f) return; drag = f.dataset.ph.split(":").map(Number); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", "ph"); });
    root.addEventListener("dragover", (e) => { if (drag && e.target.closest("[data-photos]")) e.preventDefault(); });
    root.addEventListener("drop", (e) => {
      if (!drag) return;
      const box = e.target.closest("[data-photos]"); if (!box) return;
      e.preventDefault();
      const S = st.sel, [i, k] = drag, j = +box.dataset.photos;
      const over = e.target.closest("[data-ph]"); const to = over ? +over.dataset.ph.split(":")[1] : S.lieux[j].photos.length;
      const id = S.lieux[i].photos.splice(k, 1)[0];
      S.lieux[j].photos.splice(i === j && to > k ? to - 1 : to, 0, id);
      drag = null; markDirty(true); render();
    });
    root.addEventListener("dragend", () => { drag = null; });
  }

  T.renderLieux = render;
  T.selFlush = flush;
  window.addEventListener("beforeunload", (e) => { if (st.dirty) { save(); e.preventDefault(); e.returnValue = ""; } });
})();
(function () { const T = window.RumeurTeam; if (T && T.getUser() && T.current() === "lieux") T.renderLieux(); })();
