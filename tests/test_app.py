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
    with p.open("w", newline="", encoding="utf-8") as f:
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
    j = json.loads((mini.parent / "t.json").read_text(encoding="utf-8"))
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
    r = subprocess.run([node, "--input-type=module", "-e", js], capture_output=True, text=True, encoding="utf-8", check=True)
    return json.loads(r.stdout)


@pytest.mark.parametrize("base", ["mini", "reais"])
def test_json_compacto_reconstroi_v_participacao(base, mini, tmp_path):  # CA-RNF-06.2
    dados = mini if base == "mini" else RAIZ / "dados"
    db, saida = tmp_path / "c.duckdb", tmp_path / "c.json"
    build.build(dados, db, saida)
    j = json.loads(saida.read_text(encoding="utf-8"))
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
    linhas = list(csv.DictReader((mini / "pessoa.csv").open(encoding="utf-8")))
    linhas[1]["raca"] = "parda"
    _csv(mini / "pessoa.csv", linhas)
    with pytest.raises(build.BuildError, match="pessoa.csv"):
        _build(mini)


def test_build_falha_raca_declarada_com_busca_parcial(mini):  # CA-13.3: quem tem raça declarada teve busca completa
    linhas = list(csv.DictReader((mini / "pessoa.csv").open(encoding="utf-8")))
    for l in linhas:
        l["raca_busca"] = "parcial"
    _csv(mini / "pessoa.csv", linhas)
    with pytest.raises(build.BuildError, match="pessoa.csv"):
        _build(mini)


def test_cobertura_mostra_busca_completa(mini):  # CA-13.3
    linhas = list(csv.DictReader((mini / "pessoa.csv").open(encoding="utf-8")))
    linhas[0]["raca_busca"], linhas[1]["raca_busca"] = "completa", "parcial"
    _csv(mini / "pessoa.csv", linhas)
    assert _build(mini)["cobertura"][0]["pct_busca_raca"] == 50.0


@pytest.mark.parametrize("genero,fonte,ok", [
    ("homem", "", True),                    # atribuído pelo nome, sem fonte
    ("nao_identificado", "", False),        # atribuição sem gênero
    ("homem", "http://x", False),           # atribuição com fonte: a fonte substitui a atribuição (D16)
])
def test_genero_atribuido(mini, genero, fonte, ok):  # CA-11.4
    linhas = list(csv.DictReader((mini / "pessoa.csv").open(encoding="utf-8")))
    linhas[1].update(genero=genero, genero_fonte=fonte, genero_evidencia="atribuicao")
    linhas[0].update(genero_fonte="http://x", genero_evidencia="")
    _csv(mini / "pessoa.csv", linhas)
    if not ok:
        with pytest.raises(build.BuildError, match="pessoa.csv"):
            _build(mini)
        return
    j = _build(mini)
    assert [p["genero_evidencia"] for p in sorted(j["pessoas"], key=lambda p: p["id"])] == [None, "atribuicao"]
    con = duckdb.connect(str(mini.parent / "t.duckdb"), read_only=True)
    assert con.execute("SELECT pessoa_id FROM v_participacao WHERE genero_atribuido").fetchall() == [("b",)]


def test_build_falha_categoria_fora(mini):  # CA-01.2
    linhas = list(csv.DictReader((mini / "categoria_edicao.csv").open(encoding="utf-8")))
    linhas[0]["categoria"] = "Romance de Entretenimento"
    _csv(mini / "categoria_edicao.csv", linhas)
    with pytest.raises(build.BuildError, match="categoria_edicao.csv"):
        _build(mini)


def test_build_falha_fk_inexistente(mini):  # CA-01.2
    linhas = list(csv.DictReader((mini / "autoria.csv").open(encoding="utf-8")))
    linhas[0]["pessoa_id"] = "fantasma"
    _csv(mini / "autoria.csv", linhas)
    with pytest.raises(build.BuildError, match="autoria.csv"):
        _build(mini)


def test_build_falha_lista_incompleta(mini):  # CA-01.3
    linhas = list(csv.DictReader((mini / "categoria_edicao.csv").open(encoding="utf-8")))
    linhas[0]["vagas_lista"] = "10"
    _csv(mini / "categoria_edicao.csv", linhas)
    with pytest.raises(build.BuildError, match="lista tem 2 obras, esperado 10"):
        _build(mini)


def test_build_falha_premiadas_a_mais(mini):  # CA-01.3
    linhas = list(csv.DictReader((mini / "indicacao.csv").open(encoding="utf-8")))
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


