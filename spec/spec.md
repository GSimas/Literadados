# Spec — Literadados

> Fase SDD 1/3 (o quê e por quê). Desenho técnico: [design.md](design.md). Tarefas: [tasks.md](tasks.md).
> Toda mudança de comportamento começa aqui: edite o requisito e o critério de aceitação **antes** do código.

## 1. Problema

Dados sobre literatura e leitura no Brasil existem, mas estão espalhados, em formatos fechados e sem recorte comparável:

- **Prêmios literários:** não existe base pública que cruze **prêmio × categoria × etapa (lista, finalista, premiado, vencedor) × gênero × raça × lugar de nascimento** de quem chega a eles. Há catálogos só de vencedores, sem perfil demográfico, e estudos acadêmicos com recortes fechados em PDF.
- **Leitura e acesso ao livro:** indicadores de alfabetização, leitura, bibliotecas, livrarias e editoras estão em fontes diferentes (IBGE, INEP, Receita Federal, pesquisas como a Retratos da Leitura no Brasil), cada uma com o seu nível territorial, a sua definição e o seu ano, e quase nunca aparecem lado a lado por município, estado e região, com recorte por sexo e cor ou raça.
- **Cena literária local:** não há mapa público e verificável das livrarias, clubes do livro, editoras, autoras e autores e obras de uma cidade. O que existe são listas soltas em redes sociais, que envelhecem sem aviso.

O Literadados reúne esses dados numa plataforma de **módulos** que compartilham o mesmo território, as mesmas pessoas, obras e editoras e as mesmas regras de rigor: fonte em cada dado, n em cada percentual, raça só autodeclarada. Visualizações e uma IA respondem perguntas em linguagem natural.

## 2. Escopo

**Módulos** (decisões DB-1 a DB-7, no fim do RF-34)

| Módulo | Dentro | Fora (por enquanto) |
|---|---|---|
| **Prêmios** (RF-01 a RF-30) | Prêmios literários de língua portuguesa: listas, finalistas, premiados e júri, com o perfil demográfico de quem chega a eles (tabela abaixo) | Prêmios ainda não coletados (tabela abaixo) |
| **Leitura** (RF-33) | Indicadores agregados de leitura, alfabetização e acesso ao livro (bibliotecas escolares, livrarias, editoras) por município, UF, região e Brasil, com recorte por sexo, cor ou raça, idade e escolaridade quando a fonte publica | Microdados sem divulgação pública; indicadores por país |
| **Mapeamento** (RF-34) | Florianópolis: livrarias e sebos, clubes do livro, editoras, autoras e autores e obras, cada registro com o seu vínculo com a cidade | Outros municípios; bibliotecas, feiras, saraus e eventos; vendas e preços |
| **Eventos** (RF-35) | Festivais, feiras, bienais, festas e encontros literários no Brasil todo: edições passadas e futuras, com datas, cidade, local e fonte | Eventos de uma escola só, lançamentos de livro, saraus semanais; países fora do Brasil |
| Plataforma (RF-31, RF-32) | Portal, território comum (códigos do IBGE), busca, Diadorim, páginas estáticas e dados abertos de todos os módulos | Países como território de indicador ou de mapeamento (DB-7) |

**Módulo Prêmios**

| Dentro | Fora (por enquanto) |
|---|---|
| Prêmio Jabuti, edições 1959–2026 (série completa; listas públicas de indicados de 2000 em diante), o padrão do painel; Prêmio Oceanos, 2003–2025 (todas as listas públicas, categorias Geral, Romance, Poesia, Contos, Prosa e o Grande Prêmio como Livro do Ano), RF-26 | Prêmios ainda não coletados (lista em `dados/coleta/premios_candidatos.md`). Prêmio São Paulo, Biblioteca Nacional, Sesc, LeYa, José Saramago, ABL e Camões estão na base (RF-26); o conjunto da obra (Camões, Machado de Assis) entra à parte, sem misturar com as métricas por livro (RF-30) |
| Romance (Romance Literário a partir de 2020), Contos (Contos e Crônicas até 2017; "Conto" a partir de 2018), Crônica (desde 2018), Poesia, Infantil, Juvenil, **Infantil e Juvenil (só 2018, quando foram fundidas)**, Livro do Ano | Romance de Entretenimento; Infantil Digital; Escritor Estreante; categorias de ilustração e não ficção (exceto Livro do Ano) |
| Autores e ilustradores das obras; organizadores (registrados, fora das contagens); jurados | Tradutores, editores, prêmios de inovação |
| Estado = **UF de nascimento** | Estado de residência |
| Raça **somente por autodeclaração pública** (ou fonte curada por identidade) | Inferência de raça por foto, sobrenome ou IA |
| Gênero com fonte; sem fonte, **atribuído pelo primeiro nome e marcado** (D16) | Atribuição de gênero por apelido ambíguo ou iniciais |

**Fase atual:** o módulo Prêmios está no ar, com os prêmios do RF-26 coletados e a cobertura de atributos das pessoas parcial (ver Metodologia). Os módulos Leitura e Mapeamento estão especificados (RF-31 a RF-34; decisões DB-1 a DB-7 fechadas em 2026-11-20) e em desenho (D37 a D40). O app precisa ser honesto com qualquer cobertura.

## 3. Públicos

- **Pesquisadora ou jornalista:** quer recortes exatos, com fonte, para citar.
- **Leitor curioso:** quer explorar visualmente e descobrir padrões.
- **Gestora pública, bibliotecária ou educadora:** quer comparar o próprio município ou estado com outros, com fonte e ano de cada número.
- **Leitora, livreiro, editora ou autora de Florianópolis:** quer achar livrarias, clubes e livros da cidade, e pedir para entrar no mapa, corrigir ou sair dele.
- **Mantenedor dos dados:** quer acrescentar edições, indicadores e registros sem mexer em código.

## 4. Requisitos funcionais

Cada requisito tem critérios de aceitação (CA) verificáveis. Os marcados com 🧪 têm teste automatizado em `tests/`; os marcados com 👁 são verificados no navegador.

RF-01 a RF-30 formam o **módulo Prêmios**. RF-31 (portal) e RF-32 (território) valem para a plataforma inteira; RF-33 (Leitura), RF-34 (Mapeamento) e RF-35 (Eventos) são os módulos novos e ficam no fim desta seção.

### RF-01 Base de dados
Os CSVs em `dados/` são a fonte da verdade e seguem `schema.sql`. Um comando gera o banco e os dados do app.
- **CA-01.1 🧪** `python build.py` cria `literadados.duckdb` e `web/dados.json` (mais `web/dados-<prêmio>.json` com vários prêmios, CA-26.14) a partir de `dados/*.csv`.
- **CA-01.2 🧪** O build **falha** (código ≠ 0, mensagem clara) se uma restrição do schema for violada: raça sem fonte, categoria fora do recorte, chave estrangeira inexistente.
- **CA-01.3 🧪** O build **falha** se uma edição coletada tiver lista com tamanho diferente de `vagas_lista`, ou número de premiadas diferente de `vagas_premio`. Edições sem nenhuma indicação contam como "não coletadas" e não falham.
- **CA-01.4 🧪** O build imprime a cobertura por edição (gênero, UF, raça, idade).
- **CA-01.5 🧪** Organizadores (de antologia, obra reunida ou póstuma) ficam com `papel = 'organizador'` e não entram em nenhuma contagem do painel, nem com o filtro "autores e ilustradores". Obra creditada só a organizadores (antologia sem autores listados) é válida no build e fica fora das contagens de pessoas.

### RF-02 Filtros por parte
- **CA-02.1 👁** Não há filtro global: o Panorama, cada janela de gráfico e a galeria de Autores têm **filtro próprio** (período, categorias e papel, que é só autores ou autores e ilustradores; organizadores nunca entram), e cada um vale só para a sua parte. A História guiada e a Diadorim usam sempre a série completa (1959–2025). Cada filtro mostra o resumo do próprio recorte (pessoas · indicações), tem botão de limpar quando foi mudado e baixa em CSV as linhas da sua parte (RF-14).
- **CA-02.2 🧪👁** O estado de cada filtro fica na URL, num parâmetro com o nome da parte (`?panorama=2015-2025~Poesia,Romance~todos`, `?funil=2019-2025`), e o link é compartilhável. Filtros no padrão não aparecem na URL. A ida e a volta da codificação são testadas.

### RF-03 Panorama
- **CA-03.1 🧪👁** Cartões com: indicações, pessoas, obras, % mulheres, **piso** de % negros (com "pelo menos"), cobertura de raça, número de UFs de nascimento distintas (de 27) e número de editoras.
- **CA-03.2 👁** Faixa de cobertura temporal mostra, para todo o período da base (hoje 1959–2026), quais edições têm dados coletados.

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
- **CA-07.1 👁** Mapa coroplético do Brasil com os limites reais das UFs (malha do IBGE), colorido por pessoas ou por pessoas por milhão de habitantes (Censo 2022), com alternância entre as duas medidas, legenda, dica por UF (nome, pessoas, participações, por milhão) e tabela equivalente. Clicar numa UF lista as pessoas nascidas nela.
- **CA-07.3 🧪** A malha das UFs é um arquivo estático separado de `dados.json` (não entra no limite de 1 MB) e cobre as 27 UFs.
- **CA-07.2 👁** Diagrama Sankey: região de nascimento → região da sede da editora → resultado (premiada ou não).

### RF-08 Idade
- **CA-08.1 👁** Gráfico de enxame (beeswarm): idade no ano do prêmio, cor por gênero, com dica (nome, obra, ano) e mediana por gênero.

### RF-09 Editoras
- **CA-09.1 👁** As 15 editoras com mais indicações, separando premiadas e não premiadas.
- **CA-09.2 🧪👁** Participação de grupos editoriais em comparação com independentes.

### RF-10 Júri e premiados
- **CA-10.1 👁** Para as edições com júri coletado: júri × lista × vencedoras em % mulheres, % negros declarados e % nascidos fora do Sudeste.

