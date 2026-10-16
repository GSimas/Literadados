// Diadorim, a IA do Literadados (spec RF-12, design D20): chat flutuante no navegador, com login OpenRouter (PKCE)
// e o modelo openrouter/free. Contexto em contexto.json e SQL num DuckDB que roda no navegador (banco.js, design D26).
import { $, esc, fecharAnimado, BOTAO_TABELA } from "./ui.js";
import { consultarSQL } from "./banco.js";

const OPENROUTER = "https://openrouter.ai";
const MODELO = "openrouter/free";
const RODADAS = 6;
const CHAVE = "or_chave";
const JANELAS = ["linha-do-tempo", "geografia", "evolucao", "funil", "segregacao", "idade", "editoras", "ranking", "juri", "entre-premios"];
export const SUGESTOES = [
  "Quantos autores pretos nascidos em São Paulo chegaram à lista do Jabuti em Contos?",
  "Quantas mulheres nascidas no Nordeste foram premiadas?",
  "Quais autores nascidos em Santa Catarina foram mais premiados?",
  "Em que categoria a participação de mulheres é maior?",
  "Qual editora teve mais obras premiadas?",
];

// Persona: inspirada na Diadorim de Grande Sertão: Veredas, sem citar trechos do livro (D20).
const PERSONA = `Você é Diadorim, a assistente de inteligência artificial do Literadados.
Sua personagem é inspirada na Diadorim de "Grande Sertão: Veredas", de Guimarães Rosa: firme, leal, corajosa e reservada,
de frases curtas e certeiras, com um leve sabor do falar sertanejo (travessia, vereda, sertão, jagunçagem de dados), sem
exagero e sem nunca prejudicar a clareza. Não cite nem parafraseie trechos do livro. Você é uma IA: se perguntarem, diga
isso, e nunca finja ser gente. Responda sempre em português do Brasil, começando pelo número ou pela resposta pedida
e, em seguida, com contexto: quem são, de onde, quando, e quanto isso pesa no total. Frase curta não é resposta seca.`;

