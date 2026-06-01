import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SBN_PDF = ROOT / "data" / "raw_pdfs" / "cbac6c_d991322923c24d01b46e1fdd39af6e73.pdf"
OUTPUT_JSON = ROOT / "backend" / "internal" / "handlers" / "procedures.json"

FIELD_LABELS = (
    "Descrição do",
    "procedimento",
    "CIDs do Procedimento",
    "Indicação",
    "Caráter da Indicação",
    "Contra-Indicação",
    "Exames da Indicação",
    "Códigos CBHPM",
    "OPMEs",
    "Internação Dias",
    "Anestesia",
    "Materiais Especiais",
    "Resolutividade",
    "Seguimento",
    "Rastreabilidade",
    "Comentários",
)

TEXT_REPLACEMENTS = (
    (r"\bPOS-OPERATÓRIO\b", "PÓS-OPERATÓRIO"),
    (r"\bpos-operatória\b", "pós-operatória"),
    (r"\bpos-operatório\b", "pós-operatório"),
    (r"\bcirurgico\b", "cirúrgico"),
    (r"\bcirurgica\b", "cirúrgica"),
    (r"\bmusculo\b", "músculo"),
    (r"\bclinica\b", "clínica"),
    (r"\bRessonancia\b", "Ressonância"),
    (r"\bmetastase\b", "metástase"),
    (r"\bprimaria\b", "primária"),
    (r"\bsecundaria\b", "secundária"),
    (r"\bDiario\b", "Diário"),
    (r"\bDiagnostico\b", "Diagnóstico"),
    (r"\betiologico\b", "etiológico"),
    (r"\bsequela neurologica\b", "sequela neurológica"),
    (r"\bmalformaçoes\b", "malformações"),
    (r"\bLiquórica\b", "liquórica"),
)


def pdf_text(path: Path) -> str:
    result = subprocess.run(
        ["pdftotext", "-layout", str(path), "-"],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalize_pt_br(value: str) -> str:
    value = normalize_spaces(value)
    for pattern, replacement in TEXT_REPLACEMENTS:
        value = re.sub(pattern, replacement, value)
    return value


def is_field_line(line: str) -> bool:
    stripped = line.strip()
    return any(stripped.startswith(label) for label in FIELD_LABELS)


def clean_procedure_name(value: str) -> str:
    value = normalize_pt_br(value)
    value = re.sub(r"^\d+(?:\.\d+)*\s*[-–]\s*", "", value)
    return value


def split_code_line(line: str):
    match = re.match(r"\s*(\d\.\d{2}\.\d{2}\.\d{2}-\d)\s+(.+?)\s+(\d{1,2}[A-C])\s*$", line)
    if not match:
        return None

    return {
        "cbhpm_code": match.group(1),
        "description": normalize_pt_br(match.group(2)),
        "porte": match.group(3),
    }


def parse_catalog(text: str):
    lines = text.splitlines()
    procedures = []
    current_name = None
    current_codes = []
    last_code = None
    collecting_name = False
    in_codes = False

    def flush_current():
        nonlocal current_name, current_codes, last_code
        if current_name:
            for item in current_codes:
                procedures.append(
                    {
                        "procedure_name": clean_procedure_name(current_name),
                        "cbhpm_code": item["cbhpm_code"],
                        "description": item["description"],
                        "porte": item["porte"],
                    }
                )
        current_name = None
        current_codes = []
        last_code = None

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        if stripped.startswith("Nome Procedimento"):
            flush_current()
            current_name = line.split("Nome Procedimento", 1)[1].strip()
            collecting_name = True
            in_codes = False
            continue

        if collecting_name:
            if is_field_line(line):
                collecting_name = False
            elif current_name is not None:
                current_name = f"{current_name} {stripped}"
                continue

        if stripped.startswith("Códigos CBHPM"):
            in_codes = True
            last_code = None
            continue

        if in_codes:
            if stripped.startswith("OPMEs") or stripped.startswith("Internação Dias"):
                in_codes = False
                last_code = None
                continue

            code_item = split_code_line(line)
            if code_item:
                current_codes.append(code_item)
                last_code = code_item
                continue

            if last_code and not is_field_line(line):
                last_code["description"] = normalize_pt_br(f"{last_code['description']} {stripped}")

    flush_current()

    return procedures


def main():
    catalog = parse_catalog(pdf_text(SBN_PDF))
    
    # Deduplicate based on cbhpm_code and description
    seen = set()
    deduplicated = []
    for item in catalog:
        key = (item["cbhpm_code"], item["description"])
        if key not in seen:
            seen.add(key)
            deduplicated.append(item)
    
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(deduplicated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Generated {len(deduplicated)} unique procedure-code entries (removed {len(catalog) - len(deduplicated)} duplicates) at {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
