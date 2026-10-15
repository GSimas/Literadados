// História guiada (RF-16): gráfico de unidades fixo (um ponto por pessoa-autora) que se reorganiza a cada passo.
// Números da narrativa: metricas.historia (testada). Encaixe por passo: CSS scroll-snap (design D15).
import * as M from "./metricas.js";
import { $, fmt, fmtPct, esc, rotulo, css, corDe, dica, movimentoReduzido, astGenero } from "./ui.js";

const ROT_ETAPA = { lista: "Só a lista", premiada: "Premiadas (2º/3º)", vencedora: "Venceram (1º lugar)" };
// Rótulos curtos para os blocos (com 7 grupos lado a lado, o rótulo longo não cabe).
const ROT_CURTO = { nao_identificado: "Não identificado", nao_binario: "Não binárias", negra: "Negras", branca: "Brancas", sem_declaracao: "Sem declaração",
  "sem dado": "Sem dado", "Centro-Oeste": "C.-Oeste" };

function passos(H, D) {
  const popSudeste = 100 * d3.sum(D.ufs.filter((u) => u.regiao === "Sudeste"), (u) => u.populacao_2022 ?? 0) / d3.sum(D.ufs, (u) => u.populacao_2022 ?? 0);
  const v = H.vencedoras, dif = (v.pctMulheres ?? 0) - (H.genero.pctMulheres ?? 0);
  return [
    { layout: "todos", cor: "neutro", titulo: "Cada ponto é uma pessoa",
      numero: fmt(H.pessoas), texto: `Entre 2010 e 2025, <b>${fmt(H.indicacoes)} indicações</b> de ${fmt(H.edicoes)} edições do Jabuti levaram às listas obras de <b>${fmt(H.pessoas)} pessoas-autoras</b>, em romance, contos, crônica, poesia, infantil, juvenil e Livro do Ano.`,
      nota: "Ilustradores e organizadores ficam fora desta conta. Role para reorganizar os pontos." },
    { layout: "genero", cor: "genero", titulo: "Quantas são mulheres",
      numero: fmtPct(H.genero.pctMulheres) + astGenero(H.genero.atribuido), texto: `${fmt(H.genero.mulheres)} das ${fmt(H.pessoas)} pessoas são mulheres; ${fmt(H.genero.homens)} são homens${H.genero.naoBinarias ? ` e ${fmt(H.genero.naoBinarias)} são não binárias` : ""}.`,
      nota: [H.genero.atribuido ? `Para ${fmt(H.genero.atribuido)} pessoas sem fonte, o gênero foi atribuído pelo primeiro nome e pode estar errado (*).` : "",
        H.genero.semGenero ? `Para ${fmt(H.genero.semGenero)}, nem o nome permite dizer (cinza).` : ""].filter(Boolean).join(" ") },
    { layout: "etapa", cor: "genero", titulo: "Da lista ao 1º lugar",
      numero: fmtPct(v.pctMulheres) + astGenero(H.genero.atribuido), texto: `Das <b>${fmt(v.pessoas)} pessoas que venceram</b> pelo menos uma vez, ${fmt(v.mulheres)} são mulheres: ${fmtPct(v.pctMulheres)}, ${Math.abs(dif) < 1 ? "praticamente o mesmo peso" : dif < 0 ? `${fmt(Math.abs(dif), 1)} pontos a menos` : `${fmt(dif, 1)} pontos a mais`} que na lista inteira (${fmtPct(H.genero.pctMulheres)}).`,
      nota: "Cada pessoa aparece no seu melhor resultado. Até 2017 havia 2º e 3º lugares; desde 2018, só o 1º." },
    { layout: "raca", cor: "raca", titulo: "Pelo menos estas pessoas são negras",
      numero: `≥ ${fmtPct(H.raca.pctNegras)}`, texto: `<b>${fmt(H.raca.negras)} pessoas</b> se declararam publicamente negras (pretas, pardas ou negras) e ${fmt(H.raca.indigenas)} indígenas. Entre quem venceu, ${fmt(H.raca.negrasVencedoras)}.`,
      nota: `Para ${fmt(H.raca.semDeclaracao)} pessoas não há autodeclaração pública (cinza). Isso não quer dizer que sejam brancas: por isso o número é um piso, nunca uma estimativa.` },
    { layout: "regiao", cor: "regiao", titulo: "O peso do Sudeste",
      numero: fmtPct(H.regiao.pctSudeste), texto: `Entre as ${fmt(H.regiao.comUF)} pessoas com UF de nascimento conhecida no Brasil, <b>${fmt(H.regiao.sudeste)} nasceram no Sudeste</b>, região que tem ${fmtPct(popSudeste)} da população (Censo 2022). ${H.topUF.uf ? `Só ${esc(H.topUF.uf)} reúne ${fmt(H.topUF.pessoas)}.` : ""}`,
      nota: `${fmt(H.regiao.exterior)} pessoas estão registradas como nascidas fora do Brasil e ${fmt(H.regiao.semDado)} ainda não têm UF de nascimento na base (entre elas, outras nascidas no exterior).` },
    { layout: "todos", cor: "genero", titulo: "Agora é com você",
      numero: "", texto: `Cada parte tem o próprio filtro de período e categoria. Veja a <a href="#/grafico/linha-do-tempo">linha do tempo</a>, o <a href="#/grafico/geografia">mapa</a>, as <a href="#/grafico/funil">análises</a> e o <a href="#autores">perfil de cada pessoa</a>, sempre com as fontes.`,
      nota: "Ou pergunte em português à Diadorim, a IA no canto da tela." },
  ];
}

