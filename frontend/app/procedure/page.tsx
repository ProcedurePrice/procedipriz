"use client";

import {
  Activity,
  Calculator,
  Check,
  HeartPulse,
  Info,
  Moon,
  Route,
  Share2,
  Stethoscope,
  Sun,
  X,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Autocomplete, type SBNProcedureOption } from "@/components/ui/autocomplete";
import { Toggle } from "@/components/ui/toggle";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/components/ui/utils";

// ─── Domain types ─────────────────────────────────────────────────────────────

type CBHPMCode = { code: string; description: string; porte: string; num_auxiliaries: number };
type ProcedureDetail = { id: string; name: string; cbhpm_codes: CBHPMCode[] };

type AccessRouteType = "same" | "different";

type AuxiliaryFee = { position: number; percentage: number; fee: number };
type SurgeonBreakdown = {
  principal_value: number;
  additional_gross: number;
  discount_rate: number;
  additional_discounted: number;
  surgeon_total: number;
};
type CodeBreakdown = {
  cbhpm_code: string;
  description: string;
  porte: string;
  base_value: number;
  is_principal: boolean;
};
type CalculationResult = {
  code_breakdown: CodeBreakdown[];
  access_route_type: AccessRouteType;
  surgeon_breakdown: SurgeonBreakdown;
  lead_surgeon_fee: number;
  individual_auxiliary_fees: AuxiliaryFee[];
  auxiliaries_fee: number;
  anesthesiologist_fee: number;
  final_total: number;
  total_base: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const pct = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 }).format(n / 100);

// ─── Workflow content ─────────────────────────────────────────────────────────

