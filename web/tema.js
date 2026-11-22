// Tema claro, escuro ou automático (CA-15.2, CA-19.6): botão de ícone de tamanho fixo; cada clique passa ao próximo tema.
// Usado pelas duas páginas.
import { $, movimentoReduzido } from "./ui.js";

const ORDEM = ["auto", "light", "dark"];
const NOME_TEMA = { auto: "Automático", light: "Claro", dark: "Escuro" };
const ICONE_TEMA = {
  light: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>',
  auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5z" fill="currentColor"/></svg>',
};

function aplicarTema(t) {
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  const proximo = ORDEM[(ORDEM.indexOf(t) + 1) % ORDEM.length];
  $("#tema").innerHTML = ICONE_TEMA[t];
  $("#tema").setAttribute("aria-label", `Tema de cores: ${NOME_TEMA[t].toLowerCase()}. Clique para ${NOME_TEMA[proximo].toLowerCase()}`);
  $("#tema").title = `Tema: ${NOME_TEMA[t]} (clique para ${NOME_TEMA[proximo]})`;
  try { localStorage.setItem("tema", t); } catch {}
}

// Se o redesenho dos gráficos mudar a altura da página por um instante, a rolagem volta ao lugar (sem animar:
// a página usa scroll-behavior: smooth).
function semMexerNaRolagem(fn) {
  const x = scrollX, y = scrollY, voltar = () => { if (scrollX !== x || scrollY !== y) scrollTo({ left: x, top: y, behavior: "instant" }); };
  fn();
  voltar();
  requestAnimationFrame(voltar);
}
let fimTroca;

// Aplica o tema salvo na hora; aoTrocar redesenha o que depende de cor (gráficos).
export function montarTema(aoTrocar = () => {}) {
  let tema = "auto";
  try { tema = localStorage.getItem("tema") || "auto"; } catch {}
  if (!ORDEM.includes(tema)) tema = "auto";
  aplicarTema(tema);
  $("#tema").addEventListener("click", () => {
    tema = ORDEM[(ORDEM.indexOf(tema) + 1) % ORDEM.length];
    // Transição só de cores, por CSS (.trocando-tema). A View Transition de antes animava um retrato da página
    // inteira, causa provável da tela "subir" um pouco a cada troca.
    const raiz = document.documentElement;
    if (!movimentoReduzido()) { raiz.classList.add("trocando-tema"); clearTimeout(fimTroca); fimTroca = setTimeout(() => raiz.classList.remove("trocando-tema"), 400); }
    semMexerNaRolagem(() => { aplicarTema(tema); aoTrocar(); });
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (tema === "auto") semMexerNaRolagem(aoTrocar); });
}


// Faixas do fundo animado (portal e abertura dos prêmios): embaralha os itens entre as faixas e sorteia o ponto de partida
// de cada uma (atraso negativo), para a página não abrir sempre na mesma disposição. Cada faixa tem o conteúdo duplicado
// (rola até -50%); `itens` (HTML) troca o conteúdo, senão usa a 1ª metade de cada faixa. `porFaixa` limita quantos entram.
export function sortearFaixas(faixas, itens = null, porFaixa = Infinity) {
  faixas = [...faixas];
  if (!faixas.length) return;
  const pool = itens ? [...itens] : faixas.flatMap((f) => [...f.children].slice(0, f.children.length / 2).map((c) => c.outerHTML));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  faixas.forEach((f, k) => {
    const meus = pool.filter((_, i) => i % faixas.length === k).slice(0, porFaixa).join("");
    f.innerHTML = meus + meus;
    const dur = parseFloat(getComputedStyle(f).getPropertyValue("--dur")) || 120;
    f.style.animationDelay = `-${(Math.random() * dur).toFixed(1)}s`;
  });
}

// Fundo animado (portal, CA-31.2; Leitura, Mapeamento e Eventos, CA-31.12): sorteia as faixas e só mostra o fundo com todas
// as imagens carregadas (sem fotos surgindo aos poucos); tempo-limite para rede lenta.
export function montarFundo(fundo, itens = null, porFaixa = Infinity) {
  if (!fundo) return;
  sortearFaixas(fundo.querySelectorAll(".hero-faixa"), itens, porFaixa);
  const urls = [...new Set([...fundo.querySelectorAll("img")].map((i) => i.src))];
  const carga = urls.map((u) => { const im = new Image(); im.referrerPolicy = "no-referrer"; im.src = u; return im.decode().catch(() => {}); });
  Promise.race([Promise.all(carga), new Promise((r) => setTimeout(r, 6000))]).then(() => fundo.classList.add("pronto"));
}
