// Markdown da Diadorim (spec CA-12.5, design D20): texto escapado e links só para o painel, metodo.html ou https.
import { test } from "node:test";
import assert from "node:assert/strict";
import { md, hrefSeguro, responder } from "../web/diadorim.js";

test("hrefSeguro aceita rotas do painel, método e https; recusa o resto", () => {
  for (const ok of ["#/pessoa/conceicao-evaristo", "#/grafico/funil", "#autores", "metodo.html#referencias", "https://www.wikidata.org/wiki/Q1", "#/uf/MG", "#/regiao/Centro-Oeste"])
    assert.equal(hrefSeguro(ok), ok);
  for (const ruim of ["javascript:alert(1)", "http://exemplo.com", "#/grafico/nao-existe", "data:text/html,oi", "//evil.com", "#/pessoa/<x>", "#/uf/mg1", "#/regiao/Marte"])
    assert.equal(hrefSeguro(ruim), null, ruim);
});

test("md escapa HTML e monta links internos e externos", () => {
  const h = md('<img src=x onerror=alert(1)> **2 pessoas**\n\nFontes: [Ana](#/pessoa/ana) [Funil](#/grafico/funil) [x](javascript:alert(1)) [CBL](https://cbl.org.br/a?b=1&c=2)');
  assert.ok(!h.includes("<img"));
  assert.ok(h.includes("<b>2 pessoas</b>"));
  assert.ok(h.includes('href="#/pessoa/ana"') && h.includes('href="#/grafico/funil"'));
  assert.ok(!h.includes("javascript:") && h.includes(">x<") === false);
  assert.ok(h.includes('href="https://cbl.org.br/a?b=1&amp;c=2"') && h.includes('target="_blank"'));
});

test("md monta listas", () => {
  assert.equal(md("- um\n- dois"), "<ul><li>um</li><li>dois</li></ul>");
});

test("laço de ferramentas: consulta o banco pelo /api/sql e devolve texto e consultas (CA-12.4)", async () => {
  globalThis.location = { origin: "http://localhost:8000" };
  const chamadas = [];
  let rodada = 0;
  globalThis.fetch = async (url, opt = {}) => {
    chamadas.push(url);
    const json = (corpo, status = 200) => ({ ok: status < 300, status, json: async () => corpo });
    if (url === "contexto.json") return json({ sistema: "REGRAS + DDL" });
    const corpo = JSON.parse(opt.body);
    assert.equal(corpo.model, "openrouter/free");
    assert.match(opt.headers.Authorization, /^Bearer chave-teste$/);
    if (rodada++ === 0) {
      assert.ok(corpo.messages[0].content.includes("Diadorim") && corpo.messages[0].content.includes("REGRAS + DDL"));
      return json({ model: "x/y:free", choices: [{ message: { role: "assistant", tool_calls: [{ id: "t1", type: "function", function: { name: "consultar_sql", arguments: '{"sql":"SELECT 42 AS n"}' } }] } }] });
    }
    assert.deepEqual(JSON.parse(corpo.messages.at(-1).content), { colunas: ["n"], linhas: [[42]], truncado: false });
    return json({ model: "x/y:free", choices: [{ message: { role: "assistant", content: "São 42. É a soma de todas as participações do recorte, de 2010 a 2025, nas oito categorias acompanhadas pelo Literadados, contando cada pessoa uma vez por obra e por edição em que apareceu.\n\nFontes: [Panorama](#panorama)" } }] });
  };
  const consultar = async (sql, consultas) => { chamadas.push(`sql:${sql}`); consultas.push({ sql, colunas: ["n"], linhas: [[42]], truncado: false }); return { colunas: ["n"], linhas: [[42]], truncado: false }; };
  const r = await responder("quantos?", [], "chave-teste", { consultar });
  assert.equal(r.texto, "São 42. É a soma de todas as participações do recorte, de 2010 a 2025, nas oito categorias acompanhadas pelo Literadados, contando cada pessoa uma vez por obra e por edição em que apareceu.\n\nFontes: [Panorama](#panorama)");
  assert.equal(r.contexto, undefined);
  assert.equal(r.consultas.length, 1);
  assert.equal(r.modelo, "x/y:free");
  assert.deepEqual(chamadas.filter((u) => !u.startsWith("https://")), ["contexto.json", "sql:SELECT 42 AS n"]);
});