def test_api_sql_e_contexto(db_mini, monkeypatch, tmp_path):  # CA-12.4: a Diadorim lê o banco só por aqui
    monkeypatch.setattr(server, "DB", db_mini)
    monkeypatch.setattr(server, "_SISTEMA", None)
    web = tmp_path / "web"
    web.mkdir()
    (web / "index.html").write_text("ok", encoding="utf-8")
    srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(server.Handler, directory=str(web)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}"
    post = lambda corpo: urllib.request.urlopen(urllib.request.Request(url + "/api/sql", data=json.dumps(corpo).encode(), method="POST"))
    try:
        r = json.loads(post({"sql": "SELECT COUNT(*) AS n FROM v_participacao WHERE genero = 'mulher'"}).read())
        assert r["colunas"] == ["n"] and r["linhas"] == [[1]]
        for ruim in ["DROP TABLE pessoa", "SELECT 1; SELECT 2", "SELECT * FROM read_csv('/etc/passwd')", "SELECT * FROM tabela_que_nao_existe"]:
            with pytest.raises(urllib.error.HTTPError) as e:
                post({"sql": ruim})
            assert e.value.code == 400 and json.loads(e.value.read())["erro"]
        ctx = json.loads(urllib.request.urlopen(url + "/api/contexto").read())["sistema"]
        assert "v_participacao" in ctx and "piso" in ctx and "genero_atribuido" in ctx
        assert urllib.request.urlopen(url + "/index.html").read() == b"ok"
        assert urllib.request.urlopen(url + "/index.html").headers["Cache-Control"] == "no-cache"
    finally:
        srv.shutdown()


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


def test_build_exporta_midia(mini):  # CA-11.3
    _csv(mini / "pessoa_midia.csv", [
        {"pessoa_id": "a", "imagem": "A.jpg", "imagem_autor": "Fulano", "imagem_licenca": "CC BY-SA 4.0", "imagem_licenca_url": "", "wikipedia_pt": "A"},
        {"pessoa_id": "b", "imagem": "", "imagem_autor": "", "imagem_licenca": "", "imagem_licenca_url": "", "wikipedia_pt": "B (escritor)"},
    ])
    p = _build(mini)
    assert p["midia"] == [
        {"pessoa_id": "a", "imagem": "A.jpg", "imagem_autor": "Fulano", "imagem_licenca": "CC BY-SA 4.0", "wikipedia_pt": "A"},
        {"pessoa_id": "b", "wikipedia_pt": "B (escritor)"},  # campos vazios ficam de fora do JSON
    ]


@pytest.mark.parametrize("linha", [
    {"imagem": "A.jpg", "imagem_autor": "Fulano", "imagem_licenca": "Todos os direitos reservados"},  # licença não livre
    {"imagem": "A.jpg", "imagem_autor": "", "imagem_licenca": "CC BY 4.0"},  # sem autoria
])
def test_midia_exige_licenca_livre(mini, linha):  # CA-11.3
    _csv(mini / "pessoa_midia.csv", [{"pessoa_id": "a", "imagem_licenca_url": "", "wikipedia_pt": "", **linha}])
    with pytest.raises(build.BuildError, match="pessoa_midia"):
        _build(mini)


def test_build_exporta_fontes_por_dominio(mini):  # CA-18.1
    linhas = list(csv.DictReader((mini / "categoria_edicao.csv").open(encoding="utf-8")))
    for l in linhas:
        l["fonte"] = "https://www.premiojabuti.com.br/premiados/"
    _csv(mini / "categoria_edicao.csv", linhas)
    linhas = list(csv.DictReader((mini / "indicacao.csv").open(encoding="utf-8")))
    linhas[0]["fonte"] = "https://web.archive.org/web/2016/https://premiojabuti.com.br/ ; https://www.publishnews.com.br/materias/x"
    _csv(mini / "indicacao.csv", linhas)
    f = {r["dominio"]: r for r in _build(mini)["fontes"]}
    assert f["premiojabuti.com.br"]["registros"] == 2 and f["premiojabuti.com.br"]["grupo"] == "Prêmio Jabuti e CBL"
    assert f["web.archive.org"]["grupo"] == "Arquivo da web (Wayback Machine)"  # as duas URLs da célula contam
    assert f["publishnews.com.br"]["grupo"] == "Imprensa"
    assert "www.premiojabuti.com.br" not in f


def test_malha_uf_tem_27_ufs():  # CA-07.3
    g = json.loads((RAIZ / "web" / "br-uf.json").read_text(encoding="utf-8"))
    ufs = {f["properties"]["uf"] for f in g["features"]}
    con = duckdb.connect()
    con.execute((RAIZ / "schema.sql").read_text(encoding="utf-8"))
    esperadas = {r[0] for r in con.execute("SELECT uf FROM uf WHERE uf <> 'EX'").fetchall()}
    assert len(g["features"]) == 27 and ufs == esperadas
    assert all(f["geometry"]["type"] in ("Polygon", "MultiPolygon") for f in g["features"])
