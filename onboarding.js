/* Bienvenue (« #bienvenue ») : le guide d'onboarding interactif de RUMEUR, en quatre parties.
   1. Présentation · 2. L'équipe · 3. Premiers jours & outils · 4. Organisation du travail.
   Chaque partie se marque « lue » ; la partie 3 a ses cases à cocher (premiers jours, accès aux outils).
   L'avancement vient du backend (action onb_get / onb_check) ; tant que le backend ne connaît pas encore
   ces actions, il reste dans ce navigateur. */
(function () {
  const T = window.RumeurTeam;
  if (!T) return;
  const { esc } = T;
  let st = { fait: null, loading: false, local: false, part: null, qui: "" };

  // ───────── Contenu du guide ─────────
  const SITE_RUMEUR = "https://rumeur.global/";
  const PARTS = [
    { id: "p1", n: 1, titre: "Présentation de RUMEUR", court: "Présentation" },
    { id: "p2", n: 2, titre: "L'équipe et vos interlocuteurs", court: "L'équipe" },
    { id: "p3", n: 3, titre: "Vos premiers jours et les outils", court: "Premiers jours & outils" },
    { id: "p4", n: 4, titre: "Notre organisation au quotidien", court: "Organisation" },
  ];
  const DOMAINES = [
    ["Développement créatif", ""],
    ["Production", ""],
    ["Post-production", ""],
    ["Art buying", "La recherche et la sélection de talents créatifs adaptés au projet."],
  ];
  const VILLES = ["Paris", "São Paulo", "New York"];
  const EQUIPE = [
    { nom: "Flavia Lefebvre", fonction: "Présidente", sujets: "Direction et supervision du pôle Production · Beauté & Mode.", motscles: "direction production beauté mode" },
    { nom: "Valentin Lefebvre", fonction: "Directeur Général", sujets: "Direction et supervision du pôle Administration.", motscles: "direction administration" },
    { nom: "Alejandro Borjas Duncan", fonction: "Producteur exécutif & créatif · Référent IA", sujets: "Production exécutive, création et sujets liés à l'IA.", motscles: "production création créatif ia intelligence artificielle assistant claude" },
    { nom: "Jessica Rocha", fonction: "Operations & Administrative Manager", sujets: "Organisation des opérations et de l'administration, facturation, paiements, accès aux outils et suivi des projets.", motscles: "opérations administration facture facturation paiement accès outils compte connexion mot de passe suivi projets chedar yousign synology gmail drive" },
    { nom: "Sandy Vigneron", fonction: "Ressources humaines", sujets: "Questions RH et démarches liées à votre situation.", motscles: "rh ressources humaines contrat congés absence mutuelle salaire démarches arrivée" },
    { nom: "Cynthia Basly", fonction: "Comptabilité · Prestataire externe", sujets: "Suivi comptable.", motscles: "comptabilité compta comptable" },
    { nom: "Théo Jacquet et Amélie Grosset", fonction: "Producteurs · Freelance", sujets: "Production et suivi des projets qui leur sont confiés.", motscles: "production producteur projet suivi" },
  ];
  const PREMIERS_JOURS = [
    { id: "j-equipe", t: "Rencontrer l'équipe et identifier vos interlocuteurs." },
    { id: "j-acces", t: "Vérifier les accès nécessaires à vos missions." },
    { id: "j-drive", t: "Découvrir les dossiers des projets sur Google Drive." },
    { id: "j-outils", t: "Prendre en main Chedar et la charge de travail selon votre rôle." },
    { id: "j-procedures", t: "Comprendre les procédures qui concernent votre activité." },
  ];
  const OUTILS = [
    { id: "o-gmail", nom: "Gmail", usage: "Échanges par email.", lien: "https://mail.google.com/" },
    { id: "o-drive", nom: "Google Drive", usage: "Partage et organisation des documents des projets.", lien: "https://drive.google.com/" },
    { id: "o-chedar", nom: "Chedar", usage: "Suivi des projets, devis, fournisseurs, coûts et factures." },
    { id: "o-charge", nom: "Charge de travail (Rumeur Office)", usage: "Suivi du travail et visibilité sur la charge de l'équipe, semaine par semaine.", lien: "#assistant" },
    { id: "o-yousign", nom: "Yousign", usage: "Envoi des NDA pour signature.", lien: "https://yousign.app/" },
    { id: "o-synology", nom: "Synology", usage: "Sauvegarde des disques durs des projets terminés." },
  ];
  const RECAP = [
    ["L'équipe référente", "Pôle, producteur et superviseur."],
    ["Le devis", "Montant et statut."],
    ["Les dates clés", "Shooting et livraison."],
    ["L'avancement", "Statut, prochaines étapes et éléments en attente."],
    ["Les priorités", "Urgences, difficultés et décisions nécessaires."],
  ];
  const ALL_IDS = [...PARTS.map((p) => p.id), ...PREMIERS_JOURS.map((x) => x.id), ...OUTILS.map((x) => x.id)];

  // ───────── Visite guidée : chaque étape pointe un onglet ─────────
  const TOUR = [
    { sel: '.tabs a[data-view="radar"]', titre: "Radar", texte: "La veille de la semaine : nouveaux DA, lancements, campagnes des concurrents et inspiration. Mis à jour chaque matin." },
    { sel: '.tabs a[data-view="assistant"]', titre: "Assistant", texte: "Votre collègue IA, relié au Drive et à Gmail. Notes de brief, devis à comparer, NDA, prez dans le modèle RUMEUR : demandez-lui en français, espagnol ou anglais." },
    { sel: '.tabs a[data-view="lieux"]', titre: "Sélections", texte: "Les sélections de lieux, casting et moodboard à partager aux clients, avec un lien où ils mettent leurs ♥ et commentaires." },
    { sel: '.tabs a[data-view="admin"]', titre: "Admin", texte: "PO manquants, factures fournisseurs à payer, NDA et contrats pas encore signés." },
    { sel: '.tabs a[data-view="bienvenue"]', titre: "Bienvenue", texte: "Ce guide. Revenez-y quand vous voulez : votre avancement est gardé." },
  ];

  function el() { return document.getElementById("v-bienvenue"); }
  const user = () => T.getUser() || {};
  const prenom = () => { const u = user(); return String(u.name || u.email || "").split(/[\s@.]/)[0] || ""; };
  const localKey = () => "rumeur_onb_" + (user().email || "");
  const localGet = () => { try { return JSON.parse(localStorage.getItem(localKey()) || "{}"); } catch (e) { return {}; } };
  const localSet = (v) => { try { localStorage.setItem(localKey(), JSON.stringify(v)); } catch (e) {} };
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  async function load() {
    st.loading = true;
    try { st.fait = ((await T.api("onb_get")).onboarding || {}).fait || {}; st.local = false; }
    catch (e) { st.fait = localGet(); st.local = true; }   // backend pas encore à jour : avancement local
    finally { st.loading = false; render(); }
  }

  async function toggle(id, on) {
    const fait = st.fait;
    if (on) fait[id] = new Date().toISOString(); else delete fait[id];
    render();
    if (st.local) { localSet(fait); return; }
    try { await T.api("onb_check", { id, fait: on }); }
    catch (e) { T.toast("Pas enregistré : " + e.message); if (on) delete fait[id]; else fait[id] = 1; render(); }
  }

  // Filtre « À qui m'adresser ? » : une personne reste en avant si un des mots tapés figure dans ses sujets.
  function quiHit(m) {
    const words = norm(st.qui).split(/\s+/).filter((w) => w.length > 2);
    return !words.length || words.some((w) => norm(m.nom + " " + m.fonction + " " + m.sujets + " " + m.motscles).includes(w));
  }

  // ───────── Rendu ─────────
  const check = (id, label, sub) => `<li class="onb-step${st.fait[id] ? " done" : ""}">
      <label class="onb-check"><input type="checkbox" data-onb-step="${esc(id)}"${st.fait[id] ? " checked" : ""} aria-label="${esc(label)}"><span aria-hidden="true"></span></label>
      <div class="main"><div class="t">${esc(label)}</div>${sub ? `<div class="s">${sub}</div>` : ""}</div></li>`;

  function partBody(p) {
    if (p.id === "p1") return `
      <section class="onb-sec"><h3>Qui sommes-nous ?</h3>
        <p>RUMEUR Global est une société de production créative qui accompagne les projets de leur conception jusqu'à leur livraison finale.</p>
        <p>Nous collaborons avec des photographes, des réalisateurs et des artistes pour donner vie à des histoires visuelles. Pour chaque projet, nous réunissons une équipe adaptée aux besoins et à l'ambition créative.</p>
        <p>RUMEUR intervient à l'international, avec des équipes basées à :</p>
        <div class="onb-villes">${VILLES.map((v) => `<span>${esc(v)}</span>`).join("")}</div></section>
      <section class="onb-sec"><h3>Nos domaines d'intervention</h3>
        <p>Selon les besoins du projet, notre accompagnement peut comprendre :</p>
        <div class="onb-grid">${DOMAINES.map(([t, s], i) => `<div class="onb-tile"><span class="mini">0${i + 1}</span><b>${esc(t)}</b>${s ? `<p>${esc(s)}</p>` : ""}</div>`).join("")}</div></section>
      <section class="onb-sec"><h3>Découvrir nos projets</h3>
        <p>Le site de RUMEUR présente notamment des projets réalisés pour Lacoste, Louis Vuitton et Celine.</p>
        <p><a class="btn ghost" href="${SITE_RUMEUR}" target="_blank" rel="noopener">Découvrir les projets de RUMEUR ↗</a></p></section>`;
    if (p.id === "p2") {
      const cards = EQUIPE.map((m) => `<div class="onb-person${quiHit(m) ? "" : " dim"}" data-qui="${esc(EQUIPE.indexOf(m))}"><b>${esc(m.nom)}</b><span class="mini">${esc(m.fonction)}</span><p>${esc(m.sujets)}</p></div>`).join("");
      return `
      <section class="onb-sec"><p>La Direction est assurée par <b>Flavia Lefebvre</b>, Présidente, et <b>Valentin Lefebvre</b>, Directeur Général.</p>
        <form class="form onb-qui" id="onb-qui" role="search"><label>À qui m'adresser ?<input name="qui" value="${esc(st.qui)}" placeholder="ex. facture, accès Chedar, congés, IA…" autocomplete="off"></label></form>
        <div class="onb-people">${cards}</div>
        <p class="mini">Pour chaque projet, identifiez votre responsable et les personnes avec lesquelles vous serez amené à collaborer.</p></section>`;
    }
    if (p.id === "p3") return `
      <section class="onb-sec"><p>À votre arrivée, votre responsable référent vous présente vos missions, les projets prévus et les priorités. Vos premiers jours vous permettront de :</p>
        <ul class="list">${PREMIERS_JOURS.map((x) => check(x.id, x.t)).join("")}</ul>
        <p class="mini">Votre affectation peut évoluer : vous pouvez commencer sur un projet, puis en rejoindre d'autres.</p></section>
      <section class="onb-sec"><h3>Les principaux outils</h3>
        <p class="mini">Cochez chaque outil dès que votre accès fonctionne.</p>
        <ul class="list">${OUTILS.map((o) => check(o.id, o.nom, esc(o.usage) + (o.lien ? ` · <a href="${esc(o.lien)}" target="_blank" rel="noopener">Ouvrir ↗</a>` : ""))).join("")}</ul>
        <p class="mini">Pour une demande d'accès ou une difficulté de connexion, contactez <b>Jessica</b>. Les accès peuvent être ajustés en fonction de vos missions.</p></section>
      <section class="onb-sec"><h3>Rumeur Office</h3>
        <p>Cet outil interne réunit le Radar, l'assistant IA, les sélections clients et l'admin.</p>
        <p><button type="button" class="btn ghost" data-onb-tour="1">Faire la visite guidée</button></p></section>`;
    return `
      <section class="onb-sec"><h3>Le suivi hebdomadaire des projets</h3>
        <p>Des récaps hebdomadaires, coordonnés par <b>Jessica</b> avec les membres de l'équipe, permettent de suivre l'avancement des projets, d'anticiper les échéances et de signaler les difficultés.</p>
        <p>Pour chaque projet, les points abordés comprennent :</p>
        <div class="onb-grid">${RECAP.map(([t, d], i) => `<div class="onb-tile"><span class="mini">0${i + 1}</span><b>${esc(t)}</b><p>${esc(d)}</p></div>`).join("")}</div>
        <p class="onb-note">Avant chaque point, préparez les informations à jour sur vos projets, vos disponibilités et les sujets à discuter.</p></section>
      <section class="onb-sec"><h3>Planning et disponibilités</h3>
        <p>Les récaps permettent également de tenir le planning à jour et d'anticiper les périodes de forte activité.</p>
        <p>Communiquez vos jours off, congés et récupérations, une fois validés selon le circuit applicable, afin qu'ils puissent être pris en compte dans l'organisation de l'équipe.</p></section>
      <section class="onb-sec"><h3>Charge de travail</h3>
        <p>La charge de travail est suivie par personne et par projet dans Rumeur Office. Ce suivi permet de mieux visualiser la disponibilité de chacun et d'identifier les besoins de renfort.</p>
        <p>Signalez dès que possible une surcharge, un retard ou des échéances difficiles à respecter. Lorsqu'une difficulté de capacité est identifiée, Jessica en informe la Direction pour examiner les priorités et la répartition du travail.</p></section>`;
  }

  function render() {
    const root = el(); if (!root) return;
    if (!st.fait) { if (!st.loading) load(); root.innerHTML = `<div class="in"><div class="loading">Chargement…</div></div>`; return; }
    const fait = st.fait;
    const n = ALL_IDS.filter((id) => fait[id]).length, pct = Math.round((n / ALL_IDS.length) * 100);
    if (!st.part) st.part = (PARTS.find((p) => !fait[p.id]) || PARTS[0]).id;
    const p = PARTS.find((x) => x.id === st.part), i = PARTS.indexOf(p), next = PARTS[i + 1];

    const nav = PARTS.map((x) => `<button type="button" class="onb-tab${x.id === p.id ? " on" : ""}${fait[x.id] ? " done" : ""}" data-onb-part="${x.id}"${x.id === p.id ? ' aria-current="step"' : ""}>
        <span class="num">${fait[x.id] ? "✓" : x.n}</span><span>${esc(x.court)}</span></button>`).join("");

    root.innerHTML = `<div class="in onb">
      <header class="vhead"><p class="eyebrow">RUMEUR — Guide d'onboarding</p><h1>Bienvenue chez RUMEUR${prenom() ? ", " + esc(prenom()) : ""}.</h1>
        <p>Ce guide vous aide à prendre vos repères chez RUMEUR : découvrir l'entreprise et l'équipe, comprendre notre organisation et connaître les outils utilisés au quotidien.</p>
        <p class="mini">Selon votre poste, votre responsable vous présentera les projets, les outils et les procédures qui concernent vos missions.</p>
      </header>
      <div class="onb-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Avancement du guide"><i style="width:${pct}%"></i></div>
      <p class="mini onb-count">${pct} % du guide${st.local ? " · avancement gardé dans ce navigateur" : ""}</p>
      <nav class="onb-tabs" aria-label="Parties du guide">${nav}</nav>
      <article class="onb-part" aria-labelledby="onb-h">
        <p class="eyebrow">Partie ${p.n} sur ${PARTS.length}</p><h2 id="onb-h">${esc(p.titre)}</h2>
        ${partBody(p)}
        <div class="onb-foot">
          ${i ? `<button type="button" class="btn ghost" data-onb-part="${PARTS[i - 1].id}">← Précédent</button>` : "<span></span>"}
          <button type="button" class="btn primary" data-onb-read="${p.id}">${fait[p.id] ? (next ? "Partie suivante →" : "Guide terminé ✓") : next ? "J'ai lu, partie suivante →" : "J'ai lu le guide"}</button>
        </div>
      </article>
      <section class="blk onb-ask"><h3>Une question ?</h3>
        <p class="mini">Demandez à l'assistant : il répond à partir de la mémoire et des documents de l'agence.</p>
        <form class="form" id="onb-ask"><div class="fr"><label>Votre question<input name="q" required placeholder="ex. Comment on fait signer un NDA à un photographe ?"></label></div><div><button class="btn primary small" type="submit">Demander</button></div></form>
      </section>
    </div>`;
  }
  function goPart(id) { st.part = id; render(); const a = document.querySelector(".onb-tabs"); if (a) a.scrollIntoView({ block: "start", behavior: "smooth" }); }

  // ───────── Visite guidée ─────────
  let tour = null;
  function tourStart() { tour = { i: 0 }; tourShow(); }
  function tourEnd() {
    document.querySelectorAll(".onb-tour, .onb-spot").forEach((x) => x.remove());
    window.removeEventListener("resize", tourShow);
    tour = null;
  }
  function tourShow() {
    if (!tour) return;
    document.querySelectorAll(".onb-tour, .onb-spot").forEach((x) => x.remove());
    const s = TOUR[tour.i], target = document.querySelector(s.sel);
    if (!target) { if (tour.i < TOUR.length - 1) { tour.i++; return tourShow(); } return tourEnd(); }
    target.scrollIntoView({ block: "nearest", inline: "center" });
    const r = target.getBoundingClientRect();
    const spot = document.createElement("div"); spot.className = "onb-spot";
    Object.assign(spot.style, { top: r.top - 6 + "px", left: r.left - 6 + "px", width: r.width + 12 + "px", height: r.height + 12 + "px" });
    const pop = document.createElement("div"); pop.className = "onb-tour"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "Visite guidée");
    const last = tour.i === TOUR.length - 1;
    pop.innerHTML = `<p class="mini">${tour.i + 1} / ${TOUR.length}</p><h4>${esc(s.titre)}</h4><p>${esc(s.texte)}</p>
      <div class="row">${tour.i ? `<button type="button" class="btn small ghost" data-tour="prev">Précédent</button>` : `<button type="button" class="btn small ghost" data-tour="end">Passer</button>`}
      <button type="button" class="btn small primary" data-tour="${last ? "end" : "next"}">${last ? "Terminer" : "Suivant"}</button></div>`;
    document.body.append(spot, pop);
    const w = Math.min(320, window.innerWidth - 32);
    pop.style.width = w + "px";
    pop.style.top = r.bottom + 14 + "px";
    pop.style.left = Math.max(16, Math.min(window.innerWidth - w - 16, r.left + r.width / 2 - w / 2)) + "px";
    pop.querySelector('[data-tour="next"],[data-tour="end"]:last-child').focus();
    window.removeEventListener("resize", tourShow); window.addEventListener("resize", tourShow);
  }

  // ───────── Événements ─────────
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-onb-tour]")) { e.preventDefault(); tourStart(); return; }
    const t = e.target.closest("[data-tour]");
    if (t && tour) { const a = t.dataset.tour; if (a === "next") { tour.i++; tourShow(); } else if (a === "prev") { tour.i--; tourShow(); } else tourEnd(); return; }
    const pt = e.target.closest("[data-onb-part]"); if (pt) { goPart(pt.dataset.onbPart); return; }
    const rd = e.target.closest("[data-onb-read]");
    if (rd) {
      const id = rd.dataset.onbRead, i = PARTS.findIndex((x) => x.id === id);
      if (!st.fait[id]) toggle(id, true);
      if (PARTS[i + 1]) goPart(PARTS[i + 1].id);
    }
  });
  document.addEventListener("keydown", (e) => { if (tour && e.key === "Escape") tourEnd(); });
  document.addEventListener("change", (e) => { const c = e.target.closest("[data-onb-step]"); if (c) toggle(c.dataset.onbStep, c.checked); });
  document.addEventListener("input", (e) => {
    if (!e.target.closest("#onb-qui")) return;
    st.qui = e.target.value;
    document.querySelectorAll("[data-qui]").forEach((d) => d.classList.toggle("dim", !quiHit(EQUIPE[+d.dataset.qui])));
  });
  document.addEventListener("submit", (e) => {
    if (e.target.id === "onb-qui") { e.preventDefault(); return; }
    if (e.target.id !== "onb-ask") return;
    e.preventDefault();
    const q = String(new FormData(e.target).get("q") || "").trim(); if (!q) return;
    const b = document.createElement("button"); b.hidden = true;
    b.dataset.ask = "Je viens d'arriver chez RUMEUR. " + q;
    document.body.append(b); b.click(); b.remove();
  });

  T.renderOnboarding = render;
})();
(function () { const T = window.RumeurTeam; if (T && T.getUser() && T.current() === "bienvenue") T.renderOnboarding(); })();
