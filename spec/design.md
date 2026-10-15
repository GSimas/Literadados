# Design — Literadados

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
- **Coleta bruta:** `dados/coleta/` guarda as saídas dos levantamentos (listas planas). `coleta.py normalizar` gera os CSVs normalizados, com IDs em slug. As listas têm as colunas `autores`, `ilustradores` e `organizadores` (nomes separados por `|`), que viram `autoria.papel` = `autor`, `ilustrador` e `organizador`.

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
  "anos_coletados": [2010, 2011, ...],
  "regimes": [ { "ano", "regime" } ],
  "participacao": [ { "ano", "nome_original", "obra_id", "pessoa_id", "papel",
                      "lista_curta", "colocacao", "premiada", "vencedora" } ],
  "obras": [ { "id", "titulo", "ano_publicacao", "editora_id" } ],
  "pessoas": [ { "id", "nome", "genero", "raca", "negra", "raca_evidencia", "raca_fonte", "raca_trecho",
                 "raca_busca", "ano_nascimento", "municipio_nascimento", "uf_nascimento", "genero_fonte",
                 "nascimento_fonte", "wikidata" } ],
  "jurados": [ { "ano", "categoria", "pessoa_id" } ],
  "categorias": [ /* linhas de categoria_edicao */ ],
  "editoras": [ { "id", "nome", "grupo", "municipio_sede", "uf_sede" } ],
  "ufs": [ { "uf", "nome", "regiao", "populacao_2022" } ],
  "cobertura": [ /* linhas de v_cobertura */ ],
  "midia": [ { "pessoa_id", "imagem"?, "imagem_autor"?, "imagem_licenca"?, "wikipedia_pt"? } ],  // só campos preenchidos
  "fontes": [ { "dominio", "grupo", "registros", "exemplo" } ]
}
```

- **Mídia (RF-11):** `dados/pessoa_midia.csv` → tabela `pessoa_midia` (FK `pessoa`). Gerado por `coleta.py midia`: para cada pessoa com QID, lê `P18` (imagem) e o verbete da pt.wikipedia no Wikidata, e a autoria e a licença do arquivo na API do Commons (`extmetadata`). Só entram licenças livres (CC BY, CC BY-SA, CC0, "Attribution" do Commons, domínio público); o CHECK exige autor e licença quando há imagem. O navegador carrega a miniatura por `commons.wikimedia.org/wiki/Special:FilePath/<arquivo>?width=…`.
- **Fontes (RF-18):** agregadas no build a partir das URLs de `indicacao.fonte`, `categoria_edicao.fonte`, `jurado.fonte` e das fontes de atributo em `pessoa`, por domínio (`fontes`).
- **Malha (RF-07):** `web/br-uf.json`, GeoJSON das 27 UFs (IBGE, malha mínima, coordenadas com 3 casas), gerado por `coleta.py malha` com a sigla em `properties.uf`. Fica fora de `dados.json`; o painel desenha com `d3.geoPath(d3.geoIdentity().reflectY(true))`, que não depende do sentido dos anéis.

- **Participação compacta (D13):** cada linha guarda só as chaves e o que é da indicação. Gênero, raça, UF, título e editora ficam uma vez em `pessoas`, `obras` e `editoras`. Ao carregar, `metricas.expandir(D)` faz as junções e devolve linhas com as mesmas colunas, na mesma ordem, de `v_participacao`. O resto do painel não muda.
- **Regras ficam no SQL:** `regime`, `negra`, `premiada` e `vencedora` vêm prontos do banco (`regimes`, `pessoas.negra` e as colunas da participação). O JavaScript só faz junções e `idade_no_premio = ano - ano_nascimento`.
- O teste `test_json_compacto_reconstroi_v_participacao` roda `expandir` no Node sobre o JSON do build e compara linha a linha com `v_participacao` no DuckDB.

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

- Bibliotecas, sem build: `d3@7.9.0`, `@observablehq/plot@0.6.16`, `d3-sankey@0.12.3` (jsdelivr). Fontes do Google Fonts (Fraunces para títulos, Inter para texto).
- **Estrutura da página (RF-15):** abertura → história guiada → explorador (panorama, linha do tempo, evolução, funil, categorias, geografia, idade, editoras, júri) → pessoas → pergunte → metodologia e referências. Navegação fixa com a seção atual marcada por `IntersectionObserver`; filtros num painel recolhível com resumo do recorte.
- **História (RF-16):** seção com gráfico `position: sticky` e passos de texto. Um único SVG com um ponto por pessoa-autora; cada passo define posição e cor (grade de unidades agrupada) e o d3 anima a transição. O passo ativo vem de `IntersectionObserver`; `scroll-snap-type: y proximity` na página e `scroll-snap-align: center` em cada passo (desligados com `prefers-reduced-motion`). Os números vêm de `metricas.historia(linhas)`.
- **Perfis (RF-11):** rota por hash (`#/pessoa/<id>`) abre o perfil num `<dialog>` grande; fechar volta ao hash anterior. Avatar: iniciais com matiz derivado do hash do id (nunca de atributos).
- **Linha do tempo (RF-17):** faixa horizontal rolável por edição (marcos, vencedoras por categoria) e pequenos múltiplos de composição por edição de `metricas.porEdicao`.
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
| 07 | Coroplético e Sankey | `d3.geoPath` sobre `br-uf.json`, escala sequencial; `d3.sankey` em SVG |
| 08 | Enxame (beeswarm) | `Plot.dot` + `Plot.dodgeY`, `Plot.ruleX` para medianas |
| 09 | Barras de editoras | `Plot.barX` empilhado |
| 10 | Júri × lista × vencedoras | `Plot.barX` agrupado com `fy` |
| 11 | Galeria, tabela e perfil | cartões HTML + `<table>` + `<dialog>` com rota por hash |
| 15 | Abertura e navegação | HTML + CSS, `IntersectionObserver` |
| 16 | História guiada | SVG com d3 (transições), passos com `IntersectionObserver` e `scroll-snap` |
| 17 | Linha do tempo | HTML rolável + `Plot.line`/`Plot.dot` em pequenos múltiplos |
| 18 | Referências | lista HTML de `fontes` |
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
| 01.5 | `test_obra_so_com_organizador_e_valida`, `test_build_falha_obra_sem_autor_nem_organizador`; `metricas.test.mjs` (`filtrar` exclui organizadores) |
| 01.3 | `test_build_falha_lista_incompleta` |
| 03.1, 05.1, 06.2, 09.2 | `metricas.test.mjs` (KPIs, funil, Duncan, grupos editoriais sobre dados pequenos controlados) |
| 12.2 | `test_sql_seguro_*` |
| 12.4 | `test_chat_sem_chave_503` |
| — | `test_perguntas_originais` (as três perguntas do projeto rodam e devolvem número) |
| 07.3 | `test_malha_uf_tem_27_ufs` |
| 11.3 | `test_midia_exige_licenca_livre`, `test_build_exporta_midia`; `metricas.test.mjs` (`corAvatar` não depende de atributos) |
| 16.2 | `metricas.test.mjs` (`historia` sobre dados controlados) |
| 17.2 | `metricas.test.mjs` (`porEdicao`) |
| 18.1 | `test_build_exporta_fontes_por_dominio` |
| 12.1 (P3) | `test_chat_real_perguntas_originais`, marcado `integracao`: com `ANTHROPIC_API_KEY`, o chat real responde às três perguntas originais citando os mesmos números do SQL de referência e consultando o banco; sem a chave é pulado (`pytest -q -rs` mostra o motivo) |
| RNF-06.1, RNF-06.2 | `test_json_real_menor_que_1mb`, `test_json_compacto_reconstroi_v_participacao`; `metricas.test.mjs` (`expandir`) |

