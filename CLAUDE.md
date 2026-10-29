# Panorama COVID-19

Dashboard interativo da COVID-19 (Our World in Data, até 05/03/2022), em duas versões com o mesmo código de página:

- **Site público (Render):** https://panorama-covid19.onrender.com — static site `srv-dbhopagm7kps73fevq10`, publica a pasta `site/`, auto-deploy a cada push em `main`.
- **Artifact (claude.ai):** https://claude.ai/artifact/Qdad9z3Zo7MWCbMa2a64qg — tipo Dashboard.
- **Repositório público:** https://github.com/RaulAraujoSilva/panorama-covid19

## Fluxo

1. `python scripts/preparar_dados.py` — gera `build/` (precisa de `data/raw/owid-covid-data.csv` do Kaggle e `data/geo/ne_110m.geojson`).
2. Editar a página em `dashboard/index.html` e `dashboard/app.js` (API `dash` do tipo Dashboard).
3. `python scripts/montar_site.py` — gera `site/` com `site-src/template.html` (tokens de tema) e `site-src/dash-shim.js` (imita a API `dash`). No site, o script vira `painel.js`.
4. Commit + push publica no Render. Para o artifact, gravar de novo `files/index.html` e `files/app.js` (campo `text`) e, se os CSVs mudarem, reenviar o asset e atualizar `url`/`updated` do dataset.

## Cuidados

- Depois de cada deploy no Render, conferir que `/`, `painel.js`, `dash-shim.js` e `data/*` respondem 200. Já aconteceu de um deploy publicar só parte dos arquivos (404 em um `.js`); um novo deploy com limpeza de cache resolveu.
- `site/` e seus dados são versionados (o Render publica sem build); `data/raw/`, `data/geo/` e `build/` não.
- Detalhes em `.claude-docs/`.
