// Módulo Mapeamento (spec RF-34, design D40): cadastro curado da cena literária de um município (hoje Florianópolis).
// Dados em mapeamento/<código>.json; contorno do município em malha/<UF>.json; sem mapa de fundo de terceiros (RNF-09).
import * as M from "./metricas.js";
import { $, $$, fmt, fmtPct, esc, css, largura, tabela, dica, astGenero, ROT_RACA, melhorarSelect, botaoExportarGrafico, luzNosBlocos, CONTATO, fecharPerfilAoClicarFora } from "./ui.js";
import { montarTema } from "./tema.js";
import { montarBusca } from "./busca.js";
import { montarDiadorim } from "./diadorim.js";
import { montarExportacao } from "./exportar.js";

const MUN = new URLSearchParams(location.search).get("m") || "4205407";
const MP = await fetch(`mapeamento/${MUN}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const R = MP ? M.resumoMapeamento(MP) : null;
const TIPO_LIV = { geral: "Livraria", sebo: "Sebo", especializada: "Livraria especializada", cafe_livraria: "Café-livraria", online: "Livraria on-line" };
const TIPO_ED = { comercial: "Comercial", universitaria: "Universitária", independente: "Independente", artesanal: "Artesanal" };
const SIT = { ativa: "Ativa", encerrada: "Encerrada", incerta: "Situação incerta" };
const LOCAL = { livraria: "Numa livraria", biblioteca: "Numa biblioteca", cafe: "Num café", espaco_publico: "Em espaço público", casa: "Em casa (sem endereço publicado)", online: "On-line", nao_informado: "Local não informado na fonte" };
const data = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "–");
const selo = (x) => (M.aConferir(x, MP.gerado_em) ? ' <span class="selo-conferir" title="Verificado há mais de 12 meses">a conferir</span>' : "");
const fonte = (u, rot = "fonte") => (u ? `<a href="${esc(u)}" rel="noopener" target="_blank">${rot}</a>` : "");
const porId = (lista) => new Map((lista ?? []).map((x) => [x.id, x]));
const LIV = porId(MP?.livrarias), CLU = porId(MP?.clubes), PES = porId(MP?.pessoas), OBR = porId(MP?.obras), EDI = porId(MP?.editoras);

// ---------- números (CA-34.10): sempre com o critério e o caráter de cadastro ----------
function renderNumeros() {
  if (!MP) { $("#mapa-kpis").innerHTML = `<p class="vazio">O mapeamento desta cidade ainda não tem registros.</p>`; return; }
  $("#mapa-cidade").textContent = MP.nome;
  $("#mapa-verificado").textContent = `Mapeados até agora · conferido até ${data(R.verificadoAte)}${R.aConferir ? ` · ${fmt(R.aConferir)} registro(s) a conferir (mais de 12 meses)` : ""}.`;
  const card = (rot, val, det) => `<div class="kpi"><div class="rot">${rot}</div><div class="val">${val}</div><div class="det">${det}</div></div>`;
  const PLURAL = { geral: "livrarias", sebo: "sebos", especializada: "livrarias especializadas", cafe_livraria: "cafés-livraria", online: "livrarias on-line" };
  const tipos = Object.entries(R.livrariasPorTipo).map(([t, n]) => `${fmt(n)} ${n > 1 ? PLURAL[t] : TIPO_LIV[t].toLowerCase()}`).join(" · ");
  $("#mapa-kpis").innerHTML = card("Livrarias ativas mapeadas", fmt(R.livrariasAtivas), tipos || "–")
    + card("Clubes do livro", fmt(R.clubesAtivos), `ativos; ${fmt(R.clubes)} no cadastro`)
    + card("Editoras", fmt(R.editorasAtivas), `ativas; ${fmt(R.editoras)} no cadastro`)
    + card("Autoras e autores mapeados", fmt(R.pessoas), `${fmt(R.nasceram)} nascidos na cidade · ${fmt(R.atuam)} vivem ou trabalham nela · ${fmt(R.ambos)} nos dois`)
    + card("Mulheres", R.pessoas ? fmtPct(R.pctMulheres) + astGenero(R.generoAtribuido) : "–", `${fmt(R.mulheres)} de ${fmt(R.pessoas)}`)
    + card("Pessoas negras", R.pessoas ? `≥ ${fmtPct(R.pctNegrasPiso)}` : "–", `pelo menos ${fmt(R.negras)} de ${fmt(R.pessoas)}; piso por autodeclaração`);
  $("#mapa-nota").innerHTML = `Pessoa entra com vínculo (nasceu na cidade ou vive e trabalha nela, dito numa fonte) e ao menos um livro na base.
    ${R.generoAtribuido ? `* Inclui ${fmt(R.generoAtribuido)} pessoa(s) com gênero atribuído pelo primeiro nome, que pode estar errado; correções: ${CONTATO}. ` : ""}
    Raça só por autodeclaração pública: "sem declaração" não quer dizer branca.`;
}

// ---------- mapa da cidade: contorno do IBGE + pontos (RNF-09) ----------
let contorno = null;
async function renderMapa() {
  const el = $("#g-mapa-cidade");
  if (!MP) return;
  if (!contorno) {
    const uf = { 42: "SC" }[MUN.slice(0, 2)] ?? null;
    const malha = uf ? await fetch(`malha/${uf}.json`).then((r) => r.json()) : null;
    contorno = malha?.features.find((f) => f.properties.codigo === MUN) ?? null;
  }
  const tipo = $("#mapa-tipo").value, sit = $("#mapa-situacao").value;
  const pontos = [
    ...MP.livrarias.filter((l) => l.lat != null).map((l) => ({ ...l, cat: l.tipo === "sebo" ? "sebo" : "livraria", href: `#/livraria/${l.id}` })),
    ...MP.clubes.filter((c) => c.lat != null && c.local_tipo !== "casa").map((c) => ({ ...c, cat: "clube", href: `#/clube/${c.id}` })),
  ].filter((p) => (!tipo || p.cat === tipo) && (!sit || p.situacao === sit));
  const w = Math.min(largura(el), 620), h = Math.round(w * 1.1);
  const feat = contorno ?? { type: "FeatureCollection", features: pontos.map((p) => ({ type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] } })) };
  // Projeção plana (como em mapa.js e leitura.js): a malha do IBGE não segue o sentido de anel que o d3 esférico espera, e
  // geoMercator lia o contorno como "o mundo menos o município" (quadrado cheio, pontos todos no mesmo lugar).
  const proj = d3.geoIdentity().reflectY(true).fitExtent([[10, 10], [w - 10, h - 10]], feat), caminho = d3.geoPath(proj);
  const COR = { livraria: css("--s1"), sebo: css("--s3"), clube: css("--s5") };
  const svg = d3.create("svg").attr("viewBox", [0, 0, w, h]).attr("width", w).attr("role", "group").attr("aria-label", `Mapa de ${MP.nome} com ${pontos.length} pontos`);
  if (contorno) svg.append("path").datum(contorno).attr("d", caminho).attr("class", "contorno-cidade");
  svg.append("g").selectAll("a").data(pontos).join("a").attr("href", (p) => p.href).attr("aria-label", (p) => `${p.nome} (${p.cat})`)
    .append("circle").attr("cx", (p) => proj([p.lon, p.lat])[0]).attr("cy", (p) => proj([p.lon, p.lat])[1]).attr("r", 6)
    .attr("fill", (p) => COR[p.cat]).attr("stroke", css("--superficie")).attr("stroke-width", 1.5).attr("opacity", (p) => (p.situacao === "ativa" ? 1 : 0.45))
    .on("pointermove", (ev, p) => dica.mostrar(ev, `<b>${esc(p.nome)}</b>${esc(p.cat === "clube" ? "Clube do livro" : TIPO_LIV[p.tipo])} · ${esc(p.bairro ?? "")}<br>${esc(SIT[p.situacao])}`))
    .on("pointerleave", dica.esconder);
  const legenda = document.createElement("div");
  legenda.className = "mapa-legenda";
  legenda.innerHTML = Object.entries({ livraria: "Livraria", sebo: "Sebo", clube: "Clube do livro" }).map(([k, r]) =>
    `<span><i style="display:inline-block;width:11px;height:11px;border-radius:50%;background:${COR[k]};vertical-align:-1px"></i> ${r}</span>`).join("")
    + `<span class="muted">esmaecido = encerrada ou incerta</span>`;
  el.replaceChildren(svg.node(), legenda, botaoExportarGrafico());
  // Lista equivalente (RNF-05): o mapa nunca é o único acesso.
  const lista = [...MP.livrarias.map((l) => ({ ...l, cat: l.tipo === "sebo" ? "sebo" : "livraria", href: `#/livraria/${l.id}` })),
    ...MP.clubes.map((c) => ({ ...c, cat: "clube", href: `#/clube/${c.id}` }))]
    .filter((p) => (!tipo || p.cat === tipo) && (!sit || p.situacao === sit)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  $("#mapa-lista").innerHTML = lista.length ? `<ul class="lista-mapa">${lista.map((p) => `<li><a href="${p.href}">${esc(p.nome)}</a>
    <span class="muted pequeno">${esc(p.cat === "clube" ? `Clube · ${LOCAL[p.local_tipo]}` : TIPO_LIV[p.tipo])}${p.bairro ? ` · ${esc(p.bairro)}` : ""}${p.situacao !== "ativa" ? ` · ${esc(SIT[p.situacao])}` : ""}</span></li>`).join("")}</ul>`
    : `<p class="muted">Nada com esses filtros.</p>`;
}

