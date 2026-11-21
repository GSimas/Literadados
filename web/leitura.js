// Módulo Leitura (spec RF-33, design D39): indicadores por território, ano e recorte. Dados em leitura.json (Brasil, regiões,
// UFs) e leitura/<indicador>/<UF>.json + leitura/municipios/<UF>.json (municípios), carregados quando a UF é escolhida.
import * as M from "./metricas.js";
import { $, $$, fmt, esc, css, largura, tabela, dica, desenhar, vazio, estilo, carregarGraficos, melhorarSelect, botaoExportarGrafico, textoSobre, luzNosBlocos, fecharPerfilAoClicarFora } from "./ui.js";
import { montarTema } from "./tema.js";
import { montarBusca } from "./busca.js";
import { montarDiadorim } from "./diadorim.js";
import { montarExportacao } from "./exportar.js";

const J = await fetch("leitura.json").then((r) => { if (!r.ok) throw new Error(`leitura.json: ${r.status}`); return r.json(); });
const IND = new Map(J.indicadores.map((i) => [i.id, i]));
const UFS = J.territorios.filter((t) => t.tipo === "uf").sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
const SIGLA = new Map(UFS.map((u) => [u.codigo, u.sigla])), COD_UF = new Map(UFS.map((u) => [u.sigla, u.codigo]));
const DIMS = { total: "Sem recorte", sexo: "Sexo", cor_raca: "Cor ou raça", faixa_etaria: "Faixa etária", escolaridade: "Escolaridade", rede: "Rede (escolas)", situacao: "Situação do domicílio" };

let estado = M.leituraDeTexto(location.search, J);
let linhas = M.expandirLeitura(J);
const carregadas = new Set(), municipios = new Map();  // "ind/UF" já expandidos; UF → lista de municípios
let malhaBR = null;
const malhas = new Map();

// ---------- formatação ----------
const unidade = (i) => IND.get(i).unidade;
export function fmtValor(l) {
  if (!l || l.suprimido) return "não publicado";
  return l.unidade === "percentual" ? `${fmt(l.valor, 1)}%` : l.unidade === "media" ? fmt(l.valor, 2) : fmt(l.valor);
}
// O n de cada número (RNF-02, CA-33.3): numerador e denominador no censo e no registro; amostra e margem na pesquisa.
function fmtN(l) {
  if (!l || l.suprimido) return "a fonte não publica este valor";
  if (l.tipo_fonte === "pesquisa_amostral") return `amostra ${fmt(l.amostra)} entrevistas${l.margem != null ? ` · margem ±${fmt(l.margem, 1)} p.p.` : " · margem não publicada pela fonte"}`;
  if (l.unidade === "percentual") return `${fmt(l.numerador)} de ${fmt(l.denominador)}`;
  if (l.unidade === "contagem") return l.por_100mil != null ? `${fmt(l.por_100mil, 1)} por 100 mil habitantes (população de 2022)` : "";
  return "";
}
const medidaMapa = (l) => (l.unidade === "contagem" ? l.por_100mil : l.valor);
const nomeTerr = (c) => (c === "BR" ? "Brasil" : J.territorios.find((t) => t.codigo === c)?.nome ?? municipioNome(c) ?? c);
const municipioNome = (c) => { for (const ms of municipios.values()) { const m = ms.municipios.find((x) => x[0] === c); if (m) return m[1]; } return null; };
const fonteLink = (l) => (l?.fonte_url ? `<a href="${esc(l.fonte_url)}" rel="noopener">fonte</a>` : "");

// ---------- carga sob demanda dos municípios de uma UF ----------
async function carregarUF(sigla, inds = [estado.i]) {
  if (!municipios.has(sigla)) {
    const r = await fetch(`leitura/municipios/${sigla}.json`);
    municipios.set(sigla, r.ok ? await r.json() : { municipios: [], pessoas: {} });
  }
  const novos = [];
  for (const i of inds) {
    const k = `${i}/${sigla}`;
    if (carregadas.has(k) || !J.por_uf.includes(k)) continue;
    carregadas.add(k);
    const v = await fetch(`leitura/${k}.json`).then((r) => r.json());
    novos.push({ uf: sigla, municipios: municipios.get(sigla).municipios, valores: v.valores });
  }
  if (novos.length) linhas = linhas.concat(M.expandirLeitura({ ...J, valores: [] }, novos));
}
async function malhaUF(sigla) {
  if (!malhas.has(sigla)) malhas.set(sigla, await fetch(`malha/${sigla}.json`).then((r) => r.json()));
  return malhas.get(sigla);
}

