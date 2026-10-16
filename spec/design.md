# Design — Literadados

> Fase SDD 2/3 (como). Requisitos: [spec.md](spec.md). Tarefas: [tasks.md](tasks.md).

## 1. Arquitetura

```
dados/*.csv ──► build.py ──► literadados.duckdb ──► server.py ──► POST /api/chat ──► Claude (tool: consultar_sql)
 (verdade)        │  checagens                     │
                  └──► web/dados.json ──► web/ (index.html + app.js + style.css) ──► navegador
coleta.py: normalizar listas brutas · pré-preencher via Wikidata · verificar trechos de raça
```

- **Por que JSON estático no frontend:** o volume é pequeno (centenas a poucos milhares de linhas). O navegador filtra e agrega tudo com d3, o painel funciona como site estático e o servidor só é necessário para o chat.
- **Por que DuckDB:** lê CSV com célula vazia como NULL, aplica CHECK e chaves estrangeiras, abre em modo somente leitura e permite desligar o acesso externo. Isso é a base da segurança do chat.

## 2. Dados

- **Schema:** [`schema.sql`](../schema.sql). Tabelas `uf`, `premio`, `edicao`, `pessoa`, `editora`, `obra`, `autoria`, `categoria_edicao`, `indicacao`, `jurado` (as três últimas com `premio_id` na chave, D31). Views `v_participacao` (uma linha por pessoa por indicação) e `v_cobertura`.
- **CSVs:** um por tabela, em `dados/<tabela>.csv`, com cabeçalho igual às colunas. A carga é `INSERT INTO t BY NAME SELECT * FROM read_csv(...)`, na ordem das dependências.
- **Coleta bruta:** `dados/coleta/<premio>/` guarda as listas planas de cada prêmio (`edicoes.csv`, `categorias_edicao.csv`, `lista_AAAA.csv`, `jurados_AAAA.csv`); a pesquisa de pessoas (`pessoas_*.csv`) fica na raiz de `dados/coleta/`, porque pessoa é uma só. Os prêmios vêm de `dados/premio.csv`, editado à mão. `coleta.py normalizar` gera os CSVs normalizados, com IDs em slug. As listas têm as colunas `autores`, `ilustradores` e `organizadores` (nomes separados por `|`), que viram `autoria.papel` = `autor`, `ilustrador` e `organizador`.

### Etapas e regimes (vocabulário canônico)

| Etapa | Definição | Coluna |
|---|---|---|
| lista | entrou na 1ª lista pública (≈10) | toda linha de `indicacao` |
| finalista | entrou na 2ª lista (≈5), só de 2019 em diante | `lista_curta = 1` |
| premiada | recebeu colocação (1º a 3º até 2017; 1º depois) | `colocacao IS NOT NULL` |
| vencedora | 1º lugar | `colocacao = 1` |

Regimes: `1959–1992 vencedor por categoria`, `1993–2009 pódio`, `2010–2017 pódio`, `2018 transição`, `2019–2025 vencedor único` (coluna `regime`). De 1959 a 1999 não há lista pública: a etapa lista é só a das premiadas (`categoria_edicao.vagas_lista` vazio).

### `web/dados.json` (contrato)

