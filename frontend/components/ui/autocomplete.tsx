"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";

export type ProcedureOption = {
  procedure_name: string;
  cbhpm_code: string;
  description: string;
  porte: string;
};

type AutocompleteProps = {
  label: string;
  options: ProcedureOption[];
  value: ProcedureOption | null;
  onChange: (value: ProcedureOption) => void;
  onSearch?: (query: string) => void;
};

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "c")
    .trim()
    .toLowerCase();
}

function scoreMatch(query: string, text: string): number {
  const normalized = normalizeSearch(text);
  const normalizedQuery = normalizeSearch(query);

  if (!normalizedQuery) return 0;

  if (normalized.startsWith(normalizedQuery)) return 100;

  const substringIndex = normalized.indexOf(normalizedQuery);
  if (substringIndex !== -1) return 50 - substringIndex * 0.1;

  const queryWords = normalizedQuery.split(/\s+/);
  const textWords = normalized.split(/\s+/);
  let matchedWords = 0;

  for (const qWord of queryWords) {
    if (textWords.some((tWord) => tWord.includes(qWord))) {
      matchedWords++;
    }
  }

  return matchedWords > 0 ? (matchedWords / queryWords.length) * 30 : 0;
}

export function Autocomplete({ label, options, value, onChange, onSearch }: AutocompleteProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const filteredAndSorted = useMemo(() => {
    if (!query.trim()) return options;

    const scored = options.map((option) => {
      const procedureScore = scoreMatch(query, option.procedure_name);
      const descriptionScore = scoreMatch(query, option.description);
      const codeScore = scoreMatch(query, option.cbhpm_code);
      const maxScore = Math.max(procedureScore, descriptionScore, codeScore);
      return { option, score: maxScore };
    });

    return scored
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ option }) => option);
  }, [options, query]);

  const handleSearch = (text: string) => {
    setQuery(text);
    setIsOpen(true);
    onSearch?.(text);
  };

  const handleSelect = (option: ProcedureOption) => {
    onChange(option);
    setQuery(option.procedure_name);
    setIsOpen(false);
  };

  return (
    <div className="space-y-2">
      <label
        className="block text-xs font-semibold uppercase tracking-[0.4px] text-slate-500 dark:text-slate-400"
        htmlFor="procedure-search"
      >
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
          size={18}
        />
        <Input
          className="h-[54px] pl-[46px] text-[15px]"
          id="procedure-search"
          value={query}
          onChange={(event) => handleSearch(event.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Digite o nome ou código CBHPM..."
        />
      </div>
      {isOpen && filteredAndSorted.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.10)", maxHeight: "288px", overflowY: "auto" }}>
          {filteredAndSorted.map((option, index) => {
            const isSelected = value?.cbhpm_code === option.cbhpm_code;
            return (
              <button
                className={cn(
                  "block w-full border-b border-slate-50 dark:border-slate-800 px-4 py-3 text-left text-sm last:border-b-0 transition-colors",
                  isSelected ? "bg-teal-50 dark:bg-teal-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-800",
                )}
                key={`${option.cbhpm_code}-${option.description}-${index}`}
                type="button"
                onClick={() => handleSelect(option)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="block font-semibold text-slate-950 dark:text-slate-50">{option.procedure_name}</span>
                    <span className="mt-0.5 block text-xs text-slate-400 dark:text-slate-500">
                      {option.cbhpm_code} | {option.description}
                    </span>
                  </div>
                  {isSelected && (
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
                      style={{ background: "linear-gradient(135deg, hsl(186,72%,28%), hsl(186,72%,22%))" }}
                    >
                      Selecionado
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
