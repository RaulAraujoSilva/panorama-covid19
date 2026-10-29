// Panorama COVID-19: desenhos do painel (d3 v7 global, API `dash` do tipo Dashboard)

const DEF = {
  foco: 'BRA', comparar: ['BRA', 'USA', 'IND', 'GBR', 'OWID_WRL'], metrica: 'casos', escala: 'pm',
  continente: null, inicio: '2020-01-25', fim: '2022-03-05', eixo: 'idosos65',
};
const FAIXAS = [
  ['2020-01-25', '2020-11-30', 'Cepa original'],
  ['2020-12-01', '2021-05-31', 'Alfa'],
  ['2021-06-01', '2021-12-15', 'Delta'],
  ['2021-12-16', '2022-03-05', 'Ômicron'],
];
const RENDA = ['OWID_HIC', 'OWID_UMC', 'OWID_LMC', 'OWID_LIC'];
const CONTS = ['África', 'América do Norte', 'América do Sul', 'Ásia', 'Europa', 'Oceania'];
const POP_MIN = 1e6;
const MAX_COMPARAR = 8;
const MAPA_W = 1000, MAPA_H = 435;
const NUM = ['casos', 'obitos', 'casos_acum', 'obitos_acum', 'casos_pm', 'obitos_pm', 'casos_acum_pm',
  'obitos_acum_pm', 'vac_parcial', 'vac_completa', 'rigor', 'letalidade'];
const NUM_PAIS = ['populacao', 'idosos65', 'idade_mediana', 'idh', 'pib_pc', 'rigor_medio'];
const MET = {
  casos: { serie: { pm: 'casos_pm', abs: 'casos' }, acum: { pm: 'casos_acum_pm', abs: 'casos_acum' }, cor: 0 },
  obitos: { serie: { pm: 'obitos_pm', abs: 'obitos' }, acum: { pm: 'obitos_acum_pm', abs: 'obitos_acum' }, cor: 1 },
  vacina: { pct: true, cor: 2 },
};
const EIXOS = {
  idosos65: '% da população com 65 anos ou mais',
  idh: 'Índice de Desenvolvimento Humano',
  pib_pc: 'PIB per capita (US$ PPC, escala log)',
  rigor_medio: 'Rigor médio das restrições (0 a 100)',
};

// ---------- formatos pt-BR ----------
const L = d3.formatLocale({ decimal: ',', thousands: '.', grouping: [3], currency: ['R$ ', ''] });
const T = d3.timeFormatLocale({
  dateTime: '%d/%m/%Y %H:%M', date: '%d/%m/%Y', time: '%H:%M:%S', periods: ['AM', 'PM'],
  days: ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'],
  shortDays: ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
  months: ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
  shortMonths: ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'],
});
const fInt = L.format(',.0f');
const f1 = L.format(',.1f');
const f2 = L.format(',.2f');
const fPct = (v) => f1(v) + '%';
const cmp = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const fC = (v) => cmp.format(v);
const fDia = T.utcFormat('%-d %b %Y');
const fDiaLongo = T.utcFormat('%-d de %B de %Y');
const fMes = T.utcFormat('%b %Y');
const parse = d3.utcParse('%Y-%m-%d');
const isoDia = d3.utcFormat('%Y-%m-%d');

// ---------- dados ----------
const cache = new WeakMap();
const memo = (data, f) => {
  let v = cache.get(data);
  if (!v) { v = f(data); cache.set(data, v); }
  return v;
};
const num = (s) => (s === '' || s == null ? null : +s);

function semanal() {
  const r = dash.data('semanal');
  if (r.status !== 'ok') return null;
  return memo(r.data, (rows) => {
    const por = new Map();
    for (const x of rows) {
      const o = { iso: x.iso, semana: x.semana, d: parse(x.semana) };
      for (const k of NUM) o[k] = num(x[k]);
      let a = por.get(x.iso);
      if (!a) por.set(x.iso, (a = []));
      a.push(o);
    }
    for (const a of por.values()) a.sort((p, q) => d3.ascending(p.semana, q.semana));
    return por;
  });
}

function paises() {
  const r = dash.data('paises');
  if (r.status !== 'ok') return null;
  return memo(r.data, (rows) => new Map(rows.map((x) => {
    const o = { ...x };
    for (const k of NUM_PAIS) o[k] = num(x[k]);
    return [x.iso, o];
  })));
}

const P = () => {
  const dados = Object.entries(dash.params() || {}).filter(([, v]) => v != null && v !== '');
  const p = { ...DEF, ...Object.fromEntries(dados) };
  if (!Array.isArray(p.comparar)) p.comparar = DEF.comparar;
  if (!MET[p.metrica]) p.metrica = DEF.metrica;
  if (p.inicio > p.fim) [p.inicio, p.fim] = [p.fim, p.inicio];
  return p;
};
const campo = (p, tipo) => (MET[p.metrica].pct ? 'vac_completa' : MET[p.metrica][tipo][p.escala === 'abs' ? 'abs' : 'pm']);
const noPeriodo = (a, p) => a.filter((r) => r.semana >= p.inicio && r.semana <= p.fim);
const ultimoAte = (a, fim, k) => {
  for (let i = d3.bisector((r) => r.semana).right(a, fim) - 1; i >= 0; i--) if (a[i][k] != null) return a[i];
  return null;
};
const ultimoAntes = (a, inicio, k) => {
  for (let i = d3.bisector((r) => r.semana).left(a, inicio) - 1; i >= 0; i--) if (a[i][k] != null) return a[i];
  return null;
};
const nomeDe = (iso) => paises()?.get(iso)?.nome ?? iso;
const cor = (i) => dash.colors[i % dash.colors.length];
const fmtValor = (p, v) => {
  if (v == null || !isFinite(v)) return '—';
  if (MET[p.metrica].pct) return fPct(v);
  return p.escala === 'abs' || v >= 100 ? fInt(v) : f1(v);
};
const fmtEixo = (p) => (MET[p.metrica].pct ? (v) => fInt(v) + '%' : (v) => (v >= 1000 ? fC(v) : fInt(v)));
const fmtCampo = (f, v) => {
  if (v == null || !isFinite(v)) return '—';
  if (f === 'vac_completa' || f === 'vac_parcial') return fPct(v);
  if (f === 'letalidade') return f2(v) + '%';
  if (f.endsWith('_pm')) return v >= 100 ? fInt(v) : f1(v);
  return fInt(v);
};

