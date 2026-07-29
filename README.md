# testvibe — Arbre généalogique personnel

Monorepo pnpm workspaces pour le projet d'arbre généalogique personnel.

## Structure

```
apps/web       Application Next.js 15 (App Router, TypeScript strict)
packages/core  Logique métier partagée (vide à ce stade — Phase 0)
packages/db    Configuration Drizzle ORM + client SQLite (libSQL)
```

## Prérequis

- Node.js >= 20
- pnpm >= 9 (`corepack enable` ou `npm install -g pnpm`)

## Commandes

```bash
pnpm install       # installe les dépendances de tout le monorepo
pnpm dev           # démarre apps/web en développement
pnpm build         # build tous les packages/apps
pnpm lint          # lint tous les packages/apps
pnpm test          # tests de tous les packages/apps
pnpm db:migrate    # applique les migrations Drizzle sur la base SQLite locale
```

## Vérification locale

Avant d'ouvrir une PR, exécutez ces commandes dans cet ordre :

```bash
pnpm install
pnpm lint
pnpm test
pnpm build
```

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
