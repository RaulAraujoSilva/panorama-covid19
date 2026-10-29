# Plano: dashboard interativo COVID-19 (Our World in Data)

## Contexto

Você pediu um dashboard interativo e bonito, publicado como Artifact, a partir do dataset do link do Google Dataset Search. O link aponta para o Kaggle **georgesaavedra/covid19-dataset** (licença CC0), que é um retrato do **Our World in Data** de 05/03/2022. Já baixei e inspecionei o arquivo, que está em `data/raw/owid-covid-data.csv`:

- 166.326 linhas × 67 colunas; dados diários de **01/01/2020 a 05/03/2022**
- 238 locais: países, 6 continentes e agregados (`World`, grupos de renda, `European Union`), que aparecem como `iso_code` iniciado por `OWID_`
- Boa cobertura (≥ 75%): casos, óbitos, população, idade, PIB, IDH, índice de rigor das restrições e Rt. Cobertura média (cerca de 25–50%): vacinação e testagem. Cobertura baixa (< 15%): hospitalização, UTI e excesso de mortalidade, então essas colunas **ficam de fora**

## Insights encontrados (todos calculados sobre os dados)

1. **Escala mundial:** 445 milhões de casos e 6,0 milhões de óbitos até 05/03/2022; 55,9% da população mundial com esquema vacinal completo.
2. **Casos e óbitos se descolaram:** o pico de casos foi com a Ômicron (24/01/2022, 3,44 milhões por dia na média de 7 dias), mas o pico de óbitos veio um ano antes (26/01/2021, 14,7 mil por dia). A letalidade aparente despencou.
3. **Desigualdade vacinal:** 73% dos países de alta renda estavam vacinados, contra **6%** dos de baixa renda.
4. **"Paradoxo" da riqueza:** os óbitos por milhão crescem com a % de idosos (ρ = 0,70), o IDH (0,68) e o PIB per capita (0,60). Isso reflete demografia e também **subnotificação** nos países pobres (baixa renda: 63 óbitos/milhão; alta renda: 1.830).
5. **O rigor das restrições quase não explica a mortalidade acumulada** (ρ = 0,19).
6. **Mortalidade mais alta por milhão:** Peru (6.322) e Leste Europeu (Bulgária, Bósnia, Hungria…). Brasil: 29 milhões de casos, 652 mil óbitos, 3.048 por milhão e 72,8% vacinados.

## Layout do dashboard (painel único, em português)

**Barra de filtros fixa no topo:** período (intervalo de datas), continente (múltipla escolha), países em comparação (busca com múltipla escolha; padrão: Brasil, EUA, Índia, Reino Unido e Mundo), alternância **absoluto ↔ por milhão** e escolha da métrica (casos, óbitos, vacinados). Todos os gráficos respondem aos filtros, e clicar num país no mapa ou no ranking o inclui na comparação (*cross-filter*).

1. **Cartões de KPI**, que respeitam os filtros: casos, óbitos, letalidade aparente, % vacinados e pico do período, cada um com *sparkline*.
2. **Linha do tempo das ondas**: novos casos e óbitos (média de 7 dias) por país selecionado, com zoom por arraste e faixas marcando as ondas original, Delta e Ômicron.
3. **Mapa-múndi coroplético**: métrica escolhida e controle deslizante de data com botão ▶ para animar a evolução semana a semana.
4. **Ranking Top 15** em barras horizontais, ordenado pela métrica escolhida, no recorte de continente e período.
5. **Corrida vacinal por grupo de renda**: linhas de % com esquema completo nos 4 grupos (insight 3).
6. **Dispersão de óbitos por milhão × % de idosos 65+**: bolha proporcional à população, cor por continente e eixo X trocável (65+, IDH, PIB, rigor) (insights 4 e 5).
7. **Descolamento casos × óbitos**: letalidade aparente móvel (óbitos/casos em 28 dias) ao longo do tempo (insight 2).
8. **Restrições × contágio** do país em foco: índice de rigor e novos casos em eixo duplo.
9. **Rodapé de notas**: fonte, data de corte e ressalvas (subnotificação, letalidade "aparente", agregados excluídos dos rankings).

O visual terá tema claro e escuro, paleta acessível validada pela skill `dataviz`, tipografia limpa, tooltips ricas e layout responsivo (no celular os gráficos ficam empilhados).

## Implementação

- **Pré-processamento** em `scripts/preparar_dados.py` (pandas): agrega a série diária em **semanal** por país, com as colunas casos/óbitos novos e acumulados (absolutos e por milhão), % vacinados (parcial e completo), rigor e letalidade móvel; depois soma uma tabela estática por país (população, continente, 65+, IDH, PIB). O resultado sai em JSON compacto, em formato colunar com arrays, para `build/data.json` (estimativa de 1,5–2,5 MB). A série semanal deixa o arquivo cerca de 7× menor e não perde as ondas.
- **Página** `dashboard/index.html`: HTML e JS puros com **Apache ECharts 5.5.x** (cdnjs), que tem mapa, *brush*, *dataZoom*, *timeline* e tema escuro. O GeoJSON do mundo (Natural Earth 110m, cerca de 100–200 KB) vai **embutido** na página, porque um artifact não pode buscar dados de fora em tempo de execução. Junto com os dados, o total fica bem abaixo do limite de 16 MB.
- **Build** em `scripts/montar_html.py`: injeta o JSON e o GeoJSON no template e gera `dist/covid-dashboard.html`, o arquivo publicado.
- **Publicação** com a ferramenta Artifact (antes, rodo o *quickstart* com `intent: "other"`, que pode indicar o tipo Dashboard, e carrego as skills `artifact-design` e `dataviz`).
- **Git:** `.gitignore` com `data/raw/` (47 MB, não versionar), commits em português e push se houver remoto.
- **`.claude-docs/`:** `constitution.md`, `features.md` e `tasks.md`, além deste plano, no padrão das suas instruções globais.

## Verificação

1. Conferir os KPIs do dashboard contra o pandas: Mundo, 445,1 milhões de casos e 5,995 milhões de óbitos; Brasil, 652.216 óbitos.
2. Abrir `dist/covid-dashboard.html` no navegador embutido: nenhum erro no console; testar cada filtro, o cross-filter do mapa e do ranking, a animação do mapa, o zoom, o tema escuro e a largura de celular (375 px).
3. Publicar o artifact, abrir o link e repetir um *smoke test* rápido.
