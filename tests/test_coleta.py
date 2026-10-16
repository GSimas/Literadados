# Coleta de capas (spec RF-24): só aceita capa com título e sobrenome de autor batendo.
import coleta


def test_sobrenome_pula_sufixos_e_observacoes():
    assert coleta.sobrenome("Itamar Vieira Junior") == "vieira"
    assert coleta.sobrenome("Patrícia Melo (coautora de Mistério em Queluz)") == "melo"
    assert coleta.sobrenome("Conceição Evaristo") == "evaristo"


def test_casa_capa_exige_titulo_e_autor():
    assert coleta.casa_capa("Torto Arado", ["vieira"], "Torto arado", ["Itamar Vieira Junior"])
    assert coleta.casa_capa("O avesso da pele", ["tenorio"], "O avesso da pele romance", ["Jeferson Tenório"])
    assert not coleta.casa_capa("Torto Arado", ["vieira"], "Torto Arado", ["Outra Pessoa"])  # autor diferente
    assert not coleta.casa_capa("Arado", ["vieira"], "Torto Arado", ["Itamar Vieira"])  # título diferente
    assert not coleta.casa_capa("Contos", ["silva"], "", ["Ana Silva"])


# ---------- casamento entre prêmios (CA-26.5, design D31) ----------
import csv

import pytest

LISTA = ["ano", "nome_original", "titulo", "autores", "ilustradores", "organizadores", "editora", "lista_curta", "colocacao", "fonte_1", "fonte_2", "observacao"]


def _csv(p, campos, linhas):
    p.parent.mkdir(parents=True, exist_ok=True)
    with p.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=campos)
        w.writeheader()
        w.writerows(linhas)


def _ler(p):
    return list(csv.DictReader(p.open(encoding="utf-8"))) if p.exists() else []


def _livro(titulo, autores, organizadores=""):
    return {"ano": "2016", "nome_original": "Romance", "titulo": titulo, "autores": autores, "ilustradores": "", "organizadores": organizadores,
            "editora": "Ed", "lista_curta": "", "colocacao": "", "fonte_1": "http://x", "fonte_2": "", "observacao": ""}


@pytest.fixture
def bruto(tmp_path, monkeypatch):
    """Dois prêmios: o Jabuti (padrão) e o 'outro', que chega depois. Na base já há Beatriz Souza com QID."""
    dados, b = tmp_path / "dados", tmp_path / "dados" / "coleta"
    monkeypatch.setattr(coleta, "DADOS", dados)
    monkeypatch.setattr(coleta, "BRUTO", b)
    _csv(dados / "premio.csv", ["id", "nome", "organizador", "ano_inicio", "abrangencia", "fonte"],
         [{"id": "outro", "nome": "Outro", "organizador": "X", "ano_inicio": "2003", "abrangencia": "lusofono", "fonte": "http://x"},
          {"id": "jabuti", "nome": "Prêmio Jabuti", "organizador": "CBL", "ano_inicio": "1959", "abrangencia": "nacional", "fonte": "http://x"}])
    _csv(dados / "pessoa.csv", coleta.CAMPOS["pessoa"], [{"id": "beatriz-souza", "nome": "Beatriz Souza", "wikidata": "Q1", "genero": "mulher",
                                                          "genero_fonte": "http://x", "raca": "sem_declaracao"}])
    for p in ("jabuti", "outro"):
        _csv(b / p / "edicoes.csv", ["ano", "regime", "fonte"], [{"ano": "2016", "regime": "r", "fonte": "http://x"}])
        _csv(b / p / "categorias_edicao.csv", ["ano", "nome_original", "categoria", "vagas_lista", "vagas_curta", "vagas_premio", "fonte"],
             [{"ano": "2016", "nome_original": "Romance", "categoria": "Romance", "vagas_lista": "", "vagas_curta": "", "vagas_premio": "0", "fonte": "http://x"}])
    _csv(b / "jabuti" / "lista_2016.csv", LISTA, [_livro("Livro", "Ana Silva"), _livro("Beatriz", "Beatriz Souza"),
                                                  _livro("Antologia", "", "Rui Costa"), _livro("Mar", "José Lima")])
    return dados, b