// Ordem dos grupos em cada layout; grupos vazios saem.
function grupos(layout, pts) {
  const ordem = { todos: ["todos"], genero: M.ORDEM.genero, etapa: ["lista", "premiada", "vencedora"], raca: M.ORDEM.raca, regiao: M.ORDEM.regiao }[layout];
  const chave = (p) => (layout === "todos" ? "todos" : p[layout]);
  return ordem.map((g) => ({ g, pts: pts.filter((p) => chave(p) === g) })).filter((x) => x.pts.length);
}

// Blocos de unidades lado a lado, empilhados de baixo para cima (como barras feitas de pontos).
function posicoes(layout, corDim, pts, W, Hh, d) {
  const gs = grupos(layout, pts);
  const rotuloH = 46, gap = Math.max(12, W * 0.025);
  const bw = (W - gap * (gs.length - 1)) / gs.length;
  // Colunas para o maior bloco ocupar ~80% da altura: blocos proporcionados em vez de faixas achatadas.
  const linhasAlvo = Math.max(1, Math.floor((0.8 * (Hh - rotuloH)) / d));
  const maxCols = Math.max(1, Math.floor(bw / d));
  const cols = Math.min(maxCols, Math.max(1, Math.ceil(d3.max(gs, (x) => x.pts.length) / linhasAlvo)));
  const pos = new Map(), rot = [];
  const ordemCor = corDim === "neutro" ? null : M.ORDEM[corDim];
  gs.forEach(({ g, pts: ps }, i) => {
    const ord = ordemCor ? [...ps].sort((a, b) => ordemCor.indexOf(a[corDim]) - ordemCor.indexOf(b[corDim]) || a.id.localeCompare(b.id)) : [...ps].sort((a, b) => a.id.localeCompare(b.id));
    const x0 = i * (bw + gap) + (bw - cols * d) / 2;
    ord.forEach((p, k) => pos.set(p.id, { x: x0 + (k % cols) * d + d / 2, y: Hh - rotuloH - Math.floor(k / cols) * d - d / 2 }));
    const linhas = Math.ceil(ps.length / cols);
    const mulheres = ps.filter((p) => p.genero === "mulher").length;
    rot.push({ g, n: ps.length, x: i * (bw + gap) + bw / 2, yTopo: Hh - rotuloH - linhas * d,
      extra: layout === "etapa" ? `${fmtPct(100 * mulheres / ps.length)} mulheres` : "" });
  });
  const altura = d3.max(gs, ({ pts: ps }) => Math.ceil(ps.length / cols)) * d + rotuloH;
  return { pos, rot, cabe: altura <= Hh };
}

