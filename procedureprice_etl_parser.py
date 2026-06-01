import json
import re
import pdfplumber
from typing import List, Dict, Optional

class ProcedurePriceETL:
    """
    Script de Extração e Cálculo para o ProcedurePrice (LabF5).
    Versão definitiva com importação global de dependências e caminhos relativos ao monorepo.
    """

    def __init__(self, sbn_pdf_path: str, comunicado_pdf_path: str):
        self.sbn_pdf_path = sbn_pdf_path
        self.comunicado_pdf_path = comunicado_pdf_path
        self.procedimentos: List[Dict] = []
        self.valores_portes: Dict[str, float] = {}

    def extrair_dados_sbn(self):
        print(f"A extrair dados de {self.sbn_pdf_path}...")
        procedimento_atual = None

        with pdfplumber.open(self.sbn_pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if not text:
                    continue

                linhas = text.split('\n')
                for linha in linhas:
                    match_nome = re.search(r'Nome Procedimento\s+(.+)', linha, re.IGNORECASE)
                    if match_nome:
                        if procedimento_atual:
                            self.procedimentos.append(procedimento_atual)

                        procedimento_atual = {
                            "nome": match_nome.group(1).strip(),
                            "codigos_cbhpm": []
                        }

                    match_codigo = re.search(r'(\d\.\d{2}\.\d{2}\.\d{2}\-\d)\s+(.+?)\s+(\d{1,2}[A-C])', linha)
                    if match_codigo and procedimento_atual:
                        procedimento_atual["codigos_cbhpm"].append({
                            "codigo": match_codigo.group(1),
                            "descricao": match_codigo.group(2).strip(),
                            "porte": match_codigo.group(3)
                        })

        if procedimento_atual:
            self.procedimentos.append(procedimento_atual)

        print(f"Total de {len(self.procedimentos)} procedimentos extraídos da SBN.")

    def extrair_valores_comunicado(self):
        print(f"A extrair valores de {self.comunicado_pdf_path}...")
        with pdfplumber.open(self.comunicado_pdf_path) as pdf:
            for page in pdf.pages:
                text = page.extract_text()
                if not text:
                    continue

                matches = re.finditer(r'(\d{1,2}[A-C])\s+R\$\s+([\d\.]+,(?:\d{2}))', text)
                for match in matches:
                    porte = match.group(1)
                    valor_str = match.group(2).replace('.', '').replace(',', '.')
                    if porte not in self.valores_portes:
                        self.valores_portes[porte] = float(valor_str)

        print(f"Valores de portes mapeados: {len(self.valores_portes)}")

    def gerar_sql_insercao(self, output_path: str):
        """
        Gera um ficheiro SQL otimizado para popular o PostgreSQL (Neon).
        """
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("-- Estrutura e Inserção de Dados - ProcedurePrice\n\n")
            f.write("CREATE TABLE IF NOT EXISTS portes_valores (\n")
            f.write("    porte VARCHAR(5) PRIMARY KEY,\n")
            f.write("    valor NUMERIC(10, 2) NOT NULL\n")
            f.write(");\n\n")

            f.write("CREATE TABLE IF NOT EXISTS procedimentos (\n")
            f.write("    id SERIAL PRIMARY KEY,\n")
            f.write("    nome VARCHAR(255) NOT NULL\n")
            f.write(");\n\n")

            f.write("CREATE TABLE IF NOT EXISTS procedimentos_cbhpm (\n")
            f.write("    codigo VARCHAR(20) PRIMARY KEY,\n")
            f.write("    procedimento_id INTEGER REFERENCES procedimentos(id),\n")
            f.write("    descricao TEXT NOT NULL,\n")
            f.write("    porte VARCHAR(5) REFERENCES portes_valores(porte)\n")
            f.write(");\n\n")

            # Inserir Portes
            f.write("-- Inserindo Valores dos Portes\n")
            for porte, valor in self.valores_portes.items():
                f.write(f"INSERT INTO portes_valores (porte, valor) VALUES ('{porte}', {valor}) ON CONFLICT DO NOTHING;\n")

            # Inserir Procedimentos (Lógica simplificada para geração do SQL)
            # Para evitar SQL Injection no script bruto, usaríamos prepared statements em produção,
            # mas aqui é um dump local.
            f.write("\n-- Inserindo Procedimentos e Crosswalks\n")
            for idx, proc in enumerate(self.procedimentos, start=1):
                nome_limpo = proc['nome'].replace("'", "''")
                f.write(f"INSERT INTO procedimentos (id, nome) VALUES ({idx}, '{nome_limpo}') ON CONFLICT DO NOTHING;\n")

                for cbhpm in proc['codigos_cbhpm']:
                    desc_limpa = cbhpm['descricao'].replace("'", "''")
                    codigo = cbhpm['codigo']
                    porte = cbhpm['porte']
                    f.write(f"INSERT INTO procedimentos_cbhpm (codigo, procedimento_id, descricao, porte) ")
                    f.write(f"VALUES ('{codigo}', {idx}, '{desc_limpa}', '{porte}') ON CONFLICT DO NOTHING;\n")

        print(f"Ficheiro SQL gerado com sucesso em: {output_path}")

if __name__ == '__main__':
    # O script está dentro de 'data/', então ele deve procurar na subpasta 'raw_pdfs/'
    etl = ProcedurePriceETL(
        'raw_pdfs/cbac6c_d991322923c24d01b46e1fdd39af6e73.pdf', 
        'raw_pdfs/COMUNICADO-CBHPM-2025_2026.pdf'
    )

    # Descomente para rodar a extração em ambiente de desenvolvimento
    etl.extrair_dados_sbn()
    etl.extrair_valores_comunicado()

    # Gera o SQL diretamente na pasta do backend para o sqlc/migrate consumir
    etl.gerar_sql_insercao('../backend/db/schema.sql')