// ---------- cadastro: listas com busca e filtros ----------
let aba = "pessoas";
function renderCadastro() {
  if (!MP) return;
  const termo = M.normalizar($("#mapa-busca").value), vinc = $("#mapa-vinculo").value;
  $("#mapa-vinculo-rot").hidden = aba !== "pessoas";
  const casa = (...xs) => !termo || M.normalizar(xs.filter(Boolean).join(" ")).includes(termo);
  const el = $("#t-mapa-cadastro");
  if (aba === "pessoas") {
    const ls = MP.pessoas.filter((p) => casa(p.nome) && (!vinc || (vinc === "ambos" ? p.nasceu && p.atua : p[vinc])));
    tabela(el, ls, [{ rot: "Pessoa", f: (p) => p.nome }, { rot: "Vínculo", f: (p) => [p.nasceu && "nasceu na cidade", p.atua && "vive ou trabalha na cidade"].filter(Boolean).join(" · ") },
      { rot: "Gênero", f: (p) => ({ mulher: "Mulher", homem: "Homem", nao_binario: "Não binária" }[p.genero] ?? "Não identificado") + (p.genero_evidencia === "atribuicao" ? " *" : "") },
      { rot: "Raça (autodeclarada)", f: (p) => ROT_RACA[p.raca] ?? "Sem declaração" }, { rot: "Nos prêmios", f: (p) => (p.nos_premios ? "sim" : "") }]);
    ligar(el, ls.map((p) => `#/pessoa/${p.id}`));
  } else if (aba === "obras") {
    const ls = MP.obras.filter((o) => casa(o.titulo, o.editora, ...(o.autoria ?? []).map((a) => a[1])));
    tabela(el, ls, [{ rot: "Título", f: (o) => o.titulo }, { rot: "Autoria", f: (o) => (o.autoria ?? []).filter((a) => a[2] !== "ilustrador").map((a) => a[1]).join(", ") },
      { rot: "Editora", f: (o) => o.editora ?? "" }, { rot: "Ano", f: (o) => o.ano_publicacao ?? "" },
      { rot: "Vínculo", f: (o) => o.vinculos.map((v) => ({ autoria: "autoria", editora: "editora da cidade", ambientacao: "ambientada na cidade" }[v])).join(" · ") }]);
    ligar(el, ls.map((o) => `#/obra/${o.id}`));
  } else if (aba === "editoras") {
    const ls = MP.editoras.filter((e) => casa(e.nome));
    tabela(el, ls, [{ rot: "Editora", f: (e) => e.nome }, { rot: "Tipo", f: (e) => TIPO_ED[e.tipo] }, { rot: "Situação", f: (e) => SIT[e.situacao] }, { rot: "Conferido em", f: (e) => data(e.verificado_em) }]);
    ligar(el, ls.map((e) => `#/editora/${e.id}`));
  } else if (aba === "clubes") {
    const ls = MP.clubes.filter((c) => casa(c.nome, c.foco, c.bairro));
    tabela(el, ls, [{ rot: "Clube", f: (c) => c.nome }, { rot: "Formato", f: (c) => (c.formato === "nao_informado" ? "não informado" : c.formato) }, { rot: "Onde", f: (c) => LOCAL[c.local_tipo] + (c.bairro ? ` · ${c.bairro}` : "") },
      { rot: "Foco", f: (c) => c.foco ?? "" }, { rot: "Situação", f: (c) => SIT[c.situacao] }]);
    ligar(el, ls.map((c) => `#/clube/${c.id}`));
  } else {
    const ls = MP.livrarias.filter((l) => casa(l.nome, l.bairro, l.foco));
    tabela(el, ls, [{ rot: "Livraria", f: (l) => l.nome }, { rot: "Tipo", f: (l) => TIPO_LIV[l.tipo] + (l.foco ? ` (${l.foco})` : "") }, { rot: "Bairro", f: (l) => l.bairro ?? "" },
      { rot: "Rede", f: (l) => (l.rede ? "rede" : "independente") }, { rot: "Situação", f: (l) => SIT[l.situacao] }]);
    ligar(el, ls.map((l) => `#/livraria/${l.id}`));
  }
}
// A 1ª célula de cada linha vira link para o perfil (a tabela é montada com texto escapado).
function ligar(el, hrefs) {
  el.querySelectorAll("tbody tr").forEach((tr, i) => { const td = tr.querySelector("td"); if (td && hrefs[i]) td.innerHTML = `<a href="${hrefs[i]}">${td.innerHTML}</a>`; });
}