test("chave recusada (401) pede novo login", async () => {
  globalThis.fetch = async (url) => (url === "contexto.json"
    ? { ok: true, status: 200, json: async () => ({ sistema: "x" }) }
    : { ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(responder("oi", [], "velha"), (e) => e.sair === true);
});

test("referencias: tira 'Fontes' com nomes de tabela e monta links compreensíveis (CA-12.5)", async () => {
  const { referencias } = await import("../web/diadorim.js");
  const texto = "São 3 pessoas.\n\nFontes:\n- v_participacao\n- pessoa\n- [Funil](#/grafico/funil)\n- [x](javascript:alert(1))";
  const consultas = [{ sql: "SELECT pessoa_id, nome, uf_nascimento FROM v_participacao WHERE premiada", colunas: ["pessoa_id", "nome", "uf_nascimento"],
    linhas: [["ce", "Conceição Evaristo", "MG"], ["x", "Fulana", "EX"]] }];
  const r = referencias(texto, consultas);
  assert.equal(r.texto, "São 3 pessoas.");
  const hrefs = r.links.map((l) => l.href);
  assert.ok(!r.links.some((l) => /v_participacao|^pessoa$/.test(l.rotulo)));
  assert.deepEqual(hrefs, ["#/grafico/funil", "#/pessoa/ce", "#/uf/MG", "#/pessoa/x", "#/grafico/geografia", "metodo.html#metodologia"]);
  assert.equal(r.links[1].rotulo, "Conceição Evaristo");
  assert.deepEqual(referencias("Sem bloco.", []).links.map((l) => l.href), ["metodo.html#metodologia"]);
});

test("passos intermediários e modelo escolhido (CA-12.9, CA-12.11)", async () => {
  globalThis.location = { origin: "http://localhost:8000" };
  let rodada = 0, modeloPedido = null;
  globalThis.fetch = async (url, opt = {}) => {
    const json = (corpo, status = 200) => ({ ok: status < 300, status, json: async () => corpo });
    if (url === "contexto.json") return json({ sistema: "x" });
    modeloPedido = JSON.parse(opt.body).model;
    return rodada++ === 0
      ? json({ model: "a/b", choices: [{ message: { role: "assistant", tool_calls: [{ id: "t", type: "function", function: { name: "consultar_sql", arguments: '{"sql":"SELECT 1"}' } }] } }] })
      : json({ model: "a/b", choices: [{ message: { role: "assistant", content: "ok" } }] });
  };
  const passos = [];
  const consultar = async () => ({ colunas: ["n"], linhas: [[1], [2]], truncado: false });
  await responder("p", [], "k", { modelo: "meta/llama:free", aoPasso: (p) => passos.push(p.tipo), consultar });
  assert.equal(modeloPedido, "meta/llama:free");
  assert.deepEqual(passos, ["contexto", "rodada", "sql", "resultado", "rodada", "escrita"]);
});

test("md: tabela, título, citação, código, linha e lista depois de parágrafo (CA-12.5)", () => {
  const h = md("### Vencedores\nVeja:\n- um\n- dois\n\n| Autor | Ano |\n|---|---:|\n| **Ana** | 2024 |\n| <b>x</b> | 2017 |\n\n> nota\n\n---\n\n```\nSELECT 1\n```");
  assert.ok(h.includes("<h4>Vencedores</h4>"));
  assert.ok(h.includes("<p>Veja:</p><ul><li>um</li><li>dois</li></ul>"));
  assert.ok(h.includes("<thead><tr><th>Autor</th><th>Ano</th></tr></thead>"));
  assert.ok(h.includes("<tr><td><b>Ana</b></td><td>2024</td></tr>"));
  assert.ok(h.includes("<td>&lt;b&gt;x&lt;/b&gt;</td>")); // HTML do modelo continua escapado dentro da tabela
  assert.ok(h.includes('data-exportar="tabela"')); // tabela do chat também exporta (CA-14.3)
  assert.ok(h.includes("<blockquote>nota</blockquote>") && h.includes("<hr>") && h.includes("<pre><code>SELECT 1</code></pre>"));
});

test("validarSQL: só um SELECT/WITH, sem escrita nem leitura de arquivo (CA-12.4)", async () => {
  const { validarSQL } = await import("../web/banco.js");
  assert.equal(validarSQL("SELECT 1;"), "SELECT 1");
  assert.equal(validarSQL("WITH a AS (SELECT 1) SELECT * FROM a"), "WITH a AS (SELECT 1) SELECT * FROM a");
  assert.equal(validarSQL("SELECT 'a;b' -- comentário"), "SELECT 'a;b'");
  for (const ruim of ["DROP TABLE pessoa", "SELECT 1; SELECT 2", "SELECT * FROM read_csv('/etc/passwd')", "COPY pessoa TO 'x'",
    "SELECT * FROM query('DROP TABLE x')", "INSERT INTO pessoa VALUES (1)", "SET enable_external_access = true", "ATTACH 'x.db'", "", "PRAGMA version"])
    assert.throws(() => validarSQL(ruim), /consulta vazia|apenas|não permitido/, ruim);
});

// Resposta seca (CA-12.12): só o número não basta, com qualquer modelo.
test("respostaSeca e consultaDeDetalhe", async () => {
  const { respostaSeca, consultaDeDetalhe } = await import("../web/diadorim.js");
  assert.ok(respostaSeca("5"));
  assert.ok(respostaSeca("São **5** mulheres.\n\nFontes: [Funil](#/grafico/funil) [Mapa](#/grafico/geografia) [Método](metodo.html#metodologia) [x](#/uf/CE)"));
  assert.ok(!respostaSeca("São 5 mulheres nascidas no Nordeste entre as premiadas: Socorro Acioli (CE), Ana Maria Gonçalves (MG não), e outras três, de um total de 120 premiadas no recorte, ou 4,2% delas."));
  assert.equal(consultaDeDetalhe("SELECT COUNT(DISTINCT pessoa_id) AS n FROM v_participacao WHERE genero = 'mulher' AND regiao_nascimento = 'Nordeste' AND premiada;"),
    "SELECT pessoa_id, nome, uf_nascimento, ano, categoria, titulo, colocacao FROM v_participacao WHERE genero = 'mulher' AND regiao_nascimento = 'Nordeste' AND premiada ORDER BY nome, ano LIMIT 200");
  assert.match(consultaDeDetalhe("select count(*) from v_participacao v where v.premiada order by 1 limit 5"), /FROM v_participacao v where v\.premiada ORDER BY nome/);
  for (const sem of ["SELECT nome FROM v_participacao", "SELECT uf_nascimento, COUNT(*) FROM v_participacao GROUP BY 1", "WITH x AS (SELECT 1) SELECT COUNT(*) FROM x", "SELECT COUNT(*) FROM pessoa"])
    assert.equal(consultaDeDetalhe(sem), null, sem);
});

test("blocoContexto: pessoas com link, estado, obras e contagem por UF", async () => {
  const { blocoContexto } = await import("../web/diadorim.js");
  const c = { colunas: ["pessoa_id", "nome", "uf_nascimento", "ano", "categoria", "titulo", "colocacao"], truncado: false,
    linhas: [["socorro-acioli", "Socorro Acioli", "CE", 2013, "Infantil", "Ela Tem Olhos de Céu", 1], ["ana", "Ana", "BA", 2012, "Poesia", "Livro", 2], ["ana", "Ana", "BA", 2015, "Contos", "Outro", 3]] };
  const b = blocoContexto(c);
  assert.match(b, /\*\*Quem são\*\* \(2 pessoas\)/);
  assert.ok(b.includes("- [Socorro Acioli](#/pessoa/socorro-acioli) (CE): 2013 · Infantil · *Ela Tem Olhos de Céu*, 1º lugar"));
  assert.ok(b.includes("- [Ana](#/pessoa/ana) (BA): 2012 · Poesia · *Livro*, 2º lugar; 2015 · Contos · *Outro*, 3º lugar"));
  assert.ok(b.includes("**Por estado de nascimento:** BA 1 · CE 1."));
  assert.equal(blocoContexto({ colunas: ["n"], linhas: [[5]] }), "");
});

test("laço: resposta só com o número → insiste uma vez → ainda seca → Literadados detalha a contagem", async () => {
  globalThis.location = { origin: "http://localhost:8000" };
  const pedidos = [];
  globalThis.fetch = async (url, opt = {}) => {
    const json = (corpo) => ({ ok: true, status: 200, json: async () => corpo });
    if (url === "contexto.json") return json({ sistema: "x" });
    const corpo = JSON.parse(opt.body);
    pedidos.push(corpo.messages.at(-1));
    return pedidos.length === 1
      ? json({ choices: [{ message: { role: "assistant", tool_calls: [{ id: "t", type: "function", function: { name: "consultar_sql", arguments: JSON.stringify({ sql: "SELECT COUNT(DISTINCT pessoa_id) AS n FROM v_participacao WHERE premiada" }) } }] } }] })
      : json({ choices: [{ message: { role: "assistant", content: "5" } }] });
  };
  const sqls = [];
  const consultar = async (sql, consultas) => {
    sqls.push(sql);
    const r = /^SELECT pessoa_id/.test(sql)
      ? { colunas: ["pessoa_id", "nome", "uf_nascimento", "ano", "categoria", "titulo", "colocacao"], linhas: [["socorro-acioli", "Socorro Acioli", "CE", 2013, "Infantil", "Ela Tem Olhos de Céu", 1]], truncado: false }
      : { colunas: ["n"], linhas: [[5]], truncado: false };
    consultas.push({ sql, ...r });
    return r;
  };
  const passos = [];
  const r = await responder("Quantas mulheres nascidas no Nordeste foram premiadas?", [], "k", { consultar, aoPasso: (p) => passos.push(p.texto) });
  assert.equal(pedidos.length, 3); // pergunta, resultado da consulta, insistência
  assert.equal(pedidos[2].role, "user");
  assert.match(pedidos[2].content, /curta demais/);
  assert.equal(r.texto, "5");
  assert.equal(sqls[1], "SELECT pessoa_id, nome, uf_nascimento, ano, categoria, titulo, colocacao FROM v_participacao WHERE premiada ORDER BY nome, ano LIMIT 200");
  assert.ok(r.contexto.includes("[Socorro Acioli](#/pessoa/socorro-acioli) (CE)"));
  assert.equal(r.consultas.at(-1).auto, true);
  assert.ok(passos.includes("Resposta seca demais: pedindo contexto ao modelo"));
});
