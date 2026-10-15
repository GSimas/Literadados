// Banco no navegador para a Diadorim (spec CA-12.4, RNF-07, design D26): DuckDB-WASM carregado sob demanda,
// tabelas a partir dos Parquet do build, views de schema.sql e, só depois, acesso externo desligado e configuração travada.
const VERSAO = "1.32.0";
export const LIMITE_LINHAS = 200;

// Mesmo filtro do antigo server.validar_sql: um único SELECT/WITH, sem escrita nem leitura de arquivo.
const PROIBIDO = /\b(copy|attach|detach|install|load|pragma|set|reset|call|export|import|create|insert|update|delete|drop|alter|truncate|vacuum|checkpoint|use)\b|\b(read_\w+|\w+_scan|glob|getenv|query\w*|sniff_\w+)\s*\(/i;
export class SQLRecusado extends Error {}
export function validarSQL(sql) {
  const s = String(sql).replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, " ").trim().replace(/;\s*$/, "").trim();
  const semStrings = s.replace(/'(?:[^']|'')*'/g, "''");
  if (!s) throw new SQLRecusado("consulta vazia");
  if (semStrings.includes(";")) throw new SQLRecusado("apenas um comando por consulta");
  if (!/^\s*(select|with)\b/i.test(s)) throw new SQLRecusado("apenas SELECT ou WITH");
  const m = semStrings.match(PROIBIDO);
  if (m) throw new SQLRecusado(`termo não permitido: ${m[0].trim()}`);
  return s;
}

// Valores do Arrow → JSON simples: BigInt e inteiros grandes (SUM devolve HUGEINT, um objeto) viram número; o resto, texto.
const simples = (v) => {
  if (v == null || typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v ?? null;
  if (typeof v === "bigint") return Number(v);
  const n = v instanceof Date ? NaN : Number(v);
  return Number.isFinite(n) ? n : String(v);
};

let conexao = null;
async function abrir(aoPasso) {
  aoPasso?.({ tipo: "contexto", texto: "Abrindo o banco do Literadados no navegador (só na primeira pergunta)" });
  const duckdb = await import(`https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@${VERSAO}/+esm`);
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  const urlWorker = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: "text/javascript" }));
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(urlWorker));
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(urlWorker);
  const con = await db.connect();
  const { tabelas } = await fetch("contexto.json").then((r) => r.json());
  for (const t of tabelas) {
    const buf = new Uint8Array(await fetch(`banco/${t}.parquet`).then((r) => { if (!r.ok) throw new Error(`banco/${t}.parquet: ${r.status}`); return r.arrayBuffer(); }));
    await db.registerFileBuffer(`${t}.parquet`, buf);
    await con.query(`CREATE TABLE ${t} AS SELECT * FROM read_parquet('${t}.parquet')`);
  }
  for (const v of (await fetch("banco/views.sql").then((r) => r.text())).split(/;\s*\n/).map((x) => x.trim()).filter(Boolean)) await con.query(v);
  await con.query("SET enable_external_access = false");
  await con.query("SET lock_configuration = true");
  return con;
}

// Executa uma consulta validada; devolve o mesmo formato do antigo /api/sql.
export async function consultarSQL(sql, aoPasso) {
  const s = validarSQL(sql);
  conexao ??= abrir(aoPasso).catch((e) => { conexao = null; throw e; });
  const con = await conexao;
  const res = await con.query(s);
  const colunas = res.schema.fields.map((f) => f.name);
  const todas = res.toArray();
  const linhas = todas.slice(0, LIMITE_LINHAS).map((r) => colunas.map((c) => simples(r[c])));
  return { sql: s, colunas, linhas, truncado: todas.length > LIMITE_LINHAS };
}
