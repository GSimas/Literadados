"""Testes de aceitação do backend (spec RF-01, RF-12). Rodar: .venv/bin/python -m pytest -q"""
import csv
import json
import shutil
import subprocess
import threading
import urllib.error
import urllib.request
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path

import duckdb
import pytest

import build
import server

RAIZ = Path(__file__).parent.parent


def _csv(p: Path, linhas: list[dict]):
    with p.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(linhas[0]))
        w.writeheader()
        w.writerows(linhas)


@pytest.fixture
def mini(tmp_path):
    """Base mínima válida: 1 edição, 1 categoria com 2 vagas, 1 premiada."""
    d = tmp_path / "dados"
    d.mkdir()
    _csv(d / "editora.csv", [{"id": "ed", "nome": "Ed", "grupo": "", "municipio_sede": "São Paulo", "uf_sede": "SP"}])
    _csv(d / "pessoa.csv", [
        {"id": "a", "nome": "A", "genero": "mulher", "raca": "preta", "raca_evidencia": "autodeclaracao", "raca_fonte": "http://x", "raca_trecho": "sou preta", "ano_nascimento": "1960", "uf_nascimento": "SP"},
        {"id": "b", "nome": "B", "genero": "homem", "raca": "sem_declaracao", "raca_evidencia": "", "raca_fonte": "", "raca_trecho": "", "ano_nascimento": "", "uf_nascimento": "SC"},
    ])
    _csv(d / "obra.csv", [{"id": "o1", "titulo": "O1", "editora_id": "ed", "ano_publicacao": "2015"},
                          {"id": "o2", "titulo": "O2", "editora_id": "ed", "ano_publicacao": "2015"}])
    _csv(d / "autoria.csv", [{"obra_id": "o1", "pessoa_id": "a", "papel": "autor"}, {"obra_id": "o2", "pessoa_id": "b", "papel": "autor"}])
    _csv(d / "categoria_edicao.csv", [
        {"ano": "2016", "nome_original": "Contos e Crônicas", "categoria": "Contos", "vagas_lista": "2", "vagas_curta": "", "vagas_premio": "1", "fonte": "http://x"},
        {"ano": "2017", "nome_original": "Contos e Crônicas", "categoria": "Contos", "vagas_lista": "10", "vagas_curta": "", "vagas_premio": "3", "fonte": "http://x"},
    ])
    _csv(d / "indicacao.csv", [
        {"ano": "2016", "nome_original": "Contos e Crônicas", "obra_id": "o1", "lista_curta": "", "colocacao": "1", "fonte": "http://x"},
        {"ano": "2016", "nome_original": "Contos e Crônicas", "obra_id": "o2", "lista_curta": "", "colocacao": "", "fonte": "http://x"},
    ])
    return d


def _build(d: Path):
    return build.build(d, d.parent / "t.duckdb", d.parent / "t.json")


# ---------- RF-01 ----------

def test_build_gera_banco_e_json(mini):  # CA-01.1, CA-01.4
    p = _build(mini)
    assert (mini.parent / "t.duckdb").exists()
    j = json.loads((mini.parent / "t.json").read_text())
    assert set(j) >= {"participacao", "pessoas", "jurados", "categorias", "ufs", "cobertura", "anos_coletados"}
    assert j["anos_coletados"] == [2016]  # 2017 sem indicações = não coletada, não falha
    assert p["cobertura"][0]["pct_raca"] == 50.0
    linha_a = next(x for x in j["participacao"] if x["pessoa_id"] == "a")
    assert linha_a["vencedora"] is True
    assert next(x for x in j["pessoas"] if x["id"] == "a")["negra"] is True


# ---------- RNF-06 ----------

COMPACTA = {"ano", "nome_original", "obra_id", "pessoa_id", "papel", "lista_curta", "colocacao", "premiada", "vencedora"}


