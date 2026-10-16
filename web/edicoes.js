// Perfil de edição (RF-28, D32): #/edicao/<prêmio>/<ano>, no mesmo <dialog> dos perfis de pessoas, livros e lugares.
// Números de metricas.perfilEdicao (testada); texto de contexto de edicoes.json (build, CA-28.3), buscado só quando o
// primeiro perfil de edição abre. Gráficos desenhados depois de o diálogo abrir, com a largura conhecida.
import * as M from "./metricas.js";
import { linkEditora } from "./editoras.js";
import { esc, fmt, fmtPct, css, largura, estilo, desenhar, astGenero, nPequeno, cores, rotulo, tabela, PREMIOS, NOME_PREMIO } from "./ui.js";

let contextos = null;
export async function carregarContextos() {
  contextos ??= fetch("edicoes.json").then((r) => (r.ok ? r.json() : {})).catch(() => ({}));
  return contextos;
}

const ROT_ETAPA = { indicados: "indicada", semifinalistas: "semifinalista", finalistas: "finalista", premiados: "premiada" };
const ETAPA_LISTA = { indicados: "indicados", semifinalistas: "semifinalistas", finalistas: "finalistas", premiados: "só os premiados (sem lista pública)" };
const DIMS = [["genero", "Gênero"], ["raca", "Raça declarada"], ["regiao", "Região de nascimento"]];
const pessoas = (xs) => xs.map((x) => `<a href="#/pessoa/${esc(x.id)}">${esc(x.nome)}</a>`).join(", ");
const variacao = (agora, antes) => {
  if (agora == null || antes == null) return "";
  const d = Math.round(agora - antes);
  return d === 0 ? "igual à edição anterior" : `${d > 0 ? "+" : "−"}${Math.abs(d)} p.p. sobre a edição anterior`;
};

