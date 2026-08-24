# Image de production pour apps/web (Next.js), à partir du monorepo pnpm complet.
#
# L'image conserve l'arbre du monorepo pour que les packages workspace externes
# au bundle serveur (notamment @testvibe/db et libSQL) restent disponibles au
# runtime. Elle démarre avec `next start` plutôt qu'en mode standalone.

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
