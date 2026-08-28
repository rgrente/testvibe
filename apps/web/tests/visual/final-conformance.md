# Matrice finale de conformité — #85.6

Source normative : archive SHA-256 `64ffe56f2c10c5e9506a4cb338f3d5e2c3f002658e8e87a5257faef14da0056b`. Base auditée : `origin/main` après la tranche #85.5. Viewports : desktop `1264×730` (timeline 1c : `1000×730`) et mobile `390×844`. Les PNG suivis ne sont pas régénérés par cet audit.

Statut unique : **Conforme** signifie que la capture/pixel-diff et la géométrie applicables restent sous les seuils documentés, et que `final-conformance.spec.ts` valide landmark/titre, noms et états accessibles, cibles 24 px ou espacement équivalent (WCAG 2.5.8), focus visible 2 px, contraste AA, absence de débordement et absence de motion quand `prefers-reduced-motion: reduce`.

| Écran / zone | Preuve reproductible | Statut | Priorité de l’écart | Correction / test |
|---|---|---|---|---|
| 1a — arbre desktop | `tree-conformance.spec.ts` → `tree-desktop-1264x730.png`, géométrie canevas/toolbar ±8 px ; `final-conformance.spec.ts` « 1a/1b arbre — desktop » | **Conforme** | Mineure, corrigée | Retrait des arêtes React Flow sans action du parcours clavier ; focus global et contraste des bandes de génération testés. |
| 1b — arbre mobile | `tree-conformance.spec.ts` → `tree-mobile-390x844.png`, géométrie titre/générations/fratrie ±8 px ; audit transversal mobile | **Conforme** | Mineure, corrigée | Landmark/titre de fixture explicités et compteurs de génération portés au contraste AA. |
| 1c — timeline | `timeline-conformance.spec.ts` → captures desktop/mobile et dimensions des colonnes ; audit transversal aux deux viewports | **Conforme** | Aucune résiduelle | Défilement horizontal borné à `timeline-scroll`, document masqué en X par le shell ; clavier, focus et motion testés. |
| 1d — fiche personne | `person-profile-conformance.spec.ts` → captures desktop/mobile, régions Identité/Relations ±8 px, cible document ≥44 px ; audit transversal | **Conforme** | Aucune résiduelle | Nom accessible du média fourni par son image ; sémantique, cibles, responsive, contraste et focus vérifiés sans correction produit supplémentaire. |
| 1e — éventail | `secondary-views-conformance.spec.ts` → deux captures, deux pixel-diffs directs `reference-1e/fan.png`, navigation Entrée ; audit transversal | **Conforme** | Mineure, corrigée | Titre principal de fixture explicité ; graphe SVG, toolbar, cibles et activation clavier vérifiés. |
| 1e — statistiques | deux captures, pixel-diffs directs `reference-1e/statistics.png`, métriques nominal/vide ; audit transversal | **Conforme** | Mineure, corrigée | Rang `#1` porté de `slate-400` à `slate-600` pour WCAG AA ; sémantique des métriques et responsive testés. |
| 1e — carte | deux captures, pixel-diffs directs `reference-1e/map.png`, filtres↔URL, marqueur↔dialogue, vide ; audit transversal | **Conforme** | Mineure, corrigée | Texte de chargement et attribution portés à `slate-600` ; contrôles Leaflet, filtres, focus, cibles et absence de débordement testés. |
| 1e — GEDCOM | deux captures, pixel-diffs directs `reference-1e/gedcom.png`, import requis/export/erreur atomique ; audit transversal | **Conforme** | Aucune résiduelle | Landmark, titres, alertes, fichier requis, contrôles, contraste et focus vérifiés. |
| 1e — ce jour-là | deux captures, pixel-diffs directs `reference-1e/on-this-day.png`, date/retour/nominal/vide ; audit transversal | **Conforme** | Aucune résiduelle | Formulaire GET, liens d’événements, cibles, contraste, responsive et focus vérifiés. |
| Shell desktop | captures 1a–1e ; `AppShell.test.tsx` ; chaque cas desktop de `final-conformance.spec.ts` | **Conforme** | Mineure, corrigée | Contrat global `:focus-visible` 2 px ; token muted renforcé pour contraste AA de la navigation et du footer. |
| Navigation mobile | captures mobiles 1b–1e ; `AppShell.test.tsx` ; chaque cas mobile de l’audit | **Conforme** | Aucune résiduelle | `aria-current`, noms, cibles/espacement, focus et largeur document validés sur toutes les vues. |
| Toolbars arbre/timeline | `SharedToolbar.test.tsx`, `FamilyTreeViews.test.tsx`, `TimelineControls.test.tsx`, suites visuelles et audit transversal | **Conforme** | Aucune résiduelle | Rôles/noms, `aria-pressed`, activation clavier, cibles et focus vérifiés. |
| Tokens couleur/espacement/rayons | `globals.css`, pixel-diffs 1a–1e et scanner de contraste de `final-conformance.spec.ts` | **Conforme** | Mineure, corrigée | `--color-muted` passe de 58 % à 62 % d’opacité ; seuil texte AA 4,5:1 contrôlé sur les deux viewports de chaque vue. |
| Polices Instrument Sans / JetBrains Mono | `layout.tsx`, `globals.css`, attente `document.fonts.ready` dans toutes les suites visuelles | **Conforme** | Aucune résiduelle | Chargement et variables de polices exercés avant chaque preuve visuelle ; aucune substitution opportuniste de baseline. |

## Écarts résiduels et décisions

Aucune divergence matérielle non décidée ne subsiste. Les écarts observés par le test rouge étaient bornés à la sémantique des fixtures, au parcours clavier d’arêtes sans action et à plusieurs textes sous 4,5:1. Ils sont tous corrigés et couverts par le test vert. Aucun redesign, modèle, donnée, migration, baseline, infrastructure ou comportement métier n’a été ajouté ou modifié.

## Commandes de preuve

Depuis la racine, avec le runtime et le cache Playwright prescrits par `project-conventions` :

- audit transversal ciblé : `pnpm --filter @testvibe/web exec playwright test --config playwright.config.ts tests/visual/final-conformance.spec.ts` ;
- références et captures 1a–1e : `pnpm --filter @testvibe/web test:visual` ;
- vérification projet : `pnpm build`, puis `pnpm lint`, puis `pnpm test`.
