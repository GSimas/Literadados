// Perfil de editora (RF-29, D33): #/editora/<id>, no mesmo <dialog> dos perfis. Números de metricas.perfilEditora (testada).
// A participação expandida traz o nome da editora; o id vem de D.editoras (nomes únicos).
import * as M from "./metricas.js";
import { esc, fmt, fmtPct, css, largura, estilo, desenhar, astGenero, nPequeno, tabela, PREMIOS, FOLGA_PAINEL, fyPaineis, alturaPaineis, nomesPaineis } from "./ui.js";

const ROT_ETAPA = { indicados: "indicada", semifinalistas: "semifinalista", finalistas: "finalista", premiados: "premiada" };
let idPorNome = null;
let logos = null;
export function carregarLogos() {
  logos ??= fetch("editoras-logos.json").then((r) => r.ok ? r.json() : {}).catch(() => ({}));
  return logos;
}

export function iniciaisEditora(nome) {
  const palavras = nome.split(/\s+/).filter((p) => !/^(editora|edições|editorial|de|da|das|do|dos|e|a|o)$/iu.test(p));
  return (palavras.length > 1 ? palavras.slice(0, 2).map((p) => [...p][0]).join("") : [...(palavras[0] || nome)].slice(0, 2).join("")).toLocaleUpperCase("pt-BR");
}

export function marcaEditora(ed, logo) {
  return `<figure class="editora-marca${logo ? " tem-logo" : ""}">
    <div class="editora-logo${logo?.fundo === "escuro" ? " logo-escuro" : ""}" role="img" aria-label="Identidade visual de ${esc(ed.nome)}">
      <svg viewBox="0 0 180 150" aria-hidden="true"><path d="M38 27h104M38 123h104M52 21v12m76-12v12M52 117v12m76-12v12"/><text x="90" y="91" text-anchor="middle">${esc(iniciaisEditora(ed.nome))}</text></svg>
      ${logo ? `<img src="${esc(logo.imagem_url)}" alt="" width="180" height="150" decoding="async" referrerpolicy="no-referrer" onload="this.closest('figure').classList.add('logo-carregado')" onerror="this.closest('figure').classList.remove('tem-logo'); this.remove()">` : ""}
    </div><figcaption class="credito"><span class="marca-alternativa">Marca tipográfica</span>${logo ? `<span class="marca-fonte">Logotipo: <a href="${esc(logo.pagina)}" target="_blank" rel="noopener noreferrer">${esc(logo.fonte)}</a></span>` : ""}</figcaption>
  </figure>`;
}
// Link para o perfil da editora a partir do nome (como vem na participação); sem editora conhecida, texto puro.
export function linkEditora(nome, D) {
  if (!nome) return "";
  idPorNome ??= new Map(D.editoras.map((e) => [e.nome, e.id]));
  const id = idPorNome.get(nome);
  return id ? `<a href="#/editora/${esc(id)}">${esc(nome)}</a>` : esc(nome);
}

