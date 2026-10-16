// Galeria de pessoas e perfil com rota por hash (RF-11): #/pessoa/<id>.
import * as M from "./metricas.js";
import { $, $$, fmt, esc, ROT_GEN, ROT_RACA, foto, credito, astGenero, CONTATO, movimentoReduzido, PREMIOS, NOME_PREMIO, nomesPremios, nomePais } from "./ui.js";

const PAGINA = 100;
let pagina = 1, nPag = 1; // CA-11.6: busca e ordenação voltam à 1; filtro mantém, se a página ainda existir
let resumoPorId = new Map();
let vista = "galeria";

// "2 vezes 1º lugar", nunca "2 1º lugares" (número colado à posição confunde).
const vezes = (n) => `${n} ${n > 1 ? "vezes" : "vez"}`;
const semAcento = (s) => s.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{M}/gu, "");
// O que é a 1ª lista em cada edição (CA-26.4): "semifinalista" no Jabuti de 2019 em diante, "finalista" antes.
const ROT_ETAPA = { indicados: "indicada", semifinalistas: "semifinalista", finalistas: "finalista", premiados: "premiada" };
let etapaDe = new Map();
const resultado = (l) => (l.colocacao ? `${l.colocacao}º lugar` : l.lista_curta === 1 ? "finalista" : ROT_ETAPA[etapaDe.get(`${l.premio}|${l.ano}|${l.nome_original}`)] ?? "lista");
function indexarEtapas(D) {
  if (etapaDe.size) return;
  etapaDe = new Map(D.categorias.map((c) => [`${c.premio ?? PREMIOS[0]}|${c.ano}|${c.nome_original}`, c.etapa_lista]));
}
// Seção de participações: com um prêmio só, "No Prêmio Jabuti"; com vários, "Nos prêmios" e o prêmio em cada item (CA-26.10).
const tituloPremios = (ps) => (ps.length > 1 ? "Nos prêmios" : `No ${nomesPremios(ps.length ? ps : undefined)}`);
const selo = (multi, p) => (multi ? ` · <span class="selo-premio">${esc(NOME_PREMIO[p] ?? p)}</span>` : "");
const premiosDe = (...listas) => PREMIOS.filter((p) => listas.some((ls) => ls.some((l) => (l.premio ?? PREMIOS[0]) === p)));

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

