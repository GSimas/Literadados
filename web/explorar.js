// Explorador: panorama e análises (RF-03 a RF-10). Cada função recebe as linhas filtradas e o contexto do painel.
import * as M from "./metricas.js";
import { $, fmt, fmtPct, nPequeno, esc, rotulo, css, largura, estilo, cores, textoSobre, tabela, desenhar, vazio, dica, CATEGORIAS, PREMIOS, NOME_PREMIO, nomesPremios, nomePais, avisoPremios, astGenero, botaoExportarGrafico, BOTAO_TABELA } from "./ui.js";

// Vários prêmios no recorte (CA-26.9): cada prêmio vira uma faceta (fy = nome do prêmio), com o próprio n.
// Taxas de prêmios diferentes nunca se somam. Com um prêmio só, os gráficos ficam como eram.
const premiosDe = (L) => [...M.porPremio(L, PREMIOS).keys()];
const porPremio = (L, fn) => M.facetar(L, fn, PREMIOS, NOME_PREMIO);
const fy = (multi) => (multi ? { fy: "premio_nome" } : {});
const colPremio = (multi) => (multi ? [{ rot: "Prêmio", k: "premio_nome" }] : []);

export function renderPanorama(L) {
  const k = M.kpis(L);
  const cartao = (rot, val, det = "") => `<div class="kpi"><div class="rot">${rot}</div><div class="val">${val}</div><div class="det">${det}</div></div>`;
  $("#kpis").innerHTML = [
    cartao("Pessoas", fmt(k.pessoas), `${fmt(k.indicacoes)} indicações · ${fmt(k.obras)} obras` +
      (k.premios > 1 ? ` · ${fmt(k.premios)} prêmios (${esc(nomesPremios(premiosDe(L)))}); pessoas contadas uma vez` : "")),
    cartao("Mulheres", fmtPct(k.pctMulheres) + astGenero(k.generoAtribuido), `${fmt(k.mulheres)} de ${fmt(k.pessoas)} pessoas`),
    cartao("Pessoas negras", k.pessoas ? `≥ ${fmtPct(k.pctNegrasPiso)}` : "–", `pelo menos ${fmt(k.negras)}; piso por autodeclaração`),
    cartao("Cobertura de raça", fmtPct(k.pctCoberturaRaca), `${fmt(k.comRaca)} com declaração pública` +
      (k.buscaParcial ? `; busca incompleta para ${fmt(k.buscaParcial)} (o piso pode subir)` : "")),
    cartao("Estados de nascimento", `${fmt(k.ufs)} <small>de 27</small>`, "UFs distintas" +
      (k.exterior ? ` · ${fmt(k.exterior)} nascida${k.exterior > 1 ? "s" : ""} fora do Brasil${k.paises ? ` (${fmt(k.paises)} país${k.paises > 1 ? "es" : ""})` : ""}` : "")),
    cartao("Editoras", fmt(k.editoras), "com obras no recorte"),
  ].join("");
}

