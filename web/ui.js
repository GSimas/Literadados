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
export const CATEGORIAS = ["Romance", "Contos", "Crônica", "Poesia", "Infantil", "Juvenil", "Infantil e Juvenil", "Livro do Ano"];

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

export function tabela(el, linhas, colunas) {
  if (!linhas.length) { el.innerHTML = `<p class="vazio">Sem dados no recorte.</p>`; return; }
  el.innerHTML = `<div class="rolagem"><table class="tabela"><thead><tr>${colunas.map((c) => `<th class="${c.num ? "num" : ""}" scope="col">${esc(c.rot)}</th>`).join("")}</tr></thead>
  <tbody>${linhas.map((l) => `<tr>${colunas.map((c) => `<td class="${c.num ? "num" : ""}">${esc(c.f ? c.f(l) : l[c.k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
export const desenhar = (el, no) => el.replaceChildren(no);
export const vazio = (el, msg = "Sem dados no recorte selecionado.") => { el.innerHTML = `<p class="vazio">${msg}</p>`; };

// Dica flutuante única para os gráficos desenhados à mão (mapa, Sankey, história).
export const dica = {
  mostrar(ev, html) {
    const t = $("#tip");
    t.innerHTML = html;
    t.hidden = false;
    const r = t.getBoundingClientRect();
    t.style.left = `${Math.min(ev.clientX + 14, innerWidth - r.width - 8)}px`;
    t.style.top = `${Math.min(ev.clientY + 14, innerHeight - r.height - 8)}px`;
  },
  esconder() { $("#tip").hidden = true; },
};

// Foto do Commons (licença livre, CA-11.3) ou avatar de iniciais com matiz neutro derivado do id.
export const urlFoto = (arquivo, w = 320) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(arquivo)}?width=${w}`;
export const paginaArquivo = (arquivo) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(arquivo.replace(/ /g, "_"))}`;
export function foto(p, midia, { w = 320, classe = "foto" } = {}) {
  const avatar = `<span class="avatar" style="--h:${M.corAvatar(p.id)}">${esc(M.iniciais(p.nome))}</span>`;
  if (!midia?.imagem) return `<span class="${classe}">${avatar}</span>`;
  // O avatar fica por baixo: se a foto não carregar, ela some e as iniciais aparecem.
  return `<span class="${classe}">${avatar}<img src="${esc(urlFoto(midia.imagem, w))}" alt="" loading="lazy" decoding="async" onerror="this.remove()"></span>`;
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
