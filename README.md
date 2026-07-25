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

## État du projet

**Phase 0 (bootstrap)** — ce commit pose les fondations du monorepo :
workspaces pnpm, scaffold Next.js 15, configuration Drizzle ORM/SQLite
(sans schéma métier), scaffold vide de `packages/core`, et CI de base
(lint + build + test).

La modélisation du domaine (Person, Union, Filiation, Event) et les
phases suivantes sont hors périmètre de ce commit — voir les tâches
Vikunja #20 à #23.
