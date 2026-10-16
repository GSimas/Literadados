// Agregações do painel: funções puras, sem d3, testadas em tests/metricas.test.mjs (spec CA-03.1, 05.1, 06.2, 09.2).
// Unidade padrão = participação (uma pessoa em uma indicação). Panorama conta pessoas distintas.

export const ORDEM = {
  genero: ["mulher", "homem", "nao_binario", "nao_identificado"],
  raca: ["negra", "indigena", "amarela", "branca", "sem_declaracao"],
  regiao: ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul", "Exterior", "sem dado"],
};

export const ROTULO = {
  mulher: "Mulheres", homem: "Homens", nao_binario: "Não binárias", nao_identificado: "Gênero não identificado",
  negra: "Negras (pretas, pardas ou negras)", indigena: "Indígenas", amarela: "Amarelas", branca: "Brancas (declaradas)",
  sem_declaracao: "Sem declaração racial", "sem dado": "Sem dado de nascimento",
  Norte: "Norte", Nordeste: "Nordeste", "Centro-Oeste": "Centro-Oeste", Sudeste: "Sudeste", Sul: "Sul", Exterior: "Exterior",
};

export const ETAPAS = [
  { id: "lista", rotulo: "Lista", teste: () => true },
  { id: "finalista", rotulo: "Finalistas", teste: (l) => l.lista_curta === 1, nota: "só edições com 2ª lista (2019+)" },
  { id: "premiada", rotulo: "Premiadas", teste: (l) => !!l.premiada },
  { id: "vencedora", rotulo: "Vencedoras", teste: (l) => !!l.vencedora },
];

export const MARCOS = [
  { ano: 2018, texto: "Reforma: só o 1º lugar" },
  { ano: 2020, texto: "Romance Literário" },
  { ano: 2021, texto: "CBL coleta raça" },
];

const pct = (n, d) => (d ? (100 * n) / d : null);
const contar = (arr, chave) => {
  const m = new Map();
  for (const x of arr) m.set(chave(x), (m.get(chave(x)) ?? 0) + 1);
  return m;
};
const distintos = (arr, chave) => new Set(arr.map(chave)).size;

// Remonta as linhas de v_participacao a partir do dados.json compacto (design D13).
// Só junções: as regras (regime, negra, premiada, vencedora) já vêm do SQL. A ordem das chaves é a da view.
export function expandir(D) {
  const por = (arr, chave) => new Map(arr.map((x) => [chave(x), x]));
  const regime = por(D.regimes, (r) => r.ano);
  const categoria = por(D.categorias, (c) => `${c.ano}|${c.nome_original}`);
  const obra = por(D.obras, (o) => o.id);
  const editora = por(D.editoras, (e) => e.id);
  const pessoa = por(D.pessoas, (p) => p.id);
  const uf = por(D.ufs, (u) => u.uf);
  return D.participacao.map((l) => {
    const o = obra.get(l.obra_id);
    const e = editora.get(o.editora_id);
    const p = pessoa.get(l.pessoa_id);
    return {
      ano: l.ano,
      regime: regime.get(l.ano).regime,
      categoria: categoria.get(`${l.ano}|${l.nome_original}`).categoria,
      nome_original: l.nome_original,
      obra_id: l.obra_id,
      titulo: o.titulo,
      ano_publicacao: o.ano_publicacao,
      editora: e?.nome ?? null,
      grupo_editorial: e?.grupo ?? null,
      uf_editora: e?.uf_sede ?? null,
      pessoa_id: l.pessoa_id,
      nome: p.nome,
      papel: l.papel,
      genero: p.genero,
      genero_atribuido: p.genero_evidencia === "atribuicao",
      raca: p.raca,
      raca_busca: p.raca_busca,
      negra: p.negra,
      uf_nascimento: p.uf_nascimento,
      regiao_nascimento: uf.get(p.uf_nascimento)?.regiao ?? null,
      idade_no_premio: p.ano_nascimento == null ? null : l.ano - p.ano_nascimento,
      lista_curta: l.lista_curta,
      colocacao: l.colocacao,
      premiada: l.premiada,
      vencedora: l.vencedora,
    };
  });
}

