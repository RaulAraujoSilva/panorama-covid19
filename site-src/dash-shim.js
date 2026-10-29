// Implementação mínima da API `dash` do tipo Dashboard, para servir o painel como site estático.
// Cobre o que dashboard/app.js usa: data, onData, draw, calc, params, setParams, resetParams, colors, setLink.
window.dash = (() => {
  const FONTES = {
    semanal: { url: 'data/semanal.csv', tipo: 'csv' },
    paises: { url: 'data/paises.csv', tipo: 'csv' },
    mapa: { url: 'data/mapa.json', tipo: 'json' },
  };
  const PADRAO = {
    foco: 'BRA', comparar: ['BRA', 'USA', 'IND', 'GBR', 'OWID_WRL'], metrica: 'casos', escala: 'pm',
    continente: null, inicio: '2020-01-25', fim: '2022-03-05', eixo: 'idosos65',
  };

  const estado = {};
  const calcs = {};
  const desenhos = new Map();
  const ouvintes = [];
  let params = structuredClone(PADRAO);
  let agendado = false;

  function carregar(id) {
    if (estado[id]) return;
    estado[id] = { status: 'loading', data: [] };
    const f = FONTES[id];
    if (!f) { estado[id] = { status: 'missing', data: [] }; return; }
    fetch(f.url)
      .then((r) => { if (!r.ok) throw new Error(r.status + ' ' + r.statusText); return r.text(); })
      .then((t) => {
        const data = f.tipo === 'csv' ? d3.csvParse(t) : JSON.parse(t);
        estado[id] = { status: 'ok', data, columns: data.columns || Object.keys(data[0] || {}) };
        agendar();
      })
      .catch((e) => { estado[id] = { status: 'error', data: [], message: String(e) }; agendar(); });
  }

  function data(id) {
    const c = calcs[id];
    if (c) {
      const ins = c.inputs.map(data);
      if (!ins.every((r) => r.status === 'ok')) {
        const erro = ins.find((r) => r.status === 'error');
        return { status: erro ? 'error' : 'loading', data: [] };
      }
      if (!c.memo || c.memo.ins.some((d, i) => d !== ins[i].data)) {
        try {
          c.memo = { ins: ins.map((r) => r.data), out: { status: 'ok', data: c.fn(...ins.map((r) => r.data)) } };
        } catch (e) {
          c.memo = { ins: ins.map((r) => r.data), out: { status: 'error', data: [], message: String(e) } };
        }
      }
      return c.memo.out;
    }
    carregar(id);
    return estado[id];
  }

  function rodarDesenho(nome, el) {
    if (el.closest('[hidden]')) return;
    try { desenhos.get(nome)(el); } catch (e) { console.error('desenho', nome, e); }
  }

  const tamanhos = new WeakMap();
  const observador = new ResizeObserver((itens) => {
    for (const it of itens) {
      const el = it.target, w = Math.round(it.contentRect.width);
      if (tamanhos.get(el) === w) continue;
      const antes = tamanhos.has(el);
      tamanhos.set(el, w);
      if (antes) rodarDesenho(el.dataset.draw, el);
    }
  });

  function rodarTudo() {
    agendado = false;
    for (const fn of ouvintes) { try { fn(); } catch (e) { console.error('onData', e); } }
    for (const nome of desenhos.keys()) {
      document.querySelectorAll(`[data-draw="${CSS.escape(nome)}"]`).forEach((el) => {
        if (!tamanhos.has(el)) observador.observe(el);
        rodarDesenho(nome, el);
      });
    }
  }

  function agendar() {
    if (agendado) return;
    agendado = true;
    setTimeout(rodarTudo, 0); // rAF não dispara em aba de fundo
  }

  return {
    data,
    onData(fn) { ouvintes.push(fn); agendar(); },
    draw(nome, fn) {
      if (typeof fn === 'function') desenhos.set(nome, fn);
      agendar();
    },
    calc(id, def) { calcs[id] = { inputs: def.inputs, fn: def.fn }; },
    loader() {},
    params() { return structuredClone(params); },
    setParams(novos) {
      for (const [k, v] of Object.entries(novos)) {
        if (v === null || v === undefined) delete params[k];
        else params[k] = v;
      }
      agendar();
    },
    resetParams() { params = structuredClone(PADRAO); agendar(); },
    refresh() { agendar(); },
    setLink(nome) { history.replaceState(null, '', '#' + nome); },
    colors: Array.from({ length: 8 }, (_, i) => `var(--dash-c${i + 1})`),
  };
})();
