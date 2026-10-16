"""Testes de aceitação do backend (spec RF-01, RF-12). Rodar: .venv/bin/python -m pytest -q"""
import csv
import json
import re
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
        w = csv.DictWriter(f, fieldnames=list(dict.fromkeys(k for l in linhas for k in l)))  # colunas de todas as linhas
        w.writeheader()
        w.writerows(linhas)


@pytest.fixture
def mini(tmp_path):
    """Base mínima válida: 1 edição, 1 categoria com 2 vagas, 1 premiada."""
    d = tmp_path / "dados"
    d.mkdir()
    _csv(d / "premio.csv", [{"id": "jabuti", "nome": "Prêmio Jabuti", "organizador": "CBL", "ano_inicio": "1959", "abrangencia": "nacional", "ordem": "1", "fonte": "http://x"}])
    _csv(d / "edicao.csv", [{"premio_id": "jabuti", "ano": "2016", "regime": "2010–2017 pódio", "fonte": "http://x"},
                            {"premio_id": "jabuti", "ano": "2017", "regime": "2010–2017 pódio", "fonte": "http://x"}])
    _csv(d / "editora.csv", [{"id": "ed", "nome": "Ed", "grupo": "", "municipio_sede": "São Paulo", "uf_sede": "SP"}])
    _csv(d / "pessoa.csv", [
        {"id": "a", "nome": "A", "genero": "mulher", "raca": "preta", "raca_evidencia": "autodeclaracao", "raca_fonte": "http://x", "raca_trecho": "sou preta", "ano_nascimento": "1960", "uf_nascimento": "SP"},
        {"id": "b", "nome": "B", "genero": "homem", "raca": "sem_declaracao", "raca_evidencia": "", "raca_fonte": "", "raca_trecho": "", "ano_nascimento": "", "uf_nascimento": "SC"},
    ])
    _csv(d / "obra.csv", [{"id": "o1", "titulo": "O1", "editora_id": "ed", "ano_publicacao": "2015"},
                          {"id": "o2", "titulo": "O2", "editora_id": "ed", "ano_publicacao": "2015"}])
    _csv(d / "autoria.csv", [{"premio_id": "jabuti", "obra_id": "o1", "pessoa_id": "a", "papel": "autor"}, {"premio_id": "jabuti", "obra_id": "o2", "pessoa_id": "b", "papel": "autor"}])
    _csv(d / "categoria_edicao.csv", [
        {"premio_id": "jabuti", "ano": "2016", "nome_original": "Contos e Crônicas", "categoria": "Contos", "vagas_lista": "2", "vagas_curta": "", "vagas_premio": "1", "etapa_lista": "finalistas", "fonte": "http://x"},
        {"premio_id": "jabuti", "ano": "2017", "nome_original": "Contos e Crônicas", "categoria": "Contos", "vagas_lista": "10", "vagas_curta": "", "vagas_premio": "3", "etapa_lista": "finalistas", "fonte": "http://x"},
    ])
    _csv(d / "indicacao.csv", [
        {"premio_id": "jabuti", "ano": "2016", "nome_original": "Contos e Crônicas", "obra_id": "o1", "lista_curta": "", "colocacao": "1", "editora_id": "ed", "fonte": "http://x"},
        {"premio_id": "jabuti", "ano": "2016", "nome_original": "Contos e Crônicas", "obra_id": "o2", "lista_curta": "", "colocacao": "", "editora_id": "ed", "fonte": "http://x"},
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

COMPACTA = {"premio", "editora_id", "ano", "nome_original", "obra_id", "pessoa_id", "papel", "lista_curta", "colocacao", "premiada", "vencedora"}


def _expandir_no_node(json_path: Path) -> list[dict]:
    """Roda metricas.expandir (o mesmo código do navegador) sobre o JSON gerado pelo build."""
    node = shutil.which("node")
    if not node:
        pytest.skip("node não instalado")
    js = (f"import * as M from {json.dumps((RAIZ / 'web' / 'metricas.js').as_uri())};"
          f"import {{ readFileSync }} from 'node:fs';"
          f"const ler = (a) => JSON.parse(readFileSync(a, 'utf8'));"
          f"const D = ler({json.dumps(str(json_path))});"
          f"const partes = (D.partes ?? []).map((n) => ler({json.dumps(str(json_path.parent))} + '/' + n));"  # CA-26.14
          f"process.stdout.write(JSON.stringify(M.expandir(M.juntar(D, partes))));")
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
    _csv(mini / "autoria.csv", [{"premio_id": "jabuti", "obra_id": "o1", "pessoa_id": "a", "papel": "autor"}, {"premio_id": "jabuti", "obra_id": "o2", "pessoa_id": "b", "papel": "organizador"}])
    p = _build(mini)
    con = duckdb.connect(str(mini.parent / "t.duckdb"), read_only=True)
    assert con.execute("SELECT papel FROM v_participacao WHERE pessoa_id = 'b'").fetchall() == [("organizador",)]
    con.close()
    assert p["cobertura"][0]["pessoas"] == 1  # organizador fora da cobertura das pessoas-autoras


def test_build_falha_obra_sem_autor_nem_organizador(mini):  # CA-01.5
    _csv(mini / "autoria.csv", [{"premio_id": "jabuti", "obra_id": "o1", "pessoa_id": "a", "papel": "autor"}, {"premio_id": "jabuti", "obra_id": "o2", "pessoa_id": "b", "papel": "ilustrador"}])
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
    # O Jabuti continua sendo o padrão e o mesmo de antes, com ou sem outros prêmios na base.
    assert ("jabuti", "Prêmio Jabuti") in con.execute("SELECT DISTINCT premio, premio_nome FROM v_participacao").fetchall()
    anos = dict(con.execute("SELECT ano, regime FROM edicao WHERE premio_id = 'jabuti'").fetchall())
    assert set(anos) == set(range(1959, 2026)) and all(r == _regime_antigo(a) for a, r in anos.items())
    assert p["premios"][0]["id"] == "jabuti"
    n_jabuti = con.execute("SELECT COUNT(*) FROM v_participacao WHERE premio = 'jabuti'").fetchone()[0]
    assert sum("premio" not in l for l in p["participacao"]) == n_jabuti  # padrão fica fora do JSON
    assert all(x.get("premio") != "jabuti" for x in p["edicoes"] + p["categorias"] + p["jurados"])


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


def _dois_premios(mini):
    """mini + um 2º prêmio ("outro") com a obra o1 (mesma pessoa) e uma obra nova de pessoa nova (nascida em Portugal)."""
    def mais(nome, linhas):
        _csv(mini / f"{nome}.csv", list(csv.DictReader((mini / f"{nome}.csv").open(encoding="utf-8"))) + linhas)
    mais("premio", [{"id": "outro", "nome": "Outro", "organizador": "X", "ano_inicio": "2000", "abrangencia": "lusofono", "ordem": "2", "fonte": "https://outro.example/"}])
    mais("edicao", [{"premio_id": "outro", "ano": "2016", "regime": "único", "fonte": "https://outro.example/2016"}])
    mais("categoria_edicao", [{"premio_id": "outro", "ano": "2016", "nome_original": "Prêmio", "categoria": "Geral", "vagas_lista": "2", "vagas_curta": "",
                               "vagas_premio": "1", "etapa_lista": "semifinalistas", "fonte": "https://outro.example/2016"}])
    mais("pessoa", [{"id": "c", "nome": "C", "genero": "mulher", "raca": "sem_declaracao", "uf_nascimento": "EX", "pais_nascimento": "PT"}])
    mais("editora", [{"id": "pt", "nome": "Ed (PT)", "grupo": "", "municipio_sede": "", "uf_sede": "EX"}])
    mais("obra", [{"id": "o3", "titulo": "O3", "editora_id": "pt", "ano_publicacao": "2015"}])
    mais("autoria", [{"premio_id": "outro", "obra_id": "o3", "pessoa_id": "c", "papel": "autor"}, {"premio_id": "outro", "obra_id": "o1", "pessoa_id": "a", "papel": "autor"},
                     {"premio_id": "outro", "obra_id": "o1", "pessoa_id": "c", "papel": "autor"}])  # o "outro" credita C também em o1
    mais("indicacao", [{"premio_id": "outro", "ano": "2016", "nome_original": "Prêmio", "obra_id": "o1", "lista_curta": "", "colocacao": "1", "editora_id": "pt", "fonte": "https://outro.example/2016"},
                       {"premio_id": "outro", "ano": "2016", "nome_original": "Prêmio", "obra_id": "o3", "lista_curta": "", "colocacao": "", "editora_id": "pt", "fonte": "https://outro.example/2016"}])


def test_json_dividido_por_premio(mini, tmp_path):  # CA-26.14: um arquivo por prêmio, e o navegador remonta tudo
    so_jabuti = tmp_path / "so_jabuti"
    shutil.copytree(mini, so_jabuti)
    _dois_premios(mini)
    db, saida = tmp_path / "d.duckdb", tmp_path / "d.json"
    p = build.build(mini, db, saida)
    base = json.loads(saida.read_text(encoding="utf-8"))
    parte = json.loads((tmp_path / "d-outro.json").read_text(encoding="utf-8"))
    assert base["partes"] == ["d-outro.json"] and parte["premio"] == "outro"
    assert all("premio" not in l for l in base["participacao"]) and all(l["premio"] == "outro" for l in parte["participacao"])
    assert [x["id"] for x in parte["pessoas"]] == ["c"]  # "a" já está na base: não se repete
    assert {e["id"] for e in parte["editoras"]} == {"pt"} and len(base["participacao"]) + len(parte["participacao"]) == len(p["participacao"])
    con = duckdb.connect(str(db), read_only=True)
    esperado = json.loads(json.dumps(build._linhas(con, "SELECT * FROM v_participacao ORDER BY premio, ano, categoria, obra_id, papel, pessoa_id"), default=str))
    obtido = sorted(_expandir_no_node(saida), key=lambda l: (l["premio"], l["ano"], l["categoria"], l["obra_id"], l["papel"], l["pessoa_id"]))
    assert obtido == esperado
    # Com um prêmio só, nenhuma parte (e uma parte velha é apagada).
    build.build(so_jabuti, tmp_path / "s.duckdb", saida)
    assert not (tmp_path / "d-outro.json").exists() and "partes" not in json.loads(saida.read_text(encoding="utf-8"))


def test_outro_premio_nao_muda_o_jabuti(mini, tmp_path):  # gauntlet 2: o crédito de um prêmio não vaza para o outro
    antes = build.build(mini, tmp_path / "a.duckdb", tmp_path / "a.json")
    q = "SELECT * EXCLUDE (premio_nome) FROM v_participacao WHERE premio = 'jabuti' ORDER BY ALL"
    linhas_antes = duckdb.connect(str(tmp_path / "a.duckdb"), read_only=True).execute(q).fetchall()
    _dois_premios(mini)  # o "outro" credita a pessoa C como coautora de o1
    depois = build.build(mini, tmp_path / "b.duckdb", tmp_path / "b.json")
    assert duckdb.connect(str(tmp_path / "b.duckdb"), read_only=True).execute(q).fetchall() == linhas_antes
    k = lambda p: {kk: v for kk, v in M_kpis(p).items() if kk != "premios"}
    assert k(antes) == k(depois)  # KPIs do Jabuti filtrado iguais


def M_kpis(payload):
    """KPIs do Jabuti (padrão) pela mesma metricas.kpis do navegador, sobre o JSON gerado."""
    node = shutil.which("node")
    if not node:
        pytest.skip("node não instalado")
    js = (f"import * as M from {json.dumps((RAIZ / 'web' / 'metricas.js').as_uri())};"
          f"const D = {json.dumps(json.loads(json.dumps(payload, default=str)))};"
          f"const L = M.filtrar(M.expandir(D), {{ premios: [D.premios[0].id] }});"
          f"process.stdout.write(JSON.stringify(M.kpis(L)));")
    r = subprocess.run([node, "--input-type=module", "-e", js], capture_output=True, text=True, encoding="utf-8", check=True)
    return json.loads(r.stdout)


def test_build_avisa_qid_repetido(mini, tmp_path):  # gauntlet 3: mesma pessoa com duas grafias (Lygia Bojunga / Lygia Bojunga Nunes)
    linhas = list(csv.DictReader((mini / "pessoa.csv").open(encoding="utf-8")))
    for l in linhas:
        l["wikidata"] = "Q1"
    _csv(mini / "pessoa.csv", linhas)
    p = build.build(mini, tmp_path / "q.duckdb", tmp_path / "q.json")
    assert p["qids_repetidos"] == {"Q1": ["a", "b"]}
    assert "qids_repetidos" not in json.loads((tmp_path / "q.json").read_text(encoding="utf-8"))


def test_cobertura_e_prompt_por_premio(mini, tmp_path):  # CA-26.7, CA-26.13
    _dois_premios(mini)
    p = build.build(mini, tmp_path / "c.duckdb", tmp_path / "c.json")
    cob = {(c.get("premio", "jabuti"), c["ano"]): c["pessoas"] for c in p["cobertura"]}
    assert cob == {("jabuti", 2016): 2, ("outro", 2016): 2}  # a mesma pessoa conta em cada prêmio, separado
    con = duckdb.connect(str(tmp_path / "c.duckdb"), read_only=True)
    prompt = build.prompt_sistema(con)
    assert "Prêmio Jabuti e Outro" in prompt and "premio = 'outro'" in prompt and "nunca some" in prompt
    assert "Formatos: único (2016)." in prompt  # o formato (regime) de cada prêmio vai no prompt
    assert {f["grupo"] for f in p["fontes"] if f["dominio"] == "outro.example"} == {"Outro"}  # RF-18: grupo do próprio prêmio


@pytest.mark.parametrize("uf,pais,ok", [
    ("EX", "PT", True),   # nascida fora do Brasil: país ISO
    ("EX", "", True),     # fora do Brasil, país ainda sem fonte
    ("SP", "PT", False),  # país só com uf 'EX'
    ("EX", "BR", False),  # 'BR' é derivado da UF, nunca gravado
    ("EX", "pt", False),  # ISO alfa-2 em maiúsculas
])
def test_pais_de_nascimento(mini, uf, pais, ok):  # DA-3
    linhas = list(csv.DictReader((mini / "pessoa.csv").open(encoding="utf-8")))
    linhas[1].update(uf_nascimento=uf, pais_nascimento=pais)
    _csv(mini / "pessoa.csv", linhas)
    if not ok:
        with pytest.raises(build.BuildError, match="pessoa.csv"):
            _build(mini)
        return
    _build(mini)
    con = duckdb.connect(str(mini.parent / "t.duckdb"), read_only=True)
    assert con.execute("SELECT pessoa_id, pais_nascimento, regiao_nascimento FROM v_participacao ORDER BY 1").fetchall() == [
        ("a", "BR", "Sudeste"), ("b", pais or None, "Exterior")]


def test_editora_da_indicacao(mini, tmp_path):  # CA-26.6: a edição que concorreu vale no lugar da editora da obra
    _csv(mini / "editora.csv", list(csv.DictReader((mini / "editora.csv").open(encoding="utf-8")))
         + [{"id": "pt", "nome": "Editora PT", "grupo": "", "municipio_sede": "", "uf_sede": "EX"}])
    linhas = list(csv.DictReader((mini / "indicacao.csv").open(encoding="utf-8")))
    linhas[1]["editora_id"] = "pt"
    _csv(mini / "indicacao.csv", linhas)
    p = _build(mini)
    con = duckdb.connect(str(mini.parent / "t.duckdb"), read_only=True)
    assert con.execute("SELECT obra_id, editora FROM v_participacao ORDER BY 1").fetchall() == [("o1", "Ed"), ("o2", "Editora PT")]
    assert [l.get("editora_id") for l in p["participacao"]] == [None, "pt"]
    assert [l["editora"] for l in _expandir_no_node(mini.parent / "t.json")] == ["Ed", "Editora PT"]


def test_indicacao_sem_editora_nao_herda_da_obra(mini):  # CA-26.6: sem fonte da época, fica sem editora
    linhas = list(csv.DictReader((mini / "indicacao.csv").open(encoding="utf-8")))
    linhas[1]["editora_id"] = ""
    _csv(mini / "indicacao.csv", linhas)
    p = _build(mini)
    con = duckdb.connect(str(mini.parent / "t.duckdb"), read_only=True)
    assert con.execute("SELECT obra_id, editora FROM v_participacao ORDER BY 1").fetchall() == [("o1", "Ed"), ("o2", None)]
    assert [l.get("editora_id") for l in p["participacao"]] == [None, ""]  # "" = sem editora, embora a obra tenha
    assert [l["editora"] for l in _expandir_no_node(mini.parent / "t.json")] == ["Ed", None]


def test_premio_padrao_e_a_ordem_1(mini):  # DA-4: um prêmio mais antigo não vira o padrão
    _csv(mini / "premio.csv", list(csv.DictReader((mini / "premio.csv").open(encoding="utf-8")))
         + [{"id": "antigo", "nome": "Antigo", "organizador": "X", "ano_inicio": "1900", "abrangencia": "nacional", "ordem": "2", "fonte": "http://x"}])
    assert [x["id"] for x in _build(mini)["premios"]] == ["jabuti", "antigo"]
    _csv(mini / "premio.csv", [{**l, "ordem": "1"} for l in csv.DictReader((mini / "premio.csv").open(encoding="utf-8"))])
    with pytest.raises(build.BuildError, match="premio.csv"):  # ordem repetida
        _build(mini)


@pytest.mark.parametrize("campo,valor,ok", [("categoria", "Geral", True), ("etapa_lista", "semifinalistas", True),
                                            ("etapa_lista", "", False), ("etapa_lista", "longlist", False)])
def test_taxonomia_e_etapa_lista(mini, campo, valor, ok):  # CA-26.3, CA-26.4
    linhas = list(csv.DictReader((mini / "categoria_edicao.csv").open(encoding="utf-8")))
    linhas[0][campo] = valor
    _csv(mini / "categoria_edicao.csv", linhas)
    if ok:
        _build(mini)
    else:
        with pytest.raises(build.BuildError, match="categoria_edicao.csv"):
            _build(mini)


def test_vagas_conferidas_por_premio(mini):  # CA-26.1: mesma edição e categoria em outro prêmio não se misturam
    _csv(mini / "premio.csv", list(csv.DictReader((mini / "premio.csv").open(encoding="utf-8")))
         + [{"id": "outro", "nome": "Outro", "organizador": "X", "ano_inicio": "2000", "abrangencia": "lusofono", "ordem": "2", "fonte": "http://x"}])
    _csv(mini / "edicao.csv", list(csv.DictReader((mini / "edicao.csv").open(encoding="utf-8")))
         + [{"premio_id": "outro", "ano": "2016", "regime": "único", "fonte": "http://x"}])
    _csv(mini / "categoria_edicao.csv", list(csv.DictReader((mini / "categoria_edicao.csv").open(encoding="utf-8")))
         + [{"premio_id": "outro", "ano": "2016", "nome_original": "Contos e Crônicas", "categoria": "Contos", "vagas_lista": "1", "vagas_curta": "", "vagas_premio": "1", "etapa_lista": "finalistas", "fonte": "http://x"}])
    _csv(mini / "indicacao.csv", list(csv.DictReader((mini / "indicacao.csv").open(encoding="utf-8")))
         + [{"premio_id": "outro", "ano": "2016", "nome_original": "Contos e Crônicas", "obra_id": "o1", "lista_curta": "", "colocacao": "1", "editora_id": "", "fonte": "http://x"}])
    _csv(mini / "autoria.csv", list(csv.DictReader((mini / "autoria.csv").open(encoding="utf-8")))
         + [{"premio_id": "outro", "obra_id": "o1", "pessoa_id": "a", "papel": "autor"}])  # o crédito é de cada prêmio
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
    for q in ["SELECT COUNT(*), COUNT(DISTINCT pessoa_id), SUM(premiada::INT) FROM v_participacao", "SELECT * FROM v_cobertura ORDER BY premio, ano",
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
    assert con.execute("SELECT COUNT(*) FROM indicacao i JOIN categoria_edicao c USING (premio_id, ano, nome_original) WHERE i.premio_id = 'jabuti' AND c.categoria = 'Livro do Ano' AND i.colocacao IS DISTINCT FROM 1").fetchone()[0] == 0  # no Oceanos, o Grande Prêmio lista os 3 vencedores de categoria
    # editora antiga só com fonte da época: o site oficial atual dá a editora de hoje (Companhia das Letras, fundada em 1986, em 1959)
    assert con.execute("""SELECT COUNT(*) FROM indicacao i JOIN obra o ON o.id = i.obra_id JOIN editora e ON e.id = o.editora_id
                          WHERE i.ano < 1986 AND e.nome ILIKE '%companhia das letras%'""").fetchone()[0] == 0
    assert con.execute("SELECT COUNT(*) FROM indicacao i JOIN obra o ON o.id = i.obra_id WHERE i.ano < 2000 AND o.editora_id IS NOT NULL").fetchone()[0] == 0


# Frases que fazem do site o site de um prêmio só (CA-26.15, DA-5) ou que usam o 1º prêmio como padrão (DA-4).
FIXAM_UM_PREMIO = [
    r"Quem chega ao Prêmio", r"sobre o (Prêmio )?Jabuti", r"edições do Jabuti", r"principal prêmio do livro", r"abre no Jabuti",
    r"Edições do Prêmio Jabuti", r"desde 1959", r'\?\? "Prêmio Jabuti"', r"jabuti visto de cima", r"casco de jabuti",
    r"PREMIOS\.slice\(0, ?1\)", r"premios\[0\]\.id\]", r"lt-membro",
]


def test_textos_de_plataforma():  # CA-26.15
    """Texto genérico não cita um prêmio; nome de prêmio no HTML só junto de uma regra dele ("no Jabuti, …", "… do Oceanos:")."""
    web = RAIZ / "web"
    for arq in [web / "index.html", web / "metodo.html", web / "logo.svg", *web.glob("*.js"), RAIZ / "README.md"]:
        txt = arq.read_text(encoding="utf-8")
        for padrao in FIXAM_UM_PREMIO:
            assert not re.search(padrao, txt), f"{arq.name}: {padrao}"
    for arq in ["index.html", "metodo.html"]:
        txt = re.sub(r"<span data-premios-texto>[^<]*</span>", "", (web / arq).read_text(encoding="utf-8"))  # lista vinda dos dados
        txt = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", "", txt, flags=re.S)
        for m in re.finditer(r"(?:Prêmio )?(?:Jabuti|Oceanos)", txt):
            antes, depois = txt[max(0, m.start() - 3):m.start()], txt[m.end():m.end() + 1]
            assert antes in ("no ", "No ", "<i>") or depois == ":", f"{arq}: …{txt[max(0, m.start() - 50):m.end() + 20]}…"


def test_textos_sem_periodo_antigo_fixo(tmp_path):  # CA-25.5, T22.6
    """O painel abre na série completa: nenhum texto fixa 2010–2025 como o período do painel."""
    web = RAIZ / "web"
    for arq in ["index.html", "metodo.html", *[p.name for p in web.glob("*.js")]]:
        txt = (web / arq).read_text(encoding="utf-8")
        for proibido in ("Prêmio Jabuti 2010–2025", "2010–2025 · 16 edições", "Entre 2010 e 2025", "Recorte completo: 2010–2025", "Dezesseis edições", "D.recorte"):
            assert proibido not in txt, f"{arq}: {proibido}"
    build.build(RAIZ / "dados", tmp_path / "p.duckdb", tmp_path / "p.json")
    prompt = build.prompt_sistema(duckdb.connect(str(tmp_path / "p.duckdb"), read_only=True))
    assert "Período padrão: a série completa de cada prêmio" in prompt and "usam 2010–2025" not in prompt
    assert "o padrão do painel" not in prompt  # sem prêmio padrão (DA-4 revista): sem prêmio na pergunta, todos
