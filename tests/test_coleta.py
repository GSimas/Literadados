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
        _livro("Antologia", "", "Rui Costa"),         # antologia: casa pela pessoa do organizador
        _livro("Mar", "José Lima"),                   # homônimo decidido por humano: outra pessoa e outra obra
        _livro("Beatriz", "Beatrix Souza"),           # grafia diferente sem QID: só o sobrenome bate, então outra obra + revisão
        _livro("Terra", "Nuno Reis"),                 # pessoa nova com QID conferido
    ])
    _csv(b / "outro" / "casamentos.csv", ["nome", "wikidata", "pessoa_id"],
         [{"nome": "Bia Souza", "wikidata": "Q1", "pessoa_id": ""}, {"nome": "José Lima", "wikidata": "", "pessoa_id": "nova"},
          {"nome": "Nuno Reis", "wikidata": "Q9", "pessoa_id": ""}])
    coleta.normalizar()
    ind = {(i["premio_id"], i["obra_id"]) for i in _ler(dados / "indicacao.csv")}
    assert ind == {("jabuti", "livro"), ("jabuti", "beatriz"), ("jabuti", "antologia"), ("jabuti", "mar"),
                   ("outro", "livro"), ("outro", "livro-2016"), ("outro", "outro-livro"), ("outro", "antologia"), ("outro", "mar-2016"), ("outro", "terra"), ("outro", "beatriz-2016")}
    autoria = {(a["obra_id"], a["pessoa_id"]) for a in _ler(dados / "autoria.csv")}
    assert ("outro-livro", "beatriz-souza") in autoria and ("mar-2016", "jose-lima-outro") in autoria and ("mar", "jose-lima") in autoria
    assert ("beatriz-2016", "beatrix-souza") in autoria and ("beatriz", "beatrix-souza") not in autoria  # nada contamina a obra antiga
    pessoas = {p["id"]: p for p in _ler(dados / "pessoa.csv")}
    assert "bia-souza" not in pessoas and pessoas["nuno-reis"]["wikidata"] == "Q9"
    rev = _ler(b / "outro" / "casamentos_revisar.csv")
    assert [(r["nome"], r["pessoa_id"]) for r in rev] == [("Ana Silva", "ana-silva"), ("Beatrix Souza", "beatrix-souza"), ("Rui Costa", "rui-costa")]
    assert "já existe como beatriz (beatriz-souza)" in rev[1]["motivo"]
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


def test_editora_de_outro_pais_e_outra_editora(bruto):  # CA-26.6: Companhia das Letras de Lisboa ≠ de São Paulo
    dados, b = bruto
    _csv(b / "outro" / "lista_2016.csv", LISTA + ["editora_pais"], [
        {**_livro("Livro", "Ana Silva"), "editora": "Ed", "editora_pais": "PT"},   # mesmo livro, edição portuguesa
        {**_livro("Sol", "Gente Nova"), "editora": "Ed", "editora_pais": "BR"},    # brasileira explícita = a de sempre
    ])
    coleta.normalizar()
    eds = {e["id"]: e for e in _ler(dados / "editora.csv")}
    assert eds["ed-pt"]["nome"] == "Ed (PT)" and eds["ed-pt"]["uf_sede"] == "EX" and "nome" in eds["ed"]
    ind = {(i["premio_id"], i["obra_id"]): i["editora_id"] for i in _ler(dados / "indicacao.csv")}
    assert ind[("outro", "livro")] == "ed-pt" and ind[("jabuti", "livro")] == "ed" and ind[("outro", "sol")] == "ed"


def test_mesmo_titulo_e_sobrenome_nao_junta_obras(bruto):  # revisão do gauntlet: "Ainda Estou Aqui" de outra Paiva
    dados, b = bruto
    _csv(b / "outro" / "lista_2016.csv", LISTA, [_livro("Livro", "Joana Silva")])
    coleta.normalizar()
    autoria = {(a["obra_id"], a["pessoa_id"]) for a in _ler(dados / "autoria.csv")}
    assert ("livro", "joana-silva") not in autoria and ("livro-2016", "joana-silva") in autoria
    assert _ler(b / "outro" / "casamentos_revisar.csv")[0]["nome"] == "Joana Silva"


def test_editora_vazia_nao_herda_de_outro_premio(bruto):  # editora sem fonte da época continua vazia (CLAUDE.md)
    dados, b = bruto
    _csv(b / "jabuti" / "lista_2016.csv", LISTA, [{**_livro("Cabra", "Ana Silva"), "editora": ""}])
    _csv(b / "outro" / "lista_2016.csv", LISTA + ["editora_pais"], [{**_livro("Cabra", "Ana Silva"), "editora": "Caminho", "editora_pais": "PT"}])
    coleta.normalizar()
    ind = {(i["premio_id"], i["obra_id"]): i["editora_id"] for i in _ler(dados / "indicacao.csv")}
    assert ind == {("jabuti", "cabra"): "", ("outro", "cabra"): "caminho-pt"}


def test_livro_do_ano_herda_editora_da_mesma_edicao(bruto):  # a linha do Livro do Ano repete a obra sem editora
    dados, b = bruto
    _csv(b / "jabuti" / "lista_2016.csv", LISTA, [{**_livro("Cabra", "Ana Silva"), "nome_original": "Livro do Ano", "editora": ""},
                                                  _livro("Cabra", "Ana Silva")])
    coleta.normalizar()
    assert {i["nome_original"]: i["editora_id"] for i in _ler(dados / "indicacao.csv")} == {"Livro do Ano": "ed", "Romance": "ed"}


