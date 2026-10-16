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
    _csv(d / "premio.csv", [{"id": "jabuti", "nome": "Prêmio Jabuti", "organizador": "CBL", "ano_inicio": "1959", "abrangencia": "nacional", "fonte": "http://x"}])
    _csv(d / "edicao.csv", [{"premio_id": "jabuti", "ano": "2016", "regime": "2010–2017 pódio", "fonte": "http://x"},
                            {"premio_id": "jabuti", "ano": "2017", "regime": "2010–2017 pódio", "fonte": "http://x"}])
    _csv(d / "editora.csv", [{"id": "ed", "nome": "Ed", "grupo": "", "municipio_sede": "São Paulo", "uf_sede": "SP"}])
    _csv(d / "pessoa.csv", [
        {"id": "a", "nome": "A", "genero": "mulher", "raca": "preta", "raca_evidencia": "autodeclaracao", "raca_fonte": "http://x", "raca_trecho": "sou preta", "ano_nascimento": "1960", "uf_nascimento": "SP"},
        {"id": "b", "nome": "B", "genero": "homem", "raca": "sem_declaracao", "raca_evidencia": "", "raca_fonte": "", "raca_trecho": "", "ano_nascimento": "", "uf_nascimento": "SC"},
    ])
    _csv(d / "obra.csv", [{"id": "o1", "titulo": "O1", "editora_id": "ed", "ano_publicacao": "2015"},
                          {"id": "o2", "titulo": "O2", "editora_id": "ed", "ano_publicacao": "2015"}])
    _csv(d / "autoria.csv", [{"obra_id": "o1", "pessoa_id": "a", "papel": "autor"}, {"obra_id": "o2", "pessoa_id": "b", "papel": "autor"}])
    _csv(d / "categoria_edicao.csv", [
        {"premio_id": "jabuti", "ano": "2016", "nome_original": "Contos e Crônicas", "categoria": "Contos", "vagas_lista": "2", "vagas_curta": "", "vagas_premio": "1", "fonte": "http://x"},
        {"premio_id": "jabuti", "ano": "2017", "nome_original": "Contos e Crônicas", "categoria": "Contos", "vagas_lista": "10", "vagas_curta": "", "vagas_premio": "3", "fonte": "http://x"},
    ])
    _csv(d / "indicacao.csv", [
        {"premio_id": "jabuti", "ano": "2016", "nome_original": "Contos e Crônicas", "obra_id": "o1", "lista_curta": "", "colocacao": "1", "fonte": "http://x"},
        {"premio_id": "jabuti", "ano": "2016", "nome_original": "Contos e Crônicas", "obra_id": "o2", "lista_curta": "", "colocacao": "", "fonte": "http://x"},
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
    assert linha_a["colocacao"] == 1  # premiada/vencedora são derivadas da colocação no navegador (metricas.expandir)
    assert next(x for x in j["pessoas"] if x["id"] == "a")["negra"] is True


# ---------- RNF-06 ----------

COMPACTA = {"premio", "ano", "nome_original", "obra_id", "pessoa_id", "papel", "lista_curta", "colocacao", "premiada", "vencedora"}


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
    assert all(set(l) <= COMPACTA for l in j["participacao"]), "participação deve ser compacta"  # campos nulos saem do JSON (RNF-06)
    con = duckdb.connect(str(db), read_only=True)
    esperado = json.loads(json.dumps(build._linhas(con, "SELECT * FROM v_participacao ORDER BY premio, ano, categoria, obra_id, papel, pessoa_id"), default=str))
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
    assert [p.get("genero_evidencia") for p in sorted(j["pessoas"], key=lambda p: p["id"])] == [None, "atribuicao"]
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


# ---------- RF-26 ----------

def _regime_antigo(ano: int) -> str:
    """A regra que era um CASE em v_participacao antes da etapa 0 (D31)."""
    return ("1959–1992 vencedor por categoria" if ano <= 1992 else "1993–2009 pódio" if ano <= 2009
            else "2010–2017 pódio" if ano <= 2017 else "2018 transição" if ano == 2018 else "2019–2025 vencedor único")


def test_etapa0_so_jabuti(tmp_path):  # CA-26.1, CA-26.2: a migração para premio_id não muda o Jabuti
    p = build.build(RAIZ / "dados", tmp_path / "e.duckdb", tmp_path / "e.json")
    con = duckdb.connect(str(tmp_path / "e.duckdb"), read_only=True)
    assert con.execute("SELECT DISTINCT premio, premio_nome FROM v_participacao").fetchall() == [("jabuti", "Prêmio Jabuti")]
    anos = dict(con.execute("SELECT ano, regime FROM edicao WHERE premio_id = 'jabuti'").fetchall())
    assert set(anos) == set(range(1959, 2026)) and all(r == _regime_antigo(a) for a, r in anos.items())
    assert [x["id"] for x in p["premios"]] == ["jabuti"]
    assert all("premio" not in l for l in p["participacao"] + p["edicoes"] + p["categorias"] + p["jurados"])  # padrão fica fora do JSON


def test_build_falha_edicao_antes_do_premio(mini):  # CA-26.1
    linhas = list(csv.DictReader((mini / "edicao.csv").open(encoding="utf-8")))
    _csv(mini / "edicao.csv", linhas + [{**linhas[0], "ano": "1950"}])
    with pytest.raises(build.BuildError, match="jabuti 1950: edição fora do período do prêmio"):
        _build(mini)


def test_build_falha_premio_inexistente(mini):  # CA-26.1
    linhas = list(csv.DictReader((mini / "indicacao.csv").open(encoding="utf-8")))
    linhas[0]["premio_id"] = "fantasma"
    _csv(mini / "indicacao.csv", linhas)
    with pytest.raises(build.BuildError, match="indicacao.csv"):
        _build(mini)


def test_vagas_conferidas_por_premio(mini):  # CA-26.1: mesma edição e categoria em outro prêmio não se misturam
    _csv(mini / "premio.csv", list(csv.DictReader((mini / "premio.csv").open(encoding="utf-8")))
         + [{"id": "outro", "nome": "Outro", "organizador": "X", "ano_inicio": "2000", "abrangencia": "lusofono", "fonte": "http://x"}])
    _csv(mini / "edicao.csv", list(csv.DictReader((mini / "edicao.csv").open(encoding="utf-8")))
         + [{"premio_id": "outro", "ano": "2016", "regime": "único", "fonte": "http://x"}])
    _csv(mini / "categoria_edicao.csv", list(csv.DictReader((mini / "categoria_edicao.csv").open(encoding="utf-8")))
         + [{"premio_id": "outro", "ano": "2016", "nome_original": "Contos e Crônicas", "categoria": "Contos", "vagas_lista": "1", "vagas_curta": "", "vagas_premio": "1", "fonte": "http://x"}])
    _csv(mini / "indicacao.csv", list(csv.DictReader((mini / "indicacao.csv").open(encoding="utf-8")))
         + [{"premio_id": "outro", "ano": "2016", "nome_original": "Contos e Crônicas", "obra_id": "o1", "lista_curta": "", "colocacao": "1", "fonte": "http://x"}])
    p = _build(mini)
    assert [l.get("premio") for l in p["participacao"]].count("outro") == 1  # só o prêmio não padrão aparece no JSON
    con = duckdb.connect(str(mini.parent / "t.duckdb"), read_only=True)
    assert con.execute("SELECT premio, COUNT(*) FROM v_participacao GROUP BY ALL ORDER BY 1").fetchall() == [("jabuti", 2), ("outro", 1)]
    assert p["pessoas_em_varios_premios"] == 1  # a pessoa de o1 está nos dois (CA-26.5)


# ---------- RF-12 ----------

# ---------- banco no navegador (CA-12.4, RNF-07, D26) ----------
# O DuckDB-WASM recria o banco a partir dos Parquet + views.sql; aqui o DuckDB do Python faz o mesmo caminho.

def _banco_do_navegador(web: Path):
    con = duckdb.connect()
    for t in json.loads((web / "contexto.json").read_text(encoding="utf-8"))["tabelas"]:
        con.execute(f"CREATE TABLE {t} AS SELECT * FROM read_parquet('{web / 'banco' / f'{t}.parquet'}')")
    for v in [x.strip() for x in (web / "banco" / "views.sql").read_text(encoding="utf-8").split(";\n") if x.strip()]:
        con.execute(v)
    return con


@pytest.mark.parametrize("base", ["mini", "reais"])
def test_banco_do_navegador_igual_ao_build(base, mini, tmp_path):  # CA-12.4: mesmas linhas e mesmas views
    d = mini if base == "mini" else RAIZ / "dados"
    build.build(d, tmp_path / "r.duckdb", tmp_path / "web" / "dados.json")
    nav, orig = _banco_do_navegador(tmp_path / "web"), duckdb.connect(str(tmp_path / "r.duckdb"), read_only=True)
    for q in ["SELECT COUNT(*), COUNT(DISTINCT pessoa_id), SUM(premiada::INT) FROM v_participacao", "SELECT * FROM v_cobertura ORDER BY ano",
              "SELECT COUNT(*) FROM pessoa WHERE genero_evidencia = 'atribuicao'"]:
        assert nav.execute(q).fetchall() == orig.execute(q).fetchall(), q
    ctx = json.loads((tmp_path / "web" / "contexto.json").read_text(encoding="utf-8"))["sistema"]
    assert "v_participacao" in ctx and "piso" in ctx and "genero_atribuido" in ctx


def test_servidor_local_so_estatico(tmp_path):  # RNF-07: sem /api; cache revalidado
    web = tmp_path / "web"
    web.mkdir()
    (web / "index.html").write_text("ok", encoding="utf-8")
    srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(server.Handler, directory=str(web)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{srv.server_address[1]}"
    try:
        r = urllib.request.urlopen(url + "/index.html")
        assert r.read() == b"ok" and r.headers["Cache-Control"] == "no-cache"
        with pytest.raises(urllib.error.HTTPError):
            urllib.request.urlopen(urllib.request.Request(url + "/api/sql", data=b"{}", method="POST"))
    finally:
        srv.shutdown()


def test_perguntas_originais(tmp_path):
    """As três perguntas que motivaram o projeto rodam na base real (no banco do navegador) e devolvem número."""
    build.build(RAIZ / "dados", tmp_path / "r.duckdb", tmp_path / "web" / "r.json")
    con = _banco_do_navegador(tmp_path / "web")
    q1 = con.execute("""SELECT COUNT(DISTINCT pessoa_id) FROM v_participacao
        WHERE raca = 'preta' AND uf_nascimento = 'SP' AND categoria = 'Contos' AND papel = 'autor'""").fetchone()[0]
    q2 = con.execute("""SELECT COUNT(DISTINCT pessoa_id) FROM v_participacao
        WHERE genero = 'mulher' AND regiao_nascimento = 'Nordeste' AND premiada AND papel = 'autor'""").fetchone()[0]
    q3 = con.execute("""SELECT nome, SUM(premiada::INT) AS premios FROM v_participacao
        WHERE uf_nascimento = 'SC' AND papel = 'autor' GROUP BY nome ORDER BY premios DESC""")
    assert isinstance(q1, int) and isinstance(q2, int)
    assert [d[0] for d in q3.description] == ["nome", "premios"]


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


def test_serie_historica_1959_2025(tmp_path):  # CA-25.1, CA-25.2
    build.build(RAIZ / "dados", tmp_path / "h.duckdb", tmp_path / "h.json")
    j = json.loads((tmp_path / "h.json").read_text(encoding="utf-8"))
    assert j["anos_coletados"] == list(range(1959, 2026))
    assert j["anos"] == [1959, 2025] and "recorte" not in j  # série completa por padrão (CA-25.2)
    con = duckdb.connect(str(tmp_path / "h.duckdb"), read_only=True)
    # toda edição antiga tem premiado em ao menos 3 categorias do recorte, e o Livro do Ano só tem vencedores
    por_ano = dict(con.execute("SELECT ano, COUNT(DISTINCT categoria) FROM v_participacao WHERE ano < 2010 AND premiada GROUP BY ano").fetchall())
    assert set(por_ano) == set(range(1959, 2010)) and min(por_ano.values()) >= 3
    assert con.execute("SELECT COUNT(*) FROM indicacao i JOIN categoria_edicao c USING (premio_id, ano, nome_original) WHERE c.categoria = 'Livro do Ano' AND i.colocacao IS DISTINCT FROM 1").fetchone()[0] == 0
    # editora antiga só com fonte da época: o site oficial atual dá a editora de hoje (Companhia das Letras, fundada em 1986, em 1959)
    assert con.execute("""SELECT COUNT(*) FROM indicacao i JOIN obra o ON o.id = i.obra_id JOIN editora e ON e.id = o.editora_id
                          WHERE i.ano < 1986 AND e.nome ILIKE '%companhia das letras%'""").fetchone()[0] == 0
    assert con.execute("SELECT COUNT(*) FROM indicacao i JOIN obra o ON o.id = i.obra_id WHERE i.ano < 2000 AND o.editora_id IS NOT NULL").fetchone()[0] == 0


def test_textos_sem_periodo_antigo_fixo(tmp_path):  # CA-25.5, T22.6
    """O painel abre na série completa: nenhum texto fixa 2010–2025 como o período do painel."""
    web = RAIZ / "web"
    for arq in ["index.html", "metodo.html", *[p.name for p in web.glob("*.js")]]:
        txt = (web / arq).read_text(encoding="utf-8")
        for proibido in ("Prêmio Jabuti 2010–2025", "2010–2025 · 16 edições", "Entre 2010 e 2025", "Recorte completo: 2010–2025", "Dezesseis edições", "D.recorte"):
            assert proibido not in txt, f"{arq}: {proibido}"
    build.build(RAIZ / "dados", tmp_path / "p.duckdb", tmp_path / "p.json")
    prompt = build.prompt_sistema(duckdb.connect(str(tmp_path / "p.duckdb"), read_only=True))
    assert "Período padrão: a série completa, 1959–2025" in prompt and "usam 2010–2025" not in prompt
