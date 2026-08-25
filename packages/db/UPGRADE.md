# Mise à jour Drizzle/libSQL (issue #46)

Versions stables retenues ensemble : `drizzle-orm@0.45.2`,
`drizzle-kit@0.31.10` et `@libsql/client@0.17.4`. La version 1 de Drizzle
étant encore une préversion, cette mise à jour reste volontairement sur la
dernière branche stable 0.x. `drizzle-orm@0.45.2` contient aussi le correctif
de sécurité sur l'échappement des identifiants (GHSA-gpj5-g38j-94v9).

Les notes de versions et guides officiels consultés sont :

- <https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v0310>
- <https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v0320>
- <https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v1beta2>
- <https://orm.drizzle.team/docs/v0-v1-changes>
- <https://github.com/drizzle-team/drizzle-orm/security/advisories/GHSA-gpj5-g38j-94v9>
- <https://github.com/tursodatabase/libsql-client-ts/releases>

Les changements cassants documentés entre les versions concernent surtout
les index PostgreSQL, les dates PostgreSQL et les APIs relationnelles. Le
projet utilise le dialecte SQLite, le query builder principal et aucune de
ces APIs. Le passage à Drizzle v1 demanderait en revanche une conversion du
format des migrations et n'est pas inclus ici.

Validation réalisée : `drizzle-kit generate` relit le dernier snapshot et
répond « No schema changes, nothing to migrate ». Le test d'intégration
`src/integration.test.ts` protège ce résultat et couvre également une vraie
base fichier, la copie/réouverture d'une base migrée, la conservation des
données, CRUD, batch, transaction, rollback et cascades de clés étrangères.
Les tests de `@testvibe/core` couvrent en complément l'import GEDCOM, y compris
son atomicité en cas d'erreur.

`@testvibe/db` reste le seul package externalisé dans Next : une fois chargé
par Node, ses imports de `@libsql/client` et `drizzle-orm` sont résolus depuis
son propre `node_modules`. L'image Docker copie l'arbre pnpm complet depuis le
builder, ce qui inclut ces dépendances runtime ; aucune copie manuelle
supplémentaire du pilote n'est nécessaire.
