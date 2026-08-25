# Contrôle visuel responsive — migration Tailwind CSS 4

Contrôle effectué le 25 août 2026 avec Chromium (Playwright 1.55), le serveur
Next.js de développement et la base de démonstration locale. Chaque route a été
capturée en plein écran à **390 × 844 px** (mobile) et **1440 × 900 px**
(desktop), puis les deux rendus ont été inspectés visuellement.

| Vue | Route contrôlée | Résultat |
| --- | --- | --- |
| Arbre | `/` | Mise en page, recherche, sélecteur, bascule mobile et zone interactive contenus dans le viewport. |
| Personne | `/persons/3` | En-tête, métadonnées, timeline et liens lisibles sans débordement. |
| Timeline | `/timeline` | Légende, noms, graduations, barres et événements restent alignés ; défilement horizontal interne utilisable sur mobile. |
| Carte | `/carte` | Filtres empilés sur mobile, carte et liste d'événements correctement dimensionnées. |
| Connexion | `/admin/login` | Formulaire lisible et utilisable aux deux largeurs. |
| Administration | `/admin` (session locale) | Cartes et navigation lisibles aux deux largeurs après correction du repli de la navigation. |

## Anomalie détectée et corrigée

La navigation secondaire d'administration ne se repliait pas et élargissait les
pages `/admin/login` et `/admin` à 451 px sur un viewport de 390 px. Les groupes
de liens et le conteneur acceptent désormais le retour à la ligne ; les nouvelles
captures mesurent bien 390 px de large et ne présentent plus de débordement
horizontal.

Les styles de bordure, arrondis et ombres issus de la migration, ainsi que les
styles React Flow et Leaflet visibles sur ces pages, ne montrent pas d'autre
régression responsive liée à Tailwind CSS 4.
