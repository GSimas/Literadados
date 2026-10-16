// Busca no cabeçalho (RF-21, D23): combobox sobre metricas.indiceBusca/buscar, determinística e sem IA.
import * as M from "./metricas.js";
import { $, esc, fecharAnimado } from "./ui.js";

// Destaca no rótulo original o trecho que casou com o termo (comparando sem acento e sem caixa).
function destacar(rotulo, termo) {
  const t = M.normalizar(termo).split(" ")[0];
  if (!t) return esc(rotulo);
  let norm = "";
  const pos = [];
  [...rotulo].forEach((c, i) => { for (const n of c.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()) { norm += n; pos.push(i); } });
  const k = norm.indexOf(t);
  if (k < 0) return esc(rotulo);
  const chars = [...rotulo], ini = pos[k], fim = pos[k + t.length - 1] + 1;
  return `${esc(chars.slice(0, ini).join(""))}<mark>${esc(chars.slice(ini, fim).join(""))}</mark>${esc(chars.slice(fim).join(""))}`;
}

// prefixo: "" no painel; "./" em metodo.html (as rotas #/… vivem no index).
export function montarBusca(D, prefixo = "") {
  const indice = M.indiceBusca(D);
  const campo = $("#busca-global"), lista = $("#busca-resultados");
  let itens = [], ativo = -1;

  const ir = (e) => {
    fechar();
    campo.value = "";
    campo.blur();
    // "#…" e "?…" (filtro na URL) vivem no index: em metodo.html ganham o prefixo "./".
    const href = /^[#?]/.test(e.href) && prefixo ? `${prefixo}${e.href}` : e.href;
    if (href.startsWith("#")) { location.hash = href; return; }
    // Filtro na URL (edição de um prêmio, CA-26.12): mescla com os filtros das outras partes, sem apagá-los.
    const destino = new URL(href, location.href);
    if (destino.search && destino.pathname === location.pathname) {
      const q = new URLSearchParams(location.search);
      for (const [k, v] of destino.searchParams) q.set(k, v);
      destino.search = q.toString();
    }
    location.assign(destino.href);
  };
  const marcar = (i) => {
    ativo = i;
    [...lista.children].forEach((li, k) => li.setAttribute("aria-selected", String(k === i)));
    campo.setAttribute("aria-activedescendant", i >= 0 ? `busca-op-${i}` : "");
    lista.children[i]?.scrollIntoView({ block: "nearest" });
  };
  const fechar = () => { if (lista.hidden) return; campo.setAttribute("aria-expanded", "false"); fecharAnimado(lista); };
  const mostrar = () => {
    itens = M.buscar(indice, campo.value, 12);
    if (!campo.value.trim()) return fechar();
    lista.innerHTML = itens.length
      ? itens.map((e, i) => `<li id="busca-op-${i}" role="option" aria-selected="false" data-i="${i}">
          <span class="busca-tipo">${esc(e.tipo)}</span><span class="busca-txt"><b>${destacar(e.rotulo, campo.value)}</b><small>${esc(e.sub)}</small></span></li>`).join("")
      : `<li class="busca-vazio" role="option" aria-disabled="true">Nada encontrado para “${esc(campo.value.trim())}”.</li>`;
    lista.hidden = false;
    campo.setAttribute("aria-expanded", "true");
    marcar(itens.length ? 0 : -1);
  };

  campo.addEventListener("input", mostrar);
  campo.addEventListener("focus", () => { if (campo.value.trim()) mostrar(); });
  campo.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (lista.hidden) return mostrar();
      if (itens.length) marcar((ativo + (e.key === "ArrowDown" ? 1 : -1) + itens.length) % itens.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (itens[ativo]) ir(itens[ativo]);
    } else if (e.key === "Escape") {
      e.stopPropagation();
      if (!lista.hidden) fechar(); else { campo.value = ""; campo.blur(); }
    }
  });
  lista.addEventListener("pointerdown", (e) => e.preventDefault()); // mantém o foco no campo
  lista.addEventListener("click", (e) => { const li = e.target.closest("li[data-i]"); if (li) ir(itens[+li.dataset.i]); });
  lista.addEventListener("pointermove", (e) => { const li = e.target.closest("li[data-i]"); if (li && +li.dataset.i !== ativo) marcar(+li.dataset.i); });
  campo.addEventListener("blur", () => setTimeout(fechar, 120));
  // Atalhos: "/" fora de campos de texto, ou Ctrl/⌘+K em qualquer lugar.
  document.addEventListener("keydown", (e) => {
    const digitando = e.target.closest?.("input, textarea, [contenteditable]");
    if ((e.key === "/" && !digitando) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) { e.preventDefault(); campo.focus(); campo.select(); }
  });
}
