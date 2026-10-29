"""Prepara os arquivos do dashboard a partir do CSV do Our World in Data.

Entrada:  data/raw/owid-covid-data.csv (Kaggle georgesaavedra/covid19-dataset)
          data/geo/ne_110m.geojson (Natural Earth 110m, v5.1.2)
Saida:    build/semanal.csv  serie semanal por local
          build/paises.csv   atributos fixos por local
          build/mapa.json    contornos dos paises ja projetados (Natural Earth 1)
"""
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
import pycountry
from babel import Locale

RAIZ = Path(__file__).resolve().parent.parent
BUILD = RAIZ / "build"
BUILD.mkdir(exist_ok=True)

AGREGADOS = {
    "OWID_WRL": ("Mundo", "mundo"),
    "OWID_AFR": ("África", "continente"),
    "OWID_ASI": ("Ásia", "continente"),
    "OWID_EUR": ("Europa", "continente"),
    "OWID_NAM": ("América do Norte", "continente"),
    "OWID_SAM": ("América do Sul", "continente"),
    "OWID_OCE": ("Oceania", "continente"),
    "OWID_EUN": ("União Europeia", "bloco"),
    "OWID_HIC": ("Alta renda", "renda"),
    "OWID_UMC": ("Renda média-alta", "renda"),
    "OWID_LMC": ("Renda média-baixa", "renda"),
    "OWID_LIC": ("Baixa renda", "renda"),
}
CONTINENTES = {
    "Africa": "África", "Asia": "Ásia", "Europe": "Europa",
    "North America": "América do Norte", "South America": "América do Sul",
    "Oceania": "Oceania",
}
NOMES_EXTRA = {"OWID_KOS": "Kosovo", "OWID_CYN": "Chipre do Norte"}
NOMES_CORRIGIDOS = {"COD": "RD do Congo", "COG": "Congo", "HKG": "Hong Kong", "MAC": "Macau",
                    "PSE": "Palestina"}

PT = Locale("pt", "BR").territories


def nome_pt(iso, nome_en):
    if iso in AGREGADOS:
        return AGREGADOS[iso][0]
    if iso in NOMES_EXTRA:
        return NOMES_EXTRA[iso]
    if iso in NOMES_CORRIGIDOS:
        return NOMES_CORRIGIDOS[iso]
    pais = pycountry.countries.get(alpha_3=iso)
    if pais and pais.alpha_2 in PT:
        return PT[pais.alpha_2]
    return nome_en


def preparar_series():
    df = pd.read_csv(RAIZ / "data/raw/owid-covid-data.csv", parse_dates=["date"])
    df = df[df.location != "International"]
    df = df[~df.iso_code.str.startswith("OWID_") | df.iso_code.isin(list(AGREGADOS) + list(NOMES_EXTRA))]

    linhas = []
    for iso, g in df.groupby("iso_code"):
        g = g.set_index("date").sort_index()
        semana = g.resample("W-SAT")
        s = pd.DataFrame({
            "casos": semana.new_cases.sum(min_count=1).clip(lower=0),
            "obitos": semana.new_deaths.sum(min_count=1).clip(lower=0),
            "casos_acum": semana.total_cases.last(),
            "obitos_acum": semana.total_deaths.last(),
            "vac_parcial": semana.people_vaccinated_per_hundred.last(),
            "vac_completa": semana.people_fully_vaccinated_per_hundred.last(),
            "rigor": semana.stringency_index.mean(),
        })
        s[["casos_acum", "obitos_acum"]] = s[["casos_acum", "obitos_acum"]].ffill()
        s[["vac_parcial", "vac_completa"]] = s[["vac_parcial", "vac_completa"]].ffill()
        pop = g.population.dropna().iloc[-1] if g.population.notna().any() else np.nan
        mi = pop / 1e6
        s["casos_pm"] = s.casos / mi
        s["obitos_pm"] = s.obitos / mi
        s["casos_acum_pm"] = s.casos_acum / mi
        s["obitos_acum_pm"] = s.obitos_acum / mi
        # letalidade aparente: obitos em 4 semanas / casos nas 4 semanas encerradas 2 semanas antes
        casos4 = s.casos.rolling(4, min_periods=4).sum().shift(2)
        obitos4 = s.obitos.rolling(4, min_periods=4).sum()
        s["letalidade"] = np.where(casos4 >= 1000, obitos4 / casos4 * 100, np.nan)
        s = s[s.casos_acum.notna() | s.vac_completa.notna()]
        s.insert(0, "iso", iso)
        linhas.append(s)

    sem = pd.concat(linhas).reset_index().rename(columns={"date": "semana"})
    sem["semana"] = sem.semana.dt.strftime("%Y-%m-%d")
    for c in ["casos", "obitos", "casos_acum", "obitos_acum"]:
        sem[c] = sem[c].round().astype("Int64")
    for c in ["casos_pm", "obitos_pm", "casos_acum_pm", "obitos_acum_pm", "rigor"]:
        sem[c] = sem[c].round(1)
    for c in ["vac_parcial", "vac_completa", "letalidade"]:
        sem[c] = sem[c].round(2)
    ordem = ["iso", "semana", "casos", "obitos", "casos_acum", "obitos_acum", "casos_pm", "obitos_pm",
             "casos_acum_pm", "obitos_acum_pm", "vac_parcial", "vac_completa", "rigor", "letalidade"]
    sem[ordem].to_csv(BUILD / "semanal.csv", index=False)

    fixo = df.sort_values("date").groupby("iso_code").agg(
        nome_en=("location", "last"), continente=("continent", "last"), populacao=("population", "last"),
        idosos65=("aged_65_older", "last"), idade_mediana=("median_age", "last"),
        idh=("human_development_index", "last"), pib_pc=("gdp_per_capita", "last"),
        rigor_medio=("stringency_index", "mean"),
    ).reset_index().rename(columns={"iso_code": "iso"})
    fixo["nome"] = [nome_pt(i, n) for i, n in zip(fixo.iso, fixo.nome_en)]
    fixo["tipo"] = [AGREGADOS[i][1] if i in AGREGADOS else "país" for i in fixo.iso]
    fixo["continente"] = fixo.continente.map(CONTINENTES)
    fixo["populacao"] = fixo.populacao.round().astype("Int64")
    for c in ["idosos65", "idade_mediana", "rigor_medio"]:
        fixo[c] = fixo[c].round(1)
    fixo["idh"] = fixo.idh.round(3)
    fixo["pib_pc"] = fixo.pib_pc.round()
    fixo = fixo[fixo.iso.isin(sem.iso.unique())]
    fixo[["iso", "nome", "tipo", "continente", "populacao", "idosos65", "idade_mediana", "idh", "pib_pc",
          "rigor_medio"]].sort_values("nome").to_csv(BUILD / "paises.csv", index=False)
    return sem, fixo


