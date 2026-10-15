// Explorador: panorama e análises (RF-03 a RF-10). Cada função recebe as linhas filtradas e o contexto do painel.
import * as M from "./metricas.js";
import { $, fmt, fmtPct, nPequeno, esc, rotulo, css, largura, estilo, cores, textoSobre, tabela, desenhar, vazio, dica, CATEGORIAS, astGenero } from "./ui.js";

export function renderPanorama(L) {
  const k = M.kpis(L);
  const cartao = (rot, val, det = "") => `<div class="kpi"><div class="rot">${rot}</div><div class="val">${val}</div><div class="det">${det}</div></div>`;
  $("#kpis").innerHTML = [
    cartao("Pessoas", fmt(k.pessoas), `${fmt(k.indicacoes)} indicações · ${fmt(k.obras)} obras`),
    cartao("Mulheres", fmtPct(k.pctMulheres) + astGenero(k.generoAtribuido), `${fmt(k.mulheres)} de ${fmt(k.pessoas)} pessoas`),
    cartao("Pessoas negras", k.pessoas ? `≥ ${fmtPct(k.pctNegrasPiso)}` : "–", `pelo menos ${fmt(k.negras)}; piso por autodeclaração`),
    cartao("Cobertura de raça", fmtPct(k.pctCoberturaRaca), `${fmt(k.comRaca)} com declaração pública` +
      (k.buscaParcial ? `; busca incompleta para ${fmt(k.buscaParcial)} (o piso pode subir)` : "")),
    cartao("Estados de nascimento", `${fmt(k.ufs)} <small>de 27</small>`, "UFs distintas"),
    cartao("Editoras", fmt(k.editoras), "com obras no recorte"),
  ].join("");
}

export function renderEvolucao(L, { ANOS, estado }) {
  const el = $("#g-evolucao"), dim = $("#evo-dim").value, etapa = $("#evo-etapa").value;
  const dados = M.composicao(L, dim, etapa);
  const anosVis = ANOS.filter((a) => a >= estado.anoIni && a <= estado.anoFim);
  const comDados = new Set(dados.map((d) => d.ano));
  const lacunas = anosVis.filter((a) => !comDados.has(a));
  const marcos = M.MARCOS.filter((m) => anosVis.includes(m.ano));
  if (!dados.length) return vazio(el), tabela($("#t-evolucao"), [], []);
  const folga = Math.max(2, ((largura(el) - 60) / anosVis.length - 26) / 2); // barra com no máximo 26px
  desenhar(el, Plot.plot({
    width: largura(el), height: 360, marginTop: 36, style: estilo(),
    ariaLabel: "Composição por edição em barras 100% empilhadas",
    x: { domain: anosVis, label: null, tickFormat: (d) => (anosVis.length > 10 && d % 2 ? "" : String(d)) },
    y: { label: "% das participações", grid: true, domain: [0, 100] },
    color: { ...cores(dim), legend: true, tickFormat: rotulo },
    marks: [
      Plot.ruleX(marcos, { x: "ano", stroke: css("--eixo"), strokeWidth: 1 }),
      ...[0, 1].map((par) => Plot.text(marcos.filter((_, i) => i % 2 === par), { x: "ano", text: "texto", frameAnchor: "top", dy: par ? -8 : -22, fill: css("--tinta-2"), fontSize: 11 })),
      Plot.barY(dados, Plot.stackY({ order: M.ORDEM[dim] }, {
        x: "ano", y: "pct", fill: "grupo", insetTop: 1, insetBottom: 1, insetLeft: folga, insetRight: folga, rx: 3,
        channels: { Grupo: (d) => rotulo(d.grupo), Participações: "n", Total: "total" },
        tip: { format: { fill: false, x: true, y: (v) => fmtPct(v) } },
      })),
      Plot.text(lacunas, { x: (d) => d, y: 50, text: () => "sem dados", rotate: -90, fill: css("--muted"), fontSize: 11 }),
      Plot.ruleY([0], { stroke: css("--eixo") }),
    ],
  }));
  tabela($("#t-evolucao"), dados, [
    { rot: "Edição", k: "ano" }, { rot: "Grupo", f: (d) => rotulo(d.grupo) }, { rot: "n", k: "n", num: true },
    { rot: "Total", k: "total", num: true }, { rot: "%", f: (d) => fmtPct(d.pct) + nPequeno(d.total), num: true },
  ]);
}

