"""Servidor do Literadados: arquivos de web/ + POST /api/chat (IA texto→SQL). Spec RF-12, design §3."""
import json
import os
import re
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import anthropic
import duckdb
from anthropic import beta_tool

RAIZ = Path(__file__).parent
DB = Path(os.environ.get("JABUTI_DB", RAIZ / "jabuti.duckdb"))
MODELO = "claude-opus-5-5"
LIMITE_LINHAS = 200
TEMPO_LIMITE_S = 5


# ---------- SQL somente leitura (RNF-03) ----------

class SQLRecusado(ValueError):
    pass


PROIBIDO = re.compile(
    r"\b(copy|attach|detach|install|load|pragma|set|reset|call|export|import|create|insert|update|delete|drop|"
    # query()/query_table() executam SQL escrito dentro de uma string e escapariam desta checagem
    r"alter|truncate|vacuum|checkpoint|use)\b|\b(read_\w+|\w+_scan|glob|getenv|query\w*|sniff_\w+)\s*\(",
    re.I,
)


def validar_sql(sql: str) -> str:
    s = re.sub(r"--[^\n]*|/\*.*?\*/", " ", sql, flags=re.S).strip().rstrip(";").strip()
    s_sem_strings = re.sub(r"'(?:[^']|'')*'", "''", s)
    if not s:
        raise SQLRecusado("consulta vazia")
    if ";" in s_sem_strings:
        raise SQLRecusado("apenas um comando por consulta")
    if not re.match(r"(?is)^\s*(select|with)\b", s):
        raise SQLRecusado("apenas SELECT ou WITH")
    if m := PROIBIDO.search(s_sem_strings):
        raise SQLRecusado(f"termo não permitido: {m.group(0).strip()}")
    return s


def conectar(db: Path = DB):
    con = duckdb.connect(str(db), read_only=True, config={"enable_external_access": False})
    con.execute("SET lock_configuration = true")  # a consulta não consegue religar acesso externo
    return con


def executar_sql(sql: str, db: Path = DB) -> dict:
    s = validar_sql(sql)
    con = conectar(db)
    timer = threading.Timer(TEMPO_LIMITE_S, con.interrupt)
    timer.start()
    try:
        cur = con.execute(s)
        linhas = cur.fetchmany(LIMITE_LINHAS + 1)
        colunas = [d[0] for d in cur.description]
    finally:
        timer.cancel()
        con.close()
    truncado = len(linhas) > LIMITE_LINHAS
    linhas = [[v if isinstance(v, (int, float, str, bool, type(None))) else str(v) for v in r] for r in linhas[:LIMITE_LINHAS]]
    return {"sql": s, "colunas": colunas, "linhas": linhas, "truncado": truncado}


# ---------- IA ----------

def _prompt_sistema(db: Path = DB) -> str:
    ddl = (RAIZ / "schema.sql").read_text(encoding="utf-8").split("INSERT INTO uf")[0]
    con = conectar(db)
    anos = [r[0] for r in con.execute("SELECT DISTINCT ano FROM indicacao ORDER BY ano").fetchall()]
    cats = con.execute("SELECT DISTINCT categoria FROM categoria_edicao ORDER BY 1").fetchall()
    con.close()
    return f"""Você é o assistente de dados do Literadados, base sobre o perfil dos autores do Prêmio Jabuti.
Responda sempre em português do Brasil, de forma direta, começando pelo número pedido.

Use a ferramenta consultar_sql para obter qualquer número; nunca responda números de memória.
Regras de análise:
- Recorte da base: Prêmio Jabuti 2010–2025, categorias {", ".join(c[0] for c in cats)}.
- Edições com listas coletadas até agora: {anos}. Se a pergunta envolver outras edições, diga que ainda não foram coletadas.
- Conte autores com papel = 'autor', salvo se a pergunta citar ilustradores. Organizadores (papel = 'organizador') nunca contam como autores.
- "Estado" ou "de SP" etc. significa UF de nascimento (uf_nascimento). Região = regiao_nascimento.
- Etapas: lista (toda linha de indicacao/v_participacao), finalista (lista_curta = 1, só existe de 2019 em diante), premiada (premiada = true: 1º a 3º até 2017, só 1º depois), vencedora (vencedora = true).
- Raça só existe por autodeclaração pública. 'sem_declaracao' NÃO significa branca. A coluna negra agrupa preta, parda e negra (sem especificar).
  Sempre trate contagens de pessoas negras como piso ("pelo menos") e informe quantas pessoas do recorte não têm declaração.
  Perguntas sobre "pretos" devem mostrar também o agrupamento negros, porque muitos autores dizem só "negro".
  raca_busca = 'parcial' significa que a busca de autodeclaração foi interrompida: ali 'sem_declaracao' pode esconder declarações. Mencione quantas pessoas do recorte têm busca parcial.
- Pessoas distintas: COUNT(DISTINCT pessoa_id). Sempre informe o n absoluto junto de percentuais.
- Nunca deduza raça, gênero ou origem de nomes; use apenas o que está no banco.
- genero_atribuido = true: o gênero foi atribuído pelo primeiro nome, sem fonte (pode estar errado). Em respostas sobre gênero,
  informe quantas pessoas do recorte têm gênero atribuído.
- Se a pergunta não for sobre estes dados, diga educadamente que só responde sobre a base do Jabuti.
Formato: um parágrafo curto de resposta, depois observações de cobertura em uma linha se relevante. Não repita o SQL no texto (ele é mostrado à parte).

Esquema (DuckDB):
{ddl}"""