// ---------- controles e URL ----------
function opcoes(sel, itens, atual) {
  sel.innerHTML = itens.map(([v, r]) => `<option value="${esc(v)}"${String(v) === String(atual) ? " selected" : ""}>${esc(r)}</option>`).join("");
  sel.value = String(atual);
}
function dimensoesDe(i) {
  return Object.keys(DIMS).filter((d) => linhas.some((l) => l.indicador === i && l.dimensao === d) || (d === "total"));
}
function montarControles() {
  const ind = IND.get(estado.i);
  opcoes($("#leitura-indicador"), J.indicadores.map((x) => [x.id, x.nome]), estado.i);
  opcoes($("#leitura-ano"), M.anosLeitura(J, estado.i).slice().reverse().map((a) => [a, a]), estado.a);
  opcoes($("#leitura-recorte"), dimensoesDe(estado.i).map((d) => [d, DIMS[d]]), estado.r);
  // Indicador de Brasil e regiões (Retratos) não desce a UF: território fica no Brasil.
  const terrs = ind.nivel === "regiao" || ind.nivel === "brasil" ? [["BR", "Brasil"]] : [["BR", "Brasil"], ...UFS.map((u) => [u.codigo, u.nome])];
  if (!terrs.some(([c]) => c === estado.t)) estado.t = "BR";
  opcoes($("#leitura-territorio"), terrs, estado.t);
}
function mudar(novo) {
  estado = { ...estado, ...novo };
  if (novo.i) estado = { ...M.leituraDeTexto(M.leituraParaTexto({ ...estado, a: undefined }, J), J), r: dimensoesDe(estado.i).includes(estado.r) ? estado.r : "total" };
  const q = M.leituraParaTexto(estado, J);
  history.replaceState(null, "", `${location.pathname}${q ? `?${q}` : ""}${location.hash}`);
  renderTudo();
}
$("#leitura-indicador").addEventListener("change", (e) => mudar({ i: e.target.value }));
$("#leitura-ano").addEventListener("change", (e) => mudar({ a: +e.target.value }));
$("#leitura-recorte").addEventListener("change", (e) => mudar({ r: e.target.value }));
$("#leitura-territorio").addEventListener("change", (e) => mudar({ t: e.target.value }));

// ---------- desenho ----------
async function renderTudo() {
  const ind = IND.get(estado.i);
  if (estado.t !== "BR") await carregarUF(SIGLA.get(estado.t));
  montarControles();
  $("#leitura-onde").textContent = `${nomeTerr(estado.t)} · ${estado.a}`;
  $("#h-mapa").textContent = ind.nome;
  $("#leitura-definicao").innerHTML = `${esc(ind.definicao)}<br><span class="muted pequeno"><b>Limitações:</b> ${esc(ind.limitacoes)}</span>`;
  renderKpis(ind);
  await renderMapa(ind);
  await carregarGraficos();
  renderSerie(ind);
  renderRecorte(ind);
}

function renderKpis(ind) {
  const aqui = M.serieLeitura(linhas, { indicador: ind.id, territorio: estado.t }).find((l) => l.ano === estado.a);
  const br = M.serieLeitura(linhas, { indicador: ind.id, territorio: "BR" }).find((l) => l.ano === estado.a);
  const card = (rot, l, extra = "") => `<div class="kpi"><div class="rot">${esc(rot)}</div><div class="val">${fmtValor(l)}</div><div class="det">${esc(fmtN(l))} ${fonteLink(l)}${extra}</div></div>`;
  $("#leitura-kpis").innerHTML = card(`${nomeTerr(estado.t)}, ${estado.a}`, aqui)
    + (estado.t !== "BR" && br ? card(`Brasil, ${estado.a}`, br) : "")
    + `<div class="kpi"><div class="rot">Tipo de fonte</div><div class="val kpi-texto">${esc({ censo: "Censo", registro_administrativo: "Registro administrativo", pesquisa_amostral: "Pesquisa por amostra" }[ind.tipo_fonte])}</div><div class="det">${esc(ind.fonte_nome)}</div></div>`;
}

