# Design — JabutiDados

> Fase SDD 2/3 (como). Requisitos: [spec.md](spec.md). Tarefas: [tasks.md](tasks.md).

## 1. Arquitetura

```
dados/*.csv ──► build.py ──► jabuti.duckdb ──► server.py ──► POST /api/chat ──► Claude (tool: consultar_sql)
 (verdade)        │  checagens                     │
                  └──► web/dados.json ──► web/ (index.html + app.js + style.css) ──► navegador
coleta.py: normalizar listas brutas · pré-preencher via Wikidata · verificar trechos de raça
```

- **Por que JSON estático no frontend:** o volume é pequeno (centenas a poucos milhares de linhas). O navegador filtra e agrega tudo com d3, o painel funciona como site estático e o servidor só é necessário para o chat.
- **Por que DuckDB:** lê CSV com célula vazia como NULL, aplica CHECK e chaves estrangeiras, abre em modo somente leitura e permite desligar o acesso externo. Isso é a base da segurança do chat.

## 2. Dados

- **Schema:** [`schema.sql`](../schema.sql). Tabelas `uf`, `pessoa`, `editora`, `obra`, `autoria`, `categoria_edicao`, `indicacao`, `jurado`. Views `v_participacao` (uma linha por pessoa por indicação) e `v_cobertura`.
- **CSVs:** um por tabela, em `dados/<tabela>.csv`, com cabeçalho igual às colunas. A carga é `INSERT INTO t BY NAME SELECT * FROM read_csv(...)`, na ordem das dependências.
- **Coleta bruta:** `dados/coleta/` guarda as saídas dos levantamentos (listas planas). `coleta.py normalizar` gera os CSVs normalizados, com IDs em slug.

### Etapas e regimes (vocabulário canônico)

| Etapa | Definição | Coluna |
|---|---|---|
| lista | entrou na 1ª lista pública (≈10) | toda linha de `indicacao` |
| finalista | entrou na 2ª lista (≈5), só de 2019 em diante | `lista_curta = 1` |
| premiada | recebeu colocação (1º a 3º até 2017; 1º depois) | `colocacao IS NOT NULL` |
| vencedora | 1º lugar | `colocacao = 1` |

Regimes: `2010–2017 pódio`, `2018 transição`, `2019–2025 vencedor único` (coluna `regime`).

### `web/dados.json` (contrato)

```json
{
  "gerado_em": "ISO-8601",
  "anos": [2010, 2025],
  "anos_coletados": [2016, 2023],
  "participacao": [ /* linhas de v_participacao */ ],
  "pessoas": [ { "id", "nome", "genero", "raca", "raca_evidencia", "raca_fonte", "raca_trecho",
                 "ano_nascimento", "municipio_nascimento", "uf_nascimento", "genero_fonte",
                 "nascimento_fonte", "wikidata" } ],
  "jurados": [ { "ano", "categoria", "pessoa_id" } ],
  "categorias": [ /* linhas de categoria_edicao */ ],
  "ufs": [ { "uf", "nome", "regiao", "populacao_2022" } ],
  "cobertura": [ /* linhas de v_cobertura */ ]
}
```

## 3. Backend (`server.py`)

- `http.server.ThreadingHTTPServer` da biblioteca padrão. Serve `web/` como estático, mais um endpoint.
- **`POST /api/chat`**
  - Corpo: `{"pergunta": str, "historico": [{"pergunta", "resposta"}]}`. No máximo 6 trocas; só texto, sem blocos de raciocínio.
  - Resposta 200: `{"resposta": str (markdown), "consultas": [{"sql", "colunas", "linhas", "truncado"}]}`.
  - Erros:
    - 400: pergunta vazia ou com mais de 1000 caracteres.
    - 503: sem credencial.
    - 502: falha da API.
    - 422: recusa do modelo.

### IA (texto → SQL)

- SDK `anthropic`, Tool Runner (`client.beta.messages.tool_runner`) com uma ferramenta `consultar_sql(sql)` definida via `@beta_tool`.
- Modelo: `claude-opus-5-5`, `thinking={"type":"adaptive"}`, `output_config={"effort":"medium"}`, `max_tokens=16000`.
- `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`), para que uma recusa seja reprocessada por outro modelo.
- Verificar `stop_reason == "refusal"` antes de ler o conteúdo.
- **Prompt de sistema estável** (cacheável): papel, regras (português; mostrar o n; raça é piso; `papel='autor'` por padrão; nunca inferir raça; dizer quando a edição não foi coletada), o DDL das tabelas e views, o glossário de etapas e regimes, e os anos coletados (lidos do banco na subida do servidor).

### Execução segura de SQL (RNF-03)

