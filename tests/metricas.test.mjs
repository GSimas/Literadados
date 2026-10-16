// Testes das agregações do painel (spec CA-03.1, 05.1, 06.2, 09.2). Rodar: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import * as M from "../web/metricas.js";

// Dados fictícios controlados: 2 edições, 2 categorias.
const L = (o) => ({
  papel: "autor", raca: "sem_declaracao", negra: false, regiao_nascimento: "Sudeste", uf_nascimento: "SP",
  lista_curta: null, premiada: false, vencedora: false, editora: "Ed A", grupo_editorial: null, uf_editora: "SP", ...o,
});
const linhas = [
  L({ ano: 2016, categoria: "Romance", nome_original: "Romance", obra_id: "o1", pessoa_id: "a", genero: "mulher", raca: "preta", negra: true, regiao_nascimento: "Nordeste", uf_nascimento: "BA" }),
  L({ ano: 2016, categoria: "Romance", nome_original: "Romance", obra_id: "o2", pessoa_id: "b", genero: "homem", premiada: true, vencedora: true, editora: "Ed B", grupo_editorial: "G1" }),
  L({ ano: 2016, categoria: "Poesia", nome_original: "Poesia", obra_id: "o3", pessoa_id: "c", genero: "mulher", premiada: true }),
  L({ ano: 2023, categoria: "Poesia", nome_original: "Poesia", obra_id: "o4", pessoa_id: "a", genero: "mulher", raca: "preta", negra: true, regiao_nascimento: "Nordeste", uf_nascimento: "BA", lista_curta: 1, premiada: true, vencedora: true }),
  L({ ano: 2023, categoria: "Poesia", nome_original: "Poesia", obra_id: "o5", pessoa_id: "d", genero: "homem", lista_curta: 0, uf_nascimento: "EX", regiao_nascimento: "Exterior" }),
  L({ ano: 2023, categoria: "Poesia", nome_original: "Poesia", obra_id: "o4", pessoa_id: "i", genero: "homem", papel: "ilustrador" }),
];

test("filtrar por papel, ano e categoria", () => {
  assert.equal(M.filtrar(linhas).length, 5);
  assert.equal(M.filtrar(linhas, { papel: "todos" }).length, 6);
  assert.equal(M.filtrar(linhas, { anoIni: 2023 }).length, 2);
  assert.equal(M.filtrar(linhas, { categorias: ["Romance"] }).length, 2);
});

test("filtrar nunca inclui organizadores (CA-01.5)", () => {
  const comOrg = [...linhas, L({ ano: 2016, categoria: "Romance", nome_original: "Romance", obra_id: "o1", pessoa_id: "org", genero: "mulher", papel: "organizador" })];
  assert.ok(!M.filtrar(comOrg).some((l) => l.papel === "organizador"));
  assert.ok(!M.filtrar(comOrg, { papel: "todos" }).some((l) => l.papel === "organizador"));
  assert.equal(M.filtrar(comOrg, { papel: "todos" }).length, 6); // autores e ilustradores
});

test("kpis contam pessoas distintas e tratam negros como piso", () => {
  const k = M.kpis(M.filtrar(linhas));
  assert.equal(k.pessoas, 4);
  assert.equal(k.indicacoes, 5);
  assert.equal(k.obras, 5);
  assert.equal(k.mulheres, 2);
  assert.equal(k.pctMulheres, 50);
  assert.equal(k.negras, 1);
  assert.equal(k.pctNegrasPiso, 25);
  assert.equal(k.pctCoberturaRaca, 25);
  assert.equal(k.buscaParcial, 4); // nenhuma linha de teste marca busca completa
  assert.equal(k.ufs, 2); // BA, SP (EX não conta)
  assert.equal(k.editoras, 2);
});

test("composição por edição soma 100%", () => {
  const c = M.composicao(M.filtrar(linhas), "genero");
  for (const ano of [2016, 2023]) {
    const soma = c.filter((x) => x.ano === ano).reduce((s, x) => s + x.pct, 0);
    assert.ok(Math.abs(soma - 100) < 1e-9);
  }
});

test("funil por etapa e maior queda", () => {
  const f = M.funil(M.filtrar(linhas), "genero");
  const v = (etapa, g) => f.find((x) => x.etapa === etapa && x.grupo === g);
  assert.equal(v("lista", "mulher").pct, 60); // 3 de 5 participações
  assert.equal(v("finalista", "mulher").n, 1); // só 2023 tem 2ª lista
  assert.equal(v("finalista", "mulher").total, 1);
  assert.equal(v("vencedora", "mulher").pct, 50); // a (2023) e b (2016)
  const q = M.maiorQueda(f);
  assert.equal(q.grupo, "mulher");
  assert.equal(q.queda, 10);
  const comFaltante = [...f, { etapa: "lista", grupo: "nao_identificado", n: 1, pct: 90 }, { etapa: "vencedora", grupo: "nao_identificado", n: 0, pct: 0 }];
  assert.equal(M.maiorQueda(comFaltante).grupo, "mulher"); // dado faltante não vira manchete
});

