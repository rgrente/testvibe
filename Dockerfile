# Image de production pour apps/web (Next.js), à partir du monorepo pnpm complet.
#
# Choix volontaire de ne PAS utiliser `next build` en mode `output: "standalone"` :
# le traçage de fichiers de Next.js (@vercel/nft) ne suit pas correctement, à
# travers les symlinks pnpm de ce monorepo, les dépendances de @testvibe/db
# forcées en externals CommonJS (cf. apps/web/next.config.mjs) — le dossier
# `dist` compilé de @testvibe/db ainsi que ses node_modules runtime
# (@libsql/client, drizzle-orm...) se retrouvent absents du build autonome.
# On construit et copie donc l'arbre du monorepo tel quel, et on démarre via
# `next start` classique : plus simple et fiable, au prix d'une image plus
# volumineuse (devDependencies incluses).

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# --- deps : installe toutes les dépendances (mise en cache par layer Docker) ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile

# --- builder : build packages/db, packages/core puis apps/web (ordre topologique pnpm) ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY . .
RUN pnpm build

# --- runner : image finale, démarre le serveur Next.js ---
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app ./

EXPOSE 3000
WORKDIR /app/apps/web

# DATABASE_URL doit être fourni au runtime (ex. chemin vers un volume monté)
# pour persister les données au-delà du cycle de vie du conteneur ; sans ça,
# @testvibe/db retombe sur file:./local.db, relatif à apps/web et éphémère.
#
# Appelle le binaire next directement (plutôt que `pnpm --filter ... start --`) :
# pnpm ne transmettait pas -p/-H proprement à `next start`, qui traitait alors
# le "--" comme la fin des options et "-p" comme argument positionnel.
CMD ["node_modules/.bin/next", "start", "-p", "3000", "-H", "0.0.0.0"]
