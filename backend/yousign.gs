// ───────────────────────── Yousign (NDA) ─────────────────────────
// Envoi des NDA validés par la direction, depuis les modèles Yousign « RUMEUR NDA … ».
// Les modèles ne sont jamais modifiés : chaque envoi crée une nouvelle demande de signature
// à partir du modèle (brouillon), puis l'active seulement après confirmation dans le chat.
//
// Propriétés du script :
//   YOUSIGN_API_KEY   clé API Yousign (à saisir à la main, jamais dans le code)
//   YOUSIGN_ENV       sandbox | production (par défaut sandbox : rien de juridiquement valable)
//   YOUSIGN_PREFIXE   début du nom des modèles à proposer (par défaut « RUMEUR NDA »)

function ysBase() {
  return prop('YOUSIGN_ENV', 'sandbox') === 'production' ? 'https://api.yousign.app/v3' : 'https://api-sandbox.yousign.app/v3';
}

function ysCall(method, path, payload) {
  const key = prop('YOUSIGN_API_KEY', '');
  if (!key) throw new Error("Yousign n'est pas encore branché : ajoutez YOUSIGN_API_KEY dans les propriétés du script.");
  const opts = { method: method, headers: { Authorization: 'Bearer ' + key }, muteHttpExceptions: true };
  if (payload !== undefined) { opts.contentType = 'application/json'; opts.payload = JSON.stringify(payload); }
  const res = UrlFetchApp.fetch(ysBase() + path, opts);
  const code = res.getResponseCode(), text = res.getContentText();
  if (code >= 300) throw new Error('Yousign ' + code + ' : ' + text.slice(0, 500));
  return text ? JSON.parse(text) : {};
}

/** Langue de signature déduite du nom du modèle (… EN … → en, sinon fr). */
function ysLocale(name) { return /\bEN\b/i.test(name) ? 'en' : 'fr'; }

/** Les modèles NDA disponibles (nom, id, langue) et, pour chacun, les emplacements à remplir. */
function ysTemplates() {
  const prefix = norm(prop('YOUSIGN_PREFIXE', 'RUMEUR NDA'));
  const out = [];
  let after = '';
  for (let page = 0; page < 10; page++) {
    const r = ysCall('get', '/templates?limit=100' + (after ? '&after=' + encodeURIComponent(after) : ''));
    (r.data || []).forEach(t => { if (norm(t.name).indexOf(prefix) === 0) out.push(t); });
    after = r.meta && r.meta.next_cursor;
    if (!after) break;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name)).map(t => {
    const d = safe(() => ysCall('get', '/templates/' + t.id));
    return {
      id: t.id, nom: t.name, langue: ysLocale(t.name),
      signataires: ((d && d.signers) || []).map(s => s.label || s.name).filter(Boolean),
      champs: ((d && (d.read_only_text_fields || d.fields)) || []).map(f => f.label || f.name).filter(Boolean),
    };
  });
}

/**
 * Crée la demande de signature en brouillon (rien n'est envoyé).
 * p = { template_id, projet, client, prestataire_nom, prestataire_email, email_demandeur, signataires?: [{label, prenom, nom, email}], champs?: [{label, texte}] }
 * La personne qui demande est ajoutée en copie (follower Yousign) : elle reçoit l'envoi puis un mail quand le NDA est signé.
 */
