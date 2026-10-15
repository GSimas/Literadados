// Página de método e referências (RF-13, RF-18, design D18): cobertura por edição e fontes agrupadas por domínio.
import { $, $$, fmt, fmtPct, esc, tabela, movimentoReduzido, luzNosBlocos } from "./ui.js";
import * as M from "./metricas.js";
import { montarTema } from "./tema.js";
import { montarBusca } from "./busca.js";
import { montarExportacao } from "./exportar.js";

montarTema();
luzNosBlocos();
const D = await fetch("dados.json").then((r) => r.json());
const ANOS = d3.range(D.anos[0], D.anos[1] + 1);
D.participacao = M.expandir(D); // a busca precisa das linhas (design D13)
montarBusca(D, "./");
montarExportacao();

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

// Revelação ao rolar, como no painel (CA-19.1).
if (!movimentoReduzido() && "IntersectionObserver" in window) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visivel"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -6% 0px" });
  $$(".secao-cab, .colunas-texto, .referencias, #t-cobertura").forEach((el) => { el.classList.add("revelar"); io.observe(el); });
}