export function htmlEdicao(premio, ano, { D, linhas, contexto }) {
  const p = M.perfilEdicao(linhas, premio, ano);
  if (!p) return null;
  const nome = NOME_PREMIO[premio] ?? p.premio_nome ?? premio;
  const cat = (c) => D.categorias.find((x) => (x.premio ?? PREMIOS[0]) === premio && x.ano === ano && x.nome_original === c.nome_original);
  const jurados = (c) => D.jurados.filter((j) => (j.premio ?? PREMIOS[0]) === premio && j.ano === ano && j.categoria === c.categoria)
    .map((j) => ({ id: j.pessoa_id, nome: D.pessoas.find((x) => x.id === j.pessoa_id)?.nome ?? j.pessoa_id }));
  const resultado = (o, c) => (o.colocacao ? `${o.colocacao}º lugar` : o.lista_curta === 1 ? "finalista" : ROT_ETAPA[cat(c)?.etapa_lista] ?? "lista");
  const kpi = (rot, val, det = "") => `<div class="kpi"><div class="rot">${rot}</div><div class="val">${val}</div><div class="det">${det}</div></div>`;
  const a = p.antes;
  const paragrafos = (contexto?.texto ?? "").split(/\n\s*\n/).filter(Boolean);
  const fontes = contexto?.fontes ?? [];
  const dominio = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
  const navEd = (alvo, rot) => (alvo == null ? "" : `<a class="chip-link" href="#/edicao/${esc(premio)}/${alvo}">${rot}</a>`);

  const html = `<article class="edicao">
    <header class="perfil-cab edicao-cab">
      <div>
        <p class="sobretitulo">Edição · ${esc(p.regime ?? "")}</p>
        <h2 id="perfil-nome">${esc(nome)} ${ano}</h2>
        <p>${fmt(p.obras)} obras e ${fmt(p.pessoas)} pessoas-autoras em ${fmt(p.categorias.length)} categoria${p.categorias.length > 1 ? "s" : ""} do recorte.</p>
        <div class="links-externos">${navEd(p.anterior, `‹ ${p.anterior}`)}${navEd(p.seguinte, `${p.seguinte} ›`)}
          <a href="/premios/${esc(premio)}/${ano}/">Página permanente</a><a href="#/edicao/${esc(premio)}/${ano}" data-copiar>Link deste perfil</a></div>
      </div>
    </header>
    <div class="perfil-corpo edicao-corpo">
      ${paragrafos.length ? `<section class="edicao-texto" aria-label="Contexto da edição">
        ${paragrafos.map((t) => `<p>${esc(t)}</p>`).join("")}
        <p class="muted pequeno">Fontes do texto: ${fontes.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(dominio(u))}</a>`).join(" · ")}</p>
      </section>` : ""}
      <div class="kpis">
        ${kpi("Pessoas-autoras", fmt(p.pessoas), a ? `${fmt(a.pessoas)} na edição anterior` : "")}
        ${kpi("Mulheres", fmtPct(p.pctMulheres) + astGenero(p.generoAtribuido), `${fmt(p.mulheres)} de ${fmt(p.pessoas)}${nPequeno(p.pessoas)}${a ? `; ${variacao(p.pctMulheres, a.pctMulheres)}` : ""}`)}
        ${kpi("Pessoas negras", p.pessoas ? `≥ ${fmtPct(p.pctNegras)}` : "–", `pelo menos ${fmt(p.negras)}; piso por autodeclaração (${fmt(p.semDeclaracao)} sem declaração)`)}
        ${kpi("Nascidas no Sudeste", fmtPct(p.pctSudeste), `${fmt(p.sudeste)} de ${fmt(p.comUF)} com UF no Brasil${nPequeno(p.comUF)}`)}
      </div>
      <section><h3>Quem chegou e quem foi premiado</h3>
        <div id="edicao-composicao" class="edicao-comp">${DIMS.map(([k, r]) => `<h4>${r}</h4><div class="grafico" id="edicao-comp-${k}"></div>`).join("")}</div>
        <p class="muted pequeno">Pessoas-autoras distintas da lista inteira e das premiadas, em proporção. Raça só por autodeclaração: "sem declaração" não quer dizer branca.</p>
        <details><summary>Ver dados em tabela</summary><div id="t-edicao-composicao"></div></details></section>
      ${p.categorias.map((c) => {
        const ce = cat(c), jur = jurados(c);
        return `<section class="edicao-categoria"><h3>${esc(c.nome_original)}${c.nome_original !== c.categoria ? ` <span class="muted pequeno">(${esc(c.categoria)})</span>` : ""}</h3>
          ${ce?.etapa_lista ? `<p class="muted pequeno">Lista: ${ETAPA_LISTA[ce.etapa_lista] ?? esc(ce.etapa_lista)}${ce.fonte ? ` · <a href="${esc(ce.fonte)}" target="_blank" rel="noopener noreferrer">fonte</a>` : ""}</p>` : ""}
          <ol class="obras-edicao">${c.obras.map((o) => `<li${o.colocacao === 1 ? ' class="venceu"' : ""}><span class="resultado">${resultado(o, c)}</span>
            <span><a href="#/obra/${esc(o.obra_id)}"><i>${esc(o.titulo)}</i></a>${o.autores.length ? `, de ${pessoas(o.autores)}` : ""}${o.ilustradores.length ? `; ilustração de ${pessoas(o.ilustradores)}` : ""}${o.organizadores.length ? `; organização de ${pessoas(o.organizadores)}` : ""}
            ${o.editora ? `<span class="muted"> · ${linkEditora(o.editora, D)}</span>` : ""}</span></li>`).join("")}</ol>
          ${jur.length ? `<p class="pequeno"><b>Júri:</b> ${pessoas(jur)}</p>` : ""}</section>`;
      }).join("")}
    </div>
  </article>`;

  const desenharTudo = () => {
    const el = document.getElementById("edicao-composicao");
    if (!el || !p.pessoas) return;
    const etapas = { lista: "Lista", premiada: "Premiadas" };
    const dados = p.composicao.map((d) => ({ ...d, Etapa: etapas[d.etapa], Dimensão: DIMS.find(([k]) => k === d.dim)[1], Grupo: rotulo(d.grupo) }));
    // Um gráfico por dimensão, com a legenda e as cores de grupo do resto do painel.
    for (const [dim, rot] of DIMS) {
      const alvo = document.getElementById(`edicao-comp-${dim}`), c = cores(dim), ds = dados.filter((d) => d.dim === dim);
      desenhar(alvo, Plot.plot({
        width: largura(alvo), height: 96, marginLeft: 76, marginRight: 22, style: estilo(), ariaLabel: `${rot}: lista e premiadas, ${nome} ${ano}`,
        x: { label: null, domain: [0, 100], tickFormat: (v) => `${v}%` }, y: { label: null, domain: ["Lista", "Premiadas"] },
        color: { domain: c.domain.map(rotulo), range: c.range, legend: true },
        marks: [Plot.barX(ds, Plot.stackX({ x: "pct", y: "Etapa", fill: "Grupo", insetTop: 3, insetBottom: 3, insetLeft: 0.5, insetRight: 0.5,
          tip: { format: { x: (v) => fmtPct(v), fill: true, y: true } }, channels: { n: (d) => `${d.n} de ${d.total}${nPequeno(d.total)}` } }))],
      }));
    }
    tabela(document.getElementById("t-edicao-composicao"), dados, [
      { rot: "Dimensão", k: "Dimensão" }, { rot: "Etapa", k: "Etapa" }, { rot: "Grupo", k: "Grupo" },
      { rot: "Pessoas", k: "n", num: true }, { rot: "Total", k: "total", num: true }, { rot: "%", f: (d) => fmtPct(d.pct), num: true },
    ]);
  };
  return { html, desenhar: desenharTudo };
}

// Faixa "Edições com listas coletadas" (CA-28.1): cada ano coletado é um link para o perfil da edição.
export const celulaEdicao = (premio, nome, ano, ok) => (ok
  ? `<div role="listitem" class="ok"><a href="#/edicao/${esc(premio)}/${ano}" title="${esc(nome)} ${ano}: abrir o perfil da edição">${ano}</a></div>`
  : `<div role="listitem" title="${esc(nome)} ${ano}: não coletada">${ano}</div>`);