### RF-11 Explorador de pessoas e perfis
- **CA-11.1 👁** Galeria de todas as pessoas do recorte (anel de retratos, CA-11.5), com busca por nome, ordenação (prêmios, participações, nome) e alternância para tabela.
- **CA-11.5 🧪👁** Galeria em **anel**: os retratos (só a foto, ou as iniciais) são círculos em anéis concêntricos ao redor de um **centro vazio**. Do anel de dentro para fora segue a ordenação escolhida, e os círculos nunca se sobrepõem nem passam da largura disponível. O centro é sempre um **círculo perfeito** (largura igual à altura, ocupando cerca de 24% da largura do anel), com folga interna, e o texto do resumo se ajusta ao tamanho dele. No hover ou no foco, o retrato ganha brilho de fundo e o centro mostra o resumo da pessoa: nome, UF · ano de nascimento, indicações e selo de 1º lugar ou prêmios. O clique abre o perfil completo em janela modal.
- **CA-11.6 👁** Galeria e tabela são **paginadas**, com 100 pessoas por página. Há setas à esquerda e à direita do anel (e as teclas ← e →) e o indicador "1–100 de 713 · página 1 de 8". O anel ocupa quase a altura toda da tela. Busca e ordenação voltam à página 1. Uma mudança de filtro mantém a página, desde que ela ainda exista.
- **CA-11.7 🧪👁** Em tela de toque (`pointer: coarse`), todo controle tem alvo de pelo menos 44 × 44 px; links dentro de texto corrido (fonte, crédito), pelo menos 24 px. O anel mostra por página só as pessoas que cabem com retratos de 44 px ou mais (`metricas.capacidadeAnel`).
- **CA-11.2 🧪👁** O perfil de cada pessoa tem endereço próprio (`#/pessoa/<id>`, link compartilhável), lista as participações em linha do tempo **em ordem de ano** (indicações, júri e organização juntos) e a **fonte de cada atributo**. Raça mostra o trecho literal e o link. Há links para Wikidata e Wikipédia quando existem.
- **CA-11.4 🧪👁** Gênero sem fonte pode ser **atribuído pelo primeiro nome** (`genero_evidencia = 'atribuicao'`, sem `genero_fonte`). O build falha se a atribuição vier com fonte ou sem gênero definido. Todo número de gênero (abertura, panorama, história) leva um asterisco quando o recorte inclui pessoas com gênero atribuído. A nota de rodapé diz quantas são, que o dado pode estar errado e como pedir correção (contato@gustavosimas.com). O perfil e a tabela de pessoas marcam o gênero atribuído com o mesmo asterisco.
- **CA-11.3 🧪👁** Foto, em ordem de preferência: (1) arquivo do Wikimedia Commons com licença livre (CC BY, CC BY-SA, CC0, "Attribution" do Commons ou domínio público), com autoria e licença visíveis e link para a página do arquivo; (2) foto publicada na web com direitos reservados (decisão do responsável pelo projeto, out/2026), exibida da própria fonte, sem cópia no site, sempre com o crédito "Foto: <site>" ligado à página onde ela está e a indicação "direitos reservados". A identidade é conferida pela página (nome e livro da base). Sem foto, um avatar com as iniciais, cuja cor **não** depende de gênero, raça ou região. O carrossel da abertura (CA-19.4) usa só fotos livres.

### RF-15 Página, navegação e tema
- **CA-15.1 👁** Abertura com título, pergunta central e três números do recorte completo de **todos os prêmios da base** (pessoas distintas, % mulheres, piso de % negras), calculados dos dados. Nem o título nem a descrição se referem a um prêmio só: os prêmios e períodos vêm dos dados (DA-5).
- **CA-15.2 👁** Navegação fixa no topo com as seções, indicação da seção atual e tema claro, escuro ou automático (preferência do sistema), lembrado entre visitas. Gráficos redesenham ao trocar o tema.
- **CA-15.4 👁** Ordem das partes depois da abertura: Autores, Panorama, Gráficos e, por último, a história guiada (scrollytelling).
- **CA-15.3 👁** O cabeçalho não tem filtro: cada parte filtrável traz o seu (RF-02).

### RF-16 História guiada (scrollytelling)
- **CA-16.1 👁** Uma narrativa em passos, com um gráfico fixo de pontos (um ponto por pessoa-autora) que se reorganiza a cada passo: todas as pessoas; por gênero; da lista às vencedoras; piso racial; região de nascimento. Um seletor no topo escolhe o prêmio da história ("Todos os prêmios", padrão, ou um deles; DA-4); com todos, cada pessoa é um ponto só, e o passo da lista às vencedoras diz que junta prêmios de formatos diferentes. Os textos não citam um prêmio fixo.
- **CA-16.2 🧪** Todos os números da narrativa vêm de uma função pura sobre os dados (nunca texto fixo) e mostram o n.
- **CA-16.3 👁** A rolagem encaixa em cada passo (scroll-snap). Com `prefers-reduced-motion`, não há encaixe nem animação. Há um link para pular a história, e os passos funcionam com teclado.

### RF-17 Linha do tempo
- **CA-17.1 👁** Linha do tempo de todo o período (hoje 1959–2026) com os marcos do prêmio e, por edição, as obras vencedoras de cada categoria (autoria, editora), com acesso ao perfil de quem venceu.
- **CA-17.2 🧪👁** Por edição, a composição da lista (% mulheres, piso de % negras, % Sudeste, com n) em pequenos gráficos alinhados à linha do tempo.

### RF-18 Referências
- **CA-18.1 🧪👁** Seção de referências com as fontes usadas, agrupadas por domínio (CBL/site oficial, Wayback, imprensa, Wikidata/Wikipédia, Literafro, TSE…), com o número de registros que cada uma sustenta e links.

### RF-19 Sistema visual próprio
- **CA-19.1 👁** Motion: transições sutis e consistentes (tokens de duração e curva). Botões reagem a hover e clique; seções entram com fade ao rolar; perfil, painel de filtros, menus e tabelas recolhíveis abrem e fecham animados. Com `prefers-reduced-motion`, nada anima.
- **CA-19.2 👁** Nenhum controle com aparência nativa do sistema: listas de opções (selects) viram menus próprios, operáveis por teclado (setas, Enter, Esc, Home/End) e com `role="listbox"`. Caixas de seleção, campos, diálogos, dicas dos gráficos e tabelas recolhíveis seguem o estilo do Literadados. As barras de rolagem são próprias e **grossas** (14 px).
- **CA-19.3 👁** Nenhum link azul sublinhado: nomes de pessoas, fontes, links externos e referências aparecem como chips clicáveis. Links dentro de texto corrido usam a cor da marca, com sublinhado animado no hover.
- **CA-19.4 👁** Abertura: o fundo é um carrossel contínuo de fotos livres em faixas que correm em sentidos opostos, com pontos e brilho animados de leve. Os números da abertura contam até o valor.
- **CA-19.5 👁** Logotipo próprio (um hexágono de sete células de dados, sem referência a um prêmio) no cabeçalho, com iluminação das células no hover e no foco. O mesmo logotipo aparece no README e no ícone da aba.
- **CA-19.6 👁** O tema é trocado num botão de ícone de **tamanho fixo**, sem menu: **cada clique passa ao próximo tema** (Automático → Claro → Escuro → Automático), o ícone e o rótulo acessível mostram o tema ativo, e a troca não desloca a rolagem da página.
- **CA-19.8 👁** Dicas (balões) dos gráficos entram e saem com fade, tanto as do Observable Plot quanto as dos gráficos feitos à mão (mapa, Sankey, história).
- **CA-19.9 👁** Em todo gráfico, o elemento sob o mouse (barra, célula, ponto, UF, fluxo) fica em destaque e os demais do mesmo gráfico ficam mais transparentes. Ao sair do gráfico, tudo volta ao normal.
- **CA-19.10 👁** Todo bloco (cartões de número, cartões de gráfico, cartões da linha do tempo, passos da história, blocos de método e referências) ganha um brilho de fundo no hover, um foco de luz na cor da marca que acompanha o ponteiro, e a borda e a sombra acendem junto.
- **CA-19.11 👁** Tabela com mais de 10 linhas não fica toda aberta na página: mostra cerca de 10 linhas, com barra de rolagem própria (no estilo do Literadados) e o cabeçalho da tabela fixo no topo enquanto rola. Vale para o painel, as janelas, os perfis, o Método e as páginas estáticas; a exportação leva todas as linhas.
- **CA-19.12 👁** Mostrar só o necessário (pedido de 2026-11-21): a página mostra o essencial, e o detalhe fica a um clique. Texto de abertura longo mostra a 1ª frase, e o resto vai para um botão "i" (nota que abre ao lado do botão e fecha com Esc, clique fora ou rolagem). Definição e limitações de indicador, critérios de contagem e notas de método ficam em "i". Conteúdo extenso (método, cobertura, fichas) fica em blocos com título e resumo que abrem numa janela, com poucos blocos por página. Nenhum texto ou número ultrapassa o limite do seu bloco.
- **CA-19.7 🧪👁** Contraste AA (≥ 4,5:1) nos dois temas, para texto sobre página, superfície, chips e botões, conferido por teste sobre os tokens de `style.css`. Dicas dos gráficos usam fundo e texto do tema.

### RF-20 Gráficos em janelas
- **CA-20.1 👁** Da Linha do tempo em diante (linha do tempo, mapa e Sankey, evolução, funil, categorias, idade, editoras, júri), os gráficos ficam **fora do fluxo da página**. A página mostra uma grade de cartões-botão ("Gráficos"), cada um com título, pergunta e ícone, e o clique abre uma **janela modal** grande com o bloco completo (controles, gráfico, legenda, tabela). Autores e Pergunte continuam na página.
- **CA-20.2 👁** Cada janela tem endereço próprio (`#/grafico/<id>`, link compartilhável) e fecha com ×, Esc ou clique fora, voltando ao endereço anterior. Um perfil aberto de dentro da janela abre por cima dela, e fechar o perfil devolve à janela.
- **CA-20.3 👁** A janela traz o próprio filtro no topo (RF-02). O gráfico é desenhado ao abrir, na largura da janela, e redesenhado quando mudam o filtro, o tema ou o tamanho da tela. Janelas fechadas não são desenhadas.
- **CA-20.4 👁** A navegação tem o item "Gráficos" no lugar de "Linha do tempo", "Mapa" e "Análises".