function selecionar(iso) {
  const p = P();
  const comparar = p.comparar.includes(iso) ? p.comparar : [...p.comparar, iso].slice(-MAX_COMPARAR);
  dash.setParams({ foco: iso, comparar });
}

// ---------- estados e utilitários de desenho ----------
function pronto(el, ids) {
  const st = ids.map((i) => dash.data(i).status);
  if (st.every((s) => s === 'ok')) { el.classList.remove('dash-skeleton'); return true; }
  el.replaceChildren();
  if (st.some((s) => s === 'error' || s === 'missing' || s === 'declined' || s === 'connect')) {
    el.classList.remove('dash-skeleton');
    const d = document.createElement('div');
    d.className = 'cv-fail';
    d.textContent = 'Falha ao carregar';
    el.appendChild(d);
  } else {
    el.classList.add('dash-skeleton');
  }
  return false;
}

function aviso(el, texto) {
  const d = document.createElement('p');
  d.className = 'cv-note';
  d.textContent = texto;
  el.appendChild(d);
}

function dica(el) {
  const t = document.createElement('div');
  t.className = 'cv-tip';
  t.hidden = true;
  el.appendChild(t);
  return {
    mostrar(x, y, titulo, linhas) {
      t.replaceChildren();
      const h = document.createElement('div');
      h.className = 'cv-tip-h';
      h.textContent = titulo;
      t.appendChild(h);
      for (const [c, nome, valor] of linhas) {
        const r = document.createElement('div');
        r.className = 'cv-tip-r';
        const a = document.createElement('span');
        if (c) { const i = document.createElement('i'); i.style.background = c; a.appendChild(i); }
        a.append(nome);
        const b = document.createElement('span');
        b.textContent = valor;
        r.append(a, b);
        t.appendChild(r);
      }
      t.hidden = false;
      const w = el.clientWidth, tw = t.offsetWidth, th = t.offsetHeight;
      let left = x + 14;
      if (left + tw > w) left = Math.max(0, x - tw - 14);
      t.style.left = left + 'px';
      t.style.top = Math.max(0, Math.min(y, el.clientHeight - th)) + 'px';
    },
    esconder() { t.hidden = true; },
  };
}

function larguraTextos(svg, textos, classe) {
  const g = svg.append('g');
  let w = 0;
  for (const s of textos) {
    const n = g.append('text').attr('class', classe || null).text(s);
    w = Math.max(w, n.node().getComputedTextLength());
  }
  g.remove();
  return w;
}

function estiloEixo(g) {
  g.attr('font-size', null).attr('font-family', null);
  g.select('.domain').style('stroke', 'var(--cds-chart-axis)');
  g.selectAll('.tick line').style('stroke', 'var(--cds-chart-axis)');
}

function novoSvg(el, w, h) {
  return d3.select(el).append('svg').attr('width', '100%').attr('height', h)
    .attr('viewBox', `0 0 ${w} ${h}`).attr('class', 'cv-anim').style('display', 'block');
}

let seqId = 0;

