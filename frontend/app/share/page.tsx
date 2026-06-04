"use client";

import {
  Activity,
  Calculator,
  HeartPulse,
  Info,
  Moon,
  Stethoscope,
  Sun,
  ArrowLeft,
} from "lucide-react";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme-provider";

type Procedure = {
  procedure_name: string;
  cbhpm_code: string;
  description: string;
  porte: string;
};

type Calculation = {
  base_porte_value: number;
  lead_surgeon_fee: number;
  auxiliaries_fee: number;
  anesthesiologist_fee: number;
  final_total: number;
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function ShareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDark, toggle } = useTheme();

  const code = searchParams.get("p") || "";
  const auxiliariesCount = Number(searchParams.get("a") || "0");
  const requiresAnesthesia = searchParams.get("an") === "1";

  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError("Código do procedimento não fornecido.");
      setLoading(false);
      return;
    }

    async function loadCalculation() {
      try {
        // 1. Fetch procedure details by code
        const procResponse = await fetch(`/api/procedures/get?code=${encodeURIComponent(code)}`);
        if (!procResponse.ok) {
          throw new Error("Procedimento não encontrado.");
        }
        const procData = await procResponse.json();
        setProcedure(procData);

        // 2. Fetch the calculation
        const calcResponse = await fetch("/api/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cbhpm_code: code,
            auxiliaries_count: auxiliariesCount,
            requires_anesthesia: requiresAnesthesia,
          }),
        });

        if (!calcResponse.ok) {
          throw new Error("Erro ao realizar o cálculo.");
        }
        const calcData = await calcResponse.json();
        setCalculation(calcData);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar os dados.");
      } finally {
        setLoading(false);
      }
    }

    loadCalculation();
  }, [code, auxiliariesCount, requiresAnesthesia]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Carregando cálculo...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-red-200/80 dark:border-red-900/30 bg-white dark:bg-slate-900 p-8 text-center">
        <Info className="mx-auto mb-4 text-red-500" size={40} />
        <h2 className="mb-2 text-lg font-bold text-slate-950 dark:text-slate-50">Ops! Algo deu errado</h2>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{error}</p>
        <Button onClick={() => router.push("/")}>
          <ArrowLeft size={16} /> Voltar para o início
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[640px] space-y-6">
      {/* Procedure Summary Card */}
      <div className="card-plush rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 sm:p-8">
        <div className="mb-5 flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-primary"
            style={{ backgroundColor: "hsla(var(--primary-foreground), 0.1)" }}
          >
            <Stethoscope size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Procedimento Selecionado
            </span>
            <h2 className="m-0 text-lg font-bold text-slate-950 dark:text-slate-50 leading-snug">
              {procedure?.procedure_name}
            </h2>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Código CBHPM: {procedure?.cbhpm_code} · {procedure?.description}
            </p>
          </div>
        </div>

        <div className="grid gap-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 p-4 sm:grid-cols-2">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Porte
            </span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Porte {procedure?.porte}
            </span>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Variáveis do Cálculo
            </span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {auxiliariesCount} {auxiliariesCount === 1 ? "Auxiliar" : "Auxiliares"}
              {requiresAnesthesia ? " · Com Anestesista" : " · Sem Anestesista"}
            </span>
          </div>
        </div>
      </div>

      {/* Results Card */}
      <div className="results-card relative overflow-hidden rounded-3xl border border-primary/15 dark:border-teal-300/20 p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator aria-hidden="true" className="text-primary" size={18} />
            <h2 className="m-0 text-[15px] font-bold text-slate-950 dark:text-slate-50">Resumo dos Honorários</h2>
          </div>
          <span className="clinical-pill rounded-full px-2.5 py-1 text-[11px] font-semibold">
            CBHPM 2025
          </span>
        </div>

        <dl className="space-y-3.5 dark:text-slate-200">
          <ResultRow label="Cirurgião principal" value={calculation?.lead_surgeon_fee} />
          <ResultRow
            label={`Auxiliares${auxiliariesCount > 0 ? ` (×${auxiliariesCount})` : ""}`}
            value={calculation?.auxiliaries_fee}
          />
          <ResultRow label="Anestesiologista" value={calculation?.anesthesiologist_fee} />
        </dl>

        <div className="teal-divider my-5" />

        <div
          className="rounded-2xl p-5 text-white"
          style={{
            background: "linear-gradient(135deg, hsl(186,72%,28%), hsl(186,68%,22%))",
            boxShadow: "0 4px 20px hsla(186,72%,28%,0.35)",
          }}
        >
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.5px] opacity-75">
            Total Final
          </div>
          <div className="font-grotesk text-[38px] font-bold leading-none tracking-tight">
            {calculation ? money.format(calculation.final_total) : "—"}
          </div>
        </div>


      </div>
    </div>
  );
}

function ResultRow({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="flex items-end justify-between gap-1">
      <dt className="shrink-0 text-[13px] font-medium text-slate-500 dark:text-slate-400">{label}</dt>
      <div className="leader" />
      <dd className="font-grotesk shrink-0 text-sm font-semibold text-slate-950 dark:text-slate-50">
        {value === undefined ? "—" : money.format(value)}
      </dd>
    </div>
  );
}

export default function SharePage() {
  const { isDark, toggle } = useTheme();

  return (
    <main className="hex-bg relative min-h-screen pb-12" style={{ backgroundColor: "hsl(var(--background))" }}>
      {/* Floating nav */}
      <div className="relative z-10 px-5 pt-5">
        <nav className="nav-bar mx-auto flex max-w-[1080px] items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="brand-mark flex h-9 w-9 items-center justify-center rounded-full"
              style={{
                background: "linear-gradient(135deg, hsl(186,72%,28%), hsl(186,72%,22%))",
                boxShadow: "0 2px 8px hsla(186,72%,28%,0.35)",
              }}
            >
              <Activity aria-hidden="true" className="text-white" size={18} />
            </div>
            <div>
              <span className="block text-base font-extrabold tracking-tight text-slate-950 dark:text-slate-50">
                ProcediPriz
              </span>
              <span className="block text-[10px] font-medium tracking-[0.3px] text-slate-500 dark:text-slate-400 leading-none">
                NEUROCIRURGIA
              </span>
            </div>
          </div>
          <button
            onClick={toggle}
            aria-checked={isDark}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="theme-switch relative inline-flex h-8 w-14 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            role="switch"
            type="button"
          >
            <Sun
              aria-hidden="true"
              size={13}
              className="absolute left-2 text-amber-500 transition-opacity dark:opacity-35"
            />
            <Moon
              aria-hidden="true"
              size={13}
              className="absolute right-2 text-slate-500 opacity-45 transition-opacity dark:text-cyan-200 dark:opacity-100"
            />
            <span
              aria-hidden="true"
              className={`theme-switch-thumb absolute top-1 h-6 w-6 rounded-full transition-transform duration-200 ${
                isDark ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </nav>
      </div>

      {/* Hero */}
      <div className="relative z-[1] px-5 pb-8 pt-10 text-center">
        <h1 className="m-0 mb-1.5 text-[28px] font-extrabold tracking-tight text-slate-950 dark:text-slate-50">
          Cálculo Compartilhado
        </h1>
        <p className="m-0 text-sm font-medium text-slate-500 dark:text-slate-400">
          Resumo de honorários baseado na tabela CBHPM
        </p>
      </div>

      <div className="relative z-[1] px-5">
        <Suspense fallback={
          <div className="flex min-h-[30vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }>
          <ShareContent />
        </Suspense>
      </div>
    </main>
  );
}