### RF-21 Busca no cabeçalho
- **CA-21.1 🧪** Busca **determinística** (sem IA) sobre um índice montado dos dados: pessoas, livros, editoras, estados, regiões, categorias, edições, gráficos e seções. Ela ignora acentos e maiúsculas, e cada palavra digitada precisa aparecer. A ordem é fixa: nome exato, começo do nome, começo de palavra, trecho; o desempate é pelo tipo, depois pelo tamanho do nome, depois pela ordem alfabética. A mesma busca dá sempre o mesmo resultado.
- **CA-21.2 👁** Campo no cabeçalho das duas páginas, que abre com `/` ou Ctrl/⌘+K. Os resultados aparecem numa lista própria com o tipo, o nome com o trecho encontrado destacado e um detalhe (UF · ano, autores · edição, sede…). A lista funciona por teclado (setas, Enter, Esc) e por mouse.
- **CA-21.3 👁** Cada resultado leva ao lugar certo: pessoa → perfil; livro → perfil de quem escreveu; estado/região → perfil do lugar (RF-22); editora → gráfico de editoras; categoria → gráfico de categorias; edição → linha do tempo; gráfico → janela; seção → âncora ou `metodo.html`.

### RF-22 Perfis de estados e regiões
- **CA-22.1 👁** Cada UF (`#/uf/<UF>`) e cada região (`#/regiao/<Região>`) tem perfil próprio, com link compartilhável, aberto na mesma janela dos perfis de pessoas. O perfil traz: mapa com o lugar em destaque; números (pessoas-autoras nascidas ali e a parcela do total com UF conhecida, indicações, pessoas premiadas e vencedoras, % mulheres com o asterisco do gênero atribuído, piso de % negras, pessoas por milhão de habitantes comparadas à média do Brasil); parcela por edição (gráfico com o n); parcela por categoria; na região, as pessoas por UF; e a lista de pessoas em chips que abrem os perfis.
- **CA-22.2 🧪** Os números vêm de `metricas.perfilLugar`, uma função pura testada sobre o recorte completo de autores.
- **CA-22.3 👁** Os perfis se ligam entre si: UF de nascimento no perfil da pessoa → perfil da UF; região no perfil da UF → perfil da região; UFs no perfil da região → perfis das UFs; o painel lateral do mapa tem botão para o perfil da UF clicada.

### RF-23 Ranking de pessoas
- **CA-23.1 🧪👁** Uma janela de gráfico mostra as 20 primeiras posições (com empates, podem ser mais) por **prêmios** (pódio), **1º lugares** ou **indicações**, no filtro da janela. Desempate pelas outras medidas e pelo nome; posição de competição (1, 2, 2, 4). Barras com cor por gênero, dica com UF e as três medidas, clique abre o perfil; tabela equivalente exportável.

### RF-24 Perfil de livro
- **CA-24.1 🧪👁** Cada livro tem perfil próprio (`#/obra/<id>`): título, autoria, ilustração e organização (com link para as pessoas), editora (grupo ou independente, sede), ano de publicação, participações no Jabuti em ordem de ano (categoria, nome original da época e resultado) e outras obras de quem escreveu. Títulos no perfil de pessoa, na linha do tempo e na busca levam a ele; a Diadorim pode citar `#/obra/<id>`.
- **CA-24.2 🧪👁** Capa: `coleta.py capas` procura no Google Books e na Open Library, e a coleta de imagens (`dados/coleta/imagens/`, `coleta.py imagens`) acrescenta lojas e editoras; só vale capa cujo título e sobrenome de autor batem. A imagem é exibida da própria fonte (o Literadados não guarda cópia de capa, que tem direito autoral), com crédito e link. Sem capa, ou se ela não carregar, aparece uma capa tipográfica (título e autoria).
- **CA-24.3 🧪👁** A capa no perfil inclina em perspectiva 3D acompanhando o cursor, com espessura de livro e retorno suave ao sair. O crédito fica imóvel e legível. Toque e preferência por movimento reduzido mantêm a capa estática; navegação e alternativa tipográfica continuam funcionando.

### RF-25 Série histórica (1959–2009)
- **CA-25.1 🧪** A base cobre 1959–2026. De 1959 a 2009 entram os premiados das categorias do recorte, cruzados no site oficial, na página "Edições anteriores" da CBL (Wayback, 2010) e na Wikipédia por edição; listas públicas de indicados só quando achadas completas em fonte da época. Categorias antigas mapeadas para as atuais (Contos/Crônicas/Novelas → Contos; Infantil ou juvenil → Infantil e Juvenil; Livro do Ano Ficção/Não Ficção e Melhor Livro de Ficção → Livro do Ano); Autor Revelação, Ilustração e as demais ficam fora. Editora só com fonte da época.
- **CA-25.2 🧪👁** Toda parte abre na **série completa, do primeiro ao último ano coletado** (hoje 1959–2026): abertura, história guiada, panorama, cada janela de gráfico, galeria de autores, perfis de pessoa, livro e lugar, busca e Diadorim. Os filtros recortam qualquer período dentro da série (por exemplo, 2010–2025), e só o recorte diferente do padrão vai para a URL. Quando o recorte inclui edições sem lista pública (1959–1999), o resumo do filtro avisa quantas.
- **CA-25.3 👁** Onde a série mistura edições com e sem lista pública, o painel diz isso: a história (passo "Da lista ao 1º lugar"), o funil e a linha do tempo explicam que, antes de 2000, a "lista" é só a dos premiados. Marcos da linha do tempo e da evolução incluem 1993 (pódio de 1º a 3º) e 2000 (listas públicas na base). Eixos com dezenas de edições mostram rótulos de 5 em 5 ou de 10 em 10 anos, e as barras não somem no celular.
- **CA-25.4 🧪👁** Indicações sem editora conhecida (série histórica sem fonte da época) não aparecem como uma "editora" no ranking de editoras: ficam fora da lista, e o gráfico informa quantas são.
- **CA-25.5 🧪** Nenhum texto do painel fixa o período antigo: história, perfil de lugar, rodapé da exportação e descrição da página vêm de `dados.json` (`anos`, `anos_coletados`) ou dizem 1959–2025. O `dados.json` não tem mais o campo `recorte`.

### RF-26 Vários prêmios
> Decisões DA-1 a DA-5 fechadas em 2026-10-16 (fim desta seção). A implementação começa pela etapa 0 (CA-26.2), que não muda o painel. Desenho: D31.

O prêmio vira uma dimensão dos dados, ao lado de ano e categoria. Pessoa, obra e editora são **um registro só**, compartilhado entre os prêmios: quem foi indicada ao Jabuti e ao Oceanos tem um perfil, com as duas trajetórias.

**Base e build**
- **CA-26.1 🧪** Há uma tabela `premio` (id, nome, organizador, ano de início, abrangência, fonte) e uma tabela `edicao` (prêmio, ano, regime, fonte). `categoria_edicao`, `indicacao` e `jurado` levam `premio_id` na chave. O build falha se o prêmio não existir, e as checagens de vagas (CA-01.3) valem por prêmio, ano e categoria.
- **CA-26.2 🧪** **Etapa 0, só com o Jabuti:** depois da migração para `premio_id`, a base tem só `premio_id = 'jabuti'`, e `v_participacao` (mais a coluna `premio`), o `dados.json` remontado e todos os testes atuais dão os mesmos números de antes. Só então entra o primeiro prêmio novo.
- **CA-26.3 🧪** Categorias: cada `categoria_edicao` mapeia o nome original para uma **taxonomia comum** (as categorias atuais mais as que os novos prêmios trouxerem, como Ensaio e Dramaturgia, se entrarem no recorte), e há a categoria **Geral** para prêmios de categoria única (prosa e poesia concorrendo juntas). O CHECK de categoria aceita só a taxonomia comum.
- **CA-26.4 🧪** Etapas: o vocabulário canônico (lista, finalista, premiada, vencedora) vale para todos os prêmios. Cada prêmio e edição diz o que é a "lista" ali (por exemplo, semifinalistas) e se houve 2ª lista. O regime de cada edição é um dado por prêmio e ano, não uma regra escrita na view.
- **CA-26.5 🧪** Identidade: a mesma pessoa em dois prêmios é um registro só. `coleta.py normalizar` casa primeiro pela decisão humana registrada, depois pelo QID do Wikidata, depois pelo nome, e o casamento só pelo nome entra numa lista para conferência humana. Obra casa por título **e** a mesma pessoa na autoria, nunca só pelo título; título e sobrenome iguais com pessoas diferentes viram obras diferentes e vão para a conferência. O resultado não muda entre execuções. O build informa quantas pessoas estão em mais de um prêmio e avisa quando há casamentos a conferir.
- **CA-26.6 🧪** A editora é a de cada indicação (o mesmo livro concorre em edições diferentes, de países diferentes; editora homônima de outro país é outra editora). Indicação sem editora com fonte da época fica sem editora, nunca herda a de outro ano ou prêmio. O gráfico de editoras conta a editora da indicação.
- **CA-26.7 🧪** Cobertura (CA-01.4, RF-13) por prêmio e edição.

**Painel**
- **CA-26.8 🧪👁** Todo filtro de parte (RF-02) ganha o **prêmio** (um, vários ou todos), guardado na URL junto com o resto do filtro. A ida e a volta da codificação são testadas. O padrão são todos os prêmios (DA-4), e o padrão não aparece na URL.
- **CA-26.9 🧪👁** Nenhum percentual soma bases diferentes sem avisar. Com mais de um prêmio no recorte, a evolução, o funil, as categorias, o júri e a linha do tempo mostram **um prêmio por faceta** (ou por linha), cada um com o seu n. Os cartões do panorama contam pessoas distintas e dizem quantos prêmios entram no recorte.
- **CA-26.10 👁** O perfil de pessoa mostra a trajetória em todos os prêmios, em ordem de ano, com o prêmio em cada item. O perfil de livro mostra todas as participações do livro, de qualquer prêmio. A linha do tempo tem os marcos de cada prêmio (criação, mudanças de formato).
- **CA-26.11 🧪👁** Janela nova, **Entre prêmios**: pessoas premiadas em dois ou mais prêmios, sobreposição entre os pares de prêmios (com n) e a ordem em que cada pessoa chegou a cada um.
- **CA-26.12 🧪** Nenhum texto fixa o Jabuti onde a parte cobre vários prêmios: abertura, busca ("Oceanos 2019" como edição), rodapé da exportação, Método e prompt da Diadorim leem os prêmios de `dados.json`.
- **CA-26.13 🧪** Diadorim: `v_participacao` tem a coluna `premio`, e o prompt lista os prêmios, os formatos de cada um e a regra de não comparar taxas de prêmios diferentes sem dizer as bases.
- **CA-26.14 🧪** RNF-06 continua valendo: cada arquivo de dados carregado na abertura tem menos de 1 MB. Com vários prêmios, um arquivo por prêmio (D31), e o painel remonta exatamente as linhas de `v_participacao`.