test("Duncan: 0 quando distribuições iguais, 1 quando segregação total", () => {
  const igual = [L({ categoria: "A", genero: "mulher" }), L({ categoria: "A", genero: "homem" }), L({ categoria: "B", genero: "mulher" }), L({ categoria: "B", genero: "homem" })];
  assert.equal(M.duncan(igual).D, 0);
  const total = [L({ categoria: "A", genero: "mulher" }), L({ categoria: "B", genero: "homem" })];
  assert.equal(M.duncan(total).D, 1);
  assert.equal(M.duncan([L({ categoria: "A", genero: "mulher" })]).D, null);
  assert.equal(M.duncan([...total, L({ categoria: "Livro do Ano", genero: "mulher" })]).D, 1); // Livro do Ano fora
});

test("grupos editoriais vs independentes por etapa", () => {
  const g = M.gruposEditoriais(M.filtrar(linhas));
  const v = (etapa, tipo) => g.find((x) => x.etapa === etapa && x.tipo === tipo);
  assert.equal(v("Lista", "Grupos editoriais").n, 1);
  assert.equal(v("Lista", "Independentes").n, 4);
  assert.equal(v("Premiadas", "Grupos editoriais").pct, 100 / 3);
});

test("editoras contam obras, não pessoas (ilustrador não duplica)", () => {
  const e = M.editoras(linhas);
  assert.deepEqual(e.map((x) => [x.editora, x.total, x.premiadas]), [["Ed A", 4, 2], ["Ed B", 1, 1]]);
});

test("porUF calcula por milhão", () => {
  const ufs = [{ uf: "BA", nome: "Bahia", regiao: "Nordeste", populacao_2022: 2_000_000 }, { uf: "SP", nome: "São Paulo", regiao: "Sudeste", populacao_2022: null }, { uf: "EX", nome: "Exterior", regiao: "Exterior" }];
  const u = M.porUF(M.filtrar(linhas), ufs);
  assert.equal(u.length, 2);
  assert.equal(u.find((x) => x.uf === "BA").porMilhao, 0.5);
  assert.equal(u.find((x) => x.uf === "SP").porMilhao, null);
});

test("júri compara perfis por edição", () => {
  const pessoas = [{ id: "a", genero: "mulher", raca: "preta", uf_nascimento: "BA" }, { id: "d", genero: "homem", raca: "sem_declaracao", uf_nascimento: "EX" },
    { id: "j1", genero: "mulher", raca: "sem_declaracao", uf_nascimento: "SP" }, { id: "j2", genero: "mulher", raca: "parda", uf_nascimento: "PE" }];
  const ufs = [{ uf: "BA", regiao: "Nordeste" }, { uf: "SP", regiao: "Sudeste" }, { uf: "PE", regiao: "Nordeste" }, { uf: "EX", regiao: "Exterior" }];
  const j = M.juri(M.filtrar(linhas), [{ ano: 2023, pessoa_id: "j1" }, { ano: 2023, pessoa_id: "j2" }], pessoas, ufs);
  const v = (quem, ind) => j.find((x) => x.quem === quem && x.indicador === ind);
  assert.equal(v("Júri", "% mulheres").pct, 100);
  assert.equal(v("Júri", "% negras (piso)").pct, 50);
  assert.equal(v("Lista", "% mulheres").pct, 50);
  assert.equal(v("Vencedoras", "% negras (piso)").pct, 100);
});

test("mediana e sankey", () => {
  assert.equal(M.mediana([3, 1, 2]), 2);
  assert.equal(M.mediana([4, 1, 2, 3]), 2.5);
  assert.equal(M.mediana([]), null);
  const s = M.sankey(M.filtrar(linhas), [{ uf: "SP", regiao: "Sudeste" }]);
  const soma = (alvo) => s.links.filter((l) => l.target === alvo).reduce((a, l) => a + l.value, 0);
  assert.equal(soma("Premiada") + soma("Não premiada"), 5);
});