_SISTEMA = None


def responder(pergunta: str, historico: list, client=None, db: Path = DB) -> dict:
    global _SISTEMA
    client = client or anthropic.Anthropic()
    if not any(getattr(client, k, None) for k in ("api_key", "auth_token", "credentials")):
        raise PermissionError("sem credencial")
    _SISTEMA = _SISTEMA or _prompt_sistema(db)
    consultas = []

    @beta_tool
    def consultar_sql(sql: str) -> str:
        """Executa uma consulta SQL somente leitura no banco DuckDB do Prêmio Jabuti e devolve colunas e linhas em JSON.

        Args:
            sql: Um único comando SELECT ou WITH. Prefira a view v_participacao.
        """
        try:
            r = executar_sql(sql, db)
        except (SQLRecusado, duckdb.Error) as e:
            return f"ERRO: {e}"
        consultas.append(r)
        return json.dumps({k: r[k] for k in ("colunas", "linhas", "truncado")}, ensure_ascii=False, default=str)

    mensagens = []
    for h in historico[-6:]:
        mensagens += [{"role": "user", "content": str(h["pergunta"])[:1000]},
                      {"role": "assistant", "content": str(h["resposta"])[:4000]}]
    mensagens.append({"role": "user", "content": pergunta})

    runner = client.beta.messages.tool_runner(
        model=MODELO,
        max_tokens=16000,
        system=[{"type": "text", "text": _SISTEMA, "cache_control": {"type": "ephemeral"}}],
        thinking={"type": "adaptive"},
        output_config={"effort": "medium"},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        tools=[consultar_sql],
        messages=mensagens,
        max_iterations=8,
    )
    final = runner.until_done()
    if final.stop_reason == "refusal":
        raise RuntimeError("o modelo recusou a pergunta")
    texto = "".join(b.text for b in final.content if b.type == "text").strip()
    return {"resposta": texto or "Não consegui formular uma resposta.", "consultas": consultas}


# ---------- HTTP ----------

class Handler(SimpleHTTPRequestHandler):
    def _json(self, status: int, corpo: dict):
        dados = json.dumps(corpo, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(dados)))
        self.end_headers()
        self.wfile.write(dados)

    def do_POST(self):
        if self.path != "/api/chat":
            return self._json(404, {"erro": "não encontrado"})
        try:
            tamanho = int(self.headers.get("Content-Length", 0))
            corpo = json.loads(self.rfile.read(min(tamanho, 100_000)) or b"{}")
            pergunta = str(corpo.get("pergunta", "")).strip()
            historico = [h for h in corpo.get("historico", []) if isinstance(h, dict) and "pergunta" in h and "resposta" in h]
        except (ValueError, AttributeError):
            return self._json(400, {"erro": "JSON inválido"})
        if not pergunta or len(pergunta) > 1000:
            return self._json(400, {"erro": "Escreva uma pergunta de até 1000 caracteres."})
        try:
            return self._json(200, responder(pergunta, historico))
        except PermissionError:
            return self._json(503, {"erro": "O chat precisa de uma credencial da API da Anthropic. Defina ANTHROPIC_API_KEY "
                                             "(ou rode `ant auth login`) e reinicie o servidor. O painel funciona sem ela."})
        except RuntimeError as e:
            return self._json(422, {"erro": f"Não foi possível responder: {e}."})
        except anthropic.APIConnectionError:
            return self._json(502, {"erro": "Sem conexão com a API da Anthropic. Tente de novo."})
        except anthropic.RateLimitError:
            return self._json(502, {"erro": "Limite de uso da API atingido. Tente em instantes."})
        except anthropic.APIStatusError as e:
            return self._json(502, {"erro": f"A API da Anthropic respondeu com erro {e.status_code}."})

    def log_message(self, fmt, *args):
        if "/api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)


def main():
    porta = int(os.environ.get("PORT", 8000))
    if not DB.exists():
        raise SystemExit("jabuti.duckdb não existe. Rode antes: python build.py")
    srv = ThreadingHTTPServer(("127.0.0.1", porta), partial(Handler, directory=str(RAIZ / "web")))
    print(f"Literadados em http://localhost:{porta}")
    srv.serve_forever()


if __name__ == "__main__":
    main()
