// Painel Literadados: estado, navegação e ciclo de desenho. Agregações em metricas.js (testadas);
// seções em explorar.js, historia.js, linha-do-tempo.js, mapa.js e pessoas.js.
import * as M from "./metricas.js";
import { $, $$, fmt, fmtPct, esc, srcFoto, CATEGORIAS, astGenero, CONTATO, fecharAnimado, contar, melhorarSelect, movimentoReduzido, luzNosBlocos, montarFiltro, carregarGraficos } from "./ui.js";
import { renderPanorama, renderEvolucao, renderFunil, renderSegregacao, renderSankey, renderIdade, renderEditoras, renderJuri, renderRanking } from "./explorar.js";
import { montarHistoria } from "./historia.js";
import { renderLinhaDoTempo, montarTrilho } from "./linha-do-tempo.js";
import { carregarMalha, montarControlesMapa, renderMapa } from "./mapa.js";
import { montarPessoas, renderPessoas, htmlPerfil, htmlObra } from "./pessoas.js";
import { montarTema } from "./tema.js";
import { montarDiadorim } from "./diadorim.js";
import { montarBusca } from "./busca.js";
import { htmlLugar } from "./lugares.js";
import { montarExportacao } from "./exportar.js";

// Sem dados não há painel: avisa no lugar dos números da abertura, com botão para tentar de novo, em vez de falhar em silêncio.
const [D] = await Promise.all([fetch("dados.json").then((r) => { if (!r.ok) throw new Error(`dados.json: HTTP ${r.status}`); return r.json(); }), carregarMalha()])
  .catch((e) => {
    $("#hero-numeros").innerHTML = `<p class="vazio" role="alert">Não foi possível carregar os dados (${esc(e.message)}). <button type="button" class="chip-link" onclick="location.reload()">Tentar de novo</button></p>`;
    throw e;
  });
D.participacao = M.expandir(D); // JSON compacto → linhas de v_participacao (design D13)
const ANOS = d3.range(D.anos[0], D.anos[1] + 1);
const midiaPorId = new Map((D.midia ?? []).map((m) => [m.pessoa_id, m]));

// ---------- filtros por parte e URL (RF-02, D22) ----------
// Cada parte filtrável tem seu estado; a URL guarda ?<parte>=<texto> só para os filtros fora do padrão.
const IDS_JANELAS = ["linha-do-tempo", "geografia", "evolucao", "funil", "segregacao", "idade", "editoras", "ranking", "juri"];
const PARTES = ["panorama", ...IDS_JANELAS, "autores"];
const padrao = () => M.filtroDeTexto(null, D.anos, CATEGORIAS);
const filtros = (() => {
  const q = new URLSearchParams(location.search);
  return Object.fromEntries(PARTES.map((p) => [p, M.filtroDeTexto(q.get(p), D.anos, CATEGORIAS)]));
})();
const linhasDe = (parte) => M.filtrar(D.participacao, filtros[parte]);
function gravarURL() {
  const q = new URLSearchParams(location.search);
  for (const p of PARTES) {
    const t = M.filtroParaTexto(filtros[p], D.anos, CATEGORIAS);
    if (t) q.set(p, t); else q.delete(p);
  }
  for (const k of ["ini", "fim", "cat", "papel"]) q.delete(k); // formato antigo (filtro global)
  history.replaceState(null, "", `${location.pathname}${q.size ? `?${q}` : ""}${location.hash}`);
}
const resumos = {};
function montarFiltros() {
  for (const parte of PARTES) {
    const el = $(`[data-filtro="${parte}"]`);
    if (!el) continue;
    resumos[parte] = montarFiltro(el, filtros[parte], {
      anos: ANOS, padrao,
      aoMudar: () => { gravarURL(); renderParte(parte); },
      baixar: () => {
        const f = filtros[parte];
        const url = URL.createObjectURL(new Blob(["\ufeff" + d3.csvFormat(linhasDe(parte))], { type: "text/csv;charset=utf-8" }));
        Object.assign(document.createElement("a"), { href: url, download: `literadados_${parte}_${f.anoIni}-${f.anoFim}.csv` }).click();
        URL.revokeObjectURL(url);
      },
    });
  }
}

// ---------- tema (CA-15.2, CA-19.6) ----------
montarTema(() => { renderTudo(); historia.redesenhar(); });

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
  const span = (p) => `<span style="background-image:url('${srcFoto(p.id, midiaPorId.get(p.id), 160).replace(/'/g, "%27")}')"></span>`;
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
  const alvo = {};
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

