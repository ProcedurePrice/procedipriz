"use client";

import {
  Activity,
  Calculator,
  HeartPulse,
  Info,
  Moon,
  Stethoscope,
  Sun,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Autocomplete, type ProcedureOption } from "@/components/ui/autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { useTheme } from "@/components/theme-provider";

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

export default function Home() {
  const { isDark, toggle } = useTheme();
  const [procedureOptions, setProcedureOptions] = useState<ProcedureOption[]>([]);
  const [selectedProcedure, setSelectedProcedure] = useState<ProcedureOption | null>(null);
  const [porte, setPorte] = useState("");
  const [auxiliariesCount, setAuxiliariesCount] = useState(1);
  const [requiresAnesthesia, setRequiresAnesthesia] = useState(true);
  const [calculation, setCalculation] = useState<Calculation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setPorte(selectedProcedure?.porte ?? "");
  }, [selectedProcedure]);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setProcedureOptions([]);
      return;
    }
  
    const timer = setTimeout(() => {
      searchProcedures(searchQuery);
    }, 300);
  
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const canCalculate = useMemo(() => selectedProcedure !== null, [selectedProcedure]);

  async function calculate() {
    if (!selectedProcedure) return;

    const response = await fetch("/api/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cbhpm_code: selectedProcedure.cbhpm_code,
        auxiliaries_count: auxiliariesCount,
        requires_anesthesia: requiresAnesthesia,
      }),
    });

    if (response.ok) {
      setCalculation(await response.json());
    }
  }

  async function searchProcedures(query: string) {
    if (query.trim().length < 2) {
      setProcedureOptions([]);
      return;
    }

    const response = await fetch(`/api/procedures/search?q=${encodeURIComponent(query)}`);
    if (response.ok) {
      setProcedureOptions(await response.json());
    }
  }

  return (
    <main className="hex-bg relative min-h-screen" style={{ backgroundColor: "hsl(var(--background))" }}>
      {/* Floating nav */}
      <div className="relative z-10 px-5 pt-5">
        <nav
          className="nav-bar mx-auto flex max-w-[1080px] items-center justify-between"
        >
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
      <div className="relative z-[1] px-5 pb-6 pt-8 text-center">
        <h1 className="m-0 mb-1.5 text-[30px] font-extrabold tracking-tight text-slate-950 dark:text-slate-50">
          Cálculo de Honorários
        </h1>
        <p className="m-0 text-sm font-medium text-slate-500 dark:text-slate-400">
          Baseado na tabela CBHPM · Resultados instantâneos
        </p>
      </div>

      {/* Main grid */}
      <div
        className="main-grid relative z-[1] mx-auto grid max-w-[1080px] gap-7 px-5 pb-12"
      >
        {/* Left panel */}
        <div
          className="card-plush rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-8"
        >
          <div className="mb-6 flex items-center gap-2">
            <Stethoscope aria-hidden="true" className="text-primary" size={18} />
            <h2 className="m-0 text-[15px] font-bold text-slate-950 dark:text-slate-50">
              Configuração do Procedimento
            </h2>
          </div>

          {/* Search */}
          <div className="mb-5">
            <Autocomplete
              label="Buscar Procedimento"
              options={procedureOptions}
              value={selectedProcedure}
              onChange={setSelectedProcedure}
              onSearch={setSearchQuery}
            />
          </div>

          {/* Porte + Auxiliaries */}
          <div className="mb-5 grid gap-3.5 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.4px] text-slate-500">
                Porte do Procedimento
              </label>
              <Input value={porte} onChange={(e) => setPorte(e.target.value)} />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.4px] text-slate-500 dark:text-slate-400">
                Número de Auxiliares
              </label>
              <Input
                min={0}
                max={4}
                type="number"
                value={auxiliariesCount}
                onChange={(e) => setAuxiliariesCount(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Anesthesiologist toggle */}
          <div
            className="medical-toggle-panel mb-6 flex items-center justify-between gap-4 rounded-2xl border px-4 py-4"
          >
            <div className="flex items-center gap-2.5">
              <div
                className="clinical-icon-chip flex h-8 w-8 items-center justify-center rounded-full"
              >
                <HeartPulse aria-hidden="true" size={16} />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-slate-950 dark:text-slate-50">Anestesiologista</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Incluir honorários do anestesista</div>
              </div>
            </div>
            <Toggle checked={requiresAnesthesia} onChange={setRequiresAnesthesia} />
          </div>

          {/* Calculate button */}
          <Button disabled={!canCalculate} onClick={calculate}>
            <Calculator aria-hidden="true" size={18} />
            Calcular Honorários
          </Button>
        </div>

        {/* Right panel – results */}
        <div className="results-card relative overflow-hidden rounded-3xl border border-primary/15 dark:border-teal-300/20 p-7">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator aria-hidden="true" className="text-primary" size={18} />
              <h2 className="m-0 text-[15px] font-bold text-slate-950 dark:text-slate-50">Resultado</h2>
            </div>
            <span
              className="clinical-pill rounded-full px-2.5 py-1 text-[11px] font-semibold"
            >
              CBHPM 2025
            </span>
          </div>

          {/* Line items */}
          <dl className="space-y-3.5 dark:text-slate-200">
            <ResultRow label="Cirurgião principal" value={calculation?.lead_surgeon_fee} />
            <ResultRow
              label={`Auxiliares${auxiliariesCount > 1 ? ` (×${auxiliariesCount})` : ""}`}
              value={calculation?.auxiliaries_fee}
            />
            <ResultRow label="Anestesiologista" value={calculation?.anesthesiologist_fee} />
          </dl>

          {/* Dashed divider */}
          <div className="teal-divider my-5" />

          {/* Total block */}
          <div
            className="rounded-2xl p-4 text-white"
            style={{
              background: "linear-gradient(135deg, hsl(186,72%,28%), hsl(186,68%,22%))",
              boxShadow: "0 4px 20px hsla(186,72%,28%,0.35)",
            }}
          >
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.5px] opacity-75">
              Total Final
            </div>
            <div className="font-grotesk text-[36px] font-bold leading-none tracking-tight">
              {calculation ? money.format(calculation.final_total) : "—"}
            </div>
            {selectedProcedure && (
              <div className="mt-1.5 text-[11px] font-medium opacity-65">
                {selectedProcedure.procedure_name}
                {porte ? ` · Porte ${porte}` : ""}
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 p-3">
            <Info aria-hidden="true" className="mt-px shrink-0 text-slate-400 dark:text-slate-500" size={15} />
            <p className="m-0 text-[11px] font-medium leading-relaxed text-slate-400 dark:text-slate-500">
              Valores calculados conforme Tabela CBHPM 2025/2026. Sujeito à variação por convênio.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-[1] px-5 pb-5 text-center">
        <div
          className="footer-divider mb-3.5 h-px"
        />
        <p className="m-0 text-xs font-medium text-slate-400 dark:text-slate-500">
          2026 &nbsp;·&nbsp;{" "}
          <span className="font-bold text-slate-500">LabF5</span>
          &nbsp;·&nbsp; Todos os direitos reservados
        </p>
      </footer>
    </main>
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