// Gráfico de linhas múltiplas com rótulo no fim de cada linha, dica e (opcional) seleção de período
function linhas(el, { series, fy, fv, faixas, selecao, yMax }) {
  el.replaceChildren();
  const pts = series.flatMap((s) => s.pts.filter((d) => d.v != null));
  if (!pts.length) { aviso(el, 'Sem dados para o recorte escolhido.'); return; }
  const W = Math.max(280, el.clientWidth), H = parseFloat(getComputedStyle(el).minHeight) || 300;
  const svg = novoSvg(el, W, H);
  const allD = series.flatMap((s) => s.pts.map((d) => d.d));
  const x0 = d3.min(allD), x1 = d3.max(allD);
  const top = faixas ? 24 : 10, bottom = 26;
  const y = d3.scaleLinear([0, yMax ?? (d3.max(pts, (d) => d.v) || 1)], [H - bottom, top]).nice();
  const ticks = y.ticks(5);
  const ml = larguraTextos(svg, ticks.map(fy)) + 10;
  const mr = Math.min(larguraTextos(svg, series.map((s) => s.nome), 'cv-lbl') + 18, W * 0.32);
  const x = d3.scaleUtc([x0, x1 > x0 ? x1 : d3.utcDay.offset(x0, 7)], [ml, W - mr]);

  if (faixas) {
    const gf = svg.append('g');
    faixas.forEach(([a, b, nome], i) => {
      const da = d3.max([parse(a), x0]), db = d3.min([parse(b), x.domain()[1]]);
      if (db <= da) return;
      gf.append('rect').attr('x', x(da)).attr('y', top - 16).attr('width', Math.max(0, x(db) - x(da)))
        .attr('height', H - bottom - top + 16).style('fill', 'var(--cds-chart-muted)')
        .style('fill-opacity', i % 2 ? 0.14 : 0.05);
      if (x(db) - x(da) > larguraTextos(svg, [nome]) + 10) {
        gf.append('text').attr('x', x(da) + 6).attr('y', top - 4).text(nome);
      }
    });
  }

  const gy = svg.append('g');
  ticks.forEach((t) => {
    gy.append('line').attr('x1', ml).attr('x2', W - mr).attr('y1', y(t)).attr('y2', y(t))
      .style('stroke', 'var(--cds-chart-grid)').style('stroke-width', 1);
    gy.append('text').attr('x', ml - 8).attr('y', y(t)).attr('dy', '0.32em').attr('text-anchor', 'end').text(fy(t));
  });
  const nx = Math.max(2, Math.floor((W - ml - mr) / 90));
  svg.append('g').attr('transform', `translate(0,${H - bottom})`)
    .call(d3.axisBottom(x).ticks(nx).tickFormat(fMes).tickSizeOuter(0)).call(estiloEixo);

  const linha = d3.line().defined((d) => d.v != null).x((d) => x(d.d)).y((d) => y(d.v));
  series.forEach((s) => {
    svg.append('path').datum(s.pts).attr('d', linha).style('fill', 'none').style('stroke', s.cor)
      .style('stroke-width', 2).style('stroke-linecap', 'round').style('stroke-linejoin', 'round');
  });

  const fins = series.map((s) => {
    const u = [...s.pts].reverse().find((d) => d.v != null);
    return u ? { s, y: y(u.v), yd: y(u.v), xd: x(u.d) } : null;
  }).filter(Boolean).sort((a, b) => a.y - b.y);
  for (let i = 1; i < fins.length; i++) if (fins[i].y - fins[i - 1].y < 13) fins[i].y = fins[i - 1].y + 13;
  const passa = fins.length ? fins[fins.length - 1].y - (H - bottom) : 0;
  if (passa > 0) fins.forEach((f) => (f.y -= passa));
  fins.forEach((f) => {
    svg.append('circle').attr('cx', f.xd).attr('cy', f.yd).attr('r', 3).style('fill', f.s.cor);
    let nome = f.s.nome;
    const t = svg.append('text').attr('class', 'cv-lbl').attr('x', W - mr + 8).attr('y', f.y).attr('dy', '0.32em')
      .style('fill', f.s.cor).text(nome);
    while (nome.length > 3 && t.node().getComputedTextLength() > mr - 10) {
      nome = nome.slice(0, -2);
      t.text(nome + '…');
    }
  });

  const regua = svg.append('line').attr('y1', top).attr('y2', H - bottom).style('stroke', 'var(--cds-chart-reference)')
    .style('pointer-events', 'none').attr('visibility', 'hidden');
  const pontos = svg.append('g').style('pointer-events', 'none');
  const datas = [...new Set(allD.map((d) => +d))].sort(d3.ascending);
  const porData = series.map((s) => new Map(s.pts.map((d) => [+d.d, d.v])));
  const tip = dica(el);

  if (selecao) {
    const brush = d3.brushX().extent([[ml, top - 16], [W - mr, H - bottom]]).on('end', (ev) => {
      if (!ev.selection || !ev.sourceEvent) return;
      const [a, b] = ev.selection.map((v) => x.invert(v));
      d3.select(el).select('.cv-brush').call(brush.move, null);
      if (b - a < 14 * 864e5) return;
      dash.setParams({ inicio: isoDia(a), fim: isoDia(b) });
    });
    const gb = svg.append('g').attr('class', 'cv-brush').call(brush);
    gb.select('.selection').style('fill', 'var(--color-fg)').style('fill-opacity', 0.08).style('stroke', 'none');
    svg.on('dblclick', () => dash.setParams({ inicio: DEF.inicio, fim: DEF.fim }));
  }

  svg.on('pointermove', (ev) => {
    const [mx, my] = d3.pointer(ev, el);
    if (mx < ml || mx > W - mr) { tip.esconder(); regua.attr('visibility', 'hidden'); pontos.selectAll('*').remove(); return; }
    const alvo = +x.invert(mx);
    const i = d3.bisector((d) => d).center(datas, alvo);
    const dt = datas[i];
    regua.attr('x1', x(dt)).attr('x2', x(dt)).attr('visibility', 'visible');
    pontos.selectAll('*').remove();
    const linhasDica = [];
    series.forEach((s, k) => {
      const v = porData[k].get(dt);
      if (v == null) return;
      pontos.append('circle').attr('cx', x(dt)).attr('cy', y(v)).attr('r', 4).style('fill', s.cor)
        .style('stroke', 'var(--color-panel)').style('stroke-width', 1.5);
      linhasDica.push([series.length > 1 ? s.cor : null, s.nome, fv(v), v]);
    });
    linhasDica.sort((a, b) => b[3] - a[3]);
    tip.mostrar(mx, my - 20, 'Semana até ' + fDia(new Date(dt)), linhasDica);
  });
  svg.on('pointerleave', () => { tip.esconder(); regua.attr('visibility', 'hidden'); pontos.selectAll('*').remove(); });
}

// ---------- cálculos citáveis ----------
dash.calc('picos', {
  inputs: ['semanal'],
  title: 'Picos semanais do mundo',
  description: 'Semana com mais casos e semana com mais óbitos no agregado Mundo, e a última semana da série.',
  fn: (semanal) => {
    const mundo = semanal.filter((r) => r.iso === 'OWID_WRL');
    let mc = mundo[0], mo = mundo[0], ult = mundo[0];
    for (const r of mundo) {
      if (+r.casos > +mc.casos) mc = r;
      if (+r.obitos > +mo.obitos) mo = r;
      if (r.semana > ult.semana) ult = r;
    }
    return [{
      semana_pico_casos: mc.semana, pico_casos: +mc.casos,
      semana_pico_obitos: mo.semana, pico_obitos: +mo.obitos, ultima_semana: ult.semana,
    }];
  },
});

