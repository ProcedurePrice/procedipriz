"use client";

import { Calculator } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Autocomplete, type ProcedureOption } from "@/components/ui/autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  // Sync porte with selected procedure
  useEffect(() => {
    setPorte(selectedProcedure?.porte ?? "");
  }, [selectedProcedure]);

  const canCalculate = useMemo(() => selectedProcedure !== null, [selectedProcedure]);

  async function calculate() {
    if (!selectedProcedure) {
      return;
    }

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
    <main className="flex min-h-screen flex-col">
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-5 py-8">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">ProcediPriz</h1>
            <p className="mt-1 text-sm text-muted-foreground">Cálculo rápido de honorários neurocirúrgicos</p>
          </div>
          <div className="flex size-11 items-center justify-center rounded-md bg-primary text-white">
            <Calculator aria-hidden="true" size={22} />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-5">
            <Autocomplete
              label="Buscar procedimento"
              options={procedureOptions}
              value={selectedProcedure}
              onChange={setSelectedProcedure}
              onSearch={searchProcedures}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Porte do procedimento</span>
                <Input value={porte} onChange={(event) => setPorte(event.target.value)} />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium">Número de auxiliares</span>
                <Input
                  min={0}
                  max={4}
                  type="number"
                  value={auxiliariesCount}
                  onChange={(event) => setAuxiliariesCount(Number(event.target.value))}
                />
              </label>
            </div>

            <label className="flex items-center justify-between gap-4 rounded-md border border-border bg-white px-4 py-3">
              <span className="text-sm font-medium">Necessita de anestesiologista</span>
              <input
                checked={requiresAnesthesia}
                className="size-5 accent-teal-700"
                type="checkbox"
                onChange={(event) => setRequiresAnesthesia(event.target.checked)}
              />
            </label>

            <Button disabled={!canCalculate} onClick={calculate}>
              Calcular
            </Button>
          </section>

          <section className="rounded-md border border-border bg-white p-5">
            <h2 className="text-lg font-semibold">Resultado</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <ResultRow label="Cirurgião principal" value={calculation?.lead_surgeon_fee} />
              <ResultRow label="Auxiliares" value={calculation?.auxiliaries_fee} />
              <ResultRow label="Anestesiologista" value={calculation?.anesthesiologist_fee} />
              <div className="border-t border-border pt-4">
                <ResultRow strong label="Total final" value={calculation?.final_total} />
              </div>
            </dl>
          </section>
        </div>
      </section>
      <footer className="border-t border-border px-5 py-4 text-center text-sm text-muted-foreground">2026  LabF5  Todos os direitos reservados</footer>
    </main>
  );
}

function ResultRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number | undefined;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className={strong ? "font-semibold" : "text-muted-foreground"}>{label}</dt>
      <dd className={strong ? "text-xl font-semibold" : "font-medium"}>{value === undefined ? "-" : money.format(value)}</dd>
    </div>
  );
}
