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