dash.calc('lider', {
  inputs: ['semanal', 'paises'],
  title: 'Maior mortalidade por milhão',
  description: 'País com mais de 1 milhão de habitantes com mais óbitos acumulados por milhão na sua última semana com dado.',
  fn: (semanal, paises) => {
    const grandes = new Map(paises.filter((c) => c.tipo === 'país' && +c.populacao >= 1000000).map((c) => [c.iso, c.nome]));
    const ult = new Map();
    for (const r of semanal) {
      if (!grandes.has(r.iso) || r.obitos_acum_pm == null || r.obitos_acum_pm === '') continue;
      const u = ult.get(r.iso);
      if (!u || r.semana > u.semana) ult.set(r.iso, r);
    }
    let melhor = null;
    for (const r of ult.values()) if (!melhor || +r.obitos_acum_pm > +melhor.obitos_acum_pm) melhor = r;
    return melhor ? [{ iso: melhor.iso, nome: grandes.get(melhor.iso), obitos_acum_pm: +melhor.obitos_acum_pm }] : [];
  },
});

// ---------- controles fixos ----------
document.querySelectorAll('[data-metrica]').forEach((b) => b.addEventListener('click', () => dash.setParams({ metrica: b.dataset.metrica })));
document.querySelectorAll('[data-escala]').forEach((b) => b.addEventListener('click', () => dash.setParams({ escala: b.dataset.escala })));
document.querySelectorAll('[data-eixo]').forEach((b) => b.addEventListener('click', () => dash.setParams({ eixo: b.dataset.eixo })));
document.querySelectorAll('.cv-continente').forEach((s) => s.addEventListener('change', () => dash.setParams({ continente: s.value || null })));
document.querySelectorAll('.cv-reset').forEach((b) => b.addEventListener('click', () => dash.resetParams()));
const datas = [['.cv-inicio', 'inicio'], ['.cv-fim', 'fim']];
datas.forEach(([sel, nome]) => document.querySelectorAll(sel).forEach((inp) => {
  inp.addEventListener('change', () => {
    if (inp.value && inp.validity.valid && inp.value >= inp.min && inp.value <= inp.max) dash.setParams({ [nome]: inp.value });
  });
  inp.addEventListener('blur', () => { inp.value = P()[nome]; });
}));