def test_casamento_entre_premios(bruto):
    dados, b = bruto
    _csv(b / "outro" / "lista_2016.csv", LISTA, [
        _livro("Livro", "Ana Silva"),                 # mesmo nome e mesmo livro: casa, mas o nome vai para revisão
        _livro("Livro", "Caio Prado"),                # mesmo título, outro autor: outra obra
        _livro("Outro livro", "Bia Souza"),           # grafia diferente, casada pelo QID
        _livro("Antologia", "", "Rui Costa"),         # antologia: casa pelo sobrenome do organizador
        _livro("Mar", "José Lima"),                   # homônimo decidido por humano: outra pessoa e outra obra
        _livro("Beatriz", "Beatrix Souza"),           # grafia diferente sem QID: a obra casa pelo sobrenome e a pessoa vai para revisão
        _livro("Terra", "Nuno Reis"),                 # pessoa nova com QID conferido
    ])
    _csv(b / "outro" / "casamentos.csv", ["nome", "wikidata", "pessoa_id"],
         [{"nome": "Bia Souza", "wikidata": "Q1", "pessoa_id": ""}, {"nome": "José Lima", "wikidata": "", "pessoa_id": "nova"},
          {"nome": "Nuno Reis", "wikidata": "Q9", "pessoa_id": ""}])
    coleta.normalizar()
    ind = {(i["premio_id"], i["obra_id"]) for i in _ler(dados / "indicacao.csv")}
    assert ind == {("jabuti", "livro"), ("jabuti", "beatriz"), ("jabuti", "antologia"), ("jabuti", "mar"),
                   ("outro", "livro"), ("outro", "livro-2016"), ("outro", "outro-livro"), ("outro", "antologia"), ("outro", "mar-2016"), ("outro", "terra"), ("outro", "beatriz")}
    autoria = {(a["obra_id"], a["pessoa_id"]) for a in _ler(dados / "autoria.csv")}
    assert ("outro-livro", "beatriz-souza") in autoria and ("mar-2016", "jose-lima-outro") in autoria and ("mar", "jose-lima") in autoria
    assert ("beatriz", "beatrix-souza") in autoria and ("beatriz", "beatriz-souza") in autoria
    pessoas = {p["id"]: p for p in _ler(dados / "pessoa.csv")}
    assert "bia-souza" not in pessoas and pessoas["nuno-reis"]["wikidata"] == "Q9"
    rev = _ler(b / "outro" / "casamentos_revisar.csv")
    assert [(r["nome"], r["pessoa_id"]) for r in rev] == [("Ana Silva", "ana-silva"), ("Beatrix Souza", "beatrix-souza"), ("Rui Costa", "rui-costa")]
    assert "casou pelo sobrenome com beatriz-souza" in rev[1]["motivo"]
    assert rev[0]["premios_base"] == "jabuti"


def test_casamento_qid_diferente_cria_pessoa_nova(bruto):
    dados, b = bruto
    _csv(b / "outro" / "lista_2016.csv", LISTA, [_livro("Sol", "Beatriz Souza")])
    _csv(b / "outro" / "casamentos.csv", ["nome", "wikidata", "pessoa_id"], [{"nome": "Beatriz Souza", "wikidata": "Q2", "pessoa_id": ""}])
    coleta.normalizar()
    assert ("sol", "beatriz-souza-outro") in {(a["obra_id"], a["pessoa_id"]) for a in _ler(dados / "autoria.csv")}
    assert "QID diferente" in _ler(b / "outro" / "casamentos_revisar.csv")[0]["motivo"]


def test_casamento_decisao_com_id_inexistente_falha(bruto):
    _, b = bruto
    _csv(b / "outro" / "lista_2016.csv", LISTA, [_livro("Sol", "Fulano")])
    _csv(b / "outro" / "casamentos.csv", ["nome", "wikidata", "pessoa_id"], [{"nome": "Fulano", "wikidata": "", "pessoa_id": "fantasma"}])
    with pytest.raises(SystemExit, match="fantasma não existe"):
        coleta.normalizar()


def test_sem_pendencia_arquivo_de_revisao_some(bruto):
    _, b = bruto
    _csv(b / "outro" / "casamentos_revisar.csv", ["nome"], [{"nome": "velho"}])
    _csv(b / "outro" / "lista_2016.csv", LISTA, [_livro("Sol", "Gente Nova")])
    coleta.normalizar()
    assert not (b / "outro" / "casamentos_revisar.csv").exists()