export function grupo(l, dim) {
  if (dim === "genero") return l.genero;
  if (dim === "raca") return l.negra ? "negra" : l.raca;
  return l.regiao_nascimento ?? "sem dado";
}

export function filtrar(linhas, { anoIni = 2010, anoFim = 2025, categorias = null, papel = "autor" } = {}) {
  return linhas.filter(
    (l) =>
      l.ano >= anoIni && l.ano <= anoFim &&
      (!categorias || categorias.includes(l.categoria)) &&
      (papel === "todos" ? l.papel === "autor" || l.papel === "ilustrador" : l.papel === papel) // organizadores nunca (D14)
  );
}

// Uma linha por pessoa, com o primeiro registro (atributos da pessoa são iguais em todas as linhas dela).
const porPessoa = (linhas) => [...new Map(linhas.map((l) => [l.pessoa_id, l])).values()];

export function kpis(linhas) {
  const pessoas = porPessoa(linhas);
  const n = pessoas.length;
  const mulheres = pessoas.filter((p) => p.genero === "mulher").length;
  const negras = pessoas.filter((p) => p.negra).length;
  const comRaca = pessoas.filter((p) => p.raca !== "sem_declaracao").length;
  const buscaParcial = pessoas.filter((p) => p.raca_busca !== "completa").length;
  const generoAtribuido = pessoas.filter((p) => p.genero_atribuido).length;
  return {
    indicacoes: distintos(linhas, (l) => `${l.ano}|${l.nome_original}|${l.obra_id}`),
    pessoas: n,
    obras: distintos(linhas, (l) => l.obra_id),
    mulheres, pctMulheres: pct(mulheres, n), generoAtribuido,
    negras, pctNegrasPiso: pct(negras, n),
    comRaca, pctCoberturaRaca: pct(comRaca, n),
    buscaParcial, pctBuscaCompleta: pct(n - buscaParcial, n),
    ufs: new Set(pessoas.map((p) => p.uf_nascimento).filter((u) => u && u !== "EX")).size,
    editoras: new Set(linhas.map((l) => l.editora).filter(Boolean)).size,
  };
}

// Composição por edição (100%), etapa 'lista' ou 'premiada'. Edições sem linhas não aparecem (o gráfico marca lacuna).
export function composicao(linhas, dim, etapa = "lista") {
  const teste = ETAPAS.find((e) => e.id === etapa).teste;
  const sel = linhas.filter(teste);
  const out = [];
  for (const [ano, doAno] of groupBy(sel, (l) => l.ano)) {
    const total = doAno.length;
    for (const [g, n] of contar(doAno, (l) => grupo(l, dim))) out.push({ ano, grupo: g, n, total, pct: pct(n, total) });
  }
  return ordenar(out, dim);
}

export function funil(linhas, dim) {
  const out = [];
  for (const e of ETAPAS) {
    const sel = linhas.filter(e.teste);
    if (!sel.length) continue;
    const cont = contar(sel, (l) => grupo(l, dim));
    for (const g of ORDEM[dim]) {
      const n = cont.get(g) ?? 0;
      out.push({ etapa: e.id, rotulo: e.rotulo, grupo: g, n, total: sel.length, pct: pct(n, sel.length) });
    }
  }
  return out;
}

export const FALTANTES = new Set(["nao_identificado", "sem_declaracao", "sem dado"]);

// Maior queda (em pontos percentuais) entre lista e vencedoras, para o texto-resumo do funil.
// Categorias de dado faltante não são grupos: ficam fora do destaque.
export function maiorQueda(f) {
  const por = (etapa) => new Map(f.filter((x) => x.etapa === etapa).map((x) => [x.grupo, x]));
  const lista = por("lista"), venc = por("vencedora");
  let pior = null;
  for (const [g, a] of lista) {
    const b = venc.get(g);
    if (!b || a.n === 0 || FALTANTES.has(g)) continue;
    const queda = a.pct - b.pct;
    if (!pior || queda > pior.queda) pior = { grupo: g, de: a.pct, para: b.pct, queda, nLista: a.n, nVenc: b.n };
  }
  return pior;
}

