# Radar Rumeur — règles de la mise à jour quotidienne

Le Radar (onglet public du site) montre ce qui bouge dans le luxe, la mode et la beauté, avec l'angle business de Rumeur (agence de production créative à Paris : films, photo, contenus, activations). Il est mis à jour **chaque matin de semaine** par une tâche planifiée.

## Ce que la tâche modifie

- **Uniquement** `radar-data.js` (et éventuellement des images dans `img/`). Ne jamais toucher `index.html`, `team.js`, `workspace.js`, `config.js` ni `backend/`.
- `window.RADAR_UPDATED = "AAAA-MM-JJ"` : date du jour de la mise à jour.
- `window.RADAR_ROWS = [...]` : la liste des signaux (JSON valide, une entrée par signal).

## Format d'un signal

```json
{
  "id": "20261022-dior-a24",
  "date": "2026-10-22",
  "semaine": "2026-W43",
  "semaineLabel": "19 – 23 oct.",
  "categorie": "cible",
  "marque": "Dior",
  "titre": "Ce qui s'est passé, en une phrase factuelle (avec la date si utile).",
  "pourquoi": "Pourquoi c'est une opportunité ou un signal pour Rumeur, en une ou deux phrases simples.",
  "priorite": 2,
  "source": "FashionNetwork, 21/10",
  "url": "https://…",
  "img": "https://… (optionnel : image d'illustration de l'article, og:image)",
  "echeance": "2026-10-28",
  "echeanceLabel": "Journée investisseurs (optionnel, seulement si un événement daté arrive)"
}
```

- `categorie` : `cible` (marques que Rumeur veut gagner), `client` (clients actuels), `groupe` (groupes du luxe/beauté), `nouveau` (nouvelles maisons, arrivées en France), `agence` (agences, concurrents, nominations côté agences).
- `priorite` : **3** = à la une (nouveau DA, changement d'agence, gros lancement, budget en mouvement chez une cible ou un client) ; **2** = utile ; **1** = à garder en tête. Les signaux de priorité 3 restent « À la une » 5 jours.
- `semaine` = semaine ISO de `date` ; `semaineLabel` = « lundi – vendredi » de cette semaine, au format `19 – 23 oct.`.
- `pourquoi` parle à l'équipe Rumeur : qui contacter, quel besoin de contenus, quel timing. Pas de jargon.

## Règles

- 3 à 8 nouveaux signaux par jour ouvré, publiés dans les **2 derniers jours**. Mieux vaut 3 bons signaux que 8 faibles. S'il n'y a rien de solide, ne rien ajouter.
- Pas de doublon : ne pas reprendre une info déjà présente (même `url`, ou même marque + même sujet). Si un sujet existant évolue, ajouter un nouveau signal qui le dit.
- Chaque signal a une source réelle et un lien vérifié. Ne jamais inventer un fait, une date, un nom ou un chiffre.
- Image : seulement l'image d'illustration publiée par l'article (og:image), en URL https ; sinon pas de champ `img` (le site affiche alors une couverture typographique).
- Garder les signaux des **8 dernières semaines**, supprimer les plus anciens.

## Sources à privilégier

FashionNetwork, Business of Fashion, WWD, Journal du Luxe, Premium Beauty News, Cosmetics Business, Modaes, Stratégies, CB News, LBB Online, Global Cosmetics News, J'ai un pote dans la com, TRBusiness, Les Échos (luxe), Vogue Business.

## Marques suivies (à compléter par l'équipe)

- **Clients** : L'Oréal Luxe (YSL Beauty, Armani Beauty, Prada Beauty, Aesop…), Veuve Clicquot.
- **Cibles** : Dior, Saint Laurent, Jean Paul Gaultier, Miu Miu, Chanel, Hermès, Louis Vuitton, Guerlain, Lancôme, Cartier, Van Cleef & Arpels, Loewe, Celine.
- **Groupes** : LVMH, Kering, L'Oréal, Puig, Coty, Estée Lauder, Richemont, Shiseido, Chanel.
- **Agences à surveiller** : BETC, Publicis Luxe, Havas, Mazarine, Wonderful Paris, Prodigious, Iconoclast, Division.
