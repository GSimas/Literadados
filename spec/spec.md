# Spec — Literadados

> Fase SDD 1/3 (o quê e por quê). Desenho técnico: [design.md](design.md). Tarefas: [tasks.md](tasks.md).
> Toda mudança de comportamento começa aqui: edite o requisito e o critério de aceitação **antes** do código.

## 1. Problema

Não existe base pública que cruze **prêmio × categoria × etapa (lista, finalista, premiado, vencedor) × gênero × raça × estado de nascimento** dos autores de prêmios literários (hoje, Prêmio Jabuti e Prêmio Oceanos; a plataforma recebe outros pelo mesmo modelo). Há catálogos só de vencedores, sem perfil demográfico, e estudos acadêmicos com recortes fechados em PDF. O Literadados preenche essa lacuna com dados verificáveis, visualizações e uma IA que responde perguntas em linguagem natural.

## 2. Escopo

| Dentro | Fora (por enquanto) |
|---|---|
| Prêmio Jabuti, edições 1959–2025 (série completa; listas públicas de indicados de 2000 em diante), o padrão do painel; Prêmio Oceanos, 2003–2025 (todas as listas públicas, categorias Geral, Romance, Poesia, Contos, Prosa e o Grande Prêmio como Livro do Ano), RF-26 | Prêmio da Biblioteca Nacional, São Paulo de Literatura e outros (próximos, DA-1); prêmios pelo conjunto da obra (DA-2) |
| Romance (Romance Literário a partir de 2020), Contos (Contos e Crônicas até 2017; "Conto" a partir de 2018), Crônica (desde 2018), Poesia, Infantil, Juvenil, **Infantil e Juvenil (só 2018, quando foram fundidas)**, Livro do Ano | Romance de Entretenimento; Infantil Digital; Escritor Estreante; categorias de ilustração e não ficção (exceto Livro do Ano) |
| Autores e ilustradores das obras; organizadores (registrados, fora das contagens); jurados | Tradutores, editores, prêmios de inovação |
| Estado = **UF de nascimento** | Estado de residência |
| Raça **somente por autodeclaração pública** (ou fonte curada por identidade) | Inferência de raça por foto, sobrenome ou IA |
| Gênero com fonte; sem fonte, **atribuído pelo primeiro nome e marcado** (D16) | Atribuição de gênero por apelido ambíguo ou iniciais |

**Fase atual:** as 67 edições do Jabuti e as 23 do Oceanos estão coletadas; a cobertura de atributos das pessoas é parcial (ver Metodologia). O app precisa ser honesto com qualquer cobertura.

## 3. Públicos

- **Pesquisadora ou jornalista:** quer recortes exatos, com fonte, para citar.
- **Leitor curioso:** quer explorar visualmente e descobrir padrões.
- **Mantenedor dos dados:** quer acrescentar edições sem mexer em código.

## 4. Requisitos funcionais

Cada requisito tem critérios de aceitação (CA) verificáveis. Os marcados com 🧪 têm teste automatizado em `tests/`; os marcados com 👁 são verificados no navegador.

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
- **CA-03.2 👁** Faixa de cobertura temporal mostra, para 1959–2025, quais edições têm dados coletados.

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
- **CA-11.4 🧪👁** Gênero sem fonte pode ser **atribuído pelo primeiro nome** (`genero_evidencia = 'atribuicao'`, sem `genero_fonte`). O build falha se a atribuição vier com fonte ou sem gênero definido. Todo número de gênero (abertura, panorama, história) leva um asterisco quando o recorte inclui pessoas com gênero atribuído. A nota de rodapé diz quantas são, que o dado pode estar errado e como pedir correção (gustavosimassilva@gmail.com). O perfil e a tabela de pessoas marcam o gênero atribuído com o mesmo asterisco.
- **CA-11.3 🧪👁** Foto só de arquivo do Wikimedia Commons com licença livre (CC BY, CC BY-SA, CC0, "Attribution" do Commons ou domínio público), sempre com autoria e licença visíveis e link para a página do arquivo. Sem foto livre, um avatar com as iniciais, cuja cor **não** depende de gênero, raça ou região.