// ---------- perfis com rota por hash (CA-11.2, RF-22) ----------
// Perfis (pessoa, UF, região) abrem por cima do que estiver aberto; fechar volta ao último endereço que não era perfil.
const PERFIL = /^#\/(pessoa|obra|uf|regiao)\/(.+)$/;
let fundo = PERFIL.test(location.hash) ? "" : location.hash;
addEventListener("hashchange", () => { if (!PERFIL.test(location.hash)) fundo = location.hash; });
function abrirPerfil(id) { location.hash = `#/pessoa/${id}`; }
const ctx = { D, ANOS, midiaPorId, abrirPerfil, renderPessoas: () => renderParte("autores") };
const ctxDe = (parte) => ({ ...ctx, estado: filtros[parte] });
// Janelas de gráficos (RF-20, D19): id do <dialog> → funções de render. Só janela aberta é desenhada.
const JANELAS = {
  "linha-do-tempo": [renderLinhaDoTempo], geografia: [renderMapa, renderSankey], evolucao: [renderEvolucao], funil: [renderFunil],
  segregacao: [renderSegregacao], idade: [renderIdade], editoras: [renderEditoras], ranking: [renderRanking], juri: [renderJuri],
};
// Desenha uma parte com o seu filtro e atualiza o resumo do recorte na barra dela.
function renderParte(parte) {
  const L = linhasDe(parte), c = ctxDe(parte);
  const fs = parte === "panorama" ? [renderPanorama] : parte === "autores" ? [renderPessoas] : JANELAS[parte];
  let falhou = false;
  for (const f of fs) {
    try { f(L, c); } catch (e) { console.error(f.name, e); falhou = true; }
  }
  avisarFalha(parte, falhou);
  const k = M.kpis(L);
  resumos[parte]?.resumo(`${fmt(k.pessoas)} pessoas · ${fmt(k.indicacoes)} indicações`);
}
// Um gráfico que quebra (dado atípico) não derruba o resto: a parte mostra um aviso com "Tentar de novo".
function avisarFalha(parte, falhou) {
  const raiz = $(`#${parte}`)?.querySelector(":scope > .janela-corpo") ?? $(`#${parte}`);
  let aviso = raiz?.querySelector(":scope > .falha-parte");
  if (!falhou) { aviso?.remove(); return; }
  if (!raiz || aviso) return;
  aviso = Object.assign(document.createElement("p"), { className: "vazio falha-parte" });
  aviso.setAttribute("role", "alert");
  aviso.innerHTML = `Não foi possível desenhar esta parte com o recorte atual. <button type="button" class="chip-link">Tentar de novo</button>`;
  aviso.querySelector("button").addEventListener("click", () => renderParte(parte));
  (raiz.querySelector(":scope > .secao-cab") ?? raiz.firstElementChild).after(aviso);
}
const renderJanela = (id) => renderParte(id);
const janelasAbertas = () => Object.keys(JANELAS).filter((id) => $(`#${id}`).open);
function fecharJanela(dlg) {
  fecharAnimado(dlg, () => dlg.close());
  if (location.hash === `#/grafico/${dlg.id}`) history.replaceState(null, "", `${location.pathname}${location.search}`);
}

// Rota única por hash: #/grafico/<id> abre a janela; #/pessoa|uf|regiao/<id> abre o perfil por cima (a janela fica);
// outro hash fecha os dois.
async function rota() {
  const perfil = location.hash.match(PERFIL), graf = location.hash.match(/^#\/grafico\/([\w-]+)$/);
  const dlg = $("#perfil");
  if (!perfil) {
    if (dlg.open) fecharAnimado(dlg, () => dlg.close());
    for (const id of janelasAbertas()) if (id !== graf?.[1]) fecharAnimado($(`#${id}`), () => $(`#${id}`).close());
  }
  if (graf && JANELAS[graf[1]]) {
    const j = $(`#${graf[1]}`);
    if (!j.open) { j.showModal(); j.querySelector(".janela-corpo").scrollTop = 0; }
    await carregarGraficos().catch((e) => console.error(e)); // sem a biblioteca, a parte mostra o aviso de falha
    renderJanela(graf[1]);
  }
  if (!perfil) return;
  const [, tipo, chave] = perfil;
  const r = tipo === "pessoa" ? { html: htmlPerfil(decodeURIComponent(chave), ctx) }
    : tipo === "obra" ? { html: htmlObra(decodeURIComponent(chave), ctx) }
    : htmlLugar(tipo, decodeURIComponent(chave), { D, linhas: M.filtrar(D.participacao, padrao()) });
  if (!r?.html) return;
  $("#perfil-corpo").innerHTML = r.html;
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
  if (r.desenhar) { await carregarGraficos().catch((e) => console.error(e)); r.desenhar(); } // gráficos do perfil de lugar: depois de abrir, com a largura conhecida
}
addEventListener("hashchange", rota);
// Janelas: ×, Esc e clique fora fecham com animação e limpam o endereço (CA-20.2).
for (const id of Object.keys(JANELAS)) {
  const j = $(`#${id}`);
  j.addEventListener("cancel", (e) => { e.preventDefault(); fecharJanela(j); });
  j.addEventListener("click", (e) => { if (e.target === j || e.target.closest("[data-fechar]")) fecharJanela(j); });
}
{ // Esc, botão × e clique fora fecham o perfil com animação (CA-19.1).
  const dlg = $("#perfil"), fechar = () => fecharAnimado(dlg, () => dlg.close());
  dlg.addEventListener("cancel", (e) => { e.preventDefault(); fechar(); });
  // Fechou o perfil: o endereço volta ao fundo (janela ou página), sem disparar a rota.
  dlg.addEventListener("close", () => { if (PERFIL.test(location.hash)) history.replaceState(null, "", `${location.pathname}${location.search}${fundo}`); });
  dlg.querySelector("form").addEventListener("submit", (e) => { e.preventDefault(); fechar(); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) fechar(); });
}
$("#perfil-corpo").addEventListener("click", async (e) => {
  const a = e.target.closest("[data-copiar]");
  if (!a) return;
  e.preventDefault();
  try { await navigator.clipboard.writeText(location.href); a.textContent = "Link copiado"; } catch { a.textContent = location.href; }
});

