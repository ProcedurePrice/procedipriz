"use client";

import { SignInButton, UserButton, useAuth, useUser } from "@clerk/nextjs";
import { BookmarkCheck, ChevronRight, FileText, Plus, Share2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

// ─── Design tokens ────────────────────────────────────────────────────────────

const T = {
  bg:          "#E2EBF3",
  surface:     "#FFFFFF",
  cardBorder:  "rgba(53,92,138,0.12)",
  primary:     "#0F172A",
  secondary:   "#475569",
  muted:       "#64748B",
  inputBorder: "#CBD5E1",
  inputFocus:  "#94A3B8",
  btnBg:       "#1E293B",
  btnHover:    "#334155",
  teal:        "#1E3A5F",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

type CompositionItem = {
  public_id: string;
  name: string;
  sbn_procedure_name: string;
  access_route_type: "same" | "different";
  auxiliaries_count: number;
  requires_anesthesia: boolean;
  created_at: string;
};

// ─── Home ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [compositions, setCompositions] = useState<CompositionItem[]>([]);
  const [compositionsLoaded, setCompositionsLoaded] = useState(false);

  const fetchCompositions = useCallback(async () => {
    if (!isSignedIn) return;
    try {
      const token = await getToken();
      const res = await fetch("/api/compositions", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data: CompositionItem[] = await res.json();
        setCompositions((data ?? []).slice(0, 5));
      }
    } catch {
      // network failure — leave empty
    } finally {
      setCompositionsLoaded(true);
    }
  }, [isSignedIn, getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      fetchCompositions();
    } else {
      setCompositionsLoaded(true);
    }
  }, [isLoaded, isSignedIn, fetchCompositions]);

  if (!isLoaded) {
    return (
      <main style={{ minHeight: "100vh", backgroundColor: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: "20px", height: "20px",
            border: `2px solid ${T.inputBorder}`, borderTopColor: T.primary,
            borderRadius: "50%", animation: "spin 0.7s linear infinite",
          }}
        />
      </main>
    );
  }

  if (!isSignedIn) {
    return <UnauthenticatedEntry />;
  }

  const firstName = user?.firstName;
  const greeting = firstName ? `Bem-vindo, Dr. ${firstName}.` : "Bem-vindo ao Afere.";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: [
          "radial-gradient(circle at top center, rgba(53,92,138,0.18) 0%, transparent 45%)",
          "radial-gradient(circle at 15% 88%, rgba(30,58,95,0.08) 0%, transparent 40%)",
          "radial-gradient(ellipse 700px 500px at 80% 20%, rgba(30,58,95,0.06) 0%, transparent 60%)",
          "linear-gradient(180deg, #E2EBF3 0%, #D6E1EB 100%)",
        ].join(", "),
      }}
    >
      {/* ── Navigation ── */}
      <nav
        style={{
          position: "sticky", top: 0, zIndex: 50,
          backgroundColor: "rgba(243,246,249,0.72)",
          backdropFilter: "blur(12px) saturate(160%)",
          WebkitBackdropFilter: "blur(12px) saturate(160%)",
          borderBottom: "1px solid rgba(255,255,255,0.45)",
          boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
        }}
      >
        <div
          style={{
            maxWidth: "960px", margin: "0 auto",
            padding: "0 24px", height: "56px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          {/* Brand */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
            <div
              style={{
                width: "34px", height: "34px", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "linear-gradient(145deg, #E6EEF5, #D8E5EE)",
                borderRadius: "9px",
                border: "1px solid rgba(53,92,138,0.12)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/afere-symbol.svg" alt="" aria-hidden="true" width={22} height={21} style={{ display: "block" }} />
            </div>
            <div>
              <span style={{ display: "block", fontSize: "14px", fontWeight: 800, letterSpacing: "-0.3px", color: T.primary }}>Afere</span>
              <span style={{ display: "block", fontSize: "9px", fontWeight: 600, letterSpacing: "0.4px", textTransform: "uppercase", color: T.muted, lineHeight: 1 }}>NEUROCIRURGIA</span>
            </div>
          </Link>

          {/* Nav links */}
          <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            <NavLink href="/" active>Início</NavLink>
            <NavLink href="/novo-calculo">Novo cálculo</NavLink>
            <NavLink href="#" disabled label="Composições" />
            <NavLink href="#" disabled label="Documentação" />
          </div>

          {/* Auth */}
          <UserButton />
        </div>
      </nav>

      {/* ── Main content ── */}
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "52px 24px 80px" }}>

        {/* Greeting + CTA */}
        <div style={{ marginBottom: "56px" }}>
          <h1 style={{
            margin: "0 0 6px",
            fontSize: "28px", fontWeight: 800,
            letterSpacing: "-0.5px", color: T.primary, lineHeight: 1.15,
          }}>
            {greeting}
          </h1>
          <p style={{ margin: "0 0 28px", fontSize: "14px", color: T.muted }}>
            O que deseja calcular hoje?
          </p>
          <Link
            href="/novo-calculo"
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "11px 24px",
              backgroundColor: "#355C8A",
              color: "#fff",
              borderRadius: "10px",
              fontSize: "14px", fontWeight: 600,
              textDecoration: "none",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#2C4F78")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#355C8A")}
          >
            <Plus size={15} aria-hidden="true" />
            Novo cálculo
          </Link>
        </div>

        {/* Recent compositions */}
        <section style={{ marginBottom: "52px" }}>
          <SectionHeader title="Composições recentes" />
          {!compositionsLoaded ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "16px 0", color: T.muted, fontSize: "13.5px" }}>
              <div
                style={{
                  width: "16px", height: "16px",
                  border: `2px solid ${T.inputBorder}`, borderTopColor: T.primary,
                  borderRadius: "50%", animation: "spin 0.7s linear infinite",
                }}
              />
              Carregando...
            </div>
          ) : compositions.length === 0 ? (
            <div
              style={{
                borderRadius: "12px",
                border: `1.5px dashed ${T.cardBorder}`,
                padding: "40px 24px", textAlign: "center",
              }}
            >
              <BookmarkCheck size={32} aria-hidden="true" style={{ color: T.inputBorder, margin: "0 auto 14px", display: "block" }} />
              <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 600, color: T.secondary }}>
                Nenhuma composição salva ainda
              </p>
              <p style={{ margin: "0 0 22px", fontSize: "12.5px", color: T.muted, lineHeight: 1.6 }}>
                Monte uma composição e salve para acessar rapidamente aqui.
              </p>
              <Link
                href="/novo-calculo"
                style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  padding: "9px 20px",
                  border: `1.5px solid ${T.inputBorder}`,
                  borderRadius: "8px",
                  fontSize: "13px", fontWeight: 600,
                  color: T.primary,
                  textDecoration: "none",
                }}
              >
                Criar primeira composição
              </Link>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "10px" }}>
              {compositions.map((comp) => (
                <CompositionCard key={comp.public_id} comp={comp} />
              ))}
            </div>
          )}
        </section>

        {/* Quick tools */}
        <section style={{ marginBottom: "52px" }}>
          <SectionHeader title="Ferramentas" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
            <ToolCard
              icon={<Plus size={18} aria-hidden="true" />}
              title="Novo cálculo"
              description="Monte uma composição e calcule a valoração."
              href="/novo-calculo"
            />
            <ToolCard
              icon={<BookmarkCheck size={18} aria-hidden="true" />}
              title="Minhas composições"
              description="Acesse, edite e reutilize suas composições."
              href="/novo-calculo"
            />
            <ToolCard
              icon={<FileText size={18} aria-hidden="true" />}
              title="Documentação"
              description="Consulte fundamentos CBHPM e SBN."
              disabled
            />
            <ToolCard
              icon={<Share2 size={18} aria-hidden="true" />}
              title="Relatórios compartilhados"
              description="Revise cálculos compartilhados."
              disabled
            />
          </div>
        </section>

      </div>
    </main>
  );
}

