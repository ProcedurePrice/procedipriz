"use client";

import { AlertCircle, Check, Copy, Info, Printer, Smartphone } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/components/ui/utils";

// ─── Domain types ─────────────────────────────────────────────────────────────

type AccessRouteType = "same" | "different";

type ProcedureDetail = {
  id: string;
  name: string;
  cbhpm_codes: { code: string; description: string; porte: string }[];
};

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

// ─── Formatters ───────────────────────────────────────────────────────────────

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// ─── Print + screen CSS ───────────────────────────────────────────────────────

const PAGE_STYLES = `
  @media print {
    .no-print { display: none !important; }
    .print-only { display: block !important; }
    .print-bg { background: #ffffff !important; padding: 0 !important; }
    .print-card {
      background: #ffffff !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      ring: none !important;
      max-width: 100% !important;
      margin: 0 !important;
    }
    .report-section { break-inside: avoid; }
    .total-screen { display: none !important; }
    .total-print { display: block !important; }
    @page { margin: 1.5cm 2cm; size: A4 portrait; }
  }
  @media screen {
    .print-only { display: none; }
    .total-print { display: none; }
  }
`;

// ─── Layout primitives ────────────────────────────────────────────────────────

function ReportSection({
  label,
  children,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("report-section border-b border-slate-100 px-8 py-12 sm:px-12 sm:py-14", className)}>
      {label && (
        <p className="mb-7 text-[9px] font-bold uppercase tracking-[0.26em] text-slate-400">{label}</p>
      )}
      {children}
    </section>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</span>
      <span className="mt-1 block text-[13.5px] font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function BreakdownLine({
  label,
  value,
  muted,
  strong,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span
        className={cn(
          "text-[12px]",
          strong ? "font-semibold text-slate-700" : muted ? "text-slate-400" : "text-slate-500",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "font-grotesk text-[12px] font-semibold tabular-nums",
          strong ? "text-slate-900" : muted ? "text-slate-400" : "text-slate-600",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function TeamCard({ role, note, value }: { role: string; note?: string; value: number }) {
  return (
    <div className="report-section rounded-xl bg-white p-5 ring-1 ring-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
        {role}
        {note && <span className="ml-2 text-[#355C8A]">{note}</span>}
      </p>
      <p className="mt-3 font-grotesk text-[22px] font-bold leading-none tracking-tight text-slate-900">
        {money.format(value)}
      </p>
    </div>
  );
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-[11px] text-slate-400">
      {label}{" "}
      <span className="font-grotesk font-semibold tabular-nums text-slate-200">{value}</span>
    </span>
  );
}

// Left-bordered explanation block for "Como foi calculado"
function ExplainBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="w-0.5 shrink-0 rounded-full bg-[#355C8A]/25 self-stretch" />
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{title}</p>
        <div className="space-y-1 text-[13px] leading-relaxed text-slate-500">{children}</div>
      </div>
    </div>
  );
}

// ─── Action buttons (hidden on print) ────────────────────────────────────────

function ActionButtons() {
  const [copied, setCopied] = useState(false);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="no-print flex items-center gap-2">
      <button
        type="button"
        onClick={copyLink}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
      >
        {copied
          ? <Check size={12} className="text-[#355C8A]" aria-hidden="true" />
          : <Copy size={12} aria-hidden="true" />}
        <span>{copied ? "Copiado!" : "Copiar link"}</span>
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98]"
      >
        <Printer size={12} aria-hidden="true" />
        <span className="hidden sm:inline">Imprimir relatório</span>
        <span className="sm:hidden">Imprimir</span>
      </button>
    </div>
  );
}

// ─── QR code section (screen + print) ─────────────────────────────────────────