async function renderMapa(ind) {
  const el = $("#g-leitura-mapa");
  // Brasil e regiões só (Retratos): barras por região no lugar do mapa (a pesquisa não desce a UF).
  if (ind.nivel === "regiao" || ind.nivel === "brasil") {
    await carregarGraficos();
    const vs = M.valoresLeitura(linhas, { indicador: ind.id, ano: estado.a, tipo: "regiao" });
    if (!vs.length) return vazio(el, "Sem valores por região neste ano.");
    desenhar(el, Plot.plot({ ...estilo(), width: largura(el), height: 60 + vs.length * 34, marginLeft: 110, x: { label: ind.unidade === "percentual" ? "%" : null, grid: true },
      y: { label: null }, marks: [Plot.barX(vs, { x: "valor", y: "territorio_nome", fill: css("--marca"), sort: { y: "-x" }, tip: true,
        title: (l) => `${l.territorio_nome}: ${fmtValor(l)}\n${fmtN(l)}` }), Plot.ruleX([0])] }));
    el.setAttribute("aria-label", `${ind.nome} por região em ${estado.a}`);
    $("#leitura-legenda-fonte").textContent = `${ind.fonte_nome}. Por região, ${estado.a}.`;
    tabelaTerritorios(vs, ind);
    $("#leitura-lado").innerHTML = `<h3>Por região</h3><p class="muted">A pesquisa publica Brasil e regiões; UFs e municípios não têm amostra suficiente.</p>`;
    return;
  }
  const sigla = estado.t === "BR" ? null : SIGLA.get(estado.t);
  const malha = sigla ? await malhaUF(sigla) : (malhaBR ??= await fetch("br-uf.json").then((r) => r.json()));
  const vs = M.valoresLeitura(linhas, { indicador: ind.id, ano: estado.a, tipo: sigla ? "municipio" : "uf", uf: sigla });
  const chave = (f) => (sigla ? f.properties.codigo : COD_UF.get(f.properties.uf));
  const por = new Map(vs.map((l) => [l.territorio, l]));
  const w = Math.min(largura(el), 640), h = Math.round(w * 0.9);
  const proj = d3.geoIdentity().reflectY(true).fitExtent([[8, 8], [w - 8, h - 8]], malha);
  const caminho = d3.geoPath(proj);
  const pos = vs.map(medidaMapa).filter((v) => v != null).sort(d3.ascending);
  const rampa = d3.quantize(d3.interpolateLab(css("--seq-0"), css("--seq-1")), 5);
  const limites = pos.length > 4 ? [0.2, 0.4, 0.6, 0.8].map((q) => d3.quantileSorted(pos, q)) : [];
  const escala = d3.scaleThreshold().domain(limites).range(rampa);
  const cor = (l) => (l && medidaMapa(l) != null ? escala(medidaMapa(l)) : css("--grade"));
  const medida = ind.unidade === "contagem" ? "por 100 mil habitantes" : ind.unidade === "percentual" ? "%" : "";
  const svg = d3.create("svg").attr("viewBox", [0, 0, w, h]).attr("width", w).attr("role", "group")
    .attr("aria-label", `Mapa de ${ind.nome} ${sigla ? `nos municípios de ${nomeTerr(estado.t)}` : "por UF"}, ${estado.a}`);
  svg.append("g").selectAll("path").data(malha.features).join("path")
    .attr("class", "uf").attr("d", caminho).attr("fill", (f) => cor(por.get(chave(f))))
    .attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", (f) => { const l = por.get(chave(f)); return `${l?.territorio_nome ?? nomeTerr(chave(f))}: ${fmtValor(l)}`; })
    .on("pointermove", (ev, f) => { const l = por.get(chave(f));
      dica.mostrar(ev, `<b>${esc(l?.territorio_nome ?? nomeTerr(chave(f)))}</b>${fmtValor(l)}${l && ind.unidade === "contagem" ? ` (${fmt(l.por_100mil, 1)} por 100 mil)` : ""}<br>${esc(fmtN(l))}<br><span class="muted">${esc(ind.fonte_nome)}, ${estado.a}</span>`); })
    .on("pointerleave", dica.esconder)
    .on("click", (ev, f) => abrir(chave(f)))
    .on("keydown", (ev, f) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrir(chave(f)); } });
  if (!sigla) svg.append("g").attr("aria-hidden", "true").selectAll("text").data(malha.features.filter((f) => caminho.area(f) > 900)).join("text")
    .attr("transform", (f) => `translate(${caminho.centroid(f)})`).attr("text-anchor", "middle").attr("dy", "0.35em")
    .attr("fill", (f) => { const l = por.get(chave(f)); return l && medidaMapa(l) != null ? textoSobre((rampa.indexOf(escala(medidaMapa(l))) + 0.5) / 5) : css("--tinta-2"); })
    .text((f) => { const l = por.get(chave(f)); return `${f.properties.uf} ${l && medidaMapa(l) != null ? fmt(medidaMapa(l), ind.unidade === "contagem" ? 0 : 1) : ""}`; });
  const legenda = document.createElement("div");
  legenda.className = "mapa-legenda";
  legenda.innerHTML = `<span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${css("--grade")};vertical-align:-1px"></i> sem valor</span>
    <span class="escala">${rampa.map((c) => `<i style="background:${c}"></i>`).join("")}</span>
    <span>${fmt(pos[0], 1)} → ${fmt(pos.at(-1), 1)} ${medida} (quintis)</span>`;
  el.replaceChildren(svg.node(), legenda, botaoExportarGrafico());
  $("#leitura-legenda-fonte").textContent = `${ind.fonte_nome}, ${estado.a}. Malha: IBGE.${ind.unidade === "contagem" ? " Cor por 100 mil habitantes (população do Censo 2022)." : ""} Clique num território para abrir o perfil.`;
  tabelaTerritorios(vs, ind);
  const ord = [...vs].filter((l) => !l.suprimido).sort((a, b) => medidaMapa(b) - medidaMapa(a));
  const item = (l) => `<li><a href="${sigla ? `#/municipio/${l.territorio}` : `#/uf/${SIGLA.get(l.territorio)}`}">${esc(l.territorio_nome)}</a> — ${fmtValor(l)}${ind.unidade === "contagem" ? ` (${fmt(l.por_100mil, 1)}/100 mil)` : ""}</li>`;
  $("#leitura-lado").innerHTML = `<h3>${sigla ? `Municípios de ${esc(nomeTerr(estado.t))}` : "Estados"}</h3>
    <p class="muted pequeno">${fmt(vs.length)} com valor em ${estado.a}.</p>
    <p class="pequeno"><b>Maiores</b></p><ol>${ord.slice(0, 5).map(item).join("")}</ol>
    <p class="pequeno"><b>Menores</b></p><ol>${ord.slice(-5).reverse().map(item).join("")}</ol>`;
}
function abrir(c) { location.hash = estado.t === "BR" ? `#/uf/${SIGLA.get(c)}` : `#/municipio/${c}`; }