export function htmlEditora(id, { D, linhas, logos: L = {} }) {
  const ed = D.editoras.find((e) => e.id === id);
  if (!ed) return null;
  const p = M.perfilEditora(linhas, ed.nome);
  if (!p) return null;
  const etapaDe = new Map(D.categorias.map((c) => [`${c.premio ?? PREMIOS[0]}|${c.ano}|${c.nome_original}`, c.etapa_lista]));
  const resultado = (o) => (o.colocacao ? `${o.colocacao}º lugar` : o.lista_curta === 1 ? "finalista" : ROT_ETAPA[etapaDe.get(`${o.premio}|${o.ano}|${o.nome_original}`)] ?? "lista");
  const multi = p.porPremio.length > 1;
  const kpi = (rot, val, det = "") => `<div class="kpi"><div class="rot">${rot}</div><div class="val">${val}</div><div class="det">${det}</div></div>`;
  const sede = [ed.municipio_sede, ed.uf_sede].filter(Boolean).map(esc).join("/");
  const pessoa = (x) => `<a href="#/pessoa/${esc(x.id)}">${esc(x.nome)}</a>`;
  const html = `<article class="editora">
    <header class="perfil-cab editora-cab">
      ${marcaEditora(ed, L[id])}
      <div>
        <p class="sobretitulo">Editora · ${ed.grupo ? `grupo ${esc(ed.grupo)}` : "independente"}${sede ? ` · sede: ${sede}` : ""}</p>
        <h2 id="perfil-nome">${esc(ed.nome)}</h2>
        <p>${fmt(p.indicacoes)} indicaç${p.indicacoes === 1 ? "ão" : "ões"} de ${p.de === p.ate ? p.de : `${p.de} a ${p.ate}`}, ${fmt(p.premiadas)} premiada${p.premiadas === 1 ? "" : "s"}${p.vencedoras ? `, <b>${fmt(p.vencedoras)} em 1º lugar</b>` : ""}.
          ${p.posicao}ª entre as ${fmt(p.editorasNaBase)} editoras da base em indicações.</p>
        <div class="links-externos"><a href="/editoras/${encodeURIComponent(id)}/">Página permanente</a><a href="#/editora/${esc(id)}" data-copiar>Link deste perfil</a></div>
      </div>
    </header>
    <div class="perfil-corpo edicao-corpo">
      <div class="kpis">
        ${p.porPremio.map((x) => kpi(esc(x.premio_nome), fmt(x.indicacoes), `indicações (${x.de === x.ate ? x.de : `${x.de}–${x.ate}`}); ${fmt(x.premiadas)} premiadas, ${fmt(x.vencedoras)} em 1º lugar`)).join("")}
        ${kpi("Pessoas-autoras", fmt(p.pessoas), "publicadas nas obras indicadas")}
        ${kpi("Mulheres", fmtPct(p.pctMulheres) + astGenero(p.generoAtribuido), `${fmt(p.mulheres)} de ${fmt(p.pessoas)}${nPequeno(p.pessoas)}`)}
        ${kpi("Pessoas negras", `≥ ${fmtPct(p.pctNegras)}`, `pelo menos ${fmt(p.negras)}; piso por autodeclaração (${fmt(p.semDeclaracao)} sem declaração)`)}
      </div>
      <section><h3>Indicações por edição</h3><div class="grafico" id="editora-anos"></div>
        <p class="muted pequeno">Obras com autoria publicadas por ${esc(ed.nome)} na lista de cada edição; a cor separa as premiadas. Editora = a edição que concorreu.</p>
        <details><summary>Ver dados em tabela</summary><div id="t-editora-anos"></div></details></section>
      ${p.maisPublicados.length ? `<section><h3>Quem mais chegou aos prêmios por ${esc(ed.nome)}</h3>
        <p class="chips">${p.maisPublicados.map((x) => `<a class="chip-link" href="#/pessoa/${esc(x.id)}">${esc(x.nome)} <span class="muted">${x.indicacoes}</span></a>`).join("")}</p></section>` : ""}
      <section><h3>Obras (${fmt(p.obras.length)})</h3>
        <ol class="obras-edicao">${[...p.obras].reverse().map((o) => `<li${o.colocacao === 1 ? ' class="venceu"' : ""}><span class="resultado">${o.ano} · ${resultado(o)}</span>
          <span><a href="#/obra/${esc(o.obra_id)}"><i>${esc(o.titulo)}</i></a>${o.autores.length ? `, de ${o.autores.map(pessoa).join(", ")}` : ""}
          <span class="muted"> · <a href="#/edicao/${esc(o.premio)}/${o.ano}">${multi || PREMIOS.length > 1 ? `${esc(o.premio_nome)} ${o.ano}` : o.ano}</a>, ${esc(o.nome_original)}</span></span></li>`).join("")}</ol></section>
    </div>
  </article>`;

  const desenharTudo = () => {
    const el = document.getElementById("editora-anos");
    if (!el) return;
    const dados = p.porAno.flatMap((d) => [{ ...d, tipo: "Premiadas", n: d.premiadas }, { ...d, tipo: "Não premiadas", n: d.outras }]).filter((d) => d.n);
    // Um painel por prêmio, com o nome no alto dele (no eixo lateral, nomes longos eram cortados).
    const dominio = p.porPremio.map((x) => x.premio_nome).filter((n) => dados.some((d) => d.premio_nome === n)), mt = multi ? FOLGA_PAINEL : 20, mb = 30;
    const altura = multi ? alturaPaineis(dominio.length, 90, { marginTop: mt, marginBottom: mb }) : 220;
    desenhar(el, Plot.plot({
      width: largura(el), height: altura, marginTop: mt, marginBottom: mb, marginLeft: 50, marginRight: 20, style: estilo(), ariaLabel: `Indicações de ${ed.nome} por edição`,
      x: { label: null, tickFormat: "d", interval: 1, ticks: 8 }, y: { label: "indicações", labelAnchor: "center", grid: true, tickFormat: "d" },
      ...(multi ? { fy: fyPaineis(dominio, { altura, marginTop: mt, marginBottom: mb }) } : {}),
      color: { domain: ["Premiadas", "Não premiadas"], range: [css("--s1"), css("--s-na")], legend: true },
      marks: [Plot.rectY(dados, Plot.stackY({ x: "ano", y: "n", fill: "tipo", ...(multi ? { fy: "premio_nome" } : {}), inset: 0.5, tip: true })), ...(multi ? nomesPaineis(dominio) : [])],
    }));
    tabela(document.getElementById("t-editora-anos"), p.porAno, [
      { rot: "Prêmio", k: "premio_nome" }, { rot: "Ano", k: "ano" }, { rot: "Premiadas", k: "premiadas", num: true }, { rot: "Não premiadas", k: "outras", num: true },
    ]);
  };
  return { html, desenhar: desenharTudo };
}
