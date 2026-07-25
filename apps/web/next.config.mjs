/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @libsql/client (utilisé transitivement via @testvibe/core -> @testvibe/db,
  // uniquement côté serveur/Server Components) embarque des fichiers non-JS
  // (README, LICENSE) chargés dynamiquement par un require.context interne à
  // `libsql`. `serverExternalPackages` seul ne suffit pas à travers les
  // symlinks pnpm du monorepo : on force ces paquets en externals CommonJS
  // côté serveur pour qu'ils restent résolus via require() Node natif au
  // runtime plutôt que d'être analysés statiquement par webpack.
  serverExternalPackages: ["@testvibe/db"],
  // Phase 5 (tâche #24) : autoriser les images servies par /api/media/[filename]
  // (route API interne, même origine que le serveur Next.js).
  images: {
    remotePatterns: [],
    localPatterns: [
      { pathname: "/api/media/**" },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const externalPackages = [
        "@libsql/client",
        "libsql",
        "@libsql/hrana-client",
        "@libsql/isomorphic-fetch",
        "@libsql/isomorphic-ws",
      ];
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        ({ request }, callback) => {
          if (externalPackages.some((pkg) => request === pkg || request.startsWith(`${pkg}/`))) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
