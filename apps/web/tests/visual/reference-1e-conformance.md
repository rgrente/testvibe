# Matrice de conformité — référence 1e

Source normative : archive SHA-256 `64ffe56f2c10c5e9506a4cb338f3d5e2c3f002658e8e87a5257faef14da0056b`, carte 1e, lignes 335–434 de `Arbre Genealogique.dc.html`. Décision produit : option B (aucune fonction ou donnée factice).

Les cinq crops complets sous `reference-1e/*.png` sont rendus directement depuis les cinq `.dv-card` des lignes 337–434 de la source normative, avec Chromium 1161, fonts chargées et sans masque. Le test compare ensuite, aux deux viewports, une bande contiguë surface+bordure de 4×24 px de chaque crop à la même zone de la vraie surface : diff pixel ≤5 %, seuil couleur Playwright 0,2. Les captures de page protègent séparément la surface livrée et le débordement. Les assertions contrôlent les zones structurantes avec une tolérance de ±8 px lorsqu'une dimension normative a un équivalent produit ; aucun crop de contenu n'est revendiqué pour les différences fonctionnelles approuvées.

SHA-256 des crops : `fan` `482a2ad8…`, `statistics` `b69972c6…`, `map` `88fb9a9a…`, `gedcom` `f0e7db36…`, `on-this-day` `f10a5579…`. La génération est reproductible par rendu des cartes 1e de l'archive vérifiée ; les images, et non des baselines issues de l'application, sont l'entrée du calcul direct.

| Zone 1e | Équivalent produit exercé | Mesure applicable | Écart justifié |
|---|---|---|---|
| Éventail, titre/résumé/carte (337–353) | `FamilyTreeViews` → toolbar réelle → `FamilyTreeFanChart` | crop 1e surface/bordure ≤5 % par viewport; focus 2 px; cible SVG 44 px; navigation Entrée; scroll interne uniquement | le produit conserve son graphe SVG navigable au lieu des anneaux décoratifs 1e |
| Statistiques, métriques (355–363) | `StatisticsView`, cinq métriques réelles | crop 1e surface/bordure ≤5 %; valeurs comparables 12 personnes/3 générations; 5 cartes; hauteur carte 80±8 px | âge moyen et complétude 1e absents; unions, événements, profondeur et longévité existants conservés |
| Statistiques, graphe décennal (364–374) | pyramide des âges et trois classements réels | structure, sémantique, états vide/chargement/erreur; pas de pixel-diff 1e | aucune statistique « naissances par décennie » dans le contrat produit |
| Carte, carte/liste (377–393) | `CarteClient` → `MapClient`/`LeafletMap` | crop 1e surface/bordure ≤5 %; filtres↔URL, marqueur↔détail, vide, attribution et liste | données réelles détaillées et filtres conservés; la maquette 1e agrège 9 lieux sans contrat correspondant |
| GEDCOM (395–413) | vraie page import/export 5.5.1 | crop 1e surface/bordure ≤5 %; required, import valide mocké, export mocké, erreur atomique/retry, focus et cibles 44 px | rapprochement, progression, doublons et fusion 1e sont des fonctions inexistantes explicitement hors périmètre |
| Ce jour-là (415–434) | `OnThisDayView` avec formulaire réel et données stables | crop 1e surface/bordure ≤5 %; date, retour aujourd'hui, nominal/vide, ordre clavier, focus et cibles 44 px | règles calendaires et prochains anniversaires réels conservés; nombres/dates de la fixture sont déterministes |

## Matrice états et preuves

| Vue | Nominal | Vide | Chargement | Erreur | Interactions / accessibilité |
|---|---|---|---|---|---|
| Éventail | captures 2 viewports | layout testé avec arbre borné | composant synchrone, non applicable | navigation couverte par tests unitaires | toolbar réelle, Entrée/Espace, focus SVG 2 px, scroll interne |
| Statistiques | fixture `StatisticsView` | `state=empty` | `app/statistiques/loading.test.tsx` | `app/statistiques/error.test.tsx` | régions, listes et géométrie |
| Carte | fixture `CarteClient` | `state=empty` | texte réel « Chargement de la carte… » | absence de tuiles tolérée, liste reste disponible | personne/date/branche↔URL, marqueur↔dialogue, attribution |
| GEDCOM | page réelle | fichier requis couvre l'absence de sélection | soumission native/server action | `state=error`, atomicité annoncée | import, export, retry par nouvelle soumission, focus/cibles |
| Ce jour-là | `OnThisDayView` | `state=empty` | rendu serveur atomique, non applicable | accès données couvert par frontière Next | date/GET, retour aujourd'hui, liens événements, focus/cibles |

Les baselines ne remplacent pas la référence : les dix calculs directs consomment les crops 1e, tandis que cette matrice borne explicitement la zone comparable et les écarts fonctionnels acceptés par la décision option B.