test("expandir remonta as linhas de v_participacao a partir do JSON compacto (CA-RNF-06.2)", () => {
  const D = {
    premios: [{ id: "jabuti", nome: "Prêmio Jabuti" }],
    edicoes: [{ ano: 2016, regime: "2010–2017 pódio" }],
    categorias: [{ ano: 2016, nome_original: "Contos e Crônicas", categoria: "Contos" }],
    obras: [{ id: "o1", titulo: "O1", ano_publicacao: 2015, editora_id: "ed" }, { id: "o2", titulo: "O2", ano_publicacao: null, editora_id: null }],
    editoras: [{ id: "ed", nome: "Ed", grupo: "G", uf_sede: "SP" }],
    pessoas: [
      { id: "a", nome: "A", genero: "mulher", raca: "preta", negra: true, raca_busca: "completa", uf_nascimento: "BA", ano_nascimento: 1960 },
      { id: "b", nome: "B", genero: "homem", raca: "sem_declaracao", negra: false, raca_busca: "parcial", uf_nascimento: null, ano_nascimento: null },
    ],
    ufs: [{ uf: "BA", regiao: "Nordeste" }],
    participacao: [
      { ano: 2016, nome_original: "Contos e Crônicas", obra_id: "o1", pessoa_id: "a", papel: "autor", lista_curta: null, colocacao: 1, premiada: true, vencedora: true },
      { ano: 2016, nome_original: "Contos e Crônicas", obra_id: "o2", pessoa_id: "b", papel: "autor", lista_curta: null, colocacao: null, premiada: false, vencedora: false },
    ],
  };
  const [a, b] = M.expandir(D);
  assert.deepEqual(Object.keys(a), ["premio", "premio_nome", "ano", "regime", "categoria", "nome_original", "obra_id", "titulo", "ano_publicacao", "editora",
    "grupo_editorial", "uf_editora", "pessoa_id", "nome", "papel", "genero", "genero_atribuido", "raca", "raca_busca", "negra", "uf_nascimento",
    "pais_nascimento", "regiao_nascimento", "idade_no_premio", "lista_curta", "colocacao", "premiada", "vencedora"]);
  assert.deepEqual([a.pais_nascimento, b.pais_nascimento], ["BR", null]); // UF brasileira = BR; sem UF = sem país (DA-3)
  assert.equal(a.categoria, "Contos");
  assert.deepEqual([a.premio, a.premio_nome], ["jabuti", "Prêmio Jabuti"]); // premio ausente no JSON = 1º de D.premios (D31)
  assert.equal(a.editora, "Ed");
  assert.equal(a.regiao_nascimento, "Nordeste");
  assert.equal(a.idade_no_premio, 56);
  assert.equal(a.negra, true);
  assert.equal(b.editora, null); // obra sem editora
  assert.equal(b.regiao_nascimento, null); // sem UF
  assert.equal(b.idade_no_premio, null); // sem ano de nascimento
});

// ---------- interface narrativa (CA-11.3, 16.2, 17.1, 17.2) ----------

test("historia calcula os números da narrativa a partir dos dados", () => {
  const h = M.historia(M.filtrar(linhas));
  assert.equal(h.pessoas, 4);
  assert.equal(h.edicoes, 2);
  assert.equal(h.genero.mulheres, 2);
  assert.equal(h.genero.pctMulheres, 50);
  assert.equal(h.genero.atribuido, 0);
  assert.equal(h.vencedoras.pessoas, 2); // a (2023) e b (2016)
  assert.equal(h.vencedoras.mulheres, 1);
  assert.equal(h.premiadas.pessoas, 3); // a, b, c
  assert.equal(h.raca.negras, 1);
  assert.equal(h.raca.pctNegras, 25);
  assert.equal(h.raca.negrasVencedoras, 1);
  assert.equal(h.regiao.comUF, 3); // d nasceu no exterior
  assert.equal(h.regiao.sudeste, 2);
  assert.equal(h.regiao.exterior, 1);
  assert.deepEqual(h.topUF, { uf: "SP", pessoas: 2 });
});

test("pontosHistoria: um ponto por pessoa com o melhor resultado", () => {
  const p = new Map(M.pontosHistoria(M.filtrar(linhas)).map((x) => [x.id, x]));
  assert.equal(p.size, 4);
  assert.equal(p.get("a").etapa, "vencedora");
  assert.equal(p.get("a").participacoes, 2);
  assert.equal(p.get("c").etapa, "premiada");
  assert.equal(p.get("d").etapa, "lista");
  assert.equal(p.get("a").raca, "negra");
});

test("porEdicao: composição da lista com n e total", () => {
  const e = M.porEdicao(M.filtrar(linhas));
  assert.deepEqual(e.map((x) => x.ano), [2016, 2023]);
  assert.equal(e[0].total, 3);
  assert.equal(e[0].mulheres, 2);
  assert.equal(e[1].pctNegras, 50);
  assert.equal(e[1].comUF, 1); // exterior fica fora da base de % Sudeste
  assert.equal(e[1].pctSudeste, 0);
});

test("vencedorasPorAno lista obras de 1º lugar com autoria", () => {
  const v = M.vencedorasPorAno(M.filtrar(linhas), ["Romance", "Poesia"]);
  assert.deepEqual(v.map((o) => `${o.ano} ${o.categoria} ${o.obra_id}`), ["2016 Romance o2", "2023 Poesia o4"]);
  assert.deepEqual(v[1].pessoas.map((p) => p.id), ["a"]);
});

