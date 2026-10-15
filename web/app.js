// Painel Literadados: estado, navegação e ciclo de desenho. Agregações em metricas.js (testadas);
// seções em explorar.js, historia.js, linha-do-tempo.js, mapa.js e pessoas.js.
import * as M from "./metricas.js";
import { $, $$, fmt, fmtPct, esc, tabela, urlFoto, CATEGORIAS } from "./ui.js";
import { renderPanorama, renderEvolucao, renderFunil, renderSegregacao, renderSankey, renderIdade, renderEditoras, renderJuri } from "./explorar.js";
import { montarHistoria } from "./historia.js";
import { renderLinhaDoTempo, montarTrilho } from "./linha-do-tempo.js";
import { carregarMalha, montarControlesMapa, renderMapa } from "./mapa.js";
import { montarPessoas, renderPessoas, htmlPerfil } from "./pessoas.js";

const [D] = await Promise.all([fetch("dados.json").then((r) => r.json()), carregarMalha()]);
D.participacao = M.expandir(D); // JSON compacto → linhas de v_participacao (design D13)
const ANOS = d3.range(D.anos[0], D.anos[1] + 1);
const midiaPorId = new Map((D.midia ?? []).map((m) => [m.pessoa_id, m]));

// ---------- estado e URL (CA-02.1, 02.2) ----------
const padrao = () => ({ anoIni: D.anos[0], anoFim: D.anos[1], categorias: [...CATEGORIAS], papel: "autor" });
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
const filtradas = () => M.filtrar(D.participacao, estado);

function sincronizarFiltros() {
  for (const [sel, valor] of [["#f-ini", estado.anoIni], ["#f-fim", estado.anoFim]]) {
    $(sel).innerHTML = ANOS.map((a) => `<option ${a === valor ? "selected" : ""}>${a}</option>`).join("");
  }
  $$("#f-cats input").forEach((i) => { i.checked = estado.categorias.includes(i.value); });
  $("#f-papel").value = estado.papel;
}
function montarFiltros() {
  $("#f-cats").insertAdjacentHTML("beforeend", CATEGORIAS.map((c) => `<label class="chip"><input type="checkbox" value="${c}">${c}</label>`).join(""));
  sincronizarFiltros();
  $("#filtros").addEventListener("change", () => {
    estado.anoIni = +$("#f-ini").value;
    estado.anoFim = Math.max(+$("#f-fim").value, estado.anoIni);
    $("#f-fim").value = estado.anoFim;
    estado.categorias = $$("#f-cats input:checked").map((i) => i.value);
    estado.papel = $("#f-papel").value;
    aplicarFiltros();
  });
  $("#limpar").addEventListener("click", () => { Object.assign(estado, padrao()); sincronizarFiltros(); aplicarFiltros(); });
  $("#baixar").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob(["﻿" + d3.csvFormat(filtradas())], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: `literadados_${estado.anoIni}-${estado.anoFim}.csv` }).click();
    URL.revokeObjectURL(url);
  });
  const painel = $("#painel-filtros"), botao = $("#abrir-filtros");
  const alternar = (abrir = painel.hidden) => { painel.hidden = !abrir; botao.setAttribute("aria-expanded", String(abrir)); if (abrir) $("#f-ini").focus(); };
  botao.addEventListener("click", () => alternar());
  $("#recorte").addEventListener("click", (e) => { if (e.target.closest("[data-abrir-filtros]")) alternar(true); if (e.target.closest("[data-limpar]")) $("#limpar").click(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !painel.hidden) { alternar(false); botao.focus(); } });
}
function aplicarFiltros() { gravarURL(); renderRecorte(); renderTudo(); }

function renderRecorte() {
  const todas = estado.categorias.length === CATEGORIAS.length;
  const mudou = !todas || estado.anoIni !== D.anos[0] || estado.anoFim !== D.anos[1] || estado.papel !== "autor";
  const k = M.kpis(filtradas());
  $("#recorte").innerHTML = `<span>Recorte:</span>
    <span class="etiqueta">${estado.anoIni}–${estado.anoFim}</span>
    <span class="etiqueta">${todas ? "todas as categorias" : esc(estado.categorias.join(", ")) || "nenhuma categoria"}</span>
    <span class="etiqueta">${estado.papel === "todos" ? "autores e ilustradores" : "só autores"}</span>
    <span>${fmt(k.pessoas)} pessoas · ${fmt(k.indicacoes)} indicações</span>
    <button type="button" data-abrir-filtros>ajustar</button>${mudou ? `<button type="button" data-limpar>limpar</button>` : ""}`;
}

