"use client";

import {
  AlertCircle,
  BookmarkCheck,
  Calculator,
  Check,
  Copy,
  HeartPulse,
  Info,
  LogIn,
  Moon,
  Route,
  Share2,
  Smartphone,
  Stethoscope,
  Sun,
  X,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
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
type AppliedAdjustment = {
  code: string;
  label: string;
  percentage: number;
  source: string;
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
  base_surgeon_value: number;
  base_auxiliaries_total_value: number;
  base_anesthesiologist_value: number;
  base_team_total_value: number;
  selected_adjustments: AppliedAdjustment[];
  total_adjustment_percentage: number;
  adjustment_value: number;
};

type CompositionDetail = {
  public_id: string;
  name: string;
  sbn_procedure_id: string;
  sbn_procedure_name: string;
  selected_codes: Array<{ cbhpm_code: string; description: string; porte: string }>;
  access_route_type: "same" | "different";
  auxiliaries_count: number;
  requires_anesthesia: boolean;
  adjustments: string[];
  created_at: string;
  updated_at: string;
};

// Adjustment catalogue — matches service.AdjustmentCatalog in the backend.
const ADJUSTMENT_CATALOG = [
  {
    code: "emergency_special_hours",
    label: "Urgência/emergência em horário especial",
    pct: 30,
    helper: "Entre 19h e 7h, ou em sábados, domingos e feriados, conforme Instruções Gerais da CBHPM.",
    group: "emergency" as const,
  },
  {
    code: "pediatric_low_weight_or_premature",
    label: "< 2.500 g ou prematuro < 37 semanas",
    pct: 100,
    helper: null,
    group: "pediatric" as const,
  },
  {
    code: "pediatric_neonate_or_infant",
    label: "Neonato/lactante — 0 a 24 meses",
    pct: 50,
    helper: null,
    group: "pediatric" as const,
  },
  {
    code: "pediatric_child_under_12",
    label: "Pediátrico — 24 meses a 12 anos incompletos",
    pct: 30,
    helper: null,
    group: "pediatric" as const,
  },
];

const PEDIATRIC_CODES = ADJUSTMENT_CATALOG
  .filter((a) => a.group === "pediatric")
  .map((a) => a.code);

// ─── Constants ────────────────────────────────────────────────────────────────

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const pct = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 }).format(n / 100);

// ─── Workflow content ─────────────────────────────────────────────────────────

