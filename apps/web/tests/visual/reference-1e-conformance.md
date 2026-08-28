# Matrice de conformité — référence 1e

Source normative : archive SHA-256 `64ffe56f2c10c5e9506a4cb338f3d5e2c3f002658e8e87a5257faef14da0056b`, carte 1e, lignes 335–434 de `Arbre Genealogique.dc.html`. Décision produit : option B (aucune fonction ou donnée factice).

Les captures Playwright sont prises sur les composants de production à 1264×730 et 390×844. Elles refusent un diff non masqué supérieur à 5 % et tout débordement de page. Les assertions de `secondary-views-conformance.spec.ts` contrôlent les zones structurantes avec une tolérance de ±8 px lorsqu'une dimension normative a un équivalent produit. Les différences fonctionnelles approuvées ci-dessous ne sont pas incluses dans une comparaison pixel trompeuse.

| Zone 1e | Équivalent produit exercé | Mesure applicable | Écart justifié |
|---|---|---|---|
| Éventail, titre/résumé/carte (337–353) | `FamilyTreeViews` → toolbar réelle → `FamilyTreeFanChart` | capture entière ≤5 % par viewport; focus 2 px; navigation Entrée; scroll interne uniquement | le produit conserve son graphe SVG navigable au lieu des anneaux décoratifs 1e |
| Statistiques, métriques (355–363) | `StatisticsView`, cinq métriques réelles | capture entière ≤5 %; 5 cartes; hauteur carte 80±8 px | âge moyen et complétude 1e absents; unions, événements, profondeur et longévité existants conservés |
| Statistiques, graphe décennal (364–374) | pyramide des âges et trois classements réels | structure, sémantique, états vide/chargement/erreur; pas de pixel-diff 1e | aucune statistique « naissances par décennie » dans le contrat produit |
| Carte, carte/liste (377–393) | `CarteClient` → `MapClient`/`LeafletMap` | capture entière ≤5 %; filtres↔URL, marqueur↔détail, vide, attribution et liste | données réelles détaillées et filtres conservés; la maquette 1e agrège 9 lieux sans contrat correspondant |
| GEDCOM (395–413) | vraie page import/export 5.5.1 | capture entière ≤5 %; required, import, export, erreur atomique/retry, focus et cibles 44 px | rapprochement, progression, doublons et fusion 1e sont des fonctions inexistantes explicitement hors périmètre |
| Ce jour-là (415–434) | `OnThisDayView` avec formulaire réel et données stables | capture entière ≤5 %; date, retour aujourd'hui, nominal/vide, ordre clavier, focus et cibles 44 px | règles calendaires et prochains anniversaires réels conservés; nombres/dates de la fixture sont déterministes |

## Matrice états et preuves

| Vue | Nominal | Vide | Chargement | Erreur | Interactions / accessibilité |
|---|---|---|---|---|---|
| Éventail | captures 2 viewports | layout testé avec arbre borné | composant synchrone, non applicable | navigation couverte par tests unitaires | toolbar réelle, Entrée/Espace, focus SVG 2 px, scroll interne |
| Statistiques | fixture `StatisticsView` | `state=empty` | `app/statistiques/loading.test.tsx` | `app/statistiques/error.test.tsx` | régions, listes et géométrie |
| Carte | fixture `CarteClient` | `state=empty` | texte réel « Chargement de la carte… » | absence de tuiles tolérée, liste reste disponible | personne/date/branche↔URL, marqueur↔dialogue, attribution |
| GEDCOM | page réelle | fichier requis couvre l'absence de sélection | soumission native/server action | `state=error`, atomicité annoncée | import, export, retry par nouvelle soumission, focus/cibles |
| Ce jour-là | `OnThisDayView` | `state=empty` | rendu serveur atomique, non applicable | accès données couvert par frontière Next | date/GET, retour aujourd'hui, liens événements, focus/cibles |

Les baselines ne remplacent pas la référence : cette matrice borne explicitement les zones comparables et les écarts fonctionnels acceptés par la décision option B.
