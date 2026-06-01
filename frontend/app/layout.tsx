import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProcediPriz",
  description: "Calculadora de honorários médicos para neurocirurgia.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
