# Spec — Literadados

> Fase SDD 1/3 (o quê e por quê). Desenho técnico: [design.md](design.md). Tarefas: [tasks.md](tasks.md).
> Toda mudança de comportamento começa aqui: edite o requisito e o critério de aceitação **antes** do código.

## 1. Problema

Não existe base pública que cruze **prêmio × categoria × etapa (lista, finalista, premiado, vencedor) × gênero × raça × estado de nascimento** dos autores do Prêmio Jabuti. Há catálogos só de vencedores, sem perfil demográfico, e estudos acadêmicos com recortes fechados em PDF. O Literadados preenche essa lacuna com dados verificáveis, visualizações e uma IA que responde perguntas em linguagem natural.

## 2. Escopo

| Dentro | Fora (por enquanto) |
|---|---|
| Prêmio Jabuti, edições 2010–2025 | Outros prêmios (Oceanos, São Paulo de Literatura…) |
| Romance (Romance Literário a partir de 2020), Contos (Contos e Crônicas até 2017; "Conto" a partir de 2018), Crônica (desde 2018), Poesia, Infantil, Juvenil, **Infantil e Juvenil (só 2018, quando foram fundidas)**, Livro do Ano | Romance de Entretenimento; Infantil Digital; Escritor Estreante; categorias de ilustração e não ficção (exceto Livro do Ano) |
| Autores e ilustradores das obras; jurados | Tradutores, editores, prêmios de inovação |
| Estado = **UF de nascimento** | Estado de residência |
| Raça **somente por autodeclaração pública** (ou fonte curada por identidade) | Inferência por foto, sobrenome ou IA |

**Fase atual:** piloto. A estrutura cobre as 16 edições; o conteúdo cobre 2016 e 2023. O app precisa funcionar e ser honesto com qualquer cobertura.

## 3. Públicos

- **Pesquisadora ou jornalista:** quer recortes exatos, com fonte, para citar.
- **Leitor curioso:** quer explorar visualmente e descobrir padrões.
- **Mantenedor dos dados:** quer acrescentar edições sem mexer em código.

## 4. Requisitos funcionais

Cada requisito tem critérios de aceitação (CA) verificáveis. Os marcados com 🧪 têm teste automatizado em `tests/`; os marcados com 👁 são verificados no navegador.

### RF-01 Base de dados
Os CSVs em `dados/` são a fonte da verdade e seguem `schema.sql`. Um comando gera o banco e os dados do app.
- **CA-01.1 🧪** `python build.py` cria `jabuti.duckdb` e `web/dados.json` a partir de `dados/*.csv`.
- **CA-01.2 🧪** O build **falha** (código ≠ 0, mensagem clara) se uma restrição do schema for violada: raça sem fonte, categoria fora do recorte, chave estrangeira inexistente.
- **CA-01.3 🧪** O build **falha** se uma edição coletada tiver lista com tamanho diferente de `vagas_lista`, ou número de premiadas diferente de `vagas_premio`. Edições sem nenhuma indicação contam como "não coletadas" e não falham.
- **CA-01.4 🧪** O build imprime a cobertura por edição (gênero, UF, raça, idade).

### RF-02 Filtros globais
- **CA-02.1 👁** Filtros de período (ano inicial e final), categorias e papel (só autores ou autores e ilustradores) valem para todas as seções, menos o chat.
- **CA-02.2 👁** O estado dos filtros fica na URL (link compartilhável).

### RF-03 Panorama
- **CA-03.1 🧪👁** Cartões com: indicações, pessoas, obras, % mulheres, **piso** de % negros (com "pelo menos"), cobertura de raça, número de UFs de nascimento distintas (de 27) e número de editoras.
- **CA-03.2 👁** Faixa de cobertura temporal mostra, para 2010–2025, quais edições têm dados coletados.

### RF-04 Evolução temporal
- **CA-04.1 👁** Barras 100% empilhadas por edição, para a dimensão escolhida (gênero, raça declarada ou região de nascimento) e a etapa escolhida (lista ou premiadas).
- **CA-04.2 👁** Edições não coletadas aparecem como lacuna rotulada "sem dados", nunca como zero.
- **CA-04.3 👁** Marcos anotados: 2018 (reforma: só 1º lugar), 2020 (Romance Literário), 2021 (CBL passa a coletar raça na inscrição).

### RF-05 Funil (teto de vidro)
- **CA-05.1 🧪👁** Para cada grupo (mulheres, homens, negros declarados, cada região), a participação em cada etapa: lista, finalistas (só onde houve 2ª lista), premiadas, vencedoras. Cada ponto mostra o n.
- **CA-05.2 👁** Texto-resumo automático com a maior queda entre lista e vencedoras.