- **CA-26.15 🧪👁** Plataforma, não um prêmio (DA-5): nenhum texto genérico do site (título da página, abertura, cabeçalhos, rodapés, placeholders, rótulos, prompt da Diadorim, README) se refere a um prêmio só. O nome de um prêmio só aparece junto de um dado ou de uma regra daquele prêmio (ex.: "no Jabuti, até 1999 só há premiados"). Um teste varre `web/` e falha com frases que fixam um prêmio.

- **CA-26.16 🧪** **Prêmio São Paulo de Literatura** (2008–2025, `premio_id = 'sao-paulo'`, abrangência nacional): as duas categorias (Melhor Romance do Ano e Melhor Romance de Estreia, dividida em até 40 e mais de 40 anos em 2013–2018) mapeiam para `Romance`; `nome_original` distingue. A lista são os finalistas (`etapa_lista = finalistas`), com 1 vencedor por categoria; o ano é o da edição (os livros são do ano anterior). Fonte principal: página oficial "Edições Anteriores"; segunda fonte por ano (Wikipédia, PublishNews ou página oficial arquivada). Onde a página atual diverge do registro da época (2013: finalista omitida e rótulos de idade trocados), vale o registro da época, anotado em `observacao`.

- **CA-26.17 🧪** **Prêmio Literário Biblioteca Nacional** (1995–2025, `premio_id = 'biblioteca-nacional'`, Fundação Biblioteca Nacional, abrangência nacional; só autores brasileiros, inscrição pelo próprio autor): cada prêmio do recorte vira uma categoria, com o nome do prêmio em `nome_original` — Machado de Assis (`Romance`; `Prosa` em 1999–2002, quando cobria romance e conto), Artur Azevedo (1995–1998) e Clarice Lispector (2005–) (`Contos`), Alphonsus de Guimaraens (`Poesia`), Glória Pondé (`Infantil e Juvenil` em 2007–2011, `Juvenil` depois), Sylvia Orthof (`Infantil`, 2012–) e o prêmio único de 2004 (`Livro do Ano`). Ensaio, tradução, projeto gráfico, ilustração, quadrinhos e tradição oral ficam fora. A lista é a dos premiados (`etapa_lista = premiados`): só o vencedor até 2008 e em 2012–2016, com empates; pódio de 1º a 3º publicado no resultado oficial em 2009–2011 e de 2018 em diante; 3 finalistas e o vencedor em 2017 (`finalistas`). 2003 não teve prêmio. As listas de obras habilitadas (todas as inscritas válidas, publicadas em 2016 e 2022–2026) ficam fora por enquanto: viraria uma etapa nova (`inscritos`) e exigiria pesquisar milhares de pessoas (decisão do mantenedor).

- **CA-26.18 🧪** **Prêmio Sesc de Literatura** (2004–2025, `premio_id = 'sesc'`, Sesc Departamento Nacional): premia **originais inéditos** de autores estreantes no gênero, inscritos com pseudônimo. A tabela `premio` ganha `obras` (`publicadas` ou `ineditas`), e todo texto que apresenta o prêmio (Método, página do prêmio, prompt da Diadorim, formato na história) diz que ele julga inéditos. Categorias: Romance (2004–), Conto (`Contos`, 2006–) e Poesia (2024–). Só os vencedores têm nome público (`etapa_lista = premiados`); os finalistas de 2012–2013 saíram só com pseudônimo e ficam fora. A indicação fica sem editora (concorreu como original); a editora que publicou o livro depois vai em `observacao`. A edição de 2026 (vencedores de agosto/2026) fica para quando os outros prêmios tiverem 2026.

- **CA-26.19 🧪** **Prémio LeYa** (2008–, `premio_id = 'leya'`, grupo LeYa, abrangência lusófona, `obras = ineditas`): romance inédito inscrito com pseudônimo. Entram o vencedor e os **finalistas identificados por título e autor** (quando o livro saiu depois com o nome da pessoa ou a autoria foi revelada, com fonte); `etapa_lista = finalistas` com `vagas_lista` vazio (a lista é **parcial**: nenhuma edição tem todos os finalistas identificados; o número anunciado fica em `observacao`), ou `premiados` quando não houve lista. Anos sem vencedor ficam fora. A indicação fica sem editora; a editora que publicou depois vai em `observacao`.
- **CA-26.20 🧪** **Prémio Literário José Saramago** (1999–, `premio_id = 'saramago'`, Fundação Círculo de Leitores, lusófono, autor jovem): até 2019 premiava livro publicado, desde 2022 premia romance inédito. `edicao.obras` (`publicadas`/`ineditas`, vazio = o valor do prêmio) guarda isso por edição, e os textos do prêmio (Método, página do prêmio, prompt da Diadorim) dizem desde quando ele julga inéditos. Vencedores e finalistas identificados, como no LeYa.
- **CA-26.21 🧪** **Prêmios da Academia Brasileira de Letras** (`premio_id = 'abl'`, nacional): os prêmios por livro do recorte — Ficção (`Prosa`), Poesia (`Poesia`), Literatura Infantojuvenil (`Infantil e Juvenil`) e os prêmios por livro criados em 2026 — com o nome do prêmio em `nome_original` e só os premiados (`etapa_lista = premiados`); e o **Prêmio Machado de Assis** (conjunto da obra, RF-30).
- **CA-26.22 🧪** **Prêmio Camões** (1989–, `premio_id = 'camoes'`, Portugal e Brasil, lusófono): só conjunto da obra (RF-30), com o júri onde publicado. Não tem indicação de livro: fica fora das partes do painel por livro e aparece no perfil da pessoa, na janela Conjunto da obra, na busca de pessoas e na Diadorim.

**Decisões** (fechadas em 2026-10-16; o desenho de cada uma está em D31)
- **DA-1 Prêmios e ordem:** o Oceanos (ex-Portugal Telecom) é o piloto. Depois vêm o Prêmio Literário da Biblioteca Nacional e o Prêmio São Paulo de Literatura. As categorias ficam nos gêneros do recorte atual, mais `Geral` para categoria única. Período, formato e listas de cada prêmio são conferidos com fonte na coleta.
- **DA-2 Conjunto da obra** (revista em 2026-11-19, decisão do mantenedor): prêmios pelo conjunto da obra (Camões, Machado de Assis da ABL) **entram como um tipo à parte** (RF-30): registrados por pessoa, sem livro, e nunca somados às métricas por livro.
- **DA-3 Autores de fora do Brasil:** entram. A pessoa ganha país de nascimento (`BR` para quem tem UF), e a geografia ganha a dimensão "país"; o mapa continua sendo do Brasil. Raça segue o mesmo protocolo de autodeclaração, e o Método avisa que os termos seguem as categorias do IBGE.
- **DA-4 Visão padrão** (revista em 2026-10-16): o painel abre com **todos os prêmios**; cada filtro tem o seletor de prêmio para recortar um ou vários. Com mais de um prêmio, os gráficos de taxa usam facetas por prêmio (CA-26.9). A História guiada e os perfis de lugar têm o mesmo padrão (todos), com seletor na história. A ordem dos prêmios (coluna `ordem`) só define a ordem de listas e facetas e a coleta, não um prêmio "principal".
- **DA-5 Identidade** (revista em 2026-10-16): o Literadados é uma plataforma de prêmios literários, não de um prêmio. Título ("Quem chega aos prêmios literários?", sem sobretítulo listando os prêmios: retirado a pedido do mantenedor em 2026-11-21), descrição, rodapés, placeholder da Diadorim, busca e textos dos gráficos falam de prêmios em geral; regra que é de um prêmio só (formatos, anos sem lista pública, júri divulgado) aparece com o nome do prêmio. O logotipo perde o jabuti e fica com as células de dados.

### RF-30 Conjunto da obra
> DA-2 revista em 2026-11-19. Desenho: D36.

- **CA-30.1 🧪** A tabela `distincao` (prêmio, ano, `nome_original`, pessoa, fonte) guarda quem recebeu um prêmio pelo conjunto da obra. Cada distinção pertence a uma `categoria_edicao` com `categoria = 'Conjunto da obra'` e `etapa_lista = premiados`, o que deixa o júri na tabela `jurado` de sempre. O build falha se uma categoria de conjunto da obra tiver indicação de livro, se uma distinção estiver em outra categoria ou se o número de distinções diferir de `vagas_premio`.
- **CA-30.2 🧪** As distinções ficam **fora** de `v_participacao` e de toda métrica por livro (lista, finalistas, premiadas, funil, editoras, ranking, abertura). O `dados.json` as leva à parte (`distincoes`, com os prêmios só de distinção em `premios_distincao`); categorias, júris e edições de conjunto da obra não entram nas listas usadas pelas partes por livro.
- **CA-30.3 🧪👁** Janela **Conjunto da obra**: por prêmio, quem foi distinguido (ano, nome, link para o perfil) e a composição das pessoas distinguidas por gênero, raça declarada (piso) e região ou país de nascimento, com n, um prêmio por linha, sem somar prêmios.
- **CA-30.4 👁** O perfil de pessoa lista as distinções junto da trajetória ("Prêmio Camões 2019, conjunto da obra"), e a pessoa distinguida sem livro indicado também tem perfil e aparece na busca. O perfil de edição de um prêmio que tem as duas coisas (ABL) mostra a distinção do ano.
- **CA-30.5 🧪** Diadorim: view `v_distincao` (prêmio, ano, pessoa e os mesmos atributos de pessoa de `v_participacao`), e o prompt diz que distinção não é indicação de livro e não se soma a ela. As páginas estáticas de pessoa listam as distinções.