1. Conexão `duckdb.connect(db, read_only=True, config={"enable_external_access": False})`, seguida de `SET lock_configuration = true`.
2. Remover comentários. Exigir um único comando que comece com `SELECT` ou `WITH`. Bloquear palavras-chave perigosas (`COPY`, `ATTACH`, `INSTALL`, `LOAD`, `PRAGMA`, `SET`, `CALL`, `EXPORT`, `IMPORT`, `CREATE`, `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`) e funções de leitura de arquivo (`read_*`, `*_scan`, `glob`). Isso é defesa em profundidade: a garantia real vem do item 1.
3. Limite de 200 linhas devolvidas, com a indicação `truncado`. Tempo limite de 5 s via `con.interrupt()`.
4. Uma conexão por requisição (o DuckDB em modo leitura aceita várias).

## 4. Frontend (`web/`)

- Bibliotecas, sem build: `d3@7.9.0`, `@observablehq/plot@0.6.16`, `d3-sankey@0.12.3` (jsdelivr).
- `app.js`:
  - carrega `dados.json`
  - mantém o estado dos filtros (sincronizado com a URL)
  - cada seção é uma função `render<Secao>(linhasFiltradas)`
  - agregações com `d3.rollup`
- Tema claro e escuro por tokens CSS. Paleta categórica fixa por grupo, a mesma cor para o mesmo grupo em todos os gráficos.

| RF | Visualização | Implementação |
|---|---|---|
| 03 | Cartões e faixa de cobertura | HTML + CSS |
| 04 | Barras 100% por ano e marcos | `Plot.barY` + `Plot.stackY({offset:"normalize"})`, `Plot.ruleX` e `Plot.text` para os marcos, lacunas como `Plot.text("sem dados")` |
| 05 | Funil (inclinação em várias etapas) | `Plot.line` + `Plot.dot` + rótulos de n |
| 06 | Mapa de calor | `Plot.cell` + `Plot.text` |
| 07 | Mapa em grade e Sankey | `Plot.cell` com coordenadas fixas por UF; `d3.sankey` em SVG |
| 08 | Enxame (beeswarm) | `Plot.dot` + `Plot.dodgeY`, `Plot.ruleX` para medianas |
| 09 | Barras de editoras | `Plot.barX` empilhado |
| 10 | Júri × lista × vencedoras | `Plot.barX` agrupado com `fy` |
| 11 | Tabela e ficha | HTML `<table>` + `<dialog>` |
| 12 | Chat | `<form>` + `fetch`, markdown simples renderizado com segurança (texto escapado) |
| 13 | Metodologia | HTML + tabela de `cobertura` |
| 14 | CSV | `d3.csvFormat` + `Blob` |

### Grupos (dimensões)

- **gênero:** mulher, homem, não binário, não identificado
- **raça declarada:** negra (preta, parda ou negra sem especificar), indígena, amarela, branca, sem declaração
- **região de nascimento:** as cinco regiões, Exterior e sem dado

## 5. Testes (mapa de critérios de aceitação para testes)

- `tests/test_app.py` (pytest) usa os dados reais de `dados/` e uma cópia temporária para os casos de falha.
- `tests/metricas.test.mjs` (`node --test`) testa `web/metricas.js`. As agregações do painel são funções puras, sem d3, importadas por `app.js`, de modo que o teste exercita o mesmo código que o navegador roda.

| CA | Teste |
|---|---|
| 01.1, 01.4 | `test_build_gera_banco_e_json` |
| 01.2 | `test_build_falha_raca_sem_fonte`, `test_build_falha_categoria_fora` |
| 01.3 | `test_build_falha_lista_incompleta` |
| 03.1, 05.1, 06.2, 09.2 | `metricas.test.mjs` (KPIs, funil, Duncan, grupos editoriais sobre dados pequenos controlados) |
| 12.2 | `test_sql_seguro_*` |
| 12.4 | `test_chat_sem_chave_503` |
| — | `test_perguntas_originais` (as três perguntas do projeto rodam e devolvem número) |

## 6. Decisões registradas

- **D1** UF = nascimento.
- **D2** Romance de Entretenimento fora.
- **D3** Livro do Ano de Ficção e de Não Ficção (até 2017) dentro.
- **D4** Ilustradores coletados, mas fora das contagens por padrão.
- **D5** Raça só autodeclarada; o indicador é um piso.
- **D6** Slugs como IDs.
- **D7** O frontend agrega no navegador.
- **D8** O chat usa texto→SQL, não RAG.
- **D9** "Infantil e Juvenil" (2018) é uma categoria canônica própria. Fundi-la com Infantil ou Juvenil distorceria as duas séries.
- **D11** `pessoa.raca_busca` ∈ {completa, parcial}: separa "procurei e não achei" de "não deu para procurar" (a cota de buscas web esgotou na coleta piloto). Pessoa com raça declarada tem busca `completa` por definição. `v_cobertura.pct_busca_raca` expõe isso.
- **D12** Gentílico ("mineira", "capixaba", "paulistana") não basta para UF de nascimento. Valem "nasceu em", "natural de" e a notação bibliográfica "(UF, ano)".
- **D10** As vagas variam por edição (empates criaram listas de 11 a 16 e pódios de 4; houve empate no Livro do Ano de 2016). Nenhum código assume 10/5/3; tudo vem de `categoria_edicao`.
