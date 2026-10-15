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
    regimes: [{ ano: 2016, regime: "2010–2017 pódio" }],
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
  assert.deepEqual(Object.keys(a), ["ano", "regime", "categoria", "nome_original", "obra_id", "titulo", "ano_publicacao", "editora",
    "grupo_editorial", "uf_editora", "pessoa_id", "nome", "papel", "genero", "raca", "raca_busca", "negra", "uf_nascimento",
    "regiao_nascimento", "idade_no_premio", "lista_curta", "colocacao", "premiada", "vencedora"]);
  assert.equal(a.categoria, "Contos");
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