export function renderEvolucao(L, { D, ANOS, estado }) {
  const el = $("#g-evolucao"), dim = $("#evo-dim").value, etapa = $("#evo-etapa").value;
  const ps = premiosDe(L), multi = ps.length > 1;
  const dados = porPremio(L, (ls) => M.composicao(ls, dim, etapa));
  const anosVis = ANOS.filter((a) => a >= estado.anoIni && a <= estado.anoFim);
  // Lacuna = edição sem dado depois da criação do prêmio; antes dela não há edição para marcar (CA-04.2).
  const inicio = new Map((D?.premios ?? []).map((p) => [p.id, p.ano_inicio]));
  const lacunas = ps.flatMap((p) => {
    const com = new Set(dados.filter((d) => d.premio === p).map((d) => d.ano));
    return anosVis.filter((a) => a >= (inicio.get(p) ?? -Infinity) && !com.has(a)).map((ano) => ({ ano, premio_nome: NOME_PREMIO[p] ?? p }));
  });
  const marcos = M.marcosDe(ps, PREMIOS[0], D?.premios ?? []).filter((m) => anosVis.includes(m.ano)).map((m) => ({ ...m, premio_nome: NOME_PREMIO[m.premio] ?? m.premio }));
  if (!dados.length) return vazio(el), tabela($("#t-evolucao"), [], []);
  // Barra com no máximo 26px; a folga é fração da banda, para a barra não sumir com 67 edições no celular (CA-25.3).
  const banda = (largura(el) - 60) / anosVis.length, folga = Math.max(banda * 0.12, (banda - 26) / 2);
  const passo = M.passoAnos(anosVis.length, largura(el) - 60);
  // Rótulos dos marcos em linhas: cada um vai para a primeira linha onde não encosta no anterior (2018 e 2021 ficam perto).
  // Perto das bordas, o texto se alinha pela ponta para não ser cortado (celular).
  const fins = [], pos = new Map(), W = largura(el);
  for (const m of marcos) {
    const w = m.texto.length * 6.4, x = 40 + (anosVis.indexOf(m.ano) + 0.5) * banda;
    const ancora = x + w / 2 > W - 4 ? "end" : x - w / 2 < 4 ? "start" : "middle";
    const ini = ancora === "end" ? x - w : ancora === "start" ? x : x - w / 2;
    let r = fins.findIndex((fim) => fim < ini - 6);
    if (r < 0) r = fins.length;
    fins[r] = ini + w;
    pos.set(m, { r, ancora });
  }
  const rotulosMarcos = fins.flatMap((_, r) => ["start", "middle", "end"].map((ancora) => Plot.text(marcos.filter((m) => pos.get(m).r === r && pos.get(m).ancora === ancora),
    { x: "ano", ...fy(multi), text: "texto", frameAnchor: "top", textAnchor: ancora, dx: ancora === "end" ? 3 : ancora === "start" ? -3 : 0, dy: -8 - 14 * r, fill: css("--tinta-2"), fontSize: 11 })));
  const altura = multi ? ps.length * (300 + 14 * fins.length) : 340 + 14 * fins.length;
  desenhar(el, Plot.plot({
    width: largura(el), height: altura, marginTop: 22 + 14 * fins.length, marginRight: multi ? 110 : 20, style: estilo(),
    ariaLabel: multi ? `Composição por edição em barras 100% empilhadas, um painel por prêmio (${ps.length})` : "Composição por edição em barras 100% empilhadas",
    x: { domain: anosVis, label: null, tickFormat: (d) => (d % passo ? "" : String(d)), tickSize: anosVis.length > 30 ? 0 : 6 },
    y: { label: "% das participações", grid: true, domain: [0, 100] },
    ...(multi ? { fy: { domain: ps.map((p) => NOME_PREMIO[p] ?? p), label: null, padding: 0.18 } } : {}),
    color: { ...cores(dim), legend: true, tickFormat: rotulo },
    marks: [
      Plot.ruleX(marcos, { x: "ano", ...fy(multi), stroke: css("--eixo"), strokeWidth: 1 }),
      ...rotulosMarcos,
      Plot.barY(dados, Plot.stackY({ order: M.ORDEM[dim] }, {
        x: "ano", ...fy(multi), y: "pct", fill: "grupo", insetTop: 1, insetBottom: 1, insetLeft: folga, insetRight: folga, rx: 3,
        channels: { ...(multi ? { Prêmio: "premio_nome" } : {}), Grupo: (d) => rotulo(d.grupo), Participações: "n", Total: "total" },
        tip: { format: { fill: false, x: true, y: (v) => fmtPct(v), fy: false } },
      })),
      Plot.text(lacunas, { x: "ano", ...fy(multi), y: 50, text: () => "sem dados", rotate: -90, fill: css("--muted"), fontSize: 11 }),
      Plot.ruleY([0], { stroke: css("--eixo") }),
    ],
  }));
  tabela($("#t-evolucao"), dados, [...colPremio(multi),
    { rot: "Edição", k: "ano" }, { rot: "Grupo", f: (d) => rotulo(d.grupo) }, { rot: "n", k: "n", num: true },
    { rot: "Total", k: "total", num: true }, { rot: "%", f: (d) => fmtPct(d.pct) + nPequeno(d.total), num: true },
  ]);
}

