import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Afere — Relatório de Valoração Médica",
  description: "Valoração referencial de procedimento médico gerada pelo Afere.",
  openGraph: {
    title: "Afere — Relatório de Valoração Médica",
    description: "Valoração referencial de procedimento médico gerada pelo Afere.",
    type: "article",
    siteName: "Afere",
  },
  twitter: {
    card: "summary",
    title: "Afere — Relatório de Valoração Médica",
    description: "Valoração referencial de procedimento médico gerada pelo Afere.",
  },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
