# Radar Rumeur · Espace équipe

https://alexrumeur.github.io/radar-rumeur/

- **Radar** (public) — veille hebdomadaire luxe : nouveaux DA, lancements, activations, agences. Données dans `index.html` (`rows=[…]`).
- **Assistant** (équipe @rumeur.paris) — chat avec Claude relié au Drive et à Gmail : brief → fiche + dossier projet, suivi projet, NDA et contrats freelance, achats, rappels.
- **Projets** — registre des projets, retours client à traiter, livraisons en attente.
- **Admin** — PO manquants, factures fournisseurs à payer, NDA et contrats non signés.
- **Office** — achats du bureau, anniversaires, événements pro, boîte à idées.

| Fichier | Rôle |
|---|---|
| `index.html` | Radar + structure des onglets |
| `team.js`, `team.css` | Espace équipe (connexion, assistant, tableaux de bord) |
| `config.js` | URL du backend et ID client Google (non secrets) |
| `backend/Code.gs`, `backend/appsscript.json` | Backend Google Apps Script |
| `SETUP.md` | Mise en service pas à pas |