### RF-27 Encontrável por buscadores e IAs (SEO, AEO, GEO)
O painel é desenhado por JavaScript e os perfis vivem em rotas `#/...`, que buscadores e robôs de IA não indexam. O build gera, a partir dos mesmos dados, páginas estáticas que esses robôs leem sem JavaScript, e cada uma leva ao painel. Desenho: D32.
- **CA-27.1 🧪** `build.py` gera, em `web/`, páginas HTML sem JavaScript: cada prêmio (`/premios/<prêmio>/`), cada edição (`/premios/<prêmio>/<ano>/`, RF-28), cada pessoa da base (`/pessoas/<id>/`), cada UF com pessoas nascidas nela (`/estados/<UF>/`), cada editora (`/editoras/<id>/`, RF-29), as listas de prêmios, pessoas (A–Z), estados e editoras, as perguntas frequentes (`/perguntas/`) e os dados abertos (`/dados-abertos/`). Página de pessoa, prêmio, edição ou UF que saiu da base é apagada.
- **CA-27.2 🧪** Toda página gerada (e `index.html`, `metodo.html`) tem `<title>` próprio, `meta description`, `link rel="canonical"` absoluto em `https://literadados.gustavosimas.com`, Open Graph e Twitter Card, um só `<h1>`, `lang="pt-BR"` e dados estruturados JSON-LD válidos (`WebSite`, `ProfilePage`/`Person`, `CollectionPage`, `ItemList`, `Book`, `FAQPage`, `Dataset`, `BreadcrumbList`).
- **CA-27.3 🧪** As regras do painel valem nas páginas: todo percentual mostra o n; pessoas negras são piso ("pelo menos"); raça só aparece com autodeclaração, link e trecho, e "sem declaração" nunca é apresentado como branca; gênero atribuído pelo nome vem marcado. No JSON-LD de pessoa nunca há raça, e o gênero só entra quando tem fonte.
- **CA-27.4 🧪** Os números de destaque das páginas (pessoas-autoras, indicações, mulheres e piso de negras, no total e por prêmio) são os mesmos que o painel calcula (`metricas.historia`), conferidos por teste.
- **CA-27.5 🧪** `sitemap.xml` lista todas as páginas indexáveis; `lastmod` só muda quando o conteúdo da página muda (página igual não é regravada). `robots.txt` libera buscadores e robôs de IA e aponta o sitemap. `llms.txt` (resumo, números com n e links) e `llms-full.txt` (premiadas de cada edição, em texto) seguem o formato de llmstxt.org.
- **CA-27.6 🧪** A abertura (`index.html`) traz no HTML os três números reais (gravados pelo build), em vez de zeros de esqueleto, e links para as páginas de consulta. Há `404.html`.
- **CA-27.7 👁** As páginas usam o mesmo cabeçalho, tema e tipografia do site, funcionam a partir de 360 px e passam no axe-core.

### RF-28 Perfil de edição
Cada edição (prêmio + ano) tem um perfil, como pessoas, livros e lugares.
- **CA-28.1 👁** Cada ano da faixa "Edições com listas coletadas" (Panorama) é um link que abre o perfil da edição (`#/edicao/<prêmio>/<ano>`). A busca do cabeçalho e a linha do tempo levam ao mesmo perfil.
- **CA-28.2 🧪👁** O perfil mostra: prêmio, ano, regime (formato) e fonte oficial; números da edição com n (pessoas-autoras, obras, % mulheres, piso de negras, % Sudeste) e a comparação com a edição anterior; gráficos da composição da lista e das premiadas (gênero, raça declarada, região); cada categoria com as obras em ordem de resultado (autoria com link para o perfil, editora, resultado) e o júri divulgado; links para a edição anterior e a seguinte e para a página estática. Números de uma função pura (`metricas.perfilEdicao`).
- **CA-28.3 🧪👁** Texto de contexto, no tom de jornalismo literário: o momento histórico e editorial e como foi a premiação. Vem de `dados/edicao_contexto.csv` (`premio_id, ano, texto, fontes, revisar`), com pelo menos uma fonte por texto, exibida no perfil. Escrito pelo protocolo `dados/coleta/contexto/PROTOCOLO.md`: só fatos com fonte ou da própria base, sem inferir raça ou gênero, sem copiar as fontes. O build falha se um texto não tiver fonte ou se apontar para edição inexistente. Edição sem texto mostra só os dados.
- **CA-28.4 🧪** O perfil de edição é a mesma informação da página estática da edição (RF-27), que traz o texto, as tabelas por categoria e os números, sem os gráficos.

### RF-29 Perfil de editora
Cada editora tem perfil próprio, como pessoas e livros. A editora é a da indicação (a edição que concorreu, CA-26.6).
- **CA-29.4 🧪👁** Todo perfil exibe identidade visual: logotipo oficial quando disponível, preservando suas proporções, com imagem da fonte e crédito com link; nos demais, marca tipográfica com iniciais e indicação explícita de que é uma alternativa. A marca tem alternativa textual; uma falha de carregamento revela a marca tipográfica sem imagem quebrada. O catálogo de logotipos é carregado separadamente dos dados principais.
- **CA-29.1 🧪👁** `#/editora/<id>` mostra: nome, grupo editorial (ou independente) e sede; indicações, obras premiadas e 1º lugares, por prêmio; posição entre as editoras da base por indicações; período em que aparece; pessoas-autoras publicadas (pessoas distintas, % mulheres com n, piso de pessoas negras); gráfico de indicações por edição (premiadas e não premiadas) com tabela equivalente; as obras em ordem de ano (prêmio, categoria, autoria com link, resultado); quem mais publicou por ela. Números de uma função pura (`metricas.perfilEditora`).
- **CA-29.2 👁** O nome da editora vira link para o perfil no perfil de livro, no perfil de pessoa, no perfil de edição, na linha do tempo e na busca do cabeçalho; as barras do gráfico de editoras abrem o perfil.
- **CA-29.3 🧪** Página estática `/editoras/<id>/` (RF-27) para cada editora com indicação, e a lista `/editoras/`, com os mesmos números (paridade testada) e JSON-LD (`Organization`).

### RF-12 Diadorim, a IA do Literadados
Chat flutuante chamado **Diadorim**, em referência à personagem de *Grande Sertão: Veredas*: firme, leal, de poucas palavras e fala com sabor de sertão, mas sempre clara. A personagem é inspirada no livro, sem reproduzir trechos dele.
- **CA-12.1 👁** Botão flutuante no canto inferior direito, com o retrato da Diadorim (chapéu de couro, olhos verdes) animado no hover; o cabeçalho do chat também se anima e acende no hover. O clique abre um painel de chat, que vira tela cheia no celular. O painel fecha com ×, Esc ou o próprio botão.
- **CA-12.2 👁** A primeira mensagem declara que Diadorim é uma **inteligência artificial**, que os números vêm de consultas à base e que ela pode errar.
- **CA-12.3 👁** Login pelo **OpenRouter com PKCE** (S256), feito no navegador. A chave de quem entrou fica só no navegador dela (localStorage) e há botão para sair. Modelo `openrouter/free`, um roteador de modelos gratuitos que suportam ferramentas.
- **CA-12.4 🧪** Contexto completo: o prompt traz as regras do Literadados e o esquema do banco (`contexto.json`, gerado pelo build), e a IA consulta qualquer dado por SQL num **DuckDB que roda no navegador** (DuckDB-WASM), carregado das tabelas em Parquet geradas pelo build. Só leitura na prática: só um `SELECT`/`WITH` passa pela validação, o acesso externo é desligado e a configuração é travada depois da carga, e há limite de linhas. O site é todo estático (RNF-07).
- **CA-12.5 👁** Toda resposta traz referências: links internos que levam à parte do Literadados com a informação (`#/pessoa/<id>`, `#/grafico/<id>`, `#autores`, `#panorama`, `metodo.html#metodologia`, `metodo.html#referencias`) e links das fontes externas da base. Os links internos navegam no próprio painel. O SQL usado aparece recolhível. A resposta interpreta Markdown: negrito, itálico, código, listas (também logo depois de um parágrafo), títulos, citações, linha horizontal e **tabelas** `| … |`, que viram tabelas de verdade e exportáveis. Todo HTML vindo do modelo continua escapado.
- **CA-12.6** Raça como piso, cobertura e gênero atribuído seguem as mesmas regras do painel (o prompt as traz). Sem login, o painel funciona normalmente e o chat só mostra o botão de entrar.
- **CA-12.7 👁** Sugestões de perguntas prontas, incluindo as três perguntas originais do projeto.
- **CA-12.8 👁** Toda mensagem mostra o horário. As respostas mostram também o modelo que de fato respondeu (o `model` devolvido pelo OpenRouter).
- **CA-12.9 🧪👁** Enquanto pensa, a Diadorim mostra os passos: ler o contexto, cada rodada com o modelo, cada consulta SQL (resumida) com o número de linhas devolvidas ou o erro, e a escrita da resposta. No fim, os passos ficam recolhidos na resposta.
- **CA-12.10 👁** Botão "Nova conversa", que limpa o histórico e volta à apresentação.
- **CA-12.11 👁** Configuração do modelo: a lista de **todos os modelos do OpenRouter** vem ao vivo de `GET /api/v1/models`, com busca por nome, filtros "só gratuitos" e "só com ferramentas" (ligado por padrão), preço por milhão de tokens e tamanho do contexto. O padrão é `openrouter/free`. A escolha fica salva no navegador e aparece no cabeçalho do chat.
- **CA-12.12 🧪** Nunca resposta seca: pergunta sobre os dados respondida só com o número (menos de 25 palavras fora das fontes, com consulta feita) leva a Diadorim a insistir uma vez com o modelo, pedindo as linhas por trás do número e o contexto. Se a resposta continuar seca, o Literadados detalha sozinho a contagem (`consultaDeDetalhe`) e mostra o bloco "Quem são" (nome com link, UF, ano, categoria, obra e colocação, e a contagem por estado), marcado como contexto montado pelo Literadados. Vale para qualquer modelo.
- **CA-12.13 🧪** Chamada de ferramenta escrita como texto (`<invoke name=…>`, `<tool_call>{…}</tool_call>`, comum em modelos gratuitos) é executada como chamada normal e nunca aparece na resposta. Na última rodada, o modelo é avisado de que não há mais consultas; se ainda assim só devolver marcação de ferramenta, a Diadorim diz que não fechou a resposta em vez de mostrar código. O campo de pergunta diz o assunto do módulo da página (não "prêmios" em Leitura, Mapeamento ou Eventos).

