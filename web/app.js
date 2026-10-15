// Painel Literadados: estado, navegação e ciclo de desenho. Agregações em metricas.js (testadas);
// seções em explorar.js, historia.js, linha-do-tempo.js, mapa.js e pessoas.js.
import * as M from "./metricas.js";
import { $, $$, fmt, fmtPct, esc, tabela, urlFoto, CATEGORIAS, astGenero, CONTATO, fecharAnimado, contar, melhorarSelect, movimentoReduzido } from "./ui.js";
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
  const alternar = (abrir = painel.hidden) => {
    if (abrir) { painel.hidden = false; ($("#f-ini-botao") ?? $("#f-ini")).focus(); } else fecharAnimado(painel);
    botao.setAttribute("aria-expanded", String(abrir));
  };
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

// ---------- tema (CA-15.2, CA-19.6): botão de ícone com menu ----------
const NOME_TEMA = { auto: "Automático", light: "Claro", dark: "Escuro" };
const ICONE_TEMA = {
  light: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>',
  auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5z" fill="currentColor"/></svg>',
};
let tema = "auto";
try { tema = localStorage.getItem("tema") || "auto"; } catch {}
function aplicarTema(t) {
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  $("#tema").innerHTML = ICONE_TEMA[t];
  $("#tema").setAttribute("aria-label", `Tema de cores: ${NOME_TEMA[t].toLowerCase()}`);
  $("#tema").title = `Tema: ${NOME_TEMA[t]}`;
  $$("#menu-tema [data-tema]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.tema === t)));
  try { localStorage.setItem("tema", t); } catch {}
}
$$("#menu-tema [data-tema]").forEach((b) => { b.innerHTML = `${ICONE_TEMA[b.dataset.tema]}${NOME_TEMA[b.dataset.tema]}`; });
aplicarTema(tema);

// ---------- abertura (CA-15.1) ----------
function renderAbertura() {
  const H = M.historia(M.filtrar(D.participacao, padrao()));
  // Números contam até o valor (CA-19.4); o texto final é o valor formatado exato.
  const nums = [
    [H.pessoas, fmt, "", `pessoas-autoras em ${fmt(H.indicacoes)} indicações`],
    [H.genero.pctMulheres, fmtPct, astGenero(H.genero.atribuido), `são mulheres (${fmt(H.genero.mulheres)})`],
    [H.raca.pctNegras, (v) => `≥ ${fmtPct(v == null ? v : Math.round(v * 10) / 10)}`, "", `se declararam negras (piso: ${fmt(H.raca.negras)})`],
  ];
  $("#hero-numeros").innerHTML = nums.map(([, , extra, t]) => `<div class="hero-num"><b><span class="n"></span>${extra}</b><span>${t}</span></div>`).join("");
  $$("#hero-numeros .n").forEach((el, i) => contar(el, nums[i][0], (v) => nums[i][1](i === 0 && v != null ? Math.round(v) : v)));
  // Carrossel decorativo: fotos livres (vencedoras primeiro), em 3 faixas que correm em sentidos opostos. Nenhum dado codificado.
  const vencedoras = new Set(D.participacao.filter((l) => l.vencedora).map((l) => l.pessoa_id));
  const fotos = D.pessoas.filter((p) => midiaPorId.get(p.id)?.imagem).sort((a, b) => vencedoras.has(b.id) - vencedoras.has(a.id)).slice(0, 60);
  const faixas = [0, 1, 2].map((i) => fotos.filter((_, k) => k % 3 === i));
  const span = (p) => `<span style="background-image:url('${urlFoto(midiaPorId.get(p.id).imagem, 160).replace(/'/g, "%27")}')"></span>`;
  $("#hero-mosaico").innerHTML = faixas.map((f, i) => `<div class="hero-faixa" style="--dur:${110 + i * 30}s"${i % 2 ? " data-rev" : ""}>${[...f, ...f].map(span).join("")}</div>`).join("");
  // Pontos que flutuam devagar, nas cores das séries (eco de "cada ponto é uma pessoa").
  $("#hero-pontos").innerHTML = d3.range(22).map((i) => {
    const r = (k) => ((Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1 + 1) % 1; // pseudoaleatório estável
    return `<i style="--x:${(30 + r(1) * 68).toFixed(1)}%;--y:${(8 + r(2) * 84).toFixed(1)}%;--t:${(4 + r(3) * 7).toFixed(1)}px;--c:var(--s${1 + (i % 6)});--d:${(7 + r(4) * 8).toFixed(1)}s;--atraso:-${(r(5) * 12).toFixed(1)}s"></i>`;
  }).join("");
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
  if (!m) { if (dlg.open) fecharAnimado(dlg, () => dlg.close()); return; }
  const html = htmlPerfil(decodeURIComponent(m[1]), ctx);
  if (!html) return;
  $("#perfil-corpo").innerHTML = html;
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
}
addEventListener("hashchange", rota);
{ // Esc, botão × e clique fora fecham o perfil com animação (CA-19.1).
  const dlg = $("#perfil"), fechar = () => fecharAnimado(dlg, () => dlg.close());
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); fechar(); });
  dlg.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); fechar(); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) fechar(); });
}
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

