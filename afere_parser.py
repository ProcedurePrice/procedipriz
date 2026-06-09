"""
Afere ETL — SBN Procedure PDF Parser
=====================================
Parses the SBN "Manual de Diretrizes de Codificação dos Procedimentos em
Neurocirurgia" PDF and extracts procedure → CBHPM code mappings.

PDF table structure (one big table per procedure):
  Row 0 : ['Nome', 'Procedimento', '<section> - <NAME_PART1>', '<NAME_PART2>', ...]
  ...
  Row N : ['Códigos CBHPM', None, ..., 'Descrição', ..., 'Porte']   ← CBHPM header
  Row N+k: ['3.14.01.17-1', None, ..., 'Description text', ..., '14A']  ← code rows
  Row M : ['OPMEs', ...]                                              ← section ends

Usage:
    python afere_parser.py \
        --sbn  data/raw_pdfs/<sbn_manual>.pdf \
        --out  backend/internal/repository/procedures.json \
        [--debug]
"""

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Optional

try:
    import pdfplumber
except ImportError:
    sys.exit("pdfplumber is required:  pip install pdfplumber")

# ── Patterns ──────────────────────────────────────────────────────────────────

# CBHPM code: digit.dd.dd.dd-digit  (e.g. 3.14.01.17-1)
RE_CODE = re.compile(r"^(\d\.\d{2}\.\d{2}\.\d{2}-\d)")

# Porte: 1–14 followed by A/B/C  (e.g. 14A, 9B, 3C)
RE_PORTE = re.compile(r"\b(\d{1,2}[A-C])\b")

# Section prefix like "7.1 – " or "3.4 - "
RE_SECTION_PREFIX = re.compile(r"^\d+(\.\d+)*\s*[–\-]\s*")

# Footnote markers at end of descriptions
RE_FOOTNOTE = re.compile(r"[\*†]+\s*$")

# Portuguese vowels (plain + accented, both cases)
_VOWELS = frozenset("aeiouáéíóúâêîôûãõàèìòùAEIOUÁÉÍÓÚÂÊÎÔÛÃÕÀÈÌÒÙ")

# Spurious space after opening parenthesis: "( USNO)" → "(USNO)"
RE_PAREN_SPACE = re.compile(r"\(\s+")

# Token that consists solely of letters (including accented) — no slashes, digits, etc.
# Used to exclude abbreviations like "DVE/PIC" from the intra-word join rules.
RE_PURE_ALPHA = re.compile(r"^[A-Za-zÀ-ÿ]+$")


# ── Helpers ───────────────────────────────────────────────────────────────────

def smart_join_name_parts(parts: list[str]) -> str:
    """Join PDF table cells that together form a procedure name.

    The SBN PDF uses fixed-width columns, so long words frequently straddle a
    column boundary and appear in two consecutive cells.  A naive ' '.join()
    produces mid-word spaces.  We decide per-pair whether to insert a space:

      0. Accumulated string ends in a non-letter char (–, -, +, etc.) → SPACE
         (punctuation separator; never a mid-word position in the PDF).
      1a. Next part starts lowercase AND last_word <= 3 chars → no space
          (tiny fragment + lowercase continuation).
      1b. Next part starts lowercase AND last_word > 3 chars → SPACE
          (complete word + new lowercase word, e.g. the conjunction "ou").
      2.  Last word ends in a consonant → no space
          (classic fragment: "VENTRÍCUL", "CEREBR", "SISTEM").
      3.  Last word <= 6 chars AND next first word <= 4 chars → no space
          (short fragment + short completion: "CO"+"LUNA", "CRÂ"+"NIO").
          Last word <= 6 chars AND next first word > 4 chars → SPACE
          ("DE"+"FÁRMACO", "FORAME"+"MAGNO").
      3b. Roman-numeral exception: next part is a Roman numeral token
          (I, II, III, IV, V…) → always SPACE (procedure variant number).
      4.  Next part opens with <= 7 uppercase chars + space/punct/EOS → no space
          (longer completions: "NOIDAL", "DEIRO", "TILHO", "GATILHO"[:partial]).
      5.  Default → SPACE.
    """
    _ROMAN = re.compile(r"^[IVX]{1,5}([\s:;,.(]|$)")
    _UPP7  = re.compile(r"^([A-ZÀ-ÿ]{1,7})([\s:;,.(]|$)")
    _FIRST = re.compile(r"^([A-Za-zÀ-ÿ]+)")

    if not parts:
        return ""
    result = parts[0].strip()
    for part in parts[1:]:
        part = part.strip()
        if not part:
            continue

        # Rule 0: result ends in non-letter → punctuation separator → always space
        if result and not result[-1].isalpha():
            result = result + " " + part
            continue

        # Determine the last "word" token of result (strip flanking punctuation)
        tokens = result.split()
        last_raw  = tokens[-1] if tokens else ""
        last_word = last_raw.strip("()[].,;:!?+–—-")

        # Rule 1: next part starts with a lowercase letter
        if part[0].islower():
            if len(last_word) <= 3:
                result = result + part       # tiny fragment + lowercase continuation
            else:
                result = result + " " + part  # complete word + new lowercase word
            continue

        # Rule 2: consonant-ending fragment
        if last_word and last_word[-1] not in _VOWELS:
            result = result + part
            continue

        # Rule 3 + 3b: short last_word (<= 6 chars)
        if len(last_word) <= 6:
            if _ROMAN.match(part):            # 3b: Roman numeral → always separate
                result = result + " " + part
            else:
                m = _FIRST.match(part)
                next_first = m.group(1) if m else ""
                if len(next_first) <= 4:
                    result = result + part     # short + short completion → no space
                else:
                    result = result + " " + part  # short word + long next word → space
            continue

        # Rule 3b (long last_word): Roman numeral still separates
        if _ROMAN.match(part):
            result = result + " " + part
            continue

        # Rule 4: next opens with a short uppercase word (<= 7 chars + terminator)
        if _UPP7.match(part):
            result = result + part
            continue

        # Rule 5: default — separate words
        result = result + " " + part

    return re.sub(r"\s+", " ", result).strip()