export function renderFunil(L, { semLista = new Set() } = {}) {
  const el = $("#g-funil"), dim = $("#funil-dim").value;
  const ps = premiosDe(L), multi = ps.length > 1;
  const f = porPremio(L, (ls) => M.funil(ls, dim));
  const presentes = new Set(f.filter((x) => x.etapa === "lista" && x.n > 0).map((x) => `${x.premio}|${x.grupo}`));
  const dados = f.filter((x) => presentes.has(`${x.premio}|${x.grupo}`));
  if (!dados.length) { $("#funil-resumo").textContent = ""; return vazio(el), tabela($("#t-funil"), [], []); }
  // Um resumo por prêmio: a maior queda é sempre dentro do mesmo prêmio (CA-05.2, CA-26.9).
  $("#funil-resumo").innerHTML = ps.map((p) => {
    const fp = f.filter((x) => x.premio === p), q = M.maiorQueda(fp);
    const totVenc = fp.find((x) => x.etapa === "vencedora")?.total ?? 0;
    const pre = multi ? `<b>${esc(NOME_PREMIO[p] ?? p)}</b>: ` : "";
    return pre + (q && q.queda >= 0.5 // menos de meio ponto arredonda para o mesmo %: não é queda
      ? `Maior queda: <b>${rotulo(q.grupo)}</b> são ${fmtPct(q.de)} da lista e ${fmtPct(q.para)} das vencedoras (${fmt(q.nVenc)} de ${fmt(totVenc)})${nPequeno(totVenc)}.`
      : "Nenhum grupo perde participação entre a lista e as vencedoras neste recorte.");
  }).join("<br>");
  // Edições sem lista pública (CA-25.3): ali a lista é só a dos premiados, o que aproxima a lista do perfil de quem venceu.
  const nSem = new Set(L.map((l) => `${l.premio}|${l.ano}`).filter((k) => semLista.has(k))).size;
  if (nSem) $("#funil-resumo").insertAdjacentHTML("beforeend", ` <span class="muted">O recorte inclui ${fmt(nSem)} ediç${nSem > 1 ? "ões" : "ão"} sem lista pública (no Jabuti, até 1999), em que a lista é só a dos premiados.</span>`);
  const etapas = M.ETAPAS.filter((e) => dados.some((x) => x.etapa === e.id)).map((e) => e.rotulo);
  // Rótulo no fim da linha de cada grupo, na última etapa que o prêmio tem.
  const ultimos = ps.flatMap((p) => { const dp = dados.filter((x) => x.premio === p), u = etapas.filter((e) => dp.some((x) => x.rotulo === e)).at(-1); return dp.filter((x) => x.rotulo === u); });
  desenhar(el, Plot.plot({
    width: largura(el), height: multi ? ps.length * 320 : 360, marginRight: 160, style: estilo(),
    ariaLabel: multi ? `Participação de cada grupo por etapa, um painel por prêmio (${ps.length})` : "Participação de cada grupo por etapa",
    x: { domain: etapas, label: null, padding: 0.3 },
    y: { label: "% da etapa", grid: true, domain: [0, 100] },
    ...(multi ? { fy: { domain: ps.map((p) => NOME_PREMIO[p] ?? p), label: null, padding: 0.18 } } : {}),
    color: { ...cores(dim), legend: true, tickFormat: rotulo },
    marks: [
      Plot.line(dados, { x: "rotulo", y: "pct", ...fy(multi), stroke: "grupo", strokeWidth: 2, curve: "linear" }),
      Plot.dot(dados, {
        x: "rotulo", y: "pct", ...fy(multi), fill: "grupo", r: 5, stroke: css("--superficie"), strokeWidth: 2,
        channels: { ...(multi ? { Prêmio: "premio_nome" } : {}), Grupo: (d) => rotulo(d.grupo), n: "n", Total: (d) => `${d.total}${nPequeno(d.total)}` },
        tip: { format: { fill: false, y: (v) => fmtPct(v), fy: false } },
      }),
      Plot.text(ultimos, { x: "rotulo", y: "pct", ...fy(multi), text: (d) => `${rotulo(d.grupo).split(" (")[0]} ${fmtPct(d.pct)}`, dx: 10, textAnchor: "start", fill: css("--tinta-2"), fontSize: 11 }),
    ],
  }));
  tabela($("#t-funil"), dados, [...colPremio(multi),
    { rot: "Etapa", k: "rotulo" }, { rot: "Grupo", f: (d) => rotulo(d.grupo) }, { rot: "n", k: "n", num: true },
    { rot: "Total da etapa", k: "total", num: true }, { rot: "%", f: (d) => fmtPct(d.pct) + nPequeno(d.total), num: true },
  ]);
}