export function renderFunil(L) {
  const el = $("#g-funil"), dim = $("#funil-dim").value;
  const f = M.funil(L, dim);
  const presentes = new Set(f.filter((x) => x.etapa === "lista" && x.n > 0).map((x) => x.grupo));
  const dados = f.filter((x) => presentes.has(x.grupo));
  if (!dados.length) { $("#funil-resumo").textContent = ""; return vazio(el), tabela($("#t-funil"), [], []); }
  const q = M.maiorQueda(f);
  const totVenc = dados.find((x) => x.etapa === "vencedora")?.total ?? 0;
  $("#funil-resumo").innerHTML = q && q.queda > 0
    ? `Maior queda: <b>${rotulo(q.grupo)}</b> são ${fmtPct(q.de)} da lista e ${fmtPct(q.para)} das vencedoras (${fmt(q.nVenc)} de ${fmt(totVenc)})${nPequeno(totVenc)}.`
    : "Nenhum grupo perde participação entre a lista e as vencedoras neste recorte.";
  const etapas = M.ETAPAS.filter((e) => dados.some((x) => x.etapa === e.id)).map((e) => e.rotulo);
  const ultimos = dados.filter((x) => x.rotulo === etapas.at(-1));
  desenhar(el, Plot.plot({
    width: largura(el), height: 360, marginRight: 160, style: estilo(), ariaLabel: "Participação de cada grupo por etapa",
    x: { domain: etapas, label: null, padding: 0.3 },
    y: { label: "% da etapa", grid: true, domain: [0, 100] },
    color: { ...cores(dim), legend: true, tickFormat: rotulo },
    marks: [
      Plot.line(dados, { x: "rotulo", y: "pct", stroke: "grupo", strokeWidth: 2, curve: "linear" }),
      Plot.dot(dados, {
        x: "rotulo", y: "pct", fill: "grupo", r: 5, stroke: css("--superficie"), strokeWidth: 2,
        channels: { Grupo: (d) => rotulo(d.grupo), n: "n", Total: (d) => `${d.total}${nPequeno(d.total)}` },
        tip: { format: { fill: false, y: (v) => fmtPct(v) } },
      }),
      Plot.text(ultimos, { x: "rotulo", y: "pct", text: (d) => `${rotulo(d.grupo).split(" (")[0]} ${fmtPct(d.pct)}`, dx: 10, textAnchor: "start", fill: css("--tinta-2"), fontSize: 11 }),
    ],
  }));
  tabela($("#t-funil"), dados, [
    { rot: "Etapa", k: "rotulo" }, { rot: "Grupo", f: (d) => rotulo(d.grupo) }, { rot: "n", k: "n", num: true },
    { rot: "Total da etapa", k: "total", num: true }, { rot: "%", f: (d) => fmtPct(d.pct) + nPequeno(d.total), num: true },
  ]);
}