def cells(row: list) -> list[str]:
    """Return non-None, non-empty stripped strings from a row."""
    return [str(c).strip() for c in row if c is not None and str(c).strip()]


def cell0(row: list) -> str:
    return str(row[0]).strip() if row and row[0] is not None else ""


def last_cell(row: list) -> str:
    """Return the last non-None, non-empty cell in a row."""
    for c in reversed(row):
        v = str(c).strip() if c is not None else ""
        if v:
            return v
    return ""


# Consonant clusters that CAN legitimately start Portuguese words.
# Any other 2-consonant start (MP, SS, SC, ST, NS, ND…) is an intra-word split.
_VALID_PT_CLUSTERS = frozenset({
    "PR", "BR", "CR", "DR", "FR", "GR", "TR", "VR",
    "PL", "BL", "CL", "FL", "GL",
    "CH", "LH", "NH",
})


def fix_intraword_spaces(name: str) -> str:
    """Remove spurious intra-word spaces inserted by pdfplumber column splitting.

    pdfplumber occasionally reads one word split across two PDF text chunks as
    two space-separated tokens.  Two generic rules plus two hardcoded fixes
    cover all known cases from the SBN manual:

      Rule 1 — token starts with 2+ consonants that form an INVALID PT word-start
               cluster (MP, SS, SC, ST, …).  Valid clusters like PR, TR, BR are
               whitelisted and left untouched.
      Rule 3 — prev ends in consonant AND token starts with a lowercase consonant
               (handles mixed-case artifacts such as "Neuroc" + "rítico").

    Hardcoded: vowel+vowel splits and QU-fragment cases that cannot be distinguished
    from real two-word pairs without a Portuguese dictionary.
    """
    # Hardcoded fixes for splits indistinguishable without a Portuguese dictionary
    name = name.replace("ESTERE OTAXIA", "ESTEREOTAXIA")   # vowel+vowel
    name = name.replace("BRA QUIAL", "BRAQUIAL")            # vowel+QU fragment
    name = name.replace("Neuroc rítico", "Neurocrítico")    # consonant+lowercase (intra-cell)

    # Fix spurious space after opening parenthesis: "( USNO)" → "(USNO)"
    name = RE_PAREN_SPACE.sub("(", name)

    tokens = name.split(" ")
    if len(tokens) <= 1:
        return name

    result = [tokens[0]]
    for token in tokens[1:]:
        if not token:
            continue
        prev = result[-1]
        # Only attempt a join when prev ends in a letter
        if not prev or not prev[-1].isalpha():
            result.append(token)
            continue
        # Only apply letter-based rules when token also starts with a letter
        if not token[0].isalpha():
            result.append(token)
            continue

        join = False

        # Rule 1: token starts with 2+ consonants forming an invalid PT word-start.
        # RE_PURE_ALPHA guards against abbreviations like "DVE/PIC" that happen
        # to start with a consonant cluster but are independent tokens.
        if (RE_PURE_ALPHA.match(token)
                and len(token) >= 2
                and token[0].upper() not in _VOWELS
                and token[1].upper() not in _VOWELS
                and (token[0].upper() + token[1].upper()) not in _VALID_PT_CLUSTERS):
            join = True

        if join:
            result[-1] += token
        else:
            result.append(token)

    return " ".join(result)


