import type { Metadata } from "next";
import { Poppins, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import RegistrarServiceWorker from "@/components/registrar-service-worker";

const poppins = Poppins({ subsets: ["latin"], weight: ["500","600","700"], variable: "--font-poppins" });
const inter = Inter({ subsets: ["latin"], weight: ["400","500","600"], variable: "--font-inter" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400","500","600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Contas de Consumo — Grupo Potencial",
  description: "Controle de contas de consumo das lojas e quiosques",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Potencial Contas",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  themeColor: "#FFC107",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br" className={`${poppins.variable} ${inter.variable} ${mono.variable}`}>
      <body className="font-body">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
