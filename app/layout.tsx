import type { Metadata } from "next";
import { Poppins, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["500","600","700"], variable: "--font-poppins" });
const inter = Inter({ subsets: ["latin"], weight: ["400","500","600"], variable: "--font-inter" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400","500","600"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Contas de Consumo — Grupo Potencial",
  description: "Controle de contas de consumo das lojas e quiosques",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-br" className={`${poppins.variable} ${inter.variable} ${mono.variable}`}>
      <body className="font-body">{children}</body>
    </html>
  );
}
