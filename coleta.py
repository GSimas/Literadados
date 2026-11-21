"""Ferramentas de coleta (PLANO_COLETA.md). Uso:
  python coleta.py normalizar   # dados/premio.csv + dados/coleta/<premio>/{edicoes,categorias_edicao,lista_*,jurados_*,homenageados}.csv → dados/*.csv (preserva enriquecimentos)
  python coleta.py wikidata     # pré-preenche gênero/nascimento de pessoas sem QID; candidatos em dados/coleta/wikidata_candidatos.csv
  python coleta.py aplicar_pessoas  # incorpora dados/coleta/pessoas_*.csv (pesquisa de nascimento e raça)
  python coleta.py verificar    # confere se cada raca_trecho aparece na página de raca_fonte
  python coleta.py midia        # foto (Commons, licença livre) e verbete da pt.wikipedia das pessoas com QID → dados/pessoa_midia.csv
  python coleta.py imagens      # fotos e capas com direitos reservados (dados/coleta/imagens/*, D34) → dados/pessoa_foto.csv, dados/obra_capa.csv
  python coleta.py malha        # limites das UFs (IBGE, malha mínima) → web/br-uf.json
"""
import csv
import glob
import html
import json
import re
import subprocess
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).parent
DADOS = RAIZ / "dados"
BRUTO = DADOS / "coleta"
UA = "Literadados/0.1 (pesquisa sobre o Prêmio Jabuti)"

CAMPOS = {
    "obra_mapeada": ["obra_id", "municipio", "isbn", "ambientada", "fonte", "verificado_em"],
    "editora_mapeada": ["editora_id", "municipio", "tipo", "site", "situacao", "ano_encerramento", "fonte", "verificado_em"],
    "pessoa_atuacao": ["pessoa_id", "municipio", "fonte", "verificado_em"],
    "mapeamento_autoria": ["obra_id", "pessoa_id", "papel"],
    "pessoa": ["id", "nome", "wikidata", "genero", "genero_fonte", "genero_evidencia", "raca", "raca_evidencia", "raca_fonte", "raca_trecho", "raca_busca",
               "ano_nascimento", "municipio_nascimento", "uf_nascimento", "pais_nascimento", "nascimento_fonte", "revisado_em"],
    "editora": ["id", "nome", "grupo", "municipio_sede", "uf_sede"],
    "obra": ["id", "titulo", "editora_id", "ano_publicacao"],
    "autoria": ["premio_id", "obra_id", "pessoa_id", "papel"],
    "edicao": ["premio_id", "ano", "regime", "obras", "fonte"],
    "edicao_contexto": ["premio_id", "ano", "texto", "fontes", "revisar"],
    "categoria_edicao": ["premio_id", "ano", "nome_original", "categoria", "vagas_lista", "vagas_curta", "vagas_premio", "etapa_lista", "fonte"],
    "indicacao": ["premio_id", "ano", "nome_original", "obra_id", "lista_curta", "colocacao", "editora_id", "fonte"],
    "jurado": ["premio_id", "ano", "nome_original", "pessoa_id", "fonte"],
    "distincao": ["premio_id", "ano", "nome_original", "pessoa_id", "fonte"],
    "obra_capa": ["obra_id", "capa_url", "fonte", "pagina"],
    "pessoa_foto": ["pessoa_id", "foto_url", "pagina", "fonte"],
}