// ---------- tema (CA-15.2) ----------
const TEMAS = ["auto", "light", "dark"];
const NOME_TEMA = { auto: "Automático", light: "Claro", dark: "Escuro" };
let tema = "auto";
try { tema = localStorage.getItem("tema") || "auto"; } catch {}
function aplicarTema(t) {
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  $("#tema-rot").textContent = NOME_TEMA[t];
  $("#tema").setAttribute("aria-label", `Tema: ${NOME_TEMA[t].toLowerCase()} (trocar)`);
  try { localStorage.setItem("tema", t); } catch {}
}
aplicarTema(tema);

// ---------- abertura (CA-15.1) ----------
function renderAbertura() {
  const H = M.historia(M.filtrar(D.participacao, padrao()));
  $("#hero-numeros").innerHTML = [
    [fmt(H.pessoas), `pessoas-autoras em ${fmt(H.indicacoes)} indicações`],
    [fmtPct(H.genero.pctMulheres), `são mulheres (${fmt(H.genero.mulheres)})`],
    [`≥ ${fmtPct(H.raca.pctNegras)}`, `se declararam negras (piso: ${fmt(H.raca.negras)})`],
  ].map(([v, t]) => `<div class="hero-num"><b>${v}</b><span>${t}</span></div>`).join("");
  // Mosaico decorativo: fotos livres de quem venceu, sem dado algum codificado.
  const vencedoras = new Set(D.participacao.filter((l) => l.vencedora).map((l) => l.pessoa_id));
  const fotos = D.pessoas.filter((p) => vencedoras.has(p.id) && midiaPorId.get(p.id)?.imagem).slice(0, 48);
  $("#hero-mosaico").innerHTML = fotos.map((p) => `<span style="background-image:url('${urlFoto(midiaPorId.get(p.id).imagem, 160).replace(/'/g, "%27")}')"></span>`).join("");
}

// ---------- navegação: seção atual e progresso (CA-15.2) ----------
function montarNavegacao() {
  const links = new Map($$(".nav a").map((a) => [a.getAttribute("href").slice(1), a]));
  const alvo = { evolucao: "funil", segregacao: "funil", idade: "funil", editoras: "funil", juri: "funil", referencias: "metodologia", panorama: "panorama" };
  const io = new IntersectionObserver((es) => {
    for (const e of es) {
      if (!e.isIntersecting) continue;
      const id = alvo[e.target.id] ?? e.target.id;
      links.forEach((a, k) => (k === id ? a.setAttribute("aria-current", "true") : a.removeAttribute("aria-current")));
      // Em telas estreitas o menu rola na horizontal: traz o item atual para a vista sem mexer na rolagem da página.
      const a = links.get(id), nav = $(".nav");
      if (a && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.offsetWidth / 2, behavior: "smooth" });
    }
  }, { rootMargin: "-40% 0px -55% 0px" });
  $$("main > section").forEach((s) => io.observe(s));
  const prog = $("#progresso");
  const atualizar = () => { const h = document.documentElement; prog.style.transform = `scaleX(${h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)})`; };
  addEventListener("scroll", atualizar, { passive: true });
  atualizar();
}

