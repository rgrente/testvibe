# Conformité visuelle de l’arbre

Les deux captures de référence couvrent la fixture stable Grente–Renault sur les
viewports normatifs 1a (`1264×730`) et 1b (`390×844`). La configuration refuse
plus de 5 % de pixels différents et le test refuse un déplacement supérieur à
8 px pour les repères structurels du canevas, des contrôles et des
sections mobiles.

La fixture reprend l’archive de l’issue #85, SHA-256
`64ffe56f2c10c5e9506a4cb338f3d5e2c3f002658e8e87a5257faef14da0056b` :
10 personnes, 3 générations, 3 genres, 2 unions, une fratrie de 4 personnes,
des dates partielles et un nom long. La route de capture répond 404 sauf quand
le serveur est lancé par Playwright avec `TREE_VISUAL_FIXTURE=1`.

Exécution reproductible :

1. `pnpm exec playwright install chromium-headless-shell`
2. depuis `apps/web`, `pnpm test:visual`

Une évolution approuvée de la référence se régénère explicitement avec
`pnpm test:visual -- --update-snapshots`; les PNG modifiés doivent être relus
dans la PR, jamais acceptés automatiquement.
