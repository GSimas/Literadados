// Galeria de pessoas e perfil com rota por hash (RF-11): #/pessoa/<id>.
import * as M from "./metricas.js";
import { $, $$, fmt, esc, ROT_GEN, ROT_RACA, foto, credito } from "./ui.js";

const PAGINA = 48;
let mostrar = PAGINA;
let vista = "galeria";

const semAcento = (s) => s.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{M}/gu, "");
const resultado = (l) => (l.colocacao ? `${l.colocacao}º lugar` : l.lista_curta === 1 ? "finalista" : "lista");

export function montarPessoas(ctx) {
  $("#busca").addEventListener("input", () => { mostrar = PAGINA; ctx.renderPessoas(); });
  $("#ordem").addEventListener("change", () => ctx.renderPessoas());
  $("#mais").addEventListener("click", () => { mostrar += PAGINA * 2; ctx.renderPessoas(); });
  $("#vista").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-v]");
    if (!b) return;
    vista = b.dataset.v;
    $$("#vista button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    ctx.renderPessoas();
  });
  const abrirDe = (e) => { const c = e.target.closest("[data-pessoa]"); if (c) ctx.abrirPerfil(c.dataset.pessoa); };
  $("#galeria").addEventListener("click", abrirDe);
  $("#t-pessoas").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) ctx.abrirPerfil(tr.dataset.id); });
  $("#t-pessoas").addEventListener("keydown", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); ctx.abrirPerfil(tr.dataset.id); }
  });
  $("#perfil-corpo").addEventListener("click", abrirDe);
  // Fechar o perfil volta para onde a pessoa estava (a rota do perfil sai do hash).
  $("#perfil").addEventListener("close", () => { if (location.hash.startsWith("#/pessoa/")) history.replaceState(null, "", `${location.pathname}${location.search}${ctx.hashAnterior()}`); });
}

export function renderPessoas(L, { D, midiaPorId }) {
  const termo = semAcento($("#busca").value.trim());
  const ordem = $("#ordem").value;
  const lista = M.resumoPessoas(L, D.pessoas)
    .filter((p) => !termo || semAcento(p.nome).includes(termo))
    .sort((a, b) => (ordem === "nome" ? 0 : ordem === "participacoes" ? b.participacoes - a.participacoes || b.premios - a.premios : b.premios - a.premios || b.participacoes - a.participacoes)
      || a.nome.localeCompare(b.nome, "pt-BR"));
  const comFoto = lista.filter((p) => midiaPorId.get(p.id)?.imagem).length;
  $("#galeria-contagem").textContent = `${fmt(lista.length)} pessoas · ${fmt(comFoto)} com foto livre`;
  const tabelaVis = vista === "tabela";
  $("#galeria").hidden = tabelaVis;
  $("#tabela-pessoas-wrap").hidden = !tabelaVis;
  $("#mais").hidden = tabelaVis || lista.length <= mostrar;
  if (tabelaVis) {
    $("#t-pessoas").innerHTML = `<caption class="sr">Pessoas do recorte; Enter abre o perfil com fontes</caption>
      <thead><tr><th scope="col">Nome</th><th scope="col">Gênero</th><th scope="col">Raça declarada</th><th scope="col">UF nasc.</th><th class="num" scope="col">Participações</th><th class="num" scope="col">Prêmios</th></tr></thead>
      <tbody>${lista.map((p) => `<tr data-id="${esc(p.id)}" tabindex="0"><td>${esc(p.nome)}</td><td>${ROT_GEN[p.genero]}</td><td>${ROT_RACA[p.raca]}</td><td>${esc(p.uf_nascimento ?? "–")}</td><td class="num">${p.participacoes}</td><td class="num">${p.premios}</td></tr>`).join("")
      || `<tr><td colspan="6" class="vazio">Ninguém encontrado.</td></tr>`}</tbody>`;
    return;
  }
  $("#galeria").innerHTML = lista.slice(0, mostrar).map((p) => `<button type="button" class="card-pessoa" data-pessoa="${esc(p.id)}" aria-label="Abrir perfil de ${esc(p.nome)}">
      ${foto(p, midiaPorId.get(p.id))}
      <span class="info"><span class="nome">${esc(p.nome)}</span>
      <span class="meta">${[p.uf_nascimento, p.ano_nascimento].filter(Boolean).map(esc).join(" · ") || "&nbsp;"}</span>
      <span class="meta">${p.participacoes} indicaç${p.participacoes > 1 ? "ões" : "ão"}${p.linhas.every((l) => l.papel === "ilustrador") ? " como ilustrador(a)" : ""}</span>
      ${p.vitorias ? `<span class="selo">★ ${p.vitorias} 1º lugar${p.vitorias > 1 ? "es" : ""}</span>` : p.premios ? `<span class="selo">${p.premios} prêmio${p.premios > 1 ? "s" : ""}</span>` : ""}</span></button>`).join("")
    || `<p class="vazio">Ninguém encontrado.</p>`;
}