### RF-15 Página, navegação e tema
- **CA-15.1 👁** Abertura com título, pergunta central e três números do recorte completo de **todos os prêmios da base** (pessoas distintas, % mulheres, piso de % negras), calculados dos dados. Nem o título nem a descrição se referem a um prêmio só: os prêmios e períodos vêm dos dados (DA-5).
- **CA-15.2 👁** Navegação fixa no topo com as seções, indicação da seção atual e tema claro, escuro ou automático (preferência do sistema), lembrado entre visitas. Gráficos redesenham ao trocar o tema.
- **CA-15.3 👁** O cabeçalho não tem filtro: cada parte filtrável traz o seu (RF-02).

### RF-16 História guiada (scrollytelling)
- **CA-16.1 👁** Uma narrativa em passos, com um gráfico fixo de pontos (um ponto por pessoa-autora) que se reorganiza a cada passo: todas as pessoas; por gênero; da lista às vencedoras; piso racial; região de nascimento. Um seletor no topo escolhe o prêmio da história ("Todos os prêmios", padrão, ou um deles; DA-4); com todos, cada pessoa é um ponto só, e o passo da lista às vencedoras diz que junta prêmios de formatos diferentes. Os textos não citam um prêmio fixo.
- **CA-16.2 🧪** Todos os números da narrativa vêm de uma função pura sobre os dados (nunca texto fixo) e mostram o n.
- **CA-16.3 👁** A rolagem encaixa em cada passo (scroll-snap). Com `prefers-reduced-motion`, não há encaixe nem animação. Há um link para pular a história, e os passos funcionam com teclado.

### RF-17 Linha do tempo
- **CA-17.1 👁** Linha do tempo 1959–2025 com os marcos do prêmio e, por edição, as obras vencedoras de cada categoria (autoria, editora), com acesso ao perfil de quem venceu.
- **CA-17.2 🧪👁** Por edição, a composição da lista (% mulheres, piso de % negras, % Sudeste, com n) em pequenos gráficos alinhados à linha do tempo.

### RF-18 Referências
- **CA-18.1 🧪👁** Seção de referências com as fontes usadas, agrupadas por domínio (CBL/site oficial, Wayback, imprensa, Wikidata/Wikipédia, Literafro, TSE…), com o número de registros que cada uma sustenta e links.

### RF-19 Sistema visual próprio
- **CA-19.1 👁** Motion: transições sutis e consistentes (tokens de duração e curva). Botões reagem a hover e clique; seções entram com fade ao rolar; perfil, painel de filtros, menus e tabelas recolhíveis abrem e fecham animados. Com `prefers-reduced-motion`, nada anima.
- **CA-19.2 👁** Nenhum controle com aparência nativa do sistema: listas de opções (selects) viram menus próprios, operáveis por teclado (setas, Enter, Esc, Home/End) e com `role="listbox"`. Caixas de seleção, campos, diálogos, dicas dos gráficos e tabelas recolhíveis seguem o estilo do Literadados. As barras de rolagem são próprias e **grossas** (14 px).
- **CA-19.3 👁** Nenhum link azul sublinhado: nomes de pessoas, fontes, links externos e referências aparecem como chips clicáveis. Links dentro de texto corrido usam a cor da marca, com sublinhado animado no hover.
- **CA-19.4 👁** Abertura: o fundo é um carrossel contínuo de fotos livres em faixas que correm em sentidos opostos, com pontos e brilho animados de leve. Os números da abertura contam até o valor.
- **CA-19.5 👁** Logotipo próprio (um hexágono de sete células de dados, sem referência a um prêmio) no cabeçalho, com iluminação das células no hover e no foco. O mesmo logotipo aparece no README e no ícone da aba.
- **CA-19.6 👁** O tema é escolhido num botão de ícone de **tamanho fixo**, que abre um menu pequeno (Claro, Escuro, Automático), e o ícone mostra o tema ativo.
- **CA-19.8 👁** Dicas (balões) dos gráficos entram e saem com fade, tanto as do Observable Plot quanto as dos gráficos feitos à mão (mapa, Sankey, história).
- **CA-19.9 👁** Em todo gráfico, o elemento sob o mouse (barra, célula, ponto, UF, fluxo) fica em destaque e os demais do mesmo gráfico ficam mais transparentes. Ao sair do gráfico, tudo volta ao normal.
- **CA-19.10 👁** Todo bloco (cartões de número, cartões de gráfico, cartões da linha do tempo, passos da história, blocos de método e referências) ganha um brilho de fundo no hover, um foco de luz na cor da marca que acompanha o ponteiro, e a borda e a sombra acendem junto.
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
- **CA-24.2 🧪👁** Capa: `coleta.py capas` procura no Google Books e na Open Library e só aceita capa cujo título e sobrenome de autor batem. A imagem é exibida da própria fonte (o Literadados não guarda cópia de capa, que tem direito autoral), com crédito e link. Sem capa, ou se ela não carregar, aparece uma capa tipográfica (título e autoria).