function ProcedureContent({ initialQuery, initialSbnId, initialRoute, initialCompositionId }: {
  initialQuery: string;
  initialSbnId: string;
  initialRoute: AccessRouteType;
  initialCompositionId: string;
}) {
  const { isDark, toggle } = useTheme();
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [searchOptions, setSearchOptions] = useState<SBNProcedureOption[]>([]);
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  const [selectedProcedures, setSelectedProcedures] = useState<SBNProcedureOption[]>([]);
  const [detailsMap, setDetailsMap] = useState<Record<string, ProcedureDetail>>({});
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [auxiliariesCount, setAuxiliariesCount] = useState(1);
  const [requiresAnesthesia, setRequiresAnesthesia] = useState(true);
  const [adjustments, setAdjustments] = useState<string[]>([]);
  const [accessRoute, setAccessRoute] = useState<AccessRouteType>(initialRoute);

  const hasAdjustment = (code: string) => adjustments.includes(code);

  const toggleEmergency = () =>
    setAdjustments((prev) =>
      prev.includes("emergency_special_hours")
        ? prev.filter((c) => c !== "emergency_special_hours")
        : [...prev, "emergency_special_hours"],
    );

  const setPediatric = (code: string | null) =>
    setAdjustments((prev) => {
      const withoutPediatric = prev.filter((c) => !PEDIATRIC_CODES.includes(c));
      return code ? [...withoutPediatric, code] : withoutPediatric;
    });

  const activePediatric = adjustments.find((c) => PEDIATRIC_CODES.includes(c)) ?? null;

  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Share modal (link + QR code)
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // Composition save states
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [compositionName, setCompositionName] = useState("");
  const [savingComposition, setSavingComposition] = useState(false);
  const [compositionSaved, setCompositionSaved] = useState(false);
  const [compositionSaveError, setCompositionSaveError] = useState<string | null>(null);

  // Composition loaded from URL (for update flow)
  const [loadedCompositionId, setLoadedCompositionId] = useState<string | null>(null);
  const [loadedCompositionName, setLoadedCompositionName] = useState("");

  const calcTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

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

  // CBHPM 5.2: auxiliary count is determined by the highest num_auxiliaries
  // among checked codes. When > 0, the manual mandates the value — lock the UI.
  const cbhpmMandatedAux = useMemo(() => {
    const checked = allCbhpmCodes.filter((c) => selectedCodes.has(c.code));
    if (checked.length === 0) return 0;
    return Math.max(0, ...checked.map((c) => c.num_auxiliaries));
  }, [allCbhpmCodes, selectedCodes]);

  const auxIsLocked = cbhpmMandatedAux > 0;

  // Sync auxiliariesCount to the mandated value whenever it changes to > 0
  useEffect(() => {
    if (cbhpmMandatedAux > 0) setAuxiliariesCount(cbhpmMandatedAux);
  }, [cbhpmMandatedAux]);

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

  // ── Load composition from ?composition=<public_id> ────────────────────────
  // Waits for Clerk auth to be ready so the Bearer token is available.

  useEffect(() => {
    if (!initialCompositionId || !isLoaded) return;

    const loadComposition = async () => {
      const token = await getToken();
      const res = await fetch(`/api/compositions/${initialCompositionId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const comp: CompositionDetail | null = res.ok ? await res.json() : null;
      if (!comp) return;
      setLoadedCompositionId(comp.public_id);
      setLoadedCompositionName(comp.name);
      setCompositionName(comp.name);
      setAccessRoute(comp.access_route_type);
      setRequiresAnesthesia(comp.requires_anesthesia);
      setAdjustments(comp.adjustments ?? []);
      setAuxiliariesCount(comp.auxiliaries_count);

      if (!comp.sbn_procedure_id) return;
      setLoadingIds(new Set([comp.sbn_procedure_id]));
      try {
        const detail: ProcedureDetail = await fetch(`/api/procedures/${comp.sbn_procedure_id}`).then((r) => r.json());
        const proc: SBNProcedureOption = { id: detail.id, name: detail.name };
        setSelectedProcedures([proc]);
        setDetailsMap({ [detail.id]: detail });
        const compositionCodeSet = new Set(comp.selected_codes.map((c) => c.cbhpm_code));
        setSelectedCodes(compositionCodeSet);
      } finally {
        setLoadingIds(new Set());
      }
    };

    loadComposition();
  // Re-runs when auth loads so the token is available; initialCompositionId is stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // ── Direct procedure load via ?sbn=<id> (from home page selection) ──────────

  useEffect(() => {
    if (!initialSbnId || initialCompositionId) return;
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
      adjustments,
    };
  }, [allCbhpmCodes, selectedCodes, auxiliariesCount, requiresAnesthesia, accessRoute, adjustments]);

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

  // Reset composition save state when user changes the calculation
  useEffect(() => {
    setCompositionSaved(false);
    setCompositionSaveError(null);
  }, [calculation]);

  // ── Save composition (new) ────────────────────────────────────────────────

  const handleSaveComposition = useCallback(async () => {
    const trimmedName = compositionName.trim();
    if (!trimmedName || selectedProcedures.length === 0) return;
    setSavingComposition(true);
    setCompositionSaveError(null);
    try {
      const token = await getToken();
      const checkedCodes = allCbhpmCodes.filter((c) => selectedCodes.has(c.code));
      const payload = {
        name: trimmedName,
        sbn_procedure_id: selectedProcedures[0].id,
        sbn_procedure_name: selectedProcedures.map((p) => p.name).join(" + "),
        selected_codes: checkedCodes.map((c) => ({
          cbhpm_code: c.code,
          description: c.description,
          porte: c.porte,
        })),
        access_route_type: accessRoute,
        auxiliaries_count: auxiliariesCount,
        requires_anesthesia: requiresAnesthesia,
        adjustments,
      };
      const res = await fetch("/api/compositions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setCompositionSaved(true);
        setShowSaveForm(false);
      } else if (res.status === 401) {
        setCompositionSaveError("Faça login para salvar composições.");
      } else {
        setCompositionSaveError("Não foi possível salvar. Tente novamente.");
      }
    } catch {
      setCompositionSaveError("Erro de conexão. Verifique a rede e tente novamente.");
    } finally {
      setSavingComposition(false);
    }
  }, [compositionName, selectedProcedures, allCbhpmCodes, selectedCodes, accessRoute, auxiliariesCount, requiresAnesthesia, adjustments, getToken]);

  // ── Update composition (loaded from URL) ──────────────────────────────────

  const handleUpdateComposition = useCallback(async () => {
    if (!loadedCompositionId || selectedProcedures.length === 0) return;
    setSavingComposition(true);
    setCompositionSaveError(null);
    try {
      const token = await getToken();
      const checkedCodes = allCbhpmCodes.filter((c) => selectedCodes.has(c.code));
      const payload = {
        name: loadedCompositionName,
        sbn_procedure_id: selectedProcedures[0].id,
        sbn_procedure_name: selectedProcedures.map((p) => p.name).join(" + "),
        selected_codes: checkedCodes.map((c) => ({
          cbhpm_code: c.code,
          description: c.description,
          porte: c.porte,
        })),
        access_route_type: accessRoute,
        auxiliaries_count: auxiliariesCount,
        requires_anesthesia: requiresAnesthesia,
        adjustments,
      };
      const res = await fetch(`/api/compositions/${loadedCompositionId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setCompositionSaved(true);
      } else {
        setCompositionSaveError("Não foi possível atualizar. Tente novamente.");
      }
    } catch {
      setCompositionSaveError("Erro de conexão. Verifique a rede e tente novamente.");
    } finally {
      setSavingComposition(false);
    }
  }, [loadedCompositionId, loadedCompositionName, selectedProcedures, allCbhpmCodes, selectedCodes, accessRoute, auxiliariesCount, requiresAnesthesia, adjustments, getToken]);

  // ── Share ─────────────────────────────────────────────────────────────────

  // Builds the public share URL for the current calculation. This is the exact
  // same URL the QR code encodes — keep them in sync via this single source.
  const buildShareUrl = useCallback(() => {
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
    if (adjustments.length > 0) url.searchParams.set("adj", adjustments.join(","));
    return url.toString();
  }, [selectedProcedures, allCbhpmCodes, selectedCodes, auxiliariesCount, requiresAnesthesia, accessRoute, adjustments]);

  const shareCalculation = useCallback(() => {
    if (selectedProcedures.length === 0 || !calculation) return;
    setShareUrl(buildShareUrl());
  }, [selectedProcedures, calculation, buildShareUrl]);

  const copyShareLink = useCallback(() => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [shareUrl]);

  const toggleCode = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const canShare = !!calculation && selectedProcedures.length > 0;
  const canSaveComposition = !!calculation && selectedProcedures.length > 0;

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
            <div className="brand-mark h-9 w-9 shrink-0">
              {/* Theme-aware: navy mark on the light tile, white mark in dark mode. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/afere-symbol.svg" alt="" aria-hidden="true" width={24} height={23} className="block dark:hidden" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/afere-symbol-light.svg" alt="" aria-hidden="true" width={24} height={23} className="hidden dark:block" />
            </div>
            <div>
              <span className="block text-base font-extrabold tracking-tight text-slate-950 dark:text-slate-50">Afere</span>
              <span className="block text-[10px] font-medium tracking-[0.3px] text-slate-500 dark:text-slate-400 leading-none">NEUROCIRURGIA</span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {/* Auth control */}
            {isLoaded && (
              isSignedIn ? (
                <UserButton />
              ) : (
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
                  >
                    <LogIn size={13} aria-hidden="true" />
                    Entrar
                  </button>
                </SignInButton>
              )
            )}
            {/* Theme toggle */}
            <button
              onClick={toggle}
              aria-checked={isDark}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="theme-switch relative inline-flex h-8 w-14 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              role="switch"
              type="button"
            >
              <Sun aria-hidden="true" size={13} className="absolute left-2 text-amber-500 transition-opacity dark:opacity-35" />
              <Moon aria-hidden="true" size={13} className="absolute right-2 text-slate-500 opacity-45 transition-opacity dark:text-[#94A3B8] dark:opacity-100" />
              <span aria-hidden="true" className={`theme-switch-thumb absolute top-1 h-6 w-6 rounded-full transition-transform duration-200 ${isDark ? "translate-x-7" : "translate-x-1"}`} />
            </button>
          </div>
        </nav>
      </div>

      {/* Hero */}
      <div className="relative z-[1] px-5 pb-6 pt-8 text-center">
        <h1 className="m-0 mb-1.5 text-[30px] font-extrabold tracking-tight text-slate-950 dark:text-slate-50">
          Composição de Honorários
        </h1>
        <p className="m-0 text-sm font-medium text-slate-500 dark:text-slate-400">
          {loadedCompositionId
            ? <>Editando composição: <span className="font-semibold text-primary dark:text-[#5F84B3]">{loadedCompositionName}</span></>
            : "Selecione o procedimento SBN · Monte a composição · Valorize em tempo real"}
        </p>
      </div>

      {/* Main grid */}
      <div className="main-grid relative z-[1] mx-auto grid max-w-[1080px] gap-7 px-5 pb-12">

        {/* ── Left panel ──────────────────────────────────────────────────── */}
        <div className="card-plush rounded-3xl border border-slate-200/80 dark:border-slate-700 dark:bg-slate-900 p-8">
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
                          ? "border-primary/25 bg-[#EAF0F6] dark:border-[#5F84B3]/20 dark:bg-[#182235]/50"
                          : "border-slate-100 dark:border-slate-800 opacity-60",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleCode(c.code)}
                        aria-pressed={checked}
                        className={cn(
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all duration-200",
                          checked
                            ? "border-primary bg-primary text-white shadow-[0_0_7px_1px_rgba(53,54,80,0.5)] dark:border-[#5F84B3] dark:bg-[#355C8A] dark:shadow-[0_0_9px_1px_rgba(95,132,179,0.7)]"
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
                              ? "border-primary/30 text-primary dark:border-[#5F84B3]/30 dark:text-[#5F84B3]"
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
                            ? "border-primary/30 bg-[#EAF0F6] dark:border-[#5F84B3]/20 dark:bg-[#182235]/50"
                            : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700",
                        )}
                      >
                        <span className={cn(
                          "mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          isSelected
                            ? "border-primary bg-primary dark:border-[#5F84B3] dark:bg-[#5F84B3]"
                            : "border-slate-300 dark:border-slate-600",
                        )}>
                          {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        <div>
                          <div className={cn(
                            "text-[13px] font-semibold",
                            isSelected ? "text-primary dark:text-[#5F84B3]" : "text-slate-700 dark:text-slate-300",
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
                  <div className="mb-2 flex items-center gap-2">
                    <label className="block text-xs font-semibold uppercase tracking-[0.4px] text-slate-500 dark:text-slate-400">
                      Número de Auxiliares
                    </label>
                    {auxIsLocked && (
                      <span className="rounded-md bg-primary/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-primary dark:bg-[#5F84B3]/10 dark:text-[#5F84B3]">
                        Definido pelo CBHPM
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[0, 1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => { if (!auxIsLocked) setAuxiliariesCount(n); }}
                        disabled={auxIsLocked}
                        aria-disabled={auxIsLocked}
                        className={cn(
                          "h-9 w-9 rounded-xl border text-sm font-semibold transition-colors",
                          auxIsLocked
                            ? auxiliariesCount === n
                              ? "border-primary bg-primary text-white dark:border-[#5F84B3] dark:bg-[#355C8A] cursor-default"
                              : "border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                            : auxiliariesCount === n
                              ? "border-primary bg-primary text-white dark:border-[#5F84B3] dark:bg-[#355C8A]"
                              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary/40",
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
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

              </div>

              {/* Acréscimos CBHPM */}
              <div className="mt-4 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <AlertCircle aria-hidden="true" className="text-primary" size={15} />
                  <span className="text-[13px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Acréscimos CBHPM
                  </span>
                </div>

                {/* Urgência/emergência — checkbox */}
                {(() => {
                  const em = ADJUSTMENT_CATALOG.find((a) => a.code === "emergency_special_hours")!;
                  const active = hasAdjustment(em.code);
                  return (
                    <button
                      type="button"
                      onClick={toggleEmergency}
                      className={cn(
                        "mb-3 flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                        active
                          ? "border-amber-200 bg-amber-50/60 dark:border-amber-400/20 dark:bg-amber-900/10"
                          : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700",
                      )}
                    >
                      <span className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                        active ? "border-amber-500 bg-amber-500 dark:border-amber-400 dark:bg-amber-400" : "border-slate-300 dark:border-slate-600",
                      )}>
                        {active && <Check size={10} strokeWidth={3} className="text-white" />}
                      </span>
                      <div>
                        <div className={cn("text-[13px] font-semibold", active ? "text-amber-800 dark:text-amber-300" : "text-slate-700 dark:text-slate-300")}>
                          {em.label} (+{em.pct}%)
                        </div>
                        {em.helper && (
                          <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">{em.helper}</div>
                        )}
                      </div>
                    </button>
                  );
                })()}

                {/* Pediátrico — radio group (mutually exclusive) */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.4px] text-slate-400 dark:text-slate-500 mb-1.5">
                    Paciente pediátrico
                  </div>
                  {/* "Nenhuma" option */}
                  <button
                    type="button"
                    onClick={() => setPediatric(null)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      activePediatric === null
                        ? "border-primary/30 bg-[#EAF0F6] dark:border-[#5F84B3]/20 dark:bg-[#182235]/50"
                        : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700",
                    )}
                  >
                    <span className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      activePediatric === null
                        ? "border-primary bg-primary dark:border-[#5F84B3] dark:bg-[#5F84B3]"
                        : "border-slate-300 dark:border-slate-600",
                    )}>
                      {activePediatric === null && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    <span className={cn("text-[13px] font-medium", activePediatric === null ? "text-primary dark:text-[#5F84B3]" : "text-slate-600 dark:text-slate-400")}>
                      Não pediátrico
                    </span>
                  </button>

                  {ADJUSTMENT_CATALOG.filter((a) => a.group === "pediatric").map((adj) => {
                    const isActive = activePediatric === adj.code;
                    return (
                      <button
                        key={adj.code}
                        type="button"
                        onClick={() => setPediatric(adj.code)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                          isActive
                            ? "border-primary/30 bg-[#EAF0F6] dark:border-[#5F84B3]/20 dark:bg-[#182235]/50"
                            : "border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700",
                        )}
                      >
                        <span className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                          isActive
                            ? "border-primary bg-primary dark:border-[#5F84B3] dark:bg-[#5F84B3]"
                            : "border-slate-300 dark:border-slate-600",
                        )}>
                          {isActive && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        <div>
                          <span className={cn("text-[13px] font-medium", isActive ? "text-primary dark:text-[#5F84B3]" : "text-slate-600 dark:text-slate-400")}>
                            {adj.label}
                          </span>
                          <span className={cn("ml-2 text-[12px] font-semibold", isActive ? "text-primary dark:text-[#5F84B3]" : "text-slate-400")}>
                            +{adj.pct}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
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
        <div className="results-card relative overflow-hidden rounded-3xl border border-primary/15 dark:border-[#5F84B3]/20 p-7">
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
                        ? "border border-primary/20 bg-[#EAF0F6] dark:border-[#5F84B3]/15 dark:bg-[#182235]/40"
                        : "",
                    )}>
                      <div className="min-w-0">
                        <dt className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">{b.cbhpm_code}</span>
                          {b.is_principal && (
                            <span className="rounded-md bg-primary/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-primary dark:bg-[#5F84B3]/10 dark:text-[#5F84B3]">
                              principal
                            </span>
                          )}
                        </dt>
                        <dd className="truncate text-[12px] text-slate-500 dark:text-slate-400">{b.description}</dd>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[11px] font-semibold text-primary dark:text-[#5F84B3]">{b.porte}</span>
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

              {/* ── Acréscimos CBHPM ─────────────────────────────────────── */}
              {(calculation.selected_adjustments ?? []).length > 0 && (
                <div className="mb-5 rounded-xl border border-amber-200 dark:border-amber-400/20 bg-amber-50/70 dark:bg-amber-900/10 px-3.5 py-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                    <span className="text-[12px] font-semibold text-amber-800 dark:text-amber-300">
                      Acréscimos CBHPM — total +{(calculation.total_adjustment_percentage ?? 0).toFixed(0)}%
                    </span>
                    <span className="ml-auto font-grotesk text-[12px] font-bold text-amber-800 dark:text-amber-300">
                      +{money.format(calculation.adjustment_value ?? 0)}
                    </span>
                  </div>
                  {(calculation.selected_adjustments ?? []).map((a) => (
                    <div key={a.code} className="ml-6 flex items-center justify-between">
                      <span className="text-[11px] text-amber-700 dark:text-amber-400">{a.label}</span>
                      <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">+{a.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              )}

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
                style={{ background: "linear-gradient(135deg, hsl(214,52%,24%), hsl(214,52%,18%))", boxShadow: "0 4px 20px hsla(214,52%,24%,0.35)" }}
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
                  {(calculation.selected_adjustments ?? []).length > 0 && (
                    <>
                      <span className="text-amber-300">Acréscimos CBHPM (+{(calculation.total_adjustment_percentage ?? 0).toFixed(0)}%)</span>
                      <span className="text-right font-semibold text-amber-300">+{money.format(calculation.adjustment_value ?? 0)}</span>
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
                <div className="mt-4 flex flex-col gap-2">
                  {/* Share */}
                  <button
                    id="share-calculation-btn"
                    onClick={shareCalculation}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/25 px-4 py-3 text-sm font-semibold text-primary transition-all hover:bg-primary/5 active:scale-[0.98] dark:border-[#5F84B3]/20 dark:text-[#5F84B3]"
                    type="button"
                  >
                    <Share2 size={16} /> Compartilhar cálculo
                  </button>

                  {/* ── Composition save / update area ── */}
                  {canSaveComposition && !isSignedIn && isLoaded && (
                    <SignInButton mode="modal">
                      <button
                        type="button"
                        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-[0.98]"
                      >
                        <LogIn size={16} /> Entrar para salvar composição
                      </button>
                    </SignInButton>
                  )}
                  {canSaveComposition && isSignedIn && (
                    loadedCompositionId ? (
                      /* Update flow: composition was loaded from URL */
                      compositionSaved ? (
                        <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 dark:border-emerald-700/40 bg-emerald-50/70 dark:bg-emerald-900/15 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          <Check size={16} />
                          Composição atualizada com sucesso
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={handleUpdateComposition}
                            disabled={savingComposition}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-[0.98] disabled:opacity-50"
                            type="button"
                          >
                            {savingComposition
                              ? <><div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Atualizando...</>
                              : <><BookmarkCheck size={16} /> Atualizar composição</>}
                          </button>
                          {compositionSaveError && (
                            <div className="flex items-center gap-2 rounded-2xl border border-red-200 dark:border-red-800/40 bg-red-50/70 dark:bg-red-900/15 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400">
                              <X size={15} />
                              {compositionSaveError}
                            </div>
                          )}
                        </>
                      )
                    ) : (
                      /* Save flow: new composition */
                      compositionSaved ? (
                        <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 dark:border-emerald-700/40 bg-emerald-50/70 dark:bg-emerald-900/15 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          <Check size={16} />
                          Composição salva!{" "}
                          <Link
                            href="/"
                            className="underline underline-offset-2 hover:no-underline"
                          >
                            Ver minhas composições
                          </Link>
                        </div>
                      ) : showSaveForm ? (
                        /* Inline name form */
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-3">
                          <label className="block text-xs font-semibold uppercase tracking-[0.4px] text-slate-500 dark:text-slate-400">
                            Nome da composição
                          </label>
                          <input
                            ref={nameInputRef}
                            type="text"
                            value={compositionName}
                            onChange={(e) => setCompositionName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSaveComposition(); if (e.key === "Escape") setShowSaveForm(false); }}
                            placeholder="Ex: Craniotomia + DVP"
                            maxLength={120}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-primary dark:focus:border-[#5F84B3] focus:outline-none transition-colors"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveComposition}
                              disabled={savingComposition || !compositionName.trim()}
                              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary transition-all hover:bg-primary/10 active:scale-[0.98] disabled:opacity-50 dark:border-[#5F84B3]/20 dark:text-[#5F84B3] dark:hover:bg-[#5F84B3]/10"
                              type="button"
                            >
                              {savingComposition
                                ? <><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> Salvando...</>
                                : <><BookmarkCheck size={15} /> Salvar</>}
                            </button>
                            <button
                              onClick={() => setShowSaveForm(false)}
                              className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                              type="button"
                            >
                              Cancelar
                            </button>
                          </div>
                          {compositionSaveError && (
                            <div className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800/40 bg-red-50/70 dark:bg-red-900/15 px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400">
                              <X size={14} />
                              {compositionSaveError}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setShowSaveForm(true);
                            setTimeout(() => nameInputRef.current?.focus(), 50);
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 active:scale-[0.98]"
                          type="button"
                        >
                          <BookmarkCheck size={16} /> Salvar composição
                        </button>
                      )
                    )
                  )}
                </div>
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

      {/* ── Share modal: link + QR code ─────────────────────────────────────── */}
      {shareUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-modal-title"
          onKeyDown={(e) => { if (e.key === "Escape") setShareUrl(null); }}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setShareUrl(null)}
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
          />

          {/* Card */}
          <div className="card-plush relative w-full max-w-sm rounded-3xl border border-slate-200/80 bg-white p-7 dark:border-slate-700 dark:bg-slate-900">
            <button
              type="button"
              aria-label="Fechar"
              onClick={() => setShareUrl(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            >
              <X size={16} />
            </button>

            <div className="mb-5 flex items-center gap-2">
              <Share2 size={16} className="text-primary dark:text-[#5F84B3]" aria-hidden="true" />
              <h2 id="share-modal-title" className="m-0 text-[15px] font-bold text-slate-950 dark:text-slate-50">
                Compartilhar relatório
              </h2>
            </div>

            {/* Copy link button */}
            <button
              type="button"
              onClick={copyShareLink}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary transition-all hover:bg-primary/10 active:scale-[0.98] dark:border-[#5F84B3]/20 dark:text-[#5F84B3] dark:hover:bg-[#5F84B3]/10"
            >
              {copied ? <><Check size={16} /> Link copiado!</> : <><Copy size={16} /> Copiar link</>}
            </button>

            {/* URL display */}
            <p className="mt-3 break-all rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
              {shareUrl}
            </p>

            {/* QR code */}
            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700">
                <QRCodeSVG
                  value={shareUrl}
                  size={148}
                  level="M"
                  marginSize={0}
                  bgColor="#FFFFFF"
                  fgColor="#0F172A"
                  title="QR Code do relatório compartilhado"
                  className="h-[148px] w-[148px]"
                />
              </div>
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                <Smartphone size={12} aria-hidden="true" /> Escaneie para abrir no celular
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Supporting row components ────────────────────────────────────────────────

function ResultRow({ label, value, note, strong }: { label: string; value: number | undefined; note?: string; strong?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-1">
      <dt className={cn("shrink-0 text-[13px]", strong ? "font-semibold text-slate-700 dark:text-slate-300" : "font-medium text-slate-500 dark:text-slate-400")}>
        {label}
        {note && <span className="ml-1.5 text-[11px] font-semibold text-primary/70 dark:text-[#5F84B3]/70">{note}</span>}
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
      initialCompositionId={searchParams.get("composition") ?? ""}
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