export function renderSegregacao(L) {
  const el = $("#g-segregacao");
  const ps = premiosDe(L), multi = ps.length > 1;
  const s = porPremio(L, M.segregacao);
  // Duncan dentro de cada prêmio: categorias de prêmios diferentes não são o mesmo "mercado" (CA-06.2, CA-26.9).
  const dns = ps.map((p) => ({ p, dn: M.duncan(L.filter((l) => l.premio === p)) }));
  $("#duncan").innerHTML = `<h3>Índice de Duncan (gênero)</h3>` + (dns.length ? dns : [{ dn: { D: null } }]).map(({ p, dn }) => {
    const pre = multi ? `<p class="sobretitulo">${esc(NOME_PREMIO[p] ?? p)}</p>` : "";
    return pre + (dn.D == null
      ? `<p class="vazio">Precisa de mulheres e homens em mais de uma categoria${multi ? " (a categoria única não conta)" : " no recorte"}.</p>`
      : `<div class="val">${fmt(dn.D, 2)}</div>
       <p>Para que mulheres se distribuíssem entre as categorias como os homens, <b>${fmtPct(dn.D * 100)}</b> delas teriam de mudar de categoria.</p>
       <p class="muted">0 = mesma distribuição; 1 = segregação total. Base: ${fmt(dn.mulheres)} participações de mulheres e ${fmt(dn.homens)} de homens, sem o Livro do Ano.</p>`);
  }).join("");
  if (!s.length) return vazio(el), tabela($("#t-segregacao"), [], []);
  const cats = CATEGORIAS.filter((c) => s.some((x) => x.categoria === c));
  const estreito = largura(el) < 560;
  // Com vários prêmios, uma coluna de painéis por prêmio: cada linha (categoria) mostra só o que existe naquele prêmio.
  desenhar(el, Plot.plot({
    width: largura(el), height: ((estreito ? 110 : 60) + cats.length * 48) * (multi ? ps.length : 1), marginLeft: 104, marginTop: estreito ? 90 : 40,
    marginRight: multi ? 110 : 20, style: estilo(), ariaLabel: multi ? `Mapa de calor por categoria, um painel por prêmio (${ps.length})` : "Mapa de calor por categoria",
    x: { label: null, axis: "top", domain: M.INDICADORES.map((i) => i.rotulo), tickRotate: estreito ? -40 : 0 },
    y: { label: null, domain: cats },
    ...(multi ? { fy: { domain: ps.map((p) => NOME_PREMIO[p] ?? p), label: null, padding: 0.1 } } : {}),
    color: { type: "linear", domain: [0, 100], range: [css("--seq-0"), css("--seq-1")], legend: true, label: "%" },
    marks: [
      Plot.cell(s, { x: "indicador", y: "categoria", ...fy(multi), fill: "pct", inset: 1.5, rx: 6,
        channels: { ...(multi ? { Prêmio: "premio_nome" } : {}), n: "n", Total: (d) => `${d.total}${nPequeno(d.total)}` }, tip: { format: { fill: (v) => fmtPct(v), fy: false } } }),
      Plot.text(s, { x: "indicador", y: "categoria", ...fy(multi), text: (d) => `${fmtPct(d.pct)}\n(${d.n}/${d.total})`, fill: (d) => textoSobre(d.pct / 100), fontSize: 11, lineHeight: 1.1 }),
    ],
  }));
  tabela($("#t-segregacao"), s, [...colPremio(multi),
    { rot: "Categoria", k: "categoria" }, { rot: "Indicador", k: "indicador" }, { rot: "n", k: "n", num: true },
    { rot: "Total", k: "total", num: true }, { rot: "%", f: (d) => fmtPct(d.pct) + nPequeno(d.total), num: true },
  ]);
}