### RF-25 Série histórica (1959–2009)
- **CA-25.1 🧪** A base cobre 1959–2025. De 1959 a 2009 entram os premiados das categorias do recorte, cruzados no site oficial, na página "Edições anteriores" da CBL (Wayback, 2010) e na Wikipédia por edição; listas públicas de indicados só quando achadas completas em fonte da época. Categorias antigas mapeadas para as atuais (Contos/Crônicas/Novelas → Contos; Infantil ou juvenil → Infantil e Juvenil; Livro do Ano Ficção/Não Ficção e Melhor Livro de Ficção → Livro do Ano); Autor Revelação, Ilustração e as demais ficam fora. Editora só com fonte da época.
- **CA-25.2 🧪👁** Toda parte abre na **série completa, 1959–2025**: abertura, história guiada, panorama, cada janela de gráfico, galeria de autores, perfis de pessoa, livro e lugar, busca e Diadorim. Os filtros recortam qualquer período dentro da série (por exemplo, 2010–2025), e só o recorte diferente do padrão vai para a URL. Quando o recorte inclui edições sem lista pública (1959–1999), o resumo do filtro avisa quantas.
- **CA-25.3 👁** Onde a série mistura edições com e sem lista pública, o painel diz isso: a história (passo "Da lista ao 1º lugar"), o funil e a linha do tempo explicam que, antes de 2000, a "lista" é só a dos premiados. Marcos da linha do tempo e da evolução incluem 1993 (pódio de 1º a 3º) e 2000 (listas públicas na base). Eixos com dezenas de edições mostram rótulos de 5 em 5 ou de 10 em 10 anos, e as barras não somem no celular.
- **CA-25.4 🧪👁** Indicações sem editora conhecida (série histórica sem fonte da época) não aparecem como uma "editora" no ranking de editoras: ficam fora da lista, e o gráfico informa quantas são.
- **CA-25.5 🧪** Nenhum texto do painel fixa o período antigo: sobretítulo da abertura, história, perfil de lugar, rodapé da exportação e descrição da página vêm de `dados.json` (`anos`, `anos_coletados`) ou dizem 1959–2025. O `dados.json` não tem mais o campo `recorte`.

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

**Decisões** (fechadas em 2026-10-16; o desenho de cada uma está em D31)
- **DA-1 Prêmios e ordem:** o Oceanos (ex-Portugal Telecom) é o piloto. Depois vêm o Prêmio Literário da Biblioteca Nacional e o Prêmio São Paulo de Literatura. As categorias ficam nos gêneros do recorte atual, mais `Geral` para categoria única. Período, formato e listas de cada prêmio são conferidos com fonte na coleta.
- **DA-2 Conjunto da obra:** prêmios pelo conjunto da obra (Camões, Machado de Assis da ABL) ficam fora (ver §6).
- **DA-3 Autores de fora do Brasil:** entram. A pessoa ganha país de nascimento (`BR` para quem tem UF), e a geografia ganha a dimensão "país"; o mapa continua sendo do Brasil. Raça segue o mesmo protocolo de autodeclaração, e o Método avisa que os termos seguem as categorias do IBGE.
- **DA-4 Visão padrão** (revista em 2026-10-16): o painel abre com **todos os prêmios**; cada filtro tem o seletor de prêmio para recortar um ou vários. Com mais de um prêmio, os gráficos de taxa usam facetas por prêmio (CA-26.9). A História guiada e os perfis de lugar têm o mesmo padrão (todos), com seletor na história. A ordem dos prêmios (coluna `ordem`) só define a ordem de listas e facetas e a coleta, não um prêmio "principal".
- **DA-5 Identidade** (revista em 2026-10-16): o Literadados é uma plataforma de prêmios literários, não de um prêmio. Título ("Quem chega aos prêmios literários?"), descrição, rodapés, placeholder da Diadorim, busca e textos dos gráficos falam de prêmios em geral; regra que é de um prêmio só (formatos, anos sem lista pública, júri divulgado) aparece com o nome do prêmio. O logotipo perde o jabuti e fica com as células de dados.

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

