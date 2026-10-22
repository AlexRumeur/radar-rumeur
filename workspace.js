/* Workspace projet — page « #ws-<code> » de l'espace équipe Rumeur.
   Dépôt (texte, liens, captures, photos, PDF) → l'assistant range en fiches par rubrique. */
(function () {
  const T = window.RumeurTeam;            // exposé par team.js : api, esc, toast, user, readB64, linkOf, go, ask
  if (!T) return;
  const { esc } = T;
  const ICON = { Brief: "📝", Lieux: "📍", Casting: "🎭", "Équipe & prestataires": "🤝", "Budget & devis": "💶", Planning: "🗓", Références: "🖼", Divers: "📎" };
  const ST_CLS = { "proposé": "", "en option": "warn", "retenu": "ok", "écarté": "dim", "à relancer": "hot", "info": "" };
  let ws = { code: "", data: null, loading: false, filter: "Toutes", pending: [], busy: false, thumbs: {}, big: {}, last: null, err: "" };

  function el() { return document.getElementById("v-workspace"); }

  async function load(code, force) {
    if (ws.loading) return;
    if (ws.code !== code) ws = { code, data: null, loading: false, filter: "Toutes", pending: [], busy: false, thumbs: {}, big: {}, last: null, err: "" };
    if (ws.data && !force) return;
    ws.loading = true; ws.err = "";
    try { ws.data = (await T.api("ws_get", { code })).data; }
    catch (e) { ws.err = e.message; }
    finally { ws.loading = false; render(); }
  }

  function render() {
    const root = el(); if (!root) return;
    const code = T.wsCodeFromHash();
    if (!code) { root.innerHTML = ""; return; }
    if (code !== ws.code || (!ws.data && !ws.loading && !ws.err)) { load(code); }
    if (!ws.data) {
      root.innerHTML = `<div class="in"><p class="back"><a href="#projets">← Projets</a></p>${ws.err ? `<div class="gate"><h2>Workspace indisponible.</h2><p>${esc(ws.err)}</p></div>` : `<div class="loading">Ouverture du workspace ${esc(code)}…</div>`}</div>`;
      return;
    }
    const d = ws.data, P = d.projet, items = d.items || [];
    const counts = {}; items.forEach(i => counts[i.rubrique] = (counts[i.rubrique] || 0) + 1);
    const rubs = d.rubriques.filter(r => counts[r]);
    if (ws.filter !== "Toutes" && !counts[ws.filter]) ws.filter = "Toutes";
    const shown = ws.filter === "Toutes" ? rubs : [ws.filter];
    const openItems = items.filter(i => /proposé|en option|à relancer/.test(i.statut));
    root.innerHTML = `<div class="in ws">
      <p class="back"><a href="#projets">← Projets</a></p>
      <header class="vhead">
        <p class="eyebrow">${esc(P.code)}</p>
        <h1>${esc(P.nom || P.code)}</h1>
        <p>${[P.client, P.equipe, P.statut].filter(Boolean).map(esc).join(" · ")}</p>
        <div class="row">
          <button type="button" class="btn ghost" data-ask="${esc("Fais le point sur le projet " + P.code + " à partir de son workspace : où on en est, ce qu'il reste à décider, et compare les propositions.")}">Faire le point</button>
          <button type="button" class="btn ghost" data-ask="${esc("Crée une présentation dans le modèle Rumeur pour le projet " + P.code + " avec les photos de son workspace (rubrique : …).")}" data-noauto="1">Prez depuis le workspace</button>
          ${T.linkOf(P.dossier, "Dossier Drive")} ${T.linkOf(P.workspace, "Tableau")}
          <button type="button" class="btn ghost small" data-ws-reload="1">Actualiser</button>
        </div>
      </header>

      ${ficheView(d.fiche, items)}

      <details class="howto"${items.length ? "" : " open"}>
        <summary>Comment ça marche ?</summary>
        <div class="howto-body">
          <ol>
            <li><b>Un dépôt = un sujet.</b> Un mail de lieux, le brief, une proposition de casting, un devis… Déposez-les séparément : le rangement est plus précis.</li>
            <li><b>Collez le texte tel quel</b> dans la zone ci-dessous : mail complet (avec la signature du prestataire), message WhatsApp, notes d'appel. Les liens collés sont ouverts et lus.</li>
            <li><b>Ajoutez les fichiers</b> : photos, PDF, Word. Bouton « Ajouter des fichiers », glisser-déposer, ou <b>Cmd+V</b> pour coller une capture d'écran (le texte de la capture est lu).</li>
            <li><b>Cliquez « Analyser et ranger »</b> et patientez 30 s à 1 min. L'assistant crée une fiche par lieu, talent, prestataire ou devis, avec photos, prix exact, infos clés, points forts et points à vérifier. Les fichiers sont rangés dans le Drive du projet (dossier WORKSPACE).</li>
            <li><b>Une nouvelle réponse sur un sujet existant</b> (nouveau prix, autres photos du même lieu) ? Déposez-la : la fiche existante est complétée, sans doublon.</li>
            <li><b>Décidez sur les fiches</b> : changez le statut (proposé → en option → retenu / écarté) et ajoutez une note pour l'équipe. Cliquez une photo pour l'agrandir. Dès qu'il y a deux propositions ou plus, un tableau comparatif apparaît.</li>
            <li><b>Pour aller plus loin</b>, « Faire le point » demande un récap à l'assistant, et « Prez depuis le workspace » prépare une présentation Rumeur avec les photos.</li>
          </ol>
          <p class="mini">Vérifiez toujours les prix et les dates importantes dans le message d'origine (en bas de chaque fiche) avant de vous engager. Rien n'est envoyé aux prestataires : le workspace sert seulement à ranger et décider.</p>
        </div>
      </details>

      <section class="wsdrop" id="ws-drop">
        <label for="ws-text" class="drop-h">Déposer dans le workspace</label>
        <textarea id="ws-text" rows="4" placeholder="Collez un mail, un message WhatsApp, un lien, des notes… et ajoutez photos, captures d'écran (Cmd+V) ou PDF. L'assistant lit tout et range en fiches."></textarea>
        <div class="pending" id="ws-pending">${ws.pending.map((f, i) => `<span class="tag ${f.status === "error" ? "hot" : ""}">${f.preview ? `<img src="${f.preview}" alt="">` : "📎"} ${esc(f.name)}${f.status === "uploading" ? " …" : ""}<button type="button" data-ws-unpend="${i}" aria-label="Retirer">×</button></span>`).join("")}</div>
        <div class="drop-bar">
          <span><button type="button" class="btn ghost small" id="ws-attach">Ajouter des fichiers</button> <span class="mini">ou glissez-les ici · captures : Cmd+V</span></span>
          <button type="button" class="btn primary" id="ws-go" ${ws.busy || ws.pending.some(f => f.status === "uploading") ? "disabled" : ""}>${ws.busy ? "L'assistant range… (30 s à 1 min)" : "Analyser et ranger"}</button>
        </div>
        <input type="file" id="ws-file" multiple hidden accept="image/*,application/pdf,.doc,.docx,.txt">
      </section>

      ${ws.last ? `<section class="lastdrop"><p><b>Dernier dépôt :</b> ${esc(ws.last.resume || "")}</p>
        ${ws.last.elements && ws.last.elements.length ? `<p class="mini">Fiches : ${ws.last.elements.map(esc).join(" · ")}</p>` : ""}
        ${ws.last.a_decider && ws.last.a_decider.length ? `<p class="mini"><b>À décider :</b></p><ul>${ws.last.a_decider.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}</section>` : ""}

      ${items.length ? `
      <div class="kpis">
        <div class="kpi"><b>${items.length}</b><span>fiches</span></div>
        <div class="kpi ${openItems.length ? "hot" : ""}"><b>${openItems.length}</b><span>propositions à trancher</span></div>
        <div class="kpi"><b>${items.filter(i => i.statut === "retenu").length}</b><span>retenues</span></div>
        <div class="kpi"><b>${(d.fil || []).length}</b><span>dépôts</span></div>
      </div>
      <div class="chips" style="justify-content:flex-start;margin-top:28px">${["Toutes"].concat(rubs).map(r => `<button type="button" class="chip" data-ws-filter="${esc(r)}" aria-pressed="${r === ws.filter}">${r === "Toutes" ? "Toutes" : (ICON[r] || "") + " " + esc(r)}<span class="n">${r === "Toutes" ? items.length : counts[r]}</span></button>`).join("")}</div>
      ${shown.map(r => section(r, items.filter(i => i.rubrique === r), d.statuts)).join("")}
      ` : `<div class="empty" style="margin-top:28px">Workspace vide. Déposez le premier mail, la première proposition ou le brief ci-dessus.</div>`}

      <section class="blk"><h3>Fil du projet <small>${(d.fil || []).length} dépôt(s)</small></h3>
        <ul class="list">${(d.fil || []).length ? d.fil.map(f => `<li><div class="main"><div class="t">${esc(f.resume)}</div><div class="s">${esc(f.elements || "")}</div></div><div class="side">${esc(f.date)}<br>${esc(String(f.par || "").split("@")[0])}</div></li>`).join("") : `<li class="empty-row">Aucun dépôt pour l'instant.</li>`}</ul>
      </section>
    </div>`;
    wire();
    fetchThumbs();
  }

  function ficheView(f, items) {
    if (!f || !Object.keys(f).length) {
      return `<section class="fiche empty-fiche"><p class="eyebrow">Le projet en un coup d'œil</p><p>Déposez le brief, la note d'intention ou le traitement ci-dessous : l'assistant en tire une fiche visuelle du projet (intention, thèmes, ton, personnages, lieux recherchés, planning, budget, équipe, questions ouvertes).</p></section>`;
    }
    const L = (a) => (Array.isArray(a) ? a.filter(Boolean) : []);
    const chips = (a, cls) => L(a).map(x => `<span class="fchip ${cls || ""}">${esc(x)}</span>`).join("");
    const nLieux = items.filter(i => i.rubrique === "Lieux").length, nCast = items.filter(i => i.rubrique === "Casting").length;
    const meta = [f.type, f.duree, f.cible ? "Cible : " + f.cible : ""].filter(Boolean);
    const block = (title, inner, cls) => inner ? `<div class="fblock ${cls || ""}"><h5>${esc(title)}</h5>${inner}</div>` : "";
    return `<section class="fiche">
      <p class="eyebrow">Le projet en un coup d'œil${f.maj ? ` <span class="mini">· mis à jour le ${esc(f.maj)}</span>` : ""}</p>
      ${f.logline ? `<h2 class="logline">${esc(f.logline)}</h2>` : ""}
      ${meta.length ? `<p class="fmeta">${meta.map(esc).join(" · ")}</p>` : ""}
      ${f.intention ? `<p class="intention">${esc(f.intention)}</p>` : ""}
      ${L(f.images).length ? `<div class="mood">${L(f.images).slice(0, 8).map(id => `<button type="button" class="ph" data-ws-photo="${esc(id)}" aria-label="Agrandir"><img data-thumb="${esc(id)}" alt="" ${ws.thumbs[id] ? `src="${ws.thumbs[id]}"` : ""}></button>`).join("")}</div>` : ""}
      <div class="fgrid">
        ${block("Thèmes", L(f.themes).length ? `<div class="fchips">${chips(f.themes)}</div>` : "")}
        ${block("Ton & univers", L(f.ton).length ? `<div class="fchips">${chips(f.ton, "alt")}</div>` : "")}
        ${block("Livrables", L(f.livrables).length ? `<ul>${L(f.livrables).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "")}
        ${block("Personnages" + (nCast ? ` · ${nCast} proposition(s) casting` : ""), L(f.personnages).length ? `<div class="persos">${L(f.personnages).map(p => `<div class="perso"><b>${esc(p.nom || "")}</b>${p.role ? `<span>${esc(p.role)}</span>` : ""}${p.description ? `<p>${esc(p.description)}</p>` : ""}</div>`).join("")}</div>` : "", "wide")}
        ${block("Lieux recherchés" + (nLieux ? ` · ${nLieux} proposé(s)` : ""), L(f.lieux_recherches).length ? `<ul>${L(f.lieux_recherches).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "")}
        ${block("Budget", f.budget ? `<p class="big-num">${esc(f.budget)}</p>` : "")}
        ${block("Équipe", L(f.equipe).length ? `<ul class="team">${L(f.equipe).map(e => `<li><b>${esc(e.nom || "")}</b> <span class="mini">${esc(e.role || "")}</span></li>`).join("")}</ul>` : "")}
        ${block("Planning", L(f.planning).length ? `<ol class="timeline">${L(f.planning).map(e => `<li><span class="tdate">${esc(e.date || "à caler")}</span><span>${esc(e.etape || "")}</span></li>`).join("")}</ol>` : "", "wide")}
        ${block("Références", L(f.references).length ? `<div class="fchips">${chips(f.references, "ref")}</div>` : "")}
        ${block("Questions ouvertes", L(f.questions_ouvertes).length ? `<ul class="vg">${L(f.questions_ouvertes).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : "", "warnblk")}
      </div>
    </section>`;
  }

  function section(rub, list, statuts) {
    const props = list.filter(i => i.statut !== "info");
    const compare = props.length >= 2 ? `<div class="cmp-wrap"><table class="cmp"><thead><tr><th>${esc(rub === "Casting" ? "Talent" : "Proposition")}</th><th>Prix</th><th>Statut</th><th>Points forts</th><th>Vigilance</th></tr></thead><tbody>${
      props.slice().sort((a, b) => (a.montant ?? 1e12) - (b.montant ?? 1e12)).map(i => `<tr class="${i.statut === "écarté" ? "dim" : ""}"><td><a href="#card-${esc(i.id)}" class="plain"><b>${esc(i.titre)}</b></a><br><span class="mini">${esc(i.prestataire || "")}</span></td><td>${esc(i.prix || "—")}</td><td><span class="tag ${ST_CLS[i.statut] || ""}">${esc(i.statut)}</span></td><td>${(i.points_forts || []).slice(0, 2).map(esc).join("<br>")}</td><td>${(i.vigilance || []).slice(0, 2).map(esc).join("<br>")}</td></tr>`).join("")
    }</tbody></table></div>` : "";
    return `<section class="blk"><h3>${ICON[rub] || ""} ${esc(rub)} <small>${list.length} fiche(s)</small></h3>${compare}
      <div class="wsgrid">${list.map(i => card(i, statuts)).join("")}</div></section>`;
  }

  function card(i, statuts) {
    const photos = i.photos || [];
    const det = Object.keys(i.details || {}).filter(k => i.details[k]);
    return `<article class="wcard ${i.statut === "écarté" ? "dim" : ""}" id="card-${esc(i.id)}">
      ${photos.length ? `<div class="gal ${photos.length > 1 ? "multi" : ""}">${photos.slice(0, 5).map((p, n) => `<button type="button" class="ph ${n === 0 ? "main" : ""}" data-ws-photo="${esc(p)}" data-ws-item="${esc(i.id)}" aria-label="Agrandir la photo"><img data-thumb="${esc(p)}" alt="" ${ws.thumbs[p] ? `src="${ws.thumbs[p]}"` : ""}></button>`).join("")}${photos.length > 5 ? `<span class="more-ph">+${photos.length - 5}</span>` : ""}</div>` : ""}
      <div class="wbody">
        <div class="whead"><h4>${esc(i.titre)}</h4>${i.prix ? `<span class="price">${esc(i.prix)}</span>` : ""}</div>
        ${i.prestataire ? `<p class="mini">${esc(i.prestataire)}</p>` : ""}
        ${i.resume ? `<p class="res">${esc(i.resume)}</p>` : ""}
        ${det.length ? `<dl class="det">${det.map(k => `<dt>${esc(k)}</dt><dd>${esc(i.details[k])}</dd>`).join("")}</dl>` : ""}
        ${(i.points_forts || []).length ? `<ul class="pf">${i.points_forts.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${(i.vigilance || []).length ? `<ul class="vg">${i.vigilance.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        ${(i.fichiers || []).length || (i.liens || []).length ? `<p class="links">${(i.fichiers || []).map((f, n) => `<a href="https://drive.google.com/file/d/${esc(f)}/view" target="_blank" rel="noopener">Document ${n + 1} ↗</a>`).join(" ")} ${(i.liens || []).map(u => /^https?:\/\//.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\/(www\.)?/, "").slice(0, 32))} ↗</a>` : "").join(" ")}</p>` : ""}
        <div class="wfoot">
          <select data-ws-status="${esc(i.id)}" aria-label="Statut de ${esc(i.titre)}">${statuts.map(s => `<option${s === i.statut ? " selected" : ""}>${esc(s)}</option>`).join("")}</select>
          <span class="mini">${esc(i.ajoute_le || "")} · ${esc(String(i.ajoute_par || "").split("@")[0])}</span>
        </div>
        <textarea class="notes" data-ws-notes="${esc(i.id)}" rows="1" placeholder="Note de l'équipe…">${esc(i.notes || "")}</textarea>
        ${i.source ? `<details class="src"><summary>Message d'origine</summary><pre>${esc(i.source)}</pre></details>` : ""}
      </div>
    </article>`;
  }

  async function fetchThumbs() {
    const imgs = [...document.querySelectorAll("#v-workspace img[data-thumb]")];
    const need = [...new Set(imgs.map(im => im.dataset.thumb).filter(id => !ws.thumbs[id]))];
    for (let k = 0; k < need.length; k += 12) {
      try {
        const out = (await T.api("ws_thumbs", { code: ws.code, ids: need.slice(k, k + 12), size: 520 })).thumbs || {};
        Object.assign(ws.thumbs, out);
        imgs.forEach(im => { if (out[im.dataset.thumb]) im.src = out[im.dataset.thumb]; });
      } catch (e) { break; }
    }
  }

  async function lightbox(id) {
    const box = document.createElement("div");
    box.className = "lightbox"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Photo");
    box.innerHTML = `<img alt="" src="${ws.big[id] || ws.thumbs[id] || ""}"><p class="mini">${ws.big[id] ? "" : "Chargement en haute définition…"}</p><a class="btn small" href="https://drive.google.com/file/d/${esc(id)}/view" target="_blank" rel="noopener">Ouvrir dans le Drive ↗</a>`;
    box.addEventListener("click", (e) => { if (e.target === box) box.remove(); });
    document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { box.remove(); document.removeEventListener("keydown", k); } });
    document.body.appendChild(box);
    if (!ws.big[id]) {
      try { const out = (await T.api("ws_thumbs", { code: ws.code, ids: [id], size: 1600 })).thumbs || {}; if (out[id]) { ws.big[id] = out[id]; const im = box.querySelector("img"); im.src = out[id]; box.querySelector("p").textContent = ""; } }
      catch (e) { box.querySelector("p").textContent = e.message; }
    }
  }

  async function addFiles(files) {
    for (const f of files) {
      if (f.size > 20 * 1024 * 1024) { T.toast(f.name + " : 20 Mo maximum"); continue; }
      const item = { name: f.name || "capture.png", status: "uploading", preview: "" };
      if (/^image\//.test(f.type)) { try { item.preview = URL.createObjectURL(f); } catch (e) {} }
      ws.pending.push(item); render();
      try {
        const data = await T.readB64(f);
        const out = await T.api("upload", { file: { name: item.name, mimeType: f.type || "application/octet-stream", data } });
        Object.assign(item, { id: out.file.id, status: "ok" });
      } catch (e) { item.status = "error"; T.toast(item.name + " : " + e.message); }
      render();
    }
  }

  function wire() {
    const root = el();
    const ta = document.getElementById("ws-text");
    if (ta && ws.draft !== undefined) { ta.value = ws.draft; }
    if (ta) {
      ta.addEventListener("input", () => { ws.draft = ta.value; });
      ta.addEventListener("paste", (e) => { const fs = [...(e.clipboardData && e.clipboardData.files || [])]; if (fs.length) { e.preventDefault(); addFiles(fs.map((f, n) => f.name && f.name !== "image.png" ? f : new File([f], "capture-" + Date.now() + "-" + n + ".png", { type: f.type }))); } });
    }
    const drop = document.getElementById("ws-drop");
    if (drop) {
      drop.addEventListener("dragover", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) { e.preventDefault(); drop.classList.add("over"); } });
      drop.addEventListener("dragleave", () => drop.classList.remove("over"));
      drop.addEventListener("drop", (e) => { drop.classList.remove("over"); if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); addFiles([...e.dataTransfer.files]); } });
    }
    const at = document.getElementById("ws-attach"); if (at) at.onclick = () => document.getElementById("ws-file").click();
    const fi = document.getElementById("ws-file"); if (fi) fi.onchange = (e) => { addFiles([...e.target.files]); e.target.value = ""; };
    const go = document.getElementById("ws-go");
    if (go) go.onclick = async () => {
      const text = (ws.draft || "").trim();
      const files = ws.pending.filter(f => f.status === "ok");
      if (!text && !files.length) { T.toast("Collez un texte ou ajoutez un fichier."); return; }
      ws.busy = true; render();
      try {
        const out = (await T.api("ws_ingest", { code: ws.code, text, files: files.map(f => ({ id: f.id, name: f.name })) })).data;
        ws.data = out; ws.last = out.dernier_depot; ws.pending = []; ws.draft = "";
        T.toast("Rangé : " + ((ws.last && ws.last.elements) || []).length + " fiche(s)");
      } catch (e) { T.toast(e.message); }
      finally { ws.busy = false; render(); }
    };
    if (root && !root.dataset.wired) {
      root.dataset.wired = "1";
      root.addEventListener("click", (e) => {
        const f = e.target.closest("[data-ws-filter]"); if (f) { ws.filter = f.dataset.wsFilter; render(); return; }
        const u = e.target.closest("[data-ws-unpend]"); if (u) { ws.pending.splice(+u.dataset.wsUnpend, 1); render(); return; }
        const p = e.target.closest("[data-ws-photo]"); if (p) { lightbox(p.dataset.wsPhoto); return; }
        if (e.target.closest("[data-ws-reload]")) { ws.data = null; ws.thumbs = ws.thumbs || {}; load(ws.code, true); render(); }
      });
      root.addEventListener("change", async (e) => {
        const s = e.target.closest("[data-ws-status]"); if (!s) return;
        const id = s.dataset.wsStatus, statut = s.value;
        const it = ws.data.items.find(x => x.id === id); if (it) it.statut = statut;
        try { await T.api("ws_update", { code: ws.code, id, statut }); T.toast("Statut : " + statut); render(); } catch (err) { T.toast(err.message); }
      });
      root.addEventListener("focusout", async (e) => {
        const n = e.target.closest("[data-ws-notes]"); if (!n) return;
        const it = ws.data.items.find(x => x.id === n.dataset.wsNotes); if (!it || (it.notes || "") === n.value) return;
        it.notes = n.value;
        try { await T.api("ws_update", { code: ws.code, id: it.id, notes: n.value }); T.toast("Note enregistrée"); } catch (err) { T.toast(err.message); }
      });
    }
  }

  T.renderWorkspace = render;
})();
// Si la page s'ouvre directement sur un workspace, l'afficher une fois ce fichier chargé.
(function () { const T = window.RumeurTeam; if (T && T.getUser() && T.current() === "workspace") T.renderWorkspace(); })();