test("avatar neutro: cor depende só do id; iniciais ignoram partículas", () => {
  assert.equal(M.corAvatar("conceicao-evaristo"), M.corAvatar("conceicao-evaristo"));
  assert.ok(M.corAvatar("x") >= 0 && M.corAvatar("x") < 360);
  assert.equal(M.corAvatar.length, 1); // não recebe atributos da pessoa
  assert.notEqual(M.corAvatar("a"), M.corAvatar("b"));
  assert.equal(M.iniciais("Conceição Evaristo"), "CE");
  assert.equal(M.iniciais("Rosa Amanda Strausz"), "RS");
  assert.equal(M.iniciais("Ignácio de Loyola Brandão"), "IB");
  assert.equal(M.iniciais("Ziraldo"), "Z");
  assert.equal(M.iniciais("Patrícia Melo (coautora de Mistério em Queluz)"), "PM");
});

test("gênero atribuído pelo nome é contado por pessoa (CA-11.4)", () => {
  const ls = linhas.map((l) => ({ ...l, genero_atribuido: l.pessoa_id === "a" || l.pessoa_id === "c" }));
  const L = M.filtrar(ls);
  assert.equal(M.kpis(L).generoAtribuido, 2); // a aparece em duas edições e conta uma vez
  assert.equal(M.historia(L).genero.atribuido, 2);
});

test("anel: n retratos que cabem na largura, sem sobreposição e fora do miolo (CA-11.5)", () => {
  for (const [n, W] of [[100, 1100], [100, 720], [100, 343], [50, 720], [7, 343], [1, 900], [0, 900]]) {
    const a = M.anel(n, W);
    assert.equal(a.pos.length, n);
    assert.ok(a.raio * 2 <= Math.max(260, W) || a.d === 18, `${n}/${W}: não cabe`);
    for (const p of a.pos) assert.ok(Math.hypot(p.x, p.y) - a.d / 2 >= a.miolo - 1e-9, "invade o miolo");
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++)
      assert.ok(Math.hypot(a.pos[i].x - a.pos[j].x, a.pos[i].y - a.pos[j].y) >= a.d, `${n}/${W}: ${i} e ${j} se sobrepõem`);
  }
  assert.ok(M.anel(100, 1100).d > M.anel(100, 343).d); // tela estreita encolhe os retratos
  assert.ok(M.anel(100, 720).miolo >= 720 * 0.24); // miolo largo para o resumo (CA-11.5)
});

test("filtro na URL: ida e volta, padrão vazio, lixo ignorado (CA-02.2)", () => {
  const ANOS = [2010, 2025], CATS = ["Romance", "Contos", "Poesia", "Livro do Ano"];
  const padrao = M.filtroDeTexto(null, ANOS, CATS);
  assert.deepEqual(padrao, { anoIni: 2010, anoFim: 2025, categorias: CATS, papel: "autor" });
  assert.equal(M.filtroParaTexto(padrao, ANOS, CATS), "");
  const f = { anoIni: 2015, anoFim: 2019, categorias: ["Poesia", "Livro do Ano"], papel: "todos" };
  const t = M.filtroParaTexto(f, ANOS, CATS);
  assert.equal(t, "2015-2019~Poesia,Livro do Ano~todos");
  assert.deepEqual(M.filtroDeTexto(t, ANOS, CATS), f);
  assert.equal(M.filtroParaTexto({ ...padrao, anoIni: 2019 }, ANOS, CATS), "2019-2025");
  assert.deepEqual(M.filtroDeTexto("1990-3000~Ficção Científica", ANOS, CATS), padrao); // fora do recorte volta ao padrão
  assert.deepEqual(M.filtroDeTexto("2020-2012", ANOS, CATS).anoFim, 2020); // fim nunca antes do início
});

// ---------- busca e perfis de lugar (RF-21, RF-22) ----------
const Dmini = {
  participacao: [
    { ano: 2016, nome_original: "Romance", categoria: "Romance", obra_id: "o1", titulo: "Ponciá Vicêncio", pessoa_id: "ce", nome: "Conceição Evaristo", papel: "autor" },
    { ano: 2019, nome_original: "Poesia", categoria: "Poesia", obra_id: "o2", titulo: "Conceição", pessoa_id: "jc", nome: "João Conceito", papel: "autor" },
    { ano: 2019, nome_original: "Poesia", categoria: "Poesia", obra_id: "o2", titulo: "Conceição", pessoa_id: "org", nome: "Organizadora", papel: "organizador" },
  ],
  pessoas: [{ id: "ce", nome: "Conceição Evaristo", uf_nascimento: "MG", ano_nascimento: 1946 }, { id: "jc", nome: "João Conceito" }, { id: "org", nome: "Organizadora" }],
  obras: [{ id: "o1", titulo: "Ponciá Vicêncio", editora_id: "e1" }, { id: "o2", titulo: "Conceição", editora_id: "e1" }],
  editoras: [{ id: "e1", nome: "Pallas", municipio_sede: "Rio de Janeiro", uf_sede: "RJ", grupo: null }],
  ufs: [{ uf: "MG", nome: "Minas Gerais", regiao: "Sudeste" }, { uf: "EX", nome: "Exterior", regiao: "Exterior" }],
  categorias: [{ categoria: "Romance" }, { categoria: "Poesia" }], anos_coletados: [2016, 2019], jurados: [],
};