// Índice de dissimilaridade de Duncan entre mulheres e homens ao longo das categorias (Livro do Ano fora).
export function duncan(linhas) {
  const sel = linhas.filter((l) => l.categoria !== "Livro do Ano" && (l.genero === "mulher" || l.genero === "homem"));
  const M = sel.filter((l) => l.genero === "mulher").length;
  const H = sel.length - M;
  if (!M || !H) return { D: null, mulheres: M, homens: H };
  let soma = 0;
  for (const [, doCat] of groupBy(sel, (l) => l.categoria)) {
    const m = doCat.filter((l) => l.genero === "mulher").length;
    soma += Math.abs(m / M - (doCat.length - m) / H);
  }
  return { D: soma / 2, mulheres: M, homens: H };
}

export const INDICADORES = [
  { id: "mulheres", rotulo: "% mulheres", teste: (l) => l.genero === "mulher" },
  { id: "negras", rotulo: "% negras (piso)", teste: (l) => !!l.negra },
  { id: "nordeste", rotulo: "% Nordeste", teste: (l) => l.regiao_nascimento === "Nordeste" },
  { id: "sudeste", rotulo: "% Sudeste", teste: (l) => l.regiao_nascimento === "Sudeste" },
];

export function segregacao(linhas) {
  const out = [];
  for (const [categoria, doCat] of groupBy(linhas, (l) => l.categoria)) {
    for (const ind of INDICADORES) {
      const n = doCat.filter(ind.teste).length;
      out.push({ categoria, indicador: ind.rotulo, n, total: doCat.length, pct: pct(n, doCat.length) });
    }
  }
  return out;
}

export function editoras(linhas, top = 15) {
  const porObra = [...new Map(linhas.filter((l) => l.papel === "autor").map((l) => [`${l.ano}|${l.nome_original}|${l.obra_id}`, l])).values()];
  const m = new Map();
  for (const l of porObra) {
    const nome = l.editora ?? "Editora não informada";
    const r = m.get(nome) ?? { editora: nome, grupo: l.grupo_editorial ?? null, premiadas: 0, outras: 0 };
    l.premiada ? r.premiadas++ : r.outras++;
    m.set(nome, r);
  }
  return [...m.values()].map((r) => ({ ...r, total: r.premiadas + r.outras }))
    .sort((a, b) => b.total - a.total || a.editora.localeCompare(b.editora)).slice(0, top);
}

// Indicações (obras) de editoras de grupos editoriais vs independentes, na lista e entre premiadas.
export function gruposEditoriais(linhas) {
  const porObra = [...new Map(linhas.filter((l) => l.papel === "autor" && l.editora).map((l) => [`${l.ano}|${l.nome_original}|${l.obra_id}`, l])).values()];
  const tipo = (l) => (l.grupo_editorial ? "Grupos editoriais" : "Independentes");
  const out = [];
  for (const [etapa, sel] of [["Lista", porObra], ["Premiadas", porObra.filter((l) => l.premiada)]]) {
    const cont = contar(sel, tipo);
    for (const t of ["Grupos editoriais", "Independentes"]) out.push({ etapa, tipo: t, n: cont.get(t) ?? 0, total: sel.length, pct: pct(cont.get(t) ?? 0, sel.length) });
  }
  return out;
}

export function porUF(linhas, ufs) {
  const pessoasPorUF = contar(porPessoa(linhas).filter((p) => p.uf_nascimento), (p) => p.uf_nascimento);
  const partPorUF = contar(linhas.filter((l) => l.uf_nascimento), (l) => l.uf_nascimento);
  return ufs.filter((u) => u.uf !== "EX").map((u) => ({
    uf: u.uf, nome: u.nome, regiao: u.regiao,
    pessoas: pessoasPorUF.get(u.uf) ?? 0,
    participacoes: partPorUF.get(u.uf) ?? 0,
    porMilhao: u.populacao_2022 ? ((pessoasPorUF.get(u.uf) ?? 0) * 1e6) / u.populacao_2022 : null,
  }));
}

