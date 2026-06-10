"use client";

import { Activity, ArrowUpRight, Info } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/components/ui/utils";

// ─── Domain types ────────────────────────────────────────────────────────────

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

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  label,
  children,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-b border-slate-100 bg-white px-8 py-10 sm:px-12", className)}>
      {label && (
        <p className="mb-6 text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      )}
      {children}
    </section>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <span className="mt-0.5 block text-[14px] font-semibold text-slate-700">{value}</span>
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
    <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400">
        {role}
        {note && <span className="ml-2 text-teal-700">{note}</span>}
      </p>
      <p className="mt-3 font-grotesk text-[20px] font-bold leading-none tracking-tight text-slate-900">
        {money.format(value)}
      </p>
    </div>
  );
}

// ─── Share content ────────────────────────────────────────────────────────────

function ShareContent() {
  const searchParams = useSearchParams();

  const sbnId = searchParams.get("sbn") ?? "";
  const codesParam = searchParams.get("codes") ?? "";
  const auxiliariesCount = Number(searchParams.get("a") ?? "0");
  const requiresAnesthesia = searchParams.get("an") === "1";
  const rawRoute = searchParams.get("route");
  const accessRoute: AccessRouteType = rawRoute === "different" ? "different" : "same";

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
          className="mt-2 text-[12px] font-semibold text-teal-700 underline-offset-2 hover:underline"
        >
          Voltar ao início
        </Link>
      </div>
    );
  }

  const ruleNote =
    accessRoute === "same"
      ? "Mesma via de acesso · CBHPM item 4.1 · adicionais a 50%"
      : "Vias de acesso diferentes · CBHPM item 4.2 · adicionais a 70%";

  const hasTeam =
    (calculation?.individual_auxiliary_fees?.length ?? 0) > 0 ||
    (calculation?.anesthesiologist_fee ?? 0) > 0;

  const hasMultiProcedure = (calculation?.code_breakdown?.length ?? 0) > 1;

  return (
    <article>
      {/* ── 1. Procedimento ──────────────────────────────────── */}
      <Section label="Procedimento">
        <h2 className="m-0 text-[22px] font-extrabold leading-tight tracking-tight text-slate-900 sm:text-[26px]">
          {procedure?.name ?? "—"}
        </h2>
        <div className="mt-7 flex flex-wrap gap-x-10 gap-y-4">
          <MetaItem
            label="Via de acesso"
            value={accessRoute === "same" ? "Mesma via" : "Vias diferentes"}
          />
          <MetaItem
            label="Auxiliares"
            value={`${auxiliariesCount} ${auxiliariesCount === 1 ? "auxiliar" : "auxiliares"}`}
          />
          <MetaItem
            label="Anestesiologista"
            value={requiresAnesthesia ? "Incluso" : "Não incluso"}
          />
        </div>
      </Section>

      {/* ── 2. Composição CBHPM ───────────────────────────────── */}
      <Section label="Composição CBHPM">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                {(["Código", "Descrição", "Porte", "Valor"] as const).map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "pb-3 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400",
                      i >= 2 && "text-right",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calculation?.code_breakdown.map((b, idx) => (
                <tr
                  key={b.cbhpm_code}
                  className={cn(
                    "border-b border-slate-50 last:border-0",
                    idx % 2 === 1 && "bg-slate-50/40",
                  )}
                >
                  <td className="py-3.5 pr-5">
                    <span className="font-mono text-[11px] text-slate-500">{b.cbhpm_code}</span>
                    {b.is_principal && (
                      <span className="ml-2 rounded-sm bg-teal-900/[0.06] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-teal-700 ring-1 ring-teal-600/20">
                        principal
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 pr-6 text-[12px] leading-snug text-slate-600">{b.description}</td>
                  <td className="py-3.5 text-right text-[12px] font-semibold text-slate-600">{b.porte}</td>
                  <td className="py-3.5 pl-5 text-right font-grotesk text-[13px] font-semibold tabular-nums text-slate-900">
                    {money.format(b.base_value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasMultiProcedure && calculation && (
          <div className="mt-7 overflow-hidden rounded-xl border border-slate-100">
            <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">
                Detalhamento do cirurgião
              </p>
            </div>
            <div className="space-y-2 bg-white px-5 py-4">
              <BreakdownLine
                label="Procedimento principal"
                value={money.format(calculation.surgeon_breakdown.principal_value)}
              />
              <BreakdownLine
                label="Adicionais (bruto)"
                value={money.format(calculation.surgeon_breakdown.additional_gross)}
                muted
              />
              <BreakdownLine
                label={`Adicionais × ${calculation.surgeon_breakdown.discount_rate === 0.5 ? "50%" : "70%"}`}
                value={money.format(calculation.surgeon_breakdown.additional_discounted)}
                muted
              />
              <div className="border-t border-slate-100 pt-2">
                <BreakdownLine
                  label="Total cirurgião"
                  value={money.format(calculation.lead_surgeon_fee)}
                  strong
                />
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* ── 3. Team cards ────────────────────────────────────── */}
      {hasTeam && calculation && (
        <Section label="Equipe Cirúrgica">
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
        </Section>
      )}

      {/* ── 4. Total da equipe — subtle dark summary ─────────── */}
      {calculation && (
        <section
          className="border-b border-slate-700/30 px-8 py-10 sm:px-12"
          style={{ background: "#1e293b" }}
        >
          <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-300">
            Total da Equipe
          </p>
          <p className="mt-3 font-grotesk text-[40px] font-bold leading-none tracking-tight text-white sm:text-[48px]">
            {money.format(calculation.final_total)}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5">
            <SummaryPill label="Cirurgião" value={money.format(calculation.lead_surgeon_fee)} />
            {calculation.auxiliaries_fee > 0 && (
              <SummaryPill label="Auxiliares" value={money.format(calculation.auxiliaries_fee)} />
            )}
            {calculation.anesthesiologist_fee > 0 && (
              <SummaryPill
                label="Anestesiologista"
                value={money.format(calculation.anesthesiologist_fee)}
              />
            )}
          </div>
          <p className="mt-5 text-[10px] tracking-wide text-slate-400">{ruleNote}</p>
        </section>
      )}

      {/* ── 5. Metodologia ────────────────────────────────────── */}
      <Section label="Metodologia" className="border-b-0 bg-slate-50/60">
        <div className="space-y-3 text-[13px] leading-relaxed text-slate-500">
          <p>
            Valores calculados com base na{" "}
            <strong className="font-semibold text-slate-700">
              Tabela CBHPM 2025/2026 (Faixa Original)
            </strong>
            , com variação INPC de 5,10% aplicada ao período de outubro de 2025 a setembro de 2026.
          </p>
          {accessRoute === "same" ? (
            <p>
              Aplicada a regra de{" "}
              <strong className="font-semibold text-slate-700">mesma via de acesso</strong> (CBHPM item
              4.1): o procedimento de maior porte é remunerado integralmente; os procedimentos adicionais
              são valorados a <strong className="font-semibold text-slate-700">50%</strong> do respectivo
              porte.
            </p>
          ) : (
            <p>
              Aplicada a regra de{" "}
              <strong className="font-semibold text-slate-700">vias de acesso diferentes</strong> (CBHPM
              item 4.2): o procedimento de maior porte é remunerado integralmente; os procedimentos
              adicionais são valorados a{" "}
              <strong className="font-semibold text-slate-700">70%</strong> do respectivo porte.
            </p>
          )}
          {auxiliariesCount > 0 && (
            <p>
              Honorários de auxiliares calculados sobre o valor total do cirurgião principal (CBHPM item
              5.2), conforme tabela do item 5.1:{" "}
              <strong className="font-semibold text-slate-700">60% / 40% / 30% / 30%</strong> para 1º, 2º,
              3º e 4º auxiliar, respectivamente.
            </p>
          )}
          <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-slate-100 bg-white px-4 py-3">
            <Info size={13} className="mt-0.5 shrink-0 text-slate-300" aria-hidden="true" />
            <p className="m-0 text-[12px] leading-relaxed text-slate-400">
              Valores de referência. Convênios e operadoras de saúde podem adotar tabelas e faixas
              próprias.
            </p>
          </div>
        </div>
      </Section>
    </article>
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

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function SharePage() {
  const year = new Date().getFullYear();
  const reportDate = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div
      className="min-h-screen sm:py-10"
      style={{
        background:
          "radial-gradient(ellipse 900px 450px at 50% 0px, rgba(15,118,110,0.06) 0%, transparent 65%), #eef2f7",
      }}
    >
      <div
        className="mx-auto max-w-[720px] overflow-hidden bg-white sm:rounded-2xl sm:ring-1 sm:ring-slate-900/5"
        style={{ boxShadow: "0 4px 32px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04)" }}
      >
        {/* Report header */}
        <header className="flex items-center justify-between border-b border-slate-100 px-8 py-6 sm:px-12">
          <div className="flex items-center gap-3.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-800">
              <Activity className="text-white" size={17} aria-hidden="true" />
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
          <div className="text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Relatório de Honorários
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">{reportDate}</p>
          </div>
        </header>

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
        <footer className="flex items-center justify-between border-t border-slate-100 bg-white px-8 py-6 sm:px-12">
          <p className="text-[11px] text-slate-400">
            <span className="font-semibold text-slate-500">Afere</span> · LabF5 · {year}
          </p>
          <Link
            href="/"
            className="flex items-center gap-1 text-[11px] font-semibold text-teal-700 transition-colors hover:text-teal-900"
          >
            Conhecer o Afere
            <ArrowUpRight size={11} aria-hidden="true" />
          </Link>
        </footer>
      </div>
    </div>
  );
}
