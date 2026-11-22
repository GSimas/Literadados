// Módulo Eventos (spec RF-35, design D41): eventos literários do Brasil, edições passadas e futuras. Dados em eventos.json.
import * as M from "./metricas.js";
import { $, $$, fmt, esc, css, largura, tabela, dica, desenhar, vazio, estilo, carregarGraficos, melhorarSelect, botaoExportarGrafico, textoSobre, luzNosBlocos, fecharPerfilAoClicarFora, enxugar } from "./ui.js";
import { montarFundo, montarTema } from "./tema.js";
import { montarBusca } from "./busca.js";
import { montarDiadorim } from "./diadorim.js";
import { montarExportacao } from "./exportar.js";

const J = await fetch("eventos.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
const pad = (n) => String(n).padStart(2, "0");
const d = new Date(), HOJE = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;  // data local do navegador (DB-10)
const EV = new Map((J?.eventos ?? []).map((e) => [e.id, e]));
const R = J ? M.resumoEventos(J, HOJE) : null;
const ANO_PADRAO = R?.anos.includes(d.getFullYear()) ? d.getFullYear() : R?.anos.at(-1);
let filtro = J ? M.eventosDeTexto(location.search, ANO_PADRAO) : null;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SIT_ROT = { ...M.SITUACOES_EVENTO, a_conferir: "Prevista, a conferir" };
const dataBR = (s) => new Date(`${s}T12:00:00`).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
const periodo = (e) => (e.inicio === e.fim ? dataBR(e.inicio) : `${dataBR(e.inicio)} a ${dataBR(e.fim)}`) + ` de ${e.fim.slice(0, 4)}`;
const cidade = (c) => (J.municipios[c] ? `${J.municipios[c][0]} (${J.municipios[c][1]})` : c);
const link = (u, t) => (u ? `<a href="${esc(u)}" rel="noopener" target="_blank">${t}</a>` : "");

function renderNumeros() {
  if (!J) { $("#eventos-kpis").innerHTML = `<p class="vazio">Ainda não há eventos no cadastro.</p>`; return; }
  $("#eventos-verificado").textContent = `Mapeados até agora · conferido até ${new Date(`${R.verificadoAte}T12:00:00`).toLocaleDateString("pt-BR")}${R.aConferir ? ` · ${fmt(R.aConferir)} edição(ões) prevista(s) com data já passada, a conferir` : ""}.`;
  const card = (rot, val, det) => `<div class="kpi"><div class="rot">${rot}</div><div class="val">${val}</div><div class="det">${det}</div></div>`;
  $("#eventos-kpis").innerHTML = card("Eventos mapeados", fmt(R.eventos), `${fmt(R.ufs)} UFs`)
    + card("Edições", fmt(R.edicoes), `${R.anos[0]}–${R.anos.at(-1)}`)
    + card("Próximas edições", fmt(R.proximos), `a partir de ${new Date(`${HOJE}T12:00:00`).toLocaleDateString("pt-BR")}`);
}

function renderProximos() {
  if (!J) return;
  const ps = M.proximosEventos(J.edicoes, HOJE, 12);
  $("#eventos-proximos").innerHTML = ps.length ? ps.map((e) => { const ev = EV.get(e.evento);
    return `<a class="cartao-grafico" href="#/evento/${esc(e.evento)}"><span class="cg-sobre">${esc(M.TIPOS_EVENTO[ev.tipo])} · ${esc(cidade(e.municipio))}</span>
      <span class="cg-titulo">${esc(ev.nome)}</span><span class="cg-desc">${esc(periodo(e))}${e.tema ? ` · ${esc(e.tema)}` : ""}</span>
      <span class="cg-num">${esc(SIT_ROT[M.situacaoEvento(e, HOJE)])}</span></a>`; }).join("")
    : `<p class="muted">Nenhuma edição futura no cadastro.</p>`;
}

function opcoes(sel, itens, atual) {
  sel.innerHTML = itens.map(([v, r]) => `<option value="${esc(v)}"${String(v) === String(atual) ? " selected" : ""}>${esc(r)}</option>`).join("");
  sel.value = String(atual);
}
function montarFiltros() {
  const ufs = [...new Set(Object.values(J.municipios).map((m) => m[1]))].sort();
  opcoes($("#ev-ano"), R.anos.slice().reverse().map((a) => [a, a]), filtro.ano);
  opcoes($("#ev-tipo"), [["", "Todos"], ...Object.entries(M.TIPOS_EVENTO)], filtro.tipo);
  opcoes($("#ev-uf"), [["", "Todas"], ...ufs.map((u) => [u, u])], filtro.uf);
  opcoes($("#ev-sit"), [["", "Todas"], ...Object.entries(M.SITUACOES_EVENTO)], filtro.sit);
  for (const [id, k] of [["#ev-ano", "ano"], ["#ev-tipo", "tipo"], ["#ev-uf", "uf"], ["#ev-sit", "sit"]]) {
    $(id).addEventListener("change", (e) => { filtro = { ...filtro, [k]: k === "ano" ? +e.target.value : e.target.value };
      const q = M.eventosParaTexto(filtro, ANO_PADRAO); history.replaceState(null, "", `${location.pathname}${q ? `?${q}` : ""}${location.hash}`); renderFiltrado(); });
    melhorarSelect($(id));
  }
}

// Gráfico de tempo do ano (CA-35.5): uma barra por edição, do primeiro ao último dia, sobre os meses; hoje marcado.
const dia = (s) => new Date(`${s}T00:00:00`);
const curto = (s, n = 42) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
async function renderLinhaDoAno(eds) {
  const el = $("#eventos-calendario");
  const ano = filtro.ano;
  const linhas = eds.filter((e) => +e.inicio.slice(0, 4) === ano).sort((a, b) => a.inicio.localeCompare(b.inicio) || a.evento.localeCompare(b.evento))
    .map((e) => { const ev = EV.get(e.evento);
      return { ...e, nome: ev.nome, tipo: M.TIPOS_EVENTO[ev.tipo], rotulo: `${curto(ev.nome)} · ${dataBR(e.inicio)}`, x1: dia(e.inicio),
        x2: new Date(dia(e.fim).getTime() + 864e5), sit: SIT_ROT[M.situacaoEvento(e, HOJE)] }; });
  if (!linhas.length) return vazio(el, `Nenhuma edição mapeada em ${ano} com esses filtros.`);
  await carregarGraficos();
  const inicioAno = new Date(ano, 0, 1), fimAno = new Date(ano + 1, 0, 1), hoje = dia(HOJE);
  const meses = d3.range(12).map((m) => new Date(ano, m, 1));
  const w = largura(el);
  // Nome ao lado da barra, do lado que tem espaço (antes de julho, à direita; depois, à esquerda): sem margem fixa que corte o texto.
  // O nome é cortado pelo espaço real (px) do lado escolhido; ~6,6 px por caractere a 11,5 px de corpo.
  const largAno = fimAno - inicioAno, px = (t) => 8 + ((t - inicioAno) / largAno) * (w - 16);
  for (const l of linhas) {
    const dir = w - 8 - px(l.x2) - 10, esq = px(l.x1) - 8 - 10;
    l.lado = dir >= esq ? "dir" : "esq";
    const data = ` · ${dataBR(l.inicio)}`, cabe = Math.floor(Math.max(dir, esq) / 6.6) - data.length;
    l.texto = cabe >= 6 ? `${curto(l.nome, cabe)}${data}` : curto(l.nome, Math.max(4, Math.floor(Math.max(dir, esq) / 6.6)));
  }
  const mes = (d) => (w < 560 ? MESES[d.getMonth()][0].toUpperCase() : MESES[d.getMonth()].slice(0, 3));
  const plot = Plot.plot({ ...estilo(), width: w, height: 56 + linhas.length * 26, marginLeft: 8, marginRight: 8, marginTop: 34,
    x: { domain: [inicioAno, fimAno], ticks: meses, tickFormat: mes, label: null, axis: "top", grid: true },
    y: { domain: linhas.map((l) => l.rotulo), axis: null },
    color: { legend: true, domain: Object.values(M.TIPOS_EVENTO).filter((t) => linhas.some((l) => l.tipo === t)) },
    marks: [
      hoje >= inicioAno && hoje < fimAno ? Plot.ruleX([hoje], { stroke: css("--marca"), strokeWidth: 2, strokeDasharray: "4 3" }) : null,
      Plot.barX(linhas, { x1: "x1", x2: "x2", y: "rotulo", fill: "tipo", rx: 3, insetTop: 4, insetBottom: 4,
        fillOpacity: (l) => (l.situacao === "realizada" ? 1 : 0.55), tip: true,
        title: (l) => `${l.nome}\n${periodo(l)} · ${cidade(l.municipio)}\n${l.sit}` }),
      Plot.text(linhas.filter((l) => l.lado === "dir"), { x: "x2", y: "rotulo", text: "texto", dx: 6, textAnchor: "start", fill: css("--tinta"), fontSize: 11.5 }),
      Plot.text(linhas.filter((l) => l.lado === "esq"), { x: "x1", y: "rotulo", text: "texto", dx: -6, textAnchor: "end", fill: css("--tinta"), fontSize: 11.5 }),
      hoje >= inicioAno && hoje < fimAno ? Plot.text([hoje], { x: (d) => d, frameAnchor: "top", text: () => "hoje", dy: -2, fill: css("--marca"), fontWeight: 600 }) : null,
    ] });
  plot.setAttribute("aria-label", `Gráfico de tempo das edições de eventos literários em ${ano}`);
  desenhar(el, plot);
  // Clique numa barra abre o perfil do evento (as barras saem na ordem dos dados).
  plot.querySelectorAll('g[aria-label="bar"] rect').forEach((r, i) => {
    r.style.cursor = "pointer";
    r.addEventListener("click", () => { location.hash = `#/evento/${linhas[i].evento}`; });
  });
}

async function renderFiltrado() {
  const eds = M.filtrarEventos(J, filtro);
  renderLinhaDoAno(eds);
  renderMapa(eds);
  tabela($("#t-eventos"), [...eds].sort((a, b) => a.inicio.localeCompare(b.inicio)), [
    { rot: "Evento", f: (e) => EV.get(e.evento).nome }, { rot: "Datas", f: periodo }, { rot: "Cidade", f: (e) => cidade(e.municipio) },
    { rot: "Situação", f: (e) => SIT_ROT[M.situacaoEvento(e, HOJE)] }]);
  $$("#t-eventos tbody tr").forEach((tr, i) => { const e = [...eds].sort((a, b) => a.inicio.localeCompare(b.inicio))[i]; const td = tr.querySelector("td");
    if (td && e) td.innerHTML = `<a href="#/evento/${esc(e.evento)}">${td.innerHTML}</a>`; });
}

let malha = null;
async function renderMapa(eds) {
  const el = $("#g-eventos-mapa");
  malha ??= await fetch("br-uf.json").then((r) => r.json());
  const por = d3.rollup(eds, (v) => v.length, (e) => J.municipios[e.municipio]?.[1]);
  const w = Math.min(largura(el), 620), h = Math.round(w * 0.98);
  const proj = d3.geoIdentity().reflectY(true).fitExtent([[8, 8], [w - 8, h - 8]], malha), caminho = d3.geoPath(proj);
  const max = d3.max([...por.values()]) ?? 0;
  const cor = d3.scaleSequential(d3.interpolateLab(css("--seq-0"), css("--seq-1"))).domain([0, Math.max(1, max)]);
  const svg = d3.create("svg").attr("viewBox", [0, 0, w, h]).attr("width", w).attr("role", "group").attr("aria-label", `Edições de eventos por UF em ${filtro.ano}`);
  svg.append("g").selectAll("path").data(malha.features).join("path").attr("class", "uf").attr("d", caminho)
    .attr("fill", (f) => (por.get(f.properties.uf) ? cor(por.get(f.properties.uf)) : css("--grade")))
    .on("pointermove", (ev, f) => dica.mostrar(ev, `<b>${esc(f.properties.uf)}</b>${fmt(por.get(f.properties.uf) ?? 0)} edição(ões) em ${filtro.ano}`))
    .on("pointerleave", dica.esconder)
    .on("click", (ev, f) => { filtro = { ...filtro, uf: filtro.uf === f.properties.uf ? "" : f.properties.uf }; $("#ev-uf").value = filtro.uf;
      $("#ev-uf").dispatchEvent(new Event("change")); });
  svg.append("g").attr("aria-hidden", "true").selectAll("text").data(malha.features.filter((f) => caminho.area(f) > 900 && por.get(f.properties.uf))).join("text")
    .attr("transform", (f) => `translate(${caminho.centroid(f)})`).attr("text-anchor", "middle").attr("dy", "0.35em")
    .attr("fill", (f) => textoSobre(por.get(f.properties.uf) / Math.max(1, max))).text((f) => `${f.properties.uf} ${por.get(f.properties.uf)}`);
  el.replaceChildren(svg.node(), botaoExportarGrafico());
}

// ---------- perfil de evento (CA-35.6) ----------
async function perfil(id) {
  const ev = EV.get(id);
  if (!ev) return null;
  const eds = J.edicoes.filter((e) => e.evento === id).sort((a, b) => b.inicio.localeCompare(a.inicio));
  const hom = (e) => J.homenageados.filter((h) => h.evento === id && h.inicio === e.inicio)
    .map((h) => (h.pessoa_id ? `<a href="premios.html#/pessoa/${esc(h.pessoa_id)}">${esc(h.nome)}</a>` : esc(h.nome))).join(", ");
  const linhas = eds.map((e) => `<tr><td>${esc(e.numero ? `${e.numero}ª` : "")}</td><td>${esc(periodo(e))}</td><td>${esc(cidade(e.municipio))}${e.local ? ` · ${esc(e.local)}` : ""}</td>
    <td>${esc(e.tema ?? "")}${hom(e) ? `<br><span class="muted pequeno">Homenagem: ${hom(e)}</span>` : ""}</td>
    <td>${esc(SIT_ROT[M.situacaoEvento(e, HOJE)])}${e.formato && e.formato !== "presencial" ? ` · ${esc(e.formato)}` : ""}</td>
    <td class="num">${e.publico ? `${fmt(e.publico)} ${link(e.publico_fonte, "(fonte)")}` : ""}</td><td>${link(e.fonte, "fonte")}</td></tr>`).join("");
  return `<header class="perfil-cab simples"><p class="sobretitulo">${esc(M.TIPOS_EVENTO[ev.tipo])} · ${esc(cidade(ev.municipio))}</p><h2 id="perfil-nome">${esc(ev.nome)}</h2>
    <p>${ev.organizador ? `Organização: ${esc(ev.organizador)} · ` : ""}${ev.ano_inicio ? `desde ${ev.ano_inicio} · ` : ""}${fmt(eds.length)} edição(ões) no cadastro
    ${ev.site ? ` · ${link(ev.site, "site")}` : ""}</p></header>
    <div class="perfil-lugar"><div class="grafico" id="g-evento-linha"></div>
    <div class="tabela-exportavel"><div class="rolagem"><table class="tabela"><thead><tr><th scope="col">Edição</th><th scope="col">Datas</th><th scope="col">Onde</th>
    <th scope="col">Tema e homenagem</th><th scope="col">Situação</th><th class="num" scope="col">Público</th><th scope="col">Fonte</th></tr></thead><tbody>${linhas}</tbody></table></div></div>
    <p class="muted pequeno">Fonte do cadastro: ${link(ev.fonte, "página consultada")} · conferido em ${new Date(`${ev.verificado_em}T12:00:00`).toLocaleDateString("pt-BR")}.</p></div>`;
}
async function linhaDoTempo(id) {
  const el = document.getElementById("g-evento-linha");
  const eds = J.edicoes.filter((e) => e.evento === id).map((e) => ({ ...e, ano: +e.inicio.slice(0, 4), sit: SIT_ROT[M.situacaoEvento(e, HOJE)] }));
  if (!el || eds.length < 2) return;
  await carregarGraficos();
  // Eixo de anos inteiros (sem rótulos repetidos quando há poucas edições), no máximo ~12 rótulos.
  const [a0, a1] = d3.extent(eds, (e) => e.ano), passo = Math.max(1, Math.ceil((a1 - a0 + 1) / 12));
  desenhar(el, Plot.plot({ ...estilo(), width: largura(el), height: 120, marginLeft: 24, marginRight: 24,
    x: { label: null, tickFormat: "d", domain: [a0 - 0.5, a1 + 0.5], ticks: d3.range(a0, a1 + 1, passo) }, y: { axis: null },
    color: { legend: true, domain: Object.values(SIT_ROT) },
    marks: [Plot.ruleY([0], { stroke: css("--borda") }), Plot.dot(eds, { x: "ano", y: () => 0, r: 6, fill: "sit", tip: true, title: (e) => `${e.ano}: ${periodo(e)}\n${e.sit}` })] }));
}
let fundo = "";
async function rota() {
  const m = location.hash.match(/^#\/evento\/([\w-]+)$/), dlg = $("#perfil");
  if (!m || !J) { if (dlg.open) dlg.close(); fundo = location.hash; return; }
  const html = await perfil(m[1]);
  if (!html) return;
  $("#perfil-corpo").innerHTML = html;
  if (!dlg.open) dlg.showModal();
  linhaDoTempo(m[1]);
}
$("#perfil").addEventListener("close", () => { if (/^#\/evento\//.test(location.hash)) history.replaceState(null, "", `${location.pathname}${location.search}${fundo}`); });
addEventListener("hashchange", rota);
fecharPerfilAoClicarFora($("#perfil"));

// ---------- início ----------
montarFundo(document.querySelector(".modulo-fundo .portal-fundo"));
montarTema(() => J && renderFiltrado());
montarBusca(null, "/premios.html");
montarDiadorim();
montarExportacao();
renderNumeros();
renderProximos();
if (J) { montarFiltros(); await renderFiltrado(); $("#gerado-em").textContent = `Dados gerados em ${new Date(J.gerado_em).toLocaleString("pt-BR")}.`; }
rota();
luzNosBlocos();
enxugar();  // leads longos: 1ª frase à vista, o resto num "i"