// ─── Unauthenticated entry ────────────────────────────────────────────────────

function UnauthenticatedEntry() {
  const [ctaHovered, setCtaHovered] = useState(false);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: [
          "radial-gradient(circle at 50% 0%, rgba(53,92,138,0.18) 0%, transparent 38%)",
          "radial-gradient(circle at 15% 85%, rgba(30,58,95,0.10) 0%, transparent 36%)",
          "linear-gradient(180deg, #E6EEF5 0%, #D8E5EE 100%)",
        ].join(", "),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 20px",
      }}
    >

      {/* ── Content centred in the viewport ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          padding: "64px 0 48px",
        }}
      >
        <div style={{ width: "100%", maxWidth: "580px", display: "flex", flexDirection: "column", gap: "26px" }}>
        <div
          style={{
            width: "100%", textAlign: "center",
            background: "#F3F6F9",
            backdropFilter: "blur(24px) saturate(160%)",
            WebkitBackdropFilter: "blur(24px) saturate(160%)",
            borderRadius: "24px",
            border: "1px solid rgba(53,92,138,0.10)",
            padding: "52px 44px 44px",
            boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.08), 0 24px 70px rgba(15,23,42,0.14)",
          }}
        >

          {/* Logo mark */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginBottom: "56px" }}>
            <div style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <div style={{
                position: "absolute",
                inset: "-14px",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(95,132,179,0.18) 0%, transparent 70%)",
                pointerEvents: "none",
              }} />
              <div style={{
                width: 76, height: 76,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "linear-gradient(145deg, #E6EEF5 0%, #D8E5EE 100%)",
                borderRadius: "20px",
                border: "1px solid rgba(100,116,139,0.18)",
                boxShadow: "0 2px 8px rgba(15,23,42,0.08), 0 8px 28px rgba(15,23,42,0.12)",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/afere-symbol.svg"
                  alt="Afere"
                  width={58}
                  height={55}
                  style={{ display: "block" }}
                />
              </div>
            </div>
            <div>
              <p style={{
                margin: "0 0 3px",
                fontSize: "18px", fontWeight: 800,
                letterSpacing: "-0.3px", color: "#0F172A",
              }}>
                Afere
              </p>
              <p style={{
                margin: 0,
                fontSize: "9.5px", fontWeight: 700,
                letterSpacing: "1.6px", textTransform: "uppercase",
                color: "#94A3B8",
              }}>
                Neurocirurgia
              </p>
            </div>
          </div>

          {/* Headline */}
          <h1
            style={{
              margin: "0 0 24px",
              fontFamily: "'Inter', sans-serif",
              fontSize: "clamp(32px, 5.3vw, 42px)",
              fontWeight: 900,
              letterSpacing: "-1.2px",
              lineHeight: 1.06,
              backgroundImage: "linear-gradient(90deg, #0F2440 0%, #1E5490 55%, #5BAFD6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Valoração médica com<br />precisão documental.
          </h1>

          {/* Subheadline */}
          <p
            style={{
              margin: "0 auto 48px",
              maxWidth: "400px",
              fontSize: "14.5px",
              lineHeight: 1.75,
              color: "#475569",
            }}
          >
            Baseado nas regras oficiais da CBHPM e da SBN, com cálculo
            determinístico, composições reutilizáveis e relatórios compartilháveis.
          </p>

          {/* Thin rule */}
          <div
            style={{
              width: "40px", height: "1px",
              backgroundColor: "#CBD5E1",
              margin: "0 auto 36px",
            }}
          />

          {/* Primary CTA */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "22px" }}>
            <Link
              href="/novo-calculo"
              onMouseEnter={() => setCtaHovered(true)}
              onMouseLeave={() => setCtaHovered(false)}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: "100%", maxWidth: "260px", height: "50px",
                background: "linear-gradient(135deg, #1A3558 0%, #4D8EC4 100%)",
                filter: ctaHovered ? "brightness(1.15)" : "brightness(1)",
                color: "#fff",
                borderRadius: "12px",
                fontSize: "15px", fontWeight: 600,
                letterSpacing: "0.1px",
                textDecoration: "none",
                transition: "filter 160ms ease",
              }}
            >
              Iniciar cálculo
            </Link>
          </div>

          {/* Secondary — sign in */}
          <p style={{ margin: 0, fontSize: "13px", color: "#64748B" }}>
            Já tem conta?{" "}
            <SignInButton mode="modal">
              <button
                type="button"
                style={{
                  background: "none", border: "none", padding: 0,
                  fontFamily: "inherit", fontSize: "13px", fontWeight: 600,
                  color: "#475569", cursor: "pointer",
                  textDecoration: "underline", textUnderlineOffset: "3px",
                  textDecorationColor: "#CBD5E1",
                }}
              >
                Entrar
              </button>
            </SignInButton>
          </p>

        </div>

        {/* ── O que você pode fazer ── */}
        <section>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px", padding: "0 2px" }}>
            <h2
              style={{
                margin: 0, fontSize: "12px", fontWeight: 700,
                color: T.secondary, letterSpacing: "0.3px",
                whiteSpace: "nowrap",
              }}
            >
              O que você pode fazer
            </h2>
            <div style={{ flex: 1, height: "1px", backgroundColor: T.cardBorder }} />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(252px, 1fr))",
              gap: "12px",
            }}
          >
            <CapabilityCard
              icon={<Plus size={15} aria-hidden="true" />}
              title="Novo cálculo"
              description="Monte composições CBHPM/SBN com cálculo determinístico e atualização instantânea dos honorários."
              actionLabel="Iniciar cálculo"
              href="/novo-calculo"
            />
            <CapabilityCard
              icon={<BookmarkCheck size={15} aria-hidden="true" />}
              title="Composições reutilizáveis"
              description="Salve estruturas de procedimentos para reutilização futura sem armazenar valores calculados."
              actionLabel="Ver composições"
              signIn
            />
            <CapabilityCard
              icon={<Share2 size={15} aria-hidden="true" />}
              title="Compartilhamento Premium"
              description="Compartilhe relatórios profissionais por link público com visualização otimizada para desktop e celular."
              actionLabel="Compartilhar relatório"
              signIn
            />
            <CapabilityCard
              icon={<FileText size={15} aria-hidden="true" />}
              title="Consulta documental"
              description="Consulte regras, instruções e referências da CBHPM e da SBN diretamente pela plataforma."
              actionLabel="Em breve"
              disabled
            />
          </div>
        </section>

        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ padding: "0 20px 28px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: "11px", color: "#94A3B8" }}>
          2026 · LabF5 · Todos os direitos reservados
        </p>
      </div>

    </main>
  );
}