const larguraAnel = () => Math.min($("#galeria").parentElement.clientWidth || 700, 980, Math.max(340, innerHeight - 70));

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
  // Tela de toque: menos pessoas por página, para cada retrato ter ao menos 44 px (CA-11.7).
  const porPagina = !tabelaVis && matchMedia("(pointer: coarse)").matches ? M.capacidadeAnel(larguraAnel(), 44, PAGINA) : PAGINA;
  nPag = Math.max(1, Math.ceil(lista.length / porPagina));
  pagina = Math.min(pagina, nPag);
  const ini = (pagina - 1) * porPagina, pag = lista.slice(ini, ini + porPagina);
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
  const a = M.anel(pag.length, larguraAnel());
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
  indexarEtapas(D);
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
  // Fora do Brasil (DA-3): o país no lugar da sigla "EX" (se o município já não o nomeia).
  const pais = p.uf_nascimento === "EX" ? (p.pais_nascimento ? nomePais(p.pais_nascimento) : "fora do Brasil") : "";
  const ufLink = p.uf_nascimento && p.uf_nascimento !== "EX" ? `<a class="chip-link" href="#/uf/${esc(p.uf_nascimento)}">${esc(p.uf_nascimento)}</a>`
    : pais && !(p.municipio_nascimento ?? "").includes(pais) ? esc(pais) : "";
  const nasc = [p.municipio_nascimento && esc(p.municipio_nascimento), ufLink, p.ano_nascimento && esc(p.ano_nascimento)].filter(Boolean).join(" · ");
  const ps = premiosDe(ls, jur, org), multi = ps.length > 1;
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
        <p>${fmt(ls.length)} indicaç${ls.length === 1 ? "ão" : "ões"} · ${premios ? `${premios} prêmio${premios > 1 ? "s" : ""}` : "sem prêmio"}${vit ? ` · <b>${vezes(vit)} 1º lugar</b>` : ""}${multi ? `<br><span class="muted">em ${esc(nomesPremios(ps))}</span>` : ""}</p>
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
      <section aria-label="Participações ${multi ? "nos prêmios" : `no ${esc(nomesPremios(ps.length ? ps : undefined))}`}">
        <h3>${esc(tituloPremios(ps))}</h3>
        <ol class="cronologia">${[ // indicação, júri e organização numa só ordem por ano (no mesmo ano, nessa ordem)
          ...ls.map((l) => [l.ano, 0, `<li class="${l.premiada ? "premio" : ""}" style="--i:IDX"><span class="ano">${l.ano}</span>${selo(multi, l.premio)} · ${esc(l.categoria)}<br>
          <a href="#/obra/${esc(l.obra_id)}"><i>${esc(l.titulo)}</i></a>${l.editora ? ` <span class="muted">(${esc(l.editora)})</span>` : ""}<br>
          <span class="${l.premiada ? "" : "muted"}">${l.vencedora ? "★ " : ""}${resultado(l)}${l.papel !== "autor" ? ` · ${esc(l.papel)}` : ""}</span></li>`]),
          ...jur.map((j) => [j.ano, 1, `<li style="--i:IDX"><span class="ano">${j.ano}</span>${selo(multi, j.premio ?? PREMIOS[0])} · jurado(a) de ${esc(j.categoria)}</li>`]),
          ...org.map((l) => [l.ano, 2, `<li style="--i:IDX"><span class="ano">${l.ano}</span>${selo(multi, l.premio)} · organizou <a href="#/obra/${esc(l.obra_id)}"><i>${esc(l.titulo)}</i></a> <span class="muted pequeno">(fora das contagens)</span></li>`]),
        ].sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, , h], i) => h.replace("--i:IDX", `--i:${i}`)).join("")}</ol>
      </section>
    </div></article>`;
}

// Perfil de livro (RF-24): #/obra/<id>. Capa vinda da fonte (Google Books ou Open Library) quando a coleta achou uma que
// bate título e autor; por baixo dela, sempre, uma capa tipográfica (aparece se não houver imagem ou se ela não carregar).
const FONTE_CAPA = { google_books: "Google Books", open_library: "Open Library" };
// Capa compacta do dados.json (build._capa_compacta) → URLs da imagem e da página na fonte.
export function urlsCapa(c) {
  if (!c) return null;
  if (c.f === "ol") return { url: `https://covers.openlibrary.org/b/id/${c.i}-M.jpg`, pagina: `https://openlibrary.org/${c.p.endsWith("W") ? "works" : "books"}/${c.p}`, fonte: "open_library" };
  if (c.f === "gb") return { url: `https://books.google.com/books/content?id=${c.i}&printsec=frontcover&img=1&zoom=1`, pagina: `https://books.google.com/books?id=${c.i}`, fonte: "google_books" };
  return c;
}
export function htmlObra(id, { D }) {
  const o = D.obras.find((x) => x.id === id), ls = D.participacao.filter((l) => l.obra_id === id);
  if (!o || !ls.length) return null;
  indexarEtapas(D);
  const ps = premiosDe(ls), multi = ps.length > 1;
  const capa = urlsCapa((D.capas ?? []).find((c) => c.obra_id === id)), ed = D.editoras.find((e) => e.id === o.editora_id);
  const papel = (p) => [...new Map(ls.filter((l) => l.papel === p).map((l) => [l.pessoa_id, l])).values()];
  const [autores, ilus, orgs] = ["autor", "ilustrador", "organizador"].map(papel);
  const chips = (xs) => xs.map((l) => `<button type="button" class="link-pessoa" data-pessoa="${esc(l.pessoa_id)}">${esc(l.nome)}</button>`).join("");
  const edicoes = [...new Map(ls.map((l) => [`${l.premio}|${l.ano}|${l.nome_original}`, l])).values()].sort((a, b) => a.ano - b.ano || a.categoria.localeCompare(b.categoria));
  const vit = edicoes.filter((l) => l.vencedora).length, prem = edicoes.filter((l) => l.premiada).length;
  const cats = [...new Set(edicoes.map((l) => l.categoria))];
  // Outras obras de quem escreveu, no recorte (contexto para quem chega pelo livro).
  const ids = new Set(autores.map((l) => l.pessoa_id));
  const outras = [...new Map(D.participacao.filter((l) => ids.has(l.pessoa_id) && l.obra_id !== id && l.papel === "autor").map((l) => [l.obra_id, l])).values()]
    .sort((a, b) => a.ano - b.ano).slice(0, 12);
  const nomesAutores = autores.map((l) => l.nome).join(", ");
  const tipografica = `<span class="capa-tip"><span>${esc(o.titulo)}</span><small>${esc(nomesAutores)}</small></span>`;
  const imgCapa = capa ? `<img src="${esc(capa.url)}" alt="Capa de ${esc(o.titulo)}" width="128" height="192" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : "";
  const links = [
    capa?.pagina && `<a href="${esc(capa.pagina)}" target="_blank" rel="noopener noreferrer">${FONTE_CAPA[capa.fonte]}</a>`,
    `<a href="#/obra/${esc(id)}" data-copiar>Link deste perfil</a>`,
  ].filter(Boolean).join("");
  return `<article>
    <header class="perfil-cab obra-cab">
      <div><span class="capa" style="--h:${M.corAvatar(id)}">${tipografica}${imgCapa}</span>
        ${capa ? `<p class="credito">Capa: ${capa.pagina ? `<a href="${esc(capa.pagina)}" target="_blank" rel="noopener noreferrer">${FONTE_CAPA[capa.fonte]}</a>` : FONTE_CAPA[capa.fonte]}</p>` : `<p class="credito">Sem imagem de capa encontrada.</p>`}</div>
      <div>
        <p class="sobretitulo">Livro · ${cats.map(esc).join(" · ")}</p>
        <h2 id="perfil-nome">${esc(o.titulo)}</h2>
        <p>${edicoes.length} indicaç${edicoes.length === 1 ? "ão" : "ões"} · ${prem ? `${prem} prêmio${prem > 1 ? "s" : ""}` : "sem prêmio"}${vit ? ` · <b>${vezes(vit)} 1º lugar</b>` : ""}</p>
        <div class="links-externos">${links}</div>
      </div>
    </header>
    <div class="perfil-corpo">
      <section aria-label="Autoria e edição">
        <h3>Autoria e edição</h3>
        <dl class="atributos">
          ${autores.length ? `<dt>Autoria</dt><dd><span class="chips">${chips(autores)}</span></dd>` : ""}
          ${ilus.length ? `<dt>Ilustração</dt><dd><span class="chips">${chips(ilus)}</span></dd>` : ""}
          ${orgs.length ? `<dt>Organização</dt><dd><span class="chips">${chips(orgs)}</span></dd>` : ""}
          <dt>Editora</dt><dd>${ed ? `${esc(ed.nome)}<br><span class="muted pequeno">${ed.grupo ? `grupo ${esc(ed.grupo)}` : "independente"}${ed.municipio_sede ? ` · sede: ${esc(ed.municipio_sede)}${ed.uf_sede ? `/${esc(ed.uf_sede)}` : ""}` : ""}</span>` : "–"}</dd>
          <dt>Publicação</dt><dd>${o.ano_publicacao ? esc(o.ano_publicacao) : "–"}</dd>
        </dl>
        ${outras.length ? `<h3 style="margin-top:1.2rem">Outras obras de ${autores.length > 1 ? "quem escreveu" : esc(autores[0].nome)} ${PREMIOS.length > 1 ? "na base" : `no ${esc(nomesPremios())}`}</h3>
          <ul class="obras-lista">${outras.map((l) => `<li><a href="#/obra/${esc(l.obra_id)}"><i>${esc(l.titulo)}</i></a> <span class="muted pequeno">${l.ano}${PREMIOS.length > 1 ? ` · ${esc(NOME_PREMIO[l.premio] ?? l.premio)}` : ""} · ${esc(l.categoria)}</span></li>`).join("")}</ul>` : ""}
      </section>
      <section aria-label="Participações ${multi ? "nos prêmios" : `no ${esc(nomesPremios(ps))}`}">
        <h3>${esc(tituloPremios(ps))}</h3>
        <ol class="cronologia">${edicoes.map((l, i) => `<li class="${l.premiada ? "premio" : ""}" style="--i:${i}"><span class="ano">${l.ano}</span>${selo(multi, l.premio)} · ${esc(l.categoria)}${l.nome_original !== l.categoria ? ` <span class="muted pequeno">(${esc(l.nome_original)})</span>` : ""}<br>
          ${l.editora && l.editora !== ed?.nome ? `<span class="muted pequeno">edição: ${esc(l.editora)}</span><br>` : ""}<span class="${l.premiada ? "" : "muted"}">${l.vencedora ? "★ " : ""}${resultado(l)}</span></li>`).join("")}</ol>
      </section>
    </div></article>`;
}