test("buscar: determinística, sem acento, nome exato antes de trecho (CA-21.1)", () => {
  const ix = M.indiceBusca(Dmini);
  assert.ok(!ix.some((e) => e.rotulo === "Organizadora")); // só organizou: fora da busca
  const r = M.buscar(ix, "CONCEIÇÃO");
  // exato (livro) → começo do nome (pessoa) → só pelo autor (livro dela); "Conceito" não contém "conceicao"
  assert.deepEqual(r.map((e) => `${e.tipo}:${e.rotulo}`), ["Livro:Conceição", "Pessoa:Conceição Evaristo", "Livro:Ponciá Vicêncio"]);
  assert.deepEqual(M.buscar(ix, "concei"), M.buscar(ix, "concei")); // mesma entrada, mesma saída
  assert.equal(M.buscar(ix, "ponciá vic")[0].href, "#/obra/o1"); // livro abre o perfil do livro (RF-24)
  assert.equal(M.buscar(ix, "minas")[0].href, "#/uf/MG");
  assert.equal(M.buscar(ix, "sudeste")[0].href, "#/regiao/Sudeste");
  assert.equal(M.buscar(ix, "2019")[0].tipo, "Edição");
  assert.equal(M.buscar(ix, "evaristo ponc")[0].rotulo, "Ponciá Vicêncio"); // livro achado pelo autor + título
  assert.deepEqual(M.buscar(ix, "   "), []);
});

test("perfilLugar: parcela, premiadas e fatias por edição e categoria (CA-22.2)", () => {
  const ls = [
    L({ ano: 2016, categoria: "Romance", nome_original: "Romance", obra_id: "o1", pessoa_id: "a", genero: "mulher", uf_nascimento: "MG", regiao_nascimento: "Sudeste", premiada: true, vencedora: true }),
    L({ ano: 2016, categoria: "Romance", nome_original: "Romance", obra_id: "o2", pessoa_id: "b", genero: "homem", uf_nascimento: "BA", regiao_nascimento: "Nordeste" }),
    L({ ano: 2019, categoria: "Poesia", nome_original: "Poesia", obra_id: "o3", pessoa_id: "a", genero: "mulher", uf_nascimento: "MG", regiao_nascimento: "Sudeste" }),
    L({ ano: 2019, categoria: "Poesia", nome_original: "Poesia", obra_id: "o4", pessoa_id: "x", genero: "homem", uf_nascimento: "EX", regiao_nascimento: "Exterior" }),
  ];
  const p = M.perfilLugar(ls, (l) => l.uf_nascimento === "MG");
  assert.equal(p.pessoas, 1);
  assert.equal(p.pessoasBR, 2); // exterior fora da base
  assert.equal(p.parcela, 50);
  assert.equal(p.premiadas, 1);
  assert.equal(p.vencedoras, 1);
  assert.deepEqual(p.porAno, [{ ano: 2016, n: 1, total: 2, pct: 50 }, { ano: 2019, n: 1, total: 1, pct: 100 }]);
  assert.deepEqual(p.porCategoria.map((c) => c.categoria), ["Poesia", "Romance"]);
});

test("capacidadeAnel: maior página com retratos de pelo menos 44 px (CA-11.7)", () => {
  for (const w of [320, 360, 414, 700]) {
    const n = M.capacidadeAnel(w, 44, 100);
    assert.ok(M.anel(n, w).d >= 44, `w=${w}`);
    if (n < 100) assert.ok(M.anel(n + 1, w).d < 44, `w=${w} não é o máximo`);
  }
  assert.ok(M.capacidadeAnel(320) < M.capacidadeAnel(700));
});

test("ranking: medida, desempate e posição de competição (RF-23)", () => {
  const pessoas = [{ id: "a", nome: "Ana" }, { id: "b", nome: "Bia" }, { id: "c", nome: "Caio" }, { id: "d", nome: "Davi" }];
  const L = [
    { pessoa_id: "a", premiada: true, vencedora: true }, { pessoa_id: "a", premiada: false, vencedora: false },
    { pessoa_id: "b", premiada: true, vencedora: false }, { pessoa_id: "b", premiada: true, vencedora: false }, { pessoa_id: "b", premiada: false, vencedora: false },
    { pessoa_id: "c", premiada: true, vencedora: true },
    { pessoa_id: "d", premiada: false, vencedora: false },
  ];
  const r = M.ranking(L, pessoas, "premios");
  assert.deepEqual(r.map((p) => [p.id, p.posicao, p.premios]), [["b", 1, 2], ["a", 2, 1], ["c", 2, 1]]); // a e c empatam; a tem mais indicações
  assert.deepEqual(M.ranking(L, pessoas, "vitorias").map((p) => [p.id, p.posicao]), [["a", 1], ["c", 1]]);
  assert.deepEqual(M.ranking(L, pessoas, "participacoes", 1).map((p) => p.id), ["b"]);
  assert.ok(!("linhas" in r[0]));
});

