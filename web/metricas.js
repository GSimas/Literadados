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

// Marcos de cada prêmio (CA-04.3, CA-26.10): só aparecem os dos prêmios do recorte (marcosDe).
export const MARCOS = [
  { premio: "jabuti", ano: 1993, texto: "Pódio de 1º a 3º" },
  { premio: "jabuti", ano: 2000, texto: "Listas públicas" },
  { premio: "jabuti", ano: 2018, texto: "Reforma: só o 1º lugar" },
  { premio: "jabuti", ano: 2020, texto: "Romance Literário" },
  { premio: "jabuti", ano: 2021, texto: "CBL coleta raça" },
  // Oceanos (fontes em dados/coleta/oceanos/LEIA.md); a 1ª edição (2003) vem de premios.ano_inicio.
  { premio: "oceanos", ano: 2007, texto: "Língua portuguesa" },
  { premio: "oceanos", ano: 2012, texto: "Três categorias" },
  { premio: "oceanos", ano: 2015, texto: "Vira Oceanos" },
  { premio: "oceanos", ano: 2017, texto: "Livros de qualquer país" },
  { premio: "oceanos", ano: 2023, texto: "Prosa e Poesia" },
  // São Paulo de Literatura (fontes em dados/coleta/sao-paulo/LEIA.md)
  { premio: "sao-paulo", ano: 2013, texto: "Estreia por idade" },
  { premio: "sao-paulo", ano: 2019, texto: "Estreia unificada" },
  // Biblioteca Nacional (dados/coleta/biblioteca-nacional/LEIA.md)
  { premio: "biblioteca-nacional", ano: 2004, texto: "Prêmio único" },
  { premio: "biblioteca-nacional", ano: 2007, texto: "Glória Pondé (infantojuvenil)" },
  { premio: "biblioteca-nacional", ano: 2009, texto: "Pódio de 1º a 3º" },
  { premio: "biblioteca-nacional", ano: 2012, texto: "Sylvia Orthof; só o vencedor" },
  { premio: "biblioteca-nacional", ano: 2017, texto: "3 finalistas" },
  { premio: "biblioteca-nacional", ano: 2018, texto: "Pódio de novo" },
  // Sesc (dados/coleta/sesc/LEIA.md): originais inéditos de estreantes
  { premio: "sesc", ano: 2006, texto: "Categoria Conto" },
  { premio: "sesc", ano: 2024, texto: "Categoria Poesia" },
];
// Formato do pódio de cada prêmio, para textos que juntam ou comparam prêmios (sempre ditos com o nome do prêmio, DA-5).
export const FORMATOS = {
  jabuti: "até 1992 havia um vencedor por categoria; de 1993 a 2017, pódio de 1º a 3º; desde 2018, só o 1º",
  sesc: "premia originais inéditos de autores estreantes (não livros publicados), com um vencedor por categoria: romance desde 2004, conto desde 2006 e poesia desde 2024",
  "biblioteca-nacional": "um vencedor por categoria até 2008 (em 2004, um prêmio único; em 2003, nenhum), pódio de 1º a 3º em 2009–2011, só o vencedor em 2012–2016, três finalistas em 2017 e pódio de novo desde 2018; só autores brasileiros, inscritos pelo próprio autor",
  "sao-paulo": "um vencedor por categoria, só romance: Melhor Romance do Ano e Melhor Romance de Estreia (de 2013 a 2018, a estreia dividida em até 40 e mais de 40 anos)",
  oceanos: "o pódio teve 3 ou 4 premiados até 2022 (de 2012 a 2014, um vencedor por categoria e o Grande Prêmio); desde 2023, um vencedor em prosa e outro em poesia",
};
// Marcos dos prêmios escolhidos (premios = null: todos). Com a lista da base (D.premios), cada prêmio criado depois do
// início da série ganha também o marco da 1ª edição (ano_inicio), vindo dos dados; o mais antigo já começa no eixo.
export const marcosDe = (premios, base = []) => {
  const sel = premios ?? [...new Set([...MARCOS.map((m) => m.premio), ...base.map((p) => p.id)])];
  const inicio0 = Math.min(...base.map((p) => p.ano_inicio ?? Infinity));
  const inicios = base.filter((p) => p.ano_inicio > inicio0 && sel.includes(p.id)).map((p) => ({ premio: p.id, ano: p.ano_inicio, texto: "1ª edição" }));
  return [...MARCOS.filter((m) => sel.includes(m.premio)), ...inicios.filter((i) => !MARCOS.some((m) => m.premio === i.premio && m.ano === i.ano))];
};