// ---------- perfis (CA-34.9) ----------
const osm = (x) => (x.lat != null ? ` <a href="https://www.openstreetmap.org/?mlat=${x.lat}&mlon=${x.lon}#map=18/${x.lat}/${x.lon}" rel="noopener" target="_blank">ver no OpenStreetMap</a>` : "");
const rodapeRegistro = (x) => `<p class="muted pequeno">Fonte: ${fonte(x.fonte, "página consultada")} · conferido em ${data(x.verificado_em)}${selo(x)}</p>`;
function perfil(tipo, id) {
  if (tipo === "livraria" && LIV.has(id)) { const l = LIV.get(id);
    return `<header class="perfil-cab"><p class="sobretitulo">${esc(TIPO_LIV[l.tipo])}${l.foco ? ` · ${esc(l.foco)}` : ""} · ${l.rede ? "rede" : "independente"}</p><h2 id="perfil-nome">${esc(l.nome)}</h2>
      <p>${esc(SIT[l.situacao])}${l.ano_abertura ? ` · desde ${l.ano_abertura}` : ""}${l.ano_encerramento ? ` · encerrada em ${l.ano_encerramento}` : ""}</p></header>
      <div class="perfil-lugar"><p>${l.endereco ? `${esc(l.endereco)} · ` : ""}${esc(l.bairro ?? "")}${osm(l)}</p>
      <p>${[l.site && fonte(l.site, "site"), ...(l.redes ?? "").split(" ; ").filter(Boolean).map((u) => fonte(u, "rede social"))].filter(Boolean).join(" · ")}</p>
      ${MP.clubes.filter((c) => c.livraria_id === l.id).map((c) => `<p>Clube do livro aqui: <a href="#/clube/${c.id}">${esc(c.nome)}</a></p>`).join("")}
      ${rodapeRegistro(l)}</div>`; }
  if (tipo === "clube" && CLU.has(id)) { const c = CLU.get(id);
    return `<header class="perfil-cab"><p class="sobretitulo">Clube do livro${c.formato === "nao_informado" ? "" : ` · ${esc(c.formato)}`}</p><h2 id="perfil-nome">${esc(c.nome)}</h2>
      <p>${esc(SIT[c.situacao])}${c.periodicidade ? ` · ${esc(c.periodicidade)}` : ""}${c.aberto != null ? ` · ${c.aberto ? "aberto a novos membros" : "fechado a novos membros"}` : ""}</p></header>
      <div class="perfil-lugar"><p>${esc(LOCAL[c.local_tipo])}${c.livraria_id && LIV.has(c.livraria_id) ? `: <a href="#/livraria/${c.livraria_id}">${esc(LIV.get(c.livraria_id).nome)}</a>` : c.local_nome ? `: ${esc(c.local_nome)}` : ""}${c.bairro ? ` · ${esc(c.bairro)}` : ""}${osm(c)}</p>
      ${c.foco ? `<p><b>Foco:</b> ${esc(c.foco)}</p>` : ""}<p><b>Organização:</b> ${esc(c.organizacao)}</p>
      <p>${fonte(c.link, "canal público do clube")}</p>${rodapeRegistro(c)}</div>`; }
  if (tipo === "pessoa" && PES.has(id)) { const p = PES.get(id);
    const obras = MP.obras.filter((o) => (o.autoria ?? []).some((a) => a[0] === id));
    return `<header class="perfil-cab"><p class="sobretitulo">Autora ou autor · ${esc(MP.nome)}</p><h2 id="perfil-nome">${esc(p.nome)}</h2>
      <p>${[p.nasceu && `nasceu em ${esc(MP.nome)} (${fonte(p.nascimento_fonte)})`, p.atua && `vive ou trabalha em ${esc(MP.nome)} (${fonte(p.atuacao_fonte)})`].filter(Boolean).join(" · ")}</p></header>
      <div class="perfil-lugar"><p><b>Gênero:</b> ${esc({ mulher: "Mulher", homem: "Homem", nao_binario: "Não binária" }[p.genero] ?? "Não identificado")}${p.genero_evidencia === "atribuicao" ? " * (atribuído pelo primeiro nome)" : ""}
      · <b>Raça:</b> ${p.raca && p.raca !== "sem_declaracao" ? `${esc(ROT_RACA[p.raca])} — “${esc(p.raca_trecho ?? "")}” ${fonte(p.raca_fonte)}` : "sem declaração pública"}${p.ano_nascimento ? ` · nascida(o) em ${p.ano_nascimento}` : ""}</p>
      <h3>Obras no cadastro</h3><ul>${obras.map((o) => `<li><a href="#/obra/${o.id}">${esc(o.titulo)}</a>${o.ano_publicacao ? ` (${o.ano_publicacao})` : ""}</li>`).join("") || "<li class='muted'>Nenhuma.</li>"}</ul>
      ${p.nos_premios ? `<p><a class="botao" href="premios.html#/pessoa/${esc(id)}">Trajetória nos prêmios →</a></p>` : ""}</div>`; }
  if (tipo === "obra" && OBR.has(id)) { const o = OBR.get(id);
    return `<header class="perfil-cab"><p class="sobretitulo">Livro · ${esc(o.vinculos.map((v) => ({ autoria: "autoria da cidade", editora: "editora da cidade", ambientacao: "ambientado na cidade" }[v])).join(" · "))}</p><h2 id="perfil-nome">${esc(o.titulo)}</h2>
      <p>${(o.autoria ?? []).map((a) => `${PES.has(a[0]) ? `<a href="#/pessoa/${a[0]}">${esc(a[1])}</a>` : esc(a[1])}${a[2] !== "autor" ? ` (${a[2]})` : ""}`).join(", ")}${o.editora ? ` · ${esc(o.editora)}` : ""}${o.ano_publicacao ? ` · ${o.ano_publicacao}` : ""}${o.isbn ? ` · ISBN ${esc(o.isbn)}` : ""}</p></header>
      <div class="perfil-lugar">${o.fonte ? rodapeRegistro(o) : ""}${o.nos_premios ? `<p><a class="botao" href="premios.html#/obra/${esc(id)}">Nos prêmios →</a></p>` : ""}</div>`; }
  if (tipo === "editora" && EDI.has(id)) { const e = EDI.get(id);
    const obras = MP.obras.filter((o) => o.editora === e.nome);
    return `<header class="perfil-cab"><p class="sobretitulo">Editora · ${esc(TIPO_ED[e.tipo])}</p><h2 id="perfil-nome">${esc(e.nome)}</h2>
      <p>${esc(SIT[e.situacao])}${e.ano_encerramento ? ` · encerrada em ${e.ano_encerramento}` : ""}${e.site ? ` · ${fonte(e.site, "site")}` : ""}</p></header>
      <div class="perfil-lugar"><h3>Obras no cadastro</h3><ul>${obras.map((o) => `<li><a href="#/obra/${o.id}">${esc(o.titulo)}</a></li>`).join("") || "<li class='muted'>Nenhuma ainda.</li>"}</ul>
      ${e.nos_premios ? `<p><a class="botao" href="premios.html#/editora/${esc(id)}">Nos prêmios →</a></p>` : ""}${rodapeRegistro(e)}</div>`; }
  return null;
}
let fundo = "";
function rota() {
  const m = location.hash.match(/^#\/(livraria|clube|pessoa|obra|editora)\/([\w-]+)$/), dlg = $("#perfil");
  if (!m || !MP) { if (dlg.open) dlg.close(); fundo = location.hash; return; }
  const html = perfil(m[1], m[2]);
  if (!html) return;
  $("#perfil-corpo").innerHTML = html;
  if (!dlg.open) dlg.showModal();
}
$("#perfil").addEventListener("close", () => { if (/^#\/(livraria|clube|pessoa|obra|editora)\//.test(location.hash)) history.replaceState(null, "", `${location.pathname}${location.search}${fundo}`); });
addEventListener("hashchange", rota);
fecharPerfilAoClicarFora($("#perfil"));

// ---------- início ----------
montarTema(() => renderMapa());
$$("#mapa .controles select").forEach(melhorarSelect);
melhorarSelect($("#mapa-vinculo"));
// Formulário (CA-19.2): menus próprios também aqui; o <select> nativo continua no formulário, como fonte do valor enviado.
$$(".form-sugerir select").forEach(melhorarSelect);
["#mapa-tipo", "#mapa-situacao"].forEach((s) => $(s).addEventListener("change", renderMapa));
$("#mapa-busca").addEventListener("input", renderCadastro);
$("#mapa-vinculo").addEventListener("change", renderCadastro);
$("#mapa-abas").addEventListener("click", (e) => { const b = e.target.closest("button[data-v]"); if (!b) return; aba = b.dataset.v;
  $$("#mapa-abas button").forEach((x) => x.setAttribute("aria-checked", String(x === b))); renderCadastro(); });
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) $("#form-local").hidden = false;
montarBusca(null, "premios.html");
montarDiadorim();
montarExportacao();
renderNumeros();
// Eventos da cidade (CA-35.7), do módulo Eventos.
fetch("eventos.json").then((r) => (r.ok ? r.json() : null)).then((EVJ) => {
  const evs = EVJ?.eventos.filter((e) => e.municipio === MUN) ?? [];
  if (!evs.length) return;
  $("#mapa-eventos-lista").innerHTML = `<ul>${evs.map((e) => { const eds = EVJ.edicoes.filter((x) => x.evento === e.id).sort((a, b) => b.inicio.localeCompare(a.inicio));
    return `<li><a href="eventos.html#/evento/${esc(e.id)}">${esc(e.nome)}</a> <span class="muted pequeno">${eds.length} edição(ões); última: ${esc(eds[0]?.inicio ?? "–")}</span></li>`; }).join("")}</ul>`;
  $("#eventos-cidade").hidden = false;
}).catch(() => {});
await renderMapa();
renderCadastro();
rota();
if (MP) $("#gerado-em").textContent = `Dados gerados em ${new Date(MP.gerado_em).toLocaleString("pt-BR")}.`;
luzNosBlocos();
addEventListener("resize", () => { clearTimeout(window._rs); window._rs = setTimeout(renderMapa, 200); });
