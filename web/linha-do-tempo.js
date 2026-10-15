// Linha do tempo (RF-17): pequenos múltiplos por edição + faixa rolável com marcos e vencedoras por categoria.
import * as M from "./metricas.js";
import { $, fmt, fmtPct, nPequeno, esc, css, largura, estilo, tabela, vazio, CATEGORIAS, desenhar } from "./ui.js";

const INDICADORES = [
  { k: "pctMulheres", n: "mulheres", t: "total", rot: "Mulheres", cor: "--s1" },
  { k: "pctNegras", n: "negras", t: "total", rot: "Negras (piso)", cor: "--s2" },
  { k: "pctSudeste", n: "sudeste", t: "comUF", rot: "Nascidas no Sudeste", cor: "--s3" },
];
const ROT_REGIME = { "2010–2017 pódio": "pódio 1º–3º", "2018 transição": "transição", "2019–2025 vencedor único": "vencedor único" };

export function renderLinhaDoTempo(L, { D, ANOS, estado }) {
  const el = $("#g-tempo-multiplos");
  const e = M.porEdicao(L);
  const anosVis = ANOS.filter((a) => a >= estado.anoIni && a <= estado.anoFim);
  if (!e.length) { vazio(el); $("#tempo-trilho").innerHTML = ""; tabela($("#t-tempo"), [], []); return; }
  const longo = e.flatMap((x) => INDICADORES.map((i) => ({ ano: x.ano, indicador: i.rot, pct: x[i.k], n: x[i.n], total: x[i.t] })));
  const marcos = M.MARCOS.filter((m) => anosVis.includes(m.ano));
  const estreito = largura(el) < 640;
  desenhar(el, Plot.plot({
    width: largura(el), height: estreito ? 520 : 230, marginTop: 28, marginRight: estreito ? 28 : undefined, marginBottom: 34, style: estilo(),
    ariaLabel: "Composição da lista por edição: mulheres, negras (piso) e nascidas no Sudeste",
    fx: estreito ? undefined : { domain: INDICADORES.map((i) => i.rot), label: null, padding: 0.12 },
    fy: estreito ? { domain: INDICADORES.map((i) => i.rot), label: null, axis: null } : undefined,
    x: { domain: [anosVis[0], anosVis.at(-1)], tickFormat: "d", ticks: 4, label: null },
    y: { domain: [0, 100], grid: true, label: "%", ticks: 4 },
    color: { domain: INDICADORES.map((i) => i.rot), range: INDICADORES.map((i) => css(i.cor)) },
    marks: [
      Plot.ruleX(marcos, { x: "ano", stroke: css("--grade"), strokeDasharray: "3,3" }),
      Plot.areaY(longo, { x: "ano", y: "pct", [estreito ? "fy" : "fx"]: "indicador", fill: "indicador", fillOpacity: 0.12, curve: "monotone-x" }),
      Plot.lineY(longo, { x: "ano", y: "pct", [estreito ? "fy" : "fx"]: "indicador", stroke: "indicador", strokeWidth: 2, curve: "monotone-x" }),
      Plot.dot(longo, { x: "ano", y: "pct", [estreito ? "fy" : "fx"]: "indicador", fill: "indicador", r: 3, stroke: css("--superficie"), strokeWidth: 1.5,
        channels: { n: "n", Total: (d) => `${d.total}${nPequeno(d.total)}` }, tip: { format: { fill: false, fx: false, fy: false, y: (v) => fmtPct(v), x: (v) => String(v) } } }),
      // Em tela estreita os painéis empilham e o nome do indicador vai para dentro de cada um (o eixo lateral seria cortado).
      ...(estreito ? [Plot.text(INDICADORES, { fy: "rot", text: "rot", frameAnchor: "top-left", dx: 4, dy: 2, fill: css("--tinta"), fontWeight: 600, fontSize: 12 })] : []),
      Plot.text(longo, Plot.selectLast({ x: "ano", y: "pct", [estreito ? "fy" : "fx"]: "indicador", text: (d) => fmtPct(d.pct), dy: -10, fill: css("--tinta-2"), fontSize: 11 })),
    ],
  }));
  tabela($("#t-tempo"), longo, [{ rot: "Edição", k: "ano" }, { rot: "Indicador", k: "indicador" }, { rot: "n", k: "n", num: true },
    { rot: "Base", k: "total", num: true }, { rot: "%", f: (d) => fmtPct(d.pct) + nPequeno(d.total), num: true }]);

  const porAno = new Map(e.map((x) => [x.ano, x]));
  const venc = M.vencedorasPorAno(L, CATEGORIAS);
  const regime = new Map(D.regimes.map((r) => [r.ano, r.regime]));
  const barra = (x, i) => {
    const v = x[i.k];
    return `<div class="mini-barra" title="${esc(i.rot)}: ${x[i.n]} de ${x[i.t]}"><span>${esc(i.rot)}</span>
      <span class="trilha"><i style="width:${v ?? 0}%;background:${css(i.cor)}"></i></span><span class="v">${fmtPct(v)}</span></div>`;
  };
  $("#tempo-trilho").innerHTML = anosVis.map((ano) => {
    const x = porAno.get(ano);
    const m = M.MARCOS.filter((mm) => mm.ano === ano);
    const vs = venc.filter((o) => o.ano === ano);
    return `<li><div class="tempo-ano"><b>${ano}</b><span class="tempo-regime">${esc(ROT_REGIME[regime.get(ano)] ?? "")}</span></div>
      ${m.map((mm) => `<div class="tempo-marco">${esc(mm.texto)}</div>`).join("")}
      ${x ? `<div class="mini-barras">${INDICADORES.map((i) => barra(x, i)).join("")}<span class="muted pequeno">${fmt(x.total)} participações na lista</span></div>` : `<p class="muted">Sem dados no recorte.</p>`}
      ${vs.length ? `<ul class="vencedoras">${vs.map((o) => `<li><span class="cat">${esc(o.categoria)}</span><span class="titulo">${esc(o.titulo)}</span><br>
        <span class="chips">${o.pessoas.map((p) => `<button type="button" class="link-pessoa" data-pessoa="${esc(p.id)}">${esc(p.nome)}</button>`).join("")}</span>
        ${o.editora ? `<span class="muted"> · ${esc(o.editora)}</span>` : ""}</li>`).join("")}</ul>` : ""}</li>`;
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
