"""Monta o site estático em site/ a partir da página do dashboard e dos dados gerados.

Pré-requisito: python scripts/preparar_dados.py (gera build/).
Saída: site/index.html, site/app.js, site/dash-shim.js, site/data/*
"""
import shutil
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SITE = RAIZ / "site"

if __name__ == "__main__":
    (SITE / "data").mkdir(parents=True, exist_ok=True)
    pagina = (RAIZ / "dashboard/index.html").read_text(encoding="utf-8")
    modelo = (RAIZ / "site-src/template.html").read_text(encoding="utf-8")
    (SITE / "index.html").write_text(modelo.replace("{{CONTEUDO}}", pagina), encoding="utf-8")
    shutil.copy(RAIZ / "dashboard/app.js", SITE / "app.js")
    shutil.copy(RAIZ / "site-src/dash-shim.js", SITE / "dash-shim.js")
    for nome in ["semanal.csv", "paises.csv", "mapa.json"]:
        shutil.copy(RAIZ / "build" / nome, SITE / "data" / nome)
    for f in sorted(SITE.rglob("*")):
        if f.is_file():
            print(f.relative_to(RAIZ), round(f.stat().st_size / 1024), "KB")