test("filtro com série histórica: padrão é a série completa 1959–2025 (CA-25.2)", () => {
  const SERIE = [1959, 2025], CATS = ["Romance", "Poesia"];
  const p = M.filtroDeTexto(null, SERIE, CATS);
  assert.deepEqual([p.anoIni, p.anoFim], [1959, 2025]);
  assert.equal(M.filtroParaTexto(p, SERIE, CATS), ""); // padrão não vai para a URL
  const r = M.filtroDeTexto("2010-2025", SERIE, CATS);
  assert.deepEqual([r.anoIni, r.anoFim], [2010, 2025]); // o recorte recente vale na URL
  assert.equal(M.filtroParaTexto(r, SERIE, CATS), "2010-2025");
  const lixo = M.filtroDeTexto("1800-3000", SERIE, CATS);
  assert.deepEqual([lixo.anoIni, lixo.anoFim], [1959, 2025]); // fora da série volta ao padrão
});

test("filtrar sem período não corta anos (CA-25.2)", () => {
  const ls = [L({ ano: 1959, categoria: "Romance", nome_original: "Romance", obra_id: "v", pessoa_id: "v", genero: "homem", colocacao: 1 }),
    L({ ano: 2025, categoria: "Romance", nome_original: "Romance Literário", obra_id: "n", pessoa_id: "n", genero: "mulher" })];
  assert.equal(M.filtrar(ls).length, 2);
  assert.equal(M.filtrar(ls, { anoIni: 2010, anoFim: 2025 }).length, 1);
});

test("editoras: indicação sem editora fica fora e é contada à parte (CA-25.4)", () => {
  const ls = [...linhas, L({ ano: 1965, categoria: "Poesia", nome_original: "Poesia", obra_id: "antiga", pessoa_id: "x", genero: "mulher", editora: null, colocacao: 1 })];
  assert.ok(!M.editoras(ls).some((e) => /não informada/i.test(e.editora)));
  assert.deepEqual(M.editoras(ls), M.editoras(linhas));
  assert.equal(M.semEditora(ls), M.semEditora(linhas) + 1);
});

test("passoAnos: rótulos de 1, 2, 5 ou 10 anos conforme o espaço (CA-25.3)", () => {
  assert.equal(M.passoAnos(16, 900), 1);
  assert.equal(M.passoAnos(67, 900), 5);
  assert.equal(M.passoAnos(67, 300), 10);
  assert.equal(M.passoAnos(67, 100), 10); // nunca mais largo que 10
});

test("urlsCapa remonta as URLs da capa compacta (RF-24, RNF-06)", async () => {
  const { urlsCapa } = await import("../web/pessoas.js");
  assert.deepEqual(urlsCapa({ obra_id: "x", f: "ol", i: "12369845", p: "OL35664121M" }),
    { url: "https://covers.openlibrary.org/b/id/12369845-M.jpg", pagina: "https://openlibrary.org/books/OL35664121M", fonte: "open_library" });
  assert.equal(urlsCapa({ obra_id: "x", f: "gb", i: "abc-D_1" }).pagina, "https://books.google.com/books?id=abc-D_1");
  assert.equal(urlsCapa(undefined), null);
  assert.equal(urlsCapa({ obra_id: "x", url: "https://a/b.jpg", fonte: "open_library", pagina: null }).url, "https://a/b.jpg");
});

test("expandir remonta fonte 'wd' como a página do Wikidata da pessoa (RNF-06)", () => {
  const D = { edicoes: [{ ano: 2020, regime: "r" }], categorias: [{ ano: 2020, nome_original: "Poesia", categoria: "Poesia" }], obras: [{ id: "o", titulo: "T" }],
    editoras: [], ufs: [], pessoas: [{ id: "a", nome: "A", wikidata: "Q1", genero: "mulher", genero_fonte: "wd", nascimento_fonte: "https://x", raca: "sem_declaracao" }],
    participacao: [{ ano: 2020, nome_original: "Poesia", obra_id: "o", pessoa_id: "a", colocacao: 1 }] };
  const [l] = M.expandir(D);
  assert.equal(D.pessoas[0].genero_fonte, "https://www.wikidata.org/wiki/Q1");
  assert.equal(D.pessoas[0].nascimento_fonte, "https://x");
  assert.deepEqual([l.papel, l.premiada, l.vencedora, l.lista_curta], ["autor", true, true, null]);
});