export function htmlPerfil(id, { D, midiaPorId }) {
  const p = D.pessoas.find((x) => x.id === id);
  if (!p) return null;
  const m = midiaPorId.get(id);
  const ls = D.participacao.filter((l) => l.pessoa_id === id && l.papel !== "organizador")
    .sort((a, b) => a.ano - b.ano || a.categoria.localeCompare(b.categoria));
  const org = D.participacao.filter((l) => l.pessoa_id === id && l.papel === "organizador");
  const jur = D.jurados.filter((j) => j.pessoa_id === id);
  const fonte = (u) => (u ? ` <a class="fonte-link" href="${esc(u)}" target="_blank" rel="noopener noreferrer">fonte ↗</a>` : ` <span class="muted pequeno">(sem fonte)</span>`);
  const obras = new Set(ls.map((l) => l.obra_id));
  const coautores = [...new Map(D.participacao.filter((l) => obras.has(l.obra_id) && l.pessoa_id !== id && l.papel !== "organizador")
    .map((l) => [l.pessoa_id, l])).values()];
  const premios = ls.filter((l) => l.premiada).length, vit = ls.filter((l) => l.vencedora).length;
  const nasc = [p.municipio_nascimento, p.uf_nascimento, p.ano_nascimento].filter(Boolean).map(esc).join(" · ");
  const links = [
    m?.wikipedia_pt && `<a href="https://pt.wikipedia.org/wiki/${encodeURIComponent(m.wikipedia_pt.replace(/ /g, "_"))}" target="_blank" rel="noopener noreferrer">Wikipédia ↗</a>`,
    p.wikidata && `<a href="https://www.wikidata.org/wiki/${esc(p.wikidata)}" target="_blank" rel="noopener noreferrer">Wikidata ${esc(p.wikidata)} ↗</a>`,
    `<a href="#/pessoa/${esc(id)}" data-copiar="${esc(id)}">Link deste perfil</a>`,
  ].filter(Boolean).join("");
  return `<article>
    <header class="perfil-cab">
      <div>${foto(p, m, { w: 480 })}${m?.imagem ? `<p class="credito">${credito(m)}</p>` : ""}</div>
      <div>
        <p class="sobretitulo">${ls.some((l) => l.papel === "autor") ? "Autor(a)" : "Ilustrador(a)"}${jur.length ? " · jurado(a)" : ""}</p>
        <h2 id="perfil-nome">${esc(p.nome)}</h2>
        <p>${fmt(ls.length)} indicaç${ls.length === 1 ? "ão" : "ões"} · ${premios ? `${premios} prêmio${premios > 1 ? "s" : ""}` : "sem prêmio"}${vit ? ` · <b>${vit} 1º lugar${vit > 1 ? "es" : ""}</b>` : ""}</p>
        <div class="links-externos">${links}</div>
      </div>
    </header>
    <div class="perfil-corpo">
      <section aria-label="Atributos e fontes">
        <h3>Atributos e fontes</h3>
        <dl class="atributos">
          <dt>Gênero</dt><dd>${ROT_GEN[p.genero]}${p.genero !== "nao_identificado" ? fonte(p.genero_fonte) : `<br><span class="muted pequeno">As fontes consultadas ainda não dizem.</span>`}</dd>
          <dt>Raça</dt><dd>${ROT_RACA[p.raca]}${p.raca !== "sem_declaracao"
            ? `${fonte(p.raca_fonte)}<br><span class="muted pequeno">${p.raca_evidencia === "fonte_curada" ? "fonte curada por identidade" : "autodeclaração"}</span>${p.raca_trecho ? `<blockquote>${esc(p.raca_trecho)}</blockquote>` : ""}`
            : `<br><span class="muted pequeno">${p.raca_busca === "completa" ? "Nenhuma autodeclaração pública encontrada." : "Busca de autodeclaração ainda incompleta."} Isso não indica nenhuma raça.</span>`}</dd>
          <dt>Nascimento</dt><dd>${nasc || "–"}${p.uf_nascimento || p.ano_nascimento ? fonte(p.nascimento_fonte) : ""}</dd>
        </dl>
        ${coautores.length ? `<h3 style="margin-top:1.2rem">Dividiu obras com</h3><p>${coautores.map((c) => `<button type="button" class="link-pessoa" data-pessoa="${esc(c.pessoa_id)}">${esc(c.nome)}</button>${c.papel === "ilustrador" ? " <span class='muted pequeno'>(ilustração)</span>" : ""}`).join(", ")}</p>` : ""}
      </section>
      <section aria-label="Participações no Jabuti">
        <h3>No Prêmio Jabuti</h3>
        <ol class="cronologia">${ls.map((l) => `<li class="${l.premiada ? "premio" : ""}"><span class="ano">${l.ano}</span> · ${esc(l.categoria)}<br>
          <i>${esc(l.titulo)}</i>${l.editora ? ` <span class="muted">(${esc(l.editora)})</span>` : ""}<br>
          <span class="${l.premiada ? "" : "muted"}">${l.vencedora ? "★ " : ""}${resultado(l)}${l.papel !== "autor" ? ` · ${esc(l.papel)}` : ""}</span></li>`).join("")}
          ${jur.map((j) => `<li><span class="ano">${j.ano}</span> · jurado(a) de ${esc(j.categoria)}</li>`).join("")}
          ${org.map((l) => `<li><span class="ano">${l.ano}</span> · organizou <i>${esc(l.titulo)}</i> <span class="muted pequeno">(fora das contagens)</span></li>`).join("")}</ol>
      </section>
    </div></article>`;
}