### RF-13 Metodologia e transparência
Sobre (o que é o Literadados), Como contribuir, Método e Referências (RF-18) ficam numa **página própria**, `sobre.html` (desde 2026-11-21; a antiga `metodo.html` redireciona preservando a âncora), com o mesmo cabeçalho, logotipo e tema. O item "Sobre" da navegação leva a essa página.
- **CA-13.1 👁** Seção com a tabela de cobertura por edição, as definições (etapas, regimes, piso racial, organizadores fora das contagens) e o protocolo de raça.
- **CA-13.2 👁** Instrução de como pedir correção, com fonte, e o contato (contato@gustavosimas.com).
- **CA-13.3 🧪👁** Cada pessoa registra se a busca de autodeclaração racial foi `completa` (protocolo cumprido) ou `parcial` (interrompida). A cobertura por edição mostra a % de buscas completas, e o panorama avisa quando há buscas parciais: "sem declaração" com busca parcial não significa ausência de declaração.

### RF-14 Exportação
- **CA-14.1 👁** Cada filtro tem um botão que baixa em CSV as linhas filtradas da sua parte.
- **CA-14.2 👁** Todo gráfico (das janelas, do mapa, do Sankey, da história e dos perfis de lugar) tem botão de exportar. Ele abre uma janela com duas opções: **JPG com fundo** (cor de fundo do tema) e **PNG sem fundo** (transparente). A imagem sai em resolução dobrada, com o título do gráfico, a legenda de cores e a linha "Literadados · Prêmio Jabuti <início>–<fim>", com o período do filtro da parte (sem filtro, a série completa).
- **CA-14.3 🧪👁** Toda tabela tem botão de exportar, que abre uma janela com **XLSX** ou **CSV** (UTF-8 com BOM). O XLSX é gerado no navegador, sem biblioteca externa, e os números viram números na planilha.

### RF-31 Portal e módulos
> Decidido em 2026-11-20 (DB-1, DB-4). Desenho: D37, D38. A implementação começa pela etapa 0 (CA-31.1), que não muda nenhum número do módulo Prêmios.

O Literadados deixa de ser um painel de prêmios e vira um portal com módulos. O painel de prêmios continua igual, como um dos módulos.
- **CA-31.1 🧪** **Etapa 0:** depois da reestruturação em portal, `v_participacao`, o `dados.json` remontado, as páginas estáticas e todos os testes do módulo Prêmios dão os mesmos números de antes. Só então entra o primeiro dado dos módulos novos.
- **CA-31.2 👁** Abertura do portal: nome e descrição da plataforma (literatura e leitura no Brasil) e um cartão por módulo com o **nome do módulo** como título (sem pergunta), uma linha curta e um número de destaque calculado dos dados, com link para o módulo. Módulo ainda sem dado não aparece. A página ocupa a largura toda e cabe na tela **sem barra de rolagem** em telas de 360 × 640 px para cima (quatro cartões numa linha na tela larga, em grade 2 × 2 na estreita). Ao fundo, faixas que correm devagar só com capas reais de livros vencedores (miniaturas exibidas da fonte, sem cópia, como em D34), com o crédito dos sites logo abaixo dos cartões. Com `prefers-reduced-motion`, as faixas param.
- **CA-31.3 🧪👁** Cada módulo tem endereço próprio e as próprias seções. Links já compartilhados do módulo Prêmios (`/#/pessoa/<id>`, `/#/grafico/<id>`, `/#/edicao/...`, `?panorama=...` e as demais rotas e filtros) continuam abrindo o mesmo conteúdo. Um teste percorre as rotas antigas.
- **CA-31.4 🧪👁** Cabeçalho **idêntico** em todas as páginas (portal, módulos, Método e páginas estáticas): logotipo, os módulos, Método, busca e tema, na mesma ordem e disposição; muda só o destaque do módulo atual. Atalhos de seção e páginas de consulta não entram no cabeçalho (ficam na página e no rodapé).
- **CA-31.11 🧪** Rodapé **idêntico** em todas as páginas, só com "Literadados" e o crédito "Plataforma desenvolvida por Gustavo Simas" (link para gustavosimas.com). Notas da página (gênero atribuído, data de geração) ficam no fim do conteúdo, não no rodapé; links de consulta, contato e créditos de fotos e malhas ficam na página Sobre.
- **CA-31.5 🧪** Busca do cabeçalho (RF-21) sobre todos os módulos: municípios, indicadores, livrarias e clubes entram no índice, com o tipo no resultado e o mesmo critério determinístico de ordem.
- **CA-31.6 🧪** Plataforma, não um módulo (amplia CA-26.15): título, descrição, README, `llms.txt` e prompt da Diadorim descrevem a plataforma inteira. Texto de um módulo só aparece no módulo. O teste de textos de plataforma passa a recusar também frases que reduzem o Literadados a prêmios ("plataforma de prêmios literários").
- **CA-31.7 🧪** Diadorim sobre todos os módulos: uma view por módulo no banco do navegador, e o prompt traz as regras de cada um (não comparar pesquisa amostral com censo sem dizer; mapeamento é cadastro incompleto; endereço só de lugar público).
- **CA-31.8 🧪** RNF-06 por módulo: cada módulo carrega só os próprios dados, e cada arquivo carregado na abertura de um módulo tem menos de 1 MB.
- **CA-31.9 🧪** Um só build: `python build.py` monta todos os módulos a partir de `dados/`, e uma inconsistência em qualquer módulo faz o build falhar com mensagem que diz o módulo.

### RF-32 Território
O território é o eixo comum dos módulos: tudo o que tem lugar aponta para um código oficial, nunca só para um nome.
- **CA-32.1 🧪** Tabela `territorio` com Brasil, as 5 regiões, as 27 UFs (código e sigla) e os municípios (código de 7 dígitos do IBGE, nome, UF), da API de localidades do IBGE, com a população do Censo 2022 por município (amplia `uf_populacao.csv`). País entra pelo código ISO 3166-1 (DA-3). O build falha se a tabela não tiver os 27 estados e todos os municípios da fonte.
- **CA-32.2 🧪** Todo dado com lugar nos módulos novos (valor de indicador, livraria, clube, vínculo de pessoa ou obra) aponta para um território pelo código. O build falha com código inexistente.
- **CA-32.3 🧪** Módulo Prêmios: pessoa (município de nascimento) e editora (município da sede) ganham o código do município, casado por nome e UF. Local fora do Brasil fica sem código de município. Nome que não casa (grafia antiga, distrito que virou município) vai para um relatório de conferência humana; a decisão fica registrada e o resultado não muda entre execuções. Nenhum número do módulo muda (CA-31.1).
- **CA-32.4 👁** Perfil de município (`#/municipio/<código>`), aberto na mesma janela dos outros perfis: reúne o que cada módulo sabe dele (pessoas premiadas nascidas ali, indicadores de leitura e, em Florianópolis, o mapeamento), cada bloco com fonte e ano. Os perfis de UF e de região (RF-22) ganham o bloco de indicadores de leitura.
- **CA-32.5 🧪** Malha municipal: arquivo estático separado, carregado só quando um mapa de municípios é desenhado (nunca na abertura), com os municípios da tabela `territorio`.

### RF-33 Módulo Leitura
> Decidido em 2026-11-20. Desenho: D39. Fontes conferidas na coleta: a que não tiver o nível territorial ou o recorte prometido sai da leva, com o motivo anotado no Método.

Indicadores agregados sobre leitura, alfabetização e acesso ao livro, por território, ano e recorte demográfico, de fontes oficiais ou pesquisas publicadas. Aqui não há pessoas: há números publicados por outras instituições, com a definição de cada uma.

**Base e build**
- **CA-33.1 🧪** Tabela `indicador` (id, nome, definição em uma frase, unidade, fonte, tipo de fonte: `censo`, `registro_administrativo` ou `pesquisa_amostral`, nível territorial mais fino) e tabela `indicador_valor` (indicador, território, ano, dimensão do recorte, valor do recorte, valor, numerador e denominador quando a fonte publica, tamanho da amostra e margem de erro ou intervalo quando a fonte publica, URL da fonte). O build falha com valor sem fonte, território inexistente, percentual fora de 0–100, recorte fora do vocabulário ou dois valores para a mesma chave. Unidade ∈ percentual, contagem, média, moeda (R$ correntes do ano) e pontuação (escala da avaliação); todo indicador tem um tema (hábitos, alfabetização, escola, mercado, bibliotecas); cada valor pode ter `observacao` (revisão da fonte, arredondamento). Pesquisa amostral sem amostra só passa quando `observacao` diz por que a fonte não a publica.
- **CA-33.2 🧪** Recortes num vocabulário fixo: `total`, `sexo`, `cor_raca` (as cinco categorias do IBGE: branca, preta, parda, amarela, indígena), `faixa_etaria`, `situacao` (urbana ou rural), `escolaridade`, `rede` (pública ou privada, para escolas) e `canal` (vendas ao mercado ou ao governo, no mercado do livro). Cor ou raça só vem da autodeclaração de quem respondeu à pesquisa ou ao censo, como a fonte publica; o Literadados nunca recalcula nem infere. O rótulo segue o termo da fonte ("sexo" no IBGE), e o Método explica a diferença para os termos do módulo Prêmios.
- **CA-33.3 🧪** Honestidade estatística (amplia RNF-02): valor de pesquisa amostral mostra o tamanho da amostra e a margem de erro quando a fonte publica; sem margem publicada, aparece o aviso "margem não publicada pela fonte". Valor que a própria fonte marca como pouco confiável ou suprime não é mostrado como número. Censo e registro administrativo mostram numerador e denominador. Um gráfico nunca põe na mesma escala indicadores de definições diferentes.
- **CA-33.4 🧪** Primeira leva de fontes, cada uma com seção no Método (definição, período, nível territorial, recortes, limitações):
  1. **Censo 2022 (IBGE):** taxa de alfabetização da população de 15 anos ou mais, por município, sexo, cor ou raça e faixa etária.
  2. **Censo Escolar (INEP):** % de escolas com biblioteca ou sala de leitura, por município e rede, nos anos disponíveis nos microdados.
  3. **CNPJ (Receita Federal, dados abertos):** estabelecimentos ativos com atividade principal de comércio varejista de livros (CNAE 4761-0/01) e de edição de livros (CNAE 5811-5/00 e 5821-2/00), por município, em números absolutos e por 100 mil habitantes. O Método avisa que a atividade é declarada pela empresa: o número é um indicador de presença, não um censo de livrarias (o cadastro curado é o RF-34).
  4. **Retratos da Leitura no Brasil (Instituto Pró-Livro):** % de leitores e livros lidos por ano, Brasil e regiões, por sexo, cor ou raça, faixa etária e escolaridade, nas edições publicadas. O Método traz a definição de "leitor" da pesquisa.