export function renderSankey(L, { D }) {
  const el = $("#g-sankey");
  avisoPremios(el, L);
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
  const svg = d3.create("svg").attr("viewBox", [0, 0, w, h]).attr("width", w).attr("role", "img").attr("class", "sankey").attr("aria-label", "Fluxo da região de nascimento à região da editora e ao resultado");
  const caminhos = svg.append("g").attr("fill", "none").selectAll("path").data(s.links).join("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", (d) => (d.source.id.startsWith("Nasc") ? corNo(d.source.id) : css("--eixo"))).attr("stroke-opacity", 0.42)
    .attr("stroke-width", (d) => Math.max(1, d.width))
    .on("pointermove", (ev, d) => { caminhos.attr("stroke-opacity", (x) => (x === d ? 0.8 : 0.18)); dica.mostrar(ev, `<b>${esc(d.source.id)} → ${esc(d.target.id)}</b>${fmt(d.value)} participações`); })
    .on("pointerleave", () => { caminhos.attr("stroke-opacity", 0.42); dica.esconder(); });
  svg.append("g").selectAll("rect").data(s.nodes).join("rect")
    .attr("x", (d) => d.x0).attr("y", (d) => d.y0).attr("width", (d) => d.x1 - d.x0).attr("height", (d) => Math.max(1, d.y1 - d.y0)).attr("rx", 3)
    .attr("fill", (d) => corNo(d.id))
    // Nó em foco acende os fluxos que passam por ele (CA-19.9).
    .on("pointermove", (ev, d) => { caminhos.attr("stroke-opacity", (x) => (x.source === d || x.target === d ? 0.8 : 0.1)); dica.mostrar(ev, `<b>${esc(d.id)}</b>${fmt(d.value)} participações`); })
    .on("pointerleave", () => { caminhos.attr("stroke-opacity", 0.42); dica.esconder(); });
  svg.append("g").attr("font-size", 11).attr("fill", css("--tinta")).selectAll("text").data(s.nodes).join("text")
    .attr("x", (d) => (d.x0 < w / 2 ? d.x1 + 6 : d.x0 - 6)).attr("y", (d) => (d.y0 + d.y1) / 2).attr("dy", "0.35em")
    .attr("text-anchor", (d) => (d.x0 < w / 2 ? "start" : "end")).text((d) => `${d.id.replace(/^(Nasc\.|Editora): /, "")} (${d.value})`);
  el.replaceChildren(svg.node(), botaoExportarGrafico());
  tabela($("#t-sankey"), links, [{ rot: "De", k: "source" }, { rot: "Para", k: "target" }, { rot: "Participações", k: "value", num: true }]);
}

