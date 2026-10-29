/* Rumeur Office — connexion Google @rumeur.paris : Radar, assistant, lieux, admin.
   Toutes les données internes passent par le backend Apps Script, qui revérifie le compte. */
(function () {
  const CFG = window.RUMEUR_CONFIG || {};
  const DOMAIN = CFG.DOMAIN || "rumeur.paris";
  const configured = !!(CFG.API_URL && CFG.GOOGLE_CLIENT_ID);
  const VIEWS = ["radar", "assistant", "lieux", "admin", "workspace"];
  const PRIVATE = new Set(["radar", "assistant", "lieux", "admin", "workspace"]);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
  };
  const toast = (t) => { const el = $("toast"); if (!el) return; el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), 2600); };

  let token = null, user = null, dash = null, dashLoading = false, gisReady = false, gateError = "";
  let radarState = "";
  let history = [], pending = [], busy = false, run = null, runKey = "", chatId = null, chats = null, chatsLoading = false, chatsOpen = false, delAsk = null;
  const DEMO = new URLSearchParams(location.search).has("demo");

  // ───────── Mode démo : données fictives, aucun appel serveur ─────────
  const DEMO_DASH = {
    today: new Date().toLocaleDateString("fr-FR"),
    projets: [
      { "Code projet": "390_MAISON_AURORE_FILM_FETES", "Client": "Maison Aurore", "Nom du projet": "Film des fêtes", "Chef de projet": "camille@rumeur.paris", "Statut": "Proposition envoyée", "Deadline": "06/11/2026", "Prochaine action": "Relancer la cliente pour valider la DA V2", "Lien dossier Drive": "https://drive.google.com/", "Lien brief": "https://docs.google.com/" },
      { "Code projet": "391_ATELIER_SEL_SHOOTING_PARFUM", "Client": "Atelier Sel", "Nom du projet": "Shooting parfum", "Chef de projet": "hugo@rumeur.paris", "Statut": "Production", "Deadline": "28/10/2026", "Prochaine action": "Confirmer le studio et le casting mains", "Lien dossier Drive": "https://drive.google.com/" },
      { "Code projet": "392_NOVA_BEAUTE_CONTENUS_RS", "Client": "Nova Beauté", "Nom du projet": "Contenus réseaux sociaux", "Chef de projet": "camille@rumeur.paris", "Statut": "Brief reçu", "Deadline": "20/11/2026", "Prochaine action": "Envoyer la fiche brief à l'équipe crea", "Lien dossier Drive": "https://drive.google.com/", "Lien brief": "https://docs.google.com/" },
    ],
    livraisons: [{ "Projet": "391", "Client": "Atelier Sel", "Livrable": "Moodboard", "Version": "V2", "Envoyée le": "14/10/2026", "Lien": "https://drive.google.com/", "Statut": "Envoyée", "Jours ouvrés sans réponse": 3, "Relance": "À relancer" }],
    retours: [
      { "Reçu le": "16/10/2026", "Projet": "390", "Livrable": "DA", "Version": "V1", "Retour (un point par ligne)": "Palette plus chaude, moins de doré", "Statut": "À traiter" },
      { "Reçu le": "16/10/2026", "Projet": "390", "Livrable": "DA", "Version": "V1", "Retour (un point par ligne)": "Ajouter une piste en extérieur nuit", "Statut": "En cours" },
    ],
    po: [{ "Projet": "391_ATELIER_SEL", "Client": "Atelier Sel", "N° devis": "D-2026-118", "Montant HT (€)": "14 800,00 €", "Devis validé le": "02/10/2026", "Jours sans PO": 17, "Statut": "À relancer" }],
    factures: [
      { "Fournisseur": "Studio Lumière", "N° facture": "F-0412", "Montant TTC (€)": "2 160,00 €", "Paiement prévu": "30/11/2026", "Projet": "391", "Statut": "À payer" },
      { "Fournisseur": "Loc Matériel Pro", "N° facture": "88231", "Montant TTC (€)": "540,00 €", "Paiement prévu": "", "Projet": "", "Statut": "À vérifier" },
    ],
    contrats: [{ "Date": "17/10/2026", "Type (NDA / Contrat freelance / PO / Facture)": "NDA", "Prestataire ou client": "Léa Martin (photographe)", "Projet lié": "391", "Statut (brouillon / envoyé Yousign / signé / payé / à relancer)": "envoyé Yousign", "Lien document": "https://docs.google.com/" }],
    anniversaires: [{ prenom: "Hugo", nom: "", date: "23/10", dans: 4, preferences: "fan de pâtisserie" }, { prenom: "Camille", nom: "", date: "12/11", dans: 24, preferences: "" }],
    evenements: [{ "Date début": "07/11/2026", "Événement": "Salon photo (exemple)", "Lieu": "Paris", "Lien": "", "Pertinence (1-3)": 3, "Qui y va": "Hugo, Camille", dans: 19 }],
    achats: [
      { "Article": "Café en grains", "Fournisseur": "Torréfacteur du quartier", "Dernière commande": "02/10/2026", bas: true, dans: -3, aCommander: true },
      { "Article": "Lait / boisson végétale", "Fournisseur": "Supermarché", "Dernière commande": "15/10/2026", bas: false, dans: 3, aCommander: true },
      { "Article": "Thé & infusions", "Fournisseur": "Supermarché", "Dernière commande": "01/10/2026", bas: false, dans: 12, aCommander: false },
      { "Article": "Eau pétillante", "Fournisseur": "Supermarché", "Dernière commande": "12/10/2026", bas: false, dans: 7, aCommander: false },
    ],
  };
  const DEMO_CHATS = [
    { id: "demo1", titre: "Compare les 3 devis lumière pour BODY", maj: Date.now() - 3600e3, messages: [{ role: "user", content: "Compare les 3 devis lumière pour BODY" }, { role: "assistant", content: "**Exemple** — le devis B est le moins cher à prestation égale (2 450 € HT), mais il n'inclut pas le transport." }] },
    { id: "demo2", titre: "Comment on fait signer un NDA chez Rumeur ?", maj: Date.now() - 86400e3 * 2, messages: [{ role: "user", content: "Comment on fait signer un NDA chez Rumeur ?" }, { role: "assistant", content: "**Exemple** — 1. Je prépare le NDA depuis le modèle. 2. Vous le déposez dans Yousign. 3. Vous me dites « NDA de X signé »." }] },
  ];
  const DEMO_SELS = [{ id: "demosel", titre: "Repérages — BODY (exemple)", client: "Interne", code: "000_BODY", intro: "Première sélection de lieux pour le tournage des 14 et 15 novembre.", show_prix: true, publie: true, token: "demo", vues: 3, owner: "demo@rumeur.paris",
    retours: [{ type: "like", lieu: "La" }, { type: "comment", lieu: "La", nom: "Cécilia", texte: "J'adore la lumière, on peut visiter mardi ?", date: new Date(Date.now() - 3600e3).toISOString() }],
    lieux: [
      { id: "La", nom: "Atelier 150 m²", zone: "Paris 20e", prix: "1 500 € / jour", dispo: "Dès maintenant", description: "Atelier clair, murs blancs, parquet, poteau central et grande hauteur sous charpente.", details: { Surface: "150 m²", Type: "Non industriel" }, photos: ["demo-1", "demo-2", "demo-3"], liens: [], note_interne: "HT/TTC à confirmer" },
      { id: "Lb", nom: "Plateau industriel 1 500 m²", zone: "Aubervilliers", prix: "2 000 € / jour", dispo: "À partir de janvier 2027", description: "Très grand volume à poteaux, gaines apparentes, grandes baies vitrées.", details: { Surface: "1 500 m²" }, photos: ["demo-4", "demo-5"], liens: ["https://example.com"], note_interne: "" },
    ] }];
  async function demoApi(action, payload) {
    await new Promise((r) => setTimeout(r, action === "chat" ? 900 : 250));
    if (action === "dashboard") return { data: JSON.parse(JSON.stringify(DEMO_DASH)) };
    if (action === "radar") { const t = new Date().toISOString().slice(0, 10); return { radar: { updated: t, rows: [
      { id: "d1", date: t, semaine: "2026-W44", semaineLabel: "Cette semaine", categorie: "cible", marque: "Maison exemple", titre: "Nomination d'un nouveau directeur de l'image (exemple).", pourquoi: "Exemple de signal : en vrai, le Radar se remplit chaque matin.", priorite: 3, source: "Démo" },
      { id: "d2", date: t, semaine: "2026-W44", semaineLabel: "Cette semaine", categorie: "inspi", marque: "Studio exemple", titre: "Une campagne remarquée (exemple).", pourquoi: "Ce qu'on peut en retenir.", priorite: 1, source: "Démo" } ] } }; }
    if (action === "upload") return { file: { id: "demo", name: payload.file.name } };
    if (action === "sel_list") return { selections: DEMO_SELS.map(x => ({ id: x.id, type: x.type || "lieux", titre: x.titre, client: x.client, code: x.code, owner: x.owner, publie: x.publie, n: x.lieux.length, vues: x.vues, retours: x.retours.length, maj: Date.now() - 7200e3 })) };
    if (action === "sel_get") return { selection: JSON.parse(JSON.stringify(DEMO_SELS.find(x => x.id === payload.id) || DEMO_SELS[0])) };
    if (action === "sel_create") { const x = { id: "s" + Date.now(), type: payload.type || "lieux", titre: payload.titre || ({ lieux: "Sélection de lieux", casting: "Sélection casting", moodboard: "Moodboard" }[payload.type || "lieux"]), client: "", code: "", intro: "", show_prix: true, publie: false, vues: 0, retours: [], lieux: [], owner: "demo@rumeur.paris" }; DEMO_SELS.unshift(x); return { selection: x }; }
    if (action === "sel_save") { const x = DEMO_SELS.find(y => y.id === payload.id); Object.assign(x, JSON.parse(JSON.stringify(payload))); return { selection: JSON.parse(JSON.stringify(x)) }; }
    if (action === "sel_publish") { const x = DEMO_SELS.find(y => y.id === payload.id); x.publie = payload.publie !== false; x.token = x.token || "demo"; return { selection: JSON.parse(JSON.stringify(x)) }; }
    if (action === "sel_analyze" || action === "sel_from_ws") { const x = DEMO_SELS.find(y => y.id === payload.id); x.lieux.push({ id: "L" + Date.now(), nom: "Loft verrière (exemple)", zone: "Paris 11e", prix: "2 200 € HT / jour", description: "Grand loft lumineux sous verrière, sol béton ciré.", details: { Surface: "300 m²" }, photos: ["demo-a", "demo-b"], liens: [] }); return { selection: JSON.parse(JSON.stringify(x)) }; }
    if (action === "sel_hd") { const x = DEMO_SELS.find(y => y.id === payload.id); return { selection: JSON.parse(JSON.stringify(x)), ajoutees: 0, message: "Démo : en vrai, les photos HD sont récupérées sur les liens des lieux." }; }
    if (action === "sel_delete") { DEMO_SELS.splice(DEMO_SELS.findIndex(y => y.id === payload.id), 1); return { result: { ok: true } }; }
    if (action === "sel_thumbs") { const out = {}; (payload.ids || []).forEach((id, n) => { const c = ["#c9b8a6", "#9fb3c8", "#b9c9a1", "#d8b4a0", "#a7a3c9"][(id.charCodeAt(id.length - 1) + n) % 5]; out[id] = "data:image/svg+xml;base64," + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="${c}"/><rect y="260" width="600" height="140" fill="rgba(0,0,0,.12)"/><circle cx="470" cy="110" r="46" fill="rgba(255,255,255,.55)"/></svg>`); }); return { thumbs: out }; }
    if (action === "chats_list") return { chats: DEMO_CHATS.map(c => ({ id: c.id, titre: c.titre, maj: c.maj, n: c.messages.length })) };
    if (action === "chat_get") { const c = DEMO_CHATS.find(x => x.id === payload.id); return { chat: c }; }
    if (action === "chat_save") { let c = DEMO_CHATS.find(x => x.id === payload.id); if (!c) { c = { id: "d" + Date.now(), titre: String((payload.messages.find(m => m.role === "user") || {}).content || "Conversation").slice(0, 70) }; DEMO_CHATS.unshift(c); } c.messages = payload.messages; c.maj = Date.now(); return { result: { id: c.id, titre: c.titre } }; }
    if (action === "chat_delete") { const i = DEMO_CHATS.findIndex(x => x.id === payload.id); if (i >= 0) DEMO_CHATS.splice(i, 1); return { result: { ok: true } }; }
    if (action === "chat" && /devis/i.test((payload.messages || []).slice(-1)[0].content || "")) return {
      reply: "> **L'essentiel :** Studio Lumen est le plus complet pour 9 % de plus qu'Electroprod, qui ne chiffre ni le groupe électrogène ni le transport.\n\nÀ prestation égale (en ajoutant ~1 400 € de groupe et de camion chez Electroprod), **Studio Lumen revient moins cher** et inclut un chef électro déjà calé sur BODY.\n\nDevis lus : [Devis Studio Lumen v2](https://drive.google.com/file/d/demo1/view) · [Devis Electroprod v3](https://drive.google.com/file/d/demo2/view) · [Devis Paris Light](https://drive.google.com/file/d/demo3/view)\n\n### À anticiper\n- **Heures sup** : les 3 devis comptent des journées de 10 h ; le plan de travail BODY prévoit 12 h le jour 2 → demander le tarif horaire au-delà.\n- **Validité** : le devis Lumen expire le 6 novembre, avant la validation client prévue le 10 → demander une prolongation.\n- **Assurance matériel** : non mentionnée chez Paris Light.\n\nJe prépare le mail à Studio Lumen pour les heures sup et la prolongation ?",
      actions: [{ outil: "chercher_drive", ok: true }, { outil: "lire_fichier", ok: true }, { outil: "afficher_comparatif_devis", ok: true }], memo: "",
      widgets: [{ type: "devis", data: { titre: "Devis lumière — BODY", base: "HT", devise: "€",
        fournisseurs: [
          { nom: "Studio Lumen", total: 14200, lien: "https://drive.google.com/file/d/demo1/view", validite: "Valable jusqu'au 06/11 · 30 % d'acompte", forts: ["Chef électro qui connaît le lieu", "Groupe électrogène et camion inclus"], faibles: ["Validité courte"] },
          { nom: "Electroprod", total: 13020, lien: "https://drive.google.com/file/d/demo2/view", validite: "Valable 30 jours", forts: ["Le moins cher sur le matériel"], faibles: ["Groupe et transport non chiffrés", "Équipe plus junior"] },
          { nom: "Paris Light", total: 16850, lien: "https://drive.google.com/file/d/demo3/view", validite: "Valable 15 jours", forts: ["Parc HMI le plus large"], faibles: ["Le plus cher", "Assurance non mentionnée"] }],
        postes: [
          { nom: "Équipe électro (2 j)", montants: [4800, 4200, 5600] },
          { nom: "Matériel lumière", montants: [6100, 5900, 7900], note: "HMI 18K, Skypanels, machinerie" },
          { nom: "Groupe électrogène", montants: [1300, null, 1450] },
          { nom: "Transport / camion", montants: [700, null, 900] },
          { nom: "Consommables", montants: [500, 620, 400] },
          { nom: "Prépa et démontage", montants: [800, 2300, 600] }],
        recommandation: { fournisseur: "Studio Lumen", pourquoi: "Seul devis complet ; une fois le groupe et le camion ajoutés à Electroprod, il revient moins cher." },
        a_verifier: ["Tarif des heures sup au-delà de 10 h", "Prolongation de validité jusqu'au 10/11", "Assurance du matériel loué"] } }],
    };
    if (action === "chat") return {
      reply: "**Mode démo** — l'assistant n'est pas encore branché.\n\nUne fois activé, il pourra par exemple :\n- transformer vos notes de call en **fiche brief** (résumé, recommandations, warnings) puis créer le dossier projet dans le Drive ;\n- ranger un devis, une DA ou un retour client dans le bon projet ;\n- préparer un **NDA** ou un contrat freelance prêt pour Yousign ;\n- signaler ce qui manque au bureau et préparer la commande.",
      actions: [], memo: "",
    };
    if (action === "achat_signal" || action === "achat_ordered") {
      DEMO_DASH.achats.forEach((a) => { if (a["Article"] === payload.article) { a.bas = action === "achat_signal"; a.aCommander = action === "achat_signal"; if (action === "achat_ordered") a.dans = 14; } });
      if (action === "achat_signal" && !DEMO_DASH.achats.some((a) => a["Article"] === payload.article)) DEMO_DASH.achats.push({ "Article": payload.article, bas: true, aCommander: true, dans: null });
    }
    if (action === "ws_get" || action === "ws_ingest") return { data: { projet: { code: payload.code, nom: "BODY", client: "Interne (Rumeur)", equipe: "Réalisation : Cécilia Feller", statut: "Développement", dossier: "", workspace: "" }, rubriques: ["Brief", "Lieux", "Casting", "Équipe & prestataires", "Budget & devis", "Planning", "Références", "Divers"], statuts: ["proposé", "en option", "retenu", "écarté", "à relancer", "info"],
      items: [
        { id: "d1", rubrique: "Lieux", titre: "Atelier de danse — Paris 11e", prestataire: "Agence de lieux (exemple)", prix: "1 800 € HT / jour, régie incluse", montant: 1800, resume: "Grand studio lumineux avec parquet, idéal pour les séquences de mouvement.", details: { Surface: "220 m²", Dispos: "semaine 47" }, points_forts: ["Lumière naturelle", "Parquet de danse"], vigilance: ["Électricité à confirmer"], statut: "proposé", photos: [], fichiers: [], liens: [], ajoute_le: "22/10/2026", ajoute_par: "demo@rumeur.paris" },
        { id: "d2", rubrique: "Lieux", titre: "Piscine Art déco — Montreuil", prestataire: "Agence de lieux (exemple)", prix: "2 600 € HT / jour", montant: 2600, resume: "Bassin carrelé années 30, très graphique.", details: { Dispos: "lundis uniquement" }, points_forts: ["Décor unique"], vigilance: ["Tournage lundi seulement", "Assurance spécifique"], statut: "en option", photos: [], fichiers: [], liens: [], ajoute_le: "22/10/2026", ajoute_par: "demo@rumeur.paris" },
        { id: "c1", rubrique: "Casting", titre: "Julia — personnage pressenti", resume: "Repérée sur la planche casting (exemple).", details: {}, points_forts: [], vigilance: ["Disponibilité à vérifier"], statut: "retenu", photos: [], fichiers: [], liens: [], cadrage: { id: "demo-planche", x: 0.03, y: 0.06, w: 0.28, h: 0.62 }, ajoute_le: "22/10/2026", ajoute_par: "demo@rumeur.paris" },
        { id: "c2", rubrique: "Casting", titre: "Ivan — personnage pressenti", resume: "Repéré sur la planche casting (exemple).", details: {}, points_forts: [], vigilance: [], statut: "proposé", photos: [], fichiers: [], liens: [], cadrage: { id: "demo-planche", x: 0.36, y: 0.06, w: 0.28, h: 0.62 }, ajoute_le: "22/10/2026", ajoute_par: "demo@rumeur.paris" },
        { id: "c3", rubrique: "Casting", titre: "Emma — personnage pressenti", resume: "Photo à ajouter (exemple).", details: {}, points_forts: [], vigilance: [], statut: "proposé", photos: [], fichiers: [], liens: [], ajoute_le: "22/10/2026", ajoute_par: "demo@rumeur.paris" },
        { id: "d3", rubrique: "Brief", titre: "Note d'intention — BODY", resume: "Documentaire sur le rapport au corps, en 4 portraits.", details: {}, points_forts: [], vigilance: [], statut: "info", photos: [], fichiers: [], liens: [], ajoute_le: "21/10/2026", ajoute_par: "demo@rumeur.paris" },
      ], fil: [{ date: "22/10/2026 15:40", par: "demo@rumeur.paris", resume: "L'agence propose 2 lieux à Paris et Montreuil", elements: "Atelier de danse · Piscine Art déco" }],
      fiche: { logline: "Quatre corps, quatre façons d'habiter le monde (exemple).", intention: "Un documentaire en portraits croisés sur le rapport au corps : performance, soin, vieillissement et désir. Caméra proche, peu de paroles, beaucoup de gestes.", type: "Documentaire", duree: "52 min", livrables: ["Film 52 min", "Teaser 90 s", "4 portraits courts pour les réseaux"], themes: ["Corps", "Mouvement", "Intimité", "Âge"], ton: ["Lumière naturelle", "Grain 16 mm", "Silence", "Peau"], personnages: [{ nom: "Julia", role: "Portrait 1", description: "Ancienne étoile, 60 ans" }, { nom: "Nageur", role: "Portrait 2", description: "Athlète paralympique" }], lieux_recherches: ["Studio de danse lumineux", "Piscine années 30", "Appartement habité"], planning: [{ etape: "Repérages", date: "Nov. 2026" }, { etape: "Tournage", date: "Janv. 2027" }, { etape: "Montage", date: "Mars 2027" }], budget: "À définir", equipe: [{ nom: "Cécilia Feller", role: "Réalisation" }, { nom: "Rumeur", role: "Production" }], references: ["Pina (Wenders)", "Ryan McGinley"], questions_ouvertes: ["Diffuseur visé ?", "Autorisations de tournage en piscine publique"], images: [], maj: "22/10/2026" } } };
    if (action === "ws_thumbs") {   // démo : une « planche casting » dessinée
      const face = (x, c) => `<rect x="${x}" y="40" width="280" height="380" fill="${c}"/><circle cx="${x + 140}" cy="170" r="70" fill="#f1d3bd"/><rect x="${x + 50}" y="250" width="180" height="170" rx="60" fill="#f1d3bd"/>`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="680"><rect width="1000" height="680" fill="#fff"/>${face(40, "#c9b8a6") + face(370, "#9fb3c8") + face(700, "#b9c9a1")}<text x="40" y="620" font-family="sans-serif" font-size="36">WHO ?</text></svg>`;
      const url = "data:image/svg+xml;base64," + btoa(svg), out = {};
      (payload.ids || []).forEach(id => out[id] = url);
      return { thumbs: out };
    }
    return { result: { demo: true } };
  }

  // ───────── Session ─────────
  function decode(jwt) {
    try { return JSON.parse(decodeURIComponent(escape(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))))); } catch (e) { return null; }
  }
  function setToken(t) {
    const p = decode(t);
    if (!p || p.hd !== DOMAIN || !String(p.email || "").toLowerCase().endsWith("@" + DOMAIN)) {
      gateError = "Cet espace est réservé aux comptes @" + DOMAIN + ".";
      signOut(true); return;
    }
    if (p.exp * 1000 < Date.now()) { signOut(true); return; }
    token = t; user = { email: p.email, name: p.given_name || p.name || p.email, picture: p.picture || "" };
    gateError = ""; store.set("rumeur_tok", t);
    try { history = JSON.parse(store.get("rumeur_chat_" + user.email) || "[]"); } catch (e) { history = []; }
    chatId = store.get("rumeur_chatid_" + user.email) || null; chats = null;
    renderAccount(); show(current());
  }
  function signOut(silent) {
    if (DEMO) { location.href = location.pathname + location.hash; return; }
    token = null; user = null; dash = null; store.del("rumeur_tok"); radarState = ""; if (window.radarLoad) window.radarLoad([], "");
    if (window.google && google.accounts) google.accounts.id.disableAutoSelect();
    renderAccount(); show(current());
    if (!silent) toast("Déconnecté");
  }
  function tokenValid() { const p = token && decode(token); return !!(p && p.exp * 1000 > Date.now() + 30000); }

  function initGis() {
    if (!configured || !window.google || !google.accounts || gisReady) return;
    gisReady = true;
    google.accounts.id.initialize({
      client_id: CFG.GOOGLE_CLIENT_ID, hd: DOMAIN, auto_select: true, cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true, itp_support: true, callback: (r) => setToken(r.credential),
    });
    const saved = store.get("rumeur_tok");
    if (saved) setToken(saved);
    if (!tokenValid()) google.accounts.id.prompt();
    show(current());
  }
  window.__rumeurGisLoaded = initGis;

  function renderGsi(el) {
    if (!el || !gisReady) return;
    el.innerHTML = "";
    google.accounts.id.renderButton(el, { theme: "outline", size: "large", shape: "pill", text: "signin_with", locale: "fr" });
  }

  function renderAccount() {
    const a = $("acct"); if (!a) return;
    if (user) {
      a.innerHTML = `${user.picture ? `<img src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer">` : ""}<button type="button" id="signout" title="${esc(user.email)}">Déconnexion</button>`;
      $("signout").onclick = () => signOut(false);
      if (DEMO) $("signout").textContent = "Quitter la démo";
    } else {
      a.innerHTML = configured ? `<button type="button" id="signin-nav">Connexion</button>` : "";
      const b = $("signin-nav"); if (b) b.onclick = () => go("assistant");
    }
    document.querySelectorAll(".tabs a").forEach((t) => {
      const v = t.dataset.view; const l = t.querySelector(".lock");
      if (l) l.hidden = !PRIVATE.has(v) || !!user;
    });
  }

  // ───────── API ─────────
  async function api(action, payload) {
    if (DEMO) return demoApi(action, payload);
    if (!configured) throw new Error("Espace équipe pas encore configuré.");
    if (!tokenValid()) { signOut(true); if (gisReady) google.accounts.id.prompt(); throw new Error("Session expirée : reconnectez-vous."); }
    const res = await fetch(CFG.API_URL, { method: "POST", body: JSON.stringify(Object.assign({ action, idToken: token }, payload || {})) });
    let data; try { data = await res.json(); } catch (e) { throw new Error("Réponse illisible du serveur."); }
    if (!data.ok) {
      if (data.error === "unauthorized") { gateError = data.message || ""; signOut(true); }
      throw new Error(data.message || data.error || "Erreur");
    }
    return data;
  }

  async function loadDash(force) {
    if (dashLoading || (dash && !force)) return;
    dashLoading = true;
    try { dash = (await api("dashboard")).data; }
    catch (e) { toast(e.message); }
    finally { dashLoading = false; renderView(current()); }
  }

  // ───────── Navigation ─────────
  function current() { const h = decodeURIComponent(location.hash.replace("#", "")); if (h === "projets") { window.history.replaceState(null, "", "#assistant"); return "assistant"; } if (h.indexOf("ws-") === 0) return "workspace"; if (h.indexOf("sel-") === 0) return "lieux"; return VIEWS.includes(h) ? h : "radar"; }
  function wsCodeFromHash() { const h = decodeURIComponent(location.hash.replace("#", "")); return h.indexOf("ws-") === 0 ? h.slice(3) : ""; }
  function go(v) { if (location.hash !== "#" + v) location.hash = v; else show(v); }
  window.addEventListener("hashchange", () => show(current()));

  function show(v) {
    VIEWS.forEach((x) => { const el = $("v-" + x); if (el) el.hidden = x !== v; });
    document.querySelectorAll(".tabs a").forEach((t) => t.setAttribute("aria-current", t.dataset.view === v ? "page" : "false"));
    document.title = "Rumeur Office · " + (({ radar: "Radar", assistant: "Assistant", lieux: "Sélections", admin: "Admin" }[v] || (v === "lieux" ? "Lieux" : "Workspace " + wsCodeFromHash())));
    if (PRIVATE.has(v)) {
      if (!user) { renderGate(v); return; }
      if (v !== "assistant" && v !== "workspace" && v !== "radar") loadDash(false);
      renderView(v);
    }
  }

  function renderGate(v) {
    let el = $("v-" + v);
    if (v === "radar") { el = $("radar-gate"); $("radar-body").hidden = true; }
    const demoLink = `<p style="margin:20px 0 0"><a class="btn ghost" href="?demo#${v}">Voir la démo</a></p>`;
    if (!configured) {
      el.innerHTML = `<div class="in"><div class="gate"><p class="eyebrow">Espace équipe</p><h2>Bientôt ouvert.</h2><p>L'assistant, les projets, l'admin et l'office arrivent ici pour l'équipe Rumeur. Configuration en cours.</p>${demoLink}</div></div>`;
      return;
    }
    el.innerHTML = `<div class="in"><div class="gate"><p class="eyebrow">Réservé à l'équipe Rumeur</p><h2>Rumeur Office.</h2><p>Connectez-vous avec votre compte @${esc(DOMAIN)} pour accéder au Radar, à l'assistant et aux sélections clients.</p><div class="gsi" id="gsi-${v}"></div>${gateError ? `<p class="err">${esc(gateError)}</p>` : ""}</div></div>`;
    if (gisReady) renderGsi($("gsi-" + v));
    else $("gsi-" + v).innerHTML = `<span class="mini">Chargement de la connexion Google…</span>`;
  }

  function renderView(v) {
    if (!user || current() !== v) return;
    if (v === "radar") return renderRadar();
    if (v === "assistant") return renderAssistant();
    if (v === "workspace") return renderWorkspace();
    if (v === "lieux") { if (window.RumeurTeam && window.RumeurTeam.renderLieux) window.RumeurTeam.renderLieux(); return; }
    const el = $("v-" + v);
    if (!dash) { el.innerHTML = `<div class="in"><div class="loading">Chargement…</div></div>`; return; }
    if (v === "projets") el.innerHTML = viewProjets();
    if (v === "admin") el.innerHTML = viewAdmin();
    if (v === "office") el.innerHTML = viewOffice();
  }

  // ───────── Radar (privé : données lues dans le Drive après connexion) ─────────
  async function renderRadar() {
    $("radar-gate").innerHTML = ""; $("radar-body").hidden = false;
    if (radarState) return;
    radarState = "loading";
    try { const r = (await api("radar")).radar || {}; if (window.radarLoad) window.radarLoad(r.rows || [], r.updated || ""); radarState = "ok"; }
    catch (e) { radarState = ""; const g = $("grid"); if (g) g.innerHTML = `<div class="empty">Radar indisponible : ${esc(e.message)}</div>`; }
  }

  // ───────── Helpers de rendu ─────────
  const arr = (x) => (Array.isArray(x) ? x : []);
  const errOf = (x) => (x && !Array.isArray(x) && x.error ? `<li class="empty-row">Indisponible : ${esc(x.error)}</li>` : "");
  const pick = (r, re) => { const k = Object.keys(r || {}).find((k) => re.test(k)); return k ? r[k] : ""; };
  const linkOf = (u, label) => (u && /^https?:\/\//.test(u) ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(label || "Ouvrir")} ↗</a>` : "");
  const euro = (v) => { const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d,.-]/g, "").replace(/\s/g, "").replace(",", ".")); return isNaN(n) ? 0 : n; };
  const fmtEur = (n) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const MO = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  function when(dmy) {
    const m = String(dmy || "").match(/^(\d{1,2})\/(\d{1,2})/);
    return m ? `<div class="when"><b>${+m[1]}</b><span>${MO[+m[2] - 1]}</span></div>` : `<div class="when"><b>–</b></div>`;
  }
  function statusTag(s) {
    const t = String(s || "");
    const cls = /retard|relancer|traiter|manquant|payer/i.test(t) ? "hot" : /valid|livr|pay|sign|fait/i.test(t) ? "ok" : /attente|envoy|cours|brouillon/i.test(t) ? "warn" : "";
    return t ? `<span class="tag ${cls}">${esc(t)}</span>` : "";
  }
  const list = (items, empty) => `<ul class="list">${items.length ? items.join("") : `<li class="empty-row">${esc(empty)}</li>`}</ul>`;
  const askBtn = (label, prompt, cls) => `<button type="button" class="btn ${cls || ""}" data-ask="${esc(prompt)}">${esc(label)}</button>`;
  const refreshBtn = `<button type="button" class="btn ghost small" data-refresh="1">Actualiser</button>`;

  function vhead(eyebrow, title, sub, actions) {
    return `<header class="vhead"><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}<div class="row">${actions || ""}${refreshBtn}</div></header>`;
  }

  // ───────── Projets ─────────
  function viewProjets() {
    const P = arr(dash.projets), L = arr(dash.livraisons), R = arr(dash.retours);
    const late = P.filter((p) => { const m = String(p["Deadline"] || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m && new Date(+m[3], +m[2] - 1, +m[1]) < new Date(new Date().toDateString()); });
    const relance = L.filter((l) => /relancer/i.test(l["Relance"] || ""));
    const cards = P.map((p) => `<article class="pcard">
        <span class="code">${esc(p["Code projet"])}</span>
        <h4><a class="plain" href="#ws-${esc(p["Code projet"])}">${esc(p["Nom du projet"] || p["Code projet"])}</a></h4>
        <span class="client">${esc(p["Client"])}${p["Chef de projet"] ? " · " + esc(p["Chef de projet"]) : ""}</span>
        ${p["Prochaine action"] ? `<p class="next">→ ${esc(p["Prochaine action"])}</p>` : ""}
        <div class="foot2"><span>${statusTag(p["Statut"])} ${p["Deadline"] ? `<span class="mini">· deadline ${esc(p["Deadline"])}</span>` : ""}</span>
        <span>${linkOf(p["Lien dossier Drive"], "Dossier")} ${linkOf(p["Lien brief"], "Brief")}</span></div>
        <div class="foot2"><a class="btn small primary" href="#ws-${esc(p["Code projet"])}">Ouvrir le workspace</a><button type="button" class="btn small ghost" data-ask="${esc("Fais-moi le récap du projet " + p["Code projet"])}">Récap</button>
        <button type="button" class="btn small ghost" data-ask="${esc("Range un document dans le projet " + p["Code projet"] + " : ")}" data-noauto="1">Ajouter un doc</button></div>
      </article>`);
    return `<div class="in">
      ${vhead("Gestion de projet", "Projets.", "Du brief à la livraison. Chaque projet a son workspace : ouvrez-le pour y déposer mails, photos, devis et propositions, l'assistant les range en fiches.", askBtn("Nouveau brief", "Nouveau projet : voici mes notes du call de brief :\n", "primary") + askBtn("Créer une prez", "Crée une présentation dans le modèle Rumeur pour le projet … (type : locations / moodboard / casting / storyboard). Je joins les photos.", "ghost") + askBtn("Retour client reçu", "Le client a fait un retour sur le projet ", "ghost"))}
      <div class="kpis">
        <div class="kpi"><b>${P.length}</b><span>projets actifs</span></div>
        <div class="kpi ${late.length ? "hot" : ""}"><b>${late.length}</b><span>deadlines dépassées</span></div>
        <div class="kpi ${relance.length ? "hot" : ""}"><b>${L.length}</b><span>livraisons en attente${relance.length ? ` · ${relance.length} à relancer` : ""}</span></div>
        <div class="kpi ${R.length ? "hot" : ""}"><b>${R.length}</b><span>retours à traiter</span></div>
      </div>
      <section class="blk"><h3>En cours <small>Registre Projets</small></h3>
        ${dash.projets && dash.projets.error ? list([errOf(dash.projets)], "") : P.length ? `<div class="pgrid">${cards.join("")}</div>` : list([], "Aucun projet pour l'instant. Commencez par « Nouveau brief ».")}
      </section>
      <div class="two">
        <section class="blk"><h3>Retours client <small>à traiter</small></h3>
          ${list(R.length ? R.slice().reverse().slice(0, 25).map((r) => `<li>${when(r["Reçu le"])}<div class="main"><div class="t">${esc(r["Projet"])} · ${esc(r["Livrable"])} ${esc(r["Version"])}</div><div class="s">${esc(r["Retour (un point par ligne)"])}</div></div><div class="side">${statusTag(r["Statut"])}</div></li>`) : [errOf(dash.retours)].filter(Boolean), "Aucun retour en attente.")}
        </section>
        <section class="blk"><h3>Livraisons <small>en attente de validation</small></h3>
          ${list(L.length ? L.slice().reverse().slice(0, 25).map((l) => `<li>${when(l["Envoyée le"])}<div class="main"><div class="t">${esc(l["Projet"])} · ${esc(l["Livrable"])} ${esc(l["Version"])}</div><div class="s">${esc(l["Client"])} · ${esc(l["Jours ouvrés sans réponse"])} j sans réponse ${linkOf(l["Lien"], "Lien")}</div></div><div class="side">${statusTag(/relancer/i.test(l["Relance"] || "") ? "À relancer" : l["Statut"])}</div></li>`) : [errOf(dash.livraisons)].filter(Boolean), "Rien en attente.")}
        </section>
      </div>
    </div>`;
  }

  // ───────── Admin ─────────
  function viewAdmin() {
    const PO = arr(dash.po), F = arr(dash.factures), C = arr(dash.contrats);
    const due = F.filter((f) => /payer/i.test(f["Statut"] || ""));
    const totalF = due.reduce((s, f) => s + euro(f["Montant TTC (€)"]), 0);
    const totalPO = PO.reduce((s, p) => s + euro(p["Montant HT (€)"]), 0);
    return `<div class="in">
      ${vhead("Admin", "Admin.", "PO, factures fournisseurs, NDA et contrats freelance.", askBtn("Envoyer un NDA", "Je veux envoyer un NDA via Yousign.", "primary") + askBtn("Préparer un NDA", "Prépare un NDA pour le prestataire ", "ghost") + askBtn("Contrat freelance", "Prépare un contrat freelance pour ", "ghost") + askBtn("Point admin", "Fais-moi le point admin : PO en attente, factures à payer ce mois-ci, NDA et contrats non signés.", "ghost"))}
      <div class="kpis">
        <div class="kpi ${PO.length ? "hot" : ""}"><b>${PO.length}</b><span>PO manquants · ${fmtEur(totalPO)} HT</span></div>
        <div class="kpi"><b>${due.length}</b><span>factures à payer · ${fmtEur(totalF)} TTC</span></div>
        <div class="kpi ${F.length - due.length ? "hot" : ""}"><b>${F.length - due.length}</b><span>factures à vérifier</span></div>
        <div class="kpi"><b>${C.length}</b><span>NDA / contrats en cours</span></div>
      </div>
      <div class="two">
        <section class="blk"><h3>PO <small>devis validés sans PO</small></h3>
          ${list(PO.length ? PO.map((p) => `<li>${when(p["Devis validé le"])}<div class="main"><div class="t">${esc(p["Projet"])}</div><div class="s">${esc(p["Client"])} · devis ${esc(p["N° devis"])} · ${esc(p["Jours sans PO"])} j</div></div><div class="side">${esc(p["Montant HT (€)"])}<br>${statusTag(p["Statut"])}</div></li>`) : [errOf(dash.po)].filter(Boolean), "Tous les PO sont reçus.")}
        </section>
        <section class="blk"><h3>Factures fournisseurs <small>à payer / vérifier</small></h3>
          ${list(F.length ? F.map((f) => `<li>${when(f["Paiement prévu"])}<div class="main"><div class="t">${esc(f["Fournisseur"])}</div><div class="s">N° ${esc(f["N° facture"])} · ${esc(f["Projet"])}</div></div><div class="side">${esc(f["Montant TTC (€)"])}<br>${statusTag(f["Statut"])}</div></li>`) : [errOf(dash.factures)].filter(Boolean), "Aucune facture en attente.")}
        </section>
      </div>
      <section class="blk"><h3>NDA & contrats <small>non signés</small></h3>
        ${list(C.length ? C.map((c) => `<li>${when(c["Date"])}<div class="main"><div class="t">${esc(pick(c, /^type/i))} · ${esc(c["Prestataire ou client"])}</div><div class="s">${esc(c["Projet lié"])} ${linkOf(c["Lien document"], "Document")}</div></div><div class="side">${statusTag(pick(c, /^statut/i))}</div></li>`) : [errOf(dash.contrats)].filter(Boolean), "Rien en attente de signature.")}
        <p class="mini" style="margin-top:10px">Signature : déposer le PDF généré dans Yousign, puis dire à l'assistant « NDA de X signé ».</p>
      </section>
    </div>`;
  }

  // ───────── Office ─────────
  function viewOffice() {
    const A = arr(dash.achats), B = arr(dash.anniversaires), E = arr(dash.evenements);
    const toBuy = A.filter((a) => a.aCommander);
    const dans = (n) => (n === 0 ? "aujourd'hui" : n === 1 ? "demain" : n < 0 ? "en cours" : "dans " + n + " j");
    return `<div class="in">
      ${vhead("Office manager", "Office.", "Courses du bureau, anniversaires et événements pro.", askBtn("Préparer la commande", "Prépare la commande de la semaine : ce qu'il faut acheter, groupé par fournisseur, avec les liens.", "primary") + askBtn("Veille événements", "Quels événements pro importants (mode, beauté, luxe, photo, pub, awards) arrivent dans les 2 prochains mois à Paris et en Europe ? Propose ceux à ajouter à l'agenda.", "ghost"))}
      <div class="kpis">
        <div class="kpi ${toBuy.length ? "hot" : ""}"><b>${toBuy.length}</b><span>articles à commander</span></div>
        <div class="kpi"><b>${B.filter((b) => b.dans <= 7).length}</b><span>anniversaires cette semaine</span></div>
        <div class="kpi"><b>${E.filter((e) => e.dans <= 14).length}</b><span>événements sous 15 jours</span></div>
        <div class="kpi"><b>${B.length}</b><span>anniversaires sous 45 jours</span></div>
      </div>
      <section class="blk"><h3>Achats <small>cliquez quand il en manque</small></h3>
        ${list(A.length ? A.map((a) => `<li><div class="main"><div class="t">${esc(a["Article"])}</div><div class="s">${esc(a["Fournisseur"])}${a["Dernière commande"] ? " · dernière commande " + esc(a["Dernière commande"]) : ""}${a.dans !== null && a.dans !== undefined ? " · prochaine " + esc(dans(a.dans)) : ""} ${linkOf(a["Lien produit"], "Produit")}</div></div>
          <div class="side">${a.aCommander ? `<span class="tag hot">${a.bas ? "Manquant" : "À commander"}</span> <button type="button" class="btn small primary" data-ordered="${esc(a["Article"])}">Commandé</button>` : `<button type="button" class="btn small ghost" data-missing="${esc(a["Article"])}">Il en manque</button>`}</div></li>`) : [errOf(dash.achats)].filter(Boolean), "Liste vide.")}
        <form class="form" id="f-achat" style="margin-top:12px"><div class="fr"><label>Autre chose qui manque<input name="article" required placeholder="ex. capsules, gobelets, piles…"></label></div><div><button class="btn primary small" type="submit">Signaler</button></div></form>
      </section>
      <div class="two">
        <section class="blk"><h3>Anniversaires <small>45 prochains jours</small></h3>
          ${list(B.length ? B.map((b) => `<li>${when(b.date)}<div class="main"><div class="t">${esc(b.prenom)} ${esc(b.nom)}</div><div class="s">${esc(b.preferences)}</div></div><div class="side">${esc(dans(b.dans))}</div></li>`) : [errOf(dash.anniversaires)].filter(Boolean), "Aucun anniversaire à venir (pensez à remplir l'annuaire).")}
        </section>
        <section class="blk"><h3>Événements pro <small>60 prochains jours</small></h3>
          ${list(E.length ? E.map((e) => `<li>${when(e["Date début"])}<div class="main"><div class="t">${esc(e["Événement"])}</div><div class="s">${esc(e["Lieu"])}${e["Qui y va"] ? " · " + esc(e["Qui y va"]) : ""} ${linkOf(e["Lien"], "Site")}</div></div><div class="side">${"★".repeat(Math.min(3, +e["Pertinence (1-3)"] || 0))}<br>${esc(dans(e.dans))}</div></li>`) : [errOf(dash.evenements)].filter(Boolean), "Rien à l'agenda.")}
          <form class="form" id="f-event" style="margin-top:12px">
            <div class="fr"><label>Événement<input name="Événement" required></label><label>Début<input name="Date début" type="date" required></label><label>Fin<input name="Date fin" type="date"></label></div>
            <div class="fr"><label>Lieu<input name="Lieu"></label><label>Lien<input name="Lien" type="url" placeholder="https://"></label><label>Pertinence<select name="Pertinence (1-3)"><option>1</option><option selected>2</option><option>3</option></select></label></div>
            <div><button class="btn primary small" type="submit">Ajouter à l'agenda</button></div>
          </form>
        </section>
      </div>
      <section class="blk"><h3>Une idée pour l'assistant ?</h3>
        <form class="form" id="f-idea"><div class="fr"><label>Idée, besoin ou bug<textarea name="description" required placeholder="ex. Générer automatiquement les call sheets à partir du planning"></textarea></label></div>
        <div class="fr"><label>Pôle<select name="pole"><option>Projet</option><option>Admin</option><option>RH</option><option>Office</option><option>PR</option><option>RS</option></select></label></div><div><button class="btn primary small" type="submit">Envoyer l'idée</button></div></form>
      </section>
    </div>`;
  }

  // ───────── Assistant ─────────
  const TOOL_LABELS = { tableau_de_bord: "Vue d'ensemble", lire_feuille: "Lecture registre", ajouter_ligne: "Ligne ajoutée", modifier_lignes: "Registre mis à jour", creer_projet: "Projet créé", mettre_a_jour_projet: "Projet mis à jour", creer_document_projet: "Document créé", ranger_fichier: "Fichier rangé", lister_dossier: "Dossier parcouru", chercher_drive: "Recherche Drive", lire_fichier: "Fichier lu", preparer_nda_ou_contrat: "Document juridique préparé", chercher_gmail: "Recherche Gmail", lire_fil_gmail: "Mail lu", enregistrer_piece_jointe: "Pièce jointe enregistrée", creer_brouillon: "Brouillon créé", envoyer_mail_interne: "Mail interne envoyé", signaler_achat: "Achats mis à jour", noter_idee: "Idée notée", chercher_connaissances: "Recherche dans le Cerveau", retenir: "Ajouté à la mémoire", guide_presentation: "Modèle Rumeur", voir_images: "Photos regardées", creer_presentation: "Présentation créée", creer_selection_lieux: "Sélection client créée", afficher_comparatif_devis: "Comparatif de devis", yousign_modeles_nda: "Modèles NDA Yousign", yousign_preparer_nda: "NDA préparé dans Yousign", yousign_envoyer_nda: "NDA envoyé via Yousign", yousign_statut: "Statut Yousign" };
  const SUGG = [
    ["Créer une prez", "Crée une présentation dans le modèle Rumeur (locations / moodboard / casting / storyboard). Client : … Campagne : … Je joins les photos."],
    ["Comparer des devis", "Compare ces devis (je les joins) : prix HT et TTC, ce qui est inclus ou non, écarts entre eux, points à négocier, et ta recommandation. Projet : "],
    ["Process Rumeur", "Comment ça se passe chez Rumeur pour "],
    ["Lien client lieux", "Crée un lien client pour présenter ces lieux (je joins la présentation de repérages) : "],
    ["Nouveau brief", "Nouveau projet : voici mes notes du call de brief :\n"],
    ["Envoyer un NDA", "Je veux envoyer un NDA via Yousign."],
    ["Récap d'un projet", "Fais-moi le récap du projet "],
    ["Cette semaine", "Qu'est-ce qui arrive cette semaine ? Deadlines projets, retours à traiter, anniversaires, événements."],
  ];

  // Markdown minimal et sûr : tout est échappé avant mise en forme ; liens http(s) uniquement.
  // Liens Drive, Gmail, sélections… affichés en cartes cliquables.
  function linkKind(u) {
    if (/docs\.google\.com\/document/.test(u)) return ["D", "Google Doc"];
    if (/docs\.google\.com\/spreadsheets/.test(u)) return ["S", "Google Sheet"];
    if (/docs\.google\.com\/presentation/.test(u)) return ["P", "Présentation"];
    if (/drive\.google\.com\/drive\/(u\/\d+\/)?folders/.test(u)) return ["▤", "Dossier Drive"];
    if (/drive\.google\.com|docs\.google\.com|googleusercontent/.test(u)) return ["F", "Fichier Drive"];
    if (/mail\.google\.com/.test(u)) return ["@", "Gmail"];
    if (/#sel-|lieux\.html/.test(u)) return ["★", /lieux\.html/.test(u) ? "Lien client" : "Sélection"];
    if (/#ws-/.test(u)) return ["W", "Workspace"];
    return null;
  }
  function linkHTML(label, u) {
    const k = linkKind(u);
    if (!k) return `<a href="${u}" target="_blank" rel="noopener">${label || (u.length > 60 ? u.slice(0, 57) + "…" : u)}</a>`;
    return `<a class="fcard" href="${u}" target="_blank" rel="noopener"><span class="fi" aria-hidden="true">${k[0]}</span><span class="fn">${label || k[1]}</span>${label ? `<span class="fk">${k[1]}</span>` : ""}<span class="fo" aria-hidden="true">↗</span></a>`;
  }
  function inline(s) {
    let t = esc(s);
    const links = [];
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, l, u) => { links.push(linkHTML(l, u)); return "\u0000" + (links.length - 1) + "\u0000"; });
    t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, p, u) => { links.push(linkHTML("", u)); return p + "\u0000" + (links.length - 1) + "\u0000"; });
    t = t.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    return t.replace(/\u0000(\d+)\u0000/g, (_, i) => links[+i]);
  }
  function md(text) {
    const lines = String(text || "").replace(/<actions>[\s\S]*?<\/actions>/g, "").trim().split(/\r?\n/);
    const out = []; let list = null, para = [], quote = [], anticip = false;
    const flushQuote = () => { if (quote.length) { const h = quote.map(inline).join("<br>"); out.push(`<blockquote class="${/essentiel|tl;dr|en bref/i.test(quote[0]) ? "tldr" : ""}">${h}</blockquote>`); quote = []; } };
    const flushPara = () => { if (para.length) { out.push("<p>" + para.map(inline).join("<br>") + "</p>"); para = []; } };
    const flushList = () => { if (list) { out.push(`<${list.tag}>` + list.items.map((x) => "<li>" + x + "</li>").join("") + `</${list.tag}>`); list = null; } };
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const q = l.match(/^\s*>\s?(.*)/);
      if (q) { flushPara(); flushList(); quote.push(q[1]); continue; }
      flushQuote();
      if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        flushPara(); flushList();
        const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
        let html = "<table><thead><tr>" + cells(l).map((c) => "<th>" + c + "</th>").join("") + "</tr></thead><tbody>";
        i += 2;
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { html += "<tr>" + cells(lines[i]).map((c) => "<td>" + c + "</td>").join("") + "</tr>"; i++; }
        i--; out.push(html + "</tbody></table>"); continue;
      }
      let m;
      if ((m = l.match(/^(#{1,4})\s+(.*)/))) {
        flushPara(); flushList();
        if (anticip) { out.push("</div>"); anticip = false; }
        if (/anticiper|à prévoir|points? d'attention|warnings?/i.test(m[2])) { anticip = true; out.push(`<div class="anticip"><h3>${inline(m[2].replace(/^[⚠️\s]+/, ""))}</h3>`); }
        else out.push(`<h3>${inline(m[2])}</h3>`);
        continue;
      }
      if ((m = l.match(/^\s*[-*•]\s+(?:\[( |x)\]\s+)?(.*)/i))) { flushPara(); if (!list || list.tag !== "ul") { flushList(); list = { tag: "ul", items: [] }; } list.items.push((m[1] ? (m[1].toLowerCase() === "x" ? "☑ " : "☐ ") : "") + inline(m[2])); continue; }
      if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { flushPara(); if (!list || list.tag !== "ol") { flushList(); list = { tag: "ol", items: [] }; } list.items.push(inline(m[1])); continue; }
      if (/^\s*(---|\*\*\*)\s*$/.test(l)) { flushPara(); flushList(); out.push("<hr>"); continue; }
      if (!l.trim()) { flushPara(); flushList(); continue; }
      if (anticip && out[out.length - 1] && /<\/(ul|ol)>$/.test(out[out.length - 1]) && !para.length) { out.push("</div>"); anticip = false; }
      flushList(); para.push(l);
    }
    flushQuote(); flushPara(); flushList();
    if (anticip) out.push("</div>");
    return out.join("");
  }


  // ───────── Comparatif de devis interactif (outil afficher_comparatif_devis) ─────────
  const dvState = {};
  const eur = (n, cur) => n == null || isNaN(n) ? "—" : Math.round(n).toLocaleString("fr-FR").replace(/ | /g, " ") + " " + (cur || "€");
  function dvCalc(d, st) {
    const F = d.fournisseurs || [], P = d.postes || [];
    return F.map((f, k) => {
      const sumAll = P.reduce((a, p) => a + (Number((p.montants || [])[k]) || 0), 0);
      const base = typeof f.total === "number" ? f.total : sumAll;
      const off = P.reduce((a, p, j) => a + (st.off[j] ? (Number((p.montants || [])[k]) || 0) : 0), 0);
      const miss = P.filter((p, j) => !st.off[j] && (p.montants || [])[k] == null).length;
      return { nom: f.nom, total: base - off, miss };
    });
  }
  function dvHTML(key, d) {
    const st = dvState[key] || (dvState[key] = { off: {}, sel: d.recommandation && d.recommandation.fournisseur || "" });
    const F = d.fournisseurs || [], P = d.postes || [], cur = d.devise || "€", base = d.base || "HT";
    const tot = dvCalc(d, st), vals = tot.map((t) => t.total), min = Math.min(...vals), max = Math.max(...vals, 1);
    const rec = d.recommandation && d.recommandation.fournisseur;
    const anyOff = Object.values(st.off).some(Boolean);
    const bars = tot.map((t, k) => {
      const pct = Math.max(2, (t.total / max) * 100), gap = min > 0 ? Math.round(((t.total - min) / min) * 100) : 0;
      const on = st.sel === t.nom;
      return `<button type="button" class="dv-row${on ? " on" : ""}" data-dv-sel="${esc(t.nom)}" aria-pressed="${on}">
        <span class="dv-name">${esc(t.nom)}${t.nom === rec ? `<span class="dv-badge rec">Recommandé</span>` : ""}${t.total === min && F.length > 1 ? `<span class="dv-badge low">✓ Moins cher</span>` : ""}</span>
        <span class="dv-track"><span class="dv-fill" style="width:${pct}%"></span></span>
        <span class="dv-amt"><b>${eur(t.total, cur)}</b><small>${t.total === min ? "référence" : "+" + gap + " %"}${t.miss ? ` · ${t.miss} poste${t.miss > 1 ? "s" : ""} non chiffré${t.miss > 1 ? "s" : ""}` : ""}</small></span></button>`;
    }).join("");
    const rows = P.map((p, j) => {
      const ms = (p.montants || []).map((x) => x == null ? null : Number(x));
      const nums = ms.filter((x) => x != null && !isNaN(x)), lo = nums.length > 1 ? Math.min(...nums) : null;
      return `<tr class="${st.off[j] ? "off" : ""}"><th scope="row"><label><input type="checkbox" data-dv-off="${j}" ${st.off[j] ? "" : "checked"}> ${esc(p.nom)}</label>${p.note ? `<small>${esc(p.note)}</small>` : ""}</th>${F.map((f, k) => {
        const v = ms[k];
        return `<td class="${v == null ? "miss" : v === lo ? "best" : ""}${st.sel === f.nom ? " sel" : ""}">${v == null ? "non chiffré" : eur(v, cur)}</td>`;
      }).join("")}</tr>`;
    }).join("");
    const cards = F.some((f) => (f.forts || []).length || (f.faibles || []).length || f.validite || f.lien) ? `<div class="dv-cards">${F.map((f) => `<div class="dv-card${st.sel === f.nom ? " on" : ""}"><b>${esc(f.nom)}</b>
      ${(f.forts || []).map((x) => `<p class="plus">+ ${esc(x)}</p>`).join("")}${(f.faibles || []).map((x) => `<p class="minus">− ${esc(x)}</p>`).join("")}
      ${f.validite ? `<p class="mini">${esc(f.validite)}</p>` : ""}${f.lien ? linkHTML("Ouvrir le devis", esc(f.lien)) : ""}</div>`).join("")}</div>` : "";
    return `<div class="dv-h"><div><b>${esc(d.titre || "Comparatif des devis")}</b><span class="mini">Montants ${esc(base)} · cliquez un prestataire pour le suivre dans le tableau · décochez un poste pour le retirer</span></div>
        <button type="button" class="btn small ghost" data-dv-copy="1">Copier pour Sheets</button></div>
      <div class="dv-bars" role="group" aria-label="Totaux par prestataire">${bars}</div>
      ${anyOff ? `<p class="dv-note">Totaux recalculés sans les postes décochés. <button type="button" class="linkbtn" data-dv-reset="1">Tout remettre</button></p>` : ""}
      ${P.length ? `<div class="dv-tw"><table class="dv-t"><thead><tr><th>Poste</th>${F.map((f) => `<th class="${st.sel === f.nom ? "sel" : ""}">${esc(f.nom)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody>
        <tfoot><tr><th>Total ${esc(base)}</th>${tot.map((t) => `<td class="${t.total === min ? "best" : ""}${st.sel === t.nom ? " sel" : ""}">${eur(t.total, cur)}</td>`).join("")}</tr></tfoot></table></div>` : ""}
      ${cards}
      ${d.recommandation && d.recommandation.fournisseur ? `<div class="dv-rec"><b>Recommandation : ${esc(d.recommandation.fournisseur)}</b>${d.recommandation.pourquoi ? `<p>${esc(d.recommandation.pourquoi)}</p>` : ""}</div>` : ""}
      ${(d.a_verifier || []).length ? `<div class="dv-check"><b>À vérifier avant de signer</b><ul>${d.a_verifier.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}`;
  }
  function widgetsHTML(m, mi) {
    return (m.widgets || []).map((w, wi) => w.type === "devis" && w.data ? `<div class="dv" data-dv="${mi}-${wi}">${dvHTML(mi + "-" + wi, w.data)}</div>` : "").join("");
  }
  function dvClick(e) {
    const box = e.target.closest(".dv"); if (!box) return false;
    const key = box.dataset.dv, [mi, wi] = key.split("-").map(Number), w = history[mi] && history[mi].widgets && history[mi].widgets[wi]; if (!w) return false;
    const st = dvState[key] || (dvState[key] = { off: {}, sel: "" }), d = w.data;
    const t = (sel) => e.target.closest(sel);
    if (t("[data-dv-sel]")) { const n = t("[data-dv-sel]").dataset.dvSel; st.sel = st.sel === n ? "" : n; }
    else if (t("[data-dv-off]")) { const j = +t("[data-dv-off]").dataset.dvOff; st.off[j] = !t("[data-dv-off]").checked; }
    else if (t("[data-dv-reset]")) st.off = {};
    else if (t("[data-dv-copy]")) {
      const F = d.fournisseurs || [], tot = dvCalc(d, st);
      const tsv = [["Poste"].concat(F.map((f) => f.nom))].concat((d.postes || []).filter((p, j) => !st.off[j]).map((p) => [p.nom].concat(F.map((f, k) => p.montants[k] == null ? "" : String(p.montants[k]).replace(".", ","))))).concat([["Total " + (d.base || "HT")].concat(tot.map((x) => String(Math.round(x.total))))]).map((r) => r.join("\t")).join("\n");
      navigator.clipboard.writeText(tsv).then(() => toast("Copié : collez dans Google Sheets"), () => toast("Copie impossible"));
      return true;
    } else return false;
    const y = window.scrollY; box.innerHTML = dvHTML(key, d); window.scrollTo(0, y);
    return true;
  }

  function renderAssistant() {
    const el = $("v-assistant");
    if (!el.querySelector(".chatwrap")) {
      el.innerHTML = `<div class="in chatlayout">
        <aside class="chats" id="chats" aria-label="Historique des conversations"></aside>
        <div class="chatwrap">
        <div class="msgs" id="msgs" aria-live="polite"></div>
        <div class="suggbar" id="suggbar"></div>
        <form class="composer" id="composer">
          <div class="box">
            <div class="pending" id="pending"></div>
            <textarea id="prompt" rows="1" placeholder="Écrivez à l'assistant… (collez des notes de call, déposez un brief, un devis…)" aria-label="Message"></textarea>
            <div class="bar">
              <span><button type="button" class="iconbtn" id="attach" title="Joindre un fichier" aria-label="Joindre un fichier"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.5l-8.6 8.6a5.5 5.5 0 01-7.8-7.8l9.2-9.2a3.7 3.7 0 015.2 5.2l-9.2 9.2a1.8 1.8 0 01-2.6-2.6l8.5-8.5"/></svg></button>
              <button type="button" class="iconbtn" id="newchat" title="Nouvelle conversation" aria-label="Nouvelle conversation"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>
              <button type="button" class="iconbtn histbtn" id="histbtn" title="Historique des conversations" aria-label="Historique des conversations"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 103-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg></button></span>
              <button type="submit" class="send" id="send" aria-label="Envoyer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>
            </div>
          </div>
          <p class="hint">L'assistant prépare, vous validez : les mails partent en brouillon, signatures et paiements restent humains.</p>
          <input type="file" id="file" multiple hidden>
        </form>
      </div></div>`;
      wireComposer();
    }
    renderMsgs(busy);
    renderChats();
    if (!chats && !chatsLoading) loadChats();
  }

  // ───────── Historique des conversations (stocké dans le Drive, par personne) ─────────
  async function loadChats() {
    chatsLoading = true; renderChats();
    try {
      chats = (await api("chats_list")).chats || [];
      if (history.length && !chatId) await persistChat();   // conversation en cours d'avant l'historique
    } catch (e) { chats = chats || []; }
    finally { chatsLoading = false; renderChats(); }
  }
  function ago(t) {
    const d = (Date.now() - t) / 1000;
    if (d < 3600) return Math.max(1, Math.round(d / 60)) + " min";
    if (d < 86400) return Math.round(d / 3600) + " h";
    if (d < 86400 * 7) return Math.round(d / 86400) + " j";
    return new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  }
  // Historique : recherche dans les titres et regroupement par date.
  let chatQ = "";
  const fold = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  function chatGroup(t) {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0); const day = 864e5, x = Number(t) || 0;
    if (x >= d0.getTime()) return "Aujourd'hui";
    if (x >= d0.getTime() - day) return "Hier";
    if (x >= d0.getTime() - 6 * day) return "Cette semaine";
    if (x >= d0.getTime() - 30 * day) return "Ce mois-ci";
    return "Plus ancien";
  }
  function renderChats() {
    const a = $("chats"); if (!a) return;
    a.classList.toggle("open", chatsOpen);
    if (!a.querySelector(".chats-list")) {
      a.innerHTML = `<div class="chats-h"><b>Historique</b><button type="button" class="btn small primary" data-chat-new="1">+ Nouvelle</button><button type="button" class="iconbtn chats-x" data-chat-close="1" aria-label="Fermer">×</button></div>
        <input type="search" class="chats-q" placeholder="Rechercher une conversation" aria-label="Rechercher une conversation"><div class="chats-list"></div>`;
      const q = a.querySelector(".chats-q"); q.value = chatQ;
      q.addEventListener("input", () => { chatQ = q.value; renderChats(); });
    }
    const all = chats || [], list = all.filter((c) => !chatQ.trim() || fold(c.titre).includes(fold(chatQ.trim())));
    const groups = []; list.forEach((c) => { const g = chatGroup(c.maj); let G = groups.find((x) => x.g === g); if (!G) groups.push(G = { g, items: [] }); G.items.push(c); });
    const item = (c) => `<li class="${c.id === chatId ? "on" : ""}"><button type="button" class="chat-it" data-chat-open="${esc(c.id)}"><span>${esc(c.titre)}</span><small>${esc(ago(c.maj))}</small></button>${delAsk === c.id ? `<button type="button" class="chat-del sure" data-chat-del="${esc(c.id)}">Supprimer</button>` : `<button type="button" class="chat-del" data-chat-ask="${esc(c.id)}" aria-label="Supprimer la conversation">×</button>`}</li>`;
    a.querySelector(".chats-list").innerHTML = `${chatsLoading && !all.length ? `<p class="mini">Chargement…</p>` : ""}
      ${!chatsLoading && !all.length ? `<p class="mini">Vos conversations apparaîtront ici. Elles sont enregistrées dans le Drive et visibles seulement par vous.</p>` : ""}
      ${all.length && !list.length ? `<p class="mini">Aucune conversation ne correspond.</p>` : ""}
      ${groups.map((G) => `<p class="chats-g">${G.g}</p><ul>${G.items.map(item).join("")}</ul>`).join("")}`;
  }
  async function persistChat() {
    const keep = history.filter((m) => !m.error);
    if (!keep.length) return;
    try {
      const r = (await api("chat_save", { id: chatId, messages: keep })).result || {};
      if (!r.id) return;
      chatId = r.id; store.set("rumeur_chatid_" + user.email, chatId);
      chats = (chats || []).filter(c => c.id !== r.id);
      chats.unshift({ id: r.id, titre: r.titre, maj: Date.now(), n: keep.length });
      renderChats();
    } catch (e) { /* l'historique local reste dans le navigateur */ }
  }
  async function openChat(id) {
    if (busy || id === chatId) { chatsOpen = false; renderChats(); return; }
    try {
      const c = (await api("chat_get", { id })).chat;
      history = c.messages || []; chatId = c.id; pending = [];
      store.set("rumeur_chatid_" + user.email, chatId); saveHistory();
      chatsOpen = false; renderPending(); renderMsgs(); renderChats();
    } catch (e) { toast(e.message); }
  }
  function newChat() {
    if (busy) return;
    history = []; pending = []; chatId = null; store.del("rumeur_chatid_" + user.email);
    saveHistory(); chatsOpen = false; renderPending(); renderMsgs(); renderChats();
    const ta = $("prompt"); if (ta) ta.focus();
  }

  function renderMsgs(typing) {
    const box = $("msgs"); if (!box) return;
    const sb = $("suggbar");
    if (sb) sb.innerHTML = history.length ? SUGG.slice(0, 3).map(([l, p]) => `<button type="button" class="chip small" data-ask="${esc(p)}" data-noauto="1">${esc(l)}</button>`).join("") : "";
    if (!history.length && !typing) {
      box.innerHTML = `<div class="welcome"><p class="eyebrow">Assistant Rumeur</p><h1>Bonjour ${esc((user && user.name || "").split(" ")[0])}.</h1>
        <p>Briefs, dossiers projet, NDA, factures, achats, anniversaires : demandez, l'assistant s'occupe du Drive et de Gmail.</p>
        <div class="sugg">${SUGG.map(([l, p]) => `<button type="button" class="chip" data-ask="${esc(p)}" data-noauto="1">${esc(l)}</button>`).join("")}</div></div>`;
      return;
    }
    box.innerHTML = history.map((m, mi) => {
      if (m.role === "user") return `<div class="msg me">${esc(m.display || m.content)}${m.files && m.files.length ? `<div class="files">📎 ${m.files.map(esc).join(", ")}</div>` : ""}</div>`;
      const tr = m.trace && m.trace.steps && m.trace.steps.length > 1 ? m.trace : null;
      if (tr || (m.widgets && m.widgets.length)) {
        let body = md(m.content); const wh = widgetsHTML(m, mi);
        if (wh) { const k = body.startsWith("<blockquote") ? body.indexOf("</blockquote>") + 13 : 0; body = body.slice(0, k) + wh + body.slice(k); }
        return `<div class="msg bot${wh ? " wide" : ""}${m.error ? " err" : ""}">${tr ? `<details class="trace"><summary>${tr.n} étapes · ${Math.floor(tr.ms / 60000)}:${String(Math.round(tr.ms / 1000) % 60).padStart(2, "0")}</summary><ol>${tr.steps.map((x) => `<li>${esc(x.t)}${x.d ? ` <span>${esc(x.d)}</span>` : ""}</li>`).join("")}</ol></details>` : ""}${body}</div>`;
      }
      return `<div class="msg bot${m.error ? " err" : ""}">${md(m.content)}${m.actions && m.actions.length ? `<div class="acts">${m.actions.map((a) => `<span class="tag ${a.ok ? "ok" : "hot"}">${a.ok ? "✓" : "✗"} ${esc(TOOL_LABELS[a.outil] || a.outil)}</span>`).join("")}</div>` : ""}</div>`;
    }).join("") + (typing ? `<div class="runbox" id="runbox"></div>` : "");
    if (typing && run) run.mount($("runbox"));
    box.lastElementChild && box.lastElementChild.scrollIntoView({ block: "end", behavior: "smooth" });
  }

  function saveHistory() {
    if (!user) return;
    const keep = history.filter((m) => !m.error).slice(-40);
    store.set("rumeur_chat_" + user.email, JSON.stringify(keep));
  }

  function renderPending() {
    const p = $("pending"); if (!p) return;
    p.innerHTML = pending.map((f, i) => `<span class="tag ${f.status === "error" ? "hot" : ""}">📎 ${esc(f.name)}${f.status === "uploading" ? " …" : ""}<button type="button" data-unpend="${i}" aria-label="Retirer">×</button></span>`).join("");
    const s = $("send"); if (s) s.disabled = busy || pending.some((f) => f.status === "uploading");
  }

  function readB64(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
  }

  const X = () => window.RumeurExtract || { shrink: async (f) => f, pool: async (a, n, fn) => { const o = []; for (let k = 0; k < a.length; k++) o.push(await fn(a[k], k)); return o; }, kindOf: () => "" };
  async function uploadOne(f) {
    const g = await X().shrink(f);
    return (await api("upload", { file: { name: g.name, mimeType: g.type || "application/octet-stream", data: await readB64(g) } })).file.id;
  }
  // Envoi des pièces jointes : 3 à la fois, photos lourdes réduites avant l'envoi.
  async function addFiles(files) {
    const items = [];
    for (const f of files) {
      if (f.size > 20 * 1024 * 1024) { toast(f.name + " : 20 Mo maximum"); continue; }
      const item = { name: f.name, status: "uploading", kind: X().kindOf(f), deckFile: null };
      if (item.kind === "pdf" || item.kind === "pptx") item.deckFile = f;
      pending.push(item); items.push([item, f]);
    }
    renderPending();
    await X().pool(items, 3, async ([item, f]) => {
      try { item.id = await uploadOne(f); item.status = "ok"; }
      catch (e) { item.status = "error"; toast(f.name + " : " + e.message); }
      renderPending();
    });
  }
  // Photos d'une présentation : extraites seulement si le message en a besoin (prez, lieux, casting…).
  const NEED_PHOTOS = /pr[ée]z|pr[ée]sentation|deck|slides?|diapo|lieux?|locations?|rep[ée]rages?|s[ée]lection|lien client|casting|moodboard|photos?|images?|planche|visuels?/i;
  async function extractDeck(item, wantPhotos) {
    const f = item.deckFile; if (!f || item.extraits) return;
    item.extraits = [];
    const label = (key, t, d) => { if (!run) return; if (runKey === key) run.detail(d || t); else { runKey = key; run.local(t, d); } };
    const r = await window.RumeurExtract.deck(f, (t) => label("lire" + f.name, "Lecture de " + f.name, t), { textOnly: !wantPhotos });
    if (item.kind === "pptx" && r.text) { try { item.extraits.push({ id: await uploadOne(r.text), name: r.text.name, texte: true }); } catch (e) {} }
    if (!wantPhotos || r.images.length < 3) return;
    if (item.kind === "pdf" && r.text) { try { item.extraits.push({ id: await uploadOne(r.text), name: r.text.name, texte: true }); } catch (e) {} }
    let done = 0;
    const got = await X().pool(r.images, 4, async (im) => { try { const id = await uploadOne(im); done++; label("photos" + f.name, "Envoi des photos de " + f.name, done + " / " + r.images.length); return { id, name: im.name }; } catch (e) { return null; } });
    got.filter(Boolean).forEach((g) => item.extraits.push(g));
  }

  function wireComposer() {
    const ta = $("prompt");
    const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(220, ta.scrollHeight) + "px"; };
    ta.addEventListener("input", grow);
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); $("composer").requestSubmit(); } });
    $("attach").onclick = () => $("file").click();
    $("file").onchange = (e) => { addFiles([...e.target.files]); e.target.value = ""; };
    $("newchat").onclick = newChat;
    $("histbtn").onclick = () => { chatsOpen = !chatsOpen; renderChats(); };
    $("chats").addEventListener("click", async (e) => {
      const t = (sel) => e.target.closest(sel);
      if (t("[data-chat-new]")) return newChat();
      if (t("[data-chat-close]")) { chatsOpen = false; return renderChats(); }
      if (t("[data-chat-open]")) { delAsk = null; return openChat(t("[data-chat-open]").dataset.chatOpen); }
      if (t("[data-chat-ask]")) { delAsk = t("[data-chat-ask]").dataset.chatAsk; return renderChats(); }
      if (t("[data-chat-del]")) {
        const id = t("[data-chat-del]").dataset.chatDel; delAsk = null;
        try { await api("chat_delete", { id }); chats = (chats || []).filter(c => c.id !== id); if (id === chatId) newChat(); else renderChats(); toast("Conversation supprimée"); } catch (err) { toast(err.message); }
      }
    });
    $("pending").onclick = (e) => { const b = e.target.closest("[data-unpend]"); if (b) { pending.splice(+b.dataset.unpend, 1); renderPending(); } };
    const wrap = $("v-assistant");
    wrap.addEventListener("dragover", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
    wrap.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); addFiles([...e.dataTransfer.files]); } });
    ta.addEventListener("paste", (e) => { const fs = [...(e.clipboardData && e.clipboardData.files || [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } });
    $("composer").onsubmit = async (e) => {
      e.preventDefault();
      const text = ta.value.trim();
      if ((!text && !pending.length) || busy) return;
      if (pending.some((f) => f.status === "uploading")) return;
      const files = pending.filter((f) => f.status === "ok");
      const content = text || "Voici le(s) fichier(s) joint(s).";
      history.push({ role: "user", content, files: files.map((f) => f.name) });
      ta.value = ""; grow(); pending = []; renderPending();
      busy = true; run = makeRun(); runKey = ""; renderPending(); renderMsgs(true);
      try {
        const want = NEED_PHOTOS.test(text);
        for (const f of files.filter((x) => x.deckFile && (want || x.kind === "pptx"))) {
          try { await extractDeck(f, want); } catch (err) { toast(f.name + " : photos non extraites (" + err.message + ")"); }
        }
        const msgs = history.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
        const att = []; files.forEach((f) => { if (f.id) att.push({ id: f.id, name: f.name }); (f.extraits || []).forEach((x) => att.push(x.texte ? { id: x.id, name: x.name } : { id: x.id, name: x.name, extrait: true })); });
        const out = await track("chat", { messages: msgs, attachments: att }, run);
        run.stop();
        if (out.lastUserText) history[history.length - 1].content = out.lastUserText, history[history.length - 1].display = content;
        history.push({ role: "assistant", content: out.reply + (out.memo || ""), actions: out.actions || [], widgets: out.widgets || [], trace: run.summary() });
        if ((out.actions || []).some((a) => a.ok && !/^(lire|chercher|lister|tableau)/.test(a.outil))) dash = null;
      } catch (err) {
        history.push({ role: "assistant", content: "Je n'ai pas pu répondre : " + err.message, error: true });
      } finally {
        if (run) run.stop(); run = null;
        busy = false; saveHistory(); renderPending(); renderMsgs();
        persistChat();
      }
    };
  }

  function ask(prompt, auto) {
    go("assistant");
    setTimeout(() => {
      renderAssistant();
      const ta = $("prompt"); if (!ta) return;
      ta.value = prompt; ta.dispatchEvent(new Event("input")); ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      if (auto && !/[:\s]$/.test(prompt)) $("composer").requestSubmit();
    }, 30);
  }

  // ───────── Événements globaux ─────────
  document.addEventListener("click", async (e) => {
    if (dvClick(e)) return;
    const a = e.target.closest("[data-ask]");
    if (a) { e.preventDefault(); ask(a.dataset.ask, !a.dataset.noauto); return; }
    if (e.target.closest("[data-refresh]")) { dash = null; loadDash(true); renderView(current()); return; }
    const miss = e.target.closest("[data-missing]");
    const ord = e.target.closest("[data-ordered]");
    if (miss || ord) {
      const btn = miss || ord; btn.disabled = true;
      try {
        await api(miss ? "achat_signal" : "achat_ordered", { article: btn.dataset.missing || btn.dataset.ordered });
        toast(miss ? "Signalé, merci !" : "Noté comme commandé"); dash = null; loadDash(true);
      } catch (err) { toast(err.message); btn.disabled = false; }
    }
  });

  document.addEventListener("submit", async (e) => {
    const f = e.target; if (!["f-achat", "f-event", "f-idea"].includes(f.id)) return;
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(f).entries());
    const b = f.querySelector("button[type=submit]"); b.disabled = true;
    try {
      if (f.id === "f-achat") { await api("achat_signal", { article: fd.article }); toast("Signalé, merci !"); }
      if (f.id === "f-event") {
        const dmy = (s) => (s ? s.split("-").reverse().join("/") : "");
        fd["Date début"] = dmy(fd["Date début"]); fd["Date fin"] = dmy(fd["Date fin"]); fd["Source"] = "Espace équipe";
        await api("add_event", { event: fd }); toast("Ajouté à l'agenda");
      }
      if (f.id === "f-idea") { await api("add_idea", { description: fd.description, pole: fd.pole }); toast("Idée envoyée, merci !"); }
      f.reset(); dash = null; loadDash(true);
    } catch (err) { toast(err.message); }
    finally { b.disabled = false; }
  });

  // ───────── Workspace (workspace.js) ─────────
  function renderWorkspace() { if (window.RumeurTeam && window.RumeurTeam.renderWorkspace) window.RumeurTeam.renderWorkspace(); }
  // ───────── Suivi en direct : les étapes de l'assistant s'affichent pendant qu'il travaille ─────────
  // run.local(t, d) ajoute une étape côté page ; track(action, payload, run) envoie l'appel et lit les étapes du serveur.
  function makeRun(title) {
    const items = []; let base = 0, el = null, t0 = Date.now(), timer = null, live = true;
    const fmt = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
    function li(it) {
      const n = document.createElement("li");
      n.innerHTML = `<i aria-hidden="true"></i><span class="rs-t"></span><span class="rs-d"></span>`;
      return n;
    }
    function paint() {
      if (!el || !el.isConnected) return;
      const ol = el.querySelector("ol");
      items.forEach((it, k) => {
        let n = ol.children[k]; if (!n) { n = li(it); ol.appendChild(n); }
        const state = it.done || !live || k < items.length - 1 ? "done" : "now";
        if (n.dataset.state !== state) { n.dataset.state = state; n.className = state; }
        const t = n.querySelector(".rs-t"), d = n.querySelector(".rs-d");
        if (t.textContent !== it.t) t.textContent = it.t;
        if (d.textContent !== (it.d || "")) d.textContent = it.d || "";
      });
      while (ol.children.length > items.length) ol.lastChild.remove();
      const tm = el.querySelector(".run-time"); if (tm) tm.textContent = fmt(Date.now() - t0);
      const h = el.querySelector(".run-h b"); if (h) h.textContent = live ? (title || "L'assistant travaille") : "Terminé";
      el.classList.toggle("over", !live);
    }
    const run = {
      mount(node) {
        el = node; el.classList.add("run"); el.setAttribute("aria-live", "polite");
        el.innerHTML = `<div class="run-h"><span class="run-orb" aria-hidden="true"></span><b></b><span class="run-time"></span></div><ol></ol>`;
        paint();
        if (!timer) timer = setInterval(() => { if (!el || !el.isConnected) return; const tm = el.querySelector(".run-time"); if (tm && live) tm.textContent = fmt(Date.now() - t0); }, 1000);
        return run;
      },
      local(t, d) { items.forEach((x) => x.done = true); items.push({ t, d: d || "" }); base = items.length; paint(); },
      detail(d) { if (items.length) { items[items.length - 1].d = d; paint(); } },
      server(steps) {
        items.splice(base); if (base) items.forEach((x) => x.done = true);
        (steps || []).forEach((x) => items.push({ t: x.t, d: x.d || "", done: !!x.done })); paint();
      },
      begin() { items.forEach((x) => x.done = true); base = items.length; },
      stop() { live = false; clearInterval(timer); timer = null; paint(); },
      summary() { return { n: items.length, ms: Date.now() - t0, steps: items.map((x) => ({ t: x.t, d: x.d })) }; },
      get live() { return live; },
    };
    return run;
  }
  const DEMO_STEPS = {
    chat: [["Analyse de la demande"], ["Cherche dans le Drive", "devis BODY"], ["Lit un fichier", "Devis v3.pdf"], ["Réfléchit à la suite"]],
    sel_analyze: [["Lecture des fichiers déposés", "12 fichier(s)"], ["Analyse de la présentation par l'IA", "Repère chaque lieu, son nom, ses infos et ses photos"], ["Création des fiches", "1 lieu(s)"]],
    sel_hd: [["Ouverture des liens", "4 page(s) à explorer"], ["Téléchargement des photos HD", "9 photo(s) en haute définition trouvée(s)"], ["Vérification visuelle", "Compare les photos des sites avec celles de la présentation"], ["Mise à jour des fiches"]],
    sel_from_ws: [["Import du workspace"]],
  };
  async function track(action, payload, run) {
    if (!run) return api(action, payload);
    run.begin();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    let stop = false, busyPoll = false;
    if (DEMO) {
      const seq = DEMO_STEPS[action] || []; let k = 0;
      const t = setInterval(() => { if (stop) return; k = Math.min(seq.length, k + 1); run.server(seq.slice(0, k).map(([t2, d], j) => ({ t: t2, d, done: j < k - 1 }))); }, 700);
      try { await new Promise((r) => setTimeout(r, 700 * (seq.length + 1))); return await api(action, payload); } finally { stop = true; clearInterval(t); }
    }
    const t = setInterval(async () => {
      if (stop || busyPoll) return; busyPoll = true;
      try { const j = (await api("job", { id })).job; if (!stop && j && j.steps) run.server(j.steps); } catch (e) {}
      busyPoll = false;
    }, 1500);
    try { return await api(action, Object.assign({}, payload, { job: id })); }
    finally { stop = true; clearInterval(t); }
  }
  window.RumeurTeam = { api, esc, toast, readB64, makeRun, track, linkOf, wsCodeFromHash, current, getUser: () => user, getDash: () => dash };

  // ───────── Démarrage ─────────
  if (DEMO) {
    user = { email: "demo@" + DOMAIN, name: "Démo", picture: "" };
    const bar = document.createElement("div");
    bar.className = "demobar";
    bar.innerHTML = `Mode démo : données fictives, rien n'est enregistré. <a href="${esc(location.pathname)}">Quitter</a>`;
    document.querySelector(".nav").after(bar);
  }
  renderAccount();
  const saved = !DEMO && configured && store.get("rumeur_tok");
  if (saved) setToken(saved);
  show(current());
  if (window.google && google.accounts) initGis();
})();