- **CA-33.5 🧪** Cobertura: o build imprime, por indicador, os anos, o nível territorial e quantos territórios têm valor. O módulo mostra a mesma cobertura.
- **CA-33.9 🧪** Segunda leva (pedido do mantenedor em 2026-11-21), cada fonte com seção no Método e conferida na coleta (a que não tiver o dado prometido sai, com o motivo):
  - **PNAD Contínua (IBGE, SIDRA):** taxa de analfabetismo de 15 anos ou mais, por ano (2016 em diante), Brasil, regiões e UFs, por sexo e cor ou raça quando a tabela publica;
  - **INAF (Ação Educativa / Instituto Paulo Montenegro):** níveis de alfabetismo funcional da população de 15 a 64 anos, Brasil, nas edições publicadas;
  - **SAEB (INEP):** proficiência média em Língua Portuguesa (5º e 9º anos do fundamental e 3º ano do médio), Brasil e UFs (municípios quando a planilha oficial trouxer), por edição;
  - **PISA (OCDE/INEP):** pontuação média do Brasil em leitura, por edição;
  - **Mercado do livro (CBL/Nielsen, SNEL):** exemplares produzidos e vendidos e faturamento do setor editorial, Brasil, por ano, nas edições publicadas da pesquisa "Produção e Vendas do Setor Editorial Brasileiro" e do "Painel do Varejo de Livros";
  - **Bibliotecas públicas (Sistema Nacional de Bibliotecas Públicas / MUNIC-IBGE):** municípios com biblioteca pública e número de bibliotecas, por UF e município quando houver cadastro aberto.
- **CA-33.10 👁** Panorama por tema no alto do módulo: hábitos de leitura, alfabetização e alfabetismo, escola, mercado do livro e bibliotecas. Cada tema tem cartões com o último valor do Brasil (com ano, n e fonte) e um gráfico pequeno da série; o clique leva o indicador ao mapa e aos gráficos de baixo. Indicador só nacional (PISA, INAF, mercado) aparece só no panorama e na série, nunca como mapa.

**Painel**
- **CA-33.6 👁** O módulo abre com um indicador e um território escolhidos (padrão: Brasil). O mapa mostra o indicador por UF ou por município, com legenda, dica (território, valor, n ou numerador e denominador, ano, fonte) e tabela equivalente. A série temporal aparece quando há mais de um ano, e a comparação por recorte quando a fonte tem recorte (ex.: alfabetização por cor ou raça na UF). O clique num território abre o perfil dele (CA-32.4).
- **CA-33.7 🧪👁** A escolha de indicador, território, ano e recorte fica na URL e é compartilhável. A ida e a volta da codificação são testadas. Os números vêm de uma função pura testada.
- **CA-33.8 🧪** Páginas estáticas (RF-27): uma por indicador, com a tabela por UF, e as páginas de UF ganham o bloco de leitura. `indicador_valor` sai inteiro em CSV na página de dados abertos.

### RF-34 Módulo Mapeamento (Florianópolis)
> Decidido em 2026-11-20. Desenho: D40. Versão inicial só em Florianópolis (código IBGE 4205407); o modelo é por município, para crescer sem mudar a base (DB-3). Ordem de coleta: editoras e livrarias, depois autoras, autores e obras, por último clubes do livro (DB-4).

Cadastro curado da cena literária de um município. É um cadastro, não um censo: diz o que foi mapeado e conferido até agora, nunca "o que a cidade tem".

**Base e build**
- **CA-34.1 🧪** Pessoa, obra e editora são as mesmas tabelas do módulo Prêmios: uma pessoa de Florianópolis que já chegou a um prêmio é um registro só, com a trajetória nos prêmios e o vínculo com a cidade. Livraria e clube do livro são tabelas novas. O casamento de pessoas e obras segue o CA-26.5 (decisão humana, depois QID, depois nome com conferência).
- **CA-34.2 🧪** Todo registro do mapeamento tem fonte (URL) e `verificado_em` (data da última conferência). Livraria, clube e editora têm também `situacao` (`ativa`, `encerrada` ou `incerta`). O build falha sem fonte ou sem data. Registro encerrado continua na base, marcado, com o ano de encerramento quando conhecido. Registro com mais de 12 meses sem verificação aparece como "a conferir".
- **CA-34.3 🧪** Vínculo com o município explícito, com tipo e fonte (DB-2):
  - pessoa: `nascimento` (município de nascimento, como no resto da base) ou `atuacao` (vive ou trabalha na cidade, dito numa fonte pública: minibiografia de editora, entrevista, site da pessoa). Uma pessoa pode ter os dois;
  - obra: `autoria` (de pessoa com vínculo), `editora` (publicada por editora com sede na cidade) ou `ambientacao` (passada na cidade, dito numa fonte). Uma obra pode ter vários;
  - editora: sede no município; livraria e clube: endereço ou local de encontro no município.
  O build falha com vínculo sem tipo ou sem fonte. Nenhum número soma vínculos diferentes sem dizer o critério.
- **CA-34.4 🧪** **Livraria:** estabelecimento cuja atividade principal é vender livros ao público. Campos: nome, tipo (`geral`, `sebo`, `especializada` com o foco, `cafe_livraria`, `online`), rede ou independente, endereço e bairro (loja física), coordenadas, site e redes. Livraria só on-line com sede na cidade entra sem ponto no mapa. Papelaria e banca que vendem livro de forma secundária ficam fora. Candidatas vêm do CNPJ (CNAE 4761-0/01) e do OpenStreetMap; só entra quem tem sinal público de funcionamento (site, rede social ativa, página de evento, matéria), e as demais ficam no relatório de candidatas.
- **CA-34.5 🧪** **Editora:** sede no município e ao menos um livro publicado verificável (ISBN, catálogo de biblioteca ou página da editora). Tipo: `comercial`, `universitaria`, `independente` ou `artesanal` (inclui cartonera e editora de fanzine). Edição do autor não vira editora.
- **CA-34.6 🧪** **Autora ou autor:** pessoa com ao menos um livro publicado verificável (por editora ou edição do autor) e vínculo com a cidade (CA-34.3). Gênero, raça e nascimento seguem as regras da base: raça só autodeclarada, com trecho e link; gênero atribuído pelo nome marcado (CA-11.4). Só dados públicos e profissionais: nome literário, obras, vínculo, links públicos. Nunca endereço, telefone ou e-mail pessoal.
- **CA-34.7 🧪** **Obra:** livro de pessoa ou editora mapeada, ou ambientado na cidade, com ano, editora e ISBN quando houver. A capa segue o CA-24.2 (exibida da fonte, com crédito).
- **CA-34.8 🧪** **Clube do livro:** grupo com encontros recorrentes para discutir livros e com canal público (site, rede social, página de livraria ou biblioteca). Campos: nome, formato (`presencial`, `online`, `hibrido` ou `nao_informado`), periodicidade, foco (gênero, tema, público), aberto a novos membros ou não, quem organiza (instituição ou "independente") e local de encontro (`nao_informado` quando a fonte só traz o canal, por exemplo um @ numa programação de evento; então sem endereço nem ponto). Privacidade (DB-6): endereço só de lugar público (livraria, biblioteca, café); clube que se reúne em casa não tem endereço nem ponto no mapa. O nome de quem organiza um clube independente não é publicado, só o canal público do clube.

**Painel**
- **CA-34.9 👁** O módulo abre com um mapa da cidade com livrarias e clubes presenciais, com filtros por tipo e situação. O mapa é detalhado: contorno do município (na capital, parte insular e continental), distritos com nome, lagoas e municípios vizinhos, com zoom por botões, arraste, pinça e Ctrl + roda (a roda sozinha rola a página). Os rótulos não se sobrepõem, e pontos e textos mantêm o tamanho na tela. Há e uma lista equivalente (o mapa nunca é o único acesso, RNF-05). Abaixo, editoras, autoras e autores e obras em listas com busca e filtros (tipo, vínculo, situação). Livraria (`#/livraria/<id>`), clube (`#/clube/<id>`), pessoa, obra e editora têm perfil no módulo, com o vínculo e a fonte. Quem também está nos prêmios ganha link para o perfil de lá, e o perfil dos prêmios ganha o bloco "Em Florianópolis", com link de volta.
- **CA-34.10 🧪👁** Os números do módulo dizem o critério e o caráter de cadastro: "autoras e autores mapeados: X nascidos em Florianópolis, Y que atuam na cidade, Z nos dois", "livrarias ativas mapeadas", com a data da última conferência. Percentuais (gênero, piso de pessoas negras) mostram o n e seguem as regras do módulo Prêmios. Números de uma função pura testada.
- **CA-34.11 👁** Sugerir, corrigir ou sair: um formulário público, sem login, para sugerir um registro, corrigir um dado (com fonte) ou pedir a remoção de dados sobre si. Nada entra no site sem revisão humana. O que é aceito vai para os CSVs em `dados/` (a fonte da verdade continua sendo o CSV). Pedido de remoção de pessoa é atendido. O formulário pede só o necessário, e o contato é opcional.
- **CA-34.12 🧪** Páginas estáticas (RF-27): a página do mapeamento da cidade, com as listas, e uma página por livraria e por clube, com JSON-LD (`BookStore`, `Organization`). Os registros saem em CSV na página de dados abertos, sem nenhum campo além dos que o painel mostra.

