// Linha do tempo (RF-17): pequenos múltiplos por edição + faixa rolável com marcos e vencedoras por categoria.
// Com vários prêmios no recorte (CA-26.9, CA-26.10), cada prêmio tem a sua linha de painéis e o seu bloco em cada ano.
import * as M from "./metricas.js";
import { $, fmt, fmtPct, nPequeno, esc, css, largura, estilo, tabela, vazio, CATEGORIAS, PREMIOS, NOME_PREMIO, desenhar } from "./ui.js";

const INDICADORES = [
  { k: "pctMulheres", n: "mulheres", t: "total", rot: "Mulheres", cor: "--s1" },
  { k: "pctNegras", n: "negras", t: "total", rot: "Negras (piso)", cor: "--s2" },
  { k: "pctSudeste", n: "sudeste", t: "comUF", rot: "Nascidas no Sudeste", cor: "--s3" },
];
// Rótulo curto do regime no cartão do ano; regime sem rótulo curto aparece como veio dos dados.
const ROT_REGIME = { "1959–1992 vencedor por categoria": "vencedor único", "1993–2009 pódio": "pódio 1º–3º", "2010–2017 pódio": "pódio 1º–3º", "2018 transição": "transição", "2019–2025 vencedor único": "vencedor único" };

export function renderLinhaDoTempo(L, { D, ANOS, estado, semLista: SEM_LISTA }) {
  // Edição sem lista pública (Jabuti 1959–1999, CA-25.3): as participações são só dos premiados. Chave "<prêmio>|<ano>".
  const semLista = (p, a) => SEM_LISTA.has(`${p}|${a}`);
  const el = $("#g-tempo-multiplos");
  const ps = [...M.porPremio(L, PREMIOS).keys()], multi = ps.length > 1;
  const nome = (p) => NOME_PREMIO[p] ?? p;
  const e = M.facetar(L, M.porEdicao, PREMIOS, NOME_PREMIO);
  const anosVis = ANOS.filter((a) => a >= estado.anoIni && a <= estado.anoFim);
  if (!e.length) { vazio(el); $("#tempo-trilho").innerHTML = ""; tabela($("#t-tempo"), [], []); return; }
  const longo = e.flatMap((x) => INDICADORES.map((i) => ({ ano: x.ano, premio_nome: x.premio_nome, indicador: i.rot, pct: x[i.k], n: x[i.n], total: x[i.t] })));
  const estreito = largura(el) < 640;
  // Facetas: indicador nas colunas (ou empilhado no celular) e, com vários prêmios, um prêmio por linha.
  const fyRot = (d) => (estreito ? (multi ? `${d.premio_nome} · ${d.indicador}` : d.indicador) : d.premio_nome);
  const dominioFy = estreito ? ps.flatMap((p) => INDICADORES.map((i) => (multi ? `${nome(p)} · ${i.rot}` : i.rot))) : ps.map(nome);
  const temFy = estreito || multi;
  const canais = { ...(estreito ? {} : { fx: "indicador" }), ...(temFy ? { fy: fyRot } : {}) };
  // Marcos só dos prêmios do recorte, repetidos em cada painel do próprio prêmio.
  const marcos = M.marcosDe(ps, PREMIOS[0], D.premios ?? []).filter((m) => anosVis.includes(m.ano))
    .flatMap((m) => INDICADORES.map((i) => ({ ano: m.ano, premio_nome: nome(m.premio), indicador: i.rot })));
  const paineis = estreito ? dominioFy.length : multi ? ps.length : 1;
  desenhar(el, Plot.plot({
    width: largura(el), height: estreito ? 40 + paineis * 160 : 30 + paineis * 200, marginTop: 28, marginRight: estreito ? 28 : multi ? 110 : undefined, marginBottom: 34, style: estilo(),
    ariaLabel: `Composição da lista por edição: mulheres, negras (piso) e nascidas no Sudeste${multi ? `, um painel por prêmio (${ps.length})` : ""}`,
    fx: estreito ? undefined : { domain: INDICADORES.map((i) => i.rot), label: null, padding: 0.12 },
    fy: temFy ? { domain: dominioFy, label: null, axis: estreito ? null : "right" } : undefined,
    x: { domain: [anosVis[0], anosVis.at(-1)], tickFormat: "d", ticks: 4, label: null },
    y: { domain: [0, 100], grid: true, label: "%", ticks: 4 },
    color: { domain: INDICADORES.map((i) => i.rot), range: INDICADORES.map((i) => css(i.cor)) },
    marks: [
      Plot.ruleX(marcos, { x: "ano", ...canais, stroke: css("--grade"), strokeDasharray: "3,3" }),
      Plot.areaY(longo, { x: "ano", y: "pct", ...canais, z: "indicador", fill: "indicador", fillOpacity: 0.12, curve: "monotone-x" }),
      Plot.lineY(longo, { x: "ano", y: "pct", ...canais, z: "indicador", stroke: "indicador", strokeWidth: 2, curve: "monotone-x" }),
      Plot.dot(longo, { x: "ano", y: "pct", ...canais, fill: "indicador", r: 3, stroke: css("--superficie"), strokeWidth: 1.5,
        channels: { ...(multi ? { Prêmio: "premio_nome" } : {}), n: "n", Total: (d) => `${d.total}${nPequeno(d.total)}` },
        tip: { format: { fill: false, fx: false, fy: false, y: (v) => fmtPct(v), x: (v) => String(v) } } }),
      // Em tela estreita os painéis empilham e o nome do painel vai para dentro de cada um (o eixo lateral seria cortado).
      ...(estreito ? [Plot.text(dominioFy, { fy: (d) => d, text: (d) => d, frameAnchor: "top-left", dx: 4, dy: 2, fill: css("--tinta"), fontWeight: 600, fontSize: 12 })] : []),
      Plot.text(longo, Plot.selectLast({ x: "ano", y: "pct", ...canais, z: (d) => `${d.premio_nome}|${d.indicador}`, text: (d) => fmtPct(d.pct), dy: -10, fill: css("--tinta-2"), fontSize: 11 })),
    ],
  }));
  tabela($("#t-tempo"), longo, [...(multi ? [{ rot: "Prêmio", k: "premio_nome" }] : []), { rot: "Edição", k: "ano" }, { rot: "Indicador", k: "indicador" },
    { rot: "n", k: "n", num: true }, { rot: "Base", k: "total", num: true }, { rot: "%", f: (d) => fmtPct(d.pct) + nPequeno(d.total), num: true }]);

  const porAno = new Map(e.map((x) => [`${x.premio}|${x.ano}`, x]));
  const venc = M.vencedorasPorAno(L, CATEGORIAS);
  // Regime de cada edição de cada prêmio (D31); D.edicoes omite o prêmio padrão.
  const regime = new Map(D.edicoes.map((r) => [`${r.premio ?? PREMIOS[0]}|${r.ano}`, r.regime]));
  const barra = (x, i) => {
    const v = x[i.k];
    return `<div class="mini-barra" title="${esc(i.rot)}: ${x[i.n]} de ${x[i.t]}"><span>${esc(i.rot)}</span>
      <span class="trilha"><i style="width:${v ?? 0}%;background:${css(i.cor)}"></i></span><span class="v">${fmtPct(v)}</span></div>`;
  };
  // Bloco de um prêmio num ano: marcos, composição da lista e vencedoras por categoria.
  const bloco = (p, ano) => {
    const x = porAno.get(`${p}|${ano}`), reg = regime.get(`${p}|${ano}`);
    const m = M.marcosDe([p], PREMIOS[0], D.premios ?? []).filter((mm) => mm.ano === ano);
    const vs = venc.filter((o) => o.ano === ano && o.premio === p);
    return `${multi ? `<div class="tempo-premio">${esc(nome(p))}${reg ? ` <span class="tempo-regime">${esc(ROT_REGIME[reg] ?? reg)}</span>` : ""}</div>` : ""}
      ${m.map((mm) => `<div class="tempo-marco">${esc(mm.texto)}</div>`).join("")}
      ${x ? `<div class="mini-barras">${INDICADORES.map((i) => barra(x, i)).join("")}<span class="muted pequeno">${fmt(x.total)} ${semLista(p, ano) ? "participações de premiados (sem lista pública)" : "participações na lista"}</span></div>` : `<p class="muted">Sem dados no recorte.</p>`}
      ${vs.length ? `<ul class="vencedoras">${vs.map((o) => `<li><span class="cat">${esc(o.categoria)}</span><a class="titulo" href="#/obra/${esc(o.obra_id)}">${esc(o.titulo)}</a><br>
        <span class="chips">${o.pessoas.map((pp) => `<button type="button" class="link-pessoa" data-pessoa="${esc(pp.id)}">${esc(pp.nome)}</button>`).join("")}</span>
        ${o.editora ? `<span class="muted"> · ${esc(o.editora)}</span>` : ""}</li>`).join("")}</ul>` : ""}`;
  };
  $("#tempo-trilho").innerHTML = anosVis.map((ano) => {
    // Com vários prêmios, o ano mostra só os prêmios que tiveram edição nele.
    const doAno = multi ? ps.filter((p) => porAno.has(`${p}|${ano}`) || regime.has(`${p}|${ano}`)) : ps;
    const reg = multi ? "" : regime.get(`${ps[0]}|${ano}`);
    return `<li><div class="tempo-ano"><b>${ano}</b><span class="tempo-regime">${esc(ROT_REGIME[reg] ?? reg ?? "")}</span></div>
      ${(doAno.length ? doAno : ps.slice(0, 1)).map((p) => bloco(p, ano)).join("")}</li>`;
  }).join("");
}

export function montarTrilho(abrirPerfil) {
  const t = $("#tempo-trilho");
  t.addEventListener("click", (e) => { const b = e.target.closest("[data-pessoa]"); if (b) abrirPerfil(b.dataset.pessoa); });
  document.querySelectorAll(".tempo-seta").forEach((b) => b.addEventListener("click", () => {
    t.scrollBy({ left: +b.dataset.dir * (t.firstElementChild?.offsetWidth ?? 300) * 1.05, behavior: "smooth" });
  }));
  t.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); t.scrollBy({ left: (e.key === "ArrowRight" ? 1 : -1) * 300, behavior: "smooth" }); }
  });
}