// Encodes the exact public URL of this shared report so it can be opened on a
// phone — visible on screen and preserved in print for paper hand-offs.
function ShareQRSection() {
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  if (!url) return null;

  return (
    <section className="report-section border-t border-slate-100 px-8 py-10 sm:px-12">
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:justify-center sm:text-left">
        <div className="shrink-0 rounded-2xl border border-slate-200 bg-white p-3.5">
          <QRCodeSVG
            value={url}
            size={132}
            level="M"
            marginSize={0}
            bgColor="#FFFFFF"
            fgColor="#0F172A"
            title="QR Code para abrir o relatório no celular"
            className="h-[132px] w-[132px]"
          />
        </div>
        <div className="max-w-[280px]">
          <p className="flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 sm:justify-start">
            <Smartphone size={11} aria-hidden="true" /> Abrir no celular
          </p>
          <p className="mt-2.5 text-[12px] leading-relaxed text-slate-500">
            Escaneie o QR Code para abrir este relatório no smartphone.
          </p>
          <p className="mt-2.5 break-all text-[10px] font-medium text-slate-400">{url}</p>
        </div>
      </div>
    </section>
  );
}

// ─── Report body ──────────────────────────────────────────────────────────────

function ShareContent() {
  const searchParams = useSearchParams();

  const sbnId = searchParams.get("sbn") ?? "";
  const codesParam = searchParams.get("codes") ?? "";
  const auxiliariesCount = Number(searchParams.get("a") ?? "0");
  const requiresAnesthesia = searchParams.get("an") === "1";
  const rawRoute = searchParams.get("route");
  const accessRoute: AccessRouteType = rawRoute === "different" ? "different" : "same";
  const adjParam = searchParams.get("adj") ?? "";
  const adjustments = adjParam ? adjParam.split(",").filter(Boolean) : [];

  const [procedure, setProcedure] = useState<ProcedureDetail | null>(null);
  const [calculation, setCalculation] = useState<CalculationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sbnId || !codesParam) {
      setError("Link inválido ou incompleto.");
      setLoading(false);
      return;
    }

    const parsedCodes = codesParam.split(",").filter(Boolean);
    if (parsedCodes.length === 0) {
      setError("Nenhum código CBHPM encontrado no link.");
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const procRes = await fetch(`/api/procedures/${sbnId}`);
        if (!procRes.ok) throw new Error("Procedimento não encontrado.");
        const procData: ProcedureDetail = await procRes.json();
        setProcedure(procData);

        const selectedCodes = parsedCodes
          .map((code) => {
            const match = procData.cbhpm_codes.find((c) => c.code === code);
            return { cbhpm_code: code, description: match?.description ?? "", porte: match?.porte ?? "" };
          })
          .filter((c) => c.porte !== "");

        if (selectedCodes.length === 0) throw new Error("Códigos CBHPM inválidos no link.");

        const calcRes = await fetch("/api/calculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            selected_codes: selectedCodes,
            auxiliaries_count: auxiliariesCount,
            requires_anesthesia: requiresAnesthesia,
            access_route_type: accessRoute,
            adjustments,
          }),
        });
        if (!calcRes.ok) throw new Error("Erro ao realizar o cálculo.");
        setCalculation(await calcRes.json());
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erro ao carregar os dados.");
      } finally {
        setLoading(false);
      }
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sbnId, codesParam, auxiliariesCount, requiresAnesthesia, accessRoute]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
        <p className="text-[12px] tracking-wide text-slate-400">Preparando relatório…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-red-400">Erro</p>
        <p className="text-[14px] text-slate-600">{error}</p>
        <Link
          href="/"
          className="mt-2 text-[12px] font-semibold text-[#1E3A5F] underline-offset-2 hover:underline"
        >
          Voltar ao início
        </Link>
      </div>
    );
  }

  if (!calculation) return null;

  const principalCode = calculation.code_breakdown.find((b) => b.is_principal);
  const additionalCodes = calculation.code_breakdown.filter((b) => !b.is_principal);
  const hasMultiProcedure = additionalCodes.length > 0;
  const hasAuxiliaries = auxiliariesCount > 0 && calculation.individual_auxiliary_fees.length > 0;
  const hasTeam = hasAuxiliaries || calculation.anesthesiologist_fee > 0;
  const hasAdjustments = (calculation.selected_adjustments ?? []).length > 0;

  const accessRuleLabel =
    accessRoute === "same"
      ? "Mesma via de acesso (CBHPM item 4.1) — adicionais valorados a 50%"
      : "Vias de acesso diferentes (CBHPM item 4.2) — adicionais valorados a 70%";

  const discountPct = calculation.surgeon_breakdown.discount_rate === 0.5 ? "50%" : "70%";

  return (
    <article>
      {/* ── 1. Procedimento ───────────────────────────────────── */}
      <ReportSection label="Procedimento">
        <h1 className="m-0 text-[22px] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[26px]">
          {procedure?.name ?? "—"}
        </h1>
        <div className="mt-8 grid grid-cols-3 gap-x-6 gap-y-5">
          <MetaField
            label="Via de acesso"
            value={accessRoute === "same" ? "Mesma via" : "Vias diferentes"}
          />
          <MetaField
            label="Auxiliares"
            value={auxiliariesCount === 0 ? "Nenhum" : `${auxiliariesCount} ${auxiliariesCount === 1 ? "auxiliar" : "auxiliares"}`}
          />
          <MetaField
            label="Anestesiologista"
            value={requiresAnesthesia ? "Incluso" : "Não incluso"}
          />
        </div>

        {/* Acréscimos CBHPM aplicados */}
        {hasAdjustments && (
          <div className="mt-6 space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Acréscimos CBHPM</p>
            <div className="inline-block rounded-lg bg-amber-50 px-4 py-3 ring-1 ring-amber-200/80 space-y-1.5">
              {calculation.selected_adjustments.map((a) => (
                <div key={a.code} className="flex items-center gap-3">
                  <AlertCircle size={12} className="shrink-0 text-amber-500" aria-hidden="true" />
                  <span className="text-[11px] font-semibold text-amber-700">
                    {a.label} — +{a.percentage.toFixed(0)}%
                  </span>
                </div>
              ))}
              <p className="pl-[18px] text-[10px] text-amber-600">
                Total: +{calculation.total_adjustment_percentage.toFixed(0)}% · CBHPM 2022, Instruções Gerais
              </p>
            </div>
          </div>
        )}
      </ReportSection>

      {/* ── 2. Composição CBHPM ──────────────────────────────── */}
      <ReportSection label="Composição CBHPM">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                {(["Código", "Descrição", "Porte", "Valor base"] as const).map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "pb-4 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400",
                      i >= 2 && "text-right",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calculation.code_breakdown.map((b, idx) => (
                <tr key={b.cbhpm_code} className={cn("border-b border-slate-50 last:border-0", idx % 2 === 1 && "bg-slate-50/40")}>
                  <td className="py-5 pr-5">
                    <span className="font-mono text-[11px] text-slate-500">{b.cbhpm_code}</span>
                    {b.is_principal && (
                      <span className="ml-2 rounded-sm bg-[#1E3A5F]/[0.06] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-[#1E3A5F] ring-1 ring-[#355C8A]/20">
                        principal
                      </span>
                    )}
                  </td>
                  <td className="py-5 pr-6 text-[12px] leading-snug text-slate-600">{b.description}</td>
                  <td className="py-5 text-right text-[12px] font-semibold text-slate-600">{b.porte}</td>
                  <td className="py-5 pl-5 text-right font-grotesk text-[13px] font-semibold tabular-nums text-slate-900">
                    {money.format(b.base_value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasMultiProcedure && (
          <div className="mt-10 overflow-hidden rounded-xl border border-slate-100">
            <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Detalhamento — cirurgião principal
              </p>
            </div>
            <div className="space-y-3 bg-white px-5 py-5">
              <BreakdownLine
                label="Procedimento principal"
                value={money.format(calculation.surgeon_breakdown.principal_value)}
              />
              <BreakdownLine
                label="Procedimentos adicionais (bruto)"
                value={money.format(calculation.surgeon_breakdown.additional_gross)}
                muted
              />
              <BreakdownLine
                label={`Regra aplicada — adicionais × ${discountPct}`}
                value={money.format(calculation.surgeon_breakdown.additional_discounted)}
                muted
              />
              <div className="border-t border-slate-100 pt-2">
                <BreakdownLine
                  label="Base CBHPM cirurgião"
                  value={money.format(calculation.surgeon_breakdown.surgeon_total)}
                  strong
                />
              </div>
              {hasAdjustments && (
                <>
                  <BreakdownLine
                    label={`Acréscimos CBHPM (+${calculation.total_adjustment_percentage.toFixed(0)}%)`}
                    value={`+${money.format(calculation.adjustment_value)}`}
                    muted
                  />
                  <div className="border-t border-slate-100 pt-2">
                    <BreakdownLine
                      label="Total cirurgião (com acréscimos)"
                      value={money.format(calculation.lead_surgeon_fee)}
                      strong
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </ReportSection>

      {/* ── 3. Equipe cirúrgica ──────────────────────────────── */}
      {hasTeam && (
        <ReportSection label="Equipe Cirúrgica">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <TeamCard role="Cirurgião Principal" value={calculation.lead_surgeon_fee} />
            {calculation.individual_auxiliary_fees.map((af) => (
              <TeamCard
                key={af.position}
                role={`${af.position}º Auxiliar`}
                note={`${af.percentage}%`}
                value={af.fee}
              />
            ))}
            {calculation.anesthesiologist_fee > 0 && (
              <TeamCard role="Anestesiologista" value={calculation.anesthesiologist_fee} />
            )}
          </div>
          {hasAdjustments && (
            <p className="mt-4 text-[10px] text-slate-400">
              Valores já incluem o acréscimo de +{calculation.total_adjustment_percentage.toFixed(0)}% (
              {calculation.selected_adjustments.map((a) => a.label).join("; ")}).
            </p>
          )}
        </ReportSection>
      )}

      {/* ── 4. Total da equipe — tela (dark) ────────────────── */}
      <section
        className="total-screen report-section border-b border-slate-800/20 px-8 py-14 sm:px-12 sm:py-16"
        style={{ background: "#0F172A" }}
      >
        <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-slate-400">
          Total da Equipe
        </p>
        {hasAdjustments && (
          <div className="mb-4 flex flex-wrap gap-2">
            {calculation.selected_adjustments.map((a) => (
              <div
                key={a.code}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5 ring-1 ring-amber-400/30"
              >
                <AlertCircle size={11} className="shrink-0 text-amber-400" aria-hidden="true" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                  {a.label} +{a.percentage.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 font-grotesk text-[42px] font-bold leading-none tracking-tight text-white sm:text-[50px]">
          {money.format(calculation.final_total)}
        </p>
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
          <SummaryPill label="Cirurgião" value={money.format(calculation.lead_surgeon_fee)} />
          {calculation.auxiliaries_fee > 0 && (
            <SummaryPill label="Auxiliares" value={money.format(calculation.auxiliaries_fee)} />
          )}
          {calculation.anesthesiologist_fee > 0 && (
            <SummaryPill label="Anestesiologista" value={money.format(calculation.anesthesiologist_fee)} />
          )}
          {hasAdjustments && (
            <SummaryPill
              label={`Acréscimos +${calculation.total_adjustment_percentage.toFixed(0)}%`}
              value={money.format(calculation.adjustment_value)}
            />
          )}
        </div>
        {hasAdjustments && (
          <p className="mt-4 text-[10px] leading-relaxed text-slate-500">
            Base: {money.format(calculation.base_team_total_value)} · Acréscimos CBHPM: +{money.format(calculation.adjustment_value)}
          </p>
        )}
        <p className="mt-7 text-[10px] leading-relaxed tracking-wide text-slate-500">
          {accessRuleLabel}
        </p>
      </section>

      {/* ── 4. Total da equipe — impressão (light) ───────────── */}
      <section className="total-print report-section border-b border-slate-200 px-8 py-10 sm:px-12">
        <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-slate-400">
          Total da Equipe
        </p>
        <p className="mt-3 font-grotesk text-[38px] font-bold leading-none tracking-tight text-slate-900">
          {money.format(calculation.final_total)}
        </p>
        <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
          <MetaField label="Cirurgião" value={money.format(calculation.lead_surgeon_fee)} />
          {calculation.auxiliaries_fee > 0 && (
            <MetaField label="Auxiliares" value={money.format(calculation.auxiliaries_fee)} />
          )}
          {calculation.anesthesiologist_fee > 0 && (
            <MetaField label="Anestesiologista" value={money.format(calculation.anesthesiologist_fee)} />
          )}
          {hasAdjustments && (
            <MetaField
              label={`Acréscimos CBHPM +${calculation.total_adjustment_percentage.toFixed(0)}%`}
              value={`+${money.format(calculation.adjustment_value)}`}
            />
          )}
        </div>
        {hasAdjustments && (
          <p className="mt-3 text-[10px] font-semibold text-amber-600">
            {calculation.selected_adjustments.map((a) => `${a.label} +${a.percentage.toFixed(0)}%`).join(" · ")}
            {" "}· CBHPM 2022, Instruções Gerais
          </p>
        )}
        <p className="mt-5 text-[10px] text-slate-400">{accessRuleLabel}</p>
      </section>

      {/* ── 5. Como foi calculado ────────────────────────────── */}
      <ReportSection label="Como foi calculado" className="border-b-0 bg-slate-50/50">
        <div className="space-y-8">
          {/* Valor do cirurgião */}
          <ExplainBlock title="Valor do cirurgião">
            {!hasMultiProcedure ? (
              <p>
                O procedimento <strong className="text-slate-700">{principalCode?.description}</strong>{" "}
                (porte {principalCode?.porte}) é remunerado integralmente pelo seu porte CBHPM.{" "}
                Base do cirurgião:{" "}
                <strong className="text-slate-700">{money.format(calculation.base_surgeon_value)}</strong>.
                {hasAdjustments && (
                  <>
                    {" "}Após acréscimos de +{calculation.total_adjustment_percentage.toFixed(0)}%: <strong className="text-slate-700">{money.format(calculation.lead_surgeon_fee)}</strong>.
                  </>
                )}
              </p>
            ) : (
              <>
                <p>
                  O procedimento de maior valor —{" "}
                  <strong className="text-slate-700">{principalCode?.description}</strong>{" "}
                  (porte {principalCode?.porte}, {money.format(calculation.surgeon_breakdown.principal_value)}) — é
                  remunerado integralmente.
                </p>
                <p>
                  Os {additionalCodes.length} procedimento{additionalCodes.length > 1 ? "s" : ""} adiciona{additionalCodes.length > 1 ? "is são valorados" : "l é valorado"} a{" "}
                  <strong className="text-slate-700">{discountPct}</strong> do respectivo porte,
                  conforme a regra de{" "}
                  <strong className="text-slate-700">
                    {accessRoute === "same" ? "mesma via de acesso (CBHPM item 4.1)" : "vias de acesso diferentes (CBHPM item 4.2)"}
                  </strong>
                  . Subtotal adicional:{" "}
                  {money.format(calculation.surgeon_breakdown.additional_discounted)}.
                </p>
                <p>
                  Base CBHPM cirurgião:{" "}
                  <strong className="text-slate-700">{money.format(calculation.base_surgeon_value)}</strong>.
                  {hasAdjustments && (
                    <>
                      {" "}Após acréscimos de +{calculation.total_adjustment_percentage.toFixed(0)}%: <strong className="text-slate-700">{money.format(calculation.lead_surgeon_fee)}</strong>.
                    </>
                  )}
                </p>
              </>
            )}
          </ExplainBlock>

          {/* Auxiliares */}
          <ExplainBlock title="Auxiliares">
            {!hasAuxiliaries ? (
              <p>Não há auxiliares incluídos neste cálculo.</p>
            ) : (
              <>
                <p>
                  Honorários calculados sobre o valor total do cirurgião (
                  <strong className="text-slate-700">{money.format(calculation.lead_surgeon_fee)}</strong>),
                  conforme CBHPM item 5.2:
                </p>
                <ul className="mt-1 space-y-0.5 pl-1">
                  {calculation.individual_auxiliary_fees.map((af) => (
                    <li key={af.position} className="text-[12.5px]">
                      <span className="text-slate-600">{af.position}º auxiliar:</span>{" "}
                      <strong className="text-slate-700">{af.percentage}%</strong> ={" "}
                      <strong className="font-grotesk text-slate-700">{money.format(af.fee)}</strong>
                    </li>
                  ))}
                </ul>
                <p className="mt-1">
                  Total dos auxiliares:{" "}
                  <strong className="text-slate-700">{money.format(calculation.auxiliaries_fee)}</strong>.
                </p>
              </>
            )}
          </ExplainBlock>

          {/* Anestesiologista */}
          <ExplainBlock title="Anestesiologista">
            {calculation.anesthesiologist_fee > 0 ? (
              <p>
                Honorários de anestesiologista <strong className="text-slate-700">incluídos</strong>.
                Valor fixo de referência:{" "}
                <strong className="font-grotesk text-slate-700">{money.format(calculation.anesthesiologist_fee)}</strong>.
              </p>
            ) : (
              <p>Anestesiologista não incluído neste cálculo.</p>
            )}
          </ExplainBlock>

          {/* Acréscimos CBHPM */}
          {hasAdjustments ? (
            <ExplainBlock title="Acréscimos CBHPM">
              <p>
                Os seguintes acréscimos foram aplicados <strong className="text-slate-700">aditivamente</strong>{" "}
                sobre os honorários de cirurgião, auxiliares e anestesiologista,
                conforme as <strong className="text-slate-700">Instruções Gerais da CBHPM 2022</strong>:
              </p>
              <ul className="mt-1 space-y-0.5 pl-1">
                {calculation.selected_adjustments.map((a) => (
                  <li key={a.code} className="text-[12.5px]">
                    <strong className="text-amber-700">+{a.percentage.toFixed(0)}%</strong>{" "}
                    <span className="text-slate-600">— {a.label}</span>
                    <span className="ml-2 text-[11px] text-slate-400">({a.source})</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1">
                Total dos acréscimos:{" "}
                <strong className="text-amber-700">+{calculation.total_adjustment_percentage.toFixed(0)}%</strong>{" "}
                (modelo aditivo — não multiplicativo).
                Valor absoluto do acréscimo:{" "}
                <strong className="font-grotesk text-amber-700">+{money.format(calculation.adjustment_value)}</strong>.
              </p>
              <p>
                Base da equipe (sem acréscimos):{" "}
                <strong className="font-grotesk text-slate-700">{money.format(calculation.base_team_total_value)}</strong>.
              </p>
            </ExplainBlock>
          ) : (
            <ExplainBlock title="Acréscimos CBHPM">
              <p>Nenhum acréscimo aplicado.</p>
            </ExplainBlock>
          )}

          {/* Total da equipe */}
          <ExplainBlock title="Total da equipe">
            <p>
              Soma de cirurgião (
              <strong className="font-grotesk text-slate-700">{money.format(calculation.lead_surgeon_fee)}</strong>
              ){calculation.auxiliaries_fee > 0 && (
                <>, auxiliares (
                  <strong className="font-grotesk text-slate-700">{money.format(calculation.auxiliaries_fee)}</strong>
                  )</>
              )}{calculation.anesthesiologist_fee > 0 && (
                <> e anestesiologista (
                  <strong className="font-grotesk text-slate-700">{money.format(calculation.anesthesiologist_fee)}</strong>
                  )</>
              )}{" "}
              = <strong className="font-grotesk text-slate-700">{money.format(calculation.final_total)}</strong>.
              {hasAdjustments && (
                <>
                  {" "}Os acréscimos de +{calculation.total_adjustment_percentage.toFixed(0)}% já estão incluídos em todos os valores acima.
                </>
              )}
            </p>
          </ExplainBlock>

          {/* Disclaimer */}
          <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <Info size={14} className="mt-px shrink-0 text-slate-300" aria-hidden="true" />
            <div className="space-y-1 text-[12px] leading-relaxed text-slate-400">
              <p>
                Valores calculados com base na{" "}
                <strong className="text-slate-500">Tabela CBHPM 2025/2026 (Faixa Original)</strong>,
                com variação INPC de 5,10% aplicada ao período de outubro de 2025 a setembro de 2026.
              </p>
              <p>
                Estes valores são de <strong className="text-slate-500">referência</strong>. Convênios e
                operadoras de saúde podem adotar tabelas, faixas e multiplicadores próprios, sujeitos a
                negociação contratual.
              </p>
            </div>
          </div>
        </div>
      </ReportSection>

      {/* ── 6. QR code — abrir no celular (screen + print) ───────── */}
      <ShareQRSection />

      {/* Informational — shared-view marker */}
      <p className="px-8 pb-8 text-center text-[10px] text-slate-400 sm:px-12">
        Visualizando via compartilhamento Afere
      </p>
    </article>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function SharePage() {
  const reportDate = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const year = new Date().getFullYear();

  return (
    <>
      <style>{PAGE_STYLES}</style>

      <div
        className="print-bg min-h-screen sm:py-10"
        style={{
          background: [
            "radial-gradient(circle at top center, rgba(53,92,138,0.18) 0%, transparent 45%)",
            "radial-gradient(circle at 15% 88%, rgba(30,58,95,0.08) 0%, transparent 40%)",
            "linear-gradient(180deg, #E2EBF3 0%, #D6E1EB 100%)",
          ].join(", "),
        }}
      >
        <div
          className="print-card mx-auto max-w-[720px] overflow-hidden bg-[#F3F6F9] sm:rounded-2xl sm:ring-1 sm:ring-[#355C8A]/10"
          style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 8px 24px rgba(15,23,42,0.08), 0 24px 70px rgba(15,23,42,0.14)" }}
        >
          {/* Accent stripe */}
          <div
            aria-hidden="true"
            style={{
              height: "3px",
              background: "linear-gradient(90deg, #1E3A5F 0%, #355C8A 40%, #5F84B3 100%)",
            }}
          />

          {/* Report header */}
          <header className="flex items-center justify-between border-b border-slate-100 px-8 py-6 sm:px-12">
            <div className="flex items-center gap-3.5">
              <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-[9px] border border-[rgba(53,92,138,0.12)]" style={{ background: "linear-gradient(145deg, #E6EEF5, #D8E5EE)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/brand/afere-symbol.svg" alt="" aria-hidden="true" width={24} height={23} style={{ display: "block" }} />
              </div>
              <div>
                <p className="text-[15px] font-extrabold leading-none tracking-tight text-slate-900">
                  Afere
                </p>
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] leading-none text-slate-400">
                  Neurocirurgia
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  Relatório de Honorários
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">{reportDate}</p>
              </div>
              <ActionButtons />
            </div>
          </header>

          {/* Print-only report date (hidden on screen, shown on print) */}
          <div className="print-only border-b border-slate-100 px-8 py-3 sm:px-12">
            <p className="text-[10px] text-slate-400">
              Relatório de Honorários · Emitido em {reportDate}
            </p>
          </div>

          {/* Content */}
          <Suspense
            fallback={
              <div className="flex min-h-[60vh] items-center justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
              </div>
            }
          >
            <ShareContent />
          </Suspense>

          {/* Report footer */}
          <footer className="border-t border-slate-100 px-8 py-6 sm:px-12">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-slate-400">
                Gerado por{" "}
                <span className="font-semibold text-slate-500">Afere</span>{" "}
                · LabF5 · {year}
              </p>
              <Link
                href="/"
                className="no-print text-[11px] font-semibold text-[#1E3A5F] transition-colors hover:text-[#355C8A]"
              >
                Conhecer o Afere ↗
              </Link>
              <p className="print-only text-[11px] text-slate-400">Valores de referência · CBHPM 2025/2026</p>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
