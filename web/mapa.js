// Mapa coroplético por UF de nascimento (RF-07): malha do IBGE em web/br-uf.json, carregada uma vez.
import * as M from "./metricas.js";
import { $, $$, fmt, esc, css, largura, textoSobre, tabela, dica, foto, botaoExportarGrafico } from "./ui.js";

let malha = null;
let medida = "pessoas";
let ufSel = null;

export const obterMalha = () => malha;

export async function carregarMalha() {
  malha = await fetch("br-uf.json").then((r) => r.json());
}

export function montarControlesMapa(redesenhar) {
  $("#geo-medida").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-v]");
    if (!b) return;
    medida = b.dataset.v;
    $$("#geo-medida button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    redesenhar();
  });
}

export function renderMapa(L, { D, midiaPorId, abrirPerfil }) {
  const el = $("#g-mapa");
  const u = M.porUF(L, D.ufs);
  const porUF = new Map(u.map((d) => [d.uf, d]));
  const valor = (d) => (medida === "pessoas" ? d.pessoas : d.porMilhao ?? 0);
  const casas = medida === "pessoas" ? 0 : 1;
  const w = Math.min(largura(el), 620), h = Math.round(w * 0.98);
  const proj = d3.geoIdentity().reflectY(true).fitExtent([[8, 8], [w - 8, h - 8]], malha);
  const caminho = d3.geoPath(proj);
  // 5 classes por quantis dos valores positivos; zero fica na cor mais clara, com rótulo próprio na legenda.
  const pos = u.map(valor).filter((v) => v > 0).sort(d3.ascending);
  const rampa = d3.quantize(d3.interpolateLab(css("--seq-0"), css("--seq-1")), 5);
  const limites = pos.length ? [0.2, 0.4, 0.6, 0.8].map((q) => d3.quantileSorted(pos, q)) : [];
  const escala = d3.scaleThreshold().domain(limites).range(rampa);
  const cor = (v) => (v > 0 ? escala(v) : css("--grade"));

  const svg = d3.create("svg").attr("viewBox", [0, 0, w, h]).attr("width", w).attr("role", "group")
    .attr("aria-label", `Mapa do Brasil por UF de nascimento: ${medida === "pessoas" ? "pessoas" : "pessoas por milhão de habitantes"}`);
  svg.append("g").selectAll("path").data(malha.features).join("path")
    .attr("class", (f) => `uf${f.properties.uf === ufSel ? " sel" : ""}`).attr("d", caminho)
    .attr("fill", (f) => cor(valor(porUF.get(f.properties.uf))))
    .attr("tabindex", 0).attr("role", "button")
    .attr("aria-label", (f) => { const d = porUF.get(f.properties.uf); return `${d.nome}: ${fmt(d.pessoas)} pessoas, ${fmt(d.porMilhao, 2)} por milhão`; })
    .on("pointermove", (ev, f) => { const d = porUF.get(f.properties.uf);
      dica.mostrar(ev, `<b>${esc(d.nome)} (${d.uf})</b>${fmt(d.pessoas)} pessoas · ${fmt(d.participacoes)} participações<br>${fmt(d.porMilhao, 2)} por milhão de habitantes`); })
    .on("pointerleave", dica.esconder)
    .on("click", (ev, f) => selecionar(f.properties.uf))
    .on("keydown", (ev, f) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); selecionar(f.properties.uf); } });
  // Rótulo de valor no centroide das UFs grandes o bastante para caber o texto.
  svg.append("g").attr("aria-hidden", "true").selectAll("text").data(malha.features.filter((f) => caminho.area(f) > 900)).join("text")
    .attr("transform", (f) => `translate(${caminho.centroid(f)})`).attr("text-anchor", "middle").attr("dy", "0.35em")
    .attr("fill", (f) => { const v = valor(porUF.get(f.properties.uf)); return v > 0 ? textoSobre((rampa.indexOf(escala(v)) + 0.5) / 5) : css("--tinta-2"); })
    .text((f) => `${f.properties.uf} ${fmt(valor(porUF.get(f.properties.uf)), casas)}`);

  const legenda = document.createElement("div");
  legenda.className = "mapa-legenda";
  const cortes = [pos[0] ?? 0, ...limites, pos.at(-1) ?? 0];
  legenda.innerHTML = `<span><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${css("--grade")};vertical-align:-1px"></i> zero</span>
    <span class="escala">${rampa.map((c) => `<i style="background:${c}"></i>`).join("")}</span>
    <span>${fmt(cortes[0], casas)} → ${fmt(cortes.at(-1), casas)} ${medida === "pessoas" ? "pessoas" : "por milhão"} (quintis)</span>`;
  el.replaceChildren(svg.node(), legenda, botaoExportarGrafico());

  tabela($("#t-mapa"), [...u].sort((a, b) => b.pessoas - a.pessoas || a.uf.localeCompare(b.uf)), [
    { rot: "UF", k: "uf" }, { rot: "Região", k: "regiao" }, { rot: "Pessoas", k: "pessoas", num: true },
    { rot: "Participações", k: "participacoes", num: true }, { rot: "Por milhão de hab.", f: (d) => fmt(d.porMilhao, 2), num: true },
  ]);

  function selecionar(uf) {
    ufSel = uf;
    svg.selectAll("path.uf").classed("sel", (f) => f.properties.uf === uf);
    lado();
  }
  function lado() {
    const alvo = $("#mapa-uf");
    const fora = M.kpis(L).pessoas - d3.sum(u, (d) => d.pessoas);
    if (!ufSel) {
      const top = [...u].sort((a, b) => valor(b) - valor(a)).slice(0, 5);
      alvo.innerHTML = `<h3>Clique numa UF</h3><p class="muted">Maiores valores no recorte (${medida === "pessoas" ? "pessoas" : "por milhão de habitantes"}):</p>
        <ol>${top.map((d) => `<li><b>${esc(d.nome)}</b> — ${fmt(valor(d), casas)}</li>`).join("")}</ol>
        <p class="muted pequeno">${fmt(fora)} pessoas do recorte nasceram fora do Brasil ou ainda não têm UF de nascimento.</p>`;
      return;
    }
    const d = porUF.get(ufSel);
    const pessoas = M.resumoPessoas(L.filter((l) => l.uf_nascimento === ufSel), D.pessoas)
      .sort((a, b) => b.premios - a.premios || a.nome.localeCompare(b.nome, "pt-BR"));
    alvo.innerHTML = `<p class="sobretitulo"><a href="#/regiao/${encodeURIComponent(d.regiao)}">${esc(d.regiao)}</a></p><h3>${esc(d.nome)}</h3>
      <p>${fmt(d.pessoas)} pessoas · ${fmt(d.participacoes)} participações · ${fmt(d.porMilhao, 2)} por milhão de habitantes</p>
      <p><a class="botao" href="#/uf/${esc(d.uf)}">Perfil de ${esc(d.nome)} <span aria-hidden="true">→</span></a></p>
      <ul class="lista-pessoas">${pessoas.map((p) => `<li>${foto(p, midiaPorId.get(p.id), { w: 80, classe: "foto mini-foto" })}
        <button type="button" class="link-pessoa" data-pessoa="${esc(p.id)}">${esc(p.nome)}</button>
        <span class="muted pequeno">${p.premios ? `${p.premios} prêmio${p.premios > 1 ? "s" : ""}` : `${p.participacoes} indicaç${p.participacoes > 1 ? "ões" : "ão"}`}</span></li>`).join("") || "<li class='muted'>Ninguém no recorte.</li>"}</ul>`;
  }
  $("#mapa-uf").onclick = (e) => { const b = e.target.closest("[data-pessoa]"); if (b) abrirPerfil(b.dataset.pessoa); };
  lado();
}