export function renderSegregacao(L) {
  const el = $("#g-segregacao");
  const s = M.segregacao(L);
  const dn = M.duncan(L);
  $("#duncan").innerHTML = dn.D == null
    ? `<h3>Índice de Duncan (gênero)</h3><p class="vazio">Precisa de mulheres e homens no recorte.</p>`
    : `<h3>Índice de Duncan (gênero)</h3><div class="val">${fmt(dn.D, 2)}</div>
       <p>Para que mulheres se distribuíssem entre as categorias como os homens, <b>${fmtPct(dn.D * 100)}</b> delas teriam de mudar de categoria.</p>
       <p class="muted">0 = mesma distribuição; 1 = segregação total. Base: ${fmt(dn.mulheres)} participações de mulheres e ${fmt(dn.homens)} de homens, sem o Livro do Ano.</p>`;
  if (!s.length) return vazio(el), tabela($("#t-segregacao"), [], []);
  const cats = CATEGORIAS.filter((c) => s.some((x) => x.categoria === c));
  const estreito = largura(el) < 560;
  desenhar(el, Plot.plot({
    width: largura(el), height: (estreito ? 110 : 60) + cats.length * 48, marginLeft: 104, marginTop: estreito ? 90 : 40, style: estilo(), ariaLabel: "Mapa de calor por categoria",
    x: { label: null, axis: "top", domain: M.INDICADORES.map((i) => i.rotulo), tickRotate: estreito ? -40 : 0 },
    y: { label: null, domain: cats },
    color: { type: "linear", domain: [0, 100], range: [css("--seq-0"), css("--seq-1")], legend: true, label: "%" },
    marks: [
      Plot.cell(s, { x: "indicador", y: "categoria", fill: "pct", inset: 1.5, rx: 6,
        channels: { n: "n", Total: (d) => `${d.total}${nPequeno(d.total)}` }, tip: { format: { fill: (v) => fmtPct(v) } } }),
      Plot.text(s, { x: "indicador", y: "categoria", text: (d) => `${fmtPct(d.pct)}\n(${d.n}/${d.total})`, fill: (d) => textoSobre(d.pct / 100), fontSize: 11, lineHeight: 1.1 }),
    ],
  }));
  tabela($("#t-segregacao"), s, [
    { rot: "Categoria", k: "categoria" }, { rot: "Indicador", k: "indicador" }, { rot: "n", k: "n", num: true },
    { rot: "Total", k: "total", num: true }, { rot: "%", f: (d) => fmtPct(d.pct) + nPequeno(d.total), num: true },
  ]);
}

export function renderSankey(L, { D }) {
  const el = $("#g-sankey");
  const { nodes, links } = M.sankey(L, D.ufs);
  if (!links.length) return vazio(el), tabela($("#t-sankey"), [], []);
  const w = largura(el), h = Math.max(300, nodes.length * 28);
  const s = d3.sankey().nodeId((d) => d.id).nodeWidth(10).nodePadding(12).extent([[0, 6], [w, h - 6]])({ nodes: nodes.map((d) => ({ ...d })), links: links.map((d) => ({ ...d })) });
  const regiaoCor = cores("regiao");
  const corNo = (id) => {
    const reg = id.replace(/^Nasc\.: |^Editora: /, "");
    const i = regiaoCor.domain.indexOf(reg);
    return id.startsWith("Nasc") && i >= 0 ? regiaoCor.range[i] : css("--s-na");
  };
  const svg = d3.create("svg").attr("viewBox", [0, 0, w, h]).attr("width", w).attr("role", "img").attr("aria-label", "Fluxo da região de nascimento à região da editora e ao resultado");
  const caminhos = svg.append("g").attr("fill", "none").selectAll("path").data(s.links).join("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", (d) => (d.source.id.startsWith("Nasc") ? corNo(d.source.id) : css("--eixo"))).attr("stroke-opacity", 0.42)
    .attr("stroke-width", (d) => Math.max(1, d.width))
    .on("pointermove", (ev, d) => { caminhos.attr("stroke-opacity", (x) => (x === d ? 0.8 : 0.18)); dica.mostrar(ev, `<b>${esc(d.source.id)} → ${esc(d.target.id)}</b>${fmt(d.value)} participações`); })
    .on("pointerleave", () => { caminhos.attr("stroke-opacity", 0.42); dica.esconder(); });
  svg.append("g").selectAll("rect").data(s.nodes).join("rect")
    .attr("x", (d) => d.x0).attr("y", (d) => d.y0).attr("width", (d) => d.x1 - d.x0).attr("height", (d) => Math.max(1, d.y1 - d.y0)).attr("rx", 3)
    .attr("fill", (d) => corNo(d.id))
    .on("pointermove", (ev, d) => dica.mostrar(ev, `<b>${esc(d.id)}</b>${fmt(d.value)} participações`)).on("pointerleave", dica.esconder);
  svg.append("g").attr("font-size", 11).attr("fill", css("--tinta")).selectAll("text").data(s.nodes).join("text")
    .attr("x", (d) => (d.x0 < w / 2 ? d.x1 + 6 : d.x0 - 6)).attr("y", (d) => (d.y0 + d.y1) / 2).attr("dy", "0.35em")
    .attr("text-anchor", (d) => (d.x0 < w / 2 ? "start" : "end")).text((d) => `${d.id.replace(/^(Nasc\.|Editora): /, "")} (${d.value})`);
  el.replaceChildren(svg.node());
  tabela($("#t-sankey"), links, [{ rot: "De", k: "source" }, { rot: "Para", k: "target" }, { rot: "Participações", k: "value", num: true }]);
}

