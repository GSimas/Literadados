// Página de método e referências (RF-13, RF-18, design D18): cobertura por edição e fontes agrupadas por domínio.
import { $, $$, fmt, fmtPct, esc, tabela, movimentoReduzido, luzNosBlocos, carregarDados, fecharPerfilAoClicarFora } from "./ui.js";
import * as M from "./metricas.js";
import { montarTema } from "./tema.js";
import { montarBusca } from "./busca.js";
import { montarExportacao } from "./exportar.js";

montarTema();
blocosEmJanelas();
luzNosBlocos();

// Página curta (pedido de 2026-11-21): cada .bloco vira um botão com título e resumo, e o conteúdo abre numa janela.
// O nó do conteúdo vai inteiro para o <dialog>, então os ids preenchidos depois (cobertura, leitura, referências) continuam valendo.
function blocosEmJanelas() {
  const resumo = (b) => {
    if (b.dataset.resumo) return b.dataset.resumo;
    const txt = (b.querySelector("p, li")?.textContent ?? b.textContent).replace(/\s+/g, " ").trim();
    return txt.length > 95 ? `${txt.slice(0, txt.lastIndexOf(" ", 92))}…` : txt;
  };
  let n = 0;
  $$("main .secao").forEach((sec) => {
    const blocos = [...sec.querySelectorAll(":scope > .bloco")];
    if (!blocos.length) return;
    const grade = document.createElement("div");
    grade.className = "blocos";
    blocos[0].before(grade);
    const sobretitulo = sec.querySelector(".sobretitulo")?.textContent ?? "";
    for (const b of blocos) {
      const id = `janela-${++n}`, titulo = b.dataset.titulo;
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "bloco-botao";
      botao.setAttribute("aria-haspopup", "dialog");
      botao.innerHTML = `<b>${esc(titulo)}</b><span>${esc(resumo(b))}</span><span class="bloco-abrir" aria-hidden="true">Ler →</span>`;
      const dlg = document.createElement("dialog");
      dlg.className = "perfil janela-bloco";
      dlg.setAttribute("aria-labelledby", `${id}-t`);
      dlg.innerHTML = `<form method="dialog"><button class="fechar" aria-label="Fechar">×</button></form>
        <header class="perfil-cab simples"><p class="sobretitulo">${esc(sobretitulo)}</p><h2 id="${id}-t">${esc(titulo)}</h2></header>`;
      b.classList.add("janela-corpo");
      dlg.append(b);
      document.body.append(dlg);
      fecharPerfilAoClicarFora(dlg);
      botao.addEventListener("click", () => dlg.showModal());
      grade.append(botao);
    }
  });
}
const D = await carregarDados(); // dados.json + partes de outros prêmios (CA-26.14)
const ANOS = d3.range(D.anos[0], D.anos[1] + 1);
D.participacao = M.expandir(D); // a busca precisa das linhas (design D13)
montarBusca(D, "/premios.html");
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

const fontes = await fetch("fontes.json").then((r) => (r.ok ? r.json() : [])).catch(() => []); // fora do dados.json (D34)
const grupos = d3.rollups(fontes, (v) => ({ total: d3.sum(v, (x) => x.registros), dominios: v }), (x) => x.grupo)
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
  // Edições de inéditos num prêmio de livros publicados (CA-26.20) e conjunto da obra (RF-30), por prêmio.
  const ineditas = d3.rollup((D.edicoes ?? []).filter((e) => e.obras === "ineditas"), (v) => v.map((e) => e.ano).sort(), (e) => e.premio ?? padrao);
  const dist = d3.rollups(D.distincoes ?? [], (v) => ({ de: d3.min(v, (x) => x.ano), ate: d3.max(v, (x) => x.ano), n: v.length }), (x) => x.premio ?? padrao, (x) => x.nome_original);
  const porDist = new Map(dist);
  const todos = [...premios, ...(D.premios_distincao ?? [])];
  $("#metodo-premios").innerHTML = `<h3>Prêmios da base</h3><ul>${todos.map((p) => `<li><b>${esc(p.nome)}</b> (${esc(p.organizador ?? "")}${p.abrangencia === "lusofono" ? "; prêmio de literatura em língua portuguesa (quem pode concorrer mudou com os anos)" : ""}${p.obras === "ineditas" ? "; premia <b>originais inéditos</b>, não livros publicados" : ineditas.has(p.id) ? `; premia <b>originais inéditos</b> desde ${ineditas.get(p.id)[0]}` : ""}):
    ${[...(porP.get(p.id) ?? []).map(([r, x]) => (/^\d{4}/.test(r) ? esc(r) : `${esc(r)} (${x.de === x.ate ? x.de : `${x.de}–${x.ate}`})`)),
       ...(porDist.get(p.id) ?? []).map(([n, x]) => `${esc(n)}, pelo <b>conjunto da obra</b> (${x.de}–${x.ate}, ${x.n} distinções; fora das contas por livro)`)].join("; ")}.</li>`).join("")}</ul>`; // regime que já começa pelo período não repete os anos
}

// Revelação ao rolar, como no painel (CA-19.1).
if (!movimentoReduzido() && "IntersectionObserver" in window) {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visivel"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -6% 0px" });
  $$(".secao-cab, .blocos").forEach((el) => { el.classList.add("revelar"); io.observe(el); });
}

// Módulo Leitura (CA-33.4): uma ficha por indicador, de leitura.json (definição, tipo de fonte, nível, anos, limitações, cobertura).
const L = await fetch("leitura.json").then((r) => (r.ok ? r.json() : null)).catch(() => null);
if (L && $("#metodo-leitura")) {
  const TIPO = { censo: "Censo", registro_administrativo: "Registro administrativo", pesquisa_amostral: "Pesquisa por amostra" };
  const NIVEL = { municipio: "município", uf: "UF", regiao: "região", brasil: "Brasil" };
  const cob = new Map(L.cobertura.map((c) => [c.indicador, c]));
  $("#metodo-leitura").innerHTML = L.indicadores.map((i) => { const c = cob.get(i.id) ?? { anos: [] };
    return `<div class="cartao"><h3>${esc(i.nome)}</h3><p>${esc(i.definicao)}</p>
      <p class="pequeno"><b>Fonte:</b> <a href="${esc(i.fonte_url)}" rel="noopener">${esc(i.fonte_nome)}</a> · <b>Tipo:</b> ${TIPO[i.tipo_fonte]} · <b>Nível mais fino:</b> ${NIVEL[i.nivel]}
      · <b>Anos:</b> ${esc(c.anos.length > 4 ? `${c.anos[0]}–${c.anos.at(-1)} (${c.anos.length})` : c.anos.join(", "))} · <b>Territórios com valor:</b> ${fmt(c.territorios)}</p>
      <p class="pequeno"><b>Limitações:</b> ${esc(i.limitacoes)}</p></div>`; }).join("");
}