function tabelaTerritorios(vs, ind) {
  const cols = [{ rot: "Território", k: "territorio_nome" }, { rot: ind.nome, f: fmtValor, num: true }];
  if (ind.unidade === "percentual" && ind.tipo_fonte !== "pesquisa_amostral") cols.push({ rot: "Numerador", f: (l) => fmt(l.numerador), num: true }, { rot: "Denominador", f: (l) => fmt(l.denominador), num: true });
  if (ind.unidade === "contagem") cols.push({ rot: "Por 100 mil hab.", f: (l) => fmt(l.por_100mil, 1), num: true });
  if (ind.tipo_fonte === "pesquisa_amostral") cols.push({ rot: "Amostra", f: (l) => fmt(l.amostra), num: true });
  tabela($("#t-leitura"), [...vs].sort((a, b) => (medidaMapa(b) ?? -1) - (medidaMapa(a) ?? -1)), cols);
}

function renderSerie(ind) {
  const el = $("#g-leitura-serie");
  const s = M.serieLeitura(linhas, { indicador: ind.id, territorio: estado.t }).filter((l) => !l.suprimido);
  $("#leitura-serie-titulo").textContent = `${ind.nome} em ${nomeTerr(estado.t)}, por ano`;
  if (s.length < 2) return vazio(el, s.length ? `Um ano só (${s[0].ano}): não há série.` : "Sem valores para este território.");
  const comMargem = s.filter((l) => l.margem != null);
  desenhar(el, Plot.plot({ ...estilo(), width: largura(el), height: 280, marginLeft: 48, x: { label: null, tickFormat: "d" },
    y: { label: ind.unidade === "percentual" ? "%" : null, grid: true, zero: ind.unidade !== "percentual" },
    marks: [comMargem.length ? Plot.ruleX(comMargem, { x: "ano", y1: (l) => l.valor - l.margem, y2: (l) => l.valor + l.margem, stroke: css("--tinta-2"), strokeWidth: 3, strokeOpacity: 0.35 }) : null,
      Plot.line(s, { x: "ano", y: "valor", stroke: css("--marca"), strokeWidth: 2 }),
      Plot.dot(s, { x: "ano", y: "valor", fill: css("--marca"), r: 4, tip: true, title: (l) => `${l.ano}: ${fmtValor(l)}\n${fmtN(l)}` })] }));
}

