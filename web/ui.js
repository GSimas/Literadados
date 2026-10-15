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