export function montarHistoria({ D, abrirPerfil }) {
  const linhas = M.filtrar(D.participacao, { categorias: null, papel: "autor" });
  const H = M.historia(linhas);
  const pts = M.pontosHistoria(linhas);
  const P = passos(H, D);
  $("#historia-passos").innerHTML = P.map((p, i) => `<div class="passo" data-i="${i}"><div class="passo-cartao" tabindex="0">
      <h3>${p.titulo}</h3>${p.numero ? `<span class="numero">${p.numero}</span>` : ""}<p>${p.texto}</p>${p.nota ? `<p class="nota">${p.nota}</p>` : ""}</div></div>`).join("");

  const svg = d3.select("#g-historia");
  let atual = 0, d = 10, W = 0, Hh = 0;
  const corPonto = (p, dim) => (dim === "neutro" ? css("--marca") : corDe(dim, p[dim]));

  function medir() {
    const r = svg.node().getBoundingClientRect();
    W = Math.max(280, r.width); Hh = Math.max(240, r.height);
    svg.attr("viewBox", [0, 0, W, Hh]);
    // Maior diâmetro que faz todos os layouts caberem: as posições não mudam de escala entre passos.
    for (d = 16; d > 3; d -= 0.5) if (P.every((p) => posicoes(p.layout, p.cor, pts, W, Hh, d).cabe)) break;
  }

  function aplicar(i, animar = true) {
    atual = i;
    const p = P[i];
    const { pos, rot } = posicoes(p.layout, p.cor, pts, W, Hh, d);
    const dur = animar && !movimentoReduzido() ? 900 : 0;
    svg.selectAll("circle.ponto").data(pts, (x) => x.id).join(
      (e) => e.append("circle").attr("class", "ponto").attr("r", 0)
        .attr("cx", (x) => pos.get(x.id).x).attr("cy", (x) => pos.get(x.id).y)
        .on("pointermove", (ev, x) => dica.mostrar(ev, `<b>${esc(x.nome)}</b>${esc(rotulo(x.genero))} · ${esc(ROT_ETAPA[x.etapa])}<br><span class="muted">clique para abrir o perfil</span>`))
        .on("pointerleave", dica.esconder)
        .on("click", (ev, x) => abrirPerfil(x.id))
        .style("cursor", "pointer"),
    ).transition().duration(dur).delay((x, k) => (dur ? (k % 120) * 2.5 : 0)).ease(d3.easeCubicInOut)
      .attr("r", d * 0.4).attr("cx", (x) => pos.get(x.id).x).attr("cy", (x) => pos.get(x.id).y)
      .attr("fill", (x) => corPonto(x, p.cor)).attr("stroke", css("--superficie")).attr("stroke-width", d > 8 ? 1 : 0.5);
    const rotulos = svg.selectAll("g.rotulo").data(rot, (r) => r.g).join((e) => {
      const g = e.append("g").attr("class", "rotulo").attr("opacity", 0);
      g.append("text").attr("class", "ponto-rotulo").attr("text-anchor", "middle");
      g.append("text").attr("class", "ponto-rotulo-n").attr("text-anchor", "middle");
      return g;
    });
    rotulos.transition().duration(dur).attr("opacity", 1).attr("transform", (r) => `translate(${r.x},${Hh - 26})`);
    const apertado = rot.length > 5 && W / rot.length < 110;
    rotulos.select(".ponto-rotulo").style("font-size", apertado ? "10.5px" : null)
      .text((r) => (p.layout === "todos" ? `${fmt(r.n)} pessoas` : p.layout === "etapa" ? ROT_ETAPA[r.g] : apertado || ROT_CURTO[r.g] ? ROT_CURTO[r.g] ?? rotulo(r.g) : rotulo(r.g)));
    rotulos.select(".ponto-rotulo-n").attr("dy", 15).style("font-size", apertado ? "10px" : null).text((r) => (p.layout === "todos" ? "" : `${fmt(r.n)}${r.extra ? ` · ${r.extra}` : ` · ${fmtPct(100 * r.n / pts.length)}`}`));
    svg.selectAll("g.rotulo").raise();
    // Legenda de cor do passo (identidade nunca só pela cor: os blocos também têm rótulo).
    const dim = p.cor;
    $("#historia-legenda").innerHTML = dim === "neutro" ? "" : M.ORDEM[dim].filter((g) => pts.some((x) => x[dim] === g))
      .map((g) => `<span><i style="background:${corDe(dim, g)}"></i>${esc(rotulo(g))}</span>`).join("");
    document.querySelectorAll(".passo").forEach((el) => el.classList.toggle("ativo", +el.dataset.i === i));
  }

  medir();
  aplicar(0, false);
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { const i = +e.target.dataset.i; if (i !== atual) aplicar(i); }
  }, { rootMargin: "-45% 0px -45% 0px" });
  document.querySelectorAll(".passo").forEach((el) => io.observe(el));
  $("#historia-passos").addEventListener("focusin", (e) => { const el = e.target.closest(".passo"); if (el) aplicar(+el.dataset.i); });
  return { redesenhar() { medir(); aplicar(atual, false); } };
}
