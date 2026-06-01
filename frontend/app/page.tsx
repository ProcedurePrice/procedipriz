"use client";

import {
  Activity,
  Calculator,
  HeartPulse,
  Info,
  Stethoscope,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Autocomplete, type ProcedureOption } from "@/components/ui/autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";

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
  const [procedureOptions, setProcedureOptions] = useState<ProcedureOption[]>([]);
  const [selectedProcedure, setSelectedProcedure] = useState<ProcedureOption | null>(null);
  const [porte, setPorte] = useState("");
  const [auxiliariesCount, setAuxiliariesCount] = useState(1);
  const [requiresAnesthesia, setRequiresAnesthesia] = useState(true);
  const [calculation, setCalculation] = useState<Calculation | null>(null);

  useEffect(() => {
    setPorte(selectedProcedure?.porte ?? "");
  }, [selectedProcedure]);

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
      {/* Ambient teal glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[700px] -translate-x-1/2"
        style={{
          background: "radial-gradient(ellipse at center, hsla(186,72%,60%,0.12) 0%, transparent 70%)",
        }}
      />

      {/* Floating nav */}
      <div className="relative z-10 px-5 pt-4">
        <nav
          className="nav-pill mx-auto flex max-w-[1080px] items-center justify-between rounded-full px-5 py-2.5"
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full"
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
        className="relative z-[1] mx-auto grid max-w-[1080px] gap-7 px-5 pb-12"
        style={{ gridTemplateColumns: "1.2fr 0.8fr" }}
      >
        {/* Left panel */}
        <div
          className="card-plush rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-8"
        >
          <div className="mb-6 flex items-center gap-2">
            <Stethoscope aria-hidden="true" size={18} style={{ color: "hsl(186,72%,28%)" }} />
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
              onSearch={searchProcedures}
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
            className="mb-6 flex items-center justify-between gap-4 rounded-2xl border px-4 py-4"
            style={{
              borderColor: "rgba(13,148,136,0.25)",
              background: "linear-gradient(135deg, #f0fdfc, #e6faf8)",
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ background: "rgba(13,148,136,0.12)" }}
              >
                <HeartPulse aria-hidden="true" size={16} style={{ color: "hsl(186,72%,28%)" }} />
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
        <div className="results-card relative overflow-hidden rounded-3xl border p-7" style={{ borderColor: "rgba(13,148,136,0.15)" }}>
          {/* Decorative glow orb */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 h-[120px] w-[120px] rounded-full"
            style={{
              background: "radial-gradient(circle, hsla(186,72%,50%,0.15), transparent 70%)",
            }}
          />

          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator aria-hidden="true" size={18} style={{ color: "hsl(186,72%,28%)" }} />
              <h2 className="m-0 text-[15px] font-bold text-slate-950 dark:text-slate-50">Resultado</h2>
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: "rgba(13,148,136,0.1)", color: "hsl(186,72%,26%)" }}
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
          <div
            className="my-5"
            style={{ borderTop: "2px dashed rgba(13,148,136,0.3)" }}
          />

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
      <footer className="relative px-5 pb-5 text-center">
        <div
          className="mb-3.5 h-px"
          style={{ background: "linear-gradient(90deg, transparent, #cbd5e1, transparent)" }}
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
