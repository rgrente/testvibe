# testvibe — Arbre généalogique personnel

Monorepo pnpm workspaces pour le projet d'arbre généalogique personnel.

## Structure

```
apps/web       Application Next.js 16 (App Router, TypeScript strict)
packages/core  Logique métier partagée (vide à ce stade — Phase 0)
packages/db    Configuration Drizzle ORM + client SQLite (libSQL)
```

## Prérequis

- Node.js 24 LTS (la version locale de référence est déclarée dans `.nvmrc`)
- pnpm 11.17.0, fourni par Corepack depuis le champ `packageManager`

Avec nvm, préparez l'environnement reproductible ainsi :

```bash
nvm install
nvm use
corepack enable
pnpm --version # 11.17.0
```

`engines` déclare volontairement cette seule majeure de Node et cette version
exacte de pnpm. La CI lit également `.nvmrc`, et l'image de production utilise la
même version avec `node:24.19.0-alpine`.

### Politique de support Node.js

La production utilise uniquement la LTS active paire de Node.js : aucune version
impaire ou non-LTS n'est admise. La montée de version est planifiée lorsque la
LTS paire suivante devient active, après vérification des matrices officielles de
Next.js, `@libsql/client`/Drizzle, Vitest et pnpm, puis validation de l'installation,
du lint, des tests, du build et de l'image Alpine. La mise à jour doit rester
atomique : `.nvmrc`, `engines.node`, les types Node, l'image du `Dockerfile` et la
CI sont modifiés ensemble ; `packageManager` et `engines.pnpm` restent synchronisés.

Node.js 24 respecte les minima des versions utilisées ici : Next.js 16 demande
Node.js 20.9 ou supérieur, Vitest 2 et `@libsql/client` demandent Node.js 18 ou
supérieur, et pnpm 11 prend en charge Node.js 24.

## Commandes

```bash
pnpm install       # installe les dépendances de tout le monorepo
pnpm dev           # démarre apps/web en développement
pnpm build         # build tous les packages/apps
pnpm lint          # lint tous les packages/apps
pnpm test          # tests de tous les packages/apps
pnpm db:migrate    # applique les migrations Drizzle sur la base SQLite locale
```

La date du bloc « Ce jour-là dans la famille » est calculée dans le fuseau
`FAMILY_TIME_ZONE` (identifiant IANA), avec `Europe/Paris` par défaut.

## Vérification locale

Avant d'ouvrir une PR, exécutez ces commandes dans cet ordre :

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

### Contrôle tactile de l’arbre

Sur iOS Safari et Android Chrome, vérifier à 320 px et après rotation que :

- l’arbre est le mode initial et reste centré sur la racine ;
- le déplacement à un doigt et le zoom par pincement fonctionnent dans le canevas ;
- le défilement vertical de la page fonctionne hors du canevas ;
- les boutons `+`, `−`, `Recentrer`, le changement de racine et le lien `Voir la fiche` répondent au toucher ;
- le choix `Arbre | Liste` est conservé après une navigation ou un rechargement.

## Convention de nommage des personnes

- `lastName` est le nom principal/courant affiché avec le prénom.
- `birthName` est un nom de naissance facultatif, distinct du nom principal. Une valeur vide est stockée comme `null`.
- En GEDCOM 5.5.1, le nom principal est le premier `1 NAME`. Le nom de naissance est exporté comme un second `1 NAME`, immédiatement suivi de `2 TYPE birth`. L'import conserve le premier nom comme nom principal et affecte uniquement ce second nom à `birthName`.

## État du projet

**Phase 0 (bootstrap)** — ce commit pose les fondations du monorepo :
workspaces pnpm, scaffold Next.js 15, configuration Drizzle ORM/SQLite
(sans schéma métier), scaffold vide de `packages/core`, et CI de base
(lint + build + test).

La modélisation du domaine (Person, Union, Filiation, Event) et les
phases suivantes sont hors périmètre de ce commit — voir les tâches
Vikunja #20 à #23.
