/* Page client : sélection de lieux partagée par Rumeur (lien « lieux.html#<jeton> »).
   Aucune connexion : le jeton du lien donne accès à cette seule sélection. */
(function () {
  const API = (window.RUMEUR_CONFIG || {}).API_URL;
  const app = document.getElementById("app");
  const esc = (s) => String(s === undefined || s === null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const parts = () => decodeURIComponent(location.hash.replace(/^#/, "")).split("/");
  const token = parts()[0];
  const DEMO = token === "demo" || token === "demo-casting";
  let S = null, view = store.get("rumeur_lieux_view") || "grille", thumbs = { 480: {}, 1000: {}, 1600: {}, 2400: {} }, gi = 0;
  let visitor = store.get("rumeur_visitor");
  if (!visitor) { visitor = Math.random().toString(36).slice(2) + Date.now().toString(36); store.set("rumeur_visitor", visitor); }
  const WORDS = { lieux: { eyebrow: "Sélection de lieux", un: "lieu", des: "lieux", voir: "cliquez sur un lieu pour voir toutes les photos", jaime: "J'aime ce lieu", noted: "vous aimez ce lieu", prec: "Lieu précédent", suiv: "Lieu suivant", map: true },
    casting: { eyebrow: "Sélection casting", un: "talent", des: "talents", voir: "cliquez sur un talent pour voir toutes ses photos", jaime: "J'aime ce profil", noted: "vous aimez ce profil", prec: "Talent précédent", suiv: "Talent suivant", map: false },
    moodboard: { eyebrow: "Moodboard", un: "planche", des: "planches", voir: "cliquez sur une planche pour voir toutes les images", jaime: "J'aime", noted: "vous aimez cette planche", prec: "Planche précédente", suiv: "Planche suivante", map: false } };
  const W = () => WORDS[(S && S.type) || "lieux"] || WORDS.lieux;
  const liked = (id) => store.get("rumeur_like_" + token + "_" + id) === "1";

  // ───────── Serveur ─────────
  async function call(action, payload) {
    if (DEMO) return demo(action, payload);
    const r = await fetch(API, { method: "POST", body: JSON.stringify(Object.assign({ action, token }, payload || {})) });
    const d = await r.json();
    if (!d.ok) throw new Error(d.message || "Erreur");
    return d;
  }
  const queue = { 480: new Set(), 1000: new Set(), 1600: new Set(), 2400: new Set() };
  let pumping = 0;
  function want(id, size) { if (!id || thumbs[size][id]) return; queue[size].add(id); pump(); }
  async function pump() {
    while (pumping < 3) {
      const size = [1000, 1600, 2400, 480].find((s) => queue[s].size);
      if (!size) return;
      const ids = [...queue[size]].slice(0, size >= 1600 ? 2 : 6); ids.forEach((id) => queue[size].delete(id));
      pumping++;
      call("pub_thumbs", { ids, size }).then((d) => {
        Object.assign(thumbs[size], d.thumbs || {});
        Object.keys(d.thumbs || {}).forEach((id) => document.querySelectorAll(`img[data-id="${id}"][data-s="${size}"]`).forEach((im) => (im.src = d.thumbs[id])));
      }).catch(() => {}).finally(() => { pumping--; pump(); });
    }
  }
  function img(id, size, alt) { if (id) want(id, size); const src = id && (thumbs[size][id] || (size > 1600 && thumbs[1600][id]) || (size > 480 && thumbs[1000][id]) || thumbs[480][id]); return `<img data-id="${esc(id || "")}" data-s="${size}" alt="${esc(alt || "")}" ${src ? `src="${src}"` : ""} loading="lazy">`; }

  // ───────── Rendu ─────────
  const heartSvg = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  function label(i) { const p = S.prefixe === undefined ? "Option" : S.prefixe; return (p ? p + " " : "") + (i + 1); }
  function mapLink(l) { if (!W().map) return ""; const q = l.adresse || (l.zone ? l.nom + ", " + l.zone : ""); return q ? "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q) : ""; }
  function chips(l) {
    return [S.show_prix && l.prix ? `<span class="chip"><b>${esc(l.prix)}</b></span>` : "", l.dispo ? `<span class="chip">${esc(l.dispo)}</span>` : ""].join("");
  }
  function linksHtml(l) {
    const m = mapLink(l);
    const ls = (l.liens || []).map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u.replace(/^https?:\/\/(www\.)?/, "").split("/")[0])} ↗</a>`);
    if (m) ls.unshift(`<a href="${m}" target="_blank" rel="noopener noreferrer">Voir sur la carte ↗</a>`);
    return ls.length ? `<p class="links">${ls.join("")}</p>` : "";
  }
  function detailsHtml(l) { const k = Object.keys(l.details || {}); return k.length ? `<dl>${k.map((x) => `<dt>${esc(x)}</dt><dd>${esc(l.details[x])}</dd>`).join("")}</dl>` : ""; }
  function heartBtn(l, big) {
    const on = liked(l.id);
    return big ? `<button type="button" class="btn big-heart ${on ? "on" : ""}" data-like="${esc(l.id)}" aria-pressed="${on}">${heartSvg}${on ? "J'aime" : W().jaime}${l.likes ? ` · ${l.likes}` : ""}</button>`
      : `<button type="button" class="heart ${on ? "on" : ""}" data-like="${esc(l.id)}" aria-pressed="${on}" aria-label="J'aime ${esc(l.nom)}">${heartSvg}${l.likes ? `<span>${l.likes}</span>` : ""}</button>`;
  }
  function commentsHtml(l) {
    return `<div class="comments"><h3>Commentaires${(l.comments || []).length ? ` (${l.comments.length})` : ""}</h3>
      ${(l.comments || []).map((c) => `<p class="com"><b>${esc(c.nom)}</b> <span>${esc(new Date(c.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }))}</span><br>${esc(c.texte)}</p>`).join("")}
      <form class="cform" data-comment="${esc(l.id)}"><input name="nom" placeholder="Votre prénom" maxlength="60" value="${esc(store.get("rumeur_nom") || "")}" aria-label="Votre prénom"><textarea name="texte" placeholder="${(S.type || "lieux") === "lieux" ? "Une question, une préférence, une demande de visite…" : "Une question, une préférence, une remarque…"}" maxlength="1500" required aria-label="Commentaire"></textarea><div><button class="btn primary" type="submit">Envoyer à l'équipe Rumeur</button></div></form></div>`;
  }

  function render() {
    if (!S) return;
    const L = S.lieux;
    const pid = parts()[1];
    document.title = S.titre + " · Rumeur";
    document.body.dataset.type = S.type || "lieux";
    app.innerHTML = `
      <header class="top"><div class="in"><img src="img/rumeur-logo.png" alt="Rumeur">${S.contact && S.contact.email ? `<a class="contact" href="mailto:${esc(S.contact.email)}">${esc(S.contact.nom || "Contact")}</a>` : ""}</div></header>
      <main class="in">
        <section class="hero">
          <p class="eyebrow">${esc(W().eyebrow)}${S.client ? " · " + esc(S.client) : ""}</p>
          <h1>${esc(S.titre)}</h1>
          ${S.intro ? `<p class="intro">${esc(S.intro)}</p>` : ""}
        </section>
        <div class="bar"><span>${L.length} ${L.length > 1 ? W().des : W().un} · ${W().voir} · ♥ pour nous dire vos préférences</span>
          <span class="seg" role="group" aria-label="Affichage"><button type="button" data-view="grille" aria-pressed="${view === "grille"}">Grille</button><button type="button" data-view="detail" aria-pressed="${view === "detail"}">Détaillée</button></span></div>
        ${view === "grille" ? `<div class="grid">${L.map((l, i) => `<div>
            <button type="button" class="card" data-open="${esc(l.id)}" aria-label="Voir ${esc(l.nom)}"><div class="ph">${img(l.photos[0], 1000, l.nom)}<span class="num">${esc(label(i))}</span>${l.photos.length > 1 ? `<span class="nph">${l.photos.length} photos</span>` : ""}</div></button>
            <div class="cardt"><div><h2><a href="#${esc(token)}/${esc(l.id)}" style="color:inherit">${esc(l.nom)}</a></h2>${l.zone ? `<p>${esc(l.zone)}</p>` : ""}${S.show_prix && l.prix ? `<p class="price">${esc(l.prix)}</p>` : ""}</div>${heartBtn(l)}</div></div>`).join("")}</div>`
        : `<div class="long">${L.map((l, i) => `<article class="lrow">
            <div class="mos">${l.photos.slice(0, 7).map((p, k) => `<div class="ph" data-zoom="${esc(l.id)}:${k}">${img(p, k ? 480 : 1000, l.nom)}</div>`).join("")}</div>
            <div class="info"><p class="eyebrow">${esc(label(i))}</p><h2>${esc(l.nom)}</h2>${l.zone ? `<p class="zone">${esc(l.zone)}</p>` : ""}<div class="chips">${chips(l)}</div>
              ${l.description ? `<p class="desc">${esc(l.description)}</p>` : ""}${detailsHtml(l)}${linksHtml(l)}
              <div class="acts">${heartBtn(l, true)}<a href="#${esc(token)}/${esc(l.id)}">Toutes les photos et commentaires →</a></div></div></article>`).join("")}</div>`}
      </main>
      <footer><div class="in"><span>Sélection préparée par ${esc((S.contact && S.contact.nom) || "l'équipe")} — Rumeur, production créative, Paris.</span>${S.contact && S.contact.email ? `<a href="mailto:${esc(S.contact.email)}">${esc(S.contact.email)}</a>` : ""}</div></footer>
      ${pid ? sheet(pid) : ""}`;
    document.body.style.overflow = pid ? "hidden" : "";
  }

  function sheet(id) {
    const L = S.lieux, i = L.findIndex((l) => l.id === id);
    if (i < 0) return "";
    const l = L[i]; gi = Math.min(gi, Math.max(0, l.photos.length - 1));
    l.photos.forEach((p) => want(p, 480));
    if (l.photos[gi + 1]) want(l.photos[gi + 1], 1600);
    return `<div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(l.nom)}">
      <div class="sheet-h"><div class="in"><a href="#${esc(token)}" class="ib" aria-label="Fermer" style="text-decoration:none;color:inherit">×</a>
        <span class="nav"><button type="button" class="ib" data-go="${i - 1}" ${i ? "" : "disabled"} aria-label="${W().prec}">‹</button>${i + 1} / ${L.length}<button type="button" class="ib" data-go="${i + 1}" ${i < L.length - 1 ? "" : "disabled"} aria-label="${W().suiv}">›</button></span></div></div>
      <div class="in sheet-b"><div class="sgrid">
        <div class="gal">${l.photos.length ? `<div class="ph main" data-zoom="${esc(l.id)}:${gi}">${img(l.photos[gi], 1600, l.nom)}</div>
          ${l.photos.length > 1 ? `<div class="strip">${l.photos.map((p, k) => `<button type="button" data-gi="${k}" aria-current="${k === gi}" aria-label="Photo ${k + 1}">${img(p, 480, "")}</button>`).join("")}</div>` : ""}` : `<div class="ph main"></div>`}</div>
        <div class="info"><p class="eyebrow">${esc(label(i))}</p><h2>${esc(l.nom)}</h2>${l.zone ? `<p class="zone">${esc(l.zone)}</p>` : ""}<div class="chips">${chips(l)}</div>
          ${l.description ? `<p class="desc">${esc(l.description)}</p>` : ""}${detailsHtml(l)}${linksHtml(l)}
          <div class="acts">${heartBtn(l, true)}</div>${commentsHtml(l)}</div>
      </div></div></div>`;
  }

  function lightbox(lid, k) {
    const l = S.lieux.find((x) => x.id === lid); if (!l || !l.photos.length) return;
    let n = k;
    const box = document.createElement("div"); box.className = "lb"; box.setAttribute("role", "dialog"); box.setAttribute("aria-label", "Photos");
    const draw = () => {
      const big = (window.devicePixelRatio || 1) * Math.max(innerWidth, innerHeight) > 1700 ? 2400 : 1600;
      want(l.photos[n], big); if (l.photos[n + 1]) want(l.photos[n + 1], big);
      box.innerHTML = `${img(l.photos[n], big, l.nom)}<button type="button" class="ib x" aria-label="Fermer">×</button>${l.photos.length > 1 ? `<button type="button" class="ib p" aria-label="Précédente">‹</button><button type="button" class="ib n" aria-label="Suivante">›</button>` : ""}<div class="cnt">${esc(label(S.lieux.indexOf(l)))} · ${esc(l.nom)} · ${n + 1} / ${l.photos.length}</div>`;
    };
    const close = () => { box.remove(); document.removeEventListener("keydown", key); };
    const step = (d) => { n = (n + d + l.photos.length) % l.photos.length; draw(); };
    const key = (e) => { if (e.key === "Escape") close(); if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); };
    box.addEventListener("click", (e) => { if (e.target.closest(".x") || e.target === box) close(); else if (e.target.closest(".p")) step(-1); else if (e.target.closest(".n")) step(1); });
    let sx = null; box.addEventListener("touchstart", (e) => { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", (e) => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1); sx = null; });
    document.addEventListener("keydown", key);
    draw(); document.body.appendChild(box);
  }
  function toast(t) { const e = document.createElement("div"); e.className = "toast"; e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), 2600); }

  // ───────── Événements ─────────
  app.addEventListener("click", async (e) => {
    const q = (s) => e.target.closest(s);
    if (q("[data-view]")) { view = q("[data-view]").dataset.view; store.set("rumeur_lieux_view", view); render(); return; }
    if (q("[data-open]")) { gi = 0; location.hash = token + "/" + q("[data-open]").dataset.open; return; }
    if (q("[data-go]")) { const l = S.lieux[+q("[data-go]").dataset.go]; if (l) { gi = 0; location.hash = token + "/" + l.id; } return; }
    if (q("[data-gi]")) { gi = +q("[data-gi]").dataset.gi; const y = document.querySelector(".sheet").scrollTop; render(); document.querySelector(".sheet").scrollTop = y; return; }
    if (q("[data-zoom]")) { const [lid, k] = q("[data-zoom]").dataset.zoom.split(":"); lightbox(lid, +k); return; }
    const lk = q("[data-like]");
    if (lk) {
      const id = lk.dataset.like, l = S.lieux.find((x) => x.id === id), on = !liked(id);
      store.set("rumeur_like_" + token + "_" + id, on ? "1" : "0"); l.likes = Math.max(0, (l.likes || 0) + (on ? 1 : -1));
      const sh = document.querySelector(".sheet"), y = sh ? sh.scrollTop : 0; render(); if (sh) document.querySelector(".sheet").scrollTop = y;
      if (on) toast("Noté : l'équipe Rumeur verra que " + W().noted);
      try { await call("pub_feedback", { lieu: id, type: "like", visitor }); } catch (err) { toast(err.message); }
    }
  });
  app.addEventListener("submit", async (e) => {
    const f = e.target.closest("[data-comment]"); if (!f) return;
    e.preventDefault();
    const nom = f.nom.value.trim(), texte = f.texte.value.trim(); if (!texte) return;
    store.set("rumeur_nom", nom);
    const btn = f.querySelector("button"); btn.disabled = true; btn.textContent = "Envoi…";
    try {
      await call("pub_feedback", { lieu: f.dataset.comment, type: "comment", nom, texte, visitor });
      const l = S.lieux.find((x) => x.id === f.dataset.comment); (l.comments = l.comments || []).push({ nom: nom || "Client", texte, date: new Date().toISOString() });
      const y = document.querySelector(".sheet") ? document.querySelector(".sheet").scrollTop : 0; render(); if (document.querySelector(".sheet")) document.querySelector(".sheet").scrollTop = y;
      toast("Merci, l'équipe Rumeur a reçu votre commentaire");
    } catch (err) { toast(err.message); btn.disabled = false; btn.textContent = "Envoyer à l'équipe Rumeur"; }
  });
  document.addEventListener("keydown", (e) => {
    if (document.querySelector(".lb") || !parts()[1] || /input|textarea/i.test((e.target.tagName || ""))) return;
    if (e.key === "Escape") location.hash = token;
    const i = S.lieux.findIndex((l) => l.id === parts()[1]);
    if (e.key === "ArrowRight" && S.lieux[i + 1]) { gi = 0; location.hash = token + "/" + S.lieux[i + 1].id; }
    if (e.key === "ArrowLeft" && S.lieux[i - 1]) { gi = 0; location.hash = token + "/" + S.lieux[i - 1].id; }
  });
  window.addEventListener("hashchange", () => { if (parts()[0] !== token) location.reload(); else { render(); const sh = document.querySelector(".sheet"); if (sh) sh.scrollTop = 0; } });

  // ───────── Démarrage ─────────
  async function start() {
    if (!token) { app.innerHTML = `<div class="state"><div><h1>Lien incomplet.</h1><p>Demandez à l'équipe Rumeur de vous renvoyer le lien de la sélection.</p></div></div>`; return; }
    try {
      S = (await call("pub_sel", { view: !store.get("rumeur_seen_" + token) })).selection;
      store.set("rumeur_seen_" + token, "1");
      render();
    } catch (e) {
      app.innerHTML = `<div class="state"><div><h1>Sélection indisponible.</h1><p>${esc(e.message)}</p><p>Demandez à l'équipe Rumeur un nouveau lien.</p></div></div>`;
    }
  }

  // ───────── Démo (lieux.html#demo) ─────────
  function demo(action, p) {
    const pal = ["#b9a58f", "#8fa3b5", "#a9b88f", "#c4a28c", "#9d97b8", "#b7b09a", "#8f9e98"];
    if (action === "pub_sel" && token === "demo-casting") return Promise.resolve({ selection: { type: "casting", titre: "Casting — Campagne printemps (exemple)", client: "Maison exemple", intro: "Voici notre première sélection de talents. Dites-nous vos préférences avec ♥.", show_prix: true, prefixe: "", contact: { nom: "Alejandro", email: "contact@example.com" },
      lieux: [
        { id: "a", nom: "Inès Martin", zone: "Agence exemple", prix: "1 200 € / jour + droits 1 an", dispo: "14 et 15 nov.", description: "Visage lumineux, très à l'aise en mouvement ; déjà vue en campagne beauté.", details: { "Âge": "27", "Taille": "1,76 m", "Instagram": "@exemple (12 k)" }, photos: ["a1", "a2", "a3"], liens: [], likes: 1, comments: [] },
        { id: "b", nom: "Yanis Benali", zone: "Indépendant", prix: "900 € / jour", description: "Danseur contemporain, présence forte à l'image.", details: { "Âge": "31", "Taille": "1,84 m" }, photos: ["b1", "b2"], liens: [], likes: 0, comments: [] },
        { id: "c", nom: "Margaux Leroy", zone: "Agence exemple", prix: "", description: "Profil mode, cheveux courts, regard intense.", details: { "Âge": "24" }, photos: ["c1", "c2", "c3"], liens: [], likes: 0, comments: [] },
        { id: "d", nom: "Odile Faure", zone: "Agence exemple", prix: "1 000 € / jour", description: "68 ans, ancienne danseuse étoile.", details: {}, photos: ["d1"], liens: [], likes: 2, comments: [] },
      ] } });
    if (action === "pub_sel") return Promise.resolve({ selection: { titre: "Repérages — Campagne printemps (exemple)", client: "Maison exemple", intro: "Voici notre première sélection de lieux pour le tournage. Dites-nous vos préférences avec ♥ et laissez vos questions en commentaire.", show_prix: true, prefixe: "Option", contact: { nom: "Alejandro", email: "contact@example.com" },
      lieux: [
        { id: "a", nom: "Atelier d'artiste sous verrière", zone: "Paris 20e", prix: "1 500 € HT / jour", dispo: "Novembre", description: "Atelier de 150 m² baigné de lumière naturelle : murs blancs, parquet clair, grande hauteur sous charpente.", details: { Surface: "150 m²", Lumière: "Verrière nord" }, photos: ["a1", "a2", "a3", "a4"], liens: [], likes: 2, comments: [{ nom: "Claire", texte: "Très beau, la lumière est parfaite pour la séquence portrait.", date: new Date().toISOString() }] },
        { id: "b", nom: "Plateau industriel", zone: "Aubervilliers", prix: "2 000 € HT / jour", description: "Grand volume à poteaux, gaines apparentes, sol béton et baies vitrées sur toute la longueur.", details: { Surface: "1 500 m²" }, photos: ["b1", "b2", "b3"], liens: ["https://example.com/plateau"], likes: 0, comments: [] },
        { id: "c", nom: "Appartement haussmannien", zone: "Paris 8e", prix: "2 400 € HT / jour", description: "Enfilade de pièces, moulures, cheminées en marbre, parquet point de Hongrie.", details: {}, photos: ["c1", "c2"], liens: [], likes: 1, comments: [] },
        { id: "d", nom: "Piscine Art déco", zone: "Montreuil", prix: "", description: "Bassin carrelé des années 30, verrière et cabines d'origine.", details: {}, photos: ["d1", "d2", "d3"], liens: [], likes: 0, comments: [] },
      ] } });
    if (action === "pub_thumbs") { const out = {}; p.ids.forEach((id) => { const c = pal[(id.charCodeAt(0) + +id.slice(1)) % pal.length]; out[id] = "data:image/svg+xml;base64," + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="${c}"/><rect y="600" width="1200" height="300" fill="rgba(0,0,0,.14)"/><rect x="140" y="160" width="300" height="440" fill="rgba(255,255,255,.18)"/><circle cx="900" cy="250" r="90" fill="rgba(255,255,255,.5)"/></svg>`); }); return new Promise((r) => setTimeout(() => r({ thumbs: out }), 150)); }
    return Promise.resolve({ ok: true });
  }
  start();
})();
