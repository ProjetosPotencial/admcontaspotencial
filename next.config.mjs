/** @type {import('next').NextConfig} */
const nextConfig = {
  // Carrega essas libs do node_modules no servidor (não empacota no bundle).
  serverComponentsExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  // Garante que os arquivos do pdfjs e do canvas sejam INCLUÍDOS no pacote da
  // função serverless (corrige "Cannot find package 'pdfjs-dist'" na Vercel).
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./node_modules/pdfjs-dist/legacy/build/**",
      "./node_modules/pdfjs-dist/build/**",
      "./node_modules/@napi-rs/canvas/**",
    ],
  },
};
export default nextConfig;