export function sankey(linhas, ufs) {
  const regiaoDe = new Map(ufs.map((u) => [u.uf, u.regiao]));
  const cont = new Map();
  for (const l of linhas) {
    const a = `Nasc.: ${l.regiao_nascimento ?? "sem dado"}`;
    const b = `Editora: ${regiaoDe.get(l.uf_editora) ?? "sem dado"}`;
    const c = l.premiada ? "Premiada" : "Não premiada";
    for (const k of [`${a}\u0000${b}`, `${b}\u0000${c}`]) cont.set(k, (cont.get(k) ?? 0) + 1);
  }
  const links = [...cont].map(([k, value]) => { const [source, target] = k.split("\u0000"); return { source, target, value }; });
  const nodes = [...new Set(links.flatMap((l) => [l.source, l.target]))].map((id) => ({ id }));
  return { nodes, links };
}

export function idades(linhas) {
  return linhas.filter((l) => l.idade_no_premio != null).map((l) => ({
    idade: l.idade_no_premio, genero: l.genero, nome: l.nome, titulo: l.titulo, ano: l.ano, categoria: l.categoria, premiada: !!l.premiada,
  }));
}

export function mediana(valores) {
  const v = [...valores].sort((a, b) => a - b);
  if (!v.length) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Júri × lista × vencedoras por edição com júri coletado (CA-10.1).
export function juri(linhas, jurados, pessoas, ufs) {
  const regiaoDe = new Map(ufs.map((u) => [u.uf, u.regiao]));
  const pessoa = new Map(pessoas.map((p) => [p.id, p]));
  const perfil = (lista) => {
    const n = lista.length;
    const comUF = lista.filter((p) => p.uf_nascimento);
    return [
      { indicador: "% mulheres", n: lista.filter((p) => p.genero === "mulher").length, total: n },
      { indicador: "% negras (piso)", n: lista.filter((p) => ["preta", "parda", "negra"].includes(p.raca)).length, total: n },
      { indicador: "% fora do Sudeste", n: comUF.filter((p) => regiaoDe.get(p.uf_nascimento) !== "Sudeste").length, total: comUF.length },
    ].map((x) => ({ ...x, pct: pct(x.n, x.total) }));
  };
  const out = [];
  for (const ano of [...new Set(jurados.map((j) => j.ano))].sort()) {
    const doAno = linhas.filter((l) => l.ano === ano && l.papel === "autor");
    const grupos = [
      ["Júri", [...new Set(jurados.filter((j) => j.ano === ano).map((j) => j.pessoa_id))].map((id) => pessoa.get(id)).filter(Boolean)],
      ["Lista", porPessoa(doAno).map((l) => pessoa.get(l.pessoa_id)).filter(Boolean)],
      ["Vencedoras", porPessoa(doAno.filter((l) => l.vencedora)).map((l) => pessoa.get(l.pessoa_id)).filter(Boolean)],
    ];
    for (const [quem, lista] of grupos) for (const x of perfil(lista)) out.push({ ano, quem, ...x });
  }
  return out;
}

export function resumoPessoas(linhas, pessoas) {
  const part = groupBy(linhas, (l) => l.pessoa_id);
  return pessoas.filter((p) => part.has(p.id)).map((p) => {
    const ls = part.get(p.id);
    return { ...p, participacoes: ls.length, premios: ls.filter((l) => l.premiada).length, vitorias: ls.filter((l) => l.vencedora).length, linhas: ls };
  });
}

// Ranking de pessoas (RF-23): por prêmios (pódio), 1º lugares ou indicações. Empate na medida desempata pelas outras e pelo
// nome; a posição é de competição (1, 2, 2, 4) e só olha a medida escolhida.
export const MEDIDAS_RANKING = { premios: ["premios", "vitorias", "participacoes"], vitorias: ["vitorias", "premios", "participacoes"],
  participacoes: ["participacoes", "premios", "vitorias"] };
export function ranking(linhas, pessoas, medida = "premios", n = 20) {
  const ordem = MEDIDAS_RANKING[medida];
  const lista = resumoPessoas(linhas, pessoas).filter((p) => p[medida] > 0)
    .sort((a, b) => ordem.reduce((r, k) => r || b[k] - a[k], 0) || a.nome.localeCompare(b.nome, "pt-BR"));
  let pos = 0;
  return lista.map(({ linhas: _, ...p }, i) => ({ ...p, posicao: i && lista[i - 1][medida] === p[medida] ? pos : (pos = i + 1) }))
    .filter((p) => p.posicao <= n);
}

function groupBy(arr, chave) {
  const m = new Map();
  for (const x of arr) { const k = chave(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}

function ordenar(arr, dim) {
  const ordem = ORDEM[dim];
  return arr.sort((a, b) => a.ano - b.ano || ordem.indexOf(a.grupo) - ordem.indexOf(b.grupo));
}

// ---------- interface narrativa (spec RF-11, RF-16, RF-17; design D15) ----------

const porPessoaAgreg = (linhas) => {
  const m = new Map();
  for (const l of linhas) {
    const p = m.get(l.pessoa_id) ?? { ...l, premiada: false, vencedora: false, n: 0 };
    p.premiada ||= !!l.premiada;
    p.vencedora ||= !!l.vencedora;
    p.n++;
    m.set(l.pessoa_id, p);
  }
  return [...m.values()];
};

// Um ponto por pessoa para a história guiada, com os grupos de cada dimensão e o melhor resultado.
export function pontosHistoria(linhas) {
  return porPessoaAgreg(linhas).map((p) => ({
    id: p.pessoa_id, nome: p.nome, genero: p.genero, raca: grupo(p, "raca"), regiao: grupo(p, "regiao"),
    etapa: p.vencedora ? "vencedora" : p.premiada ? "premiada" : "lista", participacoes: p.n,
  }));
}

// Números da narrativa (CA-16.2): sempre calculados, com n e total.
export function historia(linhas) {
  const ps = pontosHistoria(linhas);
  const n = ps.length;
  const conta = (f, base = ps) => base.filter(f).length;
  const venc = ps.filter((p) => p.etapa === "vencedora");
  const prem = ps.filter((p) => p.etapa !== "lista");
  const comUF = ps.filter((p) => !FALTANTES.has(p.regiao) && p.regiao !== "Exterior");
  const ufs = contar(porPessoa(linhas).filter((l) => l.uf_nascimento && l.uf_nascimento !== "EX"), (l) => l.uf_nascimento);
  const [topUF, topN] = [...ufs].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [null, 0];
  const g = (base) => ({
    mulheres: conta((p) => p.genero === "mulher", base), homens: conta((p) => p.genero === "homem", base),
    naoBinarias: conta((p) => p.genero === "nao_binario", base), semGenero: conta((p) => p.genero === "nao_identificado", base),
  });
  const gt = g(ps), gv = g(venc), gp = g(prem);
  const negras = conta((p) => p.raca === "negra");
  const sudeste = conta((p) => p.regiao === "Sudeste", comUF);
  return {
    pessoas: n,
    indicacoes: distintos(linhas, (l) => `${l.ano}|${l.nome_original}|${l.obra_id}`),
    edicoes: distintos(linhas, (l) => l.ano),
    genero: { ...gt, pctMulheres: pct(gt.mulheres, n), atribuido: porPessoa(linhas).filter((l) => l.genero_atribuido).length },
    premiadas: { pessoas: prem.length, mulheres: gp.mulheres, pctMulheres: pct(gp.mulheres, prem.length) },
    vencedoras: { pessoas: venc.length, ...gv, pctMulheres: pct(gv.mulheres, venc.length) },
    raca: {
      negras, pctNegras: pct(negras, n), indigenas: conta((p) => p.raca === "indigena"),
      declaradas: conta((p) => p.raca !== "sem_declaracao"), semDeclaracao: conta((p) => p.raca === "sem_declaracao"),
      negrasVencedoras: conta((p) => p.raca === "negra", venc),
    },
    regiao: {
      comUF: comUF.length, sudeste, pctSudeste: pct(sudeste, comUF.length),
      exterior: conta((p) => p.regiao === "Exterior"), semDado: conta((p) => p.regiao === "sem dado"),
      por: Object.fromEntries(ORDEM.regiao.map((r) => [r, conta((p) => p.regiao === r)])),
    },
    topUF: { uf: topUF, pessoas: topN },
  };
}

// Composição da lista por edição (CA-17.2): participações, com n e total.
export function porEdicao(linhas) {
  return [...groupBy(linhas, (l) => l.ano)].sort((a, b) => a[0] - b[0]).map(([ano, ls]) => {
    const comUF = ls.filter((l) => l.regiao_nascimento && l.regiao_nascimento !== "Exterior");
    const m = ls.filter((l) => l.genero === "mulher").length;
    const ng = ls.filter((l) => l.negra).length;
    const sud = comUF.filter((l) => l.regiao_nascimento === "Sudeste").length;
    return {
      ano, total: ls.length, mulheres: m, pctMulheres: pct(m, ls.length), negras: ng, pctNegras: pct(ng, ls.length),
      comUF: comUF.length, sudeste: sud, pctSudeste: pct(sud, comUF.length),
    };
  });
}

// Obras vencedoras (1º lugar) por edição e categoria, com autoria (CA-17.1).
export function vencedorasPorAno(linhas, ordemCategorias = []) {
  const obras = new Map();
  for (const l of linhas.filter((x) => x.vencedora)) {
    const k = `${l.ano}|${l.categoria}|${l.obra_id}`;
    const o = obras.get(k) ?? { ano: l.ano, categoria: l.categoria, obra_id: l.obra_id, titulo: l.titulo, editora: l.editora, pessoas: [] };
    if (!o.pessoas.some((p) => p.id === l.pessoa_id)) o.pessoas.push({ id: l.pessoa_id, nome: l.nome });
    obras.set(k, o);
  }
  const ordem = (c) => ordemCategorias.indexOf(c) + 1 || 99;
  return [...obras.values()].sort((a, b) => a.ano - b.ano || ordem(a.categoria) - ordem(b.categoria) || String(a.titulo).localeCompare(b.titulo));
}

// Avatar neutro (CA-11.3): o matiz vem só do id, nunca de gênero, raça ou região.
export function corAvatar(id) {
  let h = 2166136261;
  for (const c of String(id)) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0;
  return h % 360;
}

export function iniciais(nome) {
  const partes = String(nome).replace(/\(.*?\)/g, "").split(/\s+/).filter((p) => p && !/^(d[aeo]s?|e|van|von|del?)$/i.test(p));
  if (!partes.length) return "?";
  return (partes[0][0] + (partes.length > 1 ? partes.at(-1)[0] : "")).toLocaleUpperCase("pt-BR");
}

// Anel de retratos (CA-11.5, D21): n círculos em anéis concêntricos ao redor de um miolo vazio, do anel de dentro para fora.
// Devolve o diâmetro d, o raio do miolo, o raio externo e as posições (x, y) relativas ao centro.
export function anel(n, largura) {
  const W = Math.max(260, largura);
  const montar = (d) => {
    const folga = Math.max(3, d * 0.14), passo = d + folga, miolo = Math.max(84, W * 0.24); // miolo largo: o resumo cabe com folga
    const pos = [];
    let r = miolo + d / 2, aneis = 0;
    while (pos.length < n) {
      const k = Math.min(Math.floor((2 * Math.PI * r) / passo), n - pos.length);
      for (let i = 0; i < k; i++) {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / k + (aneis % 2 ? Math.PI / k : 0); // anéis alternados defasados
        pos.push({ x: r * Math.cos(a), y: r * Math.sin(a), anel: aneis });
      }
      r += passo;
      aneis++;
    }
    return { d, miolo, raio: (n ? r - passo : miolo) + d / 2, pos };
  };
  for (let d = Math.min(68, W / 5); d > 18; d -= 1) { // poucos retratos numa tela estreita: até W/5 (alvo de toque, CA-11.7)
    const a = montar(d);
    if (a.raio * 2 <= W) return a;
  }
  return montar(18);
}

// Quantas pessoas cabem no anel com retratos de pelo menos dMin px (alvo de toque, CA-11.7). anel(n).d só cai quando n cresce.
export function capacidadeAnel(largura, dMin = 44, max = 100) {
  let lo = 1, hi = max;
  while (lo < hi) { const m = Math.ceil((lo + hi) / 2); if (anel(m, largura).d >= dMin) lo = m; else hi = m - 1; }
  return lo;
}

// Filtro de uma parte na URL (CA-02.2, D22): "ini-fim" + "~cat1,cat2" (se não forem todas) + "~todos" (autores e ilustradores).
// Texto vazio = padrão; valores fora do recorte voltam ao padrão.
export function filtroDeTexto(texto, [a0, a1], cats) {
  const [anos = "", ...resto] = String(texto ?? "").split("~");
  const [i, f] = anos.split("-").map(Number);
  const anoIni = i >= a0 && i <= a1 ? i : a0;
  const anoFim = Math.max(anoIni, f >= a0 && f <= a1 ? f : a1);
  const lista = resto.find((r) => r && r !== "todos")?.split(",").filter((c) => cats.includes(c));
  return { anoIni, anoFim, categorias: lista?.length ? lista : [...cats], papel: resto.includes("todos") ? "todos" : "autor" };
}
export function filtroParaTexto(f, [a0, a1], cats) {
  const padraoAnos = f.anoIni === a0 && f.anoFim === a1, todasCats = f.categorias.length === cats.length;
  if (padraoAnos && todasCats && f.papel !== "todos") return "";
  return [`${f.anoIni}-${f.anoFim}`, todasCats ? null : f.categorias.join(","), f.papel === "todos" ? "todos" : null].filter(Boolean).join("~");
}

// ---------- busca determinística (RF-21, D23) ----------
const TIPOS_BUSCA = ["Pessoa", "Livro", "Estado", "Região", "Editora", "Categoria", "Edição", "Gráfico", "Seção"];
export const normalizar = (s) => String(s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
const DESTINOS = [
  ["Gráfico", "Linha do tempo", "composição de cada edição e vencedoras", "#/grafico/linha-do-tempo"],
  ["Gráfico", "Mapa", "UF de nascimento e fluxo região → editora → resultado", "#/grafico/geografia", "geografia estados sankey"],
  ["Gráfico", "Evolução", "composição por edição", "#/grafico/evolucao"],
  ["Gráfico", "Funil", "lista → finalistas → premiadas → vencedoras", "#/grafico/funil", "teto de vidro"],
  ["Gráfico", "Categorias", "índice de Duncan", "#/grafico/segregacao", "segregação"],
  ["Gráfico", "Idade", "idade no ano do prêmio", "#/grafico/idade"],
  ["Gráfico", "Editoras", "mais indicadas; grupos e independentes", "#/grafico/editoras"],
  ["Gráfico", "Júri", "quem julga e quem vence", "#/grafico/juri", "jurados"],
  ["Seção", "História guiada", "a narrativa em passos", "#historia"],
  ["Seção", "Panorama", "o recorte em números", "#panorama"],
  ["Seção", "Autores", "anel de retratos", "#autores", "pessoas galeria"],
  ["Seção", "Método", "como os dados foram feitos", "metodo.html", "metodologia cobertura"],
  ["Seção", "Referências", "fontes por domínio", "metodo.html#referencias", "fontes"],
];

export function indiceBusca(D) {
  const ls = D.participacao.filter((l) => l.papel !== "organizador");
  const porPessoaId = groupBy(ls, (l) => l.pessoa_id), porObra = groupBy(ls, (l) => l.obra_id);
  const jurados = new Set(D.jurados.map((j) => j.pessoa_id));
  const e = [];
  const add = (tipo, rotulo, sub, href, extra = "") => e.push({ tipo, rotulo, sub, href, nome: normalizar(rotulo), chave: normalizar(`${rotulo} ${extra}`) });
  for (const p of D.pessoas) {
    const pl = porPessoaId.get(p.id);
    if (!pl && !jurados.has(p.id)) continue;
    const n = new Set((pl ?? []).map((l) => `${l.ano}|${l.nome_original}|${l.obra_id}`)).size;
    add("Pessoa", p.nome, [p.uf_nascimento, p.ano_nascimento, n ? `${n} indicaç${n > 1 ? "ões" : "ão"}` : "jurado(a)"].filter(Boolean).join(" · "), `#/pessoa/${p.id}`);
  }
  for (const o of D.obras) {
    const ol = porObra.get(o.id);
    if (!ol) continue;
    const autores = [...new Set(ol.filter((l) => l.papel === "autor").map((l) => l.nome))];
    const edicoes = [...new Set(ol.map((l) => `${l.categoria} ${l.ano}`))];
    add("Livro", o.titulo, [autores.join(", "), edicoes.join(", ")].filter(Boolean).join(" · "), `#/obra/${o.id}`, autores.join(" "));
  }
  const ufs = D.ufs.filter((u) => u.uf !== "EX");
  for (const u of ufs) add("Estado", u.nome, `${u.uf} · ${u.regiao}`, `#/uf/${u.uf}`, u.uf);
  for (const r of [...new Set(ufs.map((u) => u.regiao))]) add("Região", r, `${ufs.filter((u) => u.regiao === r).length} UFs`, `#/regiao/${encodeURIComponent(r)}`);
  const obrasPorEditora = groupBy(D.obras.filter((o) => porObra.has(o.id)), (o) => o.editora_id);
  for (const ed of D.editoras) {
    const n = obrasPorEditora.get(ed.id)?.length;
    if (n) add("Editora", ed.nome, [`${n} obra${n > 1 ? "s" : ""}`, ed.municipio_sede && `sede: ${ed.municipio_sede}${ed.uf_sede ? `/${ed.uf_sede}` : ""}`, ed.grupo].filter(Boolean).join(" · "), "#/grafico/editoras", ed.grupo ?? "");
  }
  for (const c of [...new Set(D.categorias.map((c) => c.categoria))]) add("Categoria", c, "gráfico de categorias", "#/grafico/segregacao");
  for (const a of D.anos_coletados) add("Edição", `Jabuti ${a}`, a <= 2017 ? "pódio de 1º a 3º" : a === 2018 ? "transição: só 1º lugar" : "finalistas e vencedor único", "#/grafico/linha-do-tempo", String(a));
  for (const [tipo, rotulo, sub, href, extra] of DESTINOS) add(tipo, rotulo, sub, href, extra);
  return e;
}

// Pontuação: 0 nome exato · 1 começo do nome · 2 começo de palavra · 3 toda palavra digitada começa uma palavra do nome ·
// 4 trecho do nome · 5 só nos termos extras (ex.: livro achado pelo nome do autor). Desempate: tipo, tamanho, ordem alfabética.
export function buscar(indice, termo, n = 12) {
  const t = normalizar(termo);
  if (!t) return [];
  const toks = t.split(" ");
  const res = [];
  for (const e of indice) {
    if (!toks.every((k) => e.chave.includes(k))) continue;
    const palavras = e.nome.split(/[^a-z0-9]+/).filter(Boolean);
    const s = e.nome === t ? 0 : e.nome.startsWith(t) ? 1 : ` ${e.nome}`.includes(` ${t}`) ? 2
      : toks.every((k) => palavras.some((w) => w.startsWith(k))) ? 3 : toks.every((k) => e.nome.includes(k)) ? 4 : 5;
    res.push([s, e]);
  }
  return res.sort(([sa, a], [sb, b]) => sa - sb || TIPOS_BUSCA.indexOf(a.tipo) - TIPOS_BUSCA.indexOf(b.tipo)
    || a.rotulo.length - b.rotulo.length || a.rotulo.localeCompare(b.rotulo, "pt-BR")).slice(0, n).map(([, e]) => e);
}

// ---------- perfil de UF ou região (RF-22, D23) ----------
// Sobre as linhas do recorte completo de autores; base da parcela = participações com UF conhecida no Brasil.
export function perfilLugar(linhas, pred) {
  const brasil = linhas.filter((l) => l.uf_nascimento && l.uf_nascimento !== "EX");
  const dentro = brasil.filter(pred);
  const k = kpis(dentro);
  const pessoasBR = distintos(brasil, (l) => l.pessoa_id);
  const fatia = (chave) => [...groupBy(brasil, chave)].map(([g, ls]) => {
    const n = ls.filter(pred).length;
    return { grupo: g, n, total: ls.length, pct: pct(n, ls.length) };
  });
  return {
    ...k, pessoasBR, parcela: pct(k.pessoas, pessoasBR),
    premiadas: distintos(dentro.filter((l) => l.premiada), (l) => l.pessoa_id),
    vencedoras: distintos(dentro.filter((l) => l.vencedora), (l) => l.pessoa_id),
    porAno: fatia((l) => l.ano).map(({ grupo, ...r }) => ({ ano: grupo, ...r })).sort((a, b) => a.ano - b.ano),
    porCategoria: fatia((l) => l.categoria).map(({ grupo, ...r }) => ({ categoria: grupo, ...r })).sort((a, b) => b.pct - a.pct || a.categoria.localeCompare(b.categoria)),
  };
}
