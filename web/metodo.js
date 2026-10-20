// Página de método e referências (RF-13, RF-18, design D18): cobertura por edição e fontes agrupadas por domínio.
import { $, $$, fmt, fmtPct, esc, tabela, movimentoReduzido, luzNosBlocos, carregarDados } from "./ui.js";
import * as M from "./metricas.js";
import { montarTema } from "./tema.js";
import { montarBusca } from "./busca.js";
import { montarExportacao } from "./exportar.js";

montarTema();
luzNosBlocos();
const D = await carregarDados(); // dados.json + partes de outros prêmios (CA-26.14)
const ANOS = d3.range(D.anos[0], D.anos[1] + 1);
D.participacao = M.expandir(D); // a busca precisa das linhas (design D13)
montarBusca(D, "./");
montarExportacao();

// Cobertura por prêmio e edição (CA-26.7); D.cobertura omite o 1º prêmio da ordem (economia). Cada prêmio só a partir da 1ª edição.
const premios = D.premios ?? [];
const padrao = premios[0]?.id, multi = premios.length > 1;
const porEdicao = new Map(D.cobertura.map((c) => [`${c.premio ?? padrao}|${c.ano}`, c]));
const linhasCob = premios.flatMap((p) => ANOS.filter((a) => a >= (p.ano_inicio ?? ANOS[0]))
  .map((a) => ({ premio: p.nome, ano: a, ...(porEdicao.get(`${p.id}|${a}`) ?? {}) })));
tabela($("#t-cobertura"), linhasCob, [...(multi ? [{ rot: "Prêmio", k: "premio" }] : []),
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
$("#gerado-em").textContent = `Dados gerados em ${new Date(D.gerado_em).toLocaleString("pt-BR")}. ${fmt(D.cobertura.length)} edições coletadas${multi ? ` em ${premios.length} prêmios` : ""}.`;

// Prêmios da base (RF-26, DA-5): nomes vindos dos dados e o quadro de prêmios com organizador, período e formatos.
const nomes = premios.map((p) => p.nome), lista = nomes.length > 1 ? `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}` : nomes[0];
if (lista) $$("[data-premios-texto]").forEach((el) => { el.textContent = lista; });
if (premios.length && $("#metodo-premios")) {
  const regimes = d3.rollups(D.edicoes ?? [], (v) => ({ de: d3.min(v, (x) => x.ano), ate: d3.max(v, (x) => x.ano) }), (x) => x.premio ?? padrao, (x) => x.regime);
  const porP = new Map(regimes);
  $("#metodo-premios").innerHTML = `<h3>Prêmios da base</h3><ul>${premios.map((p) => `<li><b>${esc(p.nome)}</b> (${esc(p.organizador ?? "")}${p.abrangencia === "lusofono" ? "; prêmio de literatura em língua portuguesa (quem pode concorrer mudou com os anos)" : ""}${p.obras === "ineditas" ? "; premia <b>originais inéditos</b>, não livros publicados" : ""}):
    ${(porP.get(p.id) ?? []).map(([r, x]) => (/^\d{4}/.test(r) ? esc(r) : `${esc(r)} (${x.de === x.ate ? x.de : `${x.de}–${x.ate}`})`)).join("; ")}.</li>`).join("")}</ul>`; // regime que já começa pelo período não repete os anos
}

// Revelação ao rolar, como no painel (CA-19.1).
if (!movimentoReduzido() && "IntersectionObserver" in window) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visivel"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -6% 0px" });
  $$(".secao-cab, .colunas-texto, .referencias, #t-cobertura").forEach((el) => { el.classList.add("revelar"); io.observe(el); });
}