// ---------- perfis com rota por hash (CA-11.2) ----------
let hashAnterior = "";
const ctx = { D, ANOS, estado, midiaPorId, abrirPerfil, hashAnterior: () => hashAnterior, renderPessoas: () => renderPessoas(filtradas(), ctx) };
function abrirPerfil(id) {
  if (!location.hash.startsWith("#/pessoa/")) hashAnterior = location.hash;
  location.hash = `#/pessoa/${id}`;
}
function rota() {
  const m = location.hash.match(/^#\/pessoa\/(.+)$/);
  const dlg = $("#perfil");
  if (!m) { if (dlg.open) dlg.close(); return; }
  const html = htmlPerfil(decodeURIComponent(m[1]), ctx);
  if (!html) return;
  $("#perfil-corpo").innerHTML = html;
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
}
addEventListener("hashchange", rota);
$("#perfil-corpo").addEventListener("click", async (e) => {
  const a = e.target.closest("[data-copiar]");
  if (!a) return;
  e.preventDefault();
  try { await navigator.clipboard.writeText(location.href); a.textContent = "Link copiado"; } catch { a.textContent = location.href; }
});

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

// ---------- metodologia e referências (RF-13, RF-18) ----------
function renderMetodologia() {
  const porAno = new Map(D.cobertura.map((c) => [c.ano, c]));
  tabela($("#t-cobertura"), ANOS.map((a) => ({ ano: a, ...(porAno.get(a) ?? {}) })), [
    { rot: "Edição", k: "ano" }, { rot: "Pessoas-autoras", f: (d) => d.pessoas ?? "não coletada", num: true },
    { rot: "Gênero", f: (d) => fmtPct(d.pct_genero), num: true }, { rot: "UF", f: (d) => fmtPct(d.pct_uf), num: true },
    { rot: "Raça declarada", f: (d) => fmtPct(d.pct_raca), num: true }, { rot: "Busca de raça completa", f: (d) => fmtPct(d.pct_busca_raca), num: true },
    { rot: "Idade", f: (d) => fmtPct(d.pct_idade), num: true },
  ]);
  const grupos = d3.rollups(D.fontes ?? [], (v) => ({ total: d3.sum(v, (x) => x.registros), dominios: v }), (x) => x.grupo)
    .sort((a, b) => b[1].total - a[1].total);
  const max = d3.max(grupos, (g) => g[1].total) || 1;
  $("#referencias-grupos").innerHTML = grupos.map(([g, { total, dominios }]) => `<div class="cartao ref-grupo">
    <h3>${esc(g)} <span>${fmt(total)}</span></h3><div class="ref-barra"><i style="width:${(100 * total) / max}%"></i></div>
    <ul>${dominios.slice(0, 7).map((d) => `<li><a href="${esc(d.exemplo)}" target="_blank" rel="noopener noreferrer">${esc(d.dominio)}</a><span>${fmt(d.registros)}</span></li>`).join("")}
    ${dominios.length > 7 ? `<li class="muted">+ ${dominios.length - 7} domínios</li>` : ""}</ul></div>`).join("");
  $("#gerado-em").textContent = `Dados gerados em ${new Date(D.gerado_em).toLocaleString("pt-BR")}. ${D.anos_coletados.length} de ${ANOS.length} edições coletadas.`;
  $("#faixa-cobertura").innerHTML = ANOS.map((a) => `<div role="listitem" class="${D.anos_coletados.includes(a) ? "ok" : ""}" title="${a}: ${D.anos_coletados.includes(a) ? "coletada" : "não coletada"}">${a}</div>`).join("");
}

// ---------- ciclo ----------
function renderTudo() {
  const L = filtradas();
  const fs = [renderPanorama, renderLinhaDoTempo, renderMapa, renderSankey, renderEvolucao, renderFunil, renderSegregacao, renderIdade, renderEditoras, renderJuri, renderPessoas];
  for (const f of fs) {
    try { f(L, ctx); } catch (e) { console.error(f.name, e); }
  }
}
for (const id of ["#evo-dim", "#evo-etapa"]) $(id).addEventListener("change", () => renderEvolucao(filtradas(), ctx));
$("#funil-dim").addEventListener("change", () => renderFunil(filtradas()));

montarFiltros();
montarTrilho(abrirPerfil);
montarControlesMapa(() => renderMapa(filtradas(), ctx));
montarPessoas(ctx);
renderAbertura();
renderRecorte();
renderMetodologia();
renderTudo();
const historia = montarHistoria({ D, abrirPerfil });
montarNavegacao();
rota();

$("#tema").addEventListener("click", () => { tema = TEMAS[(TEMAS.indexOf(tema) + 1) % 3]; aplicarTema(tema); renderTudo(); historia.redesenhar(); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { renderTudo(); historia.redesenhar(); });
let larguraAnterior = innerWidth;
addEventListener("resize", () => {
  if (Math.abs(innerWidth - larguraAnterior) < 40) return;
  larguraAnterior = innerWidth;
  clearTimeout(window.__rz);
  window.__rz = setTimeout(() => { renderTudo(); historia.redesenhar(); }, 200);
});