export function renderIdade(L) {
  const el = $("#g-idade");
  avisoPremios(el, L);
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
  avisoPremios(el, L);
  const e = M.editoras(L), sem = M.semEditora(L);
  // Indicação sem editora conhecida não vira barra (CA-25.4): a nota diz quantas ficaram fora.
  $("#editoras-nota").textContent = sem ? `${fmt(sem)} indicaç${sem > 1 ? "ões" : "ão"} sem editora conhecida (série histórica, sem fonte da época) ficam fora.` : "";
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
  // Percentual de grupos editoriais: um painel por prêmio (CA-26.9), nunca a soma das bases.
  const ps = premiosDe(L), multi = ps.length > 1;
  const g = porPremio(L, M.gruposEditoriais);
  desenhar(el2, Plot.plot({
    width: largura(el2), height: multi ? 40 + ps.length * 120 : 160, marginLeft: 80, marginRight: multi ? 110 : 20, style: estilo(),
    ariaLabel: multi ? `Grupos editoriais e independentes, um painel por prêmio (${ps.length})` : "Grupos editoriais e independentes",
    x: { label: "% das obras", domain: [0, 100] }, y: { label: null, domain: ["Lista", "Premiadas"] },
    ...(multi ? { fy: { domain: ps.map((p) => NOME_PREMIO[p] ?? p), label: null } } : {}),
    color: { domain: ["Grupos editoriais", "Independentes"], range: [css("--s1"), css("--s2")], legend: true },
    marks: [Plot.barX(g, Plot.stackX({ x: "pct", y: "etapa", ...fy(multi), fill: "tipo", insetTop: 8, insetBottom: 8, insetLeft: 1, insetRight: 1, rx: 3,
      channels: { n: "n", Total: (d) => `${d.total}${nPequeno(d.total)}` }, tip: { format: { x: (v) => fmtPct(v), fy: false } } }))],
  }));
  tabela($("#t-grupos"), g, [...colPremio(multi), { rot: "Etapa", k: "etapa" }, { rot: "Tipo", k: "tipo" }, { rot: "n", k: "n", num: true },
    { rot: "Total", k: "total", num: true }, { rot: "%", f: (d) => fmtPct(d.pct) + nPequeno(d.total), num: true }]);
}

export function renderJuri(L, { D, estado }) {
  const el = $("#g-juri");
  // Júri de cada prêmio comparado com a lista e as vencedoras do mesmo prêmio (CA-10.1, CA-26.9); D.jurados omite o prêmio padrão.
  const ps = premiosDe(L), multi = ps.length > 1;
  const j = porPremio(L, (ls) => {
    const p = ls[0].premio, anos = new Set(ls.map((l) => l.ano));
    const jur = D.jurados.filter((x) => (x.premio ?? PREMIOS[0]) === p && anos.has(x.ano) && estado.categorias.includes(x.categoria));
    return M.juri(ls, jur, D.pessoas, D.ufs);
  });
  if (!j.length) return vazio(el, "Júri ainda não coletado para as edições do recorte."), tabela($("#t-juri"), [], []);
  const quem = ["Júri", "Lista", "Vencedoras"];
  const faixa = (d) => `${multi ? `${d.premio_nome} · ` : ""}${d.indicador} · ${d.ano}`;
  desenhar(el, Plot.plot({
    width: largura(el), height: 70 + new Set(j.map(faixa)).size * 96, marginLeft: 90, marginRight: 210, style: estilo(),
    ariaLabel: "Perfil do júri, da lista e das vencedoras",
    x: { label: "%", domain: [0, 100], grid: true }, y: { domain: quem, label: null },
    fy: { label: null, tickFormat: (d) => d }, color: { domain: quem, range: [css("--s1"), css("--s2"), css("--s3")], legend: true },
    marks: [
      Plot.barX(j, { x: "pct", y: "quem", fy: faixa, fill: "quem", insetTop: 3, insetBottom: 3, rx: 3,
        channels: { n: "n", Total: (d) => `${d.total}${nPequeno(d.total)}` }, tip: { format: { x: (v) => fmtPct(v), fy: false } } }),
      Plot.text(j, { x: "pct", y: "quem", fy: faixa, text: (d) => `${fmtPct(d.pct)} (${d.n}/${d.total})`, dx: 6, textAnchor: "start", fill: css("--tinta-2"), fontSize: 11 }),
      Plot.ruleX([0], { stroke: css("--eixo") }),
    ],
  }));
  tabela($("#t-juri"), j, [...colPremio(multi), { rot: "Edição", k: "ano" }, { rot: "Grupo", k: "quem" }, { rot: "Indicador", k: "indicador" },
    { rot: "n", k: "n", num: true }, { rot: "Total", k: "total", num: true }, { rot: "%", f: (d) => fmtPct(d.pct) + nPequeno(d.total), num: true }]);
}