// Nota de rodapé do asterisco de gênero (CA-11.4): total da base e do recorte dos filtros.
function renderNotaGenero(L) {
  const base = M.kpis(M.filtrar(D.participacao, padrao())), k = M.kpis(L);
  $("#nota-genero").innerHTML = base.generoAtribuido ? `<b>*</b> Gênero atribuído pelo primeiro nome, sem fonte que o confirme, para
    ${fmt(base.generoAtribuido)} das ${fmt(base.pessoas)} pessoas-autoras${k.pessoas !== base.pessoas ? ` (${fmt(k.generoAtribuido)} de ${fmt(k.pessoas)} no recorte dos filtros)` : ""}.
    Esses dados podem estar errados. Para corrigir, escreva para <a href="mailto:${CONTATO}">${CONTATO}</a>, de preferência com uma fonte pública.` : "";
}

// ---------- ciclo ----------
function renderTudo() {
  const L = filtradas();
  renderNotaGenero(L);
  const fs = [renderPanorama, renderLinhaDoTempo, renderMapa, renderSankey, renderEvolucao, renderFunil, renderSegregacao, renderIdade, renderEditoras, renderJuri, renderPessoas];
  for (const f of fs) {
    try { f(L, ctx); } catch (e) { console.error(f.name, e); }
  }
}
for (const id of ["#evo-dim", "#evo-etapa"]) $(id).addEventListener("change", () => renderEvolucao(filtradas(), ctx));
$("#funil-dim").addEventListener("change", () => renderFunil(filtradas()));

montarFiltros();
$$("select").forEach(melhorarSelect);
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
revelarAoRolar();

// Revelação ao rolar (CA-19.1): só com IntersectionObserver e movimento permitido; sem isso, tudo já aparece.
function revelarAoRolar() {
  if (movimentoReduzido() || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visivel"); io.unobserve(e.target); } }),
    { rootMargin: "0px 0px -6% 0px" });
  $$(".secao-cab, .secao > .cartao, .secao > figure, .duas, .kpis, .tempo-trilho-wrap, .referencias, .colunas-texto").forEach((el) => { el.classList.add("revelar"); io.observe(el); });
}

function montarMenuTema() {
  const botao = $("#tema"), menu = $("#menu-tema"), itens = $$("[data-tema]", menu);
  const fechar = (foco = true) => { if (menu.hidden) return; botao.setAttribute("aria-expanded", "false"); fecharAnimado(menu); if (foco) botao.focus(); };
  const abrir = () => { menu.hidden = false; botao.setAttribute("aria-expanded", "true"); (itens.find((b) => b.dataset.tema === tema) ?? itens[0]).focus(); };
  botao.addEventListener("click", () => (menu.hidden ? abrir() : fechar()));
  menu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tema]");
    if (!b) return;
    fechar();
    if (b.dataset.tema === tema) return;
    tema = b.dataset.tema;
    // Troca de tema com fade (View Transitions, quando houver); os gráficos redesenham com as cores novas.
    const trocar = () => { aplicarTema(tema); renderTudo(); historia.redesenhar(); };
    if (document.startViewTransition && !movimentoReduzido()) document.startViewTransition(trocar); else trocar();
  });
  menu.addEventListener("keydown", (e) => {
    const i = itens.indexOf(document.activeElement);
    const alvo = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: itens.length - 1 }[e.key];
    if (alvo != null) { e.preventDefault(); itens[(alvo + itens.length) % itens.length].focus(); }
    if (e.key === "Escape") { e.preventDefault(); fechar(); }
    if (e.key === "Tab") fechar(false);
  });
  document.addEventListener("pointerdown", (e) => { if (!menu.hidden && !menu.contains(e.target) && !botao.contains(e.target)) fechar(false); });
}
montarMenuTema();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { renderTudo(); historia.redesenhar(); });
let larguraAnterior = innerWidth;
addEventListener("resize", () => {
  if (Math.abs(innerWidth - larguraAnterior) < 40) return;
  larguraAnterior = innerWidth;
  clearTimeout(window.__rz);
  window.__rz = setTimeout(() => { renderTudo(); historia.redesenhar(); }, 200);
});
