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

## Migration 0009 — intégrité généalogique

La migration `0009_fine_gressill.sql` ajoute l'audit bloquant des filiations,
les contraintes d'unicité et d'auto-filiation, les triggers anti-cycle et les
index de clés étrangères. Elle vient après `0008_clever_swordsman.sql`, qui
rend la visibilité publique par défaut.

### Application et réapplication

1. Arrêter les écritures, fermer toutes les connexions à la base fichier et
   créer une copie de la base et des médias avec `backupMigrationState` vers un
   nouveau répertoire immuable.
2. Exécuter `pnpm db:migrate`. L'audit liste les identifiants incompatibles et
   interrompt l'opération avant toute mutation ; aucune correction automatique
   n'est effectuée.
3. Vérifier les données et conserver la sauvegarde jusqu'à validation humaine.
   Réexécuter `pnpm db:migrate` est idempotent : Drizzle ne réapplique pas une
   migration 0009 déjà enregistrée.

### Rollback et restauration

Le rollback opérationnel recommandé est une restauration exacte de la
sauvegarde pré-0009 avec `restoreMigrationState`, connexions et écritures
toujours arrêtées. Cette restauration remplace ensemble la base et les médias,
revient aussi à l'état du journal Drizzle antérieur à 0009, puis permet une
nouvelle application normale avec `pnpm db:migrate`.

Le script `drizzle/rollback/0009_genealogy_integrity.sql` fournit en complément
un rollback de schéma contrôlé : il retire triggers, contraintes et index tout
en recopiant les filiations compatibles. Il ne rembobine pas le journal
Drizzle ; après son emploi, restaurer la sauvegarde pré-0009 avant toute
réapplication. Ne jamais exécuter ces opérations sur une base ouverte ni sans
la sauvegarde et l'autorisation humaine requises.