### RF-06 Segregação por categoria
- **CA-06.1 👁** Mapa de calor categoria × indicador (% mulheres, % negros declarados, % Nordeste, % Sudeste), com o valor e o n em cada célula.
- **CA-06.2 🧪** Índice de dissimilaridade de Duncan por gênero entre categorias, com interpretação em texto ("X% das mulheres teriam de mudar de categoria para a distribuição ficar igual à dos homens").

### RF-07 Geografia
- **CA-07.1 👁** Mapa do Brasil em grade (um quadrado por UF), colorido por participações ou por participações por milhão de habitantes (Censo 2022), com alternância entre as duas medidas.
- **CA-07.2 👁** Diagrama Sankey: região de nascimento → região da sede da editora → resultado (premiada ou não).

### RF-08 Idade
- **CA-08.1 👁** Gráfico de enxame (beeswarm): idade no ano do prêmio, cor por gênero, com dica (nome, obra, ano) e mediana por gênero.

### RF-09 Editoras
- **CA-09.1 👁** As 15 editoras com mais indicações, separando premiadas e não premiadas.
- **CA-09.2 🧪👁** Participação de grupos editoriais em comparação com independentes.

### RF-10 Júri e premiados
- **CA-10.1 👁** Para as edições com júri coletado: júri × lista × vencedoras em % mulheres, % negros declarados e % nascidos fora do Sudeste.

### RF-11 Explorador de pessoas
- **CA-11.1 👁** Tabela com busca por nome: gênero, raça, UF, participações, prêmios.
- **CA-11.2 👁** A ficha de cada pessoa lista as participações e a **fonte de cada atributo**. Raça mostra o trecho literal e o link.

### RF-12 Pergunte aos dados (IA)
- **CA-12.1 👁** Pergunta em português → resposta em português com o número, a tabela de resultado e o SQL usado (recolhível).
- **CA-12.2 🧪** A IA só executa consultas de leitura. Escrita, múltiplos comandos, leitura de arquivos e acesso externo são recusados.
- **CA-12.3** A resposta menciona a cobertura quando envolve raça e trata o número de negros como piso.
- **CA-12.4 🧪** Sem credencial da API, o endpoint responde 503 com instrução clara, e o resto do app continua funcionando.
- **CA-12.5 👁** Sugestões de perguntas prontas, incluindo as três perguntas originais do projeto.

### RF-13 Metodologia e transparência
- **CA-13.1 👁** Seção com a tabela de cobertura por edição, as definições (etapas, regimes, piso racial) e o protocolo de raça.
- **CA-13.2 👁** Instrução de como pedir correção, com fonte.
- **CA-13.3 🧪👁** Cada pessoa registra se a busca de autodeclaração racial foi `completa` (protocolo cumprido) ou `parcial` (interrompida). A cobertura por edição mostra a % de buscas completas, e o panorama avisa quando há buscas parciais: "sem declaração" com busca parcial não significa ausência de declaração.

### RF-14 Exportação
- **CA-14.1 👁** Botão que baixa em CSV as linhas filtradas.

## 5. Requisitos não funcionais

- **RNF-01 Simplicidade:** sem etapa de build no frontend. Bibliotecas com versão fixa via CDN. O backend usa apenas `duckdb` e `anthropic`.
- **RNF-02 Honestidade estatística:** todo percentual mostra o n. Quando n < 5, o valor aparece com aviso de "n pequeno". Séries temporais usam proporções (o número de vagas mudou em 2018).
- **RNF-03 Segurança do chat:** banco aberto só para leitura, acesso externo desligado e configuração travada, só `SELECT`/`WITH`, limite de linhas e de tempo, chave só no servidor.
- **RNF-04 Ética e LGPD:** raça é dado sensível. Só entra com evidência pública documentada. Nunca exibir inferência. Toda pessoa tem fonte por atributo.
- **RNF-05 Acessibilidade:** contraste AA, navegação por teclado nos filtros e no chat, títulos e descrições nos gráficos, layout utilizável a partir de 360 px.
- **RNF-06 Desempenho:** `dados.json` < 1 MB; primeira renderização local < 2 s.

## 6. Fora de escopo nesta versão (com motivo)

| Ideia | Por que depois |
|---|---|
| Renovação (estreantes) e "clube dos recorrentes" | Exige edições contínuas; com 2 edições o resultado engana |
| Bar chart race (barras que se reordenam), rede júri ↔ premiados | Exige a série completa |
| Tema das obras (hipótese do "tema obrigatório") | Exige sinopses e classificação revisada |
| Efeito do prêmio nas visualizações da Wikipédia | Fase 2; exige coleta de séries de visualizações |
| Outros prêmios | O Jabuti precisa estar sólido antes |