// ---------- vários prêmios (RF-26) ----------
const LP = [
  L({ premio: "jabuti", ano: 2016, categoria: "Romance", nome_original: "Romance", obra_id: "j1", pessoa_id: "a", genero: "mulher", premiada: true, vencedora: true }),
  L({ premio: "jabuti", ano: 2016, categoria: "Romance", nome_original: "Romance", obra_id: "j2", pessoa_id: "b", genero: "homem" }),
  L({ premio: "jabuti", ano: 2020, categoria: "Poesia", nome_original: "Poesia", obra_id: "j3", pessoa_id: "c", genero: "homem", premiada: true }),
  L({ premio: "oceanos", ano: 2016, categoria: "Geral", nome_original: "Geral", obra_id: "j1", pessoa_id: "a", genero: "mulher" }),
  L({ premio: "oceanos", ano: 2018, categoria: "Geral", nome_original: "Geral", obra_id: "x1", pessoa_id: "c", genero: "homem", premiada: true, vencedora: true, uf_nascimento: "EX", regiao_nascimento: "Exterior", pais_nascimento: "PT" }),
  L({ premio: "oceanos", ano: 2018, categoria: "Geral", nome_original: "Geral", obra_id: "x2", pessoa_id: "e", genero: "mulher", uf_nascimento: "EX", regiao_nascimento: "Exterior", pais_nascimento: "AO" }),
];
const PS = ["jabuti", "oceanos"];

test("filtro com prêmio: padrão é o 1º prêmio e não vai para a URL; ida e volta (CA-26.8)", () => {
  const CATS = ["Romance", "Poesia", "Geral"], ANOS = [1959, 2025];
  const p = M.filtroDeTexto(null, ANOS, CATS, PS);
  assert.deepEqual(p.premios, ["jabuti"]);
  assert.equal(M.filtroParaTexto(p, ANOS, CATS, PS), "");
  const f = { ...p, premios: ["oceanos", "jabuti"], categorias: ["Geral"] };
  const t = M.filtroParaTexto(f, ANOS, CATS, PS);
  assert.equal(t, "1959-2025~Geral~p:oceanos,jabuti");
  assert.deepEqual(M.filtroDeTexto(t, ANOS, CATS, PS).premios, ["jabuti", "oceanos"]); // ordem da base
  assert.deepEqual(M.filtroDeTexto("1959-2025~p:fantasma", ANOS, CATS, PS).premios, ["jabuti"]); // desconhecido → padrão
  assert.deepEqual(M.filtroDeTexto("2000-2010~todos~p:oceanos", ANOS, CATS, PS), { anoIni: 2000, anoFim: 2010, categorias: CATS, papel: "todos", premios: ["oceanos"] });
  assert.ok(!("premios" in M.filtroDeTexto(null, ANOS, CATS))); // sem prêmios, o filtro é o de antes
  assert.equal(M.filtrar(LP, { premios: ["oceanos"] }).length, 3);
  assert.equal(M.filtrar(LP, { premios: PS }).length, 6);
});

test("facetar nunca soma prêmios: cada um com a própria base (CA-26.9)", () => {
  const c = M.facetar(LP, (ls) => M.composicao(ls, "genero"), PS, { jabuti: "Prêmio Jabuti", oceanos: "Prêmio Oceanos" });
  const m16 = c.filter((x) => x.ano === 2016 && x.grupo === "mulher");
  assert.deepEqual(m16.map((x) => [x.premio_nome, x.n, x.total]), [["Prêmio Jabuti", 1, 2], ["Prêmio Oceanos", 1, 1]]);
  assert.deepEqual([...M.porPremio(LP, ["oceanos", "jabuti"]).keys()], ["oceanos", "jabuti"]);
  assert.deepEqual([...M.porPremio(LP.slice(0, 3), PS).keys()], ["jabuti"]); // prêmio sem linhas sai
  const k = M.kpis(LP);
  assert.deepEqual([k.pessoas, k.premios, k.exterior, k.paises, k.indicacoes], [4, 2, 2, 2, 6]); // mesma obra em 2 prêmios = 2 indicações
});

test("Duncan ignora a categoria única Geral (CA-26.3)", () => {
  assert.equal(M.duncan(LP.filter((l) => l.premio === "oceanos")).D, null);
});

test("entrePremios: sobreposição com n e ordem de chegada (CA-26.11)", () => {
  const lista = M.entrePremios(LP, PS, "lista");
  assert.deepEqual(lista.pessoas.map((p) => p.pessoa_id), ["a", "c"]); // a chegou antes (2016)
  const a = lista.pessoas[0], c = lista.pessoas[1];
  assert.deepEqual([a.premios, a.anos], [["jabuti", "oceanos"], [2016, 2016]]); // mesmo ano: ordem da base
  assert.deepEqual([c.premios, c.anos], [["oceanos", "jabuti"], [2018, 2020]]); // chegou primeiro ao Oceanos
  assert.deepEqual(lista.total, { jabuti: 3, oceanos: 3 });
  const jo = lista.pares.find((x) => x.de === "jabuti" && x.para === "oceanos");
  assert.deepEqual([jo.n, jo.total], [2, 3]);
  const prem = M.entrePremios(LP, PS, "premiada");
  assert.deepEqual(prem.pessoas.map((p) => p.pessoa_id), ["c"]); // a só foi indicada no Oceanos
});