dash.onData(() => {
  const p = P();
  document.querySelectorAll('[data-metrica]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.metrica === p.metrica)));
  document.querySelectorAll('[data-escala]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.escala === p.escala));
    b.disabled = p.metrica === 'vacina';
  });
  document.querySelectorAll('[data-eixo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.eixo === p.eixo)));
  document.querySelectorAll('[data-m]').forEach((s) => {
    s.hidden = !(s.dataset.m === p.metrica && (!s.dataset.e || s.dataset.e === p.escala));
  });
  document.querySelectorAll('.cv-continente').forEach((s) => { s.value = p.continente ?? ''; });
  datas.forEach(([sel, nome]) => document.querySelectorAll(sel).forEach((inp) => {
    if (inp !== document.activeElement) inp.value = p[nome];
  }));
  document.querySelectorAll('[data-cont]').forEach((i) => { i.style.background = cor(+i.dataset.cont); });
});

// ---------- filtros que dependem dos dados ----------
function opcoesLocais(sel, excluir) {
  const pa = paises();
  const grupos = [['Mundo e regiões', (c) => c.tipo !== 'país'], ['Países', (c) => c.tipo === 'país']];
  for (const [rotulo, filtro] of grupos) {
    const og = document.createElement('optgroup');
    og.label = rotulo;
    [...pa.values()].filter(filtro).filter((c) => !excluir.includes(c.iso))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      .forEach((c) => og.appendChild(new Option(c.nome, c.iso)));
    sel.appendChild(og);
  }
}

dash.draw('foco', (sel) => {
  sel.replaceChildren();
  if (dash.data('paises').status !== 'ok') return;
  opcoesLocais(sel, []);
  sel.value = P().foco;
  sel.onchange = () => selecionar(sel.value);
});

dash.draw('adicionar', (sel) => {
  sel.replaceChildren();
  if (dash.data('paises').status !== 'ok') return;
  const p = P();
  sel.appendChild(new Option(p.comparar.length >= MAX_COMPARAR ? 'Limite de 8 locais' : '+ Adicionar local', ''));
  sel.disabled = p.comparar.length >= MAX_COMPARAR;
  opcoesLocais(sel, p.comparar);
  sel.value = '';
  sel.onchange = () => {
    if (sel.value) dash.setParams({ comparar: [...P().comparar, sel.value].slice(0, MAX_COMPARAR) });
  };
});

dash.draw('chips', (el) => {
  el.replaceChildren();
  if (dash.data('paises').status !== 'ok') return;
  const p = P();
  p.comparar.forEach((iso, i) => {
    const chip = document.createElement('span');
    chip.className = 'cv-chip';
    const bola = document.createElement('i');
    bola.style.background = cor(i);
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = '×';
    b.setAttribute('aria-label', 'Remover ' + nomeDe(iso));
    b.disabled = p.comparar.length <= 1;
    b.onclick = () => dash.setParams({ comparar: P().comparar.filter((c) => c !== iso) });
    chip.append(bola, nomeDe(iso), b);
    el.appendChild(chip);
  });
});

// ---------- números citados no texto ----------
function celula(el) {
  const r = dash.data(el.dataset.source);
  if (r.status !== 'ok') { el.textContent = '—'; return; }
  const pares = (el.dataset.where || '').split('&').filter(Boolean).map((s) => s.split('=').map(decodeURIComponent));
  const linha = r.data.find((x) => pares.every(([k, v]) => String(x[k]) === v));
  el.textContent = linha ? fmtCampo(el.dataset.field, num(linha[el.dataset.field])) : '—';
}
['mundo-casos', 'mundo-obitos', 'mundo-vac', 'pct', 'num'].forEach((n) => dash.draw(n, celula));

function textoCalc(el) {
  const r = dash.data(el.dataset.source);
  const linha = r.status === 'ok' && Array.isArray(r.data) ? r.data[0] : null;
  const k = el.dataset.k || el.dataset.field;
  if (!linha || linha[k] == null) { el.textContent = '—'; return; }
  const v = linha[k];
  if (k.startsWith('semana') || k === 'ultima_semana') el.textContent = fDiaLongo(parse(v));
  else if (typeof v === 'number') el.textContent = fInt(v);
  else el.textContent = v;
}
dash.draw('txt', textoCalc);
dash.draw('ultima-semana', textoCalc);

dash.draw('foco-nome', (el) => {
  if (dash.data('paises').status !== 'ok') { el.textContent = '—'; return; }
  const iso = P().foco;
  el.setAttribute('data-where', 'iso=' + encodeURIComponent(iso));
  el.textContent = nomeDe(iso);
});

// ---------- indicadores do país em foco ----------
dash.draw('kpi', (el) => {
  const S = semanal();
  if (!S) { el.textContent = '—'; return; }
  const p = P(), k = el.dataset.k;
  const r = ultimoAte(S.get(p.foco) || [], p.fim, k);
  if (!r) { el.removeAttribute('data-where'); el.textContent = '—'; return; }
  el.setAttribute('data-where', `iso=${encodeURIComponent(p.foco)}&semana=${r.semana}`);
  el.textContent = fmtCampo(k, r[k]);
});

dash.draw('spark', (el) => {
  el.replaceChildren();
  const S = semanal();
  if (!S) return;
  const p = P(), k = el.dataset.k;
  const a = noPeriodo(S.get(p.foco) || [], p).filter((r) => r[k] != null);
  if (a.length < 2) return;
  const W = Math.max(80, el.clientWidth), H = 36;
  const svg = novoSvg(el, W, H);
  const x = d3.scaleUtc(d3.extent(a, (r) => r.d), [2, W - 4]);
  const y = d3.scaleLinear([0, d3.max(a, (r) => r[k]) || 1], [H - 2, 4]);
  const c = cor(0);
  const id = 'cv-sp-' + ++seqId;
  const g = svg.append('defs').append('linearGradient').attr('id', id).attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
  [[0, 0.26], [0.25, 0.16], [0.5, 0.08], [0.75, 0.03], [1, 0]].forEach(([o, op]) => {
    g.append('stop').attr('offset', o).attr('style', `stop-color:${c};stop-opacity:${op}`);
  });
  svg.append('path').datum(a).attr('d', d3.area().x((r) => x(r.d)).y0(H - 2).y1((r) => y(r[k]))).style('fill', `url(#${id})`);
  svg.append('path').datum(a).attr('d', d3.line().x((r) => x(r.d)).y((r) => y(r[k]))).style('fill', 'none')
    .style('stroke', c).style('stroke-width', 1.5).style('stroke-linejoin', 'round').style('stroke-linecap', 'round');
  const u = a[a.length - 1];
  svg.append('circle').attr('cx', x(u.d)).attr('cy', y(u[k])).attr('r', 2.5).style('fill', c);
});

// ---------- gráficos ----------
dash.draw('ondas', (el) => {
  if (!pronto(el, ['semanal', 'paises'])) return;
  const p = P(), S = semanal(), k = campo(p, 'serie');
  const series = p.comparar.map((iso, i) => ({
    nome: nomeDe(iso), cor: cor(i), pts: noPeriodo(S.get(iso) || [], p).map((r) => ({ d: r.d, v: r[k] })),
  }));
  linhas(el, { series, fy: fmtEixo(p), fv: (v) => fmtValor(p, v), faixas: FAIXAS, selecao: true, yMax: MET[p.metrica].pct ? 100 : null });
});

dash.draw('letalidade', (el) => {
  if (!pronto(el, ['semanal', 'paises'])) return;
  const p = P(), S = semanal();
  const series = p.comparar.map((iso, i) => ({
    nome: nomeDe(iso), cor: cor(i), pts: noPeriodo(S.get(iso) || [], p).map((r) => ({ d: r.d, v: r.letalidade })),
  }));
  linhas(el, { series, fy: (v) => fInt(v) + '%', fv: (v) => f2(v) + '%' });
});

dash.draw('renda', (el) => {
  if (!pronto(el, ['semanal', 'paises'])) return;
  const p = P(), S = semanal();
  const series = RENDA.map((iso, i) => ({
    nome: nomeDe(iso), cor: cor(i), pts: noPeriodo(S.get(iso) || [], p).map((r) => ({ d: r.d, v: r.vac_completa })),
  }));
  linhas(el, { series, fy: (v) => fInt(v) + '%', fv: fPct, yMax: 100 });
});

dash.draw('ranking', (el) => {
  if (!pronto(el, ['semanal', 'paises'])) return;
  el.replaceChildren();
  const p = P(), S = semanal(), pa = paises();
  const dados = [...pa.values()]
    .filter((c) => c.tipo === 'país' && c.populacao >= POP_MIN && (!p.continente || c.continente === p.continente))
    .map((c) => {
      const a = S.get(c.iso) || [];
      let v = null;
      if (MET[p.metrica].pct) {
        v = ultimoAte(a, p.fim, 'vac_completa')?.vac_completa ?? null;
      } else {
        const k = campo(p, 'acum');
        const r1 = ultimoAte(a, p.fim, k), r0 = ultimoAntes(a, p.inicio, k);
        if (r1) v = r1[k] - (r0 ? r0[k] : 0);
      }
      return { iso: c.iso, nome: c.nome, v };
    })
    .filter((d) => d.v != null && isFinite(d.v) && d.v > 0)
    .sort((a, b) => b.v - a.v).slice(0, 15);
  if (!dados.length) { aviso(el, 'Sem dados para o recorte escolhido.'); return; }
  const W = Math.max(260, el.clientWidth), linhaH = 22;
  const H = Math.max(parseFloat(getComputedStyle(el).minHeight) || 300, dados.length * linhaH + 12);
  const svg = novoSvg(el, W, H);
  const mlMax = W * 0.42;
  const ml = Math.min(larguraTextos(svg, dados.map((d) => d.nome)) + 10, mlMax);
  const mr = larguraTextos(svg, dados.map((d) => fmtValor(p, d.v))) + 10;
  const x = d3.scaleLinear([0, d3.max(dados, (d) => d.v)], [ml, W - mr]);
  const y = d3.scaleBand(dados.map((d) => d.iso), [6, 6 + dados.length * linhaH]).padding(0.25);
  const base = cor(MET[p.metrica].cor);
  const tip = dica(el);
  const g = svg.selectAll('g.cv-row').data(dados).join('g').attr('class', 'cv-row cv-click')
    .on('click', (ev, d) => selecionar(d.iso))
    .on('pointermove', (ev, d) => {
      const [mx, my] = d3.pointer(ev, el);
      tip.mostrar(mx, my - 10, d.nome, [[null, 'Valor', fmtValor(p, d.v)]]);
    })
    .on('pointerleave', () => tip.esconder());
  g.append('rect').attr('x', ml).attr('y', (d) => y(d.iso)).attr('height', y.bandwidth())
    .attr('width', (d) => Math.max(1, x(d.v) - ml)).attr('rx', 3).style('fill', base)
    .style('fill-opacity', (d) => (d.iso === p.foco ? 1 : 0.55));
  g.append('text').attr('x', ml - 6).attr('y', (d) => y(d.iso) + y.bandwidth() / 2).attr('dy', '0.32em')
    .attr('text-anchor', 'end').attr('class', (d) => (d.iso === p.foco ? 'cv-lbl' : null))
    .text((d) => d.nome)
    .each(function (d) {
      let s = d.nome;
      while (s.length > 3 && this.getComputedTextLength() > ml - 8) { s = s.slice(0, -2); this.textContent = s + '…'; }
    });
  g.append('text').attr('x', (d) => x(d.v) + 4).attr('y', (d) => y(d.iso) + y.bandwidth() / 2).attr('dy', '0.32em')
    .text((d) => fmtValor(p, d.v));
});

const estadoMapa = new WeakMap();
dash.draw('mapa', (el) => {
  if (!pronto(el, ['semanal', 'paises', 'mapa'])) return;
  el.replaceChildren();
  const p = P(), S = semanal(), pa = paises(), geo = dash.data('mapa').data;
  const semanas = noPeriodo(S.get('OWID_WRL') || [], p).map((r) => r.semana);
  if (!semanas.length) { aviso(el, 'Sem dados para o recorte escolhido.'); return; }
  const st = estadoMapa.get(el) || { sem: null, timer: null };
  estadoMapa.set(el, st);
  st.semanas = semanas;
  if (!semanas.includes(st.sem)) st.sem = semanas[semanas.length - 1];
  const k = campo(p, 'acum');
  const c = cor(MET[p.metrica].cor);
  const linhaEm = (iso, sem) => {
    const a = S.get(iso);
    if (!a) return null;
    const i = d3.bisector((r) => r.semana).right(a, sem) - 1;
    return i >= 0 ? a[i][k] : null;
  };
  const ultima = semanas[semanas.length - 1];
  const vmax = d3.max([...pa.values()].filter((x) => x.tipo === 'país'), (x) => linhaEm(x.iso, ultima)) || 1;
  const op = d3.scaleSqrt([0, vmax], [0.08, 1]).clamp(true);

  const ctl = document.createElement('div');
  ctl.className = 'cv-map-ctl';
  const play = document.createElement('button');
  play.type = 'button';
  const faixa = document.createElement('input');
  faixa.type = 'range';
  faixa.min = 0;
  faixa.max = semanas.length - 1;
  faixa.setAttribute('aria-label', 'Semana exibida no mapa');
  const rot = document.createElement('span');
  ctl.append(play, faixa, rot);
  el.appendChild(ctl);

  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${MAPA_W} ${MAPA_H}`).attr('width', '100%')
    .attr('class', 'cv-anim').style('display', 'block');
  const tip = dica(el);
  const fora = (iso) => p.continente && pa.get(iso)?.continente !== p.continente;
  const paths = svg.selectAll('path').data(geo).join('path').attr('d', (d) => d.contorno)
    .style('stroke', 'var(--color-panel)').style('stroke-width', 0.6)
    .attr('class', (d) => (pa.has(d.iso) && !fora(d.iso) ? 'cv-click' : null))
    .on('click', (ev, d) => { if (pa.has(d.iso) && !fora(d.iso)) selecionar(d.iso); })
    .on('pointermove', (ev, d) => {
      const [mx, my] = d3.pointer(ev, el);
      const v = linhaEm(d.iso, st.sem);
      tip.mostrar(mx, my - 10, 'Semana até ' + fDia(parse(st.sem)), [[null, pa.get(d.iso)?.nome ?? 'Sem dados', fmtValor(p, v)]]);
    })
    .on('pointerleave', () => tip.esconder());
  const focado = svg.append('path').style('fill', 'none').style('stroke', 'var(--color-fg)').style('stroke-width', 1.6)
    .style('pointer-events', 'none').attr('d', geo.find((d) => d.iso === p.foco)?.contorno ?? null);

  const leg = document.createElement('div');
  leg.className = 'cv-map-ctl';
  el.appendChild(leg);
  const ls = d3.select(leg).append('svg').attr('width', 160).attr('height', 10);
  const gid = 'cv-mg-' + ++seqId;
  const lg = ls.append('defs').append('linearGradient').attr('id', gid);
  [0, 0.5, 1].forEach((o) => lg.append('stop').attr('offset', o).attr('style', `stop-color:${c};stop-opacity:${op(vmax * o * o)}`));
  ls.append('rect').attr('width', 160).attr('height', 10).attr('rx', 2).style('fill', `url(#${gid})`);
  const lMin = document.createElement('span');
  lMin.textContent = fmtValor(p, 0);
  const lMax = document.createElement('span');
  lMax.textContent = fmtValor(p, vmax);
  leg.prepend(lMin);
  leg.append(lMax);
  const semDado = document.createElement('span');
  semDado.textContent = 'Cinza: sem dado ou fora do continente escolhido';
  leg.append(semDado);

  st.render = () => {
    paths.style('fill', (d) => (linhaEm(d.iso, st.sem) != null && !fora(d.iso) ? c : 'var(--color-border-line)'))
      .style('fill-opacity', (d) => {
        const v = linhaEm(d.iso, st.sem);
        return v != null && !fora(d.iso) ? op(v) : 0.7;
      });
    faixa.value = st.semanas.indexOf(st.sem);
    rot.textContent = 'Semana até ' + fDia(parse(st.sem));
  };
  st.sync = () => {
    play.textContent = st.timer ? '❚❚ Pausar' : '▶ Animar';
    play.setAttribute('aria-label', st.timer ? 'Pausar animação' : 'Animar semana a semana');
  };
  faixa.oninput = () => { st.sem = st.semanas[+faixa.value]; st.render(); };
  play.onclick = () => {
    if (st.timer) { clearInterval(st.timer); st.timer = null; st.sync(); return; }
    if (st.semanas.indexOf(st.sem) >= st.semanas.length - 1) st.sem = st.semanas[0];
    st.timer = setInterval(() => {
      const i = st.semanas.indexOf(st.sem) + 1;
      if (!el.isConnected || i >= st.semanas.length) { clearInterval(st.timer); st.timer = null; st.sync(); return; }
      st.sem = st.semanas[i];
      st.render();
    }, 160);
    st.sync();
  };
  st.render();
  st.sync();
  focado.raise();
});

dash.draw('dispersao', (el) => {
  if (!pronto(el, ['semanal', 'paises'])) return;
  el.replaceChildren();
  const p = P(), S = semanal(), pa = paises();
  const ex = EIXOS[p.eixo] ? p.eixo : DEF.eixo;
  const dados = [...pa.values()].filter((c) => c.tipo === 'país' && c.populacao >= POP_MIN && CONTS.includes(c.continente))
    .map((c) => ({ c, x: c[ex], y: ultimoAte(S.get(c.iso) || [], p.fim, 'obitos_acum_pm')?.obitos_acum_pm ?? null }))
    .filter((d) => d.x != null && d.y != null && (ex !== 'pib_pc' || d.x > 0))
    .sort((a, b) => b.c.populacao - a.c.populacao);
  if (!dados.length) { aviso(el, 'Sem dados para o recorte escolhido.'); return; }
  const W = Math.max(280, el.clientWidth), H = parseFloat(getComputedStyle(el).minHeight) || 300;
  const svg = novoSvg(el, W, H);
  const y = d3.scaleLinear([0, d3.max(dados, (d) => d.y)], [H - 44, 12]).nice();
  const yt = y.ticks(5);
  const ml = larguraTextos(svg, yt.map((v) => (v >= 1000 ? fC(v) : fInt(v)))) + 26;
  const mr = 14;
  const x = ex === 'pib_pc'
    ? d3.scaleLog(d3.extent(dados, (d) => d.x), [ml, W - mr]).nice()
    : d3.scaleLinear(d3.extent(dados, (d) => d.x), [ml, W - mr]).nice();
  const r = d3.scaleSqrt([0, d3.max(dados, (d) => d.c.populacao)], [2.5, Math.min(24, W / 30)]);
  yt.forEach((t) => {
    svg.append('line').attr('x1', ml).attr('x2', W - mr).attr('y1', y(t)).attr('y2', y(t)).style('stroke', 'var(--cds-chart-grid)');
    svg.append('text').attr('x', ml - 8).attr('y', y(t)).attr('dy', '0.32em').attr('text-anchor', 'end').text(t >= 1000 ? fC(t) : fInt(t));
  });
  const nx = Math.max(2, Math.floor((W - ml - mr) / 80));
  const fx = ex === 'pib_pc' ? (v) => fC(v) : ex === 'idh' ? L.format('.2f') : (v) => fInt(v);
  const ax = d3.axisBottom(x).tickSizeOuter(0);
  if (ex === 'pib_pc') ax.ticks(nx, '~s').tickFormat((v) => ([1, 2, 5].includes(+String(v)[0]) ? fx(v) : ''));
  else ax.ticks(nx).tickFormat(fx);
  svg.append('g').attr('transform', `translate(0,${H - 44})`).call(ax).call(estiloEixo);
  svg.append('text').attr('x', (ml + W - mr) / 2).attr('y', H - 8).attr('text-anchor', 'middle').text(EIXOS[ex]);
  svg.append('text').attr('transform', `translate(10,${(H - 44 + 12) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text('óbitos por milhão');
  const tip = dica(el);
  const fora = (d) => p.continente && d.c.continente !== p.continente;
  svg.append('g').selectAll('circle').data(dados).join('circle')
    .attr('class', 'cv-click').attr('cx', (d) => x(d.x)).attr('cy', (d) => y(d.y)).attr('r', (d) => r(d.c.populacao))
    .style('fill', (d) => cor(CONTS.indexOf(d.c.continente)))
    .style('fill-opacity', (d) => (fora(d) ? 0.08 : 0.62))
    .style('stroke', (d) => (d.c.iso === p.foco ? 'var(--color-fg)' : 'var(--color-panel)'))
    .style('stroke-width', (d) => (d.c.iso === p.foco ? 2 : 0.8))
    .on('click', (ev, d) => selecionar(d.c.iso))
    .on('pointermove', (ev, d) => {
      const [mx, my] = d3.pointer(ev, el);
      tip.mostrar(mx, my - 10, d.c.nome, [
        [null, 'Óbitos por milhão', fInt(d.y)],
        [null, EIXOS[ex].replace(' (US$ PPC, escala log)', ' (US$)'), ex === 'idh' ? L.format('.3f')(d.x) : fInt(d.x)],
        [null, 'População', fC(d.c.populacao)],
      ]);
    })
    .on('pointerleave', () => tip.esconder());
  const f = dados.find((d) => d.c.iso === p.foco);
  if (f) {
    const lx = x(f.x), ly = y(f.y) - r(f.c.populacao) - 6;
    svg.append('text').attr('class', 'cv-lbl').attr('x', Math.min(Math.max(lx, ml + 30), W - mr - 30)).attr('y', Math.max(ly, 12))
      .attr('text-anchor', 'middle').style('pointer-events', 'none').text(f.c.nome);
  }
});

dash.draw('rigor', (el) => {
  if (!pronto(el, ['semanal', 'paises'])) return;
  el.replaceChildren();
  const p = P(), S = semanal();
  const a = noPeriodo(S.get(p.foco) || [], p);
  if (!a.some((r) => r.casos_pm != null)) { aviso(el, 'Sem dados de casos para este local no período.'); return; }
  const W = Math.max(280, el.clientWidth), H = parseFloat(getComputedStyle(el).minHeight) || 300;
  const svg = novoSvg(el, W, H);
  const top = 22, bottom = 26;
  const y = d3.scaleLinear([0, d3.max(a, (r) => r.casos_pm) || 1], [H - bottom, top]).nice();
  const y2 = d3.scaleLinear([0, 100], [H - bottom, top]);
  const yt = y.ticks(5);
  const ml = larguraTextos(svg, yt.map((v) => (v >= 1000 ? fC(v) : fInt(v)))) + 10;
  const mr = larguraTextos(svg, ['100']) + 12;
  const x = d3.scaleBand(a.map((r) => r.semana), [ml, W - mr]).padding(0.18);
  const xt = d3.scaleUtc([a[0].d, a[a.length - 1].d], [ml + x.bandwidth() / 2, W - mr - x.bandwidth() / 2]);
  yt.forEach((t) => {
    svg.append('line').attr('x1', ml).attr('x2', W - mr).attr('y1', y(t)).attr('y2', y(t)).style('stroke', 'var(--cds-chart-grid)');
    svg.append('text').attr('x', ml - 8).attr('y', y(t)).attr('dy', '0.32em').attr('text-anchor', 'end').text(t >= 1000 ? fC(t) : fInt(t));
  });
  [0, 50, 100].forEach((t) => svg.append('text').attr('x', W - mr + 6).attr('y', y2(t)).attr('dy', '0.32em').text(fInt(t)));
  svg.append('g').attr('transform', `translate(0,${H - bottom})`)
    .call(d3.axisBottom(xt).ticks(Math.max(2, Math.floor((W - ml - mr) / 90))).tickFormat(fMes).tickSizeOuter(0)).call(estiloEixo);
  const ci = cor(0), cr = cor(3);
  svg.append('g').selectAll('rect').data(a.filter((r) => r.casos_pm != null)).join('rect')
    .attr('x', (r) => x(r.semana)).attr('width', x.bandwidth()).attr('y', (r) => y(r.casos_pm))
    .attr('height', (r) => Math.max(0, y(0) - y(r.casos_pm))).attr('rx', Math.min(2, x.bandwidth() / 2))
    .style('fill', ci).style('fill-opacity', 0.55);
  svg.append('path').datum(a).attr('d', d3.line().defined((r) => r.rigor != null).x((r) => x(r.semana) + x.bandwidth() / 2).y((r) => y2(r.rigor)))
    .style('fill', 'none').style('stroke', cr).style('stroke-width', 2).style('stroke-linejoin', 'round').style('stroke-linecap', 'round');
  svg.append('text').attr('class', 'cv-lbl').attr('x', ml).attr('y', 12).text(nomeDe(p.foco));
  const tip = dica(el);
  const marca = svg.append('rect').style('fill', 'none').style('stroke', 'var(--color-fg)').style('pointer-events', 'none').attr('visibility', 'hidden');
  svg.on('pointermove', (ev) => {
    const [mx, my] = d3.pointer(ev, el);
    const i = Math.floor((mx - ml) / x.step());
    const r = a[i];
    if (!r || mx < ml || mx > W - mr) { tip.esconder(); marca.attr('visibility', 'hidden'); return; }
    marca.attr('x', x(r.semana)).attr('width', x.bandwidth()).attr('y', top).attr('height', H - bottom - top).attr('visibility', 'visible');
    tip.mostrar(mx, my - 20, 'Semana até ' + fDia(r.d), [
      [ci, 'Casos por milhão', r.casos_pm == null ? '—' : f1(r.casos_pm)],
      [cr, 'Índice de rigor', r.rigor == null ? '—' : f1(r.rigor)],
    ]);
  });
  svg.on('pointerleave', () => { tip.esconder(); marca.attr('visibility', 'hidden'); });
});
