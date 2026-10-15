"""Servidor do Literadados: arquivos de web/ + GET /api/contexto e POST /api/sql para a Diadorim (spec RF-12, design §3 e D20)."""
import json
import os
import re
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import duckdb

RAIZ = Path(__file__).parent
DB = Path(os.environ.get("JABUTI_DB", RAIZ / "jabuti.duckdb"))
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


# ---------- contexto da IA (Diadorim, D20) ----------

def _prompt_sistema(db: Path = DB) -> str:
    ddl = (RAIZ / "schema.sql").read_text(encoding="utf-8").split("INSERT INTO uf")[0]
    con = conectar(db)
    anos = [r[0] for r in con.execute("SELECT DISTINCT ano FROM indicacao ORDER BY ano").fetchall()]
    cats = con.execute("SELECT DISTINCT categoria FROM categoria_edicao ORDER BY 1").fetchall()
    con.close()
    return f"""Você responde sobre o Literadados, base sobre o perfil dos autores do Prêmio Jabuti.
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
Não repita o SQL no texto (ele é mostrado à parte).

Esquema (DuckDB):
{ddl}"""


_SISTEMA = None


def contexto(db: Path = DB) -> str:
    global _SISTEMA
    _SISTEMA = _SISTEMA or _prompt_sistema(db)
    return _SISTEMA


# ---------- HTTP ----------

class Handler(SimpleHTTPRequestHandler):
    def _json(self, status: int, corpo: dict):
        dados = json.dumps(corpo, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(dados)))
        self.end_headers()
        self.wfile.write(dados)

    def do_GET(self):
        if self.path == "/api/contexto":
            return self._json(200, {"sistema": contexto(DB)})
        return super().do_GET()

    def do_POST(self):
        if self.path != "/api/sql":
            return self._json(404, {"erro": "não encontrado"})
        try:
            tamanho = int(self.headers.get("Content-Length", 0))
            sql = str(json.loads(self.rfile.read(min(tamanho, 20_000)) or b"{}").get("sql", ""))
        except (ValueError, AttributeError):
            return self._json(400, {"erro": "JSON inválido"})
        if len(sql) > 10_000:
            return self._json(400, {"erro": "consulta longa demais"})
        try:
            return self._json(200, executar_sql(sql, DB))
        except (SQLRecusado, duckdb.Error) as e:
            return self._json(400, {"erro": str(e)})

    def end_headers(self):
        # Revalida a cada carga (304 se nada mudou): sem isso, módulos ES antigos ficam presos no cache.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

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