// Entre prêmios (CA-26.11): sobreposição entre pares de prêmios (com n) e quem passou por mais de um, em ordem de chegada.
export function renderEntrePremios(L, { abrirPerfil } = {}) {
  const el = $("#g-entre-premios"), etapa = $("#entre-etapa [aria-checked=true]")?.dataset.v ?? "premiada";
  const r = M.entrePremios(L, PREMIOS, etapa);
  const rotEtapa = etapa === "premiada" ? "premiadas" : "indicadas";
  if (r.premios.length < 2) {
    $("#entre-resumo").textContent = "Escolha dois prêmios ou mais no filtro para ver quem passa por mais de um.";
    $("#entre-pessoas").innerHTML = "";
    return vazio(el, "Só um prêmio no recorte."), tabela($("#t-entre-premios"), [], []);
  }
  const nomes = r.premios.map((p) => NOME_PREMIO[p] ?? p), nome = (p) => NOME_PREMIO[p] ?? p;
  const distintos = new Set(L.filter((l) => etapa === "lista" || l.premiada).map((l) => l.pessoa_id)).size;
  $("#entre-resumo").innerHTML = `<b>${fmt(r.pessoas.length)}</b> de ${fmt(distintos)} pessoas ${rotEtapa} no recorte passaram por mais de um prêmio`
    + ` (${r.premios.map((p) => `${esc(nome(p))}: ${fmt(r.total[p])}`).join("; ")}).`;
  const dados = r.pares.map((x) => ({ ...x, deN: nome(x.de), paraN: nome(x.para) }));
  desenhar(el, Plot.plot({
    width: Math.min(largura(el), 160 + nomes.length * 170), height: 70 + nomes.length * 64, marginLeft: 150, marginTop: 40, style: estilo(),
    ariaLabel: "Sobreposição entre prêmios: parte das pessoas de cada prêmio que também está no outro",
    x: { label: null, axis: "top", domain: nomes }, y: { label: null, domain: nomes },
    color: { type: "linear", domain: [0, 100], range: [css("--seq-0"), css("--seq-1")], legend: true, label: "%" },
    marks: [
      Plot.cell(dados, { x: "paraN", y: "deN", fill: "pct", inset: 1.5, rx: 6, channels: { n: "n", Base: (d) => `${d.total}${nPequeno(d.total)}` },
        tip: { format: { fill: (v) => fmtPct(v), x: true, y: true } } }),
      Plot.text(dados, { x: "paraN", y: "deN", text: (d) => `${fmtPct(d.pct)}\n(${d.n}/${d.total})`, fill: (d) => textoSobre((d.pct ?? 0) / 100), fontSize: 11, lineHeight: 1.1 }),
    ],
  }));
  tabela($("#t-entre-premios"), dados, [{ rot: "Prêmio", k: "deN" }, { rot: "Também em", k: "paraN" }, { rot: "n", k: "n", num: true },
    { rot: "Base", k: "total", num: true }, { rot: "%", f: (d) => fmtPct(d.pct) + nPequeno(d.total), num: true }]);
  $("#entre-pessoas").innerHTML = r.pessoas.length
    ? `<div class="tabela-exportavel">${BOTAO_TABELA}<div class="rolagem"><table class="tabela"><thead><tr><th scope="col">Pessoa</th><th scope="col">Nascimento</th><th scope="col">Ordem de chegada</th></tr></thead>
      <tbody>${r.pessoas.map((p) => `<tr><td><button type="button" class="link-pessoa" data-pessoa="${esc(p.pessoa_id)}">${esc(p.nome)}</button></td>
        <td>${esc(p.uf_nascimento === "EX" ? (p.pais_nascimento ? nomePais(p.pais_nascimento) : "fora do Brasil") : p.uf_nascimento ?? "–")}</td>
        <td>${p.premios.map((x, i) => `${esc(nome(x))} ${p.anos[i]}`).join(" → ")}</td></tr>`).join("")}</tbody></table></div></div>`
    : `<p class="vazio">Ninguém do recorte passou por mais de um prêmio.</p>`;
  if (abrirPerfil) $("#entre-pessoas").onclick = (e) => { const b = e.target.closest("[data-pessoa]"); if (b) abrirPerfil(b.dataset.pessoa); };
}