```json
{
  "gerado_em": "ISO-8601",
  "anos": [1959, 2025],
  "anos_coletados": [1959, 1960, ...],
  "premios": [ { "id", "nome", "organizador", "ano_inicio", "abrangencia" } ],  // o 1º é o padrão (DA-4)
  "edicoes": [ { "premio"?, "ano", "regime" } ],  // "premio" (aqui e em participacao, categorias, jurados, cobertura) só quando não é o padrão
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

- `http.server.ThreadingHTTPServer` da biblioteca padrão. Serve `web/` como estático, com `Cache-Control: no-cache`, mais dois endpoints usados pela Diadorim (D20).
- **`GET /api/contexto`** → `{"sistema": str}`: regras de análise (português; mostrar o n; raça é piso; `papel='autor'` por padrão; nunca inferir raça; gênero atribuído; edições coletadas) e o DDL das tabelas e views. Montado uma vez e guardado em memória.
- **`POST /api/sql`**: o corpo é `{"sql": str}` (até 10 000 caracteres). Resposta 200: `{"sql", "colunas", "linhas", "truncado"}`. Respostas 400: JSON inválido, SQL recusado ou erro do DuckDB, com `{"erro": str}`.
- A IA não roda no servidor: o navegador chama o OpenRouter com a chave de quem entrou (D20).

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
| 26.1, 26.2 | `test_etapa0_so_jabuti`, `test_build_falha_edicao_antes_do_premio`, `test_build_falha_premio_inexistente`, `test_vagas_conferidas_por_premio`; `metricas.test.mjs` (`expandir` com prêmio padrão) |

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
- **D16** Gênero atribuído (CA-11.4): depois de esgotadas as buscas (Wikidata, Wikipédia, biografias), quem segue sem fonte recebe gênero pelo primeiro nome, em `dados/coleta/pessoas_zgenero_N.csv` (o `z` faz o arquivo ser aplicado por último: arquivos anteriores gravam `nao_identificado` explícito), com `pessoa.genero_evidencia = 'atribuicao'` e `genero_fonte` vazio. Apelido ambíguo (Duda, Rai, Del) ou só iniciais continuam `nao_identificado`. A view expõe `genero_atribuido`, que `metricas.kpis` e `metricas.historia` contam (`generoAtribuido`). A interface põe asterisco nos números de gênero e uma nota de rodapé com o n e o contato para correção. Raça nunca é atribuída: no Brasil o nome não indica raça, e publicar raça inferida de pessoa identificada é tratamento de dado sensível (LGPD, art. 11). A fonte que aparecer depois substitui a atribuição: quem a aplicar limpa `genero_evidencia`, e o CHECK impede atribuição com fonte.
- **D17** Sistema visual próprio (RF-19), sem biblioteca nova. **Motion:** tokens `--dur-*` e `--curva-*` em `style.css`. Revelação ao rolar por `IntersectionObserver` (classe `.visivel`). Diálogo e menus abrem por classe e fecham depois de `animationend`, porque `display` não anima em todos os navegadores. **Selects:** `ui.melhorarSelect` mantém o `<select>` nativo escondido, como fonte do valor e dos eventos `change`, e desenha um botão com `listbox`. O setter `value` da instância é sobrescrito para o menu acompanhar mudanças programáticas, e um `MutationObserver` refaz as opções. **Rolagem:** `::-webkit-scrollbar` de 14 px. `scrollbar-color` fica só onde não há `::-webkit-scrollbar` (Firefox), porque no Chrome ele desligaria a barra larga. **Dicas do Plot:** `--plot-background` = superfície do tema. **Logotipo:** SVG inline com 7 células hexagonais, o casco do jabuti como grade de dados, e `web/logo.svg` para README e favicon. **Contraste:** `tests/contraste.test.mjs` lê os tokens dos dois temas e exige 4,5:1 nos pares de texto.
- **D18** Método e Referências em `web/metodo.html` + `web/metodo.js` (RF-13, RF-18). A página carrega o mesmo `dados.json` e só usa `cobertura`, `fontes`, `anos_coletados` e `gerado_em`. O tema saiu de `app.js` para `web/tema.js` (`montarTema(aoTrocar)`), usado pelas duas páginas. O cabeçalho é repetido no HTML, porque o projeto não tem etapa de build. A paginação da galeria (CA-11.5) usa `metricas.paginas(atual, total)`, função pura que devolve os números de página e `null` para as reticências.
- **D19** Gráficos em janelas (RF-20): cada bloco antigo virou um `<dialog class="janela">` com o **mesmo id** da seção, e os seletores de render (`#g-…`, `#t-…`) não mudaram. `app.js` tem o registro `JANELAS` (id → funções de render). `renderTudo` só desenha as janelas abertas, e `abrirJanela` desenha na abertura, quando a largura é conhecida. Rota única por hash: `#/grafico/<id>` abre a janela; `#/pessoa/<id>` abre o perfil por cima, sem fechar a janela; qualquer outro hash fecha os dois. **Destaque no hover (CA-19.9):** `ui.desenhar` chama `realcarNoHover` em todo gráfico do Plot. No `pointermove`, ele escolhe a forma sob o ponteiro, ou a mais próxima a até 28 px, entre barras, células, pontos e retângulos, e marca `.em-foco`; o CSS esmaece as outras (`svg.com-foco`). Mapa, Sankey e história fazem o mesmo por CSS `:has(:hover)`. **Fade das dicas (CA-19.8):** a dica própria some com `.saindo`. A do Plot é recriada a cada movimento e some na hora em que o ponteiro sai: `suavizarDicas` reinsere uma cópia com animação de saída quando o grupo `tip` esvazia.
- **D20** Diadorim (RF-12) substitui o chat com a Anthropic no servidor. O navegador faz o PKCE do OpenRouter: `code_verifier` em `sessionStorage`, desafio S256 por `crypto.subtle`, redirecionamento para `openrouter.ai/auth?callback_url=<página>`, e na volta `POST /api/v1/auth/keys` com `code` e `code_verifier`. A chave vai para o `localStorage`. O laço de ferramentas usa `POST /api/v1/chat/completions` com `model: "openrouter/free"` e a ferramenta `consultar_sql`, que chama `POST /api/sql` no nosso servidor (mesmo `validar_sql`/`executar_sql` de antes). Máximo de 6 rodadas. O prompt de sistema vem de `GET /api/contexto` (regras e DDL, como antes) mais a persona e as regras de link. A resposta é Markdown mínimo: o texto é escapado e depois ganha negrito, listas e links, com `href` permitido só para `#…`, `metodo.html…` e `https://`. Persona: inspirada na Diadorim do livro, sem citar trechos. O retrato é um SVG próprio. `server.py` perde `anthropic`, `/api/chat` e `responder`.
- **D21** Anel de retratos (CA-11.5, CA-11.6): `metricas.anel(n, largura)` é uma função pura. Ela calcula o diâmetro do círculo, o raio do miolo vazio e as posições (x, y) a partir do centro, enchendo cada anel até a capacidade (circunferência ÷ (diâmetro + folga)), do anel de dentro para fora; o último anel distribui o resto por igual. O diâmetro diminui até o anel caber na largura. Os retratos são `<button>` posicionados em absoluto. O centro é um `<div aria-live>` que troca de conteúdo com fade no `pointerenter` e no `focus`. A paginação é de 100 por página, com setas laterais. O miolo vale 24% da largura. O centro tem largura e altura fixas (nunca `aspect-ratio`, que deixa a altura crescer com o texto e vira oval), com `container-type: size` e fontes em `cqi`. A `metricas.paginas` (números com reticências) saiu.
- **D22** Filtros por parte (RF-02): `app.js` guarda um estado por parte (`filtros[parte]`, com parte = `panorama`, `autores` e os ids das janelas). `ui.montarFiltro` desenha a barra (selects próprios, menu de categorias com caixas de seleção, resumo, limpar, CSV) e altera o estado da sua parte, e só aquela parte é redesenhada. A URL guarda `?<parte>=<texto>` por `metricas.filtroParaTexto` e `metricas.filtroDeTexto`, que são puras e testadas: `ini-fim`, mais `~cat1,cat2` quando nem todas as categorias estão marcadas, mais `~todos` para autores e ilustradores. O texto vazio é o padrão. Saíram o painel de filtros do cabeçalho e a barra fixa de recorte.
- **D23** Busca e perfis de lugar (RF-21, RF-22). `metricas.indiceBusca(D)` monta entradas `{tipo, rotulo, sub, href, chave}`, com `chave` normalizada (sem acento, minúscula); `metricas.buscar(indice, termo, n)` pontua e ordena. As duas são puras e testadas. `web/busca.js` é o combobox do cabeçalho; em `metodo.html`, os links internos ganham o prefixo `./`. `metricas.perfilLugar(linhas, pred)` calcula os números do lugar sobre `papel = 'autor'` no recorte completo; a parcela usa como base as participações com UF conhecida no Brasil. `web/lugares.js` monta o HTML e desenha os gráficos depois de o diálogo abrir (largura conhecida), via `ui.desenhar` (com hover e fade de dica). A malha das UFs vem de `mapa.obterMalha()`. A rota em `app.js` trata `#/pessoa/`, `#/uf/` e `#/regiao/` no mesmo `<dialog id="perfil">`.
- **D24** Diadorim, segunda rodada (CA-12.8–12.11): `responder(pergunta, historico, chave, {modelo, aoPasso})`. `aoPasso({tipo, texto})` é chamado em cada etapa (`contexto`, `rodada`, `sql`, `resultado`, `erro`, `escrita`), e a interface monta uma lista viva dentro do balão. O modelo escolhido vai no corpo do pedido e fica em `localStorage.dd_modelo`. A lista de modelos é buscada uma vez por abertura do painel de configuração (endpoint público, sem chave), e "suporta ferramentas" vem de `supported_parameters` conter `tools`. Escolher um modelo sem ferramentas é permitido, com aviso de que ele não consulta o banco.
- **D25** Exportação (CA-14.2, CA-14.3), em `web/exportar.js`. **Gráfico:** clona o SVG principal e copia para atributos `style` os estilos calculados (cor, fonte, traço, opacidade), porque as variáveis CSS e as classes não vão junto. Acrescenta título, legenda (lida das amostras do Plot) e rodapé, desenha num `<canvas>` com escala 2× e baixa como `image/jpeg` (fundo `--superficie`) ou `image/png` (transparente). **Tabela:** lê o DOM (`thead`/`tbody`); `xlsx(linhas)` monta um ZIP sem compressão (STORE, com CRC-32) com `[Content_Types].xml`, `_rels`, `workbook` e uma planilha de strings inline. Ficou de fora o SheetJS, cuja versão no npm está parada desde 2022 e tem CVE. Os botões entram por `ui.desenhar` (gráficos do Plot), pelo mapa e pelo Sankey, e por `ui.tabela`, de modo que todo novo desenho já sai com eles. Uma janela única (`#exportar`) atende às duas páginas.
- **D26** Banco no navegador (RNF-07, CA-12.4): o Netlify não roda Python, e as funções dele não aceitam Python. O build exporta cada tabela para `web/banco/<tabela>.parquet`, as views de `schema.sql` para `web/banco/views.sql` e o prompt de regras + DDL para `web/contexto.json`. `web/banco.js` abre, na primeira pergunta, o DuckDB-WASM 1.32.0 (jsDelivr; worker por Blob), cria as tabelas a partir dos Parquet, recria as views e só então faz `SET enable_external_access = false` e `SET lock_configuration = true`. `validarSQL` (o mesmo filtro do antigo `server.validar_sql`, testado no Node) recusa escrita, mais de um comando e funções de leitura de arquivo; o resultado é cortado em 200 linhas. O `server.py` vira só servidor estático (sem `/api`), e a garantia de leitura deixa de ser do servidor: qualquer escrita, se passasse, mudaria só a cópia em memória da aba de quem perguntou.
- **D27** Desempenho (RNF-08). **Fontes:** Inter e Fraunces variáveis (subconjuntos latin e latin-ext do Google Fonts, OFL) em `web/fontes/`, com `preload` dos dois arquivos latin; faces "Inter fallback" (Arial) e "Fraunces fallback" (Georgia) com `size-adjust`/`ascent-override`/`descent-override` calculados com fontTools sobre uma frase da abertura. **Bibliotecas:** o Plot depende do d3 inteiro, por isso trocar o d3 por módulos não reduz nada; o ganho real é tirar Plot e d3-sankey da carga (`ui.carregarGraficos`, chamado pela rota antes de desenhar janela ou perfil de lugar, e pré-carregado em `requestIdleCallback`). **Fotos:** `coleta.py miniaturas` grava `web/fotos/<id>-160.webp` e `-480.webp` (Pillow); o build marca `midia.miniatura` só quando os dois arquivos existem, e `ui.srcFoto` escolhe a local ou o Commons.
- **D28** Resposta seca da Diadorim (CA-12.12): regra no prompt (`build.prompt_sistema` e persona), na descrição da ferramenta, uma insistência automática e, por fim, o detalhamento determinístico. `consultaDeDetalhe` só reescreve o caso simples `SELECT <agregado> FROM v_participacao [WHERE …]` (sem GROUP BY/WITH/UNION/JOIN), trocando a lista de colunas pelas da pessoa e da obra; outro formato fica sem o bloco. A consulta automática passa por `validarSQL` e pelo banco somente leitura, como as do modelo.
- **D29** Ranking e perfil de livro (RF-23, RF-24). `metricas.ranking` é pura e testada; `renderRanking` usa o índice que o Plot liga a cada barra para o clique. Capas em `dados/obra_capa.csv` (tabela `obra_capa`): Google Books primeiro (cota anônima diária compartilhada; quando acaba, segue só com a Open Library e não marca "sem capa"), Open Library depois. Obras procuradas nas duas fontes sem resultado ficam em `dados/coleta/capas_sem_resultado.txt` e não são buscadas de novo. Capa é exibida da fonte, com `referrerpolicy="no-referrer"`, sem cópia no site.
- **D10** As vagas variam por edição (empates criaram listas de 11 a 16 e pódios de 4; houve empate no Livro do Ano de 2016). Nenhum código assume 10/5/3; tudo vem de `categoria_edicao`.
- **D30** Série completa por padrão (CA-25.2 a CA-25.5). O build deixa de exportar `recorte`; o padrão de toda parte é `D.anos` (1959–2025), e `metricas.filtrar` sem período não corta anos. `filtroDeTexto(texto, anos, cats)` perde o 4º parâmetro (padrão próprio por parte): o padrão é sempre a série. O conjunto de edições sem lista pública (`semLista`, calculado em `app.js` a partir de `vagas_lista`) vai no contexto das partes, para o resumo do filtro, a linha do tempo e o aviso do funil. Textos com período leem `D.anos`/`D.anos_coletados` (`#hero-periodo`, história, perfil de lugar) ou o filtro da parte (rodapé da exportação, via `data-anos` no elemento da parte). `metricas.editoras` ignora obra sem editora e `metricas.semEditora` conta essas indicações para a nota. Eixo de anos: `metricas.passoAnos(n, largura)` (1, 2, 5 ou 10; pura e testada) decide quais rótulos aparecem; a folga das barras da evolução é uma fração da banda, para nunca passar da largura da barra. Os rótulos dos marcos da evolução vão para a primeira linha livre (sem encostar no anterior) e, perto das bordas, alinham pela ponta. O resumo do funil só chama de queda uma diferença de pelo menos meio ponto (abaixo disso, os dois % arredondam iguais).
- **D31** Vários prêmios (RF-26). Decisões DA-1 a DA-5 aprovadas em 2026-10-16, como estão abaixo. A implementação começa pela etapa 0.

  **Schema.**
  - `premio (id, nome, organizador, ano_inicio, abrangencia ∈ {nacional, lusofono}, fonte)`, com `'jabuti'` como primeira linha. Não há coluna de tipo: pela DA-2, todo prêmio da tabela premia livros.
  - `edicao (premio_id, ano, regime, fonte)` substitui o `CASE` de regime de `v_participacao` (CA-26.4) e serve de âncora para os marcos da linha do tempo.
  - `categoria_edicao` ganha `premio_id` na chave `(premio_id, ano, nome_original)` e `etapa_lista` (o que a "lista" é ali: `indicados`, `semifinalistas`, `finalistas` ou `premiados`). O CHECK de `ano` passa a ir do `ano_inicio` do prêmio até o ano corrente (verificado no build, já que o CHECK não lê outra tabela). O CHECK de `categoria` ganha `Geral` e o que a DA-1 trouxer.
  - `indicacao` e `jurado` ganham `premio_id` (FK para `categoria_edicao`). `indicacao.editora_id` é opcional e, quando preenchida, vale no lugar de `obra.editora_id` (`COALESCE` na view; CA-26.6).
  - `v_participacao` ganha `premio` e `premio_nome`; `v_cobertura` agrupa por `premio, ano`.
  - `literadados.duckdb` vira `literadados.duckdb` (build, testes, `.gitignore`, CLAUDE.md).

  **Etapa 0 (CA-26.2).** A migração entra com só o Jabuti: `premio_id = 'jabuti'` em todos os CSVs, `edicao` gerada a partir do `CASE` atual, e os mesmos números. Os testes atuais passam sem mudança de valor. Na migração, `v_participacao` e `v_cobertura` (sem as colunas de prêmio) foram comparadas byte a byte com um retrato tirado antes, e deram iguais. Um retrato no repositório quebraria a cada dado novo, por isso o teste permanente `test_etapa0_so_jabuti` confere o que a migração mexeu: só há o Jabuti, o regime de cada edição é o do antigo `CASE`, e o prêmio padrão fica fora do JSON. A fonte de cada edição do Jabuti é a página oficial de premiados do ano.

  **Coleta.**
  - As listas brutas passam para `dados/coleta/<premio>/` (`lista_AAAA.csv`, `jurados_AAAA.csv`, `categorias_edicao.csv`). As do Jabuti são movidas com `git mv`. Os arquivos de pessoas (`pessoas_*.csv`) continuam na raiz de `dados/coleta/`, porque pessoa é uma só.
  - `normalizar` processa o Jabuti primeiro, para os ids atuais não mudarem (fotos, capas e links dependem deles), e depois os outros prêmios na ordem de `premio`.
  - **Casamento de pessoa:** primeiro o QID (`pessoa.wikidata`), depois o nome normalizado. O casamento só pelo nome vai para `dados/coleta/<premio>/casamentos_revisar.csv`, para decisão humana. Homônimos seguem a regra de hoje (nome distinto na lista).
  - **Casamento de obra:** título normalizado e sobrenome de algum autor. Mesmo título com autoria diferente gera id com sufixo.

  **`dados.json`.**
  - Entram `premios` e `edicoes`, que substitui `regimes`.
  - Na participação, o campo `premio` fica fora quando é `jabuti`, como já acontece com `papel = 'autor'` (D13, T21.6). Assim a base atual não cresce.
  - Se o arquivo passar de 1 MB com os novos prêmios, ele é dividido: `dados.json` fica com o que é comum (pessoas, obras, editoras, prêmios) e a participação do Jabuti, e cada prêmio ganha um `dados-<premio>.json`, carregado quando algum filtro o inclui (CA-26.14). `metricas.expandir` aceita várias partes.

  **Painel.**
  - O texto do filtro ganha o segmento `~p:jabuti,oceanos`, omitido no padrão (DA-4).
  - `metricas.filtrar` recebe `premios`. Funil, evolução, categorias, júri e linha do tempo recebem `fx`/`fy` por prêmio quando há mais de um (CA-26.9). O índice de Duncan é calculado dentro de cada prêmio, sem `Geral` e sem `Livro do Ano`.
  - `CATEGORIAS` vem dos dados, não de uma constante. A busca gera "<Prêmio> AAAA" para cada edição.
  - Janela nova `entre-premios`, alimentada por `metricas.entrePremios(linhas)`, que é pura e testada (CA-26.11).
  - Diadorim: `build.prompt_sistema` lista `premio` e `edicao`. `validarSQL` não muda.
  - O build agrupa as referências pelo domínio dos novos prêmios (RF-18).

  **Decisões (aprovadas).**
  - **DA-1:** o **Oceanos** é o piloto, porque tem listas públicas de semifinalistas e finalistas parecidas com as do Jabuti de 2019 em diante e testa logo a DA-3. Depois vem o **Prêmio Literário da Biblioteca Nacional**, cujas categorias por gênero mapeiam direto na taxonomia, mas que em geral só tem premiados públicos. Depois, o São Paulo de Literatura. As categorias ficam nos mesmos gêneros do recorte atual, mais `Geral`. Formatos e períodos de cada prêmio são conferidos na coleta, com fonte, como foi com o Jabuti.
  - **DA-2:** prêmios pelo conjunto da obra ficam **fora** por enquanto. Não há livro, e misturá-los ao funil e às métricas por obra confunde. Se entrarem depois, ganham uma tabela `distincao (premio_id, ano, pessoa_id, fonte)`, que aparece só nos perfis e na janela Entre prêmios.
  - **DA-3:** autores de fora do Brasil **entram**. Sem eles, o Oceanos perde parte do que premia. A tabela `pessoa` ganha `pais_nascimento` (ISO 3166-1, `BR` para quem tem UF), e `uf_nascimento = 'EX'` passa a valer só com `pais_nascimento <> 'BR'`. O mapa continua sendo do Brasil, e a geografia ganha a dimensão "país". Raça segue o mesmo protocolo (autodeclaração literal com URL, nunca inferência), e o Método avisa que os termos seguem as categorias do IBGE.
  - **DA-4:** o painel **abre com o Jabuti**, com o seletor de prêmio em cada filtro e a opção "todos". Os links compartilhados continuam significando o que significam hoje, e a História guiada segue sendo a do Jabuti. Isso vale até haver três prêmios ou mais coletados; aí a decisão é reavaliada.
  - **DA-5:** a marca Literadados e o logotipo ficam. O título da abertura passa a vir do prêmio padrão (`premios[0]`), e a descrição da página cita os prêmios da base.
