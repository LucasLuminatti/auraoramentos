# -*- coding: utf-8 -*-
"""Extrai do PDF do catálogo um índice "página impressa -> códigos de produto".

A equipe responde por PÁGINA ("o trilho está na 176", "TINY é da 17 à 25"), então esse
índice é o tradutor entre a linguagem deles e os códigos do sistema. O número impresso é
lido da própria página (o offset entre página do PDF e página impressa não é constante).

    python scripts/indexar-catalogo-pdf.py "C:/caminho/LUMI_CATALOGO_2026_SET.pdf"
    -> analise/catalogo-2026-paginas.json

Requer PyMuPDF (import fitz).
"""
import json
import re
import sys
from pathlib import Path

import fitz

PDF = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\lenny\Downloads\LUMI_CATALOGO_2026_SET.pdf"
SAIDA = Path(__file__).resolve().parents[2] / "analise" / "catalogo-2026-paginas.json"
RUIDO = re.compile(r"imagens meramente|www\.|luminatti", re.I)
CODIGO = re.compile(r"\b(?:LM|OR|AU)\d{3,5}\b")
NUMERO_ISOLADO = re.compile(r"(?m)^\s*(\d{1,3})\s*$")

doc = fitz.open(PDF)
paginas = {}
for i in range(doc.page_count):
    texto = doc[i].get_text()
    codigos = sorted(set(CODIGO.findall(texto)))
    if not codigos:
        continue
    nums = NUMERO_ISOLADO.findall(texto)
    impressa = int(nums[0]) if nums else None
    titulo = [l.strip() for l in texto.split("\n") if len(l.strip()) > 3 and not RUIDO.search(l)]
    chave = str(impressa) if impressa is not None else f"pdf{i + 1}"
    paginas[chave] = {
        "pdf_index": i,
        "pagina_impressa": impressa,
        "codigos": codigos,
        "titulo": titulo[:4],
    }

SAIDA.write_text(json.dumps(paginas, ensure_ascii=False, indent=1), encoding="utf-8")
distintos = {c for v in paginas.values() for c in v["codigos"]}
print(f"{len(paginas)} páginas com produto | {len(distintos)} produtos distintos -> {SAIDA}")