function ysPrepare(p, user) {
  const t = ysCall('get', '/templates/' + p.template_id);
  if (norm(t.name).indexOf(norm(prop('YOUSIGN_PREFIXE', 'RUMEUR NDA'))) !== 0) throw new Error('Ce modèle ne fait pas partie des NDA Rumeur : ' + t.name);
  const locale = ysLocale(t.name);
  const parts = String(p.prestataire_nom || '').trim().split(/\s+/);
  const signers = (p.signataires && p.signataires.length ? p.signataires : [{
    label: ((t.signers || [])[0] || {}).label || 'Prestataire',
    prenom: parts.length > 1 ? parts.slice(0, -1).join(' ') : parts[0], nom: parts.length > 1 ? parts[parts.length - 1] : parts[0], email: p.prestataire_email,
  }]).map(s => ({ label: s.label, info: { first_name: s.prenom, last_name: s.nom, email: s.email, locale: locale } }));
  if (signers.some(s => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.info.email || ''))) throw new Error('Adresse email du signataire invalide.');
  const domain = '@' + prop('ALLOWED_DOMAIN', 'rumeur.paris');
  const cc = String(p.email_demandeur || user.email).trim().toLowerCase();
  if (!cc.endsWith(domain)) throw new Error('La personne en copie doit avoir une adresse ' + domain + '.');
  const placeholders = { signers: signers };
  if (p.champs && p.champs.length) placeholders.read_only_text_fields = p.champs.map(c => ({ label: c.label, text: String(c.texte) }));
  const name = 'NDA — ' + p.prestataire_nom + ' — ' + p.projet + ' (' + p.client + ') — ' + Utilities.formatDate(new Date(), TZ, 'dd.MM.yy');
  const sr = ysCall('post', '/signature_requests', {
    name: name.slice(0, 128), delivery_mode: 'email', template_id: p.template_id, template_placeholders: placeholders,
    external_id: 'rumeur-' + Utilities.getUuid().slice(0, 8),
  });
  ysCall('post', '/signature_requests/' + sr.id + '/followers', [{ email: cc, locale: locale }]);
  // Mémorise qui a préparé ce brouillon : seul cette personne pourra l'envoyer.
  CacheService.getScriptCache().put('ys_' + sr.id, JSON.stringify({ by: user.email, name: name, modele: t.name, emails: signers.map(s => s.info.email), copie: cc, projet: p.projet, client: p.client, prestataire: p.prestataire_nom }), 21600);
  appendObj('admin', {
    'Date': today(), 'Type': 'NDA (Yousign)', 'Prestataire ou client': p.prestataire_nom, 'Email': p.prestataire_email || '',
    'Projet lié': p.projet + ' — ' + p.client, 'Statut': 'brouillon Yousign', 'Lien document': 'yousign:' + sr.id, 'Demandé par': user.email,
  });
  logAction(user, 'NDA Yousign préparé (brouillon) : ' + name + ' — modèle ' + t.name, 'Admin');
  return {
    brouillon: true, id: sr.id, nom: name, modele: t.name, environnement: prop('YOUSIGN_ENV', 'sandbox'),
    signataires: signers.map(s => s.label + ' : ' + s.info.first_name + ' ' + s.info.last_name + ' <' + s.info.email + '>'),
    copie: cc + ' (reçoit l’envoi et un mail quand le NDA est signé)',
    a_faire: "Montre ce récapitulatif à la personne et attends un oui explicite avant d'appeler yousign_envoyer_nda.",
  };
}

/** Envoie (active) une demande préparée, uniquement par la personne qui l'a préparée et après confirmation. */
function ysSend(p, user) {
  if (!p.confirme) throw new Error("Demandez d'abord confirmation à la personne (modèle, projet, client, nom et mail), puis rappelez avec confirme=true.");
  const meta = CacheService.getScriptCache().get('ys_' + p.id);
  if (!meta) throw new Error('Brouillon Yousign inconnu ou expiré (6 h) : préparez-le à nouveau.');
  const m = JSON.parse(meta);
  if (m.by !== user.email) throw new Error('Seule la personne qui a préparé ce NDA peut l’envoyer.');
  const r = ysCall('post', '/signature_requests/' + p.id + '/activate', {});
  updateWhere('admin', 'Lien document', 'yousign:' + p.id, { 'Statut': 'envoyé Yousign' });
  logAction(user, 'NDA envoyé via Yousign : ' + m.name + ' → ' + m.emails.join(', '), 'Admin');
  return { envoye: true, statut: r.status || 'ongoing', nom: m.name, destinataires: m.emails, copie: m.copie, environnement: prop('YOUSIGN_ENV', 'sandbox') };
}

/** Statut d'une demande (pour « le NDA de X est signé ? »). */
function ysStatus(id) {
  const r = ysCall('get', '/signature_requests/' + id);
  return { id: r.id, nom: r.name, statut: r.status, signataires: (r.signers || []).map(s => (s.info ? s.info.email : '') + ' : ' + s.status) };
}

/** Test depuis l'éditeur : liste les modèles NDA vus par la clé (aucune création, aucun envoi). */
function testerYousign() {
  console.log('Environnement :', prop('YOUSIGN_ENV', 'sandbox'));
  console.log(JSON.stringify(ysTemplates(), null, 2));
}