## 6. Decisões registradas

- **D1** UF = nascimento.
- **D2** Romance de Entretenimento fora.
- **D3** Livro do Ano de Ficção e de Não Ficção (até 2017) dentro.
- **D4** Ilustradores coletados, mas fora das contagens por padrão.
- **D14** Organizadores (antologia, obra reunida, edição póstuma) têm `papel = 'organizador'` e nunca contam: o perfil medido é o de quem escreveu. O filtro "autores e ilustradores" (`papel = 'todos'` em `metricas.filtrar`) inclui só esses dois papéis. Antologia creditada só ao organizador fica sem autor na base e sai das contagens de pessoas; a checagem do build passa a exigir autor **ou** organizador em cada obra.
- **D5** Raça só autodeclarada; o indicador é um piso.
- **D6** Slugs como IDs.
- **D7** O frontend agrega no navegador.
- **D8** O chat usa texto→SQL, não RAG.
- **D9** "Infantil e Juvenil" (2018) é uma categoria canônica própria. Fundi-la com Infantil ou Juvenil distorceria as duas séries.
- **D11** `pessoa.raca_busca` ∈ {completa, parcial}: separa "procurei e não achei" de "não deu para procurar" (a cota de buscas web esgotou na coleta piloto). Pessoa com raça declarada tem busca `completa` por definição. `v_cobertura.pct_busca_raca` expõe isso.
- **D12** Gentílico ("mineira", "capixaba", "paulistana") não basta para UF de nascimento. Valem "nasceu em", "natural de" e a notação bibliográfica "(UF, ano)".
- **D13** `dados.json` normalizado: a participação não repete atributos de pessoa e de obra, e o navegador remonta a tabela larga (`metricas.expandir`). Com as 16 edições, a forma larga chegava a 970 KB, perto do limite de 1 MB (RNF-06); a compacta fica em ~710 KB. Formato colunar ficou de fora: ganharia mais ~100 KB, mas tornaria o JSON ilegível para quem o inspeciona.
- **D15** Interface narrativa (RF-15 a RF-18): a página abre com uma história guiada e só depois o explorador. "Scrolljacking" aqui é só encaixe por passo (`scroll-snap` em modo `proximity`), nunca sequestro da roda do mouse: o leitor controla a velocidade, e `prefers-reduced-motion` desliga o encaixe. Fotos só do Commons com licença livre e crédito; quem não tem foto livre recebe avatar de iniciais com cor neutra (derivada do id), para que a cor nunca sugira gênero ou raça.
- **D10** As vagas variam por edição (empates criaram listas de 11 a 16 e pódios de 4; houve empate no Livro do Ano de 2016). Nenhum código assume 10/5/3; tudo vem de `categoria_edicao`.