export function renderIdade(L) {
  const el = $("#g-idade");
  const dados = M.idades(L);
  if (!dados.length) return vazio(el, "Sem ano de nascimento no recorte."), tabela($("#t-idade"), [], []);
  const generos = M.ORDEM.genero.filter((g) => dados.some((d) => d.genero === g));
  const medianas = generos.map((g) => ({ genero: g, idade: M.mediana(dados.filter((d) => d.genero === g).map((d) => d.idade)) }));
  desenhar(el, Plot.plot({
    width: largura(el), height: 90 + generos.length * 120, marginLeft: 130, style: estilo(), ariaLabel: "Idade no ano do prêmio, por gênero",
    x: { label: "Idade no ano da edição", grid: true },
    fy: { domain: generos, label: null, tickFormat: rotulo },
    color: { ...cores("genero"), legend: true, tickFormat: rotulo },
    marks: [
      Plot.ruleX(medianas, { x: "idade", fy: "genero", stroke: css("--tinta-2"), strokeWidth: 1 }),
      Plot.text(medianas, { x: "idade", fy: "genero", text: (d) => `mediana ${fmt(d.idade, 1)}`, frameAnchor: "top", dy: 4, dx: 4, textAnchor: "start", fill: css("--tinta-2"), fontSize: 11 }),
      Plot.dot(dados, Plot.dodgeY("middle", {
        x: "idade", fy: "genero", fill: "genero", r: 3.6, stroke: css("--superficie"), strokeWidth: 1,
        channels: { Nome: "nome", Obra: "titulo", Edição: "ano", Categoria: "categoria" }, tip: { format: { fill: false, fy: false } },
      })),
    ],
  }));
  tabela($("#t-idade"), [...dados].sort((a, b) => a.idade - b.idade), [
    { rot: "Nome", k: "nome" }, { rot: "Idade", k: "idade", num: true }, { rot: "Gênero", f: (d) => rotulo(d.genero) },
    { rot: "Edição", k: "ano" }, { rot: "Categoria", k: "categoria" }, { rot: "Obra", k: "titulo" },
  ]);
}

