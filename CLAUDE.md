# CLAUDE.md — JabutiDados

Painel e IA sobre perfil demográfico (gênero, raça autodeclarada, UF de nascimento) de autores do Prêmio Jabuti 2010–2025.

## Como trabalhar aqui (SDD)
1. Mudança de comportamento → primeiro `spec/spec.md` (requisito + critério de aceitação), depois `spec/design.md`, depois `spec/tasks.md`, só então código.
2. Critério 🧪 precisa de teste em `tests/`; critério 👁 é conferido no navegador.
3. Dado novo entra por `dados/*.csv` (fonte da verdade) e `python build.py`. Nunca editar `jabuti.duckdb` ou `web/dados.json` à mão.

## Comandos
```bash
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # uma vez
.venv/bin/python build.py            # CSVs → jabuti.duckdb + web/dados.json (falha se dado inconsistente)
.venv/bin/python server.py           # http://localhost:8000 ; chat precisa de ANTHROPIC_API_KEY (ou `ant auth login`)
.venv/bin/python -m pytest -q        # testes Python
node --test tests/*.test.mjs         # testes das métricas do frontend (Node 24 não aceita pasta)
.venv/bin/python coleta.py normalizar          # dados/coleta/* (listas brutas) → dados/*.csv, preservando enriquecimentos
.venv/bin/python coleta.py wikidata            # candidatos de QID → confirmar → coleta.py aplicar_wikidata
.venv/bin/python coleta.py verificar           # confere trechos de raça contra as páginas-fonte
```

## Regras inegociáveis
- Raça só com autodeclaração pública (ou fonte curada por identidade) + URL + trecho literal. Nunca inferir. Indicador de negros é **piso** ("pelo menos").
- Estado = UF de nascimento.
- Todo percentual mostra n. Séries temporais em proporção (vagas mudaram em 2018).
- Chat: banco read-only, `enable_external_access=false`, `lock_configuration`, só SELECT/WITH.

## Aprendizados e armadilhas
<!-- Acrescente aqui erros encontrados e o que foi aprendido. Data no formato AAAA-MM-DD. -->
- 2026-10-14 — `.import` do SQLite grava célula vazia como `''`, o que burla os CHECKs de raça. Por isso a carga é DuckDB `read_csv` (vazio → NULL).
- 2026-10-14 — Formato do Jabuti muda: até 2017 ≈10 finalistas + 1º/2º/3º; 2018 10 finalistas e só 1º; 2019+ ≈10 semifinalistas → 5 finalistas → 1 vencedor. "Romance" vira "Romance Literário" em 2020 (Romance de Entretenimento criado, fora do recorte).
- 2026-10-14 — Wikidata: UF de nascimento sai de `P19` (local) → `P131*` até um item `P31 wd:Q485258` (UF do Brasil), sigla em `P300` (`BR-SP`). Raça (`P172`) quase nunca está preenchida (2 de 334 vencedores do Jabuti).
- 2026-10-14 — `node --test tests/` falha no Node 24 (trata a pasta como módulo). Use `node --test tests/*.test.mjs`.
- 2026-10-14 — DuckDB: `query('...')` executa SQL escrito dentro de uma string e escaparia de filtro por regex; por isso a garantia real é a conexão (`read_only`, `enable_external_access=false`, `lock_configuration`), testada em `test_sql_seguro_banco_somente_leitura_mesmo_sem_filtro`. `getenv()` já é bloqueado com acesso externo desligado.
- 2026-10-14 — SDK `anthropic` 1.14: sem credencial, `Anthropic()` constrói normalmente e só falha (TypeError) na chamada; checar `api_key`/`auth_token`/`credentials` antes para devolver 503.
- 2026-10-14 — Nome oficial em 2023 é "Conto" (singular), não "Contos". Em 2023 a CBL credita ilustradores como "autor(a)"; listas de semifinalistas e finalistas às vezes divergem nos coautores — usar o crédito mais completo.
- 2026-10-14 — 2016 quebra o "10 finalistas": Poesia teve 14 e Juvenil 15 (provável empate na nota de corte); Livro do Ano de Não Ficção teve empate (2 vencedores). Por isso `vagas_*` ficam por edição em `categoria_edicao`, nunca constantes no código. Infantil/Juvenil 2016 só têm o site oficial arquivado (Wayback) como lista completa.
- 2026-10-14 — Armadilha de busca: matéria da Gazeta do Povo sobre 2006 aparece em buscas de 2016. Sempre conferir o ano da edição na própria fonte.
- 2026-10-14 — Wikidata indisponível na prática durante a coleta: WDQS (SPARQL) respondia 429 com `Retry-After: 1000` ("rate-limiting during active wdqs outage") e, depois de ~150 consultas, a API de entidades (`w/api.php`) também passou a dar 429. `coleta.py wikidata` usa a API de entidades com nova tentativa, mas não conte com ela: a pesquisa de pessoas foi feita por busca web (Wikipédia, Enciclopédia Itaú Cultural, biografias), com QID anotado quando encontrado.
- 2026-10-14 — Editoras: quem é "grupo" muda com o tempo (PRH virou controladora da Companhia das Letras só em out/2018; Zahar entrou na Companhia em out/2019; HarperCollins Brasil foi joint venture com Ediouro até jan/2017). Selo de editora independente (Tordesilhas/Alaúde, Terceiro Selo/Dublinense) conta como independente. Sede incerta fica vazia.
- 2026-10-14 — Limite de buscas web: ~200 buscas por turno, somadas entre TODOS os subagentes. Quatro agentes de pesquisa de pessoas em paralelo esgotaram a cota e ~25–30 pessoas por lote ficaram sem a busca completa de autodeclaração (marcadas em `observacao` com "revisar"). Planeje lotes menores por turno ou rode a segunda passada em outro turno.
- 2026-10-14 — Fonte oficial de autodeclaração racial: quem já foi candidato tem cor/raça autodeclarada no registro do TSE (DivulgaCandContas / dados abertos). Vale como `autodeclaracao`, com link do registro.
- 2026-10-14 — Descrições de terceiros ("homem branco" em legenda de foto, "branquelo" em coluna) NÃO são autodeclaração; foram rejeitadas.
- 2026-10-14 — Python do python.org no macOS: `urllib` falha com CERTIFICATE_VERIFY_FAILED. Em `coleta.py verificar` usamos `curl` (certificados do sistema). Páginas trazem entidades HTML (`Nig&eacute;ria`): normalize com `html.unescape` antes de comparar trechos.
- 2026-10-14 — Checagem "colocação repetida" estava errada: empates são legítimos no Jabuti. Conferimos só o total de premiadas contra `vagas_premio`.
- 2026-10-14 — Textos automáticos ("maior queda") não podem destacar categorias de dado faltante (gênero não identificado, sem declaração, sem dado): `M.FALTANTES`.
- 2026-10-14 — Cada agente de coleta marcou incerteza de um jeito; padronize ANTES (colunas fixas como `raca_busca`) em vez de interpretar `observacao` depois. Gentílico ("mineira") não vale como UF de nascimento (decisão D12).
- 2026-10-14 — Inspeção visual com dados fictícios: copie `web/` para o scratchpad e sirva por lá (config `jabuti-teste-visual` foi temporária). Nunca gere dado fictício dentro de `dados/`.
- 2026-10-14 — Autodeclaração é assimétrica: pessoas brancas raramente se declaram, então "% brancos" não é calculável; "negra" sem preta/parda é comum.
