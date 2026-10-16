// Perfis de estados e regiões (RF-22, D23): #/uf/<UF> e #/regiao/<Região>, no mesmo <dialog> dos perfis de pessoas.
// Números de metricas.perfilLugar (testada) sobre o recorte completo de autores; gráficos desenhados depois de o diálogo abrir.
import * as M from "./metricas.js";
import { esc, fmt, fmtPct, css, largura, estilo, desenhar, astGenero, nPequeno, nomesPremios } from "./ui.js";
import { obterMalha } from "./mapa.js";

const ehBR = (u) => u.uf !== "EX";

// tipo: "uf" ou "regiao"; chave: sigla da UF ou nome da região. Devolve { html, desenhar } ou null.
export function htmlLugar(tipo, chave, { D, linhas }) {
  const ufs = D.ufs.filter(ehBR);
  const uf = tipo === "uf" ? ufs.find((u) => u.uf === chave) : null;
  const ufsDoLugar = uf ? [uf] : ufs.filter((u) => u.regiao === chave);
  if (!ufsDoLugar.length) return null;
  const siglas = new Set(ufsDoLugar.map((u) => u.uf));
  const pred = (l) => siglas.has(l.uf_nascimento);
  const p = M.perfilLugar(linhas, pred);
  const pop = ufsDoLugar.reduce((s, u) => s + (u.populacao_2022 ?? 0), 0), popBR = ufs.reduce((s, u) => s + (u.populacao_2022 ?? 0), 0);
  const porMilhao = pop ? (p.pessoas / pop) * 1e6 : null, mediaBR = popBR ? (p.pessoasBR / popBR) * 1e6 : null;
  const pessoas = M.resumoPessoas(linhas.filter(pred), D.pessoas)
    .sort((a, b) => b.vitorias - a.vitorias || b.premios - a.premios || b.participacoes - a.participacoes || a.nome.localeCompare(b.nome, "pt-BR"));
  const nome = uf ? uf.nome : chave;
  const cartao = (rot, val, det = "") => `<div class="kpi"><div class="rot">${rot}</div><div class="val">${val}</div><div class="det">${det}</div></div>`;
  const comparacao = porMilhao == null || mediaBR == null ? "" : porMilhao > mediaBR * 1.1 ? "acima" : porMilhao < mediaBR * 0.9 ? "abaixo" : "perto";

  const html = `<article class="lugar">
    <header class="perfil-cab lugar-cab">
      <div class="lugar-mapa" id="lugar-mapa" aria-hidden="true"></div>
      <div>
        <p class="sobretitulo">${uf ? `Estado · <a href="#/regiao/${encodeURIComponent(uf.regiao)}">${esc(uf.regiao)}</a>` : `Região · ${ufsDoLugar.length} UFs`}</p>
        <h2 id="perfil-nome">${esc(nome)}</h2>
        <p>${p.pessoas ? `<b>${fmt(p.pessoas)} pessoas-autoras</b> nasceram ${uf ? "neste estado" : "nesta região"}: ${fmtPct(p.parcela)} das ${fmt(p.pessoasBR)} com UF de nascimento conhecida no Brasil.`
          : `Nenhuma pessoa-autora do recorte tem UF de nascimento ${uf ? "neste estado" : "nesta região"}.`}</p>
        <p class="muted pequeno">${D.premios?.length > 1 ? `Todos os prêmios da base (${esc(nomesPremios())}), cada pessoa contada uma vez` : esc(nomesPremios())}; série completa (${D.anos[0]}–${D.anos[1]}), todas as categorias, só autores. População: Censo 2022.</p>
        <div class="links-externos"><a href="#/${tipo}/${encodeURIComponent(chave)}" data-copiar>Link deste perfil</a></div>
      </div>
    </header>
    <div class="lugar-corpo">
      <div class="kpis">
        ${cartao("Pessoas-autoras", fmt(p.pessoas), `${fmtPct(p.parcela)} do Brasil`)}
        ${cartao("Indicações", fmt(p.indicacoes), "obras na lista com autoria daqui")}
        ${cartao("Premiadas", fmt(p.premiadas), `pessoas; ${fmt(p.vencedoras)} venceram (1º lugar)`)}
        ${cartao("Mulheres", fmtPct(p.pctMulheres) + astGenero(p.generoAtribuido), `${fmt(p.mulheres)} de ${fmt(p.pessoas)}${nPequeno(p.pessoas)}`)}
        ${cartao("Pessoas negras", p.pessoas ? `≥ ${fmtPct(p.pctNegrasPiso)}` : "–", `pelo menos ${fmt(p.negras)}; piso por autodeclaração`)}
        ${cartao("Por milhão de hab.", fmt(porMilhao, 1), `média do Brasil: ${fmt(mediaBR, 1)}${comparacao ? ` (${comparacao} da média)` : ""}`)}
      </div>
      <section><h3>Parcela das participações na lista, por edição</h3><div class="grafico" id="lugar-anos"></div>
        <p class="muted pequeno">Participações de pessoas nascidas ${uf ? "no estado" : "na região"} sobre as participações com UF conhecida no Brasil. Passe o mouse para ver o n.</p></section>
      <section><h3>Parcela por categoria</h3><div class="grafico" id="lugar-cats"></div></section>
      ${uf ? "" : `<section><h3>Pessoas-autoras por estado</h3><div class="grafico" id="lugar-ufs"></div>
        <p class="chips">${ufsDoLugar.map((u) => `<a class="chip-link" href="#/uf/${u.uf}">${esc(u.nome)}</a>`).join("")}</p></section>`}
      <section><h3>Quem nasceu ${uf ? "aqui" : "na região"} (${fmt(pessoas.length)})</h3>
        <p class="chips">${pessoas.map((x) => `<button type="button" class="link-pessoa" data-pessoa="${esc(x.id)}">${esc(x.nome)}${x.vitorias ? " <span aria-hidden='true'>★</span>" : ""}</button>`).join("") || "<span class='muted'>Ninguém no recorte.</span>"}</p></section>
    </div>
  </article>`;

  const desenharTudo = () => {
    const corpo = document.querySelector(".lugar-corpo");
    const w = (id) => largura(document.getElementById(id));
    // Mini-mapa: o lugar em destaque; as demais UFs levam aos próprios perfis.
    const malha = obterMalha(), elMapa = document.getElementById("lugar-mapa");
    if (malha && elMapa) {
      const lado = 220, proj = d3.geoIdentity().reflectY(true).fitExtent([[4, 4], [lado - 4, lado - 4]], malha), caminho = d3.geoPath(proj);
      const svg = d3.create("svg").attr("viewBox", [0, 0, lado, lado]).attr("class", "mini-mapa");
      svg.append("g").selectAll("a").data(malha.features).join("a").attr("href", (f) => `#/uf/${f.properties.uf}`)
        .append("path").attr("d", caminho).attr("class", (f) => (siglas.has(f.properties.uf) ? "uf destaque" : "uf"))
        .append("title").text((f) => ufs.find((u) => u.uf === f.properties.uf)?.nome ?? f.properties.uf);
      elMapa.replaceChildren(svg.node());
    }
    if (!corpo || !p.pessoas) return;
    const cor = css("--s1");
    desenhar(document.getElementById("lugar-anos"), Plot.plot({
      width: w("lugar-anos"), height: 230, marginLeft: 44, style: estilo(), ariaLabel: `Parcela de ${nome} por edição`,
      x: { label: null, tickFormat: "d", ticks: 8 }, y: { label: "% das participações", grid: true, domain: [0, Math.max(10, d3.max(p.porAno, (d) => d.pct) * 1.15)] },
      marks: [
        Plot.areaY(p.porAno, { x: "ano", y: "pct", fill: cor, fillOpacity: 0.12, curve: "monotone-x" }),
        Plot.lineY(p.porAno, { x: "ano", y: "pct", stroke: cor, strokeWidth: 2, curve: "monotone-x" }),
        Plot.dot(p.porAno, { x: "ano", y: "pct", fill: cor, r: 3.5, tip: { format: { y: (v) => fmtPct(v), x: (v) => String(v) } },
          channels: { n: "n", Total: (d) => `${d.total}${nPequeno(d.total)}` } }),
        Plot.ruleY([p.parcela], { stroke: css("--tinta-2"), strokeDasharray: "3 3" }),
        Plot.text([p.parcela], { x: d3.max(p.porAno, (d) => d.ano), y: (d) => d, text: () => `média ${fmtPct(p.parcela)}`, dy: -7, textAnchor: "end", fill: css("--tinta-2"), fontSize: 11 }),
      ],
    }));
    desenhar(document.getElementById("lugar-cats"), Plot.plot({
      width: w("lugar-cats"), height: 36 + p.porCategoria.length * 30, marginLeft: 130, style: estilo(), ariaLabel: `Parcela de ${nome} por categoria`,
      x: { label: "% das participações", grid: true }, y: { label: null, domain: p.porCategoria.map((d) => d.categoria) },
      marks: [Plot.barX(p.porCategoria, { y: "categoria", x: "pct", fill: cor, rx: 3, insetTop: 3, insetBottom: 3,
        tip: { format: { x: (v) => fmtPct(v) } }, channels: { n: "n", Total: (d) => `${d.total}${nPequeno(d.total)}` } })],
    }));
    const elUfs = document.getElementById("lugar-ufs");
    if (elUfs) {
      const dados = M.porUF(linhas, D.ufs).filter((d) => siglas.has(d.uf)).sort((a, b) => b.pessoas - a.pessoas);
      desenhar(elUfs, Plot.plot({
        width: w("lugar-ufs"), height: 36 + dados.length * 30, marginLeft: 150, style: estilo(), ariaLabel: `Pessoas-autoras por UF em ${nome}`,
        x: { label: "pessoas-autoras", grid: true }, y: { label: null, domain: dados.map((d) => d.nome) },
        marks: [Plot.barX(dados, { y: "nome", x: "pessoas", fill: cor, rx: 3, insetTop: 3, insetBottom: 3, tip: true,
          channels: { "Por milhão": (d) => fmt(d.porMilhao, 1) } })],
      }));
    }
  };
  return { html, desenhar: desenharTudo };
}