def _expandir_no_node(json_path: Path) -> list[dict]:
    """Roda metricas.expandir (o mesmo código do navegador) sobre o JSON gerado pelo build."""
    node = shutil.which("node")
    if not node:
        pytest.skip("node não instalado")
    js = (f"import * as M from {json.dumps((RAIZ / 'web' / 'metricas.js').as_uri())};"
          f"import {{ readFileSync }} from 'node:fs';"
          f"process.stdout.write(JSON.stringify(M.expandir(JSON.parse(readFileSync({json.dumps(str(json_path))}, 'utf8')))));")
    r = subprocess.run([node, "--input-type=module", "-e", js], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


@pytest.mark.parametrize("base", ["mini", "reais"])
def test_json_compacto_reconstroi_v_participacao(base, mini, tmp_path):  # CA-RNF-06.2
    dados = mini if base == "mini" else RAIZ / "dados"
    db, saida = tmp_path / "c.duckdb", tmp_path / "c.json"
    build.build(dados, db, saida)
    j = json.loads(saida.read_text())
    assert all(set(l) == COMPACTA for l in j["participacao"]), "participação deve ser compacta"
    con = duckdb.connect(str(db), read_only=True)
    esperado = json.loads(json.dumps(build._linhas(con, "SELECT * FROM v_participacao ORDER BY ano, categoria, obra_id, papel, pessoa_id"), default=str))
    con.close()
    obtido = _expandir_no_node(saida)
    assert len(obtido) == len(esperado)
    for o, e in zip(obtido, esperado):
        assert list(o) == list(e)  # mesmas colunas, mesma ordem da view
        assert o == e


def test_json_real_menor_que_1mb(tmp_path):  # CA-RNF-06.1
    build.build(RAIZ / "dados", tmp_path / "r.duckdb", tmp_path / "r.json")
    assert (tmp_path / "r.json").stat().st_size < 1_000_000


def test_build_falha_raca_sem_fonte(mini):  # CA-01.2
    linhas = list(csv.DictReader((mini / "pessoa.csv").open()))
    linhas[1]["raca"] = "parda"
    _csv(mini / "pessoa.csv", linhas)
    with pytest.raises(build.BuildError, match="pessoa.csv"):
        _build(mini)


def test_build_falha_raca_declarada_com_busca_parcial(mini):  # CA-13.3: quem tem raça declarada teve busca completa
    linhas = list(csv.DictReader((mini / "pessoa.csv").open()))
    for l in linhas:
        l["raca_busca"] = "parcial"
    _csv(mini / "pessoa.csv", linhas)
    with pytest.raises(build.BuildError, match="pessoa.csv"):
        _build(mini)


def test_cobertura_mostra_busca_completa(mini):  # CA-13.3
    linhas = list(csv.DictReader((mini / "pessoa.csv").open()))
    linhas[0]["raca_busca"], linhas[1]["raca_busca"] = "completa", "parcial"
    _csv(mini / "pessoa.csv", linhas)
    assert _build(mini)["cobertura"][0]["pct_busca_raca"] == 50.0


def test_build_falha_categoria_fora(mini):  # CA-01.2
    linhas = list(csv.DictReader((mini / "categoria_edicao.csv").open()))
    linhas[0]["categoria"] = "Romance de Entretenimento"
    _csv(mini / "categoria_edicao.csv", linhas)
    with pytest.raises(build.BuildError, match="categoria_edicao.csv"):
        _build(mini)


def test_build_falha_fk_inexistente(mini):  # CA-01.2
    linhas = list(csv.DictReader((mini / "autoria.csv").open()))
    linhas[0]["pessoa_id"] = "fantasma"
    _csv(mini / "autoria.csv", linhas)
    with pytest.raises(build.BuildError, match="autoria.csv"):
        _build(mini)


def test_build_falha_lista_incompleta(mini):  # CA-01.3
    linhas = list(csv.DictReader((mini / "categoria_edicao.csv").open()))
    linhas[0]["vagas_lista"] = "10"
    _csv(mini / "categoria_edicao.csv", linhas)
    with pytest.raises(build.BuildError, match="lista tem 2 obras, esperado 10"):
        _build(mini)


def test_build_falha_premiadas_a_mais(mini):  # CA-01.3
    linhas = list(csv.DictReader((mini / "indicacao.csv").open()))
    linhas[1]["colocacao"] = "2"
    _csv(mini / "indicacao.csv", linhas)
    with pytest.raises(build.BuildError, match="2 premiadas, esperado 1"):
        _build(mini)


def test_obra_so_com_organizador_e_valida(mini):  # CA-01.5: antologia creditada só ao organizador
    _csv(mini / "autoria.csv", [{"obra_id": "o1", "pessoa_id": "a", "papel": "autor"}, {"obra_id": "o2", "pessoa_id": "b", "papel": "organizador"}])
    p = _build(mini)
    con = duckdb.connect(str(mini.parent / "t.duckdb"), read_only=True)
    assert con.execute("SELECT papel FROM v_participacao WHERE pessoa_id = 'b'").fetchall() == [("organizador",)]
    con.close()
    assert p["cobertura"][0]["pessoas"] == 1  # organizador fora da cobertura das pessoas-autoras


def test_build_falha_obra_sem_autor_nem_organizador(mini):  # CA-01.5
    _csv(mini / "autoria.csv", [{"obra_id": "o1", "pessoa_id": "a", "papel": "autor"}, {"obra_id": "o2", "pessoa_id": "b", "papel": "ilustrador"}])
    with pytest.raises(build.BuildError, match="obra sem autor nem organizador: o2"):
        _build(mini)


def test_dados_reais_passam_no_build(tmp_path):
    p = build.build(RAIZ / "dados", tmp_path / "r.duckdb", tmp_path / "r.json")
    assert p["anos_coletados"], "nenhuma edição coletada"
    assert len(p["pessoas"]) > 0


# ---------- RF-12 ----------

@pytest.fixture
def db_mini(mini):
    _build(mini)
    return mini.parent / "t.duckdb"


def test_sql_seguro_aceita_select(db_mini):
    r = server.executar_sql("SELECT COUNT(*) AS n FROM pessoa -- comentário", db_mini)
    assert r["colunas"] == ["n"] and r["linhas"] == [[2]]


@pytest.mark.parametrize("sql", [
    "INSERT INTO pessoa (id, nome) VALUES ('x', 'x')",
    "DELETE FROM pessoa",
    "SELECT 1; DROP TABLE pessoa",
    "SELECT * FROM read_csv('/etc/hosts')",
    "SELECT * FROM 'dados/pessoa.csv'",
    "COPY pessoa TO '/tmp/vazou.csv'",
    "ATTACH '/tmp/x.duckdb'",
    "SET enable_external_access = true",
    "SELECT * FROM query('SELECT 1')",
    "SELECT getenv('HOME')",
    "INSTALL httpfs",
])
def test_sql_seguro_recusa(db_mini, sql):  # CA-12.2
    with pytest.raises((server.SQLRecusado, server.duckdb.Error)):
        server.executar_sql(sql, db_mini)


def test_sql_seguro_banco_somente_leitura_mesmo_sem_filtro(db_mini):  # CA-12.2: a garantia é do banco, não da regex
    con = server.conectar(db_mini)
    for sql in ["DELETE FROM pessoa", "SELECT * FROM read_csv('/etc/hosts')", "SET enable_external_access = true"]:
        with pytest.raises(server.duckdb.Error):
            con.execute(sql)
    con.close()


def test_sql_limita_linhas(db_mini):
    r = server.executar_sql("SELECT * FROM range(1000)", db_mini)
    assert len(r["linhas"]) == server.LIMITE_LINHAS and r["truncado"]


def test_chat_sem_chave_503(db_mini, monkeypatch, tmp_path):  # CA-12.4
    for k in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_PROFILE"):
        monkeypatch.delenv(k, raising=False)
    monkeypatch.setenv("HOME", str(tmp_path))  # sem perfil do `ant auth login`
    monkeypatch.setattr(server, "DB", db_mini)
    web = tmp_path / "web"
    web.mkdir()
    (web / "index.html").write_text("ok")
    srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(server.Handler, directory=str(web)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}"
    try:
        req = urllib.request.Request(url + "/api/chat", data=json.dumps({"pergunta": "quantas mulheres?"}).encode(), method="POST")
        with pytest.raises(urllib.error.HTTPError) as e:
            urllib.request.urlopen(req)
        assert e.value.code == 503 and "ANTHROPIC_API_KEY" in json.loads(e.value.read())["erro"]
        assert urllib.request.urlopen(url + "/index.html").read() == b"ok"  # painel segue funcionando
        req = urllib.request.Request(url + "/api/chat", data=b'{"pergunta": ""}', method="POST")
        with pytest.raises(urllib.error.HTTPError) as e:
            urllib.request.urlopen(req)
        assert e.value.code == 400
    finally:
        srv.shutdown()


def test_ferramenta_do_chat_registra_consultas(db_mini):
    """Sem chamar a API: um cliente falso executa a ferramenta como o Tool Runner faria."""
    class Final:
        stop_reason = "end_turn"
        content = [type("B", (), {"type": "text", "text": "Há 1 mulher."})()]

    class Runner:
        def __init__(self, tools, **_):
            self.tools = tools

        def until_done(self):
            ok = self.tools[0].call({"sql": "SELECT COUNT(*) FROM v_participacao WHERE genero = 'mulher'"})
            erro = self.tools[0].call({"sql": "DROP TABLE pessoa"})
            assert "ERRO" in str(erro) and "[[1]]" in str(ok)
            return Final()

    class Cliente:
        api_key = "falsa"
        beta = type("Beta", (), {"messages": type("M", (), {"tool_runner": staticmethod(lambda **kw: Runner(**kw))})()})()

    server._SISTEMA = None
    r = server.responder("quantas mulheres?", [], client=Cliente(), db=db_mini)
    assert r["resposta"] == "Há 1 mulher."
    assert len(r["consultas"]) == 1 and r["consultas"][0]["linhas"] == [[1]]
    server._SISTEMA = None


def test_perguntas_originais(tmp_path):
    """As três perguntas que motivaram o projeto rodam na base real e devolvem número."""
    build.build(RAIZ / "dados", tmp_path / "r.duckdb", tmp_path / "r.json")
    db = tmp_path / "r.duckdb"
    q1 = server.executar_sql("""SELECT COUNT(DISTINCT pessoa_id) FROM v_participacao
        WHERE raca = 'preta' AND uf_nascimento = 'SP' AND categoria = 'Contos' AND papel = 'autor'""", db)
    q2 = server.executar_sql("""SELECT COUNT(DISTINCT pessoa_id) FROM v_participacao
        WHERE genero = 'mulher' AND regiao_nascimento = 'Nordeste' AND premiada AND papel = 'autor'""", db)
    q3 = server.executar_sql("""SELECT nome, SUM(premiada::INT) AS premios FROM v_participacao
        WHERE uf_nascimento = 'SC' AND papel = 'autor' GROUP BY nome ORDER BY premios DESC""", db)
    assert isinstance(q1["linhas"][0][0], int) and isinstance(q2["linhas"][0][0], int)
    assert q3["colunas"] == ["nome", "premios"]
