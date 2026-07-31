/** @type {import('next').NextConfig} */
const nextConfig = {
  // Carrega essas libs direto do node_modules no servidor (não empacota no bundle).
  // Necessário para o @napi-rs/canvas (binário) e o pdfjs rodarem na Vercel.
  experimental: {
    serverComponentsExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  },
};
export default nextConfig;