function renderRecorte(ind) {
  const el = $("#g-leitura-recorte");
  $("#leitura-recorte-titulo").textContent = estado.r === "total" ? "Recorte" : `${DIMS[estado.r]} em ${nomeTerr(estado.t)}, ${estado.a}`;
  if (estado.r === "total") { $("#t-leitura-recorte").innerHTML = ""; return vazio(el, "Escolha um recorte (sexo, cor ou raça, faixa etária…) para comparar grupos."); }
  const vs = M.recortesLeitura(linhas, J, { indicador: ind.id, territorio: estado.t, ano: estado.a, dimensao: estado.r });
  if (!vs.length) { $("#t-leitura-recorte").innerHTML = ""; return vazio(el, "A fonte não publica este recorte neste território e ano."); }
  const ok = vs.filter((l) => !l.suprimido);
  desenhar(el, Plot.plot({ ...estilo(), width: largura(el), height: 60 + vs.length * 32, marginLeft: 150, x: { label: ind.unidade === "percentual" ? "%" : null, grid: true },
    y: { label: null, domain: vs.map((l) => l.categoria_rotulo) },
    marks: [Plot.barX(ok, { x: "valor", y: "categoria_rotulo", fill: css("--marca"), tip: true, title: (l) => `${l.categoria_rotulo}: ${fmtValor(l)}\n${fmtN(l)}` }),
      Plot.text(ok, { x: "valor", y: "categoria_rotulo", text: fmtValor, dx: 6, textAnchor: "start", fill: css("--tinta") }),
      Plot.text(vs.filter((l) => l.suprimido), { x: 0, y: "categoria_rotulo", text: () => "não publicado pela fonte", dx: 6, textAnchor: "start", fill: css("--tinta-2") }),
      Plot.ruleX([0])] }));
  const cols = [{ rot: DIMS[estado.r], k: "categoria_rotulo" }, { rot: ind.nome, f: fmtValor, num: true }, { rot: "n", f: fmtN }];
  tabela($("#t-leitura-recorte"), vs, cols);
}

function renderCobertura() {
  tabela($("#t-cobertura"), J.cobertura.map((c) => ({ ...c, ind: IND.get(c.indicador) })), [
    { rot: "Indicador", f: (c) => c.ind.nome }, { rot: "Fonte", f: (c) => c.ind.fonte_nome },
    { rot: "Anos", f: (c) => (c.anos.length > 3 ? `${c.anos[0]}–${c.anos.at(-1)} (${c.anos.length})` : c.anos.join(", ")) },
    { rot: "Nível mais fino", f: (c) => ({ municipio: "município", uf: "UF", regiao: "região", brasil: "Brasil" }[c.ind.nivel]) },
    { rot: "Territórios com valor", f: (c) => fmt(c.territorios), num: true }, { rot: "Municípios", f: (c) => fmt(c.municipios), num: true },
  ]);
}