def clean_proc_name(raw: str) -> str:
    name = RE_SECTION_PREFIX.sub("", raw.replace("\n", " ").strip())
    name = re.sub(r"\s+", " ", name).strip()
    return fix_intraword_spaces(name)


def clean_description(raw: str) -> str:
    return re.sub(r"\s+", " ", RE_FOOTNOTE.sub("", raw.replace("\n", " ").strip()))


# ── Core extraction ───────────────────────────────────────────────────────────

def parse_sbn_pdf(pdf_path: str, debug: bool = False) -> list[dict]:
    records: list[dict] = []
    current_proc: Optional[str] = None
    in_cbhpm = False

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            tables = page.extract_tables()

            for table in tables:
                for row in table:
                    c0 = cell0(row)

                    # ── Procedure name row ────────────────────────────────────
                    # Pattern: col0="Nome", col1="Procedimento", name in cols 2+
                    if c0 == "Nome" and len(row) > 2:
                        col1 = str(row[1]).strip() if row[1] else ""
                        if "Procedimento" in col1 or col1 == "":
                            # Join all non-None cells from col 2 onwards
                            name_parts = [
                                str(c).strip() for c in row[2:] if c is not None and str(c).strip()
                            ]
                            raw_name = smart_join_name_parts(name_parts)
                            name = clean_proc_name(raw_name)
                            if name:
                                current_proc = name
                                in_cbhpm = False
                                if debug:
                                    print(f"[p{page_num}] PROC: {current_proc}")
                        continue

                    # ── CBHPM section header ──────────────────────────────────
                    if "Códigos CBHPM" in c0 or "Codigos CBHPM" in c0:
                        in_cbhpm = True
                        continue

                    # ── End of CBHPM section ──────────────────────────────────
                    if in_cbhpm and c0 in ("OPMEs", "Internação Dias", "Anestesia"):
                        in_cbhpm = False
                        continue

                    # ── CBHPM code row ────────────────────────────────────────
                    if in_cbhpm and current_proc:
                        m = RE_CODE.match(c0)
                        if not m:
                            continue

                        code = m.group(1)

                        # Porte: last cell in the row
                        porte_raw = last_cell(row)
                        pm = RE_PORTE.search(porte_raw)
                        if not pm:
                            if debug:
                                print(f"  [p{page_num}] WARN no porte: {code} | row={row}")
                            continue
                        porte = pm.group(1)

                        # Description: all middle cells (exclude col0 code and last porte cell)
                        # Find the actual description cells (non-code, non-porte)
                        middle = [
                            str(c).strip()
                            for c in row[1:]
                            if c is not None and str(c).strip()
                            and not RE_CODE.match(str(c).strip())
                            and str(c).strip() != porte_raw
                        ]
                        description = clean_description(" ".join(middle))

                        records.append({
                            "procedure_name": current_proc,
                            "cbhpm_code": code,
                            "description": description,
                            "porte": porte,
                        })
                        if debug:
                            print(f"  [p{page_num}] {code}  {porte:4s}  {description[:55]}")

    return records


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="Parse SBN manual PDF → procedures.json")
    ap.add_argument("--sbn", required=True, help="Path to the SBN manual PDF")
    ap.add_argument(
        "--out",
        default="backend/internal/repository/procedures.json",
        help="Output path (default: backend/internal/repository/procedures.json)",
    )
    ap.add_argument("--debug", action="store_true", help="Print extraction trace")
    args = ap.parse_args()

    pdf_path = Path(args.sbn)
    if not pdf_path.exists():
        sys.exit(f"PDF not found: {pdf_path}")

    print(f"Parsing {pdf_path} …")
    records = parse_sbn_pdf(str(pdf_path), debug=args.debug)

    # Deduplicate: same (procedure_name, cbhpm_code) keeps first occurrence
    seen: set[tuple] = set()
    unique: list[dict] = []
    for r in records:
        key = (r["procedure_name"], r["cbhpm_code"])
        if key not in seen:
            seen.add(key)
            unique.append(r)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(unique, f, ensure_ascii=False, indent=2)

    # ── Summary ───────────────────────────────────────────────────────────────
    procs = {r["procedure_name"] for r in unique}
    counts = Counter(r["procedure_name"] for r in unique)
    avg = len(unique) / len(procs) if procs else 0

    print(f"\nDone.")
    print(f"  Procedures  : {len(procs)}")
    print(f"  Total codes : {len(unique)}")
    print(f"  Avg per proc: {avg:.1f}")
    print(f"  Output      : {out_path}")

    sparse = sorted([(n, c) for n, c in counts.items() if c <= 2], key=lambda x: x[1])
    if sparse:
        print(f"\n  ⚠  {len(sparse)} procedures with ≤ 2 codes (review manually):")
        for name, count in sparse:
            print(f"     [{count}]  {name}")


if __name__ == "__main__":
    main()