def slug(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def ler(nome: str) -> list[dict]:
    p = DADOS / f"{nome}.csv"
    return list(csv.DictReader(p.open(encoding="utf-8"))) if p.exists() else []


def gravar(nome: str, linhas: list[dict]):
    with (DADOS / f"{nome}.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CAMPOS[nome], extrasaction="ignore")
        w.writeheader()
        w.writerows(linhas)


def nomes(campo: str) -> list[str]:
    return [n.strip() for n in (campo or "").split("|") if n.strip()]


CAMPOS_REVISAR = ["nome", "pessoa_id", "motivo", "wikidata_base", "premios_base"]


def normalizar():
    pessoas = {p["id"]: p for p in ler("pessoa")}
    editoras = {e["id"]: e for e in ler("editora")}
    obras, autoria, indicacoes, jurados, distincoes = {}, set(), {}, {}, {}

    # Coedição: vale a 1ª editora. "A / B" e "A | B" sempre ("S/A" é sufixo: só " / " com espaços); "A e B", "A - B" e
    # "A, B" só quando TODAS as partes já são editoras conhecidas, porque " e " também está em nomes ("Cultura e Barbárie").
    conhecidas = set(editoras)
    enr_arq0 = BRUTO / "editoras_enriquecidas.csv"
    if enr_arq0.exists():
        conhecidas |= {e["id"] for e in csv.DictReader(enr_arq0.open(encoding="utf-8"))}
    sufixos = ("", "-pt", "-ao", "-mz", "-cv", "-gw", "-st", "-tl", "-sem-pais")  # a mesma editora, de outro país ou sem país
    conhecida = lambda nome: any(slug(nome) + s in conhecidas or slug(nome) + s in editoras for s in sufixos)  # da base ou desta execução

    def editora_principal(celula: str) -> str:
        eds = [e.strip() for e in re.split(r"\|| +/ +", celula) if e.strip()]
        if not eds:
            return ""
        partes = [p.strip() for p in re.split(r" e | - | – |, ", eds[0]) if p.strip()]
        return partes[0] if len(partes) > 1 and all(conhecida(p) for p in partes) else eds[0]

    # Um prêmio por pasta (dados/coleta/<premio>/), na ordem de premio.csv (coluna `ordem`; 1 = o padrão do painel, DA-4):
    # o Jabuti vem primeiro, e os ids atuais (fotos, capas, links) não mudam quando entra outro prêmio (design D31).
    premios = sorted(ler("premio"), key=lambda p: (int(p.get("ordem") or 99), p["id"]))
    ordem = {pr["id"]: k for k, pr in enumerate(premios)}

    # Casamento de pessoa entre prêmios (CA-26.5). dados/coleta/<premio>/casamentos.csv (nome, wikidata, pessoa_id):
    # pessoa_id = decisão humana (um id da base, ou "nova" para homônimo); wikidata = QID conferido, que casa com quem
    # já tem esse QID. Sem isso, o nome casa sozinho, mas o casamento com pessoa de um prêmio anterior na ordem vai para
    # casamentos_revisar.csv do prêmio que chegou depois. Dentro do mesmo prêmio, o nome continua sendo a identidade.
    casam = {}
    for pr in premios:
        arq = BRUTO / pr["id"] / "casamentos.csv"
        casam[pr["id"]] = {c["nome"]: c for c in csv.DictReader(arq.open(encoding="utf-8"))} if arq.exists() else {}
    if any((c.get("pessoa_id") or "").strip() == "nova" for c in casam.get(premios[0]["id"], {}).values()):
        raise SystemExit(f"{premios[0]['id']}/casamentos.csv: 'nova' não vale no prêmio padrão (renomearia quem já está na base)")
    por_qid = {p["wikidata"]: i for i, p in pessoas.items() if p.get("wikidata")}
    revisar = {pr["id"]: {} for pr in premios}

    def arquivos(pr: dict, padrao: str) -> list[Path]:
        # Listas: 2010+ primeiro, para os ids de obra dessas edições não mudarem quando entra a série histórica (um título
        # antigo igual recebe o sufixo -ano, não o contrário). Jurados: em ordem de nome.
        fs = glob.glob(str(BRUTO / pr["id"] / padrao))
        ano = lambda f: int(m.group(1)) if (m := re.search(r"(\d{4})", Path(f).name)) else 9999
        return [Path(f) for f in sorted(fs, key=lambda f: (ano(f) < 2010, f))]

    # 1ª passada: em que prêmios cada nome aparece (listas e júri), para que a revisão independa da ordem de leitura.
    premios_do_nome = {}
    for pr in premios:
        for arq in arquivos(pr, "lista_*.csv"):
            for r in csv.DictReader(open(arq, encoding="utf-8")):
                for n in nomes(r["autores"]) + nomes(r["ilustradores"]) + nomes(r.get("organizadores")):
                    premios_do_nome.setdefault(slug(n), set()).add(pr["id"])
        for arq in arquivos(pr, "jurados_*.csv") + arquivos(pr, "homenageados.csv"):
            for r in csv.DictReader(open(arq, encoding="utf-8")):
                premios_do_nome.setdefault(slug(r["nome"]), set()).add(pr["id"])

    def pessoa(nome: str, premio_id: str) -> str:
        c = casam[premio_id].get(nome, {})
        decisao, qid = (c.get("pessoa_id") or "").strip(), (c.get("wikidata") or "").strip()
        base = slug(nome)
        if decisao == "nova":
            pid = f"{base}-{premio_id.replace('mapeamento/', 'm')}"
        elif decisao:
            if decisao not in pessoas:
                raise SystemExit(f"{premio_id}/casamentos.csv: {nome} → pessoa_id {decisao} não existe")
            pid = decisao
        elif qid and qid in por_qid:
            pid = por_qid[qid]
        else:
            pid = base
            ja = pessoas.get(pid, {}).get("wikidata")
            antes = {p for p in premios_do_nome.get(base, set()) if ordem[p] < ordem[premio_id]}
            if qid and ja and ja != qid:  # mesmo nome, outra pessoa no Wikidata: homônimo
                if ordem[premio_id] == 0:  # no prêmio padrão, isso tiraria as indicações de quem já está na base
                    raise SystemExit(f"{premio_id}/casamentos.csv: {nome} com QID diferente ({qid} × {ja}) no prêmio padrão: corrija a base")
                pid = f"{base}-{premio_id.replace('mapeamento/', 'm')}"
                revisar[premio_id][nome] = {"nome": nome, "pessoa_id": pid, "motivo": f"QID diferente ({qid} × {ja}): criada pessoa nova",
                                            "wikidata_base": ja, "premios_base": ",".join(sorted(antes))}
            elif qid and not ja and pid in pessoas:  # QID conferido para quem já está na base sem QID: grava e vale
                pessoas[pid]["wikidata"], por_qid[qid] = qid, pid
            elif antes:
                revisar[premio_id][nome] = {"nome": nome, "pessoa_id": pid, "motivo": "casou só pelo nome com pessoa de outro prêmio",
                                            "wikidata_base": ja or "", "premios_base": ",".join(sorted(antes))}
        if pid not in pessoas:
            pessoas[pid] = {"id": pid, "nome": nome, "genero": "nao_identificado", "raca": "sem_declaracao"}
            if qid and qid not in por_qid:
                pessoas[pid]["wikidata"], por_qid[qid] = qid, pid
        return pid

    # Casamento de obra (CA-26.5): mesmo título e a MESMA PESSOA na autoria (na antologia sem autor, o organizador).
    # Só o sobrenome em comum não junta (juntaria "Poesia reunida" de dois Silva): vira outra obra, com o ano no id, e as
    # pessoas vão para revisão. Se forem a mesma pessoa, a decisão em casamentos.csv junta pessoa e, com ela, a obra.
    por_titulo, por_chave = {}, {}
    PALAVRAS_VAZIAS = {"de", "do", "da", "dos", "das", "o", "a", "os", "as", "e", "um", "uma"}

    def chave_titulo(titulo: str) -> str:
        """Título sem subtítulo (depois de ':', ' – ', ' - ' ou entre parênteses), sem artigos/preposições e sem espaços:
        "Canalha! – Crônicas" = "Canalha!", "Tapete de silêncio" = "Tapete do silêncio", "AvóDezanove" = "Avó dezenove"."""
        t = re.split(r":| – | - | \(", titulo)[0]
        return "".join(p for p in slug(t).split("-") if p not in PALAVRAS_VAZIAS)

    def juntar(o: dict, nomes_, pids, ed_id, premio_id):
        o["_pids"] |= set(pids)
        o["_sob"] |= {sobrenome(x) for x in nomes_} - {""}  # coautor novo também conta para o aviso de sobrenome
        o["_premios"].add(premio_id)
        o["editora_id"] = o["editora_id"] or ed_id  # 1ª editora não vazia, só para o perfil e o JSON compacto
        return o["id"]

    # Decisão humana para livro (como casamentos.csv para pessoa): dados/coleta/<premio>/obras_casamentos.csv
    # (titulo, obra_id) junta um título da lista daquele prêmio a uma obra já existente, quando a grafia muda demais
    # ("Avó dezenove" × "AvóDezanove", "Meridiano celeste & bestiário" × "Meridiano Celeste").
    obra_decidida = {}
    for pr in premios:
        arq = BRUTO / pr["id"] / "obras_casamentos.csv"
        if arq.exists():
            obra_decidida.update({(pr["id"], c["titulo"]): c["obra_id"] for c in csv.DictReader(arq.open(encoding="utf-8"))})

    def obra(titulo: str, nomes_: list[str], pids: list[str], ano: str, ed_id: str, premio_id: str) -> str:
        if (premio_id, titulo) in obra_decidida:
            oid = obra_decidida[(premio_id, titulo)]
            if oid not in obras:
                raise SystemExit(f"{premio_id}/obras_casamentos.csv: '{titulo}' → obra {oid} não existe (ainda)")
            return juntar(obras[oid], nomes_, pids, ed_id, premio_id)
        base = slug(titulo)
        for oid in por_titulo.get(base, []):
            o = obras[oid]
            if o["_pids"] & set(pids) or not (o["_pids"] or pids):
                return juntar(o, nomes_, pids, ed_id, premio_id)
        # Entre prêmios, a grafia do título varia ("Tapete de/do silêncio"): com a MESMA pessoa na autoria, a chave
        # tolerante junta. Dentro do mesmo prêmio, não (lá a grafia já é uma só, e "Poesia completa: vol. 2" é outra obra).
        for oid in por_chave.get(chave_titulo(titulo), []):
            o = obras[oid]
            if o["_pids"] & set(pids) and premio_id not in o["_premios"]:
                return juntar(o, nomes_, pids, ed_id, premio_id)
        for oid in por_titulo.get(base, []):
            for n, p in zip(nomes_, pids):
                decidido = any((casam[premio_id].get(n, {}).get(k) or "").strip() for k in ("pessoa_id", "wikidata"))
                if sobrenome(n) and sobrenome(n) in obras[oid]["_sob"] and not decidido:
                    revisar[premio_id][n] = {"nome": n, "pessoa_id": p, "wikidata_base": "", "premios_base": "",
                                             "motivo": f"'{titulo}' já existe como {oid} ({', '.join(sorted(obras[oid]['_pids']))}), com o mesmo sobrenome: "
                                                       "se for a mesma pessoa, decida em casamentos.csv e a obra se junta"}
        oid, n = (base if base not in obras else f"{base}-{ano}"), 2
        while oid in obras:
            oid, n = f"{base}-{ano}-{n}", n + 1
        obras[oid] = {"id": oid, "titulo": titulo, "editora_id": ed_id, "_sob": {sobrenome(x) for x in nomes_} - {""}, "_pids": set(pids),
                      "_premios": {premio_id}}
        por_titulo.setdefault(base, []).append(oid)
        por_chave.setdefault(chave_titulo(titulo), []).append(oid)
        return oid
    edicoes, cats = [], []
    for pr in premios:
        pasta = BRUTO / pr["id"]
        edicoes += [{**e, "premio_id": pr["id"]} for e in csv.DictReader((pasta / "edicoes.csv").open(encoding="utf-8"))]
        cats += [{**c, "premio_id": pr["id"]} for c in csv.DictReader((pasta / "categorias_edicao.csv").open(encoding="utf-8"))]
    gravar("edicao", edicoes)
    gravar("categoria_edicao", cats)

    # Um prêmio de cada vez, listas e depois júri: a revisão de um nome vai sempre para o prêmio que chegou depois.
    # Conjunto da obra (RF-30, D36): homenageados.csv (ano, nome_original, nome, fonte_1, fonte_2) → distincao.
    for premio_id, arq, tipo in [(pr["id"], a, t) for pr in premios for t in ("lista", "homenageados", "jurados")
                                 for a in arquivos(pr, "homenageados.csv" if t == "homenageados" else f"{t}_*.csv")]:
        if tipo == "homenageados":
            for r in csv.DictReader(open(arq, encoding="utf-8")):
                pid = pessoa(r["nome"], premio_id)
                distincoes[(premio_id, r["ano"], r["nome_original"], pid)] = {
                    "premio_id": premio_id, "ano": r["ano"], "nome_original": r["nome_original"], "pessoa_id": pid,
                    "fonte": " ; ".join(f for f in (r.get("fonte_1"), r.get("fonte_2")) if f)}
            continue
        if tipo == "jurados":
            for r in csv.DictReader(open(arq, encoding="utf-8")):
                pid = pessoa(r["nome"], premio_id)
                jurados[(premio_id, r["ano"], r["nome_original"], pid)] = {
                    "premio_id": premio_id, "ano": r["ano"], "nome_original": r["nome_original"], "pessoa_id": pid, "fonte": r["fonte"]}
            continue
        for r in csv.DictReader(open(arq, encoding="utf-8")):
            autores = nomes(r["autores"])
            ed_nome = editora_principal(r["editora"] or "")
            # Editora de outro país (coluna opcional editora_pais, ISO): outra editora, mesmo com o mesmo nome de uma
            # brasileira (Companhia das Letras de Lisboa ≠ de São Paulo). Id e nome levam o país; sede no exterior.
            # Num prêmio que tem a coluna, país VAZIO = não se sabe (coedição entre países, selo com casa nos dois):
            # editora à parte, sem sede, em vez de herdar a sede da brasileira de mesmo nome.
            ed_pais = (r.get("editora_pais") or "").strip().upper()
            estrangeira = bool(ed_nome) and ed_pais not in ("", "BR")
            sem_pais = bool(ed_nome) and "editora_pais" in r and not ed_pais
            ed_id = (slug(f"{ed_nome} {ed_pais}") if estrangeira else slug(f"{ed_nome} sem pais") if sem_pais else slug(ed_nome)) if ed_nome else ""
            if ed_id:
                editoras.setdefault(ed_id, {"id": ed_id, "nome": f"{ed_nome} ({ed_pais})", "uf_sede": "EX"} if estrangeira
                                    else {"id": ed_id, "nome": f"{ed_nome} (país não informado)"} if sem_pais else {"id": ed_id, "nome": ed_nome})
            orgs = [n for n in nomes(r.get("organizadores")) if n not in autores]  # fora das contagens (design D14)
            pa, po = [pessoa(n, premio_id) for n in autores], [pessoa(n, premio_id) for n in orgs]
            oid = obra(r["titulo"], autores or orgs, pa or po, r["ano"], ed_id, premio_id)
            autoria.update((premio_id, oid, p, "autor") for p in pa)  # crédito do próprio prêmio (RF-26)
            autoria.update((premio_id, oid, p, "organizador") for p in po)
            for n in nomes(r["ilustradores"]):
                if n not in autores:
                    autoria.add((premio_id, oid, pessoa(n, premio_id), "ilustrador"))
            fonte = " ; ".join(f for f in (r["fonte_1"], r["fonte_2"]) if f)
            indicacoes[(premio_id, r["ano"], r["nome_original"], oid)] = {
                "premio_id": premio_id, "ano": r["ano"], "nome_original": r["nome_original"], "obra_id": oid,
                "lista_curta": r["lista_curta"], "colocacao": r["colocacao"], "fonte": fonte, "_ed": ed_id}

    # Mapeamento (RF-34, D40): dados/coleta/mapeamento/<código do município>/, como mais uma fonte, depois de todos os prêmios
    # (os ids atuais não mudam). Mesmo casamento de pessoa e obra (casamentos.csv, obras_casamentos.csv). remocoes.csv
    # (pessoa_id): quem pediu para sair do mapeamento não volta numa coleta futura (CA-34.11); a trajetória nos prêmios fica.
    terr = {l["codigo"]: l for l in csv.DictReader((DADOS / "territorio.csv").open(encoding="utf-8"))} if (DADOS / "territorio.csv").exists() else {}
    mapa = {"obra_mapeada": {}, "editora_mapeada": {}, "pessoa_atuacao": {}, "mapeamento_autoria": set()}
    for pasta in sorted(p for p in (BRUTO / "mapeamento").glob("*") if p.is_dir()) if (BRUTO / "mapeamento").exists() else []:
        mun, fonte_id = pasta.name, f"mapeamento/{pasta.name}"
        if mun not in terr:
            raise SystemExit(f"{fonte_id}: município {mun} não está em dados/territorio.csv")
        uf_mun = terr[terr[mun]["pai"]]["sigla"]
        ler_ = lambda nome: list(csv.DictReader((pasta / nome).open(encoding="utf-8"))) if (pasta / nome).exists() else []
        casam[fonte_id] = {c["nome"]: c for c in ler_("casamentos.csv")}
        ordem[fonte_id], revisar[fonte_id] = len(premios), {}
        obra_decidida.update({(fonte_id, c["titulo"]): c["obra_id"] for c in ler_("obras_casamentos.csv")})
        fora = {r["pessoa_id"] for r in ler_("remocoes.csv")}
        for r in ler_("editoras.csv"):
            eid = slug(r["nome"])
            editoras.setdefault(eid, {"id": eid, "nome": r["nome"], "municipio_sede": r.get("municipio_sede") or terr[mun]["nome"], "uf_sede": uf_mun})
            mapa["editora_mapeada"][(eid, mun)] = {"editora_id": eid, "municipio": mun, **{k: r.get(k, "") for k in
                                                   ("tipo", "site", "situacao", "ano_encerramento", "fonte", "verificado_em")}}
        for r in ler_("obras.csv"):
            pid_de = lambda n: pessoa(n, fonte_id)
            autores = [n for n in nomes(r["autores"]) if slug(n) not in fora]
            orgs = [n for n in nomes(r.get("organizadores")) if n not in autores and slug(n) not in fora]
            ilus = [n for n in nomes(r.get("ilustradores")) if n not in autores and slug(n) not in fora]
            if not (autores or orgs):
                continue
            pa, po = [pid_de(n) for n in autores], [pid_de(n) for n in orgs]
            if any(p in fora for p in pa + po):
                continue
            ed_id = slug(editora_principal(r.get("editora") or "")) if r.get("editora") else ""
            if ed_id:
                editoras.setdefault(ed_id, {"id": ed_id, "nome": editora_principal(r["editora"])})
            oid = obra(r["titulo"], autores or orgs, pa or po, r.get("ano") or "", ed_id, fonte_id)
            if r.get("ano") and not obras[oid].get("ano_publicacao"):
                obras[oid]["ano_publicacao"] = r["ano"]
            mapa["mapeamento_autoria"] |= {(oid, p, "autor") for p in pa} | {(oid, p, "organizador") for p in po}
            mapa["mapeamento_autoria"] |= {(oid, pid_de(n), "ilustrador") for n in ilus}
            mapa["obra_mapeada"][(oid, mun)] = {"obra_id": oid, "municipio": mun, "isbn": r.get("isbn", ""),
                                                "ambientada": "true" if (r.get("ambientada") or "").strip() in ("1", "true", "sim") else "false",
                                                "fonte": r["fonte"], "verificado_em": r["verificado_em"]}
        for r in ler_("pessoas.csv"):
            if slug(r["nome"]) in fora:
                continue
            pid = pessoa(r["nome"], fonte_id)
            if pid in fora:
                continue
            mapa["pessoa_atuacao"][(pid, mun)] = {"pessoa_id": pid, "municipio": mun, "fonte": r["fonte"], "verificado_em": r["verificado_em"]}
        print(f"mapeamento {mun}: {len(mapa['obra_mapeada'])} obras, {len(mapa['editora_mapeada'])} editoras, {len(mapa['pessoa_atuacao'])} pessoas com atuação")

    # Editoras: sede/grupo levantados à parte; `canonico` unifica duplicatas (ex.: "record" → "editora-record").
    enr_arq, alias = BRUTO / "editoras_enriquecidas.csv", {}
    if enr_arq.exists():
        enr = {e["id"]: e for e in csv.DictReader(enr_arq.open(encoding="utf-8"))}
        alias = {i: e["canonico"] for i, e in enr.items() if e.get("canonico") and e["canonico"] != i}
        for o in obras.values():
            o["editora_id"] = alias.get(o["editora_id"], o["editora_id"])
        editoras = {i: {**e, **{k: enr[i][k] for k in ("nome", "grupo", "municipio_sede", "uf_sede")}} if i in enr else e
                    for i, e in editoras.items() if i not in alias}
        for i in set(alias.values()) - set(editoras):
            editoras[i] = {k: enr[i][k] for k in ("id", "nome", "grupo", "municipio_sede", "uf_sede")} if i in enr else {"id": i, "nome": i}
    # Editora por indicação (CA-26.6): a da própria linha ou, vazia, a de outra linha da MESMA edição (o Livro do Ano
    # repete a obra da categoria sem editora). Nunca a de outro ano ou prêmio: editora sem fonte da época fica vazia.
    da_edicao = {}
    for i in indicacoes.values():
        if i["_ed"]:
            da_edicao.setdefault((i["premio_id"], i["ano"], i["obra_id"]), alias.get(i["_ed"], i["_ed"]))
    for i in indicacoes.values():
        i["editora_id"] = alias.get(i["_ed"], i["_ed"]) or da_edicao.get((i["premio_id"], i["ano"], i["obra_id"]), "")

    gravar("pessoa", sorted(pessoas.values(), key=lambda p: p["id"]))
    # Só editoras usadas: grafias antigas e coedições que viraram canonico deixam de aparecer (a sede/grupo vive em
    # editoras_enriquecidas.csv, então nada se perde).
    for em in mapa["editora_mapeada"].values():
        em["editora_id"] = alias.get(em["editora_id"], em["editora_id"])
    usadas = {o["editora_id"] for o in obras.values()} | {i["editora_id"] for i in indicacoes.values()} | {e["editora_id"] for e in mapa["editora_mapeada"].values()}
    gravar("editora", sorted((e for e in editoras.values() if e["id"] in usadas), key=lambda e: e["id"]))
    gravar("obra", sorted(obras.values(), key=lambda o: o["id"]))
    gravar("autoria", [{"premio_id": pr, "obra_id": o, "pessoa_id": p, "papel": t} for pr, o, p, t in sorted(autoria)])
    gravar("indicacao", sorted(indicacoes.values(), key=lambda i: (i["premio_id"], i["ano"], i["nome_original"], i["obra_id"])))
    gravar("jurado", sorted(jurados.values(), key=lambda j: (j["premio_id"], j["ano"], j["nome_original"], j["pessoa_id"])))
    gravar("distincao", sorted(distincoes.values(), key=lambda d: (d["premio_id"], d["ano"], d["nome_original"], d["pessoa_id"])))
    for t in ("obra_mapeada", "editora_mapeada", "pessoa_atuacao"):
        gravar(t, [mapa[t][k] for k in sorted(mapa[t])])
    gravar("mapeamento_autoria", [{"obra_id": o, "pessoa_id": p, "papel": t} for o, p, t in sorted(mapa["mapeamento_autoria"])])
    for premio_id, linhas in revisar.items():  # refeito a cada execução; sem pendência, o arquivo some
        arq = BRUTO / premio_id / "casamentos_revisar.csv"
        if linhas:
            with arq.open("w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=CAMPOS_REVISAR)
                w.writeheader()
                w.writerows(sorted(linhas.values(), key=lambda l: l["nome"]))
        else:
            arq.unlink(missing_ok=True)
    pendentes = sum(map(len, revisar.values()))
    print(f"{len(pessoas)} pessoas, {len(editoras)} editoras, {len(obras)} obras, {len(indicacoes)} indicações, {len(jurados)} jurados, {len(distincoes)} distinções"
          + (f"; {pendentes} casamentos de pessoa para revisar (dados/coleta/<premio>/casamentos_revisar.csv)" if pendentes else ""))


GENERO = {"Q6581072": "mulher", "Q1052281": "mulher", "Q6581097": "homem", "Q2449503": "homem", "Q48270": "nao_binario"}


def api(**params) -> dict:
    """API de entidades do Wikidata (www.wikidata.org/w/api.php). Não depende do WDQS, que vive com limite de taxa."""
    url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({**params, "format": "json"})
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for tentativa in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or tentativa == 4:
                raise
            time.sleep(int(e.headers.get("Retry-After") or 10))


def _claim(ent: dict, prop: str):
    for c in ent.get("claims", {}).get(prop, []):
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if v is not None:
            return v
    return None


_ENT = {}


def entidades(ids: list[str]) -> dict:
    faltam = [i for i in dict.fromkeys(ids) if i and i not in _ENT]
    for k in range(0, len(faltam), 50):
        r = api(action="wbgetentities", ids="|".join(faltam[k:k + 50]), props="claims|labels|descriptions", languages="pt|pt-br|en")
        _ENT.update(r.get("entities", {}))
    return {i: _ENT.get(i, {}) for i in ids if i}


def _rotulo(ent: dict) -> str:
    for lang in ("pt", "pt-br", "en"):
        if lang in ent.get("labels", {}):
            return ent["labels"][lang]["value"]
    return ""


def uf_de(local: str, profundidade: int = 6) -> str:
    """Sobe por P131 (localizado em) até um item P31 = Q485258 (UF do Brasil) e devolve a sigla de P300."""
    atual = local
    for _ in range(profundidade):
        ent = entidades([atual]).get(atual, {})
        tipos = [c["mainsnak"].get("datavalue", {}).get("value", {}).get("id") for c in ent.get("claims", {}).get("P31", [])]
        if "Q485258" in tipos:
            return (_claim(ent, "P300") or "").replace("BR-", "")
        pai = _claim(ent, "P131")
        if not pai:
            return ""
        atual = pai["id"]
    return ""


def pais_de(local: str) -> str:
    """País do local de nascimento (P17), como ISO 3166-1 alfa-2 do item do país (P297), para quem nasceu fora do Brasil
    (DA-3). País histórico sem código ISO (ex.: Reino de Portugal) devolve vazio: confira à mão."""
    ent = entidades([local]).get(local, {})
    # Rank "preferred" primeiro e nada com data de fim (P582): Lviv ou Asmara têm países históricos listados antes.
    validas = [c for c in ent.get("claims", {}).get("P17", []) if c.get("rank") != "deprecated" and "P582" not in c.get("qualifiers", {})]
    validas.sort(key=lambda c: c.get("rank") != "preferred")
    pais = next((c["mainsnak"]["datavalue"]["value"]["id"] for c in validas if c.get("mainsnak", {}).get("datavalue")), "")
    if not pais:
        return ""
    return (_claim(entidades([pais]).get(pais, {}), "P297") or "").upper()


def nascimento_de(local: str) -> dict:
    """UF (Brasil) ou 'EX' + país (exterior) a partir do item do local de nascimento."""
    uf = uf_de(local)
    if uf:
        return {"uf_nascimento": uf, "pais_nascimento": ""}
    pais = pais_de(local)
    return {"uf_nascimento": "EX", "pais_nascimento": pais} if pais and pais != "BR" else {"uf_nascimento": "", "pais_nascimento": ""}


def wikidata():
    pessoas = ler("pessoa")
    alvo = [p for p in pessoas if not p.get("wikidata")]
    linhas = []
    for n, p in enumerate(alvo, 1):
        achados = api(action="wbsearchentities", search=p["nome"], language="pt", uselang="pt", type="item", limit=7).get("search", [])
        ents = entidades([a["id"] for a in achados])
        humanos = {q: e for q, e in ents.items() if any(c["mainsnak"].get("datavalue", {}).get("value", {}).get("id") == "Q5" for c in e.get("claims", {}).get("P31", []))}
        for q, e in humanos.items():
            gen = (_claim(e, "P21") or {}).get("id", "")
            nasc = (_claim(e, "P569") or {}).get("time", "")
            local = (_claim(e, "P19") or {}).get("id", "")
            linhas.append({"pessoa_id": p["id"], "nome": p["nome"], "qid": q, "rotulo": _rotulo(e), "n_candidatos": len(humanos),
                           "descricao": (e.get("descriptions", {}).get("pt") or e.get("descriptions", {}).get("en") or {}).get("value", ""),
                           "genero": GENERO.get(gen, ""), "ano_nascimento": nasc[1:5] if nasc.startswith("+") else "",
                           "municipio_nascimento": _rotulo(entidades([local]).get(local, {})) if local else "",
                           **(nascimento_de(local) if local else {"uf_nascimento": "", "pais_nascimento": ""})})
        if n % 20 == 0:
            print(f"  {n}/{len(alvo)}", flush=True)
    with (BRUTO / "wikidata_candidatos.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["pessoa_id", "nome", "qid", "rotulo", "n_candidatos", "descricao", "genero", "ano_nascimento", "municipio_nascimento", "uf_nascimento", "pais_nascimento", "confirmado"])
        w.writeheader()
        w.writerows(linhas)
    com = {l["pessoa_id"] for l in linhas}
    unicos = sum(1 for p in alvo if sum(l["pessoa_id"] == p["id"] for l in linhas) == 1)
    print(f"{len(alvo)} pessoas sem QID; {len(com)} com algum candidato humano; {unicos} com candidato único")
    print("Confira, marque confirmado=1 e rode: python coleta.py aplicar_wikidata")


def aplicar_wikidata():
    pessoas = ler("pessoa")
    conf = {c["pessoa_id"]: c for c in csv.DictReader((BRUTO / "wikidata_candidatos.csv").open(encoding="utf-8")) if c.get("confirmado") == "1"}
    n = 0
    for p in pessoas:
        c = conf.get(p["id"])
        if not c:
            continue
        url = f"https://www.wikidata.org/wiki/{c['qid']}"
        p["wikidata"] = c["qid"]
        if p.get("genero", "nao_identificado") == "nao_identificado" and c["genero"]:
            p["genero"], p["genero_fonte"] = c["genero"], url
        if not p.get("uf_nascimento") and c["uf_nascimento"]:
            p["uf_nascimento"], p["municipio_nascimento"], p["nascimento_fonte"] = c["uf_nascimento"], c["municipio_nascimento"], url
            if c["uf_nascimento"] == "EX":  # fora do Brasil: país ISO (DA-3); vazio se o Wikidata não deu código
                p["pais_nascimento"] = c.get("pais_nascimento", "")
        if not p.get("ano_nascimento") and c["ano_nascimento"]:
            p["ano_nascimento"] = c["ano_nascimento"]
            p["nascimento_fonte"] = p.get("nascimento_fonte") or url
        n += 1
    gravar("pessoa", pessoas)
    print(f"{n} pessoas atualizadas a partir do Wikidata")


def aplicar_pessoas():
    """Incorpora dados/coleta/pessoas_*.csv (pesquisa manual/assistida) em dados/pessoa.csv. Célula vazia não apaga dado."""
    from datetime import date
    pessoas = {p["id"]: p for p in ler("pessoa")}
    antes = {i: dict(p) for i, p in pessoas.items()}
    for arq in sorted(glob.glob(str(BRUTO / "pessoas_*.csv"))):
        for r in csv.DictReader(open(arq, encoding="utf-8")):
            p = pessoas.get(r["id"])
            if not p:
                print(f"  ignorado (id desconhecido): {r['id']} em {Path(arq).name}")
                continue
            for k in CAMPOS["pessoa"][2:-1]:
                if r.get(k, "").strip():
                    p[k] = r[k].strip()
            if r.get("genero_fonte", "").strip() and p.get("genero_evidencia"):  # fonte substitui gênero atribuído pelo nome (D16)
                p["genero_evidencia"] = ""
    n = 0
    for i, p in pessoas.items():
        if p != antes[i]:  # revisado_em só muda quando o resultado final muda
            p["revisado_em"] = date.today().isoformat()
            n += 1
    gravar("pessoa", sorted(pessoas.values(), key=lambda p: p["id"]))
    print(f"{n} pessoas atualizadas")


def _norm(s: str) -> str:
    s = html.unescape(re.sub(r"<[^>]+>", " ", s))  # páginas trazem entidades (&eacute;) e acentos em tags
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>|[^a-z0-9 ]", " ", s)).strip()


def verificar():
    """Confere cada trecho de raça contra a página citada. Resultado em dados/coleta/verificacao_raca.csv."""
    saida = []
    for p in ler("pessoa"):
        if p["raca"] == "sem_declaracao":
            continue
        status = "sem_trecho"
        if p.get("raca_trecho") and p.get("raca_fonte"):
            # curl e não urllib: o Python do python.org no macOS vem sem certificados (CERTIFICATE_VERIFY_FAILED)
            r = subprocess.run(["curl", "-sL", "--max-time", "40", "-A", "Mozilla/5.0 " + UA, "-w", "\n%{http_code} %{content_type}", p["raca_fonte"]],
                               capture_output=True)
            corpo, _, meta = r.stdout.rpartition(b"\n")
            codigo, _, tipo = meta.decode(errors="ignore").partition(" ")
            if r.returncode or not codigo.startswith("2"):
                status = f"erro: http {codigo or r.returncode}"  # fora do ar, bloqueio: conferência humana
            elif "pdf" in tipo:
                status = "pdf: conferir à mão"
            else:
                status = "confere" if _norm(p["raca_trecho"]) in _norm(corpo.decode("utf-8", "ignore")) else "nao_encontrado"
        saida.append({"pessoa_id": p["id"], "raca": p["raca"], "status": status, "fonte": p.get("raca_fonte", "")})
        print(f"{status:>16}  {p['id']}")
    with (BRUTO / "verificacao_raca.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["pessoa_id", "raca", "status", "fonte"])
        w.writeheader()
        w.writerows(saida)


# ---------- mídia e malha (interface narrativa, design D15) ----------

LICENCA_LIVRE = re.compile(r"^(cc[ -]by|cc0|public domain|pd\b|attribution$)", re.I)
NAO_RETRATO = re.compile(r"est[aá]tua|statue|busto|\bbust\b|assinatura|signature|t[uú]mulo|\bgrave\b", re.I)  # P18 que não é retrato


def _json(url: str) -> dict:
    """GET JSON via curl (certificados do sistema; urllib falha atrás de proxy com certificado próprio), com nova tentativa em 429/503."""
    for tentativa in range(5):
        r = subprocess.run(["curl", "-sL", "--max-time", "90", "-A", UA, "-w", "\n%{http_code}", url], capture_output=True)
        corpo, _, codigo = r.stdout.rpartition(b"\n")
        if r.returncode == 0 and codigo.startswith(b"2"):
            return json.loads(corpo)
        if codigo not in (b"429", b"503") or tentativa == 4:
            raise RuntimeError(f"GET {url[:80]}: curl {r.returncode}, http {codigo.decode() or '?'}")
        time.sleep(15)


def _texto(html_: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", html_ or ""))).strip()


def midia():
    """Para cada pessoa com QID: P18 (imagem) e verbete da pt.wikipedia; autoria e licença do arquivo no Commons."""
    pessoas = [p for p in ler("pessoa") if p.get("wikidata")]
    qids = sorted({p["wikidata"] for p in pessoas})
    ents = {}
    for k in range(0, len(qids), 50):
        r = api(action="wbgetentities", ids="|".join(qids[k:k + 50]), props="claims|sitelinks", sitefilter="ptwiki")
        ents.update(r.get("entities", {}))
    arquivos = {}
    for q, e in ents.items():
        img = _claim(e, "P18")
        if img:
            arquivos[q] = img
    meta = {}
    nomes_arq = sorted(set(arquivos.values()))
    for k in range(0, len(nomes_arq), 50):
        titulos = "|".join("File:" + a for a in nomes_arq[k:k + 50])
        r = _json("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(
            {"action": "query", "titles": titulos, "prop": "imageinfo", "iiprop": "extmetadata", "format": "json"}))
        norm = {n["to"]: n["from"] for n in r.get("query", {}).get("normalized", [])}
        for pg in r.get("query", {}).get("pages", {}).values():
            em = (pg.get("imageinfo") or [{}])[0].get("extmetadata", {})
            nome = norm.get(pg["title"], pg["title"]).removeprefix("File:")
            meta[nome] = {"autor": _texto(em.get("Artist", {}).get("value", "")),
                          "licenca": _texto(em.get("LicenseShortName", {}).get("value", "")),
                          "licenca_url": em.get("LicenseUrl", {}).get("value", "")}
    linhas, recusadas = [], []
    for p in sorted(pessoas, key=lambda p: p["id"]):
        e = ents.get(p["wikidata"], {})
        wiki = e.get("sitelinks", {}).get("ptwiki", {}).get("title", "")
        img = arquivos.get(p["wikidata"], "")
        m = meta.get(img, {}) if img else {}
        if img and (not (m.get("autor") and LICENCA_LIVRE.match(m.get("licenca", ""))) or NAO_RETRATO.search(img)):
            recusadas.append(f"{p['id']}: {img} ({m.get('licenca') or 'sem licença'}; autor: {m.get('autor') or '?'})")
            img, m = "", {}
        if img or wiki:
            linhas.append({"pessoa_id": p["id"], "imagem": img, "imagem_autor": m.get("autor", ""), "imagem_licenca": m.get("licenca", ""),
                           "imagem_licenca_url": m.get("licenca_url", ""), "wikipedia_pt": wiki})
    with (DADOS / "pessoa_midia.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["pessoa_id", "imagem", "imagem_autor", "imagem_licenca", "imagem_licenca_url", "wikipedia_pt"])
        w.writeheader()
        w.writerows(linhas)
    print(f"{len(pessoas)} pessoas com QID; {sum(1 for l in linhas if l['imagem'])} com foto livre; "
          f"{sum(1 for l in linhas if l['wikipedia_pt'])} com verbete na pt.wikipedia; {len(recusadas)} fotos recusadas")
    for r in recusadas:
        print("  recusada:", r)


IBGE_UF = {"11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE",
           "24": "RN", "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP",
           "41": "PR", "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF"}


def malha():
    """Limites das UFs (IBGE, malha mínima) com a sigla em properties.uf e coordenadas com 3 casas."""
    g = _json("https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?" + urllib.parse.urlencode(
        {"formato": "application/vnd.geo+json", "qualidade": "minima", "intrarregiao": "UF"}))

    def arred(c):
        return [round(c[0], 3), round(c[1], 3)] if isinstance(c[0], (int, float)) else [arred(x) for x in c]

    feats = [{"type": "Feature", "properties": {"uf": IBGE_UF[f["properties"]["codarea"]]},
              "geometry": {"type": f["geometry"]["type"], "coordinates": arred(f["geometry"]["coordinates"])}}
             for f in g["features"]]
    saida = RAIZ / "web" / "br-uf.json"
    saida.write_text(json.dumps({"type": "FeatureCollection", "fonte": "IBGE, API de malhas v3 (qualidade mínima)",
                                 "features": sorted(feats, key=lambda f: f["properties"]["uf"])}, separators=(",", ":")), encoding="utf-8")
    print(f"{len(feats)} UFs em {saida.name} ({saida.stat().st_size // 1024} KB)")


FOTOS = RAIZ / "web" / "fotos"
LARGURAS_FOTO = (160, 480)  # anel e abertura (até 128 px na tela, 2x) · perfil (220 px na tela, 2x)


def _baixar(url: str) -> bytes:
    """GET binário via curl, com nova tentativa em 429/503 (mesma política de _json)."""
    for tentativa in range(5):
        r = subprocess.run(["curl", "-sL", "--max-time", "90", "-A", UA, "-w", "\n%{http_code}", url], capture_output=True)
        corpo, _, codigo = r.stdout.rpartition(b"\n")
        if r.returncode == 0 and codigo.startswith(b"2"):
            return corpo
        if codigo not in (b"429", b"503") or tentativa == 4:
            raise RuntimeError(f"GET {url[:80]}: curl {r.returncode}, http {codigo.decode() or '?'}")
        time.sleep(15)


def miniaturas():
    """Fotos livres do Commons → web/fotos/<pessoa_id>-<largura>.webp (RNF-08): o site serve as próprias miniaturas,
    sem cookies de terceiros. Só baixa o que falta; o build marca quem tem miniatura (midia.miniatura)."""
    import io
    from PIL import Image  # só esta coleta usa o Pillow
    FOTOS.mkdir(exist_ok=True)
    novas = falhas = 0
    for m in ler("pessoa_midia"):
        alvos = {w: FOTOS / f"{m['pessoa_id']}-{w}.webp" for w in LARGURAS_FOTO}
        if not m.get("imagem") or all(a.exists() for a in alvos.values()):
            continue
        try:
            im = Image.open(io.BytesIO(_baixar("https://commons.wikimedia.org/wiki/Special:FilePath/"
                                               + urllib.parse.quote(m["imagem"]) + f"?width={max(LARGURAS_FOTO)}")))
            im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
            for w, alvo in alvos.items():
                c = im.copy()
                c.thumbnail((w, w * 3), Image.LANCZOS)
                c.save(alvo, "WEBP", quality=72, method=6)
            novas += 1
        except Exception as e:  # uma foto ruim não para as outras; fica sem miniatura e o site usa o Commons
            falhas += 1
            print(f"  {m['pessoa_id']}: {e}")
        time.sleep(0.3)
    total = sum(f.stat().st_size for f in FOTOS.glob("*.webp"))
    print(f"{novas} pessoas com miniaturas novas, {falhas} falhas; web/fotos com {total // 1024} KB")


# ---------- capas das obras (RF-24) ----------
SEM_CAPA = DADOS / "coleta" / "capas_sem_resultado.txt"  # obras já procuradas sem capa que bata (não repete a busca)


def sobrenome(nome: str) -> str:
    """Último nome que identifica (pula Júnior, Filho, Neto…): "Itamar Vieira Junior" → "vieira"."""
    partes = [p for p in _norm(re.sub(r"\(.*?\)", "", nome)).split(" ") if p not in {"junior", "jr", "filho", "neto", "sobrinho", "segundo"}]
    return partes[-1] if partes else ""


def casa_capa(titulo: str, sobrenomes: list[str], cand_titulo: str, cand_autores: list[str]) -> bool:
    """Aceita a capa só se o título bate (igual, ou um é o outro mais subtítulo) e um sobrenome de autor aparece no candidato."""
    t, c = _norm(titulo), _norm(cand_titulo)
    if not t or not c or not (t == c or c.startswith(t + " ") or t.startswith(c + " ")):
        return False
    autores = " " + _norm(" ".join(cand_autores)) + " "
    return any(f" {s} " in autores for s in sobrenomes if s)


def _capa_google(titulo: str, sobrenomes: list[str]):
    q = urllib.parse.quote(f'intitle:"{titulo}"' + (f" inauthor:{sobrenomes[0]}" if sobrenomes else ""))
    r = _json(f"https://www.googleapis.com/books/v1/volumes?q={q}&maxResults=10&printType=books&langRestrict=pt")
    for it in r.get("items", []):
        v = it.get("volumeInfo", {})
        img = (v.get("imageLinks") or {}).get("thumbnail")
        cand = " ".join(filter(None, [v.get("title"), v.get("subtitle")]))
        if img and casa_capa(titulo, sobrenomes, cand, v.get("authors", [])):
            img = img.replace("http://", "https://").replace("&edge=curl", "")
            return {"capa_url": img, "fonte": "google_books", "pagina": (v.get("canonicalVolumeLink") or v.get("infoLink") or "").replace("http://", "https://") or None}
    return None


def _capa_openlibrary(titulo: str, sobrenomes: list[str]):
    q = urllib.parse.urlencode({"title": titulo, "author": sobrenomes[0] if sobrenomes else "", "fields": "key,title,author_name,cover_i", "limit": 10})
    for d in _json(f"https://openlibrary.org/search.json?{q}").get("docs", []):
        if not casa_capa(titulo, sobrenomes, d.get("title", ""), d.get("author_name", [])):
            continue
        # A capa da obra (cover_i) pode ser de uma tradução: vale só a de uma edição em português.
        for ed in _json(f"https://openlibrary.org{d['key']}/editions.json?limit=100").get("entries", []):
            if ed.get("covers") and ed["covers"][0] > 0 and any(l.get("key") == "/languages/por" for l in ed.get("languages", [])):
                return {"capa_url": f"https://covers.openlibrary.org/b/id/{ed['covers'][0]}-M.jpg", "fonte": "open_library", "pagina": f"https://openlibrary.org{ed['key']}"}
    return None


def capas():
    """Capa de cada obra indicada: Google Books e, se não achar (ou a cota acabar), Open Library. Só grava o que bate
    título + sobrenome de autor. Retoma de onde parou: pula quem já tem capa e quem está em capas_sem_resultado.txt."""
    pessoa = {p["id"]: p["nome"] for p in ler("pessoa")}
    autores: dict[str, list[str]] = {}
    for a in ler("autoria"):
        if a["papel"] == "autor":
            autores.setdefault(a["obra_id"], []).append(sobrenome(pessoa.get(a["pessoa_id"], "")))
    obras = {o["id"]: o for o in ler("obra")}
    feitas = {c["obra_id"]: c for c in ler("obra_capa")}
    sem = set(SEM_CAPA.read_text(encoding="utf-8").split()) if SEM_CAPA.exists() else set()
    fila = sorted({i["obra_id"] for i in ler("indicacao")} - set(feitas) - sem)
    google = True
    print(f"{len(fila)} obras a procurar")
    for k, oid in enumerate(fila, 1):
        o, sob = obras[oid], autores.get(oid, [])
        achou = None
        if google:
            try:
                achou = _capa_google(o["titulo"], sob)
            except RuntimeError as e:
                print(f"  Google Books parou ({e}); seguindo só com a Open Library")
                google = False
        if not achou:
            try:
                achou = _capa_openlibrary(o["titulo"], sob)
            except RuntimeError as e:
                print(f"  {oid}: {e}")
                continue  # erro de rede: tenta de novo na próxima execução
        if achou:
            feitas[oid] = {"obra_id": oid, **achou}
        elif google:  # só marca "sem capa" se as duas fontes responderam; sem a cota do Google, tenta de novo outro dia
            sem.add(oid)
        if k % 25 == 0 or k == len(fila):  # grava aos poucos: dá para interromper e retomar
            gravar("obra_capa", sorted(feitas.values(), key=lambda c: c["obra_id"]))
            SEM_CAPA.write_text("\n".join(sorted(sem)) + "\n", encoding="utf-8")
            print(f"  {k}/{len(fila)}: {len(feitas)} com capa, {len(sem)} sem")
        time.sleep(0.5)


def imagens():
    """Junta dados/coleta/imagens/fotos_*.csv e capas_*.csv (PROTOCOLO.md da pasta, D34): foto com direitos reservados só para
    quem não tem foto livre (→ pessoa_foto.csv) e capa só para obra sem capa (→ obra_capa.csv). O primeiro arquivo em ordem
    alfabética vence; refazer do zero as fotos a cada execução deixa a junção reproduzível."""
    pasta = DADOS / "coleta" / "imagens"
    livres = {m["pessoa_id"] for m in ler("pessoa_midia") if m.get("imagem")}
    pessoas, obras = {p["id"] for p in ler("pessoa")}, {o["id"] for o in ler("obra")}
    ok = lambda u: (u or "").startswith("https://")
    fotos = {}
    for arq in sorted(pasta.glob("fotos_*.csv")):
        for l in csv.DictReader(arq.open(encoding="utf-8")):
            pid = l["pessoa_id"]
            if pid in pessoas and pid not in livres and pid not in fotos and ok(l["imagem_url"]) and l["pagina"].startswith("http") and l["fonte"].strip():
                fotos[pid] = {"pessoa_id": pid, "foto_url": l["imagem_url"], "pagina": l["pagina"], "fonte": l["fonte"].strip()}
    gravar("pessoa_foto", [fotos[k] for k in sorted(fotos)])
    capas = {c["obra_id"]: c for c in ler("obra_capa")}
    antes = len(capas)
    for arq in sorted(pasta.glob("capas_*.csv")):
        for l in csv.DictReader(arq.open(encoding="utf-8")):
            oid = l["obra_id"]
            if oid in obras and oid not in capas and ok(l["capa_url"]) and l["pagina"].startswith("http") and l["fonte"].strip():
                capas[oid] = {"obra_id": oid, "capa_url": l["capa_url"], "fonte": l["fonte"].strip(), "pagina": l["pagina"]}
    gravar("obra_capa", [capas[k] for k in sorted(capas)])
    print(f"{len(fotos)} fotos com direitos reservados; {len(capas) - antes} capas novas ({len(capas)} no total)")


def contexto():
    """Junta os lotes de texto de edição (dados/coleta/contexto/lote_*.csv, PROTOCOLO.md) em dados/edicao_contexto.csv (RF-28).
    Lote posterior (ordem numérica) vence na mesma edição; o build confere fonte e edição."""
    lotes = sorted((DADOS / "coleta" / "contexto").glob("lote_*.csv"), key=lambda a: int(re.search(r"(\d+)", a.stem).group(1)))
    textos = {}
    for arq in lotes:
        for l in csv.DictReader(arq.open(encoding="utf-8")):
            textos[(l["premio_id"], int(l["ano"]))] = {**l, "texto": l["texto"].strip(), "fontes": " ; ".join(u.strip() for u in l["fontes"].split(";") if u.strip())}
    gravar("edicao_contexto", [textos[k] for k in sorted(textos)])
    revisar = [f"{p} {a}: {t['revisar']}" for (p, a), t in sorted(textos.items()) if t.get("revisar")]
    print(f"{len(textos)} textos de {len(lotes)} lotes; {len(revisar)} pedem revisão humana")
    for r in revisar:
        print(f"  REVISAR {r}")


IBGE_LOCALIDADES = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
IBGE_POP = "https://servicodados.ibge.gov.br/api/v3/agregados/4709/periodos/2022/variaveis/93?localidades={nivel}%5Ball%5D"
CAMPOS_TERRITORIO = ["codigo", "tipo", "nome", "sigla", "pai", "populacao_2022"]


def territorio():
    """Brasil, regiões, UFs e municípios com os códigos do IBGE e a população do Censo 2022 (RF-32, D38) → dados/territorio.csv.
    Códigos não colidem entre níveis: BR, região com 1 dígito, UF com 2, município com 7."""
    pop = {}
    for nivel in ("N1", "N2", "N3", "N6"):
        for s in _json(IBGE_POP.format(nivel=nivel))[0]["resultados"][0]["series"]:
            pop[(nivel, s["localidade"]["id"])] = s["serie"]["2022"]
    linhas = [{"codigo": "BR", "tipo": "pais", "nome": "Brasil", "sigla": "BR", "pai": "", "populacao_2022": pop[("N1", "1")]}]
    regioes, ufs = {}, {}
    for m in _json(IBGE_LOCALIDADES):
        uf = (m.get("microrregiao") or m["regiao-imediata"]["regiao-intermediaria"])
        uf = uf["mesorregiao"]["UF"] if "mesorregiao" in uf else uf["UF"]
        regioes[str(uf["regiao"]["id"])] = uf["regiao"]["nome"]
        ufs[str(uf["id"])] = (uf["sigla"], uf["nome"], str(uf["regiao"]["id"]))
        # Município instalado depois do Censo 2022 (Boa Esperança do Norte, MT) não tem população própria: fica vazia.
        linhas.append({"codigo": str(m["id"]), "tipo": "municipio", "nome": m["nome"], "sigla": "", "pai": str(uf["id"]),
                       "populacao_2022": pop.get(("N6", str(m["id"])), "")})
    linhas += [{"codigo": c, "tipo": "regiao", "nome": n, "sigla": "", "pai": "BR", "populacao_2022": pop[("N2", c)]} for c, n in regioes.items()]
    linhas += [{"codigo": c, "tipo": "uf", "nome": n, "sigla": s, "pai": r, "populacao_2022": pop[("N3", c)]} for c, (s, n, r) in ufs.items()]
    ordem = {"pais": 0, "regiao": 1, "uf": 2, "municipio": 3}
    linhas.sort(key=lambda l: (ordem[l["tipo"]], l["codigo"]))
    with (DADOS / "territorio.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CAMPOS_TERRITORIO)
        w.writeheader()
        w.writerows(linhas)
    print(f"{len(regioes)} regiões, {len(ufs)} UFs, {sum(l['tipo'] == 'municipio' for l in linhas)} municípios "
          f"({sum(1 for l in linhas if l['tipo'] == 'municipio' and not l['populacao_2022'])} sem população do Censo 2022)")


def malha_municipios():
    """Malha municipal por UF (CA-32.5, D38): web/malha/<UF>.json, com o código do município em properties.codigo."""
    pasta = RAIZ / "web" / "malha"
    pasta.mkdir(exist_ok=True)

    def arred(c):
        return [round(c[0], 3), round(c[1], 3)] if isinstance(c[0], (int, float)) else [arred(x) for x in c]

    total = 0
    for cod, uf in sorted(IBGE_UF.items(), key=lambda x: x[1]):
        g = _json(f"https://servicodados.ibge.gov.br/api/v3/malhas/estados/{cod}?" + urllib.parse.urlencode(
            {"formato": "application/vnd.geo+json", "qualidade": "minima", "intrarregiao": "municipio"}))
        feats = [{"type": "Feature", "properties": {"codigo": f["properties"]["codarea"]},
                  "geometry": {"type": f["geometry"]["type"], "coordinates": arred(f["geometry"]["coordinates"])}} for f in g["features"]]
        (pasta / f"{uf}.json").write_text(json.dumps({"type": "FeatureCollection", "fonte": "IBGE, API de malhas v3 (qualidade mínima)",
                                                      "features": sorted(feats, key=lambda f: f["properties"]["codigo"])}, separators=(",", ":")), encoding="utf-8")
        total += (pasta / f"{uf}.json").stat().st_size
    print(f"27 UFs em web/malha/ ({total // 1024} KB no total)")


# ---------- módulo Leitura (RF-33, D39) ----------
CACHE = Path.home() / "Library" / "Caches" / "literadados"
CAMPOS_VALOR = ["indicador_id", "territorio", "ano", "dimensao", "categoria", "valor", "numerador", "denominador", "amostra", "margem", "suprimido", "fonte_url"]


def _territorios():
    """{código: linha} de dados/territorio.csv e a cadeia de pais de cada município (UF, região, BR)."""
    t = {l["codigo"]: l for l in csv.DictReader((DADOS / "territorio.csv").open(encoding="utf-8"))}
    return t


def _gravar_valores(indicador: str, linhas: list[dict]):
    pasta = DADOS / "indicador_valor"
    pasta.mkdir(exist_ok=True)
    linhas.sort(key=lambda l: (len(l["territorio"]) if l["territorio"] != "BR" else 0, l["territorio"], int(l["ano"]), l["dimensao"], l["categoria"]))
    with (pasta / f"{indicador}.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CAMPOS_VALOR)
        w.writeheader()
        w.writerows({c: l.get(c, "") for c in CAMPOS_VALOR} | {"suprimido": "true" if l.get("suprimido") else "false"} for l in linhas)
    print(f"{indicador}: {len(linhas)} valores em dados/indicador_valor/{indicador}.csv")


def _somar_acima(t: dict, por_mun: dict) -> dict:
    """{(município, chave): [num, den]} → acrescenta UF, região e BR somando numerador e denominador (registro e censo)."""
    tot = dict(por_mun)
    for (m, k), (n, d) in por_mun.items():
        uf = t[m]["pai"]
        for c in (uf, t[uf]["pai"], "BR"):
            a = tot.setdefault((c, k), [0, 0])
            a[0] += n
            a[1] += d
    return tot


SIDRA_ALFA = "https://servicodados.ibge.gov.br/api/v3/agregados/9542/periodos/2022/variaveis/950?localidades={nivel}%5Ball%5D&classificacao=59%5B93024,1023%5D%7C{cls}"
RECORTES_ALFA = {  # dimensão → (classificação SIDRA, {categoria SIDRA: categoria do Literadados})
    "total": ("2%5B6794%5D", {"6794": "total"}),
    "sexo": ("2%5B4,5%5D", {"4": "homens", "5": "mulheres"}),
    "cor_raca": ("86%5B2776,2777,2778,2779,2780%5D", {"2776": "branca", "2777": "preta", "2778": "amarela", "2779": "parda", "2780": "indigena"}),
    "faixa_etaria": ("287%5B93086,93087,2999,9482,9483,9484,3000%5D",
                     {"93086": "15-19", "93087": "20-24", "2999": "25-34", "9482": "35-44", "9483": "45-54", "9484": "55-64", "3000": "65+"}),
}


def _leitura_alfabetizacao():
    """Censo 2022 (SIDRA 9542): pessoas de 15 anos ou mais, total e alfabetizadas, por município, UF, região e Brasil."""
    linhas = []
    for dim, (cls, cats) in RECORTES_ALFA.items():
        for nivel in ("N1", "N2", "N3", "N6"):
            url = SIDRA_ALFA.format(nivel=nivel, cls=cls)
            par = {}
            for res in _json(url)[0]["resultados"]:
                alfa = "1023" in res["classificacoes"][0]["categoria"]
                cat = next(c for cl in res["classificacoes"][1:] for c in cl["categoria"] if c in cats)
                for s in res["series"]:
                    loc = s["localidade"]["id"]
                    par.setdefault((loc, cats[cat]), {})["alfa" if alfa else "total"] = s["serie"]["2022"]
            for (loc, cat), v in par.items():
                total, alfa = v.get("total"), v.get("alfa")
                territorio = "BR" if nivel == "N1" else loc
                fonte = f"https://sidra.ibge.gov.br/tabela/9542#{dim}"
                if total in ("X", "..") or alfa in ("X", ".."):  # sigilo ou não disponível na fonte
                    linhas.append({"indicador_id": "alfabetizacao", "territorio": territorio, "ano": "2022", "dimensao": dim, "categoria": cat,
                                   "suprimido": True, "fonte_url": fonte})
                    continue
                total, alfa = int(total) if total not in ("-", None) else 0, int(alfa) if alfa not in ("-", None) else 0
                if not total:  # ninguém nesse grupo no município: não há taxa
                    continue
                linhas.append({"indicador_id": "alfabetizacao", "territorio": territorio, "ano": "2022", "dimensao": dim, "categoria": cat,
                               "valor": round(100 * alfa / total, 2), "numerador": alfa, "denominador": total, "fonte_url": fonte})
    _gravar_valores("alfabetizacao", linhas)


def _leitura_escolas_biblioteca():
    """Censo Escolar (microdados do INEP, em CACHE/censo_escolar/<ano>.zip): escolas em atividade com biblioteca ou sala de leitura."""
    import zipfile
    t = _territorios()
    linhas = []
    for arq in sorted((CACHE / "censo_escolar").glob("*.zip")):
        ano = arq.stem
        z = zipfile.ZipFile(arq)
        membro = next(n for n in z.namelist() if re.search(rf"microdados_ed_basica_{ano}\.csv$", n, re.I))
        with z.open(membro) as f:
            leitor = csv.reader((l.decode("latin-1") for l in f), delimiter=";")
            cab = next(leitor)
            i_mun, i_dep, i_sit, i_bib = (cab.index(c) for c in ("CO_MUNICIPIO", "TP_DEPENDENCIA", "TP_SITUACAO_FUNCIONAMENTO", "IN_BIBLIOTECA_SALA_LEITURA"))
            por = {}
            for r in leitor:
                if r[i_sit] != "1" or r[i_mun] not in t:  # só escolas em atividade
                    continue
                tem = r[i_bib] == "1"
                for rede in ("total", "privada" if r[i_dep] == "4" else "publica"):
                    a = por.setdefault((r[i_mun], rede), [0, 0])
                    a[0] += tem
                    a[1] += 1
        url = f"https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_{ano}.zip"  # o arquivo do ano, na fonte
        for (c, rede), (n, d) in _somar_acima(t, por).items():
            linhas.append({"indicador_id": "escolas_biblioteca", "territorio": c, "ano": ano, "dimensao": "total" if rede == "total" else "rede",
                           "categoria": rede, "valor": round(100 * n / d, 2), "numerador": n, "denominador": d, "fonte_url": url})
        print(f"  {ano}: {sum(d for (c, r), (n, d) in por.items() if r == 'total')} escolas em atividade")
    _gravar_valores("escolas_biblioteca", linhas)


CNAE_LIVRARIA, CNAE_EDITORA = {"4761001"}, {"5811500", "5821200"}


def _leitura_cnpj():
    """Estabelecimentos ativos do CNPJ (CACHE/cnpj/estab_*.csv, já filtrados pelos CNAEs; baixar.sh) por município do IBGE.
    O município da Receita usa o código do SIAFI/TOM: de-para pelo nome + UF, exceções em dados/coleta/leitura/cnpj_municipios.csv."""
    t = _territorios()
    norm = lambda s: re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", s.lower()).encode("ascii", "ignore").decode())
    ibge = {(norm(l["nome"]), t[l["pai"]]["sigla"]): c for c, l in t.items() if l["tipo"] == "municipio"}
    receita = {c: n for c, n in csv.reader((CACHE / "cnpj" / "municipios.csv").open(encoding="latin-1"), delimiter=";")}
    excecoes = {}
    arq_exc = DADOS / "coleta" / "leitura" / "cnpj_municipios.csv"
    if arq_exc.exists():
        excecoes = {l["codigo_receita"]: l["codigo_ibge"] for l in csv.DictReader(arq_exc.open(encoding="utf-8"))}
    por, sem, mes = {}, set(), "2026-11"
    for arq in sorted((CACHE / "cnpj").glob("estab_*.csv")):
        for r in csv.reader(arq.open(encoding="latin-1"), delimiter=";"):
            if len(r) < 21 or r[5] != "02":  # só ativas
                continue
            ind = "livrarias_cnpj" if r[11] in CNAE_LIVRARIA else "editoras_cnpj" if r[11] in CNAE_EDITORA else None
            if not ind or r[19] == "EX":
                continue
            cod = excecoes.get(r[20]) or ibge.get((norm(receita.get(r[20], "")), r[19]))
            if not cod:
                sem.add((r[20], receita.get(r[20]), r[19]))
                continue
            por.setdefault(ind, {}).setdefault((cod, "total"), [0, 0])[0] += 1
    if sem:
        raise SystemExit("municípios da Receita sem código do IBGE (acrescente em dados/coleta/leitura/cnpj_municipios.csv):\n  "
                         + "\n  ".join(f"{c} {n} ({u})" for c, n, u in sorted(sem, key=str)))
    url = f"https://www.gov.br/receitafederal/pt-br/assuntos/orientacao-tributaria/cadastros/consultas/dados-publicos-cnpj#{mes}"
    for ind, p in por.items():
        # Cadastro completo: município sem estabelecimento tem contagem zero (não "sem valor").
        for c, l in t.items():
            if l["tipo"] == "municipio":
                p.setdefault((c, "total"), [0, 0])
        tot = _somar_acima(t, p)
        _gravar_valores(ind, [{"indicador_id": ind, "territorio": c, "ano": mes[:4], "dimensao": "total", "categoria": "total",
                               "valor": n, "fonte_url": url} for (c, _), (n, _d) in tot.items()])


def _leitura_retratos():
    """Retratos da Leitura: dados/coleta/leitura/retratos.csv (transcrição com página) → indicador_valor de leitores e livros_por_ano."""
    for ind in ("leitores", "livros_por_ano"):
        linhas = [{**l, "indicador_id": ind} for l in csv.DictReader((DADOS / "coleta" / "leitura" / "retratos.csv").open(encoding="utf-8"))
                  if l["indicador"] == ind]
        _gravar_valores(ind, linhas)


CAMPOS_LIVRARIA = ["id", "nome", "municipio", "tipo", "foco", "rede", "endereco", "bairro", "lat", "lon", "site", "redes", "situacao",
                   "ano_abertura", "ano_encerramento", "fonte", "verificado_em"]
CAMPOS_CLUBE = ["id", "nome", "municipio", "formato", "periodicidade", "foco", "aberto", "organizacao", "local_tipo", "livraria_id", "local_nome",
                "bairro", "lat", "lon", "link", "situacao", "fonte", "verificado_em"]


def mapeamento():
    """dados/coleta/mapeamento/<código>/livrarias.csv e clubes.csv → dados/livraria.csv e dados/clube.csv (RF-34, D40), com id em slug.
    Clube numa livraria aponta para ela pelo nome. Privacidade: clube em casa ou on-line perde bairro, local e coordenadas."""
    livs, clubes = [], []
    for pasta in sorted(p for p in (BRUTO / "mapeamento").glob("*") if p.is_dir()):
        mun, ids, por_nome = pasta.name, set(), {}
        ler_ = lambda nome: list(csv.DictReader((pasta / nome).open(encoding="utf-8"))) if (pasta / nome).exists() else []

        def novo_id(nome):
            base, i = slug(nome), 2
            lid = base
            while lid in ids:
                lid, i = f"{base}-{i}", i + 1
            ids.add(lid)
            return lid
        for r in ler_("livrarias.csv"):
            lid = novo_id(r["nome"])
            por_nome[r["nome"].strip().lower()] = lid
            livs.append({**{c: (r.get(c) or "").strip() for c in CAMPOS_LIVRARIA}, "id": lid, "municipio": mun,
                         "rede": "true" if (r.get("rede") or "").strip().lower() in ("true", "1", "sim") else "false"})
        ids_c = set()
        for r in ler_("clubes.csv"):
            base, i = slug(r["nome"]), 2
            cid = base
            while cid in ids_c:
                cid, i = f"{base}-{i}", i + 1
            ids_c.add(cid)
            c = {**{k: (r.get(k) or "").strip() for k in CAMPOS_CLUBE}, "id": cid, "municipio": mun}
            c["livraria_id"] = por_nome.get((r.get("livraria") or "").strip().lower(), "")
            if c["local_tipo"] == "livraria" and not c["livraria_id"]:
                print(f"  clube {r['nome']}: livraria '{r.get('livraria')}' não está em livrarias.csv; local vira espaco_publico")
                c["local_tipo"] = "espaco_publico"
                c["local_nome"] = c["local_nome"] or r.get("livraria", "")
            if c["local_tipo"] in ("casa", "online", "nao_informado"):
                c.update(bairro="", lat="", lon="", local_nome="")
            c["aberto"] = {"true": "true", "1": "true", "sim": "true", "false": "false", "0": "false", "não": "false"}.get(c["aberto"].lower(), "")
            clubes.append(c)
    for nome, campos, linhas in (("livraria", CAMPOS_LIVRARIA, livs), ("clube", CAMPOS_CLUBE, clubes)):
        with (DADOS / f"{nome}.csv").open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=campos)
            w.writeheader()
            w.writerows(linhas)
    print(f"{len(livs)} livrarias e {len(clubes)} clubes em dados/livraria.csv e dados/clube.csv")


CAMPOS_EVENTO = ["id", "nome", "tipo", "municipio", "organizador", "site", "redes", "ano_inicio", "fonte", "verificado_em"]
CAMPOS_EDICAO = ["evento_id", "numero", "ano", "data_inicio", "data_fim", "municipio", "local", "tema", "situacao", "formato", "publico",
                 "publico_fonte", "fonte", "verificado_em"]


def eventos():
    """dados/coleta/eventos/eventos_N.csv + edicoes_N.csv (RF-35, D41) → dados/evento.csv, evento_edicao.csv e evento_homenageado.csv.
    Município por nome + UF contra territorio (exceções em dados/coleta/eventos/municipios.csv: municipio, uf, codigo)."""
    pasta = BRUTO / "eventos"
    t = {l["codigo"]: l for l in csv.DictReader((DADOS / "territorio.csv").open(encoding="utf-8"))}
    norm = lambda s: re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", (s or "").lower()).encode("ascii", "ignore").decode())
    cod = {(norm(l["nome"]), t[l["pai"]]["sigla"]): c for c, l in t.items() if l["tipo"] == "municipio"}
    exc = {(norm(l["municipio"]), l["uf"]): l["codigo"] for l in csv.DictReader((pasta / "municipios.csv").open(encoding="utf-8"))} if (pasta / "municipios.csv").exists() else {}
    pessoas = {p["id"] for p in ler("pessoa")}
    sem = set()

    def municipio(nome, uf):
        c = exc.get((norm(nome), uf)) or cod.get((norm(nome), uf))
        if not c:
            sem.add(f"{nome} ({uf})")
        return c or ""
    evs, por_nome, eds, hom = {}, {}, {}, {}
    for arq in sorted(pasta.glob("eventos_*.csv")):
        for r in csv.DictReader(arq.open(encoding="utf-8")):
            eid = slug(r["nome"])
            if eid in evs:
                continue
            por_nome[r["nome"].strip()] = eid
            # Evento itinerante (sem sede na fonte): a sede vira a cidade da edição mais recente, logo abaixo.
            evs[eid] = {**{c: (r.get(c) or "").strip() for c in CAMPOS_EVENTO}, "id": eid,
                        "municipio": municipio(r["municipio"], r["uf"]) if (r.get("municipio") or "").strip() else ""}
    for arq in sorted(pasta.glob("edicoes_*.csv")):
        for r in csv.DictReader(arq.open(encoding="utf-8")):
            eid = por_nome.get(r["evento"].strip()) or (slug(r["evento"]) if slug(r["evento"]) in evs else None)
            if not eid:
                raise SystemExit(f"{arq.name}: evento '{r['evento']}' não está em nenhum eventos_*.csv")
            ini = (r.get("data_inicio") or "").strip()
            if not ini:
                continue
            mun, uf = (r.get("municipio") or "").strip(), (r.get("uf") or "").strip()
            sede = evs[eid]["municipio"]
            d = {**{c: (r.get(c) or "").strip() for c in CAMPOS_EDICAO}, "evento_id": eid, "ano": ini[:4],
                 # sem município na edição, vale a sede do evento; sem UF, a da sede
                 "municipio": municipio(mun, uf or (t[t[sede]["pai"]]["sigla"] if sede else "")) if mun else (sede or municipio("", uf))}
            eds[(eid, ini)] = d
            for n in [x.strip() for x in (r.get("homenageados") or "").split("|") if x.strip()]:
                hom[(eid, ini, n)] = {"evento_id": eid, "data_inicio": ini, "nome": n, "pessoa_id": slug(n) if slug(n) in pessoas else ""}
    for eid, ev in evs.items():
        if not ev["municipio"]:
            recentes = sorted((d for d in eds.values() if d["evento_id"] == eid and d["municipio"]), key=lambda d: d["data_inicio"])
            if not recentes:
                sem.add(f"{ev['nome']} (sem cidade-sede nem edição com cidade)")
                continue
            ev["municipio"] = recentes[-1]["municipio"]
    if sem:
        raise SystemExit("municípios sem código do IBGE (acrescente em dados/coleta/eventos/municipios.csv):\n  " + "\n  ".join(sorted(sem)))
    for nome, campos, linhas in (("evento", CAMPOS_EVENTO, [evs[k] for k in sorted(evs)]),
                                  ("evento_edicao", CAMPOS_EDICAO, [eds[k] for k in sorted(eds)]),
                                  ("evento_homenageado", ["evento_id", "data_inicio", "nome", "pessoa_id"], [hom[k] for k in sorted(hom)])):
        with (DADOS / f"{nome}.csv").open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=campos)
            w.writeheader()
            w.writerows(linhas)
    print(f"{len(evs)} eventos, {len(eds)} edições, {len(hom)} homenageados ({sum(1 for h in hom.values() if h['pessoa_id'])} na base)")


def leitura():
    """coleta.py leitura <fonte>: alfabetizacao · escolas_biblioteca · cnpj · retratos."""
    {"alfabetizacao": _leitura_alfabetizacao, "escolas_biblioteca": _leitura_escolas_biblioteca,
     "cnpj": _leitura_cnpj, "retratos": _leitura_retratos}[sys.argv[2]]()


if __name__ == "__main__":
    {"leitura": leitura, "mapeamento": mapeamento, "eventos": eventos, "normalizar": normalizar, "wikidata": wikidata, "aplicar_wikidata": aplicar_wikidata,
     "aplicar_pessoas": aplicar_pessoas, "verificar": verificar, "midia": midia, "malha": malha, "miniaturas": miniaturas, "capas": capas, "imagens": imagens, "contexto": contexto,
     "territorio": territorio, "malha_municipios": malha_municipios}[sys.argv[1]]()