// ---------- rodapé e faixa de cobertura (método e referências ficam em metodo.html, D18) ----------
function renderMetodologia() {
  $("#gerado-em").textContent = `Dados gerados em ${new Date(D.gerado_em).toLocaleString("pt-BR")}. ${D.anos_coletados.length} de ${ANOS.length} edições coletadas.`;
  $("#faixa-cobertura").innerHTML = ANOS.map((a) => `<div role="listitem" class="${D.anos_coletados.includes(a) ? "ok" : ""}" title="${a}: ${D.anos_coletados.includes(a) ? "coletada" : "não coletada"}">${a}</div>`).join("");
}

// Nota de rodapé do asterisco de gênero (CA-11.4): contagem na base inteira de pessoas-autoras.
function renderNotaGenero() {
  const base = M.kpis(M.filtrar(D.participacao, padrao()));
  $("#nota-genero").innerHTML = base.generoAtribuido ? `<b>*</b> Gênero atribuído pelo primeiro nome, sem fonte que o confirme, para
    ${fmt(base.generoAtribuido)} das ${fmt(base.pessoas)} pessoas-autoras. Esses dados podem estar errados.
    Para corrigir, escreva para <a href="mailto:${CONTATO}">${CONTATO}</a>, de preferência com uma fonte pública.` : "";
}

// ---------- ciclo ----------
function renderTudo() {
  renderParte("panorama");
  renderParte("autores");
  for (const id of janelasAbertas()) renderParte(id); // janelas fechadas desenham ao abrir (CA-20.3)
}
for (const id of ["#evo-dim", "#evo-etapa"]) $(id).addEventListener("change", () => renderEvolucao(linhasDe("evolucao"), ctxDe("evolucao")));
$("#funil-dim").addEventListener("change", () => renderFunil(linhasDe("funil")));
$("#rank-medida").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-v]");
  if (!b) return;
  $$("#rank-medida button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
  renderParte("ranking");
});
$("#ranking").addEventListener("click", (e) => { const b = e.target.closest("button[data-pessoa]"); if (b) abrirPerfil(b.dataset.pessoa); });

montarFiltros();
$$("select").forEach(melhorarSelect);
montarTrilho(abrirPerfil);
montarControlesMapa(() => renderMapa(linhasDe("geografia"), ctxDe("geografia")));
montarPessoas(ctx);
renderAbertura();
renderNotaGenero();
renderMetodologia();
renderTudo();
const historia = montarHistoria({ D, abrirPerfil });
montarNavegacao();
rota();
revelarAoRolar();
montarDiadorim();
montarBusca(D);
montarExportacao();
luzNosBlocos();
// Pré-carrega as bibliotecas dos gráficos quando a página fica ociosa: a primeira janela já abre pronta.
(window.requestIdleCallback ?? ((f) => setTimeout(f, 2500)))(() => carregarGraficos().catch(() => {}));

// Revelação ao rolar (CA-19.1): só com IntersectionObserver e movimento permitido; sem isso, tudo já aparece.
function revelarAoRolar() {
  if (movimentoReduzido() || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visivel"); io.unobserve(e.target); } }),
    { rootMargin: "0px 0px -6% 0px" });
  $$("main .secao-cab, main .secao > .cartao, main .kpis, main .graficos, main .galeria-controles").forEach((el) => { el.classList.add("revelar"); io.observe(el); });
}


let larguraAnterior = innerWidth;
addEventListener("resize", () => {
  if (Math.abs(innerWidth - larguraAnterior) < 40) return;
  larguraAnterior = innerWidth;
  clearTimeout(window.__rz);
  window.__rz = setTimeout(() => { renderTudo(); historia.redesenhar(); }, 200);
});