def projetar(lon, lat):
    """Projecao Natural Earth 1 (mesma formula de d3.geoNaturalEarth1)."""
    lam, phi = math.radians(lon), math.radians(lat)
    p2 = phi * phi
    p4 = p2 * p2
    x = lam * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)))
    y = phi * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))
    return x, y


def preparar_mapa(isos_validos):
    geo = json.loads((RAIZ / "data/geo/ne_110m.geojson").read_text(encoding="utf-8"))
    corrige = {"KOS": "OWID_KOS", "CYN": "OWID_CYN", "SDS": "SSD", "SAH": "ESH"}
    feicoes = []
    for f in geo["features"]:
        p = f["properties"]
        iso = p["ISO_A3"] if p["ISO_A3"] != "-99" else p["ADM0_A3"]
        iso = corrige.get(iso, iso)
        if iso == "ATA":
            continue
        g = f["geometry"]
        poligonos = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        aneis = [[projetar(lon, lat) for lon, lat in anel] for pol in poligonos for anel in pol]
        feicoes.append((iso, aneis))

    xs = [x for _, an in feicoes for a in an for x, _ in a]
    ys = [y for _, an in feicoes for a in an for _, y in a]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    largura = 1000
    escala = largura / (x1 - x0)
    altura = round((y1 - y0) * escala)

    linhas = []
    for iso, aneis in feicoes:
        partes = []
        for a in aneis:
            pts = [(round((x - x0) * escala, 1), round((y1 - y) * escala, 1)) for x, y in a]
            partes.append("M" + "L".join(f"{x:g},{y:g}" for x, y in pts) + "Z")
        linhas.append({"iso": iso, "contorno": "".join(partes)})
    (BUILD / "mapa.json").write_text(json.dumps(linhas, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    sem_dados = sorted(i for i, _ in feicoes if i not in isos_validos)
    print(f"mapa: {len(linhas)} contornos, viewBox 0 0 {largura} {altura}; sem dados: {sem_dados}")


if __name__ == "__main__":
    sem, fixo = preparar_series()
    print(f"semanal: {len(sem)} linhas, {sem.iso.nunique()} locais, {sem.semana.min()} a {sem.semana.max()}")
    print("sem nome PT:", fixo[fixo.nome == fixo.nome_en][["iso", "nome"]].values.tolist()[:40])
    preparar_mapa(set(fixo.iso))
    for f in BUILD.iterdir():
        print(f.name, round(f.stat().st_size / 1024), "KB")
