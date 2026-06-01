"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";

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

  // Exact substring match at start gets highest score
  if (normalized.startsWith(normalizedQuery)) return 100;

  // Substring match gets high score
  const substringIndex = normalized.indexOf(normalizedQuery);
  if (substringIndex !== -1) return 50 - substringIndex * 0.1;

  // Word-by-word matching
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
      <label className="text-sm font-medium" htmlFor="procedure-search">
        {label}
      </label>
      <div className="relative">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <Input
          className="pl-10"
          id="procedure-search"
          value={query}
          onChange={(event) => handleSearch(event.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Digite para buscar..."
        />
      </div>
      {isOpen && filteredAndSorted.length > 0 && (
        <div className="max-h-72 overflow-auto rounded-md border border-border bg-white">
          {filteredAndSorted.map((option, index) => (
            <button
              className="block w-full border-b border-border px-4 py-3 text-left text-sm last:border-b-0 hover:bg-muted"
              key={`${option.cbhpm_code}-${option.description}-${index}`}
              type="button"
              onClick={() => handleSelect(option)}
            >
              <span className="block font-medium">{option.procedure_name}</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {option.cbhpm_code} | {option.description}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
