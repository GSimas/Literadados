// Utilitários de interface compartilhados pelos módulos do painel (formatação, tokens, tabelas, fotos e dicas).
import * as M from "./metricas.js";

export const $ = (s, raiz = document) => raiz.querySelector(s);
export const $$ = (s, raiz = document) => [...raiz.querySelectorAll(s)];
export const fmt = (v, casas = 0) => (v == null ? "–" : v.toLocaleString("pt-BR", { maximumFractionDigits: casas, minimumFractionDigits: casas }));
export const fmtPct = (v) => (v == null ? "–" : `${fmt(v, v < 10 && v % 1 ? 1 : 0)}%`);
export const nPequeno = (total) => (total < 5 ? " (n pequeno)" : "");
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const rotulo = (g) => M.ROTULO[g] ?? g;
export const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
export const movimentoReduzido = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export const largura = (el) => Math.max(300, el.clientWidth || 600);
export const estilo = () => ({ background: "transparent", color: css("--tinta"), fontSize: "12px", fontFamily: "inherit" });

export const ROT_RACA = { branca: "Branca", preta: "Preta", parda: "Parda", negra: "Negra (sem especificar)", amarela: "Amarela", indigena: "Indígena", sem_declaracao: "Sem declaração" };
export const ROT_GEN = { mulher: "Mulher", homem: "Homem", nao_binario: "Não binária", nao_identificado: "Não identificado" };
// Gênero atribuído pelo primeiro nome (CA-11.4, D16): asterisco que leva à nota de rodapé.
export const CONTATO = "gustavosimassilva@gmail.com";
export const astGenero = (n) => (n ? `<a class="nota-ref" href="#nota-genero" title="Inclui gênero atribuído pelo nome: ver nota">*</a>` : "");
// Taxonomia comum (CA-26.3), na ordem dos menus e gráficos. CATEGORIAS = as que existem nos dados (definirDados).
export const ORDEM_CATEGORIAS = ["Romance", "Contos", "Crônica", "Poesia", "Infantil", "Juvenil", "Infantil e Juvenil", "Geral", "Livro do Ano"];
export const CATEGORIAS = ORDEM_CATEGORIAS.filter((c) => c !== "Geral");
// Prêmios da base, na ordem de D.premios (o 1º é o padrão, DA-4), e o nome de cada um.
export const PREMIOS = [];
export const NOME_PREMIO = {};
export function definirDados(D) {
  const presentes = new Set(D.categorias.map((c) => c.categoria));
  CATEGORIAS.splice(0, CATEGORIAS.length, ...ORDEM_CATEGORIAS.filter((c) => presentes.has(c)));
  PREMIOS.splice(0, PREMIOS.length, ...(D.premios ?? []).map((p) => p.id));
  for (const p of D.premios ?? []) NOME_PREMIO[p.id] = p.nome;
}
// País de nascimento (DA-3): código ISO → nome em português ("PT" → "Portugal").
const PAISES = typeof Intl !== "undefined" && Intl.DisplayNames ? new Intl.DisplayNames(["pt-BR"], { type: "region" }) : null;
export const nomePais = (iso) => { try { return (iso && PAISES?.of(iso)) || iso || ""; } catch { return iso; } };
// "Prêmio Jabuti", "Prêmio Jabuti e Oceanos", "3 prêmios" (rodapés e resumos).
export function nomesPremios(ids = PREMIOS.slice(0, 1)) {
  const ns = ids.map((p) => NOME_PREMIO[p] ?? p);
  return ns.length <= 2 ? ns.join(" e ") : `${ns.length} prêmios`;
}

// Cor fixa por grupo (a mesma em todos os gráficos); dado faltante sempre em cinza.
export function cores(dim) {
  const s = ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6"].map(css);
  const dominio = M.ORDEM[dim];
  const faltante = { genero: "nao_identificado", raca: "sem_declaracao", regiao: "sem dado" }[dim];
  let i = 0;
  return { domain: dominio, range: dominio.map((g) => (g === faltante ? css("--s-na") : s[i++])) };
}
export const corDe = (dim, g) => { const c = cores(dim); return c.range[c.domain.indexOf(g)] ?? css("--s-na"); };
// Texto sobre a rampa sequencial: claro sobre fundo escuro e vice-versa (a rampa inverte no tema escuro).
export function textoSobre(fracao) {
  const escuroNoFim = d3.lab(css("--seq-1")).l < d3.lab(css("--seq-0")).l;
  return (fracao > 0.55) === escuroNoFim ? "#fff" : "#111";
}

