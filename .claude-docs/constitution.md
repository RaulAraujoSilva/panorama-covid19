# Constituição do Projeto

## Princípios
- Dashboard interativo da pandemia de COVID-19 sobre o dataset Our World in Data (Kaggle georgesaavedra/covid19-dataset, retrato de 05/03/2022).
- Publicado como Artifact do tipo Dashboard: https://claude.ai/artifact/Qdad9z3Zo7MWCbMa2a64qg
- Todo número exibido vem de um dataset anexado ou de um `dash.calc`; nada de valores fixos no HTML.

## Padrões de Código
- `scripts/preparar_dados.py` gera `build/semanal.csv`, `build/paises.csv` e `build/mapa.json` a partir de `data/raw/`.
- Página em `dashboard/index.html` + `dashboard/app.js` (d3 v7 global, API `dash`, regra "one-writer": texto fixo no HTML, dados em `data-draw`).
- Interface, nomes e formatos numéricos em português brasileiro.

## Restrições
- Não versionar `data/raw/`, `data/geo/` nem `build/`.
- Cada documento da página tem limite de 256 KB; cada arquivo de dados, 8 MB.