### RF-13 Metodologia e transparência
Método e Referências (RF-18) ficam numa **página própria** (`metodo.html`), com o mesmo cabeçalho, logotipo e tema. O item "Método" da navegação leva a essa página, e ela tem links de volta para as seções do painel.
- **CA-13.1 👁** Seção com a tabela de cobertura por edição, as definições (etapas, regimes, piso racial, organizadores fora das contagens) e o protocolo de raça.
- **CA-13.2 👁** Instrução de como pedir correção, com fonte, e o contato (gustavosimassilva@gmail.com).
- **CA-13.3 🧪👁** Cada pessoa registra se a busca de autodeclaração racial foi `completa` (protocolo cumprido) ou `parcial` (interrompida). A cobertura por edição mostra a % de buscas completas, e o panorama avisa quando há buscas parciais: "sem declaração" com busca parcial não significa ausência de declaração.

### RF-14 Exportação
- **CA-14.1 👁** Cada filtro tem um botão que baixa em CSV as linhas filtradas da sua parte.
- **CA-14.2 👁** Todo gráfico (das janelas, do mapa, do Sankey, da história e dos perfis de lugar) tem botão de exportar. Ele abre uma janela com duas opções: **JPG com fundo** (cor de fundo do tema) e **PNG sem fundo** (transparente). A imagem sai em resolução dobrada, com o título do gráfico, a legenda de cores e a linha "Literadados · Prêmio Jabuti <início>–<fim>", com o período do filtro da parte (sem filtro, a série completa).
- **CA-14.3 🧪👁** Toda tabela tem botão de exportar, que abre uma janela com **XLSX** ou **CSV** (UTF-8 com BOM). O XLSX é gerado no navegador, sem biblioteca externa, e os números viram números na planilha.

## 5. Requisitos não funcionais

- **RNF-01 Simplicidade:** sem etapa de build no frontend. Bibliotecas com versão fixa via CDN. O backend usa apenas `duckdb`. A IA roda no navegador, pelo OpenRouter, com a chave de quem entrou.
- **RNF-02 Honestidade estatística:** todo percentual mostra o n. Quando n < 5, o valor aparece com aviso de "n pequeno". Séries temporais usam proporções (o número de vagas mudou em 2018).
- **RNF-03 Segurança do chat:** banco aberto só para leitura, acesso externo desligado e configuração travada, só `SELECT`/`WITH`, limite de linhas e de tempo. O servidor não guarda chave nenhuma: a chave do OpenRouter é de quem entrou e fica no navegador dela.
- **RNF-04 Ética e LGPD:** raça é dado sensível. Só entra com evidência pública documentada. Nunca exibir inferência de raça. Gênero é a única exceção: sem fonte, pode ser atribuído pelo primeiro nome, sempre marcado como atribuído (CA-11.4, D16). Todo atributo com fonte tem a fonte exibida.
- **RNF-05 Acessibilidade:** contraste AA nos dois temas, navegação por teclado nos filtros, na história, na galeria e no chat, títulos e descrições nos gráficos, tabela equivalente para cada gráfico, layout utilizável a partir de 360 px, `prefers-reduced-motion` respeitado, sem violações do axe-core (WCAG 2.1 A/AA) na página, nas janelas, nos perfis e no chat.
- **RNF-08 Desempenho e resiliência:** nada de script bloqueando a primeira pintura (d3 com `defer`; Plot e d3-sankey só quando um gráfico de janela ou de perfil de lugar vai ser desenhado, com pré-carga ociosa), fontes servidas pelo próprio site com fallback de métricas ajustadas, fotos como miniaturas WebP do próprio site (`coleta.py miniaturas`; sem elas, o Commons), tema salvo aplicado antes do primeiro quadro, espaço da abertura reservado até os dados chegarem (CLS ≈ 0), falha ao carregar os dados ou ao desenhar uma parte vira aviso com "Tentar de novo" sem derrubar o resto.
- **RNF-07 Hospedagem estática:** o site publicado (`web/`) funciona sem servidor de aplicação; ele vai para o Netlify em `literadados.gustavosimas.com`. O `server.py` serve só para o desenvolvimento local.
- **RNF-06 Desempenho:** `dados.json` < 1 MB; primeira renderização local < 2 s.
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
| Prêmios pelo conjunto da obra (Camões, Machado de Assis da ABL) | Não há livro concorrendo; misturá-los ao funil e às métricas por obra confunde (DA-2). Se entrarem, vão para uma tabela `distincao` à parte (D31) |
