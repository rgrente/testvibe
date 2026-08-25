/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @testvibe/db et son client libSQL ne sont utilisés que côté serveur.
  // Externaliser le package workspace suffit : ses dépendances @libsql/client
  // et drizzle-orm sont ensuite résolues par Node depuis packages/db. Les
  // externaliser séparément casserait inutilement le traçage des dépendances.
  serverExternalPackages: ["@testvibe/db"],
  // Phase 5 (tâche #24) : autoriser les images servies par /api/media/[filename]
  // (route API interne, même origine que le serveur Next.js).
  images: {
    remotePatterns: [],
    localPatterns: [
      { pathname: "/api/media/**" },
    ],
  },
};

export default nextConfig;