// ─── Nav link ─────────────────────────────────────────────────────────────────

function NavLink({
  href,
  children,
  active,
  disabled,
  label,
}: {
  href: string;
  children?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const baseStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: "5px",
    padding: "5px 11px",
    borderRadius: "7px",
    fontSize: "13px", fontWeight: 500,
    textDecoration: "none",
    transition: "background-color 120ms ease, color 120ms ease",
  };

  if (disabled) {
    return (
      <span
        style={{
          ...baseStyle,
          color: T.inputBorder,
          cursor: "default",
        }}
      >
        {label ?? children}
        <span
          style={{
            fontSize: "9.5px", fontWeight: 700,
            color: T.muted, background: "rgba(203,213,225,0.35)",
            borderRadius: "4px", padding: "1px 5px",
          }}
        >
          Em breve
        </span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      style={{
        ...baseStyle,
        color: active ? T.primary : T.muted,
        backgroundColor: active ? "rgba(255,255,255,0.65)" : "transparent",
        boxShadow: active ? "0 1px 3px rgba(15,23,42,0.08)" : "none",
        fontWeight: active ? 600 : 500,
      }}
    >
      {label ?? children}
    </Link>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "14px" }}>
      <h2
        style={{
          margin: 0, fontSize: "11px", fontWeight: 700,
          color: T.muted, letterSpacing: "0.5px", textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {title}
      </h2>
      <div style={{ flex: 1, height: "1px", backgroundColor: T.cardBorder }} />
    </div>
  );
}

// ─── Composition card ─────────────────────────────────────────────────────────

function CompositionCard({ comp }: { comp: CompositionItem }) {
  const [hovered, setHovered] = useState(false);

  const date = new Date(comp.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  const href = `/procedure?composition=${encodeURIComponent(comp.public_id)}`;

  return (
    <Link
      href={href}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        textDecoration: "none",
        borderRadius: "12px",
        border: `1.5px solid ${hovered ? "#5F84B3" : T.cardBorder}`,
        padding: "16px 16px 14px",
        backgroundColor: hovered ? "#FAFBFD" : T.surface,
        transition: "border-color 130ms ease, background-color 110ms ease",
        boxShadow: hovered ? "0 2px 12px rgba(15,23,42,0.07)" : "none",
      }}
    >
      <p
        style={{
          margin: "0 0 3px", fontSize: "13.5px", fontWeight: 700,
          color: T.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {comp.name}
      </p>
      <p
        style={{
          margin: "0 0 10px", fontSize: "12px", color: T.secondary,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
      >
        {comp.sbn_procedure_name}
      </p>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "5px" }}>
        <span style={{ fontSize: "11px", color: T.muted }}>{date}</span>
        {comp.auxiliaries_count > 0 && (
          <span style={{ fontSize: "10.5px", fontWeight: 600, color: T.teal, background: "rgba(53,92,138,0.12)", borderRadius: "4px", padding: "1px 5px" }}>
            {comp.auxiliaries_count} aux.
          </span>
        )}
        {comp.requires_anesthesia && (
          <span style={{ fontSize: "10.5px", fontWeight: 600, color: "#6D28D9", background: "#EDE9FE", borderRadius: "4px", padding: "1px 5px" }}>
            Anest.
          </span>
        )}
      </div>
      <div
        style={{
          marginTop: "12px", display: "flex", alignItems: "center", gap: "3px",
          color: "#355C8A", fontSize: "12px", fontWeight: 600,
        }}
      >
        Abrir
        <ChevronRight size={12} aria-hidden="true" />
      </div>
    </Link>
  );
}

// ─── Capability card (home "O que você pode fazer") ───────────────────────────

function CapabilityCard({
  icon,
  title,
  description,
  actionLabel,
  href,
  signIn,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  href?: string;
  signIn?: boolean;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const interactive = !disabled;
  const active = hovered && interactive;

  const cardStyle: React.CSSProperties = {
    display: "flex", flexDirection: "column", height: "100%",
    textAlign: "left",
    borderRadius: "14px",
    border: `1px solid ${active ? "#5F84B3" : T.cardBorder}`,
    padding: "18px 18px 16px",
    backgroundColor: T.surface,
    boxShadow: active
      ? "0 4px 16px rgba(15,23,42,0.09)"
      : "0 1px 2px rgba(15,23,42,0.04)",
    transition: "border-color 140ms ease, box-shadow 140ms ease",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };

  const inner = (
    <div style={cardStyle}>
      <div
        style={{
          width: "30px", height: "30px", borderRadius: "8px",
          backgroundColor: "#EEF3F8",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: T.teal,
          marginBottom: "12px",
        }}
      >
        {icon}
      </div>
      <p style={{ margin: "0 0 5px", fontSize: "13.5px", fontWeight: 700, color: T.primary }}>
        {title}
      </p>
      <p style={{ margin: 0, fontSize: "12px", color: T.muted, lineHeight: 1.55 }}>
        {description}
      </p>
      <div style={{ flex: 1, minHeight: "12px" }} />
      {disabled ? (
        <span
          style={{
            alignSelf: "flex-start",
            fontSize: "10px", fontWeight: 600, color: T.muted,
            background: "#F1F5F9", borderRadius: "5px", padding: "2px 7px",
          }}
        >
          {actionLabel}
        </span>
      ) : (
        <span
          style={{
            display: "inline-flex", alignItems: "center", gap: "3px",
            fontSize: "12px", fontWeight: 600, color: "#355C8A",
          }}
        >
          {actionLabel}
          <ChevronRight size={13} aria-hidden="true" />
        </span>
      )}
    </div>
  );

  if (disabled) {
    return (
      <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        {inner}
      </div>
    );
  }

  if (signIn) {
    return (
      <SignInButton mode="modal">
        <div
          role="button"
          tabIndex={0}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {inner}
        </div>
      </SignInButton>
    );
  }

  return (
    <Link
      href={href ?? "#"}
      style={{ textDecoration: "none" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {inner}
    </Link>
  );
}

// ─── Tool card ────────────────────────────────────────────────────────────────

function ToolCard({
  icon,
  title,
  description,
  href,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  const cardStyle: React.CSSProperties = {
    borderRadius: "12px",
    border: `1.5px solid ${hovered && !disabled ? "#5F84B3" : T.cardBorder}`,
    padding: "20px 18px 18px",
    backgroundColor: hovered && !disabled ? "#FAFBFD" : T.surface,
    transition: "border-color 130ms ease, background-color 110ms ease",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.52 : 1,
  };

  const inner = (
    <div style={cardStyle}>
      <div
        style={{
          width: "36px", height: "36px", borderRadius: "9px",
          backgroundColor: "#F1F5F9",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: T.secondary,
          marginBottom: "12px",
        }}
      >
        {icon}
      </div>
      <p style={{ margin: "0 0 4px", fontSize: "13.5px", fontWeight: 700, color: T.primary }}>
        {title}
      </p>
      <p style={{ margin: 0, fontSize: "12px", color: T.muted, lineHeight: 1.55 }}>
        {description}
      </p>
      {disabled && (
        <span
          style={{
            display: "inline-block", marginTop: "10px",
            fontSize: "10px", fontWeight: 600, color: T.muted,
            background: "#F1F5F9", borderRadius: "4px", padding: "2px 7px",
          }}
        >
          Em breve
        </span>
      )}
    </div>
  );

  if (disabled || !href) {
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      style={{ textDecoration: "none" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {inner}
    </Link>
  );
}