export function renderEditoras(L) {
  const el = $("#g-editoras"), el2 = $("#g-grupos");
  const e = M.editoras(L);
  if (!e.length) { vazio(el); vazio(el2); return; }
  const longo = e.flatMap((d) => [{ editora: d.editora, tipo: "Premiadas", n: d.premiadas }, { editora: d.editora, tipo: "Não premiadas", n: d.outras }]);
  desenhar(el, Plot.plot({
    width: largura(el), height: 40 + e.length * 28, marginLeft: Math.min(210, 8 + d3.max(e, (d) => d.editora.length) * 6.4), style: estilo(),
    ariaLabel: "Editoras com mais indicações",
    x: { label: "Indicações (obras)", grid: true }, y: { domain: e.map((d) => d.editora), label: null },
    color: { domain: ["Premiadas", "Não premiadas"], range: [css("--s1"), css("--s-na")], legend: true },
    marks: [
      Plot.barX(longo, Plot.stackX({ order: ["Premiadas", "Não premiadas"] }, { x: "n", y: "editora", fill: "tipo", insetTop: 4, insetBottom: 4, insetLeft: 1, insetRight: 1, rx: 3, tip: true })),
      Plot.ruleX([0], { stroke: css("--eixo") }),
    ],
  }));
  tabela($("#t-editoras"), e, [{ rot: "Editora", k: "editora" }, { rot: "Grupo", f: (d) => d.grupo ?? "independente" },
    { rot: "Indicações", k: "total", num: true }, { rot: "Premiadas", k: "premiadas", num: true }]);
  const g = M.gruposEditoriais(L);
  desenhar(el2, Plot.plot({
    width: largura(el2), height: 160, marginLeft: 80, style: estilo(), ariaLabel: "Grupos editoriais e independentes",
    x: { label: "% das obras", domain: [0, 100] }, y: { label: null, domain: ["Lista", "Premiadas"] },
    color: { domain: ["Grupos editoriais", "Independentes"], range: [css("--s1"), css("--s2")], legend: true },
    marks: [Plot.barX(g, Plot.stackX({ x: "pct", y: "etapa", fill: "tipo", insetTop: 8, insetBottom: 8, insetLeft: 1, insetRight: 1, rx: 3,
      channels: { n: "n", Total: (d) => `${d.total}${nPequeno(d.total)}` }, tip: { format: { x: (v) => fmtPct(v) } } }))],
  }));
  tabela($("#t-grupos"), g, [{ rot: "Etapa", k: "etapa" }, { rot: "Tipo", k: "tipo" }, { rot: "n", k: "n", num: true },
    { rot: "Total", k: "total", num: true }, { rot: "%", f: (d) => fmtPct(d.pct) + nPequeno(d.total), num: true }]);
}

export function renderJuri(L, { D, estado }) {
  const el = $("#g-juri");
  const anos = new Set(L.map((l) => l.ano));
  const jur = D.jurados.filter((j) => anos.has(j.ano) && estado.categorias.includes(j.categoria));
  const j = M.juri(L, jur, D.pessoas, D.ufs);
  if (!j.length) return vazio(el, "Júri ainda não coletado para as edições do recorte."), tabela($("#t-juri"), [], []);
  const quem = ["Júri", "Lista", "Vencedoras"];
  desenhar(el, Plot.plot({
    width: largura(el), height: 70 + new Set(j.map((d) => `${d.ano}${d.indicador}`)).size * 96, marginLeft: 90, marginRight: 210, style: estilo(),
    ariaLabel: "Perfil do júri, da lista e das vencedoras",
    x: { label: "%", domain: [0, 100], grid: true }, y: { domain: quem, label: null },
    fy: { label: null, tickFormat: (d) => d }, color: { domain: quem, range: [css("--s1"), css("--s2"), css("--s3")], legend: true },
    marks: [
      Plot.barX(j, { x: "pct", y: "quem", fy: (d) => `${d.indicador} · ${d.ano}`, fill: "quem", insetTop: 3, insetBottom: 3, rx: 3,
        channels: { n: "n", Total: (d) => `${d.total}${nPequeno(d.total)}` }, tip: { format: { x: (v) => fmtPct(v), fy: false } } }),
      Plot.text(j, { x: "pct", y: "quem", fy: (d) => `${d.indicador} · ${d.ano}`, text: (d) => `${fmtPct(d.pct)} (${d.n}/${d.total})`, dx: 6, textAnchor: "start", fill: css("--tinta-2"), fontSize: 11 }),
      Plot.ruleX([0], { stroke: css("--eixo") }),
    ],
  }));
  tabela($("#t-juri"), j, [{ rot: "Edição", k: "ano" }, { rot: "Grupo", k: "quem" }, { rot: "Indicador", k: "indicador" },
    { rot: "n", k: "n", num: true }, { rot: "Total", k: "total", num: true }, { rot: "%", f: (d) => fmtPct(d.pct) + nPequeno(d.total), num: true }]);
}