// Resposta seca (CA-12.12): pergunta sobre os dados respondida só com o número. Insiste uma vez com o modelo; se continuar
// seca, o próprio Literadados consulta as linhas por trás do número e monta o contexto (vale para qualquer modelo).
const INSISTIR = `Sua resposta ficou curta demais: só o número não basta. Consulte as linhas por trás dele em v_participacao
(pessoa_id, nome, uf_nascimento, ano, categoria, titulo, colocacao) e reescreva: comece pelo número, diga quem são
(nome com link para o perfil, estado, ano, categoria e obra; até 10, e quantos faltam), compare com o total do recorte
(n e %) e feche com uma frase de leitura. As regras de antes continuam valendo.`;
const MIN_PALAVRAS = 25;
export function respostaSeca(texto) {
  const corpo = String(texto ?? "").replace(/\n\s*(?:[#*_]*\s*)?(?:fontes|referências|referencias|onde conferir)\s*[*_]*\s*:[\s\S]*$/i, "");
  return (corpo.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").match(/[\p{L}\p{N}]+/gu) ?? []).length < MIN_PALAVRAS;
}
// SELECT agregado simples sobre v_participacao → as linhas que ele contou. ponytail: só o caso sem GROUP BY/WITH/UNION;
// outros formatos devolvem null e ficam sem o bloco automático.
export function consultaDeDetalhe(sql) {
  const s = String(sql).replace(/;\s*$/, "").trim();
  if (/\b(group\s+by|union|having|with|join)\b/i.test(s)) return null;
  const m = s.match(/^select\s+([\s\S]+?)\s+from\s+(v_participacao\b[\s\S]*)$/i);
  if (!m || !/\b(count|sum|avg)\s*\(/i.test(m[1])) return null;
  return `SELECT pessoa_id, nome, uf_nascimento, ano, categoria, titulo, colocacao FROM ${m[2].replace(/\s+(order\s+by|limit)\b[\s\S]*$/i, "")} ORDER BY nome, ano LIMIT 200`;
}
// Bloco "Quem são" em Markdown, a partir de uma consulta com pessoa_id e nome (uma linha por participação).
export function blocoContexto(c) {
  const col = (n) => c.colunas.indexOf(n), [iP, iN, iU, iA, iC, iT, iL] = ["pessoa_id", "nome", "uf_nascimento", "ano", "categoria", "titulo", "colocacao"].map(col);
  if (iP < 0 || iN < 0 || !c.linhas.length) return "";
  const pessoas = new Map();
  for (const l of c.linhas) {
    const p = pessoas.get(l[iP]) ?? pessoas.set(l[iP], { nome: l[iN], uf: iU >= 0 ? l[iU] : null, obras: [] }).get(l[iP]);
    const lugar = iL >= 0 && l[iL] != null ? `, ${l[iL]}º lugar` : "";
    if (iA >= 0) p.obras.push(`${l[iA]}${iC >= 0 ? ` · ${l[iC]}` : ""}${iT >= 0 ? ` · *${l[iT]}*` : ""}${lugar}`);
  }
  const lista = [...pessoas].slice(0, 10).map(([id, p]) => `- [${p.nome}](#/pessoa/${id})${p.uf ? ` (${p.uf === "EX" ? "nascida fora do Brasil" : p.uf})` : ""}${p.obras.length ? `: ${p.obras.join("; ")}` : ""}`);
  const resto = pessoas.size - lista.length;
  const ufs = d3Contagem([...pessoas.values()].map((p) => p.uf ?? "sem dado"));
  return `**Quem são** (${pessoas.size} pessoa${pessoas.size === 1 ? "" : "s"}${c.truncado ? ", nas primeiras 200 linhas" : ""}):\n${lista.join("\n")}${resto > 0 ? `\n- … e mais ${resto}.` : ""}`
    + (iU >= 0 ? `\n\n**Por estado de nascimento:** ${ufs.map(([u, n]) => `${u} ${n}`).join(" · ")}.` : "");
}
const d3Contagem = (xs) => [...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map())].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));

const REGRAS_LINK = `Referências (obrigatório): termine toda resposta com uma linha "Fontes:" seguida de links Markdown.
- Pessoas: [Nome](#/pessoa/<pessoa_id>), com o pessoa_id exato vindo de uma consulta. Livros: [Título](#/obra/<obra_id>).
- Gráficos do painel: [Linha do tempo](#/grafico/linha-do-tempo) (composição de cada edição e vencedoras), [Mapa](#/grafico/geografia)
  (UF de nascimento e fluxo região → editora → resultado), [Evolução](#/grafico/evolucao) (composição por edição),
  [Funil](#/grafico/funil) (lista → finalistas → premiadas → vencedoras), [Categorias](#/grafico/segregacao) (índice de Duncan),
  [Idade](#/grafico/idade), [Editoras](#/grafico/editoras), [Ranking](#/grafico/ranking) (mais premiados e indicados), [Júri](#/grafico/juri),
  [Entre prêmios](#/grafico/entre-premios) (quem passa por mais de um prêmio, quando a base tem vários).
- Seções: [Panorama](#panorama), [Autores](#autores), [Método](metodo.html#metodologia), [Referências](metodo.html#referencias).
- Fontes externas: URLs das colunas fonte, genero_fonte, raca_fonte e nascimento_fonte, quando sustentarem a resposta.
Nunca invente URL nem pessoa_id: use só o que vier das consultas. Mostre o n junto de todo percentual.
Nunca cite nomes de tabelas, views ou colunas (v_participacao, pessoa, categoria_edicao, uf_nascimento…) como fonte nem no texto:
quem lê não conhece o banco. Fale das coisas pelo nome comum (lista do Jabuti, lista do Oceanos, perfil da pessoa, estado de nascimento).
- Estados e regiões: [Minas Gerais](#/uf/MG), [Nordeste](#/regiao/Nordeste).`;

// ---------- "Onde conferir" (CA-12.5): referências montadas pelo próprio Literadados, não pelo modelo ----------
// Tira do texto o bloco "Fontes:" do modelo (que às vezes lista tabelas) e devolve só links válidos: os do modelo,
// mais os derivados das consultas (pessoas, UFs, regiões, URLs de fonte, o gráfico ligado ao assunto) e o Método.
const GRAFICO_POR_SQL = [
  [/premiad|vencedor|finalista|lista_curta|colocacao/i, "#/grafico/funil", "Funil"],
  [/categoria/i, "#/grafico/segregacao", "Categorias"],
  [/editora|grupo_editorial/i, "#/grafico/editoras", "Editoras"],
  [/idade_no_premio|ano_nascimento/i, "#/grafico/idade", "Idade"],
  [/uf_nascimento|regiao_nascimento/i, "#/grafico/geografia", "Mapa"],
  [/jurado/i, "#/grafico/juri", "Júri"],
  [/\bpremio\b\s*(?:in|<>|!=)|count\s*\(\s*distinct\s+premio/i, "#/grafico/entre-premios", "Entre prêmios"],
];
export function referencias(texto, consultas = []) {
  const links = new Map();
  const add = (href, rotulo) => { const h = hrefSeguro(href); if (h && !links.has(h)) links.set(h, rotulo); };
  let corpo = String(texto ?? "");
  const m = corpo.match(/\n\s*(?:[#*_]*\s*)?(?:fontes|referências|referencias|onde conferir)\s*[*_]*\s*:?[*_]*\s*(?:\n|$)/i);
  if (m) {
    for (const [, rot, url] of corpo.slice(m.index).matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) add(url, rot);
    corpo = corpo.slice(0, m.index).trimEnd();
  }
  for (const c of consultas) {
    const col = (nome) => c.colunas.indexOf(nome);
    const [iP, iN, iU, iR, iO, iT] = [col("pessoa_id"), col("nome"), col("uf_nascimento"), col("regiao_nascimento"), col("obra_id"), col("titulo")];
    for (const l of c.linhas.slice(0, 8)) {
      if (iP >= 0 && l[iP]) add(`#/pessoa/${l[iP]}`, iN >= 0 && l[iN] ? String(l[iN]) : String(l[iP]));
      if (iO >= 0 && l[iO]) add(`#/obra/${l[iO]}`, iT >= 0 && l[iT] ? String(l[iT]) : String(l[iO]));
      if (iU >= 0 && l[iU] && l[iU] !== "EX") add(`#/uf/${l[iU]}`, String(l[iU]));
      if (iR >= 0 && l[iR] && l[iR] !== "Exterior") add(`#/regiao/${encodeURIComponent(l[iR])}`, String(l[iR]));
      for (const v of l) if (typeof v === "string" && v.startsWith("https://")) add(v.split(" ; ")[0], new URL(v.split(" ; ")[0]).hostname.replace(/^www\./, ""));
    }
    for (const [rx, href, rot] of GRAFICO_POR_SQL) if (rx.test(c.sql)) add(href, rot);
  }
  add("metodo.html#metodologia", "Método");
  return { texto: corpo, links: [...links].map(([href, rotulo]) => ({ href, rotulo })) };
}

const FERRAMENTAS = [{
  type: "function",
  function: {
    name: "consultar_sql",
    description: "Executa uma consulta SQL somente leitura (DuckDB) no banco do Literadados e devolve colunas e linhas (até 200).",
    parameters: { type: "object", properties: { sql: { type: "string", description: "Um único SELECT ou WITH. Prefira a view v_participacao. Além da contagem, traga as linhas (pessoa_id, nome, uf_nascimento, ano, categoria, titulo) para dar contexto." } }, required: ["sql"] },
  },
}];

// ---------- Markdown mínimo e seguro (texto escapado; links só para o painel, metodo.html ou https) ----------
export function hrefSeguro(u) {
  const h = String(u).trim();
  if (/^#\/(pessoa|obra)\/[\w-]+$/.test(h)) return h;
  if (/^#\/uf\/[A-Z]{2}$/.test(h) || /^#\/regiao\/(Norte|Nordeste|Sudeste|Sul|Centro-Oeste)$/.test(h)) return h;
  if (/^#\/grafico\/([\w-]+)$/.test(h)) return JANELAS.includes(h.split("/")[2]) ? h : null;
  if (/^#[\w-]+$/.test(h) || /^metodo\.html(#[\w-]+)?$/.test(h)) return h;
  try { return new URL(h).protocol === "https:" ? h : null; } catch { return null; }
}
function inline(t) {
  return t
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, rot, url) => {
      const h = hrefSeguro(url.replace(/&amp;/g, "&"));
      if (!h) return rot;
      const ext = h.startsWith("https:");
      return `<a class="${ext ? "chip-link" : "link-interno"}" href="${esc(h)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${rot}</a>`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, "$1<i>$2</i>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}
// Markdown linha a linha (CA-12.5): código, tabela, título, linha, citação, listas e parágrafos. O texto é escapado antes;
// só as marcas conhecidas viram HTML, e links passam por hrefSeguro.
const tabelaHTML = (cab, corpo) => `<div class="tabela-exportavel">${BOTAO_TABELA}<div class="rolagem"><table class="tabela"><thead><tr>${cab.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`
  + `<tbody>${corpo.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
export function md(texto) {
  const L = esc(texto).replace(/\r/g, "").split("\n"), out = [];
  const eLista = (l) => /^\s*[-*•]\s+/.test(l), eNum = (l) => /^\s*\d+[.)]\s+/.test(l), eCit = (l) => /^\s*&gt;\s?/.test(l);
  const eSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l ?? "");
  const eTab = (k) => /^\s*\|.*\|\s*$/.test(L[k]) && eSep(L[k + 1]);
  const celulas = (l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => inline(c.trim()));
  const inicioDeBloco = (k) => /^\s*```/.test(L[k]) || eTab(k) || /^\s*#{1,6}\s/.test(L[k]) || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(L[k]) || eCit(L[k]) || eLista(L[k]) || eNum(L[k]) || !L[k].trim();
  let i = 0;
  while (i < L.length) {
    const l = L[i];
    if (/^\s*```/.test(l)) {
      const ini = ++i;
      while (i < L.length && !/^\s*```/.test(L[i])) i++;
      out.push(`<pre><code>${L.slice(ini, i).join("\n")}</code></pre>`);
      i++;
    } else if (eTab(i)) {
      const cab = celulas(l), corpo = [];
      for (i += 2; i < L.length && /^\s*\|/.test(L[i]); i++) corpo.push(celulas(L[i]));
      out.push(tabelaHTML(cab, corpo));
    } else if (/^\s*#{1,6}\s/.test(l)) { out.push(`<h4>${inline(l.replace(/^\s*#{1,6}\s+/, ""))}</h4>`); i++; }
    else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { out.push("<hr>"); i++; }
    else if (eCit(l)) {
      const q = [];
      while (i < L.length && eCit(L[i])) q.push(inline(L[i++].replace(/^\s*&gt;\s?/, "")));
      out.push(`<blockquote>${q.join("<br>")}</blockquote>`);
    } else if (eLista(l) || eNum(l)) {
      const num = eNum(l), teste = num ? eNum : eLista, itens = [];
      while (i < L.length && teste(L[i])) itens.push(inline(L[i++].replace(num ? /^\s*\d+[.)]\s+/ : /^\s*[-*•]\s+/, "")));
      out.push(`<${num ? "ol" : "ul"}>${itens.map((x) => `<li>${x}</li>`).join("")}</${num ? "ol" : "ul"}>`);
    } else if (!l.trim()) i++;
    else {
      const par = [];
      while (i < L.length && (par.length === 0 || !inicioDeBloco(i))) par.push(inline(L[i++]));
      out.push(`<p>${par.join("<br>")}</p>`);
    }
  }
  return out.join("");
}

// ---------- OpenRouter: PKCE (S256) ----------
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const lerChave = () => { try { return localStorage.getItem(CHAVE); } catch { return null; } };

async function entrar() {
  const verificador = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const desafio = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verificador)));
  const estado = b64url(crypto.getRandomValues(new Uint8Array(12)));
  sessionStorage.setItem("or_pkce", JSON.stringify({ verificador, estado }));
  const q = new URLSearchParams({ callback_url: location.origin + location.pathname, code_challenge: desafio, code_challenge_method: "S256", state: estado });
  location.assign(`${OPENROUTER}/auth?${q}`);
}

// Volta do OpenRouter com ?code=…: troca o código pela chave e limpa o endereço.
async function concluirLogin() {
  const q = new URLSearchParams(location.search);
  const codigo = q.get("code"), estado = q.get("state");
  if (!codigo) return null;
  q.delete("code");
  q.delete("state");
  history.replaceState(null, "", `${location.pathname}${q.size ? `?${q}` : ""}${location.hash}`);
  let salvo = null;
  try { salvo = JSON.parse(sessionStorage.getItem("or_pkce")); } catch {}
  sessionStorage.removeItem("or_pkce");
  if (!salvo || estado !== salvo.estado) throw new Error("O login não confere (estado diferente). Tente entrar de novo.");
  const r = await fetch(`${OPENROUTER}/api/v1/auth/keys`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: codigo, code_verifier: salvo.verificador, code_challenge_method: "S256" }),
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok || !corpo.key) throw new Error(`O OpenRouter não entregou a chave (${r.status}).`);
  localStorage.setItem(CHAVE, corpo.key);
  return corpo.key;
}

// ---------- laço de ferramentas ----------
let sistema = null;
async function prompt() {
  if (sistema) return sistema;
  const r = await fetch("contexto.json");
  if (!r.ok) throw new Error("Não achei o contexto do Literadados (contexto.json). Rode python build.py.");
  sistema = `${PERSONA}\n\n${REGRAS_LINK}\n\n${(await r.json()).sistema}`;
  return sistema;
}

// Consulta no banco do navegador; erro de validação ou do DuckDB volta para o modelo como {erro}.
async function consultarBanco(sql, consultas, aoPasso) {
  try {
    const r = await consultarSQL(sql, aoPasso);
    consultas.push(r);
    return { colunas: r.colunas, linhas: r.linhas, truncado: r.truncado };
  } catch (e) {
    return { erro: e.message };
  }
}

// Contexto sem depender do modelo: usa uma consulta que já traga pessoas ou detalha a última contagem simples.
async function contextoDoBanco(consultas, consultar, aoPasso) {
  const comPessoas = consultas.findLast((c) => c.colunas.includes("pessoa_id") && c.colunas.includes("nome") && c.linhas.length);
  if (comPessoas) return blocoContexto(comPessoas);
  const sql = consultas.map((c) => consultaDeDetalhe(c.sql)).findLast(Boolean);
  if (!sql) return "";
  aoPasso({ tipo: "sql", texto: `Consultando o banco: ${sql.slice(0, 140)}${sql.length > 140 ? "…" : ""}` });
  const res = await consultar(sql, consultas, aoPasso);
  if (res.erro) return "";
  consultas.at(-1).auto = true; // marcada na interface como consulta do Literadados
  return blocoContexto({ ...res, sql });
}

// Laço de ferramentas. aoPasso({tipo, texto}) narra cada etapa para a interface (CA-12.9).
export async function responder(pergunta, historico, chave, { modelo = MODELO, aoPasso = () => {}, consultar = consultarBanco } = {}) {
  aoPasso({ tipo: "contexto", texto: "Lendo as regras e o esquema do Literadados" });
  const mensagens = [{ role: "system", content: await prompt() }, ...historico.slice(-12), { role: "user", content: pergunta }];
  const consultas = [];
  let insistiu = false;
  for (let i = 0; i < RODADAS; i++) {
    const ultima = i === RODADAS - 1;
    aoPasso({ tipo: "rodada", texto: i === 0 ? `Pensando com ${modelo}` : ultima ? "Fechando a resposta" : `Pensando de novo com o que o banco devolveu (rodada ${i + 1})` });
    const r = await fetch(`${OPENROUTER}/api/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json", "HTTP-Referer": location.origin, "X-Title": "Literadados" },
      // Na última rodada, sem ferramentas: obriga a fechar a resposta.
      body: JSON.stringify({ model: modelo, messages: mensagens, ...(ultima ? {} : { tools: FERRAMENTAS }) }),
    });
    const corpo = await r.json().catch(() => ({}));
    if (r.status === 401) { const e = new Error("A chave do OpenRouter não vale mais. Entre de novo."); e.sair = true; throw e; }
    if (r.status === 429) throw new Error("Muita pergunta de uma vez para este modelo. Espere um pouco ou troque o modelo na configuração.");
    if (!r.ok) throw new Error(corpo.error?.message ?? `O OpenRouter respondeu com erro ${r.status}.`);
    const msg = corpo.choices?.[0]?.message;
    if (!msg) throw new Error("O modelo não respondeu. Tente de novo.");
    mensagens.push(msg);
    if (!msg.tool_calls?.length) {
      const texto = msg.content ?? "";
      if (consultas.length && respostaSeca(texto)) {
        if (!insistiu && i < RODADAS - 2) {
          insistiu = true;
          aoPasso({ tipo: "rodada", texto: "Resposta seca demais: pedindo contexto ao modelo" });
          mensagens.push({ role: "user", content: INSISTIR });
          continue;
        }
        aoPasso({ tipo: "contexto", texto: "Buscando no banco quem está por trás do número" });
        const contexto = await contextoDoBanco(consultas, consultar, aoPasso);
        aoPasso({ tipo: "escrita", texto: "Escrevendo a resposta" });
        return { texto, contexto, consultas, modelo: corpo.model ?? modelo };
      }
      aoPasso({ tipo: "escrita", texto: "Escrevendo a resposta" });
      return { texto, consultas, modelo: corpo.model ?? modelo };
    }
    for (const tc of msg.tool_calls) {
      let args = {};
      try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}
      if (tc.function?.name !== "consultar_sql" || !args.sql) {
        aoPasso({ tipo: "erro", texto: "O modelo pediu uma ferramenta que não existe" });
        mensagens.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify({ erro: "ferramenta desconhecida" }) });
        continue;
      }
      const sql = String(args.sql);
      aoPasso({ tipo: "sql", texto: `Consultando o banco: ${sql.replace(/\s+/g, " ").slice(0, 140)}${sql.length > 140 ? "…" : ""}` });
      const res = await consultar(sql, consultas, aoPasso);
      aoPasso(res.erro ? { tipo: "erro", texto: `A consulta voltou com erro: ${res.erro}` }
        : { tipo: "resultado", texto: `${res.linhas.length}${res.truncado ? "+" : ""} linha${res.linhas.length === 1 ? "" : "s"} de volta` });
      mensagens.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(res) });
    }
  }
  return { texto: "Andei demais nas consultas e não fechei a resposta. Pergunte de outro jeito, mais direto.", consultas, modelo };
}

// Lista de todos os modelos do OpenRouter (endpoint público). Preço do OpenRouter é por token; aqui, por milhão.
export async function listarModelos() {
  const r = await fetch(`${OPENROUTER}/api/v1/models`);
  if (!r.ok) throw new Error(`Não consegui buscar os modelos (${r.status}).`);
  const { data = [] } = await r.json();
  return data.map((m) => {
    const entrada = Number(m.pricing?.prompt ?? NaN) * 1e6, saida = Number(m.pricing?.completion ?? NaN) * 1e6;
    return { id: m.id, nome: m.name ?? m.id, contexto: m.context_length ?? null, entrada, saida,
      gratis: m.id.endsWith(":free") || (entrada === 0 && saida === 0), ferramentas: (m.supported_parameters ?? []).includes("tools") };
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// ---------- interface ----------
export function montarDiadorim() {
  const painel = $("#diadorim"), botao = $("#diadorim-botao"), conversa = $("#diadorim-conversa"), form = $("#diadorim-form"), campo = $("#diadorim-pergunta");
  const historico = [];
  let ocupado = false;
  let modelo = (() => { try { return localStorage.getItem("dd_modelo") || MODELO; } catch { return MODELO; } })();
  const hora = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const rodape = (extra = "") => `<p class="dd-meta"><time>${hora()}</time>${extra ? ` · ${extra}` : ""}</p>`; // CA-12.8

  const msg = (classe, html) => {
    const div = Object.assign(document.createElement("div"), { className: `dd-msg ${classe}` });
    div.innerHTML = html;
    conversa.append(div);
    conversa.scrollTo({ top: conversa.scrollHeight, behavior: "smooth" });
    return div;
  };
  const estadoLogin = () => {
    const logado = !!lerChave();
    $("#diadorim-entrar").hidden = logado;
    form.hidden = !logado;
    $("#diadorim-sugestoes").hidden = !logado || historico.length > 0;
    $("#diadorim-sair").hidden = !logado;
  };
  const mostrarModelo = () => { $("#diadorim-modelo").textContent = modelo === MODELO ? "roteador gratuito (openrouter/free)" : modelo; };
  // Primeira fala: declara que é IA (CA-12.2).
  const apresentar = () => {
    conversa.innerHTML = "";
    msg("ia", `<p><b>Sou Diadorim, uma inteligência artificial.</b> Não sou gente: sou programa que conversa, e atravesso os dados do Literadados com você.</p>
      <p>Cada número que eu der sai de consulta ao banco, com o caminho para conferir no painel. Posso errar: confira nas fontes.</p>${rodape("Diadorim")}`);
  };
  const abrir = () => {
    if (!painel.hidden) return;
    painel.hidden = false;
    botao.setAttribute("aria-expanded", "true");
    document.body.classList.add("diadorim-aberto");
    (form.hidden ? $("#diadorim-entrar button") : campo).focus();
  };
  const fechar = () => {
    if (painel.hidden) return;
    botao.setAttribute("aria-expanded", "false");
    document.body.classList.remove("diadorim-aberto");
    fecharAnimado(painel);
    botao.focus();
  };

  $("#diadorim-sugestoes").innerHTML = SUGESTOES.map((s) => `<button type="button">${esc(s)}</button>`).join("");
  apresentar();
  mostrarModelo();
  estadoLogin();

  async function perguntar(texto) {
    if (ocupado) return;
    const chave = lerChave();
    if (!chave) return estadoLogin();
    ocupado = true;
    form.querySelector("button").disabled = true;
    $("#diadorim-sugestoes").hidden = true;
    msg("eu", `<p>${esc(texto)}</p>${rodape()}`);
    // Passos ao vivo (CA-12.9): cada etapa entra na lista; a anterior ganha ✓.
    const pend = msg("ia pensando", `<ol class="dd-passos" aria-label="O que a Diadorim está fazendo"></ol>`);
    const passos = pend.querySelector(".dd-passos");
    const aoPasso = ({ tipo, texto: t }) => {
      passos.lastElementChild?.classList.add("feito");
      passos.insertAdjacentHTML("beforeend", `<li class="passo-${tipo}">${esc(t)}</li>`);
      conversa.scrollTo({ top: conversa.scrollHeight, behavior: "smooth" });
    };
    try {
      const r = await responder(texto, historico, chave, { modelo, aoPasso });
      passos.lastElementChild?.classList.add("feito");
      historico.push({ role: "user", content: texto }, { role: "assistant", content: r.contexto ? `${r.texto}\n\n${r.contexto}` : r.texto });
      const ref = referencias(r.texto, r.consultas);
      const ondeConferir = `<div class="dd-conferir"><span>Onde conferir</span>${ref.links.map((l) => {
        const ext = l.href.startsWith("https:");
        return `<a class="${ext ? "chip-link" : "link-interno"}" href="${esc(l.href)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ""}>${esc(l.rotulo)}</a>`;
      }).join("")}</div>`;
      const sqls = r.consultas.map((c, i) => `<details><summary>Consulta ${i + 1}${c.auto ? " (do Literadados, para dar contexto)" : ""}${c.truncado ? " (primeiras 200 linhas)" : ""}</summary><pre>${esc(c.sql)}</pre>
        <div class="tabela-exportavel">${BOTAO_TABELA}<div class="rolagem"><table class="tabela"><thead><tr>${c.colunas.map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead>
        <tbody>${c.linhas.slice(0, 30).map((l) => `<tr>${l.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div></details>`).join("");
      pend.classList.remove("pensando");
      pend.innerHTML = md(ref.texto) + (r.contexto ? `<div class="dd-contexto">${md(r.contexto)}<p class="dd-meta">Contexto montado pelo Literadados a partir do banco, porque a resposta do modelo veio só com o número.</p></div>` : "") + ondeConferir + sqls
        + `<details class="dd-passos-fim"><summary>Passos (${passos.children.length})</summary>${passos.outerHTML}</details>`
        + rodape(`modelo: <b>${esc(r.modelo ?? modelo)}</b> · ${r.consultas.length} consulta${r.consultas.length === 1 ? "" : "s"} ao banco`);
    } catch (e) {
      pend.classList.remove("pensando");
      pend.classList.add("erro");
      pend.innerHTML = `<p>${esc(e.message)}</p>${rodape(`modelo: ${esc(modelo)}`)}`;
      if (e.sair) { localStorage.removeItem(CHAVE); estadoLogin(); }
    } finally {
      ocupado = false;
      form.querySelector("button").disabled = false;
      conversa.scrollTo({ top: conversa.scrollHeight, behavior: "smooth" });
    }
  }

  // ---------- configuração do modelo (CA-12.11) ----------
  const config = $("#diadorim-config"), listaModelos = $("#dd-modelos");
  let modelos = null;
  const preco = (v) => (Number.isFinite(v) ? (v === 0 ? "grátis" : `US$ ${v < 1 ? v.toFixed(2) : v.toFixed(1)}`) : "?");
  const desenharModelos = () => {
    const termo = $("#dd-modelo-busca").value.trim().toLowerCase(), soGratis = $("#dd-so-gratis").checked, soTools = $("#dd-so-tools").checked;
    const roteador = { id: MODELO, nome: "Roteador gratuito do OpenRouter (padrão)", contexto: null, entrada: 0, saida: 0, gratis: true, ferramentas: true };
    const lista = [roteador, ...(modelos ?? []).filter((m) => m.id !== MODELO)]
      .filter((m) => (!soGratis || m.gratis) && (!soTools || m.ferramentas) && (!termo || `${m.nome} ${m.id}`.toLowerCase().includes(termo)));
    $("#dd-modelos-n").textContent = modelos ? `${lista.length} de ${modelos.length + 1} modelos` : "buscando modelos…";
    listaModelos.innerHTML = lista.slice(0, 300).map((m) => `<li role="option" aria-selected="${m.id === modelo}" data-id="${esc(m.id)}" tabindex="0">
        <b>${esc(m.nome)}</b><code>${esc(m.id)}</code>
        <small>${m.gratis ? "grátis" : `${preco(m.entrada)} / ${preco(m.saida)} por milhão de tokens`}${m.contexto ? ` · contexto ${fmtK(m.contexto)}` : ""}${m.ferramentas ? " · ferramentas" : " · sem ferramentas"}</small></li>`).join("")
      || `<li class="muted">Nenhum modelo com esses filtros.</li>`;
  };
  const fmtK = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : `${Math.round(n / 1000)}k`);
  const abrirConfig = async () => {
    config.hidden = false;
    $("#diadorim-config-botao").setAttribute("aria-expanded", "true");
    $("#dd-modelo-busca").focus();
    desenharModelos();
    if (!modelos) {
      try { modelos = await listarModelos(); } catch (e) { $("#dd-modelos-n").textContent = e.message; return; }
      desenharModelos();
    }
  };
  const fecharConfig = () => { if (config.hidden) return; $("#diadorim-config-botao").setAttribute("aria-expanded", "false"); fecharAnimado(config); };
  const escolher = (id) => {
    const m = id === MODELO ? null : modelos?.find((x) => x.id === id);
    modelo = id;
    try { localStorage.setItem("dd_modelo", id); } catch {}
    mostrarModelo();
    fecharConfig();
    msg("ia", `<p>Agora respondo com <b>${esc(id)}</b>.${m && !m.ferramentas ? " Atenção: este modelo não usa ferramentas, então não consegue consultar o banco." : ""}</p>${rodape("Diadorim")}`);
  };
  $("#diadorim-config-botao").addEventListener("click", () => (config.hidden ? abrirConfig() : fecharConfig()));
  config.querySelector("[data-config-fechar]").addEventListener("click", fecharConfig);
  for (const id of ["#dd-modelo-busca", "#dd-so-gratis", "#dd-so-tools"]) $(id).addEventListener("input", desenharModelos);
  listaModelos.addEventListener("click", (e) => { const li = e.target.closest("li[data-id]"); if (li) escolher(li.dataset.id); });
  listaModelos.addEventListener("keydown", (e) => {
    const li = e.target.closest("li[data-id]");
    if (!li) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); escolher(li.dataset.id); }
    if (e.key === "ArrowDown") { e.preventDefault(); li.nextElementSibling?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); (li.previousElementSibling ?? $("#dd-modelo-busca")).focus(); }
  });

  // ---------- nova conversa (CA-12.10) ----------
  $("#diadorim-nova").addEventListener("click", () => {
    if (ocupado) return;
    historico.length = 0;
    apresentar();
    estadoLogin();
    campo.focus();
  });

  botao.addEventListener("click", () => (painel.hidden ? abrir() : fechar()));
  $("#diadorim-fechar").addEventListener("click", fechar);
  painel.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); if (!config.hidden) fecharConfig(); else fechar(); } });
  $("#diadorim-entrar button").addEventListener("click", () => entrar().catch((e) => msg("ia erro", `<p>${esc(e.message)}</p>${rodape()}`)));
  $("#diadorim-sair").addEventListener("click", () => {
    try { localStorage.removeItem(CHAVE); } catch {}
    estadoLogin();
    msg("ia", `<p>Saiu. A chave do OpenRouter foi apagada deste navegador.</p>${rodape("Diadorim")}`);
  });
  $("#diadorim-sugestoes").addEventListener("click", (e) => { if (e.target.matches("button")) perguntar(e.target.textContent); });
  form.addEventListener("submit", (e) => { e.preventDefault(); const t = campo.value.trim(); if (t) { campo.value = ""; perguntar(t); } });
  campo.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  // Link interno numa resposta: no celular o painel cobre a tela, então fecha para mostrar o destino.
  conversa.addEventListener("click", (e) => { if (e.target.closest("a.link-interno") && matchMedia("(max-width: 640px)").matches) fechar(); });

  concluirLogin().then((k) => { if (k) { estadoLogin(); abrir(); msg("ia", `<p>Entrou. Pode perguntar.</p>${rodape("Diadorim")}`); } })
    .catch((e) => { abrir(); msg("ia erro", `<p>${esc(e.message)}</p>${rodape()}`); });
}