function ProcedureContent({ initialQuery, initialSbnId, initialRoute }: {
  initialQuery: string;
  initialSbnId: string;
  initialRoute: AccessRouteType;
}) {
  const { isDark, toggle } = useTheme();

  const [searchOptions, setSearchOptions] = useState<SBNProcedureOption[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  const [selectedProcedures, setSelectedProcedures] = useState<SBNProcedureOption[]>([]);
  const [detailsMap, setDetailsMap] = useState<Record<string, ProcedureDetail>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  // selectedCodes tracks which CBHPM codes are checked (value = porte from catalog)
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [auxiliariesCount, setAuxiliariesCount] = useState(1);
  const [requiresAnesthesia, setRequiresAnesthesia] = useState(true);
  const [accessRoute, setAccessRoute] = useState<AccessRouteType>(initialRoute);

  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [copied, setCopied] = useState(false);

  const calcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Derived: merged CBHPM codes from all selected procedures (deduplicated by code)
  const allCbhpmCodes = useMemo(() => {
    const seen = new Set<string>();
    const codes: CBHPMCode[] = [];
    for (const proc of selectedProcedures) {
      const detail = detailsMap[proc.id];
      if (!detail) continue;
      for (const c of detail.cbhpm_codes) {
        if (!seen.has(c.code)) {
          seen.add(c.code);
          codes.push(c);
        }
      }
    }
    return codes;
  }, [selectedProcedures, detailsMap]);

  const loadingDetail = loadingIds.size > 0;

  // ── Search ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchOptions([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/procedures/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) setSearchOptions(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // ── Direct procedure load via ?sbn=<id> (from home page selection) ──────────

  useEffect(() => {
    if (!initialSbnId) return;
    setLoadingIds(new Set([initialSbnId]));
    fetch(`/api/procedures/${initialSbnId}`)
      .then((r) => r.json())
      .then((detail: ProcedureDetail) => {
        const proc: SBNProcedureOption = { id: detail.id, name: detail.name };
        setSelectedProcedures([proc]);
        setDetailsMap({ [detail.id]: detail });
        setSelectedCodes(new Set(detail.cbhpm_codes.map((c) => c.code)));
      })
      .finally(() => setLoadingIds(new Set()));
  // Runs only on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Multi-procedure selection handler ────────────────────────────────────

  const handleProceduresChange = useCallback(
    (procedures: SBNProcedureOption[]) => {
      const prevIds = new Set(selectedProcedures.map((p) => p.id));
      const removedProcs = selectedProcedures.filter((p) => !procedures.find((np) => np.id === p.id));

      setSelectedProcedures(procedures);
      setCalculation(null);

      if (removedProcs.length > 0) {
        const remainingCodeSet = new Set<string>();
        for (const proc of procedures) {
          const detail = detailsMap[proc.id];
          if (detail) for (const c of detail.cbhpm_codes) remainingCodeSet.add(c.code);
        }
        setSelectedCodes((prev) => {
          const next = new Set(prev);
          for (const proc of removedProcs) {
            const detail = detailsMap[proc.id];
            if (detail) {
              for (const c of detail.cbhpm_codes) {
                if (!remainingCodeSet.has(c.code)) next.delete(c.code);
              }
            }
          }
          return next;
        });
      }

      for (const proc of procedures) {
        if (prevIds.has(proc.id) || detailsMap[proc.id]) continue;
        setLoadingIds((prev) => new Set([...prev, proc.id]));
        fetch(`/api/procedures/${proc.id}`)
          .then((r) => r.json())
          .then((detail: ProcedureDetail) => {
            setDetailsMap((prev) => ({ ...prev, [proc.id]: detail }));
            setSelectedCodes((prev) => {
              const next = new Set(prev);
              for (const c of detail.cbhpm_codes) next.add(c.code);
              return next;
            });
          })
          .finally(() => {
            setLoadingIds((prev) => {
              const next = new Set(prev);
              next.delete(proc.id);
              return next;
            });
          });
      }
    },
    [selectedProcedures, detailsMap],
  );

  // ── Build payload ─────────────────────────────────────────────────────────

  const buildCalculatePayload = useCallback(() => {
    const checked = allCbhpmCodes.filter((c) => selectedCodes.has(c.code));
    if (checked.length === 0) return null;
    return {
      selected_codes: checked.map((c) => ({
        cbhpm_code: c.code,
        description: c.description,
        porte: c.porte,
      })),
      auxiliaries_count: auxiliariesCount,
      requires_anesthesia: requiresAnesthesia,
      access_route_type: accessRoute,
    };
  }, [allCbhpmCodes, selectedCodes, auxiliariesCount, requiresAnesthesia, accessRoute]);

  // ── Real-time calculation (debounced 150 ms) ──────────────────────────────

  useEffect(() => {
    if (calcTimer.current) clearTimeout(calcTimer.current);
    const payload = buildCalculatePayload();
    if (!payload) { setCalculation(null); return; }

    calcTimer.current = setTimeout(async () => {
      const res = await fetch("/api/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) setCalculation(await res.json());
    }, 150);

    return () => { if (calcTimer.current) clearTimeout(calcTimer.current); };
  }, [buildCalculatePayload]);

  // ── Share ─────────────────────────────────────────────────────────────────

  const shareCalculation = useCallback(() => {
    if (selectedProcedures.length === 0 || !calculation) return;
    const url = new URL("/share", window.location.origin);
    url.searchParams.set("sbn", selectedProcedures.map((p) => p.id).join(","));
    const codeParam = allCbhpmCodes
      .filter((c) => selectedCodes.has(c.code))
      .map((c) => c.code)
      .join(",");
    url.searchParams.set("codes", codeParam);
    url.searchParams.set("a", String(auxiliariesCount));
    url.searchParams.set("an", requiresAnesthesia ? "1" : "0");
    url.searchParams.set("route", accessRoute);
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [selectedProcedures, calculation, allCbhpmCodes, selectedCodes, auxiliariesCount, requiresAnesthesia, accessRoute]);

  const toggleCode = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const canShare = !!calculation && selectedProcedures.length > 0;

  // ── Breakdown: discount rule label ───────────────────────────────────────

  const ruleLabel = accessRoute === "same"
    ? "Mesma via de acesso — CBHPM 4.1 (50% para procedimentos adicionais)"
    : "Vias de acesso diferentes — CBHPM 4.2 (70% para procedimentos adicionais)";

  return (
    <main className="hex-bg relative min-h-screen" style={{ backgroundColor: "hsl(var(--background))" }}>
      {/* Nav */}
      <div className="relative z-10 px-5 pt-5">
        <nav className="nav-bar mx-auto flex max-w-[1080px] items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            <div
              className="brand-mark flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: "linear-gradient(135deg, hsl(186,72%,28%), hsl(186,72%,22%))", boxShadow: "0 2px 8px hsla(186,72%,28%,0.35)" }}
            >
              <Activity aria-hidden="true" className="text-white" size={18} />
            </div>
            <div>
              <span className="block text-base font-extrabold tracking-tight text-slate-950 dark:text-slate-50">Afere</span>
              <span className="block text-[10px] font-medium tracking-[0.3px] text-slate-500 dark:text-slate-400 leading-none">NEUROCIRURGIA</span>
            </div>
          </Link>
          <button
            onClick={toggle}
            aria-checked={isDark}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className="theme-switch relative inline-flex h-8 w-14 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            role="switch"
            type="button"
          >
            <Sun aria-hidden="true" size={13} className="absolute left-2 text-amber-500 transition-opacity dark:opacity-35" />
            <Moon aria-hidden="true" size={13} className="absolute right-2 text-slate-500 opacity-45 transition-opacity dark:text-cyan-200 dark:opacity-100" />
            <span aria-hidden="true" className={`theme-switch-thumb absolute top-1 h-6 w-6 rounded-full transition-transform duration-200 ${isDark ? "translate-x-7" : "translate-x-1"}`} />
          </button>
        </nav>
      </div>

      {/* Hero */}
      <div className="relative z-[1] px-5 pb-6 pt-8 text-center">
        <h1 className="m-0 mb-1.5 text-[30px] font-extrabold tracking-tight text-slate-950 dark:text-slate-50">
          Composição de Honorários
        </h1>
        <p className="m-0 text-sm font-medium text-slate-500 dark:text-slate-400">
          Selecione o procedimento SBN · Monte a composição · Valorize em tempo real
        </p>
      </div>

      {/* Main grid */}
      <div className="main-grid relative z-[1] mx-auto grid max-w-[1080px] gap-7 px-5 pb-12">

        {/* ── Left panel ──────────────────────────────────────────────────── */}
        <div className="card-plush rounded-3xl border border-slate-200/80 dark:border-slate-700 bg-white dark:bg-slate-900 p-8">
          <div className="mb-6 flex items-center gap-2">
            <Stethoscope aria-hidden="true" className="text-primary" size={18} />
            <h2 className="m-0 text-[15px] font-bold text-slate-950 dark:text-slate-50">Buscar Procedimento SBN</h2>
          </div>
          <div className="mb-6">
            <Autocomplete
              label="Procedimento"
              options={searchOptions}
              value={selectedProcedures}
              onChange={handleProceduresChange}
              onSearch={setSearchQuery}
              initialQuery={initialQuery}
            />
          </div>

          {loadingDetail && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Carregando códigos CBHPM...
            </div>
          )}

          {allCbhpmCodes.length > 0 && !loadingDetail && (
            <>
              {/* CBHPM code list */}
              <div className="mb-4 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-5">
                <Calculator aria-hidden="true" className="text-primary" size={15} />
                <span className="text-[13px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Composição CBHPM
                </span>
              </div>
              <div className="mb-5 space-y-2">
                {allCbhpmCodes.map((c) => {
                  const checked = selectedCodes.has(c.code);
                  return (
                    <div
                      key={c.code}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border p-3 transition-colors",
                        checked
                          ? "border-primary/25 bg-teal-50/60 dark:border-teal-300/20 dark:bg-teal-900/15"
                          : "border-slate-100 dark:border-slate-800 opacity-60",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCode(c.code)}
                        aria-pressed={checked}
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                          checked
                            ? "border-primary bg-primary text-white"
                            : "border-slate-300 dark:border-slate-600",
                        )}
                      >
                        {checked && <Check size={11} strokeWidth={3} />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                            {c.code}
                          </span>
                          <span className={cn(
                            "rounded-lg border px-2 py-0.5 text-[11px] font-semibold",
                            checked
                              ? "border-primary/30 text-primary dark:border-teal-300/30 dark:text-teal-300"
                              : "border-slate-200 dark:border-slate-700 text-slate-400",
                          )}>
                            {c.porte}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[12px] leading-snug text-slate-600 dark:text-slate-300">
                          {c.description}
                        </p>
                      </div>

                      {checked && (
                        <button
                          type="button"
                          onClick={() => toggleCode(c.code)}
                          aria-label={`Remover ${c.code}`}
                          className="mt-0.5 shrink-0 text-slate-300 hover:text-red-400 dark:text-slate-600"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Access route selection */}
              <div className="mb-5 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Route aria-hidden="true" className="text-primary" size={15} />
                  <span className="text-[13px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Via de Acesso
                  </span>
                </div>
                <div className="space-y-2">
                  {(["same", "different"] as const).map((route) => {
                    const isSelected = accessRoute === route;
                    return (
                      <button
                        key={route}
                        type="button"
                        onClick={() => setAccessRoute(route)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                          isSelected
                            ? "border-primary/30 bg-teal-50/60 dark:border-teal-300/20 dark:bg-teal-900/15"
                            : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700",
                        )}
                      >
                        <span className={cn(
                          "mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          isSelected
                            ? "border-primary bg-primary dark:border-teal-400 dark:bg-teal-400"
                            : "border-slate-300 dark:border-slate-600",
                        )}>
                          {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        <div>
                          <div className={cn(
                            "text-[13px] font-semibold",
                            isSelected ? "text-primary dark:text-teal-300" : "text-slate-700 dark:text-slate-300",
                          )}>
                            {route === "same" ? "Mesma via de acesso" : "Vias de acesso diferentes"}
                          </div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500">
                            {route === "same"
                              ? "CBHPM 4.1 — procedimento adicional valorado a 50%"
                              : "CBHPM 4.2 — procedimento adicional valorado a 70%"}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Auxiliaries + anesthesia */}
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.4px] text-slate-500 dark:text-slate-400">
                    Número de Auxiliares
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setAuxiliariesCount(n)}
                        className={cn(
                          "h-9 w-9 rounded-xl border text-sm font-semibold transition-colors",
                          auxiliariesCount === n
                            ? "border-primary bg-primary text-white dark:border-teal-400 dark:bg-teal-600"
                            : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary/40",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="medical-toggle-panel flex items-center justify-between gap-4 rounded-2xl border px-4 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="clinical-icon-chip flex h-8 w-8 items-center justify-center rounded-full">
                    <HeartPulse aria-hidden="true" size={16} />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-slate-950 dark:text-slate-50">Anestesiologista</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">Incluir honorários do anestesista</div>
                  </div>
                </div>
                <Toggle checked={requiresAnesthesia} onChange={setRequiresAnesthesia} />
              </div>
            </>
          )}

          {selectedProcedures.length === 0 && !loadingDetail && (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 py-10 text-center">
              <Stethoscope className="text-slate-300 dark:text-slate-600" size={32} />
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Busque e selecione um procedimento SBN para montar a composição
              </p>
            </div>
          )}
        </div>

        {/* ── Right panel ─────────────────────────────────────────────────── */}
        <div className="results-card relative overflow-hidden rounded-3xl border border-primary/15 dark:border-teal-300/20 p-7">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator aria-hidden="true" className="text-primary" size={18} />
              <h2 className="m-0 text-[15px] font-bold text-slate-950 dark:text-slate-50">Valoração</h2>
            </div>
            <span className="clinical-pill rounded-full px-2.5 py-1 text-[11px] font-semibold">CBHPM 2025</span>
          </div>

          {calculation ? (
            <>
              {/* ── Procedimentos selecionados ──────────────────────────── */}
              <section className="mb-5">
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-slate-400 dark:text-slate-500">
                  Procedimentos Selecionados
                </h3>
                <dl className="space-y-2">
                  {calculation.code_breakdown.map((b) => (
                    <div key={b.cbhpm_code} className={cn(
                      "flex items-end justify-between gap-1 rounded-xl px-3 py-2",
                      b.is_principal
                        ? "border border-primary/20 bg-teal-50/50 dark:border-teal-300/15 dark:bg-teal-900/10"
                        : "",
                    )}>
                      <div className="min-w-0">
                        <dt className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{b.cbhpm_code}</span>
                          {b.is_principal && (
                            <span className="rounded-md bg-primary/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-primary dark:bg-teal-300/10 dark:text-teal-300">
                              principal
                            </span>
                          )}
                        </dt>
                        <dd className="truncate text-[12px] text-slate-500 dark:text-slate-400">{b.description}</dd>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[11px] font-semibold text-primary dark:text-teal-400">{b.porte}</span>
                        <span className="font-grotesk text-sm font-semibold text-slate-950 dark:text-slate-50">
                          {money.format(b.base_value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </dl>
              </section>

              <div className="teal-divider my-4" />

              {/* ── Regra aplicada ──────────────────────────────────────── */}
              <section className="mb-5">
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-slate-400 dark:text-slate-500">
                  Regra Aplicada
                </h3>
                <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 px-3 py-2.5 text-[12px] text-slate-500 dark:text-slate-400">
                  {ruleLabel}
                </div>
              </section>

              {/* ── Cálculo do cirurgião ─────────────────────────────────── */}
              <section className="mb-5">
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-slate-400 dark:text-slate-500">
                  Cálculo do Cirurgião
                </h3>
                <dl className="space-y-1.5">
                  <BreakdownRow
                    label="Procedimento principal"
                    value={calculation.surgeon_breakdown.principal_value}
                  />
                  {calculation.surgeon_breakdown.additional_gross > 0 && (
                    <>
                      <BreakdownRow
                        label="Procedimentos adicionais (bruto)"
                        value={calculation.surgeon_breakdown.additional_gross}
                        muted
                      />
                      <BreakdownRow
                        label={`Desconto CBHPM (× ${calculation.surgeon_breakdown.discount_rate === 0.50 ? "50%" : "70%"})`}
                        value={calculation.surgeon_breakdown.additional_discounted}
                        muted
                      />
                    </>
                  )}
                  <div className="pt-1">
                    <BreakdownRow
                      label="Total cirurgião"
                      value={calculation.lead_surgeon_fee}
                      strong
                    />
                  </div>
                </dl>
              </section>

              <div className="teal-divider my-4" />

              {/* ── Cálculo dos auxiliares ──────────────────────────────── */}
              <section className="mb-5">
                <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.5px] text-slate-400 dark:text-slate-500">
                  Cálculo dos Auxiliares
                </h3>
                <dl className="space-y-2.5 dark:text-slate-200">
                  <ResultRow label="Cirurgião Principal" value={calculation.lead_surgeon_fee} strong />
                  {calculation.individual_auxiliary_fees.map((af) => (
                    <ResultRow
                      key={af.position}
                      label={`${af.position}º Auxiliar`}
                      note={pct(af.percentage)}
                      value={af.fee}
                    />
                  ))}
                  {calculation.anesthesiologist_fee > 0 && (
                    <ResultRow label="Anestesiologista" value={calculation.anesthesiologist_fee} />
                  )}
                </dl>
              </section>

              <div className="teal-divider my-4" />

              {/* ── Valor Final ─────────────────────────────────────────── */}
              <div
                className="rounded-2xl p-4 text-white"
                style={{ background: "linear-gradient(135deg, hsl(186,72%,28%), hsl(186,68%,22%))", boxShadow: "0 4px 20px hsla(186,72%,28%,0.35)" }}
              >
                <div className="mb-2 grid grid-cols-2 gap-1 text-[11px] opacity-75">
                  <span>Cirurgião</span>
                  <span className="text-right font-semibold">{money.format(calculation.lead_surgeon_fee)}</span>
                  {calculation.auxiliaries_fee > 0 && (
                    <>
                      <span>Auxiliares</span>
                      <span className="text-right font-semibold">{money.format(calculation.auxiliaries_fee)}</span>
                    </>
                  )}
                  {calculation.anesthesiologist_fee > 0 && (
                    <>
                      <span>Anestesiologista</span>
                      <span className="text-right font-semibold">{money.format(calculation.anesthesiologist_fee)}</span>
                    </>
                  )}
                </div>
                <div className="mb-0.5 text-xs font-semibold uppercase tracking-[0.5px] opacity-75">Total da Equipe</div>
                <div className="font-grotesk text-[36px] font-bold leading-none tracking-tight">
                  {money.format(calculation.final_total)}
                </div>
                {selectedProcedures.length > 0 && (
                  <div className="mt-1.5 text-[11px] font-medium opacity-65">
                    {selectedProcedures.map((p) => p.name).join(" · ")}
                  </div>
                )}
              </div>

              {canShare && (
                <button
                  id="share-calculation-btn"
                  onClick={shareCalculation}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/25 px-4 py-3 text-sm font-semibold text-primary transition-all hover:bg-primary/5 active:scale-[0.98] dark:border-teal-300/20 dark:text-teal-300"
                  type="button"
                >
                  {copied ? <><Check size={16} /> Link copiado!</> : <><Share2 size={16} /> Compartilhar cálculo</>}
                </button>
              )}

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 p-3">
                <Info aria-hidden="true" className="mt-px shrink-0 text-slate-400 dark:text-slate-500" size={15} />
                <p className="m-0 text-[11px] font-medium leading-relaxed text-slate-400 dark:text-slate-500">
                  Valores calculados conforme Tabela CBHPM 2025/2026 (Faixa Original). Sujeito à variação por convênio.
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <Calculator className="text-slate-200 dark:text-slate-700" size={40} />
              <p className="text-sm text-slate-400 dark:text-slate-500">
                Selecione ao menos um código CBHPM para ver a valoração
              </p>
            </div>
          )}
        </div>
      </div>

      <footer className="relative z-[1] px-5 pb-5 text-center">
        <div className="footer-divider mb-3.5 h-px" />
        <p className="m-0 text-xs font-medium text-slate-400 dark:text-slate-500">
          2026 &nbsp;·&nbsp; <span className="font-bold text-slate-500">LabF5</span> &nbsp;·&nbsp; Todos os direitos reservados
        </p>
      </footer>
    </main>
  );
}

// ─── Supporting row components ────────────────────────────────────────────────

function ResultRow({ label, value, note, strong }: { label: string; value: number | undefined; note?: string; strong?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-1">
      <dt className={cn("shrink-0 text-[13px]", strong ? "font-semibold text-slate-700 dark:text-slate-300" : "font-medium text-slate-500 dark:text-slate-400")}>
        {label}
        {note && <span className="ml-1.5 text-[11px] font-semibold text-primary/70 dark:text-teal-400/70">{note}</span>}
      </dt>
      <div className="leader" />
      <dd className={cn("font-grotesk shrink-0 text-sm font-semibold", strong ? "text-slate-950 dark:text-slate-50" : "text-slate-800 dark:text-slate-100")}>
        {value === undefined ? "—" : money.format(value)}
      </dd>
    </div>
  );
}

function BreakdownRow({ label, value, muted, strong }: { label: string; value: number; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-1">
      <span className={cn("text-[12px]", strong ? "font-semibold text-slate-700 dark:text-slate-200" : muted ? "text-slate-400 dark:text-slate-500" : "text-slate-600 dark:text-slate-300")}>
        {label}
      </span>
      <span className={cn("font-grotesk text-[13px] font-semibold", strong ? "text-slate-950 dark:text-slate-50" : muted ? "text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-100")}>
        {money.format(value)}
      </span>
    </div>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

function SearchParamsReader() {
  const searchParams = useSearchParams();
  const rawRoute = searchParams.get("route");
  const initialRoute: AccessRouteType =
    rawRoute === "different" ? "different" : "same";
  return (
    <ProcedureContent
      initialQuery={searchParams.get("q") ?? ""}
      initialSbnId={searchParams.get("sbn") ?? ""}
      initialRoute={initialRoute}
    />
  );
}

export default function ProcedurePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "hsl(var(--background))" }}>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <SearchParamsReader />
    </Suspense>
  );
}
