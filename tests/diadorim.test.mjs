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
    if (url === "api/contexto") return json({ sistema: "REGRAS + DDL" });
    if (url === "api/sql") return json({ sql: JSON.parse(opt.body).sql, colunas: ["n"], linhas: [[42]], truncado: false });
    const corpo = JSON.parse(opt.body);
    assert.equal(corpo.model, "openrouter/free");
    assert.match(opt.headers.Authorization, /^Bearer chave-teste$/);
    if (rodada++ === 0) {
      assert.ok(corpo.messages[0].content.includes("Diadorim") && corpo.messages[0].content.includes("REGRAS + DDL"));
      return json({ model: "x/y:free", choices: [{ message: { role: "assistant", tool_calls: [{ id: "t1", type: "function", function: { name: "consultar_sql", arguments: '{"sql":"SELECT 42 AS n"}' } }] } }] });
    }
    assert.deepEqual(JSON.parse(corpo.messages.at(-1).content), { colunas: ["n"], linhas: [[42]], truncado: false });
    return json({ model: "x/y:free", choices: [{ message: { role: "assistant", content: "São 42.\n\nFontes: [Panorama](#panorama)" } }] });
  };
  const r = await responder("quantos?", [], "chave-teste");
  assert.equal(r.texto, "São 42.\n\nFontes: [Panorama](#panorama)");
  assert.equal(r.consultas.length, 1);
  assert.equal(r.modelo, "x/y:free");
  assert.deepEqual(chamadas.filter((u) => u.startsWith("api/")), ["api/contexto", "api/sql"]);
});

test("chave recusada (401) pede novo login", async () => {
  globalThis.fetch = async (url) => (url === "api/contexto"
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
    if (url === "api/contexto") return json({ sistema: "x" });
    if (url === "api/sql") return json({ sql: "s", colunas: ["n"], linhas: [[1], [2]], truncado: false });
    modeloPedido = JSON.parse(opt.body).model;
    return rodada++ === 0
      ? json({ model: "a/b", choices: [{ message: { role: "assistant", tool_calls: [{ id: "t", type: "function", function: { name: "consultar_sql", arguments: '{"sql":"SELECT 1"}' } }] } }] })
      : json({ model: "a/b", choices: [{ message: { role: "assistant", content: "ok" } }] });
  };
  const passos = [];
  await responder("p", [], "k", { modelo: "meta/llama:free", aoPasso: (p) => passos.push(p.tipo) });
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
