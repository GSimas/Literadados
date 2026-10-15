// Painel Literadados. Agregações em metricas.js (testadas); aqui só estado, DOM e desenho.
import * as M from "./metricas.js";

const D = await fetch("dados.json").then((r) => r.json());
const ANOS = d3.range(D.anos[0], D.anos[1] + 1);
const CATEGORIAS = ["Romance", "Contos", "Crônica", "Poesia", "Infantil", "Juvenil", "Infantil e Juvenil", "Livro do Ano"];
const $ = (s) => document.querySelector(s);
const fmt = (v, casas = 0) => (v == null ? "–" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas }));
const fmtPct = (v) => (v == null ? "–" : `${fmt(v, v < 10 && v % 1 ? 1 : 0)}%`);
const nPequeno = (total) => (total < 5 ? " (n pequeno)" : "");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const pessoaPorId = new Map(D.pessoas.map((p) => [p.id, p]));

// ---------- estado e URL (CA-02.1, 02.2) ----------
const estado = (() => {
  const q = new URLSearchParams(location.search);
  const cats = q.get("cat")?.split(",").filter((c) => CATEGORIAS.includes(c));
  return {
    anoIni: +q.get("ini") || D.anos[0], anoFim: +q.get("fim") || D.anos[1],
    categorias: cats?.length ? cats : [...CATEGORIAS], papel: q.get("papel") === "todos" ? "todos" : "autor",
  };
})();
function gravarURL() {
  const q = new URLSearchParams();
  if (estado.anoIni !== D.anos[0]) q.set("ini", estado.anoIni);
  if (estado.anoFim !== D.anos[1]) q.set("fim", estado.anoFim);
  if (estado.categorias.length !== CATEGORIAS.length) q.set("cat", estado.categorias.join(","));
  if (estado.papel !== "autor") q.set("papel", estado.papel);
  history.replaceState(null, "", `${location.pathname}${q.size ? "?" + q : ""}${location.hash}`);
}

function montarFiltros() {
  for (const [sel, valor] of [["#f-ini", estado.anoIni], ["#f-fim", estado.anoFim]]) {
    $(sel).innerHTML = ANOS.map((a) => `<option ${a === valor ? "selected" : ""}>${a}</option>`).join("");
  }
  $("#f-cats").insertAdjacentHTML("beforeend", CATEGORIAS.map((c) =>
    `<label class="chip"><input type="checkbox" value="${c}" ${estado.categorias.includes(c) ? "checked" : ""}>${c}</label>`).join(""));
  $("#f-papel").value = estado.papel;
  $("#filtros").addEventListener("change", () => {
    estado.anoIni = +$("#f-ini").value;
    estado.anoFim = Math.max(+$("#f-fim").value, estado.anoIni);
    $("#f-fim").value = estado.anoFim;
    estado.categorias = [...document.querySelectorAll("#f-cats input:checked")].map((i) => i.value);
    estado.papel = $("#f-papel").value;
    gravarURL();
    renderTudo();
  });
  $("#baixar").addEventListener("click", () => {
    const linhas = M.filtrar(D.participacao, estado);
    const url = URL.createObjectURL(new Blob(["﻿" + d3.csvFormat(linhas)], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: `literadados_${estado.anoIni}-${estado.anoFim}.csv` }).click();
    URL.revokeObjectURL(url);
  });
}