const pct = (n, d) => (d ? (100 * n) / d : null);
const contar = (arr, chave) => {
  const m = new Map();
  for (const x of arr) m.set(chave(x), (m.get(chave(x)) ?? 0) + 1);
  return m;
};
const distintos = (arr, chave) => new Set(arr.map(chave)).size;

// Junta ao dados.json as partes de outros prêmios (dados-<prêmio>.json, CA-26.14, build.dividir): cada parte traz a
// participação do prêmio e as pessoas, obras, editoras, mídias e capas que ainda não vieram. Devolve D (alterado).
export const CHAVES_PARTES = ["participacao", "pessoas", "obras", "editoras", "midia", "capas", "jurados", "categorias", "edicoes", "cobertura"];
export function juntar(D, partes = []) {
  for (const p of partes) for (const k of CHAVES_PARTES) if (p[k]?.length) D[k] = [...(D[k] ?? []), ...p[k]];
  return D;
}

// Remonta as linhas de v_participacao a partir do dados.json compacto (design D13).
// Só junções: as regras (regime, negra, premiada, vencedora) já vêm do SQL. A ordem das chaves é a da view.
export function expandir(D) {
  // Fonte "wd" no dados.json = página do Wikidata da própria pessoa (build._fontes_wd, RNF-06).
  for (const p of D.pessoas) for (const k of ["genero_fonte", "nascimento_fonte", "raca_fonte"]) if (p[k] === "wd") p[k] = `https://www.wikidata.org/wiki/${p.wikidata}`;
  const por = (arr, chave) => new Map(arr.map((x) => [chave(x), x]));
  // `premio` fica fora do JSON quando é o 1º de D.premios, só por economia (design D31; o painel abre com todos, DA-4).
  const padrao = D.premios?.[0]?.id ?? null, pr = (x) => x.premio ?? padrao;
  const premio = por(D.premios ?? [], (p) => p.id);
  const edicao = por(D.edicoes, (e) => `${pr(e)}|${e.ano}`);
  const categoria = por(D.categorias, (c) => `${pr(c)}|${c.ano}|${c.nome_original}`);
  const obra = por(D.obras, (o) => o.id);
  const editora = por(D.editoras, (e) => e.id);
  const pessoa = por(D.pessoas, (p) => p.id);
  const uf = por(D.ufs, (u) => u.uf);
  return D.participacao.map((l) => {
    const o = obra.get(l.obra_id);
    // Editora da indicação (CA-26.6): ausente = a da obra; "" = nenhuma conhecida nesta indicação (build.exportar).
    const e = l.editora_id === "" ? null : editora.get(l.editora_id ?? o.editora_id);
    const p = pessoa.get(l.pessoa_id);
    const p_ = pr(l);
    return {
      premio: p_,
      premio_nome: premio.get(p_)?.nome ?? null,
      ano: l.ano,
      regime: edicao.get(`${p_}|${l.ano}`).regime,
      categoria: categoria.get(`${p_}|${l.ano}|${l.nome_original}`).categoria,
      nome_original: l.nome_original,
      obra_id: l.obra_id,
      titulo: o.titulo,
      ano_publicacao: o.ano_publicacao ?? null,
      editora: e?.nome ?? null,
      grupo_editorial: e?.grupo ?? null,
      uf_editora: e?.uf_sede ?? null,
      pessoa_id: l.pessoa_id,
      nome: p.nome,
      papel: l.papel ?? "autor", // JSON omite "autor" e deriva premiada/vencedora da colocação (RNF-06)
      genero: p.genero,
      genero_atribuido: p.genero_evidencia === "atribuicao",
      raca: p.raca,
      raca_busca: p.raca_busca ?? null,
      negra: p.negra,
      uf_nascimento: p.uf_nascimento ?? null,
      pais_nascimento: p.uf_nascimento == null ? null : p.uf_nascimento === "EX" ? p.pais_nascimento ?? null : "BR", // DA-3
      regiao_nascimento: uf.get(p.uf_nascimento)?.regiao ?? null,
      idade_no_premio: p.ano_nascimento == null ? null : l.ano - p.ano_nascimento,
      lista_curta: l.lista_curta ?? null,
      colocacao: l.colocacao ?? null,
      premiada: l.colocacao != null,
      vencedora: l.colocacao === 1,
    };
  });
}