def test_jurado_vai_para_a_revisao_do_premio_que_chegou_depois(bruto):
    dados, b = bruto
    _csv(b / "jabuti" / "jurados_2016.csv", ["ano", "nome_original", "nome", "fonte"], [{"ano": "2016", "nome_original": "Romance", "nome": "Clara Tajes", "fonte": "http://x"}])
    _csv(b / "outro" / "lista_2016.csv", LISTA, [_livro("Sol", "Clara Tajes")])
    coleta.normalizar()
    assert not (b / "jabuti" / "casamentos_revisar.csv").exists()
    assert [r["nome"] for r in _ler(b / "outro" / "casamentos_revisar.csv")] == ["Clara Tajes"]


def test_nova_no_premio_padrao_e_recusada(bruto):
    _, b = bruto
    _csv(b / "jabuti" / "casamentos.csv", ["nome", "wikidata", "pessoa_id"], [{"nome": "Ana Silva", "wikidata": "", "pessoa_id": "nova"}])
    with pytest.raises(SystemExit, match="não vale no prêmio padrão"):
        coleta.normalizar()


def test_normalizar_estavel_em_duas_execucoes(bruto):  # ids não mudam entre execuções (homônimo com QID diferente)
    dados, b = bruto
    _csv(b / "jabuti" / "lista_2016.csv", LISTA, [_livro("Sol", "Beatriz Souza")])
    _csv(b / "outro" / "lista_2016.csv", LISTA, [_livro("Sol", "Beatriz Souza")])
    _csv(b / "outro" / "casamentos.csv", ["nome", "wikidata", "pessoa_id"], [{"nome": "Beatriz Souza", "wikidata": "Q2", "pessoa_id": ""}])
    coleta.normalizar()
    antes = [_ler(dados / f"{t}.csv") for t in ("obra", "autoria", "indicacao", "pessoa")]
    coleta.normalizar()
    assert [_ler(dados / f"{t}.csv") for t in ("obra", "autoria", "indicacao", "pessoa")] == antes
    assert {(a["obra_id"], a["pessoa_id"]) for a in _ler(dados / "autoria.csv")} == {("sol", "beatriz-souza"), ("sol-2016", "beatriz-souza-outro")}


def test_credito_fica_no_proprio_premio(bruto):  # gauntlet 2: coautor que só o outro prêmio credita não entra no Jabuti
    dados, b = bruto
    _csv(b / "outro" / "lista_2016.csv", LISTA, [_livro("Livro", "Ana Silva|Fulano Tradutor")])
    coleta.normalizar()
    autoria = {(a["premio_id"], a["obra_id"], a["pessoa_id"]) for a in _ler(dados / "autoria.csv")}
    assert ("outro", "livro", "fulano-tradutor") in autoria and ("jabuti", "livro", "fulano-tradutor") not in autoria
    assert ("jabuti", "livro", "ana-silva") in autoria and ("outro", "livro", "ana-silva") in autoria


def test_qid_no_casamento_grava_e_dispensa_revisao(bruto):  # QID conferido para pessoa da base sem QID
    dados, b = bruto
    _csv(b / "outro" / "lista_2016.csv", LISTA, [_livro("Sol", "Ana Silva")])
    _csv(b / "outro" / "casamentos.csv", ["nome", "wikidata", "pessoa_id"], [{"nome": "Ana Silva", "wikidata": "Q7", "pessoa_id": ""}])
    coleta.normalizar()
    assert {p["id"]: p["wikidata"] for p in _ler(dados / "pessoa.csv")}["ana-silva"] == "Q7"
    assert not (b / "outro" / "casamentos_revisar.csv").exists()


def test_qid_divergente_no_premio_padrao_e_recusado(bruto):
    _, b = bruto
    _csv(b / "jabuti" / "lista_2016.csv", LISTA, [_livro("Sol", "Beatriz Souza")])
    _csv(b / "jabuti" / "casamentos.csv", ["nome", "wikidata", "pessoa_id"], [{"nome": "Beatriz Souza", "wikidata": "Q2", "pessoa_id": ""}])
    with pytest.raises(SystemExit, match="QID diferente"):
        coleta.normalizar()


def test_pais_de_prefere_atual_e_preferido(monkeypatch):  # DA-3: país histórico (com data de fim) não vale
    snak = lambda q: {"datavalue": {"value": {"id": q}}}
    ents = {"Qcidade": {"claims": {"P17": [
        {"rank": "normal", "mainsnak": snak("Qantigo"), "qualifiers": {"P582": [{}]}},
        {"rank": "normal", "mainsnak": snak("Qoutro")},
        {"rank": "preferred", "mainsnak": snak("Qatual")}]}},
        "Qatual": {"claims": {"P297": [{"mainsnak": {"datavalue": {"value": "er"}}}]}}}
    monkeypatch.setattr(coleta, "entidades", lambda ids: {i: ents.get(i, {}) for i in ids})
    assert coleta.pais_de("Qcidade") == "ER"


def test_sem_pendencia_arquivo_de_revisao_some(bruto):
    _, b = bruto
    _csv(b / "outro" / "casamentos_revisar.csv", ["nome"], [{"nome": "velho"}])
    _csv(b / "outro" / "lista_2016.csv", LISTA, [_livro("Sol", "Gente Nova")])
    coleta.normalizar()
    assert not (b / "outro" / "casamentos_revisar.csv").exists()
