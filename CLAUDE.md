# Panorama COVID-19

Dashboard interativo publicado em https://claude.ai/artifact/Qdad9z3Zo7MWCbMa2a64qg (Artifact do tipo Dashboard).
Repositório privado: https://github.com/RaulAraujoSilva/panorama-covid19

- Regenerar dados: `python scripts/preparar_dados.py` (precisa de `data/raw/owid-covid-data.csv` do Kaggle e `data/geo/ne_110m.geojson`).
- Ao mudar `dashboard/index.html` ou `dashboard/app.js`, gravar de novo os documentos `files/index.html` e `files/app.js` do artifact (campo `text`).
- Ao mudar os CSVs, reenviar o arquivo como asset e atualizar `url`, `name` e `updated` do dataset correspondente.
- Detalhes em `.claude-docs/`.