// ---------- tema ----------
const TEMAS = ["auto", "light", "dark"];
const NOME_TEMA = { auto: "automático", light: "claro", dark: "escuro" };
function aplicarTema(t) {
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  $("#tema").textContent = `Tema: ${NOME_TEMA[t]}`;
  try { localStorage.setItem("tema", t); } catch {}
}
let tema = "auto";
try { tema = localStorage.getItem("tema") || "auto"; } catch {}
aplicarTema(tema);
$("#tema").addEventListener("click", () => { tema = TEMAS[(TEMAS.indexOf(tema) + 1) % 3]; aplicarTema(tema); renderTudo(); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => renderTudo());

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function cores(dim) {
  const s = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6"].map(css);
  const dominio = M.ORDEM[dim];
  const faltante = { genero: "nao_identificado", raca: "sem_declaracao", regiao: "sem dado" }[dim];
  let i = 0;
  return { domain: dominio, range: dominio.map((g) => (g === faltante ? css("--s-na") : s[i++])) };
}
// Texto dentro de célula da escala sequencial: branco sobre fundo escuro, tinta sobre fundo claro.
// No tema escuro a rampa é invertida (escuro→claro), então a regra inverte junto.
const textoSobre = (fracao) => ((fracao > 0.55) !== (css("--seq-1") === "#cde2fb") ? "#fff" : "#0b0b0b");
const largura = (el) => Math.max(300, el.clientWidth || 600);
const estilo = () => ({ background: "transparent", color: css("--tinta"), fontSize: "12px", fontFamily: "inherit" });

// ---------- utilitários de desenho ----------
function tabela(el, linhas, colunas) {
  if (!linhas.length) { el.innerHTML = `<p class="vazio">Sem dados no recorte.</p>`; return; }
  el.innerHTML = `<div class="rolagem"><table class="tabela"><thead><tr>${colunas.map((c) => `<th class="${c.num ? "num" : ""}" scope="col">${esc(c.rot)}</th>`).join("")}</tr></thead>
  <tbody>${linhas.map((l) => `<tr>${colunas.map((c) => `<td class="${c.num ? "num" : ""}">${esc(c.f ? c.f(l) : l[c.k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
function desenhar(el, plot) {
  el.replaceChildren(plot);
}
function vazio(el, msg = "Sem dados no recorte selecionado.") { el.innerHTML = `<p class="vazio">${msg}</p>`; }
const rotulo = (g) => M.ROTULO[g] ?? g;

// ---------- seções ----------
function renderAviso() {
  const col = D.anos_coletados;
  $("#aviso-cobertura").innerHTML = col.length === ANOS.length
    ? "Todas as edições de 2010 a 2025 estão coletadas."
    : `<b>Fase piloto.</b> Listas completas coletadas: ${col.join(" e ")}. As demais edições aparecem como "sem dados" até serem coletadas. <a href="#metodologia">Ver metodologia</a>.`;
  $("#faixa-cobertura").innerHTML = ANOS.map((a) => `<div role="listitem" class="${col.includes(a) ? "ok" : ""}" title="${a}: ${col.includes(a) ? "coletada" : "não coletada"}">${a}</div>`).join("");
  $("#gerado-em").textContent = `Dados gerados em ${new Date(D.gerado_em).toLocaleString("pt-BR")}.`;
}

function renderPanorama(L) {
  const k = M.kpis(L);
  const cartao = (rot, val, det = "") => `<div class="kpi"><div class="rot">${rot}</div><div class="val">${val}</div><div class="det">${det}</div></div>`;
  $("#kpis").innerHTML = [
    cartao("Pessoas", fmt(k.pessoas), `${fmt(k.indicacoes)} indicações · ${fmt(k.obras)} obras`),
    cartao("Mulheres", fmtPct(k.pctMulheres), `${fmt(k.mulheres)} de ${fmt(k.pessoas)} pessoas`),
    cartao("Pessoas negras", k.pessoas ? `≥ ${fmtPct(k.pctNegrasPiso)}` : "–", `pelo menos ${fmt(k.negras)}; piso por autodeclaração`),
    cartao("Cobertura de raça", fmtPct(k.pctCoberturaRaca), `${fmt(k.comRaca)} com declaração pública` +
      (k.buscaParcial ? `; busca incompleta para ${fmt(k.buscaParcial)} (o piso pode subir)` : "")),
    cartao("Estados de nascimento", `${fmt(k.ufs)} <small>de 27</small>`, "UFs distintas"),
    cartao("Editoras", fmt(k.editoras), "com obras no recorte"),
  ].join("");
}

function renderEvolucao(L) {
  const el = $("#g-evolucao"), dim = $("#evo-dim").value, etapa = $("#evo-etapa").value;
  const dados = M.composicao(L, dim, etapa);
  const anosVis = ANOS.filter((a) => a >= estado.anoIni && a <= estado.anoFim);
  const comDados = new Set(dados.map((d) => d.ano));
  const lacunas = anosVis.filter((a) => !comDados.has(a));
  const marcos = M.MARCOS.filter((m) => anosVis.includes(m.ano));
  if (!dados.length) return vazio(el), tabela($("#t-evolucao"), [], []);
  const folga = Math.max(2, ((largura(el) - 60) / anosVis.length - 24) / 2); // barra com no máximo 24px
  desenhar(el, Plot.plot({
    width: largura(el), height: 340, marginTop: 34, style: estilo(),
    ariaLabel: "Composição por edição em barras 100% empilhadas",
    x: { domain: anosVis, label: null, tickFormat: (d) => (anosVis.length > 10 && d % 2 ? "" : String(d)) },
    y: { label: "% das participações", grid: true, domain: [0, 100] },
    color: { ...cores(dim), legend: true, tickFormat: rotulo },
    marks: [
      Plot.ruleX(marcos, { x: "ano", stroke: css("--eixo"), strokeWidth: 1 }),
      ...[0, 1].map((par) => Plot.text(marcos.filter((_, i) => i % 2 === par), { x: "ano", text: "texto", frameAnchor: "top", dy: par ? -8 : -22, fill: css("--tinta-2"), fontSize: 11 })),
      Plot.barY(dados, Plot.stackY({ order: M.ORDEM[dim] }, {
        x: "ano", y: "pct", fill: "grupo", insetTop: 1, insetBottom: 1, insetLeft: folga, insetRight: folga, rx: 2,
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

function renderFunil(L) {
  const el = $("#g-funil"), dim = $("#funil-dim").value;
  const f = M.funil(L, dim);
  const presentes = new Set(f.filter((x) => x.etapa === "lista" && x.n > 0).map((x) => x.grupo));
  const dados = f.filter((x) => presentes.has(x.grupo));
  if (!dados.length) { $("#funil-resumo").textContent = ""; return vazio(el), tabela($("#t-funil"), [], []); }
  const q = M.maiorQueda(f);
  $("#funil-resumo").innerHTML = q && q.queda > 0
    ? `Maior queda: <b>${rotulo(q.grupo)}</b> são ${fmtPct(q.de)} da lista e ${fmtPct(q.para)} das vencedoras (${fmt(q.nVenc)} de ${fmt(dados.find((x) => x.etapa === "vencedora")?.total ?? 0)})${nPequeno(dados.find((x) => x.etapa === "vencedora")?.total ?? 0)}.`
    : "Nenhum grupo perde participação entre a lista e as vencedoras neste recorte.";
  const etapas = M.ETAPAS.filter((e) => dados.some((x) => x.etapa === e.id)).map((e) => e.rotulo);
  const ultimos = dados.filter((x) => x.rotulo === etapas.at(-1));
  desenhar(el, Plot.plot({
    width: largura(el), height: 340, marginRight: 150, style: estilo(), ariaLabel: "Participação de cada grupo por etapa",
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

function renderSegregacao(L) {
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
  const corTexto = (d) => textoSobre(d.pct / 100);
  const estreito = largura(el) < 560;
  desenhar(el, Plot.plot({
    width: largura(el), height: (estreito ? 110 : 60) + cats.length * 46, marginLeft: 96, marginTop: estreito ? 90 : 40, style: estilo(), ariaLabel: "Mapa de calor por categoria",
    x: { label: null, axis: "top", domain: M.INDICADORES.map((i) => i.rotulo), tickRotate: estreito ? -40 : 0 },
    y: { label: null, domain: cats },
    color: { type: "linear", domain: [0, 100], range: [css("--seq-0"), css("--seq-1")], legend: true, label: "%" },
    marks: [
      Plot.cell(s, { x: "indicador", y: "categoria", fill: "pct", inset: 1, rx: 4,
        channels: { n: "n", Total: (d) => `${d.total}${nPequeno(d.total)}` }, tip: { format: { fill: (v) => fmtPct(v) } } }),
      Plot.text(s, { x: "indicador", y: "categoria", text: (d) => `${fmtPct(d.pct)}\n(${d.n}/${d.total})`, fill: corTexto, fontSize: 11, lineHeight: 1.1 }),
    ],
  }));
  tabela($("#t-segregacao"), s, [
    { rot: "Categoria", k: "categoria" }, { rot: "Indicador", k: "indicador" }, { rot: "n", k: "n", num: true },
    { rot: "Total", k: "total", num: true }, { rot: "%", f: (d) => fmtPct(d.pct) + nPequeno(d.total), num: true },
  ]);
}

// Grade do Brasil: um quadrado por UF em posição aproximada (coluna, linha).
const GRADE = {
  RR: [2, 0], AP: [3, 0], AM: [1, 1], PA: [2, 1], MA: [3, 1], CE: [4, 1], RN: [5, 1],
  AC: [0, 2], RO: [1, 2], TO: [2, 2], PI: [3, 2], PE: [4, 2], PB: [5, 2],
  MT: [1, 3], GO: [2, 3], BA: [3, 3], SE: [4, 3], AL: [5, 3], MS: [1, 4], DF: [2, 4], MG: [3, 4], ES: [4, 4],
  SP: [2, 5], RJ: [3, 5], PR: [2, 6], SC: [2, 7], RS: [2, 8],
};
function renderGeografia(L) {
  const el = $("#g-mapa"), medida = $("#geo-medida").value;
  const u = M.porUF(L, D.ufs).map((d) => ({ ...d, col: GRADE[d.uf][0], lin: GRADE[d.uf][1], valor: d[medida] ?? 0 }));
  const max = d3.max(u, (d) => d.valor) || 1;
  const tamanho = Math.min(56, (largura(el) - 20) / 6.5);
  desenhar(el, Plot.plot({
    width: tamanho * 6 + 20, height: tamanho * 9 + 60, style: estilo(), ariaLabel: "Mapa do Brasil em grade por UF de nascimento",
    x: { axis: null, domain: d3.range(6) }, y: { axis: null, domain: d3.range(9) }, padding: 0.06,
    color: { type: "linear", domain: [0, max], range: [css("--seq-0"), css("--seq-1")], legend: true,
      label: medida === "pessoas" ? "Pessoas" : "Pessoas por milhão de hab.", tickFormat: (v) => fmt(v, medida === "pessoas" ? 0 : 1) },
    marks: [
      Plot.cell(u, { x: "col", y: "lin", fill: "valor", rx: 4,
        channels: { UF: "nome", Pessoas: "pessoas", "Por milhão": (d) => fmt(d.porMilhao, 2), Participações: "participacoes" },
        tip: { format: { x: false, y: false, fill: false } } }),
      Plot.text(u, { x: "col", y: "lin", text: (d) => `${d.uf}\n${fmt(d.valor, medida === "pessoas" ? 0 : 1)}`, fontSize: 11, lineHeight: 1.15,
        fill: (d) => textoSobre(d.valor / max) }),
    ],
  }));
  tabela($("#t-mapa"), [...u].sort((a, b) => b.pessoas - a.pessoas || a.uf.localeCompare(b.uf)), [
    { rot: "UF", k: "uf" }, { rot: "Região", k: "regiao" }, { rot: "Pessoas", k: "pessoas", num: true },
    { rot: "Participações", k: "participacoes", num: true }, { rot: "Por milhão de hab.", f: (d) => fmt(d.porMilhao, 2), num: true },
  ]);
  renderSankey(L);
}

function renderSankey(L) {
  const el = $("#g-sankey");
  const { nodes, links } = M.sankey(L, D.ufs);
  if (!links.length) return vazio(el), tabela($("#t-sankey"), [], []);
  const w = largura(el), h = Math.max(280, nodes.length * 26);
  const s = d3.sankey().nodeId((d) => d.id).nodeWidth(10).nodePadding(10).extent([[0, 6], [w, h - 6]])({ nodes: nodes.map((d) => ({ ...d })), links: links.map((d) => ({ ...d })) });
  const regiaoCor = cores("regiao");
  const corNo = (id) => {
    const reg = id.replace(/^Nasc\.: |^Editora: /, "");
    const i = regiaoCor.domain.indexOf(reg);
    return id.startsWith("Nasc") && i >= 0 ? regiaoCor.range[i] : css("--s-na");
  };
  const svg = d3.create("svg").attr("viewBox", [0, 0, w, h]).attr("width", w).attr("role", "img").attr("aria-label", "Fluxo da região de nascimento à região da editora e ao resultado");
  const tip = $("#tip-sankey");
  const mostrar = (ev, txt) => { tip.hidden = false; tip.textContent = txt; tip.style.left = `${ev.clientX + 12}px`; tip.style.top = `${ev.clientY + 12}px`; };
  svg.append("g").attr("fill", "none").selectAll("path").data(s.links).join("path")
    .attr("d", d3.sankeyLinkHorizontal())
    .attr("stroke", (d) => (d.source.id.startsWith("Nasc") ? corNo(d.source.id) : css("--eixo"))).attr("stroke-opacity", 0.45)
    .attr("stroke-width", (d) => Math.max(1, d.width))
    .on("pointermove", (ev, d) => mostrar(ev, `${d.source.id} → ${d.target.id}: ${d.value}`)).on("pointerleave", () => (tip.hidden = true));
  svg.append("g").selectAll("rect").data(s.nodes).join("rect")
    .attr("x", (d) => d.x0).attr("y", (d) => d.y0).attr("width", (d) => d.x1 - d.x0).attr("height", (d) => Math.max(1, d.y1 - d.y0)).attr("rx", 2)
    .attr("fill", (d) => corNo(d.id))
    .on("pointermove", (ev, d) => mostrar(ev, `${d.id}: ${d.value}`)).on("pointerleave", () => (tip.hidden = true));
  svg.append("g").attr("font-size", 11).attr("fill", css("--tinta")).selectAll("text").data(s.nodes).join("text")
    .attr("x", (d) => (d.x0 < w / 2 ? d.x1 + 6 : d.x0 - 6)).attr("y", (d) => (d.y0 + d.y1) / 2).attr("dy", "0.35em")
    .attr("text-anchor", (d) => (d.x0 < w / 2 ? "start" : "end")).text((d) => `${d.id.replace(/^(Nasc\.|Editora): /, "")} (${d.value})`);
  el.replaceChildren(svg.node());
  tabela($("#t-sankey"), links, [{ rot: "De", k: "source" }, { rot: "Para", k: "target" }, { rot: "Participações", k: "value", num: true }]);
}

function renderIdade(L) {
  const el = $("#g-idade");
  const dados = M.idades(L);
  if (!dados.length) return vazio(el, "Sem ano de nascimento no recorte."), tabela($("#t-idade"), [], []);
  const generos = M.ORDEM.genero.filter((g) => dados.some((d) => d.genero === g));
  const medianas = generos.map((g) => ({ genero: g, idade: M.mediana(dados.filter((d) => d.genero === g).map((d) => d.idade)) }));
  desenhar(el, Plot.plot({
    width: largura(el), height: 90 + generos.length * 110, marginLeft: 120, style: estilo(), ariaLabel: "Idade no ano do prêmio, por gênero",
    x: { label: "Idade no ano da edição", grid: true },
    fy: { domain: generos, label: null, tickFormat: rotulo },
    color: { ...cores("genero"), legend: true, tickFormat: rotulo },
    marks: [
      Plot.ruleX(medianas, { x: "idade", fy: "genero", stroke: css("--tinta-2"), strokeWidth: 1 }),
      Plot.text(medianas, { x: "idade", fy: "genero", text: (d) => `mediana ${fmt(d.idade, 1)}`, frameAnchor: "top", dy: 4, dx: 4, textAnchor: "start", fill: css("--tinta-2"), fontSize: 11 }),
      Plot.dot(dados, Plot.dodgeY("middle", {
        x: "idade", fy: "genero", fill: "genero", r: 4, stroke: css("--superficie"), strokeWidth: 1,
        channels: { Nome: "nome", Obra: "titulo", Edição: "ano", Categoria: "categoria" }, tip: { format: { fill: false, fy: false } },
      })),
    ],
  }));
  tabela($("#t-idade"), [...dados].sort((a, b) => a.idade - b.idade), [
    { rot: "Nome", k: "nome" }, { rot: "Idade", k: "idade", num: true }, { rot: "Gênero", f: (d) => rotulo(d.genero) },
    { rot: "Edição", k: "ano" }, { rot: "Categoria", k: "categoria" }, { rot: "Obra", k: "titulo" },
  ]);
}

function renderEditoras(L) {
  const el = $("#g-editoras"), el2 = $("#g-grupos");
  const e = M.editoras(L);
  if (!e.length) { vazio(el); vazio(el2); return; }
  const longo = e.flatMap((d) => [{ editora: d.editora, tipo: "Premiadas", n: d.premiadas }, { editora: d.editora, tipo: "Não premiadas", n: d.outras }]);
  desenhar(el, Plot.plot({
    width: largura(el), height: 40 + e.length * 26, marginLeft: Math.min(200, 8 + d3.max(e, (d) => d.editora.length) * 6.4), style: estilo(),
    ariaLabel: "Editoras com mais indicações",
    x: { label: "Indicações (obras)", grid: true }, y: { domain: e.map((d) => d.editora), label: null },
    color: { domain: ["Premiadas", "Não premiadas"], range: [css("--s1"), css("--s-na")], legend: true },
    marks: [
      Plot.barX(longo, Plot.stackX({ order: ["Premiadas", "Não premiadas"] }, { x: "n", y: "editora", fill: "tipo", insetTop: 4, insetBottom: 4, insetLeft: 1, insetRight: 1, tip: true })),
      Plot.ruleX([0], { stroke: css("--eixo") }),
    ],
  }));
  tabela($("#t-editoras"), e, [{ rot: "Editora", k: "editora" }, { rot: "Grupo", f: (d) => d.grupo ?? "independente" },
    { rot: "Indicações", k: "total", num: true }, { rot: "Premiadas", k: "premiadas", num: true }]);
  const g = M.gruposEditoriais(L);
  desenhar(el2, Plot.plot({
    width: largura(el2), height: 150, marginLeft: 80, style: estilo(), ariaLabel: "Grupos editoriais e independentes",
    x: { label: "% das obras", domain: [0, 100] }, y: { label: null, domain: ["Lista", "Premiadas"] },
    color: { domain: ["Grupos editoriais", "Independentes"], range: [css("--s1"), css("--s2")], legend: true },
    marks: [Plot.barX(g, Plot.stackX({ x: "pct", y: "etapa", fill: "tipo", insetTop: 8, insetBottom: 8, insetLeft: 1, insetRight: 1,
      channels: { n: "n", Total: (d) => `${d.total}${nPequeno(d.total)}` }, tip: { format: { x: (v) => fmtPct(v) } } }))],
  }));
  tabela($("#t-grupos"), g, [{ rot: "Etapa", k: "etapa" }, { rot: "Tipo", k: "tipo" }, { rot: "n", k: "n", num: true },
    { rot: "Total", k: "total", num: true }, { rot: "%", f: (d) => fmtPct(d.pct) + nPequeno(d.total), num: true }]);
}

function renderJuri(L) {
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
      Plot.barX(j, { x: "pct", y: "quem", fy: (d) => `${d.indicador} · ${d.ano}`, fill: "quem", insetTop: 3, insetBottom: 3, rx: 2,
        channels: { n: "n", Total: (d) => `${d.total}${nPequeno(d.total)}` }, tip: { format: { x: (v) => fmtPct(v), fy: false } } }),
      Plot.text(j, { x: "pct", y: "quem", fy: (d) => `${d.indicador} · ${d.ano}`, text: (d) => `${fmtPct(d.pct)} (${d.n}/${d.total})`, dx: 6, textAnchor: "start", fill: css("--tinta-2"), fontSize: 11 }),
      Plot.ruleX([0], { stroke: css("--eixo") }),
    ],
  }));
  tabela($("#t-juri"), j, [{ rot: "Edição", k: "ano" }, { rot: "Grupo", k: "quem" }, { rot: "Indicador", k: "indicador" },
    { rot: "n", k: "n", num: true }, { rot: "Total", k: "total", num: true }, { rot: "%", f: (d) => fmtPct(d.pct) + nPequeno(d.total), num: true }]);
}

// ---------- pessoas (RF-11) ----------
const ROT_RACA = { branca: "Branca", preta: "Preta", parda: "Parda", negra: "Negra (sem especificar)", amarela: "Amarela", indigena: "Indígena", sem_declaracao: "Sem declaração" };
const ROT_GEN = { mulher: "Mulher", homem: "Homem", nao_binario: "Não binária", nao_identificado: "Não identificado" };
function renderPessoas(L) {
  const termo = $("#busca").value.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{M}/gu, "");
  const lista = M.resumoPessoas(L, D.pessoas)
    .filter((p) => !termo || p.nome.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{M}/gu, "").includes(termo))
    .sort((a, b) => b.premios - a.premios || b.participacoes - a.participacoes || a.nome.localeCompare(b.nome, "pt-BR"));
  $("#t-pessoas").innerHTML = `<caption class="sr">Pessoas do recorte; clique para ver a ficha com fontes</caption>
    <thead><tr><th scope="col">Nome</th><th scope="col">Gênero</th><th scope="col">Raça declarada</th><th scope="col">UF nasc.</th><th class="num" scope="col">Participações</th><th class="num" scope="col">Prêmios</th></tr></thead>
    <tbody>${lista.map((p) => `<tr data-id="${esc(p.id)}" tabindex="0"><td>${esc(p.nome)}</td><td>${ROT_GEN[p.genero]}</td><td>${ROT_RACA[p.raca]}</td><td>${esc(p.uf_nascimento ?? "–")}</td><td class="num">${p.participacoes}</td><td class="num">${p.premios}</td></tr>`).join("")
    || `<tr><td colspan="6" class="vazio">Ninguém encontrado.</td></tr>`}</tbody>`;
}
function abrirFicha(id) {
  const p = pessoaPorId.get(id);
  const ls = D.participacao.filter((l) => l.pessoa_id === id);
  const fonte = (u) => (u ? ` <a href="${esc(u)}" target="_blank" rel="noopener noreferrer">fonte</a>` : ` <span class="muted">(sem fonte)</span>`);
  const res = (l) => (l.colocacao ? `${l.colocacao}º lugar` : l.lista_curta === 1 ? "finalista" : "lista");
  $("#ficha-corpo").innerHTML = `<div class="ficha"><h2 id="ficha-nome">${esc(p.nome)}</h2><dl>
    <dt>Gênero</dt><dd>${ROT_GEN[p.genero]}${p.genero !== "nao_identificado" ? fonte(p.genero_fonte) : ""}</dd>
    <dt>Raça</dt><dd>${ROT_RACA[p.raca]}${p.raca !== "sem_declaracao" ? `${fonte(p.raca_fonte)}<br><span class="muted">${p.raca_evidencia === "fonte_curada" ? "fonte curada por identidade" : "autodeclaração"}</span>${p.raca_trecho ? `<blockquote>${esc(p.raca_trecho)}</blockquote>` : ""}` : `<br><span class="muted">${p.raca_busca === "completa" ? "Nenhuma autodeclaração pública encontrada." : "Busca de autodeclaração ainda incompleta."} Isso não indica nenhuma raça.</span>`}</dd>
    <dt>Nascimento</dt><dd>${[p.municipio_nascimento, p.uf_nascimento, p.ano_nascimento].filter(Boolean).map(esc).join(" · ") || "–"}${p.uf_nascimento || p.ano_nascimento ? fonte(p.nascimento_fonte) : ""}</dd>
    ${p.wikidata ? `<dt>Wikidata</dt><dd><a href="https://www.wikidata.org/wiki/${esc(p.wikidata)}" target="_blank" rel="noopener noreferrer">${esc(p.wikidata)}</a></dd>` : ""}
  </dl><h3>Participações</h3><ul>${ls.map((l) => `<li>${l.ano} · ${esc(l.nome_original)} · <i>${esc(l.titulo)}</i>${l.editora ? ` (${esc(l.editora)})` : ""} · ${res(l)}${l.papel !== "autor" ? ` · ${l.papel}` : ""}</li>`).join("")}</ul>
  ${D.jurados.some((j) => j.pessoa_id === id) ? `<h3>Júri</h3><ul>${D.jurados.filter((j) => j.pessoa_id === id).map((j) => `<li>${j.ano} · ${esc(j.categoria)}</li>`).join("")}</ul>` : ""}</div>`;
  $("#ficha").showModal();
}
$("#t-pessoas").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) abrirFicha(tr.dataset.id); });
$("#t-pessoas").addEventListener("keydown", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrirFicha(tr.dataset.id); } });
$("#busca").addEventListener("input", () => renderPessoas(M.filtrar(D.participacao, estado)));

// ---------- chat (RF-12) ----------
const SUGESTOES = [
  "Quantos autores pretos nascidos em São Paulo chegaram à lista do Jabuti em Contos?",
  "Quantas mulheres nascidas no Nordeste foram premiadas?",
  "Quais autores nascidos em Santa Catarina foram mais premiados?",
  "Em que categoria a participação de mulheres é maior?",
  "Qual editora teve mais obras premiadas?",
];
const historico = [];
function mdSimples(t) {
  return esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`([^`]+)`/g, "<code>$1</code>")
    .split(/\n{2,}/).map((p) => `<p>${p.replace(/\n- /g, "<br>• ").replace(/^- /, "• ").replace(/\n/g, "<br>")}</p>`).join("");
}
function addMsg(classe, html) {
  const div = document.createElement("div");
  div.className = `msg ${classe}`;
  div.innerHTML = html;
  $("#conversa").append(div);
  div.scrollIntoView({ block: "nearest", behavior: "smooth" });
  return div;
}
async function perguntar(texto) {
  const botao = $("#chat button");
  addMsg("eu", esc(texto));
  const pend = addMsg("ia", `<span class="muted">Consultando o banco…</span>`);
  botao.disabled = true;
  try {
    const r = await fetch("api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pergunta: texto, historico: historico.slice(-6) }) });
    const corpo = await r.json().catch(() => ({ erro: `Resposta inválida do servidor (${r.status}).` }));
    if (!r.ok) throw new Error(corpo.erro ?? `Erro ${r.status}`);
    historico.push({ pergunta: texto, resposta: corpo.resposta });
    const sqls = corpo.consultas.map((c, i) => `<details><summary>Consulta ${i + 1}${c.truncado ? " (primeiras 200 linhas)" : ""}</summary><pre>${esc(c.sql)}</pre>
      <div class="rolagem"><table class="tabela"><thead><tr>${c.colunas.map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${c.linhas.slice(0, 50).map((l) => `<tr>${l.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`).join("");
    pend.innerHTML = mdSimples(corpo.resposta) + sqls;
  } catch (e) {
    pend.classList.add("erro");
    pend.innerHTML = location.protocol === "file:" ? "O chat precisa do servidor: rode <code>python server.py</code>." : esc(e.message.includes("fetch") ? "Servidor indisponível. O chat precisa de python server.py." : e.message);
  } finally {
    botao.disabled = false;
  }
}
$("#sugestoes").innerHTML = SUGESTOES.map((s) => `<button type="button">${esc(s)}</button>`).join("");
$("#sugestoes").addEventListener("click", (e) => { if (e.target.matches("button")) perguntar(e.target.textContent); });
$("#chat").addEventListener("submit", (e) => { e.preventDefault(); const t = $("#pergunta").value.trim(); if (t) { $("#pergunta").value = ""; perguntar(t); } });
$("#pergunta").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#chat").requestSubmit(); } });

// ---------- metodologia (RF-13) ----------
function renderCobertura() {
  const porAno = new Map(D.cobertura.map((c) => [c.ano, c]));
  tabela($("#t-cobertura"), ANOS.map((a) => ({ ano: a, ...(porAno.get(a) ?? {}) })), [
    { rot: "Edição", k: "ano" }, { rot: "Pessoas-autoras", f: (d) => d.pessoas ?? "não coletada", num: true },
    { rot: "Gênero", f: (d) => fmtPct(d.pct_genero), num: true }, { rot: "UF", f: (d) => fmtPct(d.pct_uf), num: true },
    { rot: "Raça declarada", f: (d) => fmtPct(d.pct_raca), num: true }, { rot: "Busca de raça completa", f: (d) => fmtPct(d.pct_busca_raca), num: true },
    { rot: "Idade", f: (d) => fmtPct(d.pct_idade), num: true },
  ]);
}

// ---------- ciclo ----------
function renderTudo() {
  const L = M.filtrar(D.participacao, estado);
  for (const f of [renderPanorama, renderEvolucao, renderFunil, renderSegregacao, renderGeografia, renderIdade, renderEditoras, renderJuri, renderPessoas]) {
    try { f(L); } catch (e) { console.error(f.name, e); }
  }
}
for (const id of ["#evo-dim", "#evo-etapa"]) $(id).addEventListener("change", () => renderEvolucao(M.filtrar(D.participacao, estado)));
$("#funil-dim").addEventListener("change", () => renderFunil(M.filtrar(D.participacao, estado)));
$("#geo-medida").addEventListener("change", () => renderGeografia(M.filtrar(D.participacao, estado)));
let larguraAnterior = innerWidth;
addEventListener("resize", () => { if (Math.abs(innerWidth - larguraAnterior) > 40) { larguraAnterior = innerWidth; clearTimeout(window.__rz); window.__rz = setTimeout(renderTudo, 200); } });

montarFiltros();
renderAviso();
renderCobertura();
renderTudo();