test("edições sem lista pública por prêmio; marcos só dos prêmios do recorte (CA-26.4, CA-26.10)", () => {
  const cats = [
    { ano: 1990, nome_original: "Romance", categoria: "Romance", etapa_lista: "premiados" },
    { ano: 1990, nome_original: "Livro do Ano", categoria: "Livro do Ano", etapa_lista: "premiados" },
    { ano: 2016, nome_original: "Romance", categoria: "Romance", vagas_lista: 10, etapa_lista: "finalistas" },
    { premio: "oceanos", ano: 2016, nome_original: "Geral", categoria: "Geral", etapa_lista: "premiados" },
    { ano: 2017, nome_original: "Romance", categoria: "Romance" }, // dado antigo sem etapa_lista: cai em vagas_lista
  ];
  assert.deepEqual([...M.edicoesSemLista(cats, "jabuti")].sort(), ["jabuti|1990", "jabuti|2017", "oceanos|2016"]);
  assert.ok(M.marcosDe(["oceanos"]).every((m) => m.premio === "oceanos"));
  assert.ok(M.marcosDe(null).length > 0 && M.marcosDe(null).every((m) => m.premio === "jabuti"));
});
test("porPais: nascidas fora por país, sem país e sem local separados (DA-3)", () => {
  const r = M.porPais([...LP, L({ premio: "oceanos", ano: 2018, categoria: "Geral", nome_original: "Geral", obra_id: "x3", pessoa_id: "f", genero: "homem", uf_nascimento: "EX", regiao_nascimento: "Exterior" }),
    L({ premio: "oceanos", ano: 2018, categoria: "Geral", nome_original: "Geral", obra_id: "x4", pessoa_id: "g", genero: "homem", uf_nascimento: null })]);
  assert.deepEqual(r.paises.map((x) => [x.pais, x.pessoas]), [["AO", 1], ["PT", 1], [null, 1]]);
  assert.deepEqual([r.fora, r.semLocal], [3, 1]);
  assert.equal(M.paisOuExterior("PT"), "Portugal");
  assert.equal(M.paisOuExterior(null), "exterior");
});

test("juntar: partes de outros prêmios se somam ao dados.json (CA-26.14)", () => {
  const D = { participacao: [{ a: 1 }], pessoas: [{ id: "a" }], obras: [], premios: [{ id: "jabuti" }] };
  M.juntar(D, [{ premio: "oceanos", participacao: [{ a: 2 }], pessoas: [{ id: "b" }], obras: [{ id: "o" }] }]);
  assert.deepEqual([D.participacao.length, D.pessoas.map((p) => p.id), D.obras.length, D.premios.length], [2, ["a", "b"], 1, 1]);
  assert.equal(M.juntar(D, []), D);
});

test("marcos: 1ª edição dos outros prêmios vem dos dados (CA-26.10)", () => {
  const base = [{ id: "jabuti", ano_inicio: 1959 }, { id: "oceanos", ano_inicio: 2003 }];
  const mo = M.marcosDe(["oceanos"], "jabuti", base);
  assert.ok(mo.every((m) => m.premio === "oceanos") && mo.some((m) => m.ano === 2003 && m.texto === "1ª edição") && mo.length > 1);
  assert.ok(!M.marcosDe(["jabuti"], "jabuti", base).some((m) => m.texto === "1ª edição")); // o padrão não ganha marco de criação
});

test("busca: edição de outro prêmio abre a linha do tempo filtrada; país no lugar de EX (CA-26.12)", () => {
  const D = { premios: [{ id: "jabuti", nome: "Prêmio Jabuti" }, { id: "oceanos", nome: "Prêmio Oceanos" }], edicoes: [{ premio: "oceanos", ano: 2018, regime: "categoria única" }],
    participacao: LP.map((l) => ({ ...l, nome: l.pessoa_id, titulo: l.obra_id })), pessoas: [{ id: "e", nome: "Eva Angolana", uf_nascimento: "EX", pais_nascimento: "AO" }],
    obras: [], editoras: [], ufs: [], categorias: [], jurados: [], anos_coletados: [] };
  const ix = M.indiceBusca(D);
  const oc = ix.find((e) => e.tipo === "Edição" && e.rotulo === "Oceanos 2018");
  assert.equal(oc.href, "?linha-do-tempo=2018-2018~p:oceanos#/grafico/linha-do-tempo");
  assert.equal(oc.sub, "categoria única");
  assert.equal(ix.find((e) => e.rotulo === "Jabuti 2016").href, "?linha-do-tempo=2016-2016#/grafico/linha-do-tempo");
  assert.ok(ix.find((e) => e.rotulo === "Eva Angolana").sub.startsWith("Angola"));
  assert.ok(ix.some((e) => e.rotulo === "Entre prêmios"));
});