export function grupo(l, dim) {
  if (dim === "genero") return l.genero;
  if (dim === "raca") return l.negra ? "negra" : l.raca;
  return l.regiao_nascimento ?? "sem dado";
}

// Sem período, não corta anos: o padrão do painel é a série completa (CA-25.2, D30).
export function filtrar(linhas, { anoIni = -Infinity, anoFim = Infinity, categorias = null, papel = "autor", premios = null } = {}) {
  return linhas.filter(
    (l) =>
      l.ano >= anoIni && l.ano <= anoFim &&
      (!premios || premios.includes(l.premio)) && // CA-26.8
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
    indicacoes: distintos(linhas, (l) => `${l.premio}|${l.ano}|${l.nome_original}|${l.obra_id}`),
    pessoas: n,
    obras: distintos(linhas, (l) => l.obra_id),
    mulheres, pctMulheres: pct(mulheres, n), generoAtribuido,
    negras, pctNegrasPiso: pct(negras, n),
    comRaca, pctCoberturaRaca: pct(comRaca, n),
    buscaParcial, pctBuscaCompleta: pct(n - buscaParcial, n),
    ufs: new Set(pessoas.map((p) => p.uf_nascimento).filter((u) => u && u !== "EX")).size,
    // fora do Brasil (DA-3): pessoas e países distintos (país sem fonte não conta como país)
    exterior: pessoas.filter((p) => p.uf_nascimento === "EX").length,
    paises: new Set(pessoas.map((p) => p.pais_nascimento).filter((x) => x && x !== "BR")).size,
    editoras: new Set(linhas.map((l) => l.editora).filter(Boolean)).size,
    premios: distintos(linhas, (l) => l.premio), // CA-26.9: quantos prêmios entram no recorte
  };
}

// Rótulos do eixo de anos (CA-25.3): com dezenas de edições, só de 2 em 2, 5 em 5 ou 10 em 10 anos.
export const passoAnos = (n, largura = 900) => [1, 2, 5, 10].find((p) => (n / p) * 38 <= largura) ?? 10;

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

