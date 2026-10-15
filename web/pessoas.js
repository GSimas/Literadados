// Galeria de pessoas e perfil com rota por hash (RF-11): #/pessoa/<id>.
import * as M from "./metricas.js";
import { $, $$, fmt, esc, ROT_GEN, ROT_RACA, foto, credito, astGenero, CONTATO, movimentoReduzido } from "./ui.js";

const PAGINA = 100;
let pagina = 1, nPag = 1; // CA-11.6: busca e ordenação voltam à 1; filtro mantém, se a página ainda existir
let resumoPorId = new Map();
let vista = "galeria";

// "2 vezes 1º lugar", nunca "2 1º lugares" (número colado à posição confunde).
const vezes = (n) => `${n} ${n > 1 ? "vezes" : "vez"}`;
const semAcento = (s) => s.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{M}/gu, "");
const resultado = (l) => (l.colocacao ? `${l.colocacao}º lugar` : l.lista_curta === 1 ? "finalista" : "lista");

export function montarPessoas(ctx) {
  $("#busca").addEventListener("input", () => { pagina = 1; ctx.renderPessoas(); });
  $("#ordem").addEventListener("change", () => { pagina = 1; ctx.renderPessoas(); });
  const irPara = (k) => {
    if (k < 1 || k > nPag || k === pagina) return;
    const dir = Math.sign(k - pagina);
    pagina = k;
    ctx.renderPessoas();
    const el = vista === "tabela" ? $("#tabela-pessoas-wrap") : $("#galeria");
    if (!movimentoReduzido()) el.animate([{ opacity: 0, transform: `translateX(${dir * 24}px) rotate(${dir * 4}deg)` }, { opacity: 1, transform: "none" }], { duration: 320, easing: "cubic-bezier(.2,.7,.2,1)" });
  };
  $("#pag-ant").addEventListener("click", () => irPara(pagina - 1));
  $("#pag-prox").addEventListener("click", () => irPara(pagina + 1));
  $(".anel-palco").addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); irPara(pagina - 1); }
    if (e.key === "ArrowRight") { e.preventDefault(); irPara(pagina + 1); }
  });
  // Centro do anel (CA-11.5): resumo de quem está sob o ponteiro ou com foco; volta ao resumo da página ao sair.
  const centro = (id) => {
    const el = $("#anel-centro");
    if (!el) return;
    const p = resumoPorId.get(id);
    el.innerHTML = p ? htmlCentro(p) : el.dataset.padrao;
    if (!movimentoReduzido()) el.firstElementChild?.animate([{ opacity: 0, transform: "scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "cubic-bezier(.2,.7,.2,1)" });
  };
  $("#galeria").addEventListener("pointerover", (e) => { const b = e.target.closest(".retrato"); if (b && !b.contains(e.relatedTarget)) centro(b.dataset.pessoa); });
  $("#galeria").addEventListener("pointerleave", () => centro(null));
  $("#galeria").addEventListener("focusin", (e) => { const b = e.target.closest(".retrato"); if (b) centro(b.dataset.pessoa); });
  $("#galeria").addEventListener("focusout", (e) => { if (!$("#galeria").contains(e.relatedTarget)) centro(null); });
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
}

// Resumo no centro do anel: nome, UF · ano, indicações e selo (CA-11.5).
const htmlCentro = (p) => `<div class="centro-pessoa">
  <b class="centro-nome">${esc(p.nome)}</b>
  <span class="centro-meta">${[p.uf_nascimento, p.ano_nascimento].filter(Boolean).map(esc).join(" · ") || "nascimento sem dado"}</span>
  <span class="centro-meta">${p.participacoes} indicaç${p.participacoes > 1 ? "ões" : "ão"}${p.linhas.every((l) => l.papel === "ilustrador") ? " como ilustrador(a)" : ""}</span>
  ${p.vitorias ? `<span class="selo">★ ${vezes(p.vitorias)} 1º lugar</span>` : p.premios ? `<span class="selo">${p.premios} prêmio${p.premios > 1 ? "s" : ""}</span>` : ""}
  <span class="centro-dica">clique para abrir o perfil</span></div>`;

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
  nPag = Math.max(1, Math.ceil(lista.length / PAGINA));
  pagina = Math.min(pagina, nPag);
  const ini = (pagina - 1) * PAGINA, pag = lista.slice(ini, ini + PAGINA);
  $("#pag-ant").disabled = pagina === 1;
  $("#pag-prox").disabled = pagina === nPag;
  $(".anel-palco").classList.toggle("so-uma", nPag === 1);
  $("#paginacao").textContent = lista.length ? `${fmt(ini + 1)}–${fmt(ini + pag.length)} de ${fmt(lista.length)} · página ${pagina} de ${nPag}` : "";
  if (tabelaVis) {
    $("#t-pessoas").innerHTML = `<caption class="sr">Pessoas do recorte; Enter abre o perfil com fontes</caption>
      <thead><tr><th scope="col">Nome</th><th scope="col">Gênero</th><th scope="col">Raça declarada</th><th scope="col">UF nasc.</th><th class="num" scope="col">Participações</th><th class="num" scope="col">Prêmios</th></tr></thead>
      <tbody>${pag.map((p) => `<tr data-id="${esc(p.id)}" tabindex="0"><td>${esc(p.nome)}</td><td>${ROT_GEN[p.genero]}${astGenero(p.genero_evidencia === "atribuicao")}</td><td>${ROT_RACA[p.raca]}</td><td>${esc(p.uf_nascimento ?? "–")}</td><td class="num">${p.participacoes}</td><td class="num">${p.premios}</td></tr>`).join("")
      || `<tr><td colspan="6" class="vazio">Ninguém encontrado.</td></tr>`}</tbody>`;
    return;
  }
  // Anel de retratos (CA-11.5, D21): posições de metricas.anel, do anel de dentro (primeiros da ordem) para fora.
  const g = $("#galeria");
  if (!pag.length) { g.style.cssText = ""; g.innerHTML = `<p class="vazio">Ninguém encontrado.</p>`; return; }
  resumoPorId = new Map(pag.map((p) => [p.id, p]));
  // Cabe na largura e na altura da tela (o anel inteiro à vista, com os controles).
  const a = M.anel(pag.length, Math.min(g.parentElement.clientWidth || 700, 980, Math.max(340, innerHeight - 70)));
  const lado = Math.ceil(a.raio * 2);
  g.style.cssText = `width:${lado}px;height:${lado}px;--d:${a.d}px;--miolo:${a.miolo * 2}px`;
  const padrao = `<div class="centro-pessoa centro-padrao"><b class="centro-nome">${fmt(lista.length)} pessoas</b>
    <span class="centro-meta">página ${pagina} de ${nPag}</span><span class="centro-dica">passe o mouse num retrato</span></div>`;
  g.innerHTML = `<div id="anel-centro" class="anel-centro" aria-live="polite" data-padrao="${esc(padrao)}">${padrao}</div>` +
    pag.map((p, i) => `<button type="button" class="retrato" data-pessoa="${esc(p.id)}" aria-label="${esc(p.nome)}: abrir perfil"
      style="left:${(lado / 2 + a.pos[i].x - a.d / 2).toFixed(1)}px;top:${(lado / 2 + a.pos[i].y - a.d / 2).toFixed(1)}px;--i:${i}">
      ${foto(p, midiaPorId.get(p.id), { w: 160, classe: "foto" })}</button>`).join("");
}

export function htmlPerfil(id, { D, midiaPorId }) {
  const p = D.pessoas.find((x) => x.id === id);
  if (!p) return null;
  const m = midiaPorId.get(id);
  const ls = D.participacao.filter((l) => l.pessoa_id === id && l.papel !== "organizador")
    .sort((a, b) => a.ano - b.ano || a.categoria.localeCompare(b.categoria));
  const org = D.participacao.filter((l) => l.pessoa_id === id && l.papel === "organizador");
  const jur = D.jurados.filter((j) => j.pessoa_id === id);
  const fonte = (u) => (u ? ` <a class="fonte-link" href="${esc(u)}" target="_blank" rel="noopener noreferrer">fonte</a>` : ` <span class="muted pequeno">(sem fonte)</span>`);
  const obras = new Set(ls.map((l) => l.obra_id));
  const coautores = [...new Map(D.participacao.filter((l) => obras.has(l.obra_id) && l.pessoa_id !== id && l.papel !== "organizador")
    .map((l) => [l.pessoa_id, l])).values()];
  const premios = ls.filter((l) => l.premiada).length, vit = ls.filter((l) => l.vencedora).length;
  // UF de nascimento leva ao perfil do estado (CA-22.3).
  const ufLink = p.uf_nascimento && p.uf_nascimento !== "EX" ? `<a class="chip-link" href="#/uf/${esc(p.uf_nascimento)}">${esc(p.uf_nascimento)}</a>` : esc(p.uf_nascimento ?? "");
  const nasc = [p.municipio_nascimento && esc(p.municipio_nascimento), p.uf_nascimento && ufLink, p.ano_nascimento && esc(p.ano_nascimento)].filter(Boolean).join(" · ");
  const links = [
    m?.wikipedia_pt && `<a href="https://pt.wikipedia.org/wiki/${encodeURIComponent(m.wikipedia_pt.replace(/ /g, "_"))}" target="_blank" rel="noopener noreferrer">Wikipédia</a>`,
    p.wikidata && `<a href="https://www.wikidata.org/wiki/${esc(p.wikidata)}" target="_blank" rel="noopener noreferrer">Wikidata ${esc(p.wikidata)}</a>`,
    `<a href="#/pessoa/${esc(id)}" data-copiar="${esc(id)}">Link deste perfil</a>`,
  ].filter(Boolean).join("");
  return `<article>
    <header class="perfil-cab">
      <div>${foto(p, m, { w: 480 })}${m?.imagem ? `<p class="credito">${credito(m)}</p>` : ""}</div>
      <div>
        <p class="sobretitulo">${ls.some((l) => l.papel === "autor") ? "Autor(a)" : "Ilustrador(a)"}${jur.length ? " · jurado(a)" : ""}</p>
        <h2 id="perfil-nome">${esc(p.nome)}</h2>
        <p>${fmt(ls.length)} indicaç${ls.length === 1 ? "ão" : "ões"} · ${premios ? `${premios} prêmio${premios > 1 ? "s" : ""}` : "sem prêmio"}${vit ? ` · <b>${vezes(vit)} 1º lugar</b>` : ""}</p>
        <div class="links-externos">${links}</div>
      </div>
    </header>
    <div class="perfil-corpo">
      <section aria-label="Atributos e fontes">
        <h3>Atributos e fontes</h3>
        <dl class="atributos">
          <dt>Gênero</dt><dd>${ROT_GEN[p.genero]}${p.genero_evidencia === "atribuicao"
            ? `${astGenero(true)}<br><span class="muted pequeno">Atribuído pelo primeiro nome; nenhuma fonte encontrada. Pode estar errado: para corrigir, escreva para <a href="mailto:${CONTATO}">${CONTATO}</a>.</span>`
            : p.genero !== "nao_identificado" ? fonte(p.genero_fonte) : `<br><span class="muted pequeno">As fontes consultadas ainda não dizem.</span>`}</dd>
          <dt>Raça</dt><dd>${ROT_RACA[p.raca]}${p.raca !== "sem_declaracao"
            ? `${fonte(p.raca_fonte)}<br><span class="muted pequeno">${p.raca_evidencia === "fonte_curada" ? "fonte curada por identidade" : "autodeclaração"}</span>${p.raca_trecho ? `<blockquote>${esc(p.raca_trecho)}</blockquote>` : ""}`
            : `<br><span class="muted pequeno">${p.raca_busca === "completa" ? "Nenhuma autodeclaração pública encontrada." : "Busca de autodeclaração ainda incompleta."} Isso não indica nenhuma raça.</span>`}</dd>
          <dt>Nascimento</dt><dd>${nasc || "–"}${p.uf_nascimento || p.ano_nascimento ? fonte(p.nascimento_fonte) : ""}</dd>
        </dl>
        ${coautores.length ? `<h3 style="margin-top:1.2rem">Dividiu obras com</h3><p class="chips">${coautores.map((c) => `<button type="button" class="link-pessoa" data-pessoa="${esc(c.pessoa_id)}">${esc(c.nome)}${c.papel === "ilustrador" ? " <span class='muted pequeno'>(ilustração)</span>" : ""}</button>`).join("")}</p>` : ""}
      </section>
      <section aria-label="Participações no Jabuti">
        <h3>No Prêmio Jabuti</h3>
        <ol class="cronologia">${ls.map((l, i) => `<li class="${l.premiada ? "premio" : ""}" style="--i:${i}"><span class="ano">${l.ano}</span> · ${esc(l.categoria)}<br>
          <i>${esc(l.titulo)}</i>${l.editora ? ` <span class="muted">(${esc(l.editora)})</span>` : ""}<br>
          <span class="${l.premiada ? "" : "muted"}">${l.vencedora ? "★ " : ""}${resultado(l)}${l.papel !== "autor" ? ` · ${esc(l.papel)}` : ""}</span></li>`).join("")}
          ${jur.map((j) => `<li><span class="ano">${j.ano}</span> · jurado(a) de ${esc(j.categoria)}</li>`).join("")}
          ${org.map((l) => `<li><span class="ano">${l.ano}</span> · organizou <i>${esc(l.titulo)}</i> <span class="muted pequeno">(fora das contagens)</span></li>`).join("")}</ol>
      </section>
    </div></article>`;
}
