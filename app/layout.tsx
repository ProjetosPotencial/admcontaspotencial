import type { Metadata } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import RegistrarServiceWorker from "@/components/registrar-service-worker";
import SplashScreen from "@/components/splash-screen";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["400","500","700","800"], variable: "--font-bricolage" });
const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400","500","600","700"], variable: "--font-hanken" });
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
  // o Next gera "apple-mobile-web-app-capable" (já depreciada) a partir de
  // appleWebApp.capable; esta é a versão padronizada que o Chrome pede.
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport = {
  themeColor: "#FFB800",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br" className={`${bricolage.variable} ${hanken.variable} ${mono.variable}`}>
      <body className="font-body">
        <SplashScreen />
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}