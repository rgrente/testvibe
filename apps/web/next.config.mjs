/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @testvibe/db et son client libSQL ne sont utilisés que côté serveur.
  // Ils restent résolus par Node au runtime plutôt que d'être bundlés.
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