**Decisões** (fechadas em 2026-11-20 pelo mantenedor; o desenho está em D37 a D40)
- **DB-1 Identidade** (revê DA-5): o Literadados é uma plataforma de dados sobre literatura e leitura, com foco no Brasil. Prêmios é um módulo. O título da abertura passa a falar da plataforma, e "Quem chega aos prêmios literários?" vira a pergunta do módulo Prêmios. O logotipo de células de dados continua.
- **DB-2 Vínculo com o município:** nascimento e atuação são vínculos diferentes, cada um com fonte, e nunca são somados sem dizer o critério. "Estado = UF de nascimento" continua valendo para o módulo Prêmios.
- **DB-3 Escala do mapeamento:** só Florianópolis na versão inicial. Outro município entra quando houver quem mantenha os registros de lá, pelo mesmo modelo.
- **DB-4 Ordem:** (1) portal e território, sem mudar números do módulo Prêmios (CA-31.1); (2) Leitura, com as quatro fontes do CA-33.4; (3) Mapeamento: editoras e livrarias, depois autoras, autores e obras, por último clubes.
- **DB-5 Contribuição:** formulário com revisão humana, sem servidor próprio (RNF-07). O CSV continua sendo a fonte da verdade.
- **DB-6 Privacidade:** no mapeamento, só dados públicos e profissionais de pessoas; endereço só de estabelecimento ou de lugar público; remoção atendida a pedido da pessoa.
- **DB-7 Países:** o território aceita país desde já (DA-3), mas indicadores e mapeamento fora do Brasil ficam para uma versão futura.

### RF-35 Módulo Eventos literários (Brasil)
> Pedido do mantenedor em 2026-11-21. Desenho: D41. Decisões DB-8 a DB-10 no fim desta seção.

Cadastro curado de eventos literários do Brasil (festivais, feiras, bienais, festas literárias, encontros, jornadas, salões), com as edições passadas e as anunciadas. Como o Mapeamento, é cadastro, não censo: diz o que foi mapeado até agora.

**Base e build**
- **CA-35.1 🧪** Tabela `evento` (id, nome, tipo ∈ `festival`, `feira`, `bienal`, `festa_literaria`, `encontro`, `jornada`, `salao`, `outro`; município-sede em `territorio`; organizador; site; redes; ano da 1ª edição; fonte; `verificado_em`) e tabela `evento_edicao` (evento, ano, número da edição, data de início e de fim, município, local, tema, homenageada ou homenageado, situação ∈ `realizada`, `prevista`, `cancelada`, `adiada`, `formato` ∈ `presencial`, `online`, `hibrido`, público estimado com a fonte dele, fonte, `verificado_em`). O build falha com edição sem fonte ou sem data, data de fim antes da de início, município inexistente, público sem fonte, edição `prevista` com data de fim anterior à data de verificação, ou `realizada` com data de início posterior a ela.
- **CA-35.2 🧪** Homenageada ou homenageado que está na base de pessoas é ligado pelo id (link para o perfil); quem não está fica só com o nome. Nenhum atributo de pessoa (gênero, raça) é inferido pelo evento.
- **CA-35.3 🧪** O ano de uma edição é o da data de início. Uma edição por evento e ano; evento que acontece duas vezes no mesmo ano usa edições com sufixo no número.

**Painel (`eventos.html`)**
- **CA-35.4 👁** O módulo abre com os **próximos eventos** (edições com data de fim a partir de hoje, na data do navegador), em ordem de data, e mostra a contagem de eventos e de edições mapeados, as UFs com eventos e a data da última conferência ("mapeados até agora").
- **CA-35.5 👁** Gráfico de tempo do ano escolhido (calendário em barras: uma barra por edição, do primeiro ao último dia, sobre os meses, com a data de hoje marcada; dica com nome, cidade, datas e situação; clique abre o perfil), mapa por UF com o número de edições no ano (tabela equivalente) e linha do tempo de cada evento (edições por ano, com situação). Filtros por tipo, UF, ano e situação, guardados na URL.
- **CA-35.6 🧪👁** Perfil de evento (`#/evento/<id>`): tipo, cidade, organizador, site, todas as edições com datas, local, tema, homenageados (com link para o perfil quando a pessoa está na base), público com fonte e situação. Números de funções puras testadas (`metricas.proximosEventos`, `metricas.filtrarEventos`, `metricas.resumoEventos`).
- **CA-35.7 👁** Perfil de município (CA-32.4) e página do mapeamento da cidade listam os eventos do município.

**Para buscadores e IA**
- **CA-35.8 🧪** Páginas estáticas `/eventos/` (por UF e por mês do ano corrente) e `/eventos/<id>/`, com JSON-LD `Event` por edição (`startDate`, `endDate`, `location` com cidade e UF, `eventStatus`: agendado, cancelado, adiado). A busca do cabeçalho acha eventos; o portal ganha o cartão do módulo; os dados saem em CSV na página de dados abertos.
- **CA-35.9 🧪** Diadorim no módulo Eventos (views `v_evento_edicao`), com as regras: cadastro, não censo; data e fonte de toda edição; "prevista" não é confirmação de que aconteceu.

**Decisões** (padrão do projeto, 2026-11-21; podem ser revistas pelo mantenedor)
- **DB-8 Recorte:** eventos abertos ao público cujo centro é a literatura ou o livro (feiras do livro, festas literárias, bienais, festivais e encontros de escritores). Ficam fora eventos internos de uma escola, lançamentos de livro, saraus recorrentes semanais e eventos acadêmicos (congressos), que pedem outro recorte.
- **DB-9 Abrangência inicial:** o Brasil todo, começando pelos eventos mais conhecidos de cada UF e pelas edições de 2015 em diante (mais as anteriores quando houver lista pública completa), e pela edição seguinte quando já anunciada.
- **DB-10 Datas:** "passado" e "futuro" são calculados no navegador pela data de hoje; a situação gravada (`prevista`, `realizada`) é a da última conferência, e edição prevista cuja data já passou aparece como "a conferir" até ser atualizada.

## 5. Requisitos não funcionais

- **RNF-01 Simplicidade:** sem etapa de build no frontend. Bibliotecas com versão fixa via CDN. O backend usa apenas `duckdb`. A IA roda no navegador, pelo OpenRouter, com a chave de quem entrou.
- **RNF-02 Honestidade estatística:** todo percentual mostra o n. Quando n < 5, o valor aparece com aviso de "n pequeno". Séries temporais usam proporções (o número de vagas mudou em 2018). Estimativa de pesquisa amostral mostra amostra e margem de erro, e nunca é comparada a censo ou registro sem aviso (CA-33.3). Cadastro curado (RF-34) é apresentado como "mapeado até agora", nunca como total.
- **RNF-03 Segurança do chat:** banco aberto só para leitura, acesso externo desligado e configuração travada, só `SELECT`/`WITH`, limite de linhas e de tempo. O servidor não guarda chave nenhuma: a chave do OpenRouter é de quem entrou e fica no navegador dela.
- **RNF-04 Ética e LGPD:** raça é dado sensível. Só entra com evidência pública documentada. Nunca exibir inferência de raça. Gênero é a única exceção: sem fonte, pode ser atribuído pelo primeiro nome, sempre marcado como atribuído (CA-11.4, D16). Todo atributo com fonte tem a fonte exibida. No mapeamento (RF-34), pessoas vivas aparecem só com dados públicos e profissionais, nenhum endereço de pessoa é publicado, e o pedido de remoção é atendido (DB-6).
- **RNF-05 Acessibilidade:** contraste AA nos dois temas, navegação por teclado nos filtros, na história, na galeria e no chat, títulos e descrições nos gráficos, tabela equivalente para cada gráfico, layout utilizável a partir de 360 px, `prefers-reduced-motion` respeitado, sem violações do axe-core (WCAG 2.1 A/AA) na página, nas janelas, nos perfis e no chat.
- **RNF-08 Desempenho e resiliência:** nada de script bloqueando a primeira pintura (d3 com `defer`; Plot e d3-sankey só quando um gráfico de janela ou de perfil de lugar vai ser desenhado, com pré-carga ociosa), fontes servidas pelo próprio site com fallback de métricas ajustadas, fotos como miniaturas WebP do próprio site (`coleta.py miniaturas`; sem elas, o Commons), tema salvo aplicado antes do primeiro quadro, espaço da abertura reservado até os dados chegarem (CLS ≈ 0), falha ao carregar os dados ou ao desenhar uma parte vira aviso com "Tentar de novo" sem derrubar o resto.
- **RNF-07 Hospedagem estática:** o site publicado (`web/`) funciona sem servidor de aplicação; ele vai para o Netlify em `literadados.gustavosimas.com`. O `server.py` serve só para o desenvolvimento local.
- **RNF-09 Mapas sem chave nem rastreamento:** mapas de municípios e da cidade funcionam sem chave de API e sem serviço que rastreie quem visita, com a atribuição exigida pela fonte do mapa de fundo.
- **RNF-06 Desempenho:** `dados.json` < 1 MB; primeira renderização local < 2 s. Vale por módulo (CA-31.8).
  - **CA-RNF-06.1 🧪** O build gera `dados.json` com menos de 1 MB a partir dos dados reais.
  - **CA-RNF-06.2 🧪** O arquivo não repete atributos de pessoa e de obra em cada participação. O painel remonta as linhas no navegador, com as mesmas colunas e valores de `v_participacao`.

## 6. Fora de escopo nesta versão (com motivo)

| Ideia | Por que depois |
|---|---|
| Renovação (estreantes) e "clube dos recorrentes" | Exige edições contínuas; com 2 edições o resultado engana |
| Bar chart race (barras que se reordenam), rede júri ↔ premiados | Exige a série completa |
| Tema das obras (hipótese do "tema obrigatório") | Exige sinopses e classificação revisada |
| Efeito do prêmio nas visualizações da Wikipédia | Fase 2; exige coleta de séries de visualizações |
| Outros prêmios | Saiu desta lista: virou o RF-26 |
| Indicadores e mapeamento por país | O território já aceita país (DB-7), mas as fontes são outras e o foco agora é o Brasil |
| Eventos fora do Brasil, congressos acadêmicos e saraus semanais | Outro recorte (DB-8); o modelo de evento serve se entrarem depois |
| Mapeamento de outros municípios | Exige quem mantenha os registros de cada cidade; o modelo já é por município (DB-3) |
| Bibliotecas, feiras, saraus e eventos no mapeamento | Primeiro as cinco entidades pedidas; bibliotecas públicas e comunitárias são as candidatas da 2ª versão |
| Páginas estáticas por município (5.570) | Depois que o perfil de município (CA-32.4) se mostrar útil |
| Outras fontes de indicadores (Sistema Nacional de Bibliotecas Públicas, MUNIC, PNAD Contínua, SAEB, INAF, Produção e Vendas do Setor Editorial) | Entram uma a uma, cada uma com o seu CA, como os prêmios no RF-26 |
| Vendas, preços e tiragens de livros | Sem fonte aberta por território |
