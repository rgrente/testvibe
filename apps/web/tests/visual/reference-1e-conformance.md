# Matrice de conformité — référence 1e

Source normative : archive SHA-256 `64ffe56f2c10c5e9506a4cb338f3d5e2c3f002658e8e87a5257faef14da0056b`, carte 1e, lignes 335–434 de `Arbre Genealogique.dc.html`. Décision produit : option B (aucune fonction ou donnée factice).

Les cinq crops complets sous `reference-1e/*.png` sont rendus directement depuis les cinq `.dv-card` des lignes 337–434 de la source normative, avec Chromium 1161, viewport source 1400×900, locale `fr-FR`, fonts chargées et sans masque. Le test découpe des rectangles explicites contenant les données ou libellés comparables, les redimensionne à la zone produit quand le responsive l'impose, puis applique le comparateur PNG de Playwright (`pixelmatch`, seuil couleur 0,2) sur chaque rectangle intégral et non masqué : diff pixel ≤5 % aux deux viewports. Les assertions de padding contrôlent en parallèle la géométrie structurante à ±8 px.

SHA-256 complets : `fan.png` `482a2ad8fc4e8868234a0cf5961b85d13f085e07a658017665dc14bd614829d0`, `statistics.png` `b69972c69de971d5c6957c2316fe25099eec1bfbca08329652da174d4b8cdbe3`, `map.png` `88fb9a9af090c7c700406607cc6b920448095de1438fcc45a74eca7891ff2118`, `gedcom.png` `f0e7db3663fd4771992e41a8ea89c8260683a78ffebe7c354f5fe236f7a7d339`, `on-this-day.png` `f10a5579cdbc035a053790a78d979b5702221fb898c3f42a0ba7d92d25183bc5`.

Régénération bornée depuis la racine du dépôt : définir `REFERENCE_CHROMIUM_EXECUTABLE` vers le binaire Chromium 1161 installé par Playwright, puis exécuter `python3 apps/web/tests/visual/generate-reference-1e.py /chemin/archive.zip`. Ajouter `--check` pour rendre dans un répertoire temporaire, vérifier le SHA-256 normatif de l'archive, les cinq SHA ci-dessus et les fichiers suivis sans les modifier. Le générateur extrait l'archive dans un répertoire temporaire avec garde anti-traversée, charge `Arbre Genealogique.dc.html#1e`, attend `document.fonts.ready`, capture exactement les cinq cartes dans leur ordre source et échoue au premier hash divergent.

Rectangles 1e dans les crops complets (`x,y,largeur,hauteur`, pixels source) : Éventail `(0,0,394,39)` ; Statistiques/12 personnes `(20,70,145,65)` ; Carte/Rennes `(3,248,103,94)` ; GEDCOM `(0,0,394,39)` ; Ce jour-là/union `(0,46,392,102)`. Les deux premiers/derniers rectangles de titre ou ligne incluent leur surface et leur espacement structurant, et non une bande de bordure isolée.

| Zone 1e | Équivalent produit exercé | Mesure applicable | Écart justifié |
|---|---|---|---|
| Éventail, titre/résumé/carte (337–353) | `FamilyTreeViews` → toolbar réelle → `FamilyTreeFanChart` | rectangle titre+surface intégral ≤5 % par viewport; padding 20±8 px; focus 2 px; cible SVG 44 px; navigation Entrée | le produit conserve son graphe SVG navigable au lieu des anneaux décoratifs 1e |
| Statistiques, métriques (355–363) | `StatisticsView`, cinq métriques réelles | carte « 12 PERSONNES » intégrale ≤5 %; padding 12±8 px; valeurs 12/3 générations; 5 cartes | âge moyen et complétude 1e absents; unions, événements, profondeur et longévité existants conservés |
| Statistiques, graphe décennal (364–374) | pyramide des âges et trois classements réels | structure, sémantique, états vide/chargement/erreur; pas de pixel-diff 1e | aucune statistique « naissances par décennie » dans le contrat produit |
| Carte, carte/liste (377–393) | `CarteClient` → `MapClient`/`LeafletMap` | rectangle intégral centré sur « Rennes (35) » ≤5 %; filtres↔URL, marqueur↔détail, vide, attribution et liste | données réelles détaillées et filtres conservés; l'agrégation « 9 lieux » sans contrat reste structurelle |
| GEDCOM (395–413) | vraie page import/export 5.5.1 | rectangle titre+surface « Import GEDCOM » intégral ≤5 %; padding 20±8 px; import/export/retry contrôlés | progression, doublons et fusion 1e sont des fonctions inexistantes explicitement hors périmètre |
| Ce jour-là (415–434) | `OnThisDayView` avec formulaire réel et données stables | rectangle intégral de l'événement Union ≤5 %; padding 11±8 px; date, retour, nominal/vide, focus/cibles | règles calendaires et prochains anniversaires réels conservés; nombres/dates de la fixture sont déterministes |

## Matrice états et preuves

| Vue | Nominal | Vide | Chargement | Erreur | Interactions / accessibilité |
|---|---|---|---|---|---|
| Éventail | captures 2 viewports | layout testé avec arbre borné | composant synchrone, non applicable | navigation couverte par tests unitaires | toolbar réelle, Entrée/Espace, focus SVG 2 px, scroll interne |
| Statistiques | fixture `StatisticsView` | `state=empty` | `app/statistiques/loading.test.tsx` | `app/statistiques/error.test.tsx` | régions, listes et géométrie |
| Carte | fixture `CarteClient` | `state=empty` | texte réel « Chargement de la carte… » | absence de tuiles tolérée, liste reste disponible | personne/date/branche↔URL, marqueur↔dialogue, attribution |
| GEDCOM | page réelle | fichier requis couvre l'absence de sélection | soumission native/server action | `state=error`, atomicité annoncée | import, export, retry par nouvelle soumission, focus/cibles |
| Ce jour-là | `OnThisDayView` | `state=empty` | rendu serveur atomique, non applicable | accès données couvert par frontière Next | date/GET, retour aujourd'hui, liens événements, focus/cibles |

Les baselines ne remplacent pas la référence : les dix calculs directs consomment les crops 1e et le même comparateur que `toHaveScreenshot`, tandis que cette matrice borne explicitement les rectangles comparables et les écarts fonctionnels acceptés par la décision option B.