// ---------- perfis de município e de UF (CA-32.4, D38) ----------
async function perfilTerritorio(codigo) {
  const ehMun = /^\d{7}$/.test(codigo), sigla = ehMun ? SIGLA.get(codigo.slice(0, 2)) : codigo;
  const cod = ehMun ? codigo : COD_UF.get(sigla);
  if (!cod || !sigla) return null;
  if (ehMun) await carregarUF(sigla, J.indicadores.map((i) => i.id));
  const nome = nomeTerr(cod);
  const blocos = J.indicadores.map((ind) => {
    const s = M.serieLeitura(linhas, { indicador: ind.id, territorio: cod });
    if (!s.length) return "";
    const ult = s.at(-1);
    const dims = [...new Set(linhas.filter((l) => l.indicador === ind.id && l.territorio === cod && l.ano === ult.ano && l.dimensao !== "total").map((l) => l.dimensao))];
    const rec = dims.map((d) => `<p class="pequeno"><b>${esc(DIMS[d])}:</b> ${M.recortesLeitura(linhas, J, { indicador: ind.id, territorio: cod, ano: ult.ano, dimensao: d })
      .map((l) => `${esc(l.categoria_rotulo)} ${fmtValor(l)}`).join(" · ")}</p>`).join("");
    const serie = s.length > 1 ? `<p class="muted pequeno">Série: ${s.map((l) => `${l.ano} ${fmtValor(l)}`).join(" · ")}</p>` : "";
    return `<section class="cartao"><p class="sobretitulo">${esc(ind.fonte_nome)}</p><h3>${esc(ind.nome)}: ${fmtValor(ult)} <small class="muted">(${ult.ano})</small></h3>
      <p class="pequeno">${esc(fmtN(ult))} · ${fonteLink(ult)}</p>${rec}${serie}</section>`;
  }).join("");
  const pessoas = ehMun ? municipios.get(sigla)?.pessoas?.[cod] ?? [] : [];
  const blocoPremios = ehMun ? `<section class="cartao"><p class="sobretitulo">Prêmios</p><h3>Pessoas-autoras nascidas aqui</h3>
    ${pessoas.length ? `<ul class="lista-pessoas">${pessoas.map(([id, n]) => `<li><a href="premios.html#/pessoa/${esc(id)}">${esc(n)}</a></li>`).join("")}</ul>` : `<p class="muted">Ninguém da base de prêmios nasceu aqui (ou o local de nascimento ainda não é conhecido).</p>`}</section>`
    : `<section class="cartao"><p class="sobretitulo">Prêmios</p><p><a class="botao" href="premios.html#/uf/${esc(sigla)}">Quem nasceu em ${esc(nome)} nos prêmios →</a></p></section>`;
  let blocoMapa = "";
  if (ehMun) {
    const m = await fetch(`mapeamento/${cod}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (m) blocoMapa = `<section class="cartao"><p class="sobretitulo">Mapeamento</p><h3>Cena literária mapeada</h3>
      <p>${fmt(m.livrarias.filter((x) => x.situacao === "ativa").length)} livrarias ativas · ${fmt(m.editoras.length)} editoras · ${fmt(m.pessoas.length)} autoras e autores mapeados</p>
      <p><a class="botao" href="mapeamento.html">Abrir o mapeamento →</a></p></section>`;
  }
  let blocoEventos = "";
  const EVJ = await fetch("eventos.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (EVJ) {
    const doLugar = EVJ.eventos.filter((e) => (ehMun ? e.municipio === cod : EVJ.municipios[e.municipio]?.[1] === sigla));
    if (doLugar.length) blocoEventos = `<section class="cartao"><p class="sobretitulo">Eventos</p><h3>Eventos literários ${ehMun ? "na cidade" : "no estado"}</h3>
      <ul>${doLugar.map((e) => `<li><a href="eventos.html#/evento/${esc(e.id)}">${esc(e.nome)}</a></li>`).join("")}</ul></section>`;
  }
  const pop = ehMun ? municipios.get(sigla)?.municipios.find((x) => x[0] === cod)?.[2] : J.territorios.find((t) => t.codigo === cod)?.populacao_2022;
  return `<header class="perfil-cab simples"><p class="sobretitulo">${ehMun ? `Município · ${esc(sigla)}` : "Estado"}</p><h2 id="perfil-nome">${esc(nome)}</h2>
    <p class="muted">População (Censo 2022): ${fmt(pop)} · código IBGE ${esc(cod)}</p></header>
    <div class="perfil-lugar">${blocos || `<p class="muted">Sem indicadores para este território.</p>`}${blocoPremios}${blocoMapa}${blocoEventos}</div>`;
}

let fundo = "";
async function rota() {
  const m = location.hash.match(/^#\/(municipio|uf)\/([\w]+)$/);
  const dlg = $("#perfil");
  if (!m) { if (dlg.open) dlg.close(); fundo = location.hash; return; }
  const html = await perfilTerritorio(m[2]);
  if (!html) return;
  $("#perfil-corpo").innerHTML = html;
  if (!dlg.open) dlg.showModal();
}
$("#perfil").addEventListener("close", () => { if (/^#\/(municipio|uf)\//.test(location.hash)) history.replaceState(null, "", `${location.pathname}${location.search}${fundo}`); });
addEventListener("hashchange", rota);
fecharPerfilAoClicarFora($("#perfil"));

// ---------- início ----------
montarTema(() => renderTudo());
montarControles();
$$(".leitura-controles select").forEach(melhorarSelect);  // menus próprios (CA-19.2); o MutationObserver refaz as opções
montarBusca(null, "/premios.html");
montarDiadorim();
montarExportacao();
renderCobertura();
$("#gerado-em").textContent = `Dados gerados em ${new Date(J.gerado_em).toLocaleString("pt-BR")}.`;
await renderTudo();
rota();
luzNosBlocos();
addEventListener("resize", () => { clearTimeout(window._rs); window._rs = setTimeout(renderTudo, 200); });