// Ranking de pessoas (RF-23): mais premiadas, mais 1º lugares ou mais indicadas, no recorte do filtro da janela.
const ROT_MEDIDA = { premios: "Prêmios (pódio)", vitorias: "1º lugares", participacoes: "Indicações" };
export function renderRanking(L, { D, abrirPerfil }) {
  const el = $("#g-ranking"), medida = $("#rank-medida [aria-checked=true]")?.dataset.v ?? "premios";
  avisoPremios(el, L);
  const r = M.ranking(L, D.pessoas, medida, 20);
  if (!r.length) return vazio(el), tabela($("#t-ranking"), [], []);
  const nomeRot = (d) => `${d.posicao}º ${d.nome}`;
  const c = cores("genero");
  desenhar(el, Plot.plot({
    width: largura(el), height: 50 + r.length * 30, marginLeft: Math.min(230, 16 + d3.max(r, (d) => nomeRot(d).length) * 6.6), marginRight: 34, style: estilo(),
    ariaLabel: `Ranking de pessoas por ${ROT_MEDIDA[medida].toLowerCase()}`,
    x: { label: ROT_MEDIDA[medida], grid: true, tickFormat: "d" }, y: { domain: r.map(nomeRot), label: null },
    color: { ...c, legend: true, tickFormat: rotulo },
    marks: [
      Plot.barX(r, { x: medida, y: nomeRot, fill: "genero", insetTop: 4, insetBottom: 4, rx: 3,
        channels: { UF: (d) => (d.uf_nascimento === "EX" ? M.paisOuExterior(d.pais_nascimento) : d.uf_nascimento ?? "sem dado"), Prêmios: "premios", "1º lugares": "vitorias", Indicações: "participacoes" },
        tip: { format: { y: false, fill: (g) => rotulo(g), x: false } } }),
      Plot.text(r, { x: medida, y: nomeRot, text: (d) => String(d[medida]), dx: 6, textAnchor: "start", fill: css("--tinta-2"), fontSize: 11 }),
      Plot.ruleX([0], { stroke: css("--eixo") }),
    ],
  }));
  // Clique numa barra abre o perfil (o Plot liga cada barra ao índice do dado).
  const svg = el.querySelector("svg[aria-label^='Ranking']") ?? el.querySelector("svg:last-of-type");
  svg?.querySelectorAll("g[aria-label='bar'] > *").forEach((b) => { b.style.cursor = "pointer"; });
  svg?.addEventListener("click", (e) => { const i = e.target.closest("g[aria-label='bar'] > *")?.__data__; if (Number.isInteger(i)) abrirPerfil(r[i].id); });
  $("#t-ranking").innerHTML = `<div class="tabela-exportavel">${BOTAO_TABELA}<div class="rolagem"><table class="tabela"><thead><tr>
    <th class="num" scope="col">Posição</th><th scope="col">Pessoa</th><th scope="col">UF nasc.</th><th class="num" scope="col">Prêmios</th><th class="num" scope="col">1º lugares</th><th class="num" scope="col">Indicações</th></tr></thead>
    <tbody>${r.map((p) => `<tr><td class="num">${p.posicao}º</td><td><button type="button" class="link-pessoa" data-pessoa="${esc(p.id)}">${esc(p.nome)}</button></td>
      <td>${esc(p.uf_nascimento === "EX" ? M.paisOuExterior(p.pais_nascimento) : p.uf_nascimento ?? "–")}</td><td class="num">${p.premios}</td><td class="num">${p.vitorias}</td><td class="num">${p.participacoes}</td></tr>`).join("")}</tbody></table></div></div>`;
}
