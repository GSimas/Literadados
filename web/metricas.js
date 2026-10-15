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
      (papel === "todos" || l.papel === papel)
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
  return {
    indicacoes: distintos(linhas, (l) => `${l.ano}|${l.nome_original}|${l.obra_id}`),
    pessoas: n,
    obras: distintos(linhas, (l) => l.obra_id),
    mulheres, pctMulheres: pct(mulheres, n),
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

function groupBy(arr, chave) {
  const m = new Map();
  for (const x of arr) { const k = chave(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
  return m;
}

function ordenar(arr, dim) {
  const ordem = ORDEM[dim];
  return arr.sort((a, b) => a.ano - b.ano || ordem.indexOf(a.grupo) - ordem.indexOf(b.grupo));
}
