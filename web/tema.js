// Tema claro, escuro ou automático (CA-15.2, CA-19.6): botão de ícone de tamanho fixo com menu. Usado pelas duas páginas.
import { $, $$, fecharAnimado, movimentoReduzido } from "./ui.js";

const NOME_TEMA = { auto: "Automático", light: "Claro", dark: "Escuro" };
const ICONE_TEMA = {
  light: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>',
  auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5z" fill="currentColor"/></svg>',
};

function aplicarTema(t) {
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  $("#tema").innerHTML = ICONE_TEMA[t];
  $("#tema").setAttribute("aria-label", `Tema de cores: ${NOME_TEMA[t].toLowerCase()}`);
  $("#tema").title = `Tema: ${NOME_TEMA[t]}`;
  $$("#menu-tema [data-tema]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.tema === t)));
  try { localStorage.setItem("tema", t); } catch {}
}

// Aplica o tema salvo na hora; aoTrocar redesenha o que depende de cor (gráficos).
export function montarTema(aoTrocar = () => {}) {
  let tema = "auto";
  try { tema = localStorage.getItem("tema") || "auto"; } catch {}
  const botao = $("#tema"), menu = $("#menu-tema"), itens = $$("[data-tema]", menu);
  itens.forEach((b) => { b.innerHTML = `${ICONE_TEMA[b.dataset.tema]}${NOME_TEMA[b.dataset.tema]}`; });
  aplicarTema(tema);
  const fechar = (foco = true) => { if (menu.hidden) return; botao.setAttribute("aria-expanded", "false"); fecharAnimado(menu); if (foco) botao.focus(); };
  const abrir = () => { menu.hidden = false; botao.setAttribute("aria-expanded", "true"); (itens.find((b) => b.dataset.tema === tema) ?? itens[0]).focus(); };
  botao.addEventListener("click", () => (menu.hidden ? abrir() : fechar()));
  menu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tema]");
    if (!b) return;
    fechar();
    if (b.dataset.tema === tema) return;
    tema = b.dataset.tema;
    // Troca com fade (View Transitions, quando houver).
    const trocar = () => { aplicarTema(tema); aoTrocar(); };
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
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (tema === "auto") aoTrocar(); });
}