// Índice de dissimilaridade de Duncan entre mulheres e homens ao longo das categorias (Livro do Ano fora; a categoria
// única "Geral" também, porque não reparte ninguém entre gêneros literários).
export function duncan(linhas) {
  const sel = linhas.filter((l) => l.categoria !== "Livro do Ano" && l.categoria !== "Geral" && (l.genero === "mulher" || l.genero === "homem"));
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

// Indicações (obras) por editora. Obra sem editora conhecida (série histórica sem fonte da época) não é uma editora:
// fica fora da lista e é contada à parte por semEditora (CA-25.4).
const indicacoesDeAutor = (linhas) => [...new Map(linhas.filter((l) => l.papel === "autor").map((l) => [`${l.premio}|${l.ano}|${l.nome_original}|${l.obra_id}`, l])).values()];
export const semEditora = (linhas) => indicacoesDeAutor(linhas).filter((l) => !l.editora).length;
export function editoras(linhas, top = 15) {
  const m = new Map();
  for (const l of indicacoesDeAutor(linhas).filter((x) => x.editora)) {
    const nome = l.editora;
    const r = m.get(nome) ?? { editora: nome, grupo: l.grupo_editorial ?? null, premiadas: 0, outras: 0 };
    l.premiada ? r.premiadas++ : r.outras++;
    m.set(nome, r);
  }
  return [...m.values()].map((r) => ({ ...r, total: r.premiadas + r.outras }))
    .sort((a, b) => b.total - a.total || a.editora.localeCompare(b.editora)).slice(0, top);
}

// Indicações (obras) de editoras de grupos editoriais vs independentes, na lista e entre premiadas.
export function gruposEditoriais(linhas) {
  const porObra = [...new Map(linhas.filter((l) => l.papel === "autor" && l.editora).map((l) => [`${l.premio}|${l.ano}|${l.nome_original}|${l.obra_id}`, l])).values()];
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
    indicacoes: distintos(linhas, (l) => `${l.premio}|${l.ano}|${l.nome_original}|${l.obra_id}`),
    edicoes: distintos(linhas, (l) => `${l.premio}|${l.ano}`), // edição = prêmio + ano (CA-26.9)
    premios: distintos(linhas, (l) => l.premio),
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
    const k = `${l.premio}|${l.ano}|${l.categoria}|${l.obra_id}`;
    const o = obras.get(k) ?? { premio: l.premio, ano: l.ano, categoria: l.categoria, obra_id: l.obra_id, titulo: l.titulo, editora: l.editora, pessoas: [] };
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

// Filtro de uma parte na URL (CA-02.2, D22): "ini-fim" + "~cat1,cat2" (se não forem todas) + "~todos" (autores e ilustradores)
// + "~p:jabuti,oceanos" (prêmios, CA-26.8). Texto vazio = padrão: a série completa [a0, a1] (CA-25.2) e todos os prêmios de
// `premios` (DA-4); valores fora da série ou prêmios desconhecidos voltam ao padrão. Sem `premios`, o filtro não tem prêmio.
// padraoP: prêmios do padrão desta parte (todos, se não for dito outro).
export function filtroDeTexto(texto, [a0, a1], cats, premios = null, padraoP = premios) {
  const [anos = "", ...resto] = String(texto ?? "").split("~");
  const [i, f] = anos.split("-").map(Number);
  const anoIni = i >= a0 && i <= a1 ? i : a0;
  const anoFim = Math.max(anoIni, f >= a0 && f <= a1 ? f : a1);
  const lista = resto.find((r) => r && r !== "todos" && !r.startsWith("p:"))?.split(",").filter((c) => cats.includes(c));
  const f_ = { anoIni, anoFim, categorias: lista?.length ? lista : [...cats], papel: resto.includes("todos") ? "todos" : "autor" };
  if (!premios?.length) return f_;
  const ps = resto.find((r) => r.startsWith("p:"))?.slice(2).split(",").filter((p) => premios.includes(p));
  return { ...f_, premios: ps?.length ? premios.filter((p) => ps.includes(p)) : [...padraoP] };
}
// [a0, a1]: anos do padrão (a série completa); o que não muda o padrão não vai para a URL.
export function filtroParaTexto(f, [a0, a1], cats, premios = null, padraoP = premios) {
  const padraoAnos = f.anoIni === a0 && f.anoFim === a1, todasCats = f.categorias.length === cats.length;
  const padraoPremios = !premios?.length || !f.premios || (f.premios.length === padraoP.length && f.premios.every((p, i) => p === padraoP[i]));
  if (padraoAnos && todasCats && f.papel !== "todos" && padraoPremios) return "";
  return [`${f.anoIni}-${f.anoFim}`, todasCats ? null : f.categorias.join(","), f.papel === "todos" ? "todos" : null,
    padraoPremios ? null : `p:${f.premios.join(",")}`].filter(Boolean).join("~");
}

// Nascidas fora do Brasil, por país (DA-3): pessoas distintas, do maior para o menor; sem país conhecido = pais null.
// Também conta quem ainda não tem local de nascimento (semLocal).
export function porPais(linhas) {
  const pessoas = porPessoa(linhas), fora = pessoas.filter((p) => p.uf_nascimento === "EX");
  const paises = [...contar(fora, (p) => p.pais_nascimento ?? null)].map(([pais, pessoas]) => ({ pais, pessoas }))
    .sort((a, b) => (a.pais == null) - (b.pais == null) || b.pessoas - a.pessoas || String(a.pais).localeCompare(String(b.pais)));
  return { paises, fora: fora.length, semLocal: pessoas.filter((p) => !p.uf_nascimento).length };
}

// País de nascimento por extenso ("PT" → "Portugal"); sem país, "exterior" (DA-3).
const PAISES_PT = typeof Intl !== "undefined" && Intl.DisplayNames ? new Intl.DisplayNames(["pt-BR"], { type: "region" }) : null;
export function paisOuExterior(iso) { try { return (iso && PAISES_PT?.of(iso)) || iso || "exterior"; } catch { return iso; } }

// ---------- vários prêmios (RF-26) ----------
// Edições sem lista pública ("<prêmio>|<ano>"): todas as categorias, fora o Livro do Ano, só com premiados (CA-25.3, CA-26.4).
// D.categorias omite `premio` quando é o padrão.
export function edicoesSemLista(categorias, padrao = null) {
  const por = new Map();
  for (const c of categorias) {
    if (c.categoria === "Livro do Ano") continue;
    const k = `${c.premio ?? padrao}|${c.ano}`, sem = (c.etapa_lista ?? (c.vagas_lista == null ? "premiados" : "")) === "premiados";
    por.set(k, (por.get(k) ?? true) && sem);
  }
  return new Set([...por].filter(([, sem]) => sem).map(([k]) => k));
}
// Linhas separadas por prêmio, na ordem de `ordem` (a de D.premios); prêmio fora da ordem vai para o fim.
export function porPremio(linhas, ordem = []) {
  const m = new Map(ordem.map((p) => [p, []]));
  for (const l of linhas) { if (!m.has(l.premio)) m.set(l.premio, []); m.get(l.premio).push(l); }
  return new Map([...m].filter(([, ls]) => ls.length));
}
// Entre prêmios (CA-26.11): quem passou por mais de um prêmio do recorte, a sobreposição de cada par (com n) e a ordem
// em que cada pessoa chegou a cada prêmio. etapa: "lista" (qualquer indicação) ou "premiada" (pódio).
export function entrePremios(linhas, ordem = [], etapa = "premiada") {
  const sel = etapa === "premiada" ? linhas.filter((l) => l.premiada) : linhas;
  const ps = [...porPremio(sel, ordem).keys()];
  const porP = new Map(); // pessoa → prêmio → 1º ano naquela etapa
  for (const l of sel) {
    const m = porP.get(l.pessoa_id) ?? new Map();
    m.set(l.premio, Math.min(m.get(l.premio) ?? Infinity, l.ano));
    porP.set(l.pessoa_id, m);
  }
  const nome = new Map(sel.map((l) => [l.pessoa_id, l]));
  const pessoas = [...porP].filter(([, m]) => m.size > 1).map(([id, m]) => {
    const l = nome.get(id), ordemChegada = [...m].sort((a, b) => a[1] - b[1] || ps.indexOf(a[0]) - ps.indexOf(b[0]));
    return { pessoa_id: id, nome: l.nome, genero: l.genero, uf_nascimento: l.uf_nascimento, pais_nascimento: l.pais_nascimento,
      premios: ordemChegada.map(([p]) => p), anos: ordemChegada.map(([, a]) => a) };
  }).sort((a, b) => b.premios.length - a.premios.length || a.anos[0] - b.anos[0] || a.nome.localeCompare(b.nome, "pt-BR"));
  // Pares: quantas pessoas de A também estão em B (n) sobre o total de A (base), nos dois sentidos.
  const total = new Map(ps.map((p) => [p, [...porP.values()].filter((m) => m.has(p)).length]));
  const pares = ps.flatMap((a) => ps.filter((b) => b !== a).map((b) => {
    const n = [...porP.values()].filter((m) => m.has(a) && m.has(b)).length;
    return { de: a, para: b, n, total: total.get(a), pct: pct(n, total.get(a)) };
  }));
  return { premios: ps, total: Object.fromEntries(total), pessoas, pares };
}

// Aplica uma agregação a cada prêmio e marca as linhas do resultado com o prêmio (facetas, CA-26.9): taxas de prêmios
// diferentes nunca se somam. `fn` devolve uma lista de objetos.
export function facetar(linhas, fn, ordem = [], nomes = {}) {
  return [...porPremio(linhas, ordem)].flatMap(([p, ls]) => fn(ls).map((x) => ({ ...x, premio: p, premio_nome: nomes[p] ?? p })));
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
  // Vários prêmios (CA-26.12): edições e livros dizem de que prêmio são; "Prêmio Oceanos" → "Oceanos".
  // padrao: só para descompactar (o JSON omite o 1º prêmio da ordem); não é prêmio principal (DA-4).
  const premios = D.premios ?? [], padrao = premios[0]?.id, multi = premios.length > 1;
  const curto = (id) => (premios.find((p) => p.id === id)?.nome ?? id ?? "").replace(/^Prêmio\s+/, "");
  const e = [];
  const add = (tipo, rotulo, sub, href, extra = "") => e.push({ tipo, rotulo, sub, href, nome: normalizar(rotulo), chave: normalizar(`${rotulo} ${extra}`) });
  for (const p of D.pessoas) {
    const pl = porPessoaId.get(p.id);
    if (!pl && !jurados.has(p.id)) continue;
    const n = new Set((pl ?? []).map((l) => `${l.premio}|${l.ano}|${l.nome_original}|${l.obra_id}`)).size;
    add("Pessoa", p.nome, [p.uf_nascimento === "EX" ? paisOuExterior(p.pais_nascimento) : p.uf_nascimento, p.ano_nascimento, n ? `${n} indicaç${n > 1 ? "ões" : "ão"}` : "jurado(a)"].filter(Boolean).join(" · "), `#/pessoa/${p.id}`);
  }
  for (const o of D.obras) {
    const ol = porObra.get(o.id);
    if (!ol) continue;
    const autores = [...new Set(ol.filter((l) => l.papel === "autor").map((l) => l.nome))];
    const edicoes = [...new Set(ol.map((l) => `${multi ? `${curto(l.premio)} · ` : ""}${l.categoria} ${l.ano}`))];
    add("Livro", o.titulo, [autores.join(", "), edicoes.join(", ")].filter(Boolean).join(" · "), `#/obra/${o.id}`, autores.join(" "));
  }
  const ufs = D.ufs.filter((u) => u.uf !== "EX");
  for (const u of ufs) add("Estado", u.nome, `${u.uf} · ${u.regiao}`, `#/uf/${u.uf}`, u.uf);
  for (const r of [...new Set(ufs.map((u) => u.regiao))]) add("Região", r, `${ufs.filter((u) => u.regiao === r).length} UFs`, `#/regiao/${encodeURIComponent(r)}`);
  // Obras por editora da INDICAÇÃO (CA-26.6), como o gráfico de editoras: a edição portuguesa conta para a editora dela.
  const obrasPorEditora = new Map();
  for (const l of ls) if (l.editora) obrasPorEditora.set(l.editora, (obrasPorEditora.get(l.editora) ?? new Set()).add(l.obra_id));
  for (const ed of D.editoras) {
    const n = obrasPorEditora.get(ed.nome)?.size;
    if (n) add("Editora", ed.nome, [`${n} obra${n > 1 ? "s" : ""}`, ed.municipio_sede && `sede: ${ed.municipio_sede}${ed.uf_sede ? `/${ed.uf_sede}` : ""}`, ed.grupo].filter(Boolean).join(" · "), `#/editora/${ed.id}`, ed.grupo ?? ""); // perfil da editora (CA-29.2)
  }
  for (const c of [...new Set(D.categorias.map((c) => c.categoria))]) add("Categoria", c, "gráfico de categorias", "#/grafico/segregacao");
  // Edições com dados de cada prêmio; o Jabuti mantém a descrição curta do formato, os outros mostram o regime da edição.
  const rotJabuti = (a) => (a <= 1992 ? "um vencedor por categoria" : a <= 2017 ? "pódio de 1º a 3º" : a === 2018 ? "transição: só 1º lugar" : "finalistas e vencedor único");
  const regime = new Map((D.edicoes ?? []).map((x) => [`${x.premio ?? padrao}|${x.ano}`, x.regime]));
  const comDados = [...new Set(ls.map((l) => `${l.premio ?? padrao}|${l.ano}`))].map((k) => k.split("|")).sort((a, b) => a[1] - b[1]);
  for (const [p, a] of comDados.length ? comDados : D.anos_coletados.map((a) => [padrao, String(a)])) {
    // A edição abre o perfil da edição (CA-28.1), que diz de que prêmio é (CA-26.12).
    add("Edição", `${curto(p)} ${a}`, p === "jabuti" ? rotJabuti(+a) : regime.get(`${p}|${a}`) ?? "", `#/edicao/${p}/${a}`, a);
  }
  for (const [tipo, rotulo, sub, href, extra] of DESTINOS) add(tipo, rotulo, sub, href, extra);
  if (multi) add("Gráfico", "Entre prêmios", "quem passa por mais de um prêmio", "#/grafico/entre-premios", "sobreposicao premios");
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

// ---------- perfil de edição (RF-28, CA-28.2) ----------
// Números de uma edição (prêmio + ano) com as regras da história: só autores, pessoas distintas, % sobre todas as pessoas,
// negras = piso, Sudeste sobre quem tem UF no Brasil. As mesmas contas estão em seo.py (paridade testada).
export function resumoEdicao(autores) {
  const ps = [...new Map(autores.map((l) => [l.pessoa_id, l])).values()];
  const n = ps.length, mulheres = ps.filter((p) => p.genero === "mulher").length, negras = ps.filter((p) => p.negra).length;
  const comUF = ps.filter((p) => p.regiao_nascimento && p.regiao_nascimento !== "Exterior");
  const sudeste = comUF.filter((p) => p.regiao_nascimento === "Sudeste").length;
  return {
    pessoas: n, mulheres, pctMulheres: pct(mulheres, n), negras, pctNegras: pct(negras, n),
    comUF: comUF.length, sudeste, pctSudeste: pct(sudeste, comUF.length),
    generoAtribuido: ps.filter((p) => p.genero_atribuido).length, semDeclaracao: ps.filter((p) => p.raca === "sem_declaracao").length,
  };
}

// Ordem padrão das categorias (a mesma de ui.ORDEM_CATEGORIAS e de seo.py); categoria desconhecida vai para o fim, em ordem alfabética.
const ORDEM_CAT = ["Romance", "Contos", "Crônica", "Prosa", "Poesia", "Infantil", "Juvenil", "Infantil e Juvenil", "Geral", "Livro do Ano"];
const posCat = (c) => (ORDEM_CAT.includes(c) ? ORDEM_CAT.indexOf(c) : ORDEM_CAT.length);
const ordemCategoria = (a, b) => posCat(a) - posCat(b) || a.localeCompare(b, "pt-BR");
// Dentro da mesma categoria, a lista de estreantes vem depois da principal (São Paulo: Melhor Romance do Ano, depois Estreia).
const estreia = (n) => (/estrei/i.test(n) ? 1 : 0);

export function perfilEdicao(linhas, premio, ano) {
  const doPremio = linhas.filter((l) => l.premio === premio);
  const daEd = doPremio.filter((l) => l.ano === ano);
  if (!daEd.length) return null;
  const autores = (ls) => ls.filter((l) => l.papel === "autor");
  const anos = [...new Set(doPremio.map((l) => l.ano))].sort((a, b) => a - b);
  const i = anos.indexOf(ano), anterior = anos[i - 1] ?? null, seguinte = anos[i + 1] ?? null;
  // Composição em pessoas distintas, por etapa (lista inteira e só premiadas) e dimensão.
  const composicao = [];
  for (const etapa of ["lista", "premiada"]) {
    const sel = autores(daEd).filter(ETAPAS.find((e) => e.id === etapa).teste);
    const ps = [...new Map(sel.map((l) => [l.pessoa_id, l])).values()];
    for (const dim of ["genero", "raca", "regiao"]) {
      const c = contar(ps, (p) => grupo(p, dim));
      for (const g of ORDEM[dim]) if (c.get(g)) composicao.push({ etapa, dim, grupo: g, n: c.get(g), total: ps.length, pct: pct(c.get(g), ps.length) });
    }
  }
  const pessoaDe = (ls, papel) => [...new Map(ls.filter((l) => l.papel === papel).map((l) => [l.pessoa_id, { id: l.pessoa_id, nome: l.nome }])).values()];
  const categorias = [...groupBy(daEd, (l) => `${l.categoria}|${l.nome_original}`)].map(([, ls]) => ({
    categoria: ls[0].categoria, nome_original: ls[0].nome_original,
    obras: [...groupBy(ls, (l) => l.obra_id)].map(([obra_id, o]) => ({
      obra_id, titulo: o[0].titulo, editora: o[0].editora ?? null, colocacao: o[0].colocacao ?? null, lista_curta: o[0].lista_curta ?? 0,
      autores: pessoaDe(o, "autor"), ilustradores: pessoaDe(o, "ilustrador"), organizadores: pessoaDe(o, "organizador"),
    })).sort((a, b) => (a.colocacao ?? 99) - (b.colocacao ?? 99) || b.lista_curta - a.lista_curta || a.titulo.localeCompare(b.titulo, "pt-BR")),
  })).sort((a, b) => ordemCategoria(a.categoria, b.categoria) || estreia(a.nome_original) - estreia(b.nome_original) || a.nome_original.localeCompare(b.nome_original, "pt-BR"));
  return {
    premio, premio_nome: daEd[0].premio_nome, ano, regime: daEd[0].regime, anterior, seguinte,
    obras: distintos(daEd, (l) => l.obra_id),
    indicacoes: distintos(daEd, (l) => `${l.nome_original}|${l.obra_id}`),
    ...resumoEdicao(autores(daEd)),
    antes: anterior == null ? null : resumoEdicao(autores(doPremio.filter((l) => l.ano === anterior))),
    composicao, categorias,
  };
}

// ---------- perfil de editora (RF-29, D33) ----------
// Indicações contadas como em editoras(): só autoria, obra distinta por prêmio, ano e categoria. Pessoas com resumoEdicao.
export function perfilEditora(linhas, nome) {
  const daEd = linhas.filter((l) => l.editora === nome);
  if (!daEd.length) return null;
  const ind = indicacoesDeAutor(daEd).sort((a, b) => a.ano - b.ano || a.premio.localeCompare(b.premio) || a.categoria.localeCompare(b.categoria) || a.titulo.localeCompare(b.titulo, "pt-BR"));
  const todas = editoras(linhas, Infinity), total = ind.length;
  const pessoasDe = (k) => [...new Map(daEd.filter((l) => `${l.premio}|${l.ano}|${l.nome_original}|${l.obra_id}` === k && l.papel === "autor")
    .map((l) => [l.pessoa_id, { id: l.pessoa_id, nome: l.nome }])).values()];
  const porPremio = [...groupBy(ind, (l) => l.premio)].map(([premio, ls]) => ({
    premio, premio_nome: ls[0].premio_nome, indicacoes: ls.length, premiadas: ls.filter((l) => l.premiada).length, vencedoras: ls.filter((l) => l.vencedora).length,
    de: Math.min(...ls.map((l) => l.ano)), ate: Math.max(...ls.map((l) => l.ano)),
  }));
  const porAno = [...groupBy(ind, (l) => `${l.premio}|${l.ano}`)].map(([, ls]) => ({
    premio: ls[0].premio, premio_nome: ls[0].premio_nome, ano: ls[0].ano, premiadas: ls.filter((l) => l.premiada).length, outras: ls.filter((l) => !l.premiada).length,
  }));
  const autoresPorPessoa = contar(daEd.filter((l) => l.papel === "autor"), (l) => l.pessoa_id);
  const nomes = new Map(daEd.map((l) => [l.pessoa_id, l.nome]));
  return {
    editora: nome, grupo: daEd[0].grupo_editorial ?? null, uf: daEd[0].uf_editora ?? null,
    indicacoes: total, premiadas: ind.filter((l) => l.premiada).length, vencedoras: ind.filter((l) => l.vencedora).length,
    posicao: 1 + todas.filter((e) => e.total > total).length, editorasNaBase: todas.length,
    de: ind[0]?.ano ?? null, ate: ind.at(-1)?.ano ?? null,
    ...resumoEdicao(daEd.filter((l) => l.papel === "autor")),
    porPremio, porAno,
    obras: ind.map((l) => ({ premio: l.premio, premio_nome: l.premio_nome, ano: l.ano, categoria: l.categoria, nome_original: l.nome_original, obra_id: l.obra_id,
      titulo: l.titulo, colocacao: l.colocacao ?? null, lista_curta: l.lista_curta ?? 0, premiada: !!l.premiada, autores: pessoasDe(`${l.premio}|${l.ano}|${l.nome_original}|${l.obra_id}`) })),
    maisPublicados: [...autoresPorPessoa].map(([id, n]) => ({ id, nome: nomes.get(id), indicacoes: n }))
      .sort((a, b) => b.indicacoes - a.indicacoes || a.nome.localeCompare(b.nome, "pt-BR")).slice(0, 12),
  };
}