// Botão de exportar tabela (CA-14.3): vai junto de toda tabela, dentro de .tabela-exportavel.
export const BOTAO_TABELA = `<button type="button" class="exportar-botao exportar-tabela" data-exportar="tabela" title="Exportar tabela"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 19h14"/></svg><span>Exportar</span></button>`;
export function tabela(el, linhas, colunas) {
  if (!linhas.length) { el.innerHTML = `<p class="vazio">Sem dados no recorte.</p>`; return; }
  el.innerHTML = `<div class="tabela-exportavel">${BOTAO_TABELA}<div class="rolagem"><table class="tabela"><thead><tr>${colunas.map((c) => `<th class="${c.num ? "num" : ""}" scope="col">${esc(c.rot)}</th>`).join("")}</tr></thead>
  <tbody>${linhas.map((l) => `<tr>${colunas.map((c) => `<td class="${c.num ? "num" : ""}">${esc(c.f ? c.f(l) : l[c.k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
}
// Todo gráfico do Plot passa por aqui: destaque no hover (CA-19.9) e fade das dicas (CA-19.8).
// Botão de exportar imagem (CA-14.2): fica dentro do contêiner do gráfico, e exportar.js usa o pai dele como alvo.
export const botaoExportarGrafico = () => {
  const b = document.createElement("button");
  Object.assign(b, { type: "button", className: "exportar-botao", title: "Exportar imagem" });
  b.dataset.exportar = "grafico";
  b.setAttribute("aria-label", "Exportar gráfico como imagem");
  b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 19h14"/></svg>';
  return b;
};
// Plot e d3-sankey (dependem do d3 global) só carregam quando um gráfico de janela ou de perfil de lugar vai ser desenhado (RNF-08).
const BIBLIOTECAS = ["https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.16/dist/plot.umd.min.js", "https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/dist/d3-sankey.min.js"];
let carregando = null;
export function carregarGraficos() {
  carregando ??= Promise.all(BIBLIOTECAS.map((src) => new Promise((ok, erro) => document.head.append(Object.assign(document.createElement("script"),
    { src, onload: ok, onerror: () => { carregando = null; erro(new Error(`não carregou ${src}`)); } })))));
  return carregando;
}
export const desenhar = (el, no) => {
  no.querySelectorAll("g[aria-label]").forEach((g) => g.setAttribute("aria-hidden", "true")); // marcas do Plot: o <svg> leva o rótulo e há tabela equivalente
  el.replaceChildren(no, botaoExportarGrafico()); realcarNoHover(no); suavizarDicas(no);
};
export const vazio = (el, msg = "Sem dados no recorte selecionado.") => { el.innerHTML = `<p class="vazio">${msg}</p>`; };

// Dica flutuante única para os gráficos desenhados à mão (mapa, Sankey, história).
export const dica = {
  mostrar(ev, html) {
    const t = $("#tip");
    clearTimeout(t._saida);
    t.classList.remove("saindo");
    t.innerHTML = html;
    t.hidden = false;
    const r = t.getBoundingClientRect();
    t.style.left = `${Math.min(ev.clientX + 14, innerWidth - r.width - 8)}px`;
    t.style.top = `${Math.min(ev.clientY + 14, innerHeight - r.height - 8)}px`;
  },
  // Fade de saída (CA-19.8): some depois da transição; um novo mostrar() cancela.
  esconder() {
    const t = $("#tip");
    if (t.hidden) return;
    t.classList.add("saindo");
    clearTimeout(t._saida);
    t._saida = setTimeout(() => { t.hidden = true; t.classList.remove("saindo"); }, movimentoReduzido() ? 0 : 180);
  },
};

// Foto do Commons (licença livre, CA-11.3) ou avatar de iniciais com matiz neutro derivado do id.
export const urlFoto = (arquivo, w = 320) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(arquivo)}?width=${w}`;
// Miniatura WebP servida pelo site (coleta.py miniaturas, RNF-08) quando existe; senão, o Commons.
export const srcFoto = (id, m, w) => (m.miniatura ? `fotos/${id}-${w <= 160 ? 160 : 480}.webp` : urlFoto(m.imagem, w));
export const paginaArquivo = (arquivo) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(arquivo.replace(/ /g, "_"))}`;
export function foto(p, midia, { w = 320, classe = "foto" } = {}) {
  const avatar = `<span class="avatar" aria-hidden="true" data-iniciais="${esc(M.iniciais(p.nome))}" style="--h:${M.corAvatar(p.id)}"></span>`;
  if (!midia?.imagem) return `<span class="${classe}">${avatar}</span>`;
  // O avatar fica por baixo: se a foto não carregar, ela some e as iniciais aparecem.
  return `<span class="${classe}">${avatar}<img src="${esc(srcFoto(p.id, midia, w))}" alt="" loading="lazy" decoding="async" onerror="this.remove()"></span>`;
}
export const credito = (m) => (m?.imagem
  ? `Foto: ${esc(m.imagem_autor)} · <a href="${esc(paginaArquivo(m.imagem))}" target="_blank" rel="noopener noreferrer">${esc(m.imagem_licenca)}, Wikimedia Commons</a>`
  : "");

// ---------- sistema visual próprio (RF-19, D17) ----------

// Roda a animação de saída (.saindo) e só então esconde; sem animação (movimento reduzido), esconde na hora.
export function fecharAnimado(el, fechar = () => { el.hidden = true; }) {
  if (el.classList.contains("saindo")) return;
  el.classList.add("saindo");
  let feito = false;
  const fim = () => { if (feito) return; feito = true; el.removeEventListener("animationend", h); el.classList.remove("saindo"); fechar(); };
  const h = (e) => { if (e.target === el) fim(); };
  if (getComputedStyle(el).animationName === "none") return fim();
  el.addEventListener("animationend", h);
  setTimeout(fim, 600); // aba em segundo plano pode não entregar animationend
}

// Conta de 0 até o valor (abertura). O texto final é sempre o valor formatado exato.
export function contar(el, alvo, formatar, ms = 1200) {
  if (alvo == null || movimentoReduzido()) { el.textContent = formatar(alvo); return; }
  const t0 = performance.now();
  const passo = (t) => {
    const k = Math.min(1, (t - t0) / ms), v = alvo * (1 - (1 - k) ** 3);
    el.textContent = formatar(k < 1 ? v : alvo);
    if (k < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

// Select próprio (CA-19.2): o <select> nativo fica escondido como fonte do valor e dos eventos "change";
// por cima, um botão que abre uma listbox operável por teclado.
let nSel = 0;
export function melhorarSelect(sel) {
  if (sel.dataset.melhorado) return; // a barra de filtro já melhora os seus
  sel.dataset.melhorado = "1";
  const id = sel.id || `sel-${++nSel}`;
  const raiz = Object.assign(document.createElement("span"), { className: "sel" });
  const botao = Object.assign(document.createElement("button"), { type: "button", className: "sel-botao", id: `${id}-botao` });
  const lista = Object.assign(document.createElement("ul"), { className: "sel-lista", id: `${id}-lista`, hidden: true, tabIndex: -1 });
  botao.setAttribute("aria-haspopup", "listbox");
  botao.setAttribute("aria-controls", lista.id);
  botao.setAttribute("aria-expanded", "false");
  lista.setAttribute("role", "listbox");
  const rotulo = sel.closest("label");
  if (rotulo) { rotulo.htmlFor = botao.id; lista.setAttribute("aria-label", rotulo.firstChild?.textContent.trim() ?? ""); }
  sel.hidden = true;
  sel.tabIndex = -1;
  sel.after(raiz);
  raiz.append(botao, lista);

  let ativo = 0;
  const desenhar = () => {
    const ops = [...sel.options];
    lista.innerHTML = ops.map((o, i) => `<li role="option" id="${lista.id}-${i}" data-i="${i}" aria-selected="${o.selected}">${esc(o.textContent)}</li>`).join("");
    botao.innerHTML = `<span>${esc(sel.selectedOptions[0]?.textContent ?? "")}</span><svg class="sel-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
  };
  // Mudança programática (sel.value = x) não dispara evento: o setter da instância redesenha.
  const proto = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  Object.defineProperty(sel, "value", { configurable: true, get() { return proto.get.call(this); }, set(v) { proto.set.call(this, v); desenhar(); } });
  new MutationObserver(desenhar).observe(sel, { childList: true, subtree: true, attributes: true });
  desenhar();

  const marcar = () => {
    [...lista.children].forEach((li, i) => li.classList.toggle("ativo", i === ativo));
    lista.setAttribute("aria-activedescendant", `${lista.id}-${ativo}`);
    lista.children[ativo]?.scrollIntoView({ block: "nearest" });
  };
  const abrir = () => {
    if (!lista.hidden) return;
    lista.hidden = false;
    raiz.classList.add("aberto");
    botao.setAttribute("aria-expanded", "true");
    ativo = Math.max(0, sel.selectedIndex);
    marcar();
    lista.focus();
  };
  const fechar = (foco = true) => {
    if (lista.hidden) return;
    raiz.classList.remove("aberto");
    botao.setAttribute("aria-expanded", "false");
    fecharAnimado(lista);
    if (foco) botao.focus();
  };
  const escolher = (i) => {
    if (i !== sel.selectedIndex) {
      sel.selectedIndex = i;
      desenhar();
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }
    fechar();
  };
  botao.addEventListener("click", () => (lista.hidden ? abrir() : fechar()));
  botao.addEventListener("keydown", (e) => { if (["ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); abrir(); } });
  lista.addEventListener("click", (e) => { const li = e.target.closest("li"); if (li) escolher(+li.dataset.i); });
  lista.addEventListener("keydown", (e) => {
    const n = lista.children.length;
    const mover = { ArrowDown: ativo + 1, ArrowUp: ativo - 1, Home: 0, End: n - 1, PageDown: ativo + 5, PageUp: ativo - 5 }[e.key];
    if (mover != null) { e.preventDefault(); ativo = Math.max(0, Math.min(n - 1, mover)); marcar(); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); escolher(ativo); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar(); }
    else if (e.key === "Tab") fechar(false);
  });
  document.addEventListener("pointerdown", (e) => { if (!raiz.contains(e.target)) fechar(false); });
}

// ---------- destaque no hover e fade das dicas do Plot (CA-19.8, CA-19.9, D19) ----------
const FORMAS = ':is(g[aria-label="bar"], g[aria-label="cell"], g[aria-label="dot"], g[aria-label="rect"]) > :is(rect, circle, path)';
const svgsDeMarcas = (raiz) => [raiz, ...raiz.querySelectorAll("svg")].filter((s) => s instanceof SVGSVGElement && s.querySelector("g[aria-label]"));

// Marca .em-foco na forma sob o ponteiro (ou a mais próxima, até 28 px, como faz a dica do Plot); o CSS esmaece as demais.
export function realcarNoHover(raiz) {
  for (const svg of svgsDeMarcas(raiz)) {
    const formas = [...svg.querySelectorAll(FORMAS)];
    if (formas.length < 2) continue;
    let atual = null;
    const marcar = (f) => {
      if (f === atual) return;
      atual?.classList.remove("em-foco");
      atual = f;
      f?.classList.add("em-foco");
      svg.classList.toggle("com-foco", !!f);
    };
    svg.addEventListener("pointermove", (e) => {
      if (formas.includes(e.target)) return marcar(e.target);
      let melhor = null, dMin = 28;
      for (const f of formas) {
        const r = f.getBoundingClientRect();
        const d = Math.hypot(Math.max(r.left - e.clientX, 0, e.clientX - r.right), Math.max(r.top - e.clientY, 0, e.clientY - r.bottom));
        if (d < dMin) { dMin = d; melhor = f; }
      }
      marcar(melhor);
    });
    svg.addEventListener("pointerleave", () => marcar(null));
  }
}

// O Plot troca o grupo "tip" inteiro a cada movimento e o esvazia ao sair. Entrada: fade por CSS (só quando a dica
// aparece, não ao pular de um ponto para outro). Saída: reinsere uma cópia da última dica com animação e a remove.
export function suavizarDicas(raiz) {
  for (const svg of svgsDeMarcas(raiz)) {
    new MutationObserver((ms) => {
      for (const m of ms) {
        const novo = [...m.addedNodes].find((n) => n.getAttribute?.("aria-label") === "tip");
        const velho = [...m.removedNodes].find((n) => n.getAttribute?.("aria-label") === "tip");
        if (!novo || !velho) continue;
        svg.querySelectorAll(".dica-saindo").forEach((n) => n.remove());
        if (novo.childElementCount && velho.childElementCount) novo.classList.add("sem-fade");
        if (!novo.childElementCount && velho.childElementCount && !movimentoReduzido()) {
          velho.classList.add("dica-saindo");
          novo.after(velho);
          setTimeout(() => velho.remove(), 200);
        }
      }
    }).observe(svg, { childList: true });
  }
}

// Brilho de fundo que segue o ponteiro nos blocos (CA-19.10): só define --mx/--my; o CSS faz a luz e a transição.
export const BLOCOS = ".kpi, .cartao, .tempo-trilho > li, .cartao-grafico, .passo-cartao";
export function luzNosBlocos() {
  document.addEventListener("pointermove", (e) => {
    const b = e.target.closest?.(BLOCOS);
    if (!b) return;
    const r = b.getBoundingClientRect();
    b.style.setProperty("--mx", `${e.clientX - r.left}px`);
    b.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, { passive: true });
}

// ---------- filtro de uma parte (RF-02, D22) ----------
// Desenha a barra em `el` e altera `estado` (anoIni, anoFim, categorias, papel e, com vários prêmios, premios);
// chama aoMudar() a cada mudança. Devolve resumo(html), para a parte mostrar o tamanho do próprio recorte.
let nFiltro = 0;
// Menu de caixas de seleção (categorias, prêmios): botão com resumo, lista com "todos", Esc e clique fora fecham.
function menuMarcavel(wrap, { id, rotulo, opcoes, todos, obter, definir, resumo, aoMudar }) {
  wrap.innerHTML = `<button type="button" class="sel-botao" id="${id}" aria-haspopup="true" aria-expanded="false" aria-controls="${id}-menu"></button>
    <span class="menu filtro-menu" id="${id}-menu" role="group" aria-label="${esc(rotulo)}" hidden>
      ${opcoes.map((o) => `<label class="chip"><input type="checkbox" value="${esc(o.v)}">${esc(o.rot)}</label>`).join("")}
      <span class="filtro-menu-acoes"><button type="button" class="chip-link" data-todas>${esc(todos)}</button></span>
    </span>`;
  const botao = $("button.sel-botao", wrap), menu = $(".filtro-menu", wrap), caixas = $$("input", menu);
  const sincronizar = () => {
    caixas.forEach((c) => { c.checked = obter().includes(c.value); });
    botao.innerHTML = `<span>${esc(resumo())}</span><svg class="sel-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
  };
  const fechar = (foco = false) => { if (menu.hidden) return; botao.setAttribute("aria-expanded", "false"); wrap.closest(".filtro")?.classList.remove("cats-aberto"); fecharAnimado(menu); if (foco) botao.focus(); };
  // Desmarcar tudo não deixa o recorte vazio: volta a marcar todos.
  menu.addEventListener("change", () => { const v = opcoes.map((o) => o.v).filter((x) => caixas.find((c) => c.value === x).checked); definir(v.length ? v : opcoes.map((o) => o.v)); aoMudar(); });
  $("[data-todas]", menu).addEventListener("click", () => { definir(opcoes.map((o) => o.v)); aoMudar(); });
  botao.addEventListener("click", () => {
    if (!menu.hidden) return fechar();
    menu.hidden = false;
    botao.setAttribute("aria-expanded", "true");
    wrap.closest(".filtro")?.classList.add("cats-aberto");
    caixas[0]?.focus();
  });
  menu.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fechar(true); } });
  document.addEventListener("pointerdown", (e) => { if (!wrap.contains(e.target)) fechar(); });
  return sincronizar;
}
export function montarFiltro(el, estado, { anos, padrao, aoMudar, baixar }) {
  const id = `filtro-${++nFiltro}`;
  const opAnos = (v) => anos.map((a) => `<option ${a === v ? "selected" : ""}>${a}</option>`).join("");
  const comPremios = PREMIOS.length > 1 && !!estado.premios; // com um prêmio só, nada muda na barra (CA-26.2)
  el.classList.add("filtro");
  el.innerHTML = `<span class="filtro-rot"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Filtro</span>
    ${comPremios ? `<span class="filtro-cats filtro-premios"></span>` : ""}
    <label>De <select id="${id}-ini">${opAnos(estado.anoIni)}</select></label>
    <label>até <select id="${id}-fim">${opAnos(estado.anoFim)}</select></label>
    <span class="filtro-cats filtro-categorias"></span>
    <label>Pessoas <select id="${id}-papel"><option value="autor">só autores</option><option value="todos">autores e ilustradores</option></select></label>
    <span class="filtro-resumo" aria-live="polite"></span>
    <button type="button" class="chip-link" data-limpar>limpar</button>
    <button type="button" class="chip-link" data-csv>CSV</button>`;
  const ini = $(`#${id}-ini`, el), fim = $(`#${id}-fim`, el), papel = $(`#${id}-papel`, el);
  const iguais = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  let sincCats = () => {}, sincPremios = () => {};
  const sincronizar = () => {
    ini.value = estado.anoIni; fim.value = estado.anoFim; papel.value = estado.papel;
    sincCats(); sincPremios();
    const p = padrao();
    $("[data-limpar]", el).hidden = estado.anoIni === p.anoIni && estado.anoFim === p.anoFim && estado.papel === p.papel
      && estado.categorias.length === CATEGORIAS.length && (!comPremios || iguais(estado.premios, p.premios));
  };
  const mudou = () => { sincronizar(); aoMudar(); };
  sincCats = menuMarcavel($(".filtro-categorias", el), {
    id: `${id}-cats`, rotulo: "Categorias", todos: "todas", opcoes: CATEGORIAS.map((c) => ({ v: c, rot: c })),
    obter: () => estado.categorias, definir: (v) => { estado.categorias = v; }, aoMudar: mudou,
    resumo: () => (estado.categorias.length === CATEGORIAS.length ? "Todas as categorias"
      : estado.categorias.length === 1 ? estado.categorias[0] : `${estado.categorias.length} categorias`),
  });
  if (comPremios) sincPremios = menuMarcavel($(".filtro-premios", el), {
    id: `${id}-premios`, rotulo: "Prêmios", todos: "todos", opcoes: PREMIOS.map((p) => ({ v: p, rot: NOME_PREMIO[p] ?? p })),
    obter: () => estado.premios, definir: (v) => { estado.premios = v; }, aoMudar: mudou,
    resumo: () => (estado.premios.length === PREMIOS.length ? "Todos os prêmios" : nomesPremios(estado.premios)),
  });
  [ini, fim, papel].forEach(melhorarSelect);
  sincronizar();
  ini.addEventListener("change", () => { estado.anoIni = +ini.value; estado.anoFim = Math.max(estado.anoFim, estado.anoIni); mudou(); });
  fim.addEventListener("change", () => { estado.anoFim = Math.max(+fim.value, estado.anoIni); mudou(); });
  papel.addEventListener("change", () => { estado.papel = papel.value; mudou(); });
  $("[data-limpar]", el).addEventListener("click", () => { Object.assign(estado, padrao()); mudou(); });
  $("[data-csv]", el).addEventListener("click", baixar);
  return { resumo: (html) => { $(".filtro-resumo", el).innerHTML = html; } };
}
