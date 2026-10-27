// ───────────────────────── Historique des conversations ─────────────────────────
// Une conversation = un fichier JSON « <email>__<id>.json » dans 99 · SYSTÈME/HISTORIQUE CHATS.
// Chaque personne ne voit que ses propres conversations (email vérifié par le jeton Google).
function chatsFolder() {
  const props = PropertiesService.getScriptProperties();
  const known = props.getProperty('CHATS_FOLDER');
  if (known) { try { return DriveApp.getFolderById(known); } catch (e) {} }
  const f = subfolder(subfolder(DriveApp.getFolderById(IDS.root), '99 · SYSTÈME'), 'HISTORIQUE CHATS');
  props.setProperty('CHATS_FOLDER', f.getId());
  return f;
}
function chatKey(user) { return String(user.email).toLowerCase().replace(/[^a-z0-9@._-]/g, ''); }
function chatFile(user, id) {
  if (!/^[A-Za-z0-9]{6,40}$/.test(String(id || ''))) return null;
  const it = chatsFolder().getFilesByName(chatKey(user) + '__' + id + '.json');
  return it.hasNext() ? it.next() : null;
}

function chatsList(user) {
  const it = chatsFolder().searchFiles("title contains '" + chatKey(user).replace(/'/g, '') + "__' and trashed = false");
  const out = [];
  while (it.hasNext() && out.length < 300) {
    const f = it.next();
    const name = f.getName();
    if (name.indexOf(chatKey(user) + '__') !== 0) continue;
    let meta = {}; try { meta = JSON.parse(f.getDescription() || '{}'); } catch (e) {}
    out.push({ id: name.slice(chatKey(user).length + 2).replace(/\.json$/, ''), titre: meta.titre || 'Conversation', n: meta.n || 0, maj: f.getLastUpdated().getTime() });
  }
  return out.sort((a, b) => b.maj - a.maj).slice(0, 100);
}

function chatGet(user, id) {
  const f = chatFile(user, id);
  if (!f) throw new Error('Conversation introuvable');
  const d = JSON.parse(f.getBlob().getDataAsString());
  return { id: id, titre: d.titre, messages: d.messages || [] };
}

function chatSave(user, p) {
  const msgs = (Array.isArray(p.messages) ? p.messages : []).filter(m => m && (m.role === 'user' || m.role === 'assistant')).slice(-200)
    .map(m => ({ role: m.role, content: String(m.content || '').slice(0, 60000), display: m.display ? String(m.display).slice(0, 60000) : undefined, files: Array.isArray(m.files) ? m.files.slice(0, 20).map(String) : undefined, actions: Array.isArray(m.actions) ? m.actions.slice(0, 30) : undefined, error: m.error ? true : undefined }));
  if (!msgs.length) return { id: null };
  const first = msgs.find(m => m.role === 'user');
  const titre = String(p.titre || (first && (first.display || first.content)) || 'Conversation').replace(/\s+/g, ' ').trim().slice(0, 70);
  const body = JSON.stringify({ titre: titre, email: user.email, messages: msgs });
  const meta = JSON.stringify({ titre: titre, n: msgs.length });
  let f = p.id ? chatFile(user, p.id) : null, id = p.id;
  if (f) { f.setContent(body); f.setDescription(meta); }
  else {
    id = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    f = chatsFolder().createFile(chatKey(user) + '__' + id + '.json', body, 'application/json');
    f.setDescription(meta);
  }
  return { id: id, titre: titre };
}

function chatDelete(user, id) {
  const f = chatFile(user, id);
  if (f) f.setTrashed(true);
  return { ok: true };
}

