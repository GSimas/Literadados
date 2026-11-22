# Tarefas — Literadados

> Fase SDD 3/3. Cada tarefa aponta o requisito ou critério que entrega. Marque `[x]` só quando o critério estiver verificado: teste verde (🧪) ou conferência no navegador (👁).

## T1 Dados piloto
- [x] T1.1 Estrutura `categoria_edicao` 2010–2025 (RF-01): 111 linhas; tamanhos de lista conferidos de forma independente com as listas de 2016 e 2023
- [x] T1.2 Listas 2016 e 2023 → `indicacao`, `obra`, `autoria`, `editora` (RF-01): 123 indicações, 121 obras
- [x] T1.3 Jurados 2023 (RF-10): 18
- [x] T1.4 Pessoas: QID quando encontrado (RF-01, RF-11). O Wikidata ficou indisponível por limite de taxa; a pesquisa foi feita por busca web
- [x] T1.5 Pessoas: nascimento e raça pelo protocolo (RNF-04). Segunda passada (P1) concluiu a busca das 121 pessoas que estavam com `raca_busca = parcial`. Os 12 trechos de raça foram verificados: 9 automaticamente, 2 PDFs à mão (Sony Ferseck, Wilson Alves-Bezerra) e o TSE de Cida Pedrosa no navegador, porque o curl recebe 403
- [x] T1.6 Editoras: sede e grupo (RF-07, RF-09): 77 de 82 com sede, 21 em grupos
- [x] T1.7 População por UF, Censo 2022 (RF-07)

## T2 Build e banco
- [x] T2.1 `build.py`: carga, restrições e checagens de consistência (CA-01.1 a 01.4) 🧪
- [x] T2.2 Exportar `web/dados.json` no contrato do design (CA-01.1) 🧪

## T3 Backend e IA
- [x] T3.1 Execução segura de SQL (CA-12.2) 🧪
- [~] T3.2 `/api/chat` com Tool Runner, fallbacks e tratamento de recusa (CA-12.1, 12.3). Testado com cliente falso; **sem chamada real à API, porque não havia credencial no ambiente**
- [x] T3.3 503 sem credencial (CA-12.4) 🧪

## T4 Frontend
- [x] T4.1 `metricas.js` com funções puras (CA-03.1, 05.1, 06.2, 09.2) 🧪
- [x] T4.2 Esqueleto, tema, filtros e URL (RF-02) 👁
- [x] T4.3 Panorama e cobertura (RF-03, CA-13.3) 👁
- [x] T4.4 Evolução com marcos e lacunas (RF-04) 👁
- [x] T4.5 Funil (RF-05) 👁
- [x] T4.6 Segregação e Duncan (RF-06) 👁
- [x] T4.7 Mapa em grade e Sankey (RF-07) 👁
- [x] T4.8 Enxame de idade (RF-08) 👁
- [x] T4.9 Editoras (RF-09) 👁
- [x] T4.10 Júri (RF-10) 👁
- [x] T4.11 Pessoas e ficha com fontes (RF-11) 👁
- [x] T4.12 Chat: interface e erros (RF-12) 👁; resposta real pendente de credencial
- [x] T4.13 Metodologia e exportação de CSV (RF-13, RF-14) 👁

## T5 Verificação
- [x] T5.1 `pytest` (26) e `node --test` (10) verdes
- [x] T5.2 Conferência no navegador: claro, escuro e 375 px (RNF-05)
- [x] T5.3 Aprendizados registrados no CLAUDE.md

## Próximas
- [x] P1 Segunda passada de raça e nascimento para as pessoas com `raca_busca = parcial`, em 5 lotes (`dados/coleta/pessoas_raca_1..5.csv`). Nenhuma ficou `parcial`. Achados: Chico César (preta), Wilson Alves-Bezerra (negra) e Cida Pedrosa (branca, pelo TSE); nascimento novo para 4 pessoas, completado para 1 e com fonte melhor para 3. Dúvidas de identidade e gênero ficaram em `observacao`
- [x] P2 Coletar as listas das outras 14 edições, em lotes por regime (2010–2017, 2018, 2019–2025) (RF-01): 16 edições no painel, 929 indicações, 914 obras, 126 jurados, build e testes verdes 🧪👁. Oito vagas de `categorias_edicao` corrigidas por empates/desclassificação (2010, 2011, 2013); jurados de 2018 não encontrados
- [~] P3 (substituída pela Diadorim, D20; o teste com a Anthropic saiu) Conferir o chat com credencial real e as três perguntas originais. Teste pronto: `test_chat_real_perguntas_originais` (marcado `integracao`) roda as três perguntas pelo chat real e exige os números do SQL de referência na resposta; **pulado enquanto não houver `ANTHROPIC_API_KEY`** no ambiente (nenhuma em out/2026). Sem chave, `/api/chat` responde 503 com instrução (conferido)
- [x] P4 Pessoas das 14 edições novas (690, em `pessoas_edicoes_1.csv`): Wikidata/Wikipédia por lote SPARQL (338 QIDs), Literafro (22 fonte curada) e protocolo de raça para 120 autores recentes. Gênero em 357, UF em 292, raça declarada em 29. **Faltam: busca de raça em 549 (`parcial`) e gênero/nascimento das demais, em lotes de ~120 por turno** (fila em ordem de prioridade: autores, edição mais recente). **Lote 1** (`pessoas_edicoes_2.csv`, 80 primeiros da fila, autores 2025–2024, protocolo em `dados/coleta/PROTOCOLO_PESSOAS.md`): só busca web (ambiente na nuvem sem Wikipédia/Wikidata), 147 buscas; +16 gênero, +16 UF, 1 busca de raça concluída, 0 autodeclarações. Autores: gênero 63%, UF 52%. **Lote 2** (`pessoas_edicoes_3.csv`, ordem 81–160, autores 2023–2021, 138 buscas): +16 gênero, +9 UF, 62 buscas de raça concluídas, 1 autodeclaração (Lindamir Salete Casagrande, branca; conferir com `coleta.py verificar`). Autores: gênero 65%, UF 53%, busca de raça completa 44%. **Lote 3** (`pessoas_edicoes_4.csv`, ordem 161–240, autores 2021–2020, 145 buscas): +14 gênero, +4 UF, 78 buscas de raça concluídas, 0 autodeclarações. Autores: gênero 67%, UF 54%, busca de raça completa 54%. **Lote 4** (`pessoas_edicoes_5.csv`, ordem 241–320, autores 2020–2019, 145 buscas): +21 gênero, +14 UF, 78 buscas de raça concluídas, 0 autodeclarações. Autores: gênero 70%, UF 56%, busca de raça completa 65%. **Lote 5** (`pessoas_edicoes_6.csv`, ordem 321–400, autores 2019–2016, 150 buscas): +16 gênero, +6 UF, 73 buscas de raça concluídas, 0 autodeclarações. Autores: gênero 72%, UF 56%, busca de raça completa 75%. **Lote 6** (`pessoas_edicoes_7.csv`, ordem 401–480, autores 2016–2013, 142 buscas): +11 gênero, +7 UF, 75 buscas de raça concluídas, 0 autodeclarações. Autores: gênero 73%, UF 57%, busca de raça completa 84%. Duplicata achada: `deborah-kietzmann-goldemberg` = `deborah-goldemberg` (unificar). **Lote 7** (`pessoas_edicoes_8.csv`, ordem 481–580, autores 2013–2010, 165 buscas): +16 gênero, +12 UF, 99 buscas de raça concluídas, 0 autodeclarações. **Fila esgotada.** Autores: gênero 75%, UF 59%, busca de raça completa 98% (18 `parcial`, em geral por recusa da ferramenta de busca). Pendências: gênero/UF dos que a busca web não achou (rodar com API da Wikipédia), casos "REVISAR" de raça. **Passada de créditos (out/2026):** 11 ilustradores/fotógrafa movidos de `autores` para `ilustradores` nas listas, com fonte em `observacao`; Deborah Kietzmann Goldemberg unificada em `deborah-goldemberg`. Ficam para decisão: organizadores listados como autores (Poesia reunida 2025, Caixa Rubem Braga 2017, Poesia Reunida – Euclides da Cunha 2010, De bala em prosa 2021); créditos sem confirmação (Rosinha 2021, Adilson Farias, Marlene Peret, Angela Lago em Bichos, Shirley Souza, Manoel Constantino). **Passada final (out/2026, Windows):** lote Wikidata/pt.wikipedia por API para 301 autores sem gênero/UF (`pessoas_wiki_1.csv`): 17 aceitos por ocupação + identificadores de autoridade (GND/VIAF), +11 gênero, +13 UF; o resto são homônimos ou pessoas sem verbete. Busca de raça das 18 autoras/es `parcial` (`pessoas_raca_6.csv`): 17 completas, 1 autodeclaração (Roni Wasiry, indígena; trecho confere); Tiago Hakiy ("nossa riqueza como indígenas") ficou `sem_declaracao` com REVISAR. Márcia Tiburi: branca pelo registro do TSE 2018 (`pessoas_tse_1.csv`). Lindamir Casagrande conferida à mão no PDF. Casos REVISAR consolidados em `dados/coleta/revisao_raca.csv` (92; 25 já resolvidos, 67 para decisão humana). Créditos pendentes resolvidos na P6. Autores: gênero 77%, UF 62%, busca de raça completa 99,9% (1 `parcial`)
- [ ] P5 Jurados de 2018 (nenhuma fonte achada: nem página oficial arquivada, nem imprensa). Tentado em out/2026 sem sucesso: CDX do Wayback para premiojabuti.com.br e cbl.org.br 2018–2019 (existe `jurados-2019` em diante, nunca `jurados-2018`), regulamento 07/2018 e `/curadoria/` (só "três jurados por categoria, validados pelo Conselho Curador"), notícias da CBL (renúncia do curador, finalistas, Bagolin) e PublishNews de 04/10 a 14/11/2018. Resta pedir à CBL
- [~] P6 Ilustradores de Infantil/Juvenil 2010–2025: das 191 linhas marcadas "ilustrador não verificado/levantado", 142 têm ilustrador com URL e trecho (24 de autor que também ilustra), 13 têm fonte de que não há ilustrador (só texto, fotografias, só capa) e 36 seguem não achadas (`observacao` diz o que foi tentado). 20 ilustradores que a CBL creditou como autores (2017–2025, crédito estruturado "Autor: X; Ilustrador: Y") passaram para `ilustradores`, como na passada de créditos; Ara Poty (tradutora de *Cadê Cadê*) saiu de autores e da base. Grupos/estúdios (Giramundo, Casa Rex) ficam só em `observacao`. Ilustradores: 22 → 123 pessoas; obras IJ com ilustrador distinto do autor: 22 → 136; +23 gênero e +14 UF por Wikidata (`pessoas_wiki_2.csv`). Ficam para decisão ("REVISAR crédito" nas listas): *A Raiva* (Lollo coautor ou só ilustrador?), *O Monge e o Passarinho* (texto de Manoel Bernardes adaptado por Angela Lago), *O Elefante Escravo do Coelho* (Giramundo; papel de Sonia Junqueira), *Filosofia Brincante* (Fernando Chuí), *Dentro de Mim Ninguém Entra*, editora de *O Segredo do Meu Irmão* (BesouroBox × 8Inverso). **Protocolo de pessoas nos ilustradores (out/2026):** 76 sem busca de raça completa (73 vazias + 3 `parcial`), em 3 lotes (`pessoas_ilus_1..3.csv`, 91 buscas web, resto por API da Martins Fontes/pt.wikipedia/Wikidata e sites de editoras): 76 buscas de raça concluídas, 0 autodeclarações; +30 gênero, +13 UF, +19 ano de nascimento (estrangeiros com país em `observacao`). Rubem Filho entrou em `revisao_raca.csv` (listado entre "ilustradores negros" da exposição Karingana, descrição de terceiros). Ilustradores (123): gênero 49% → 73%, UF 31% → 41%, busca de raça completa 100%. A conferir: `luciana-grether` e `luciana-grether-carvalho` são provavelmente a mesma pessoa (BrCris: "Luciana Grether de Mello Carvalho", PUC-Rio), sem fonte que ligue o crédito de *Heróis e Suas Jornadas*
- [x] P8 `dados.json` abaixo de 1 MB (RNF-06, D13): participação compacta e `metricas.expandir` no navegador 🧪👁
- [x] P9 Organizadores fora das contagens (CA-01.5, D14): coluna `organizadores` nas listas, 13 organizadores movidos e Euclides da Cunha incluído como autor de *Poesia Reunida* (2010) 🧪👁. Saíram das contagens 14 pessoas que só organizaram (pessoas-autoras 741 → 728; indicações com autor 929 → 923, porque 6 antologias não listam autores). O piso de negros caiu de 26 para 24 (Esmeralda Ribeiro e Márcio Barbosa, organizadores de *Cadernos Negros*), e Kaká Werá (indígena) saiu. Ficaram como autores: os 3 curadores de *De bala em prosa* (CBL credita os 31 nomes como autores) e *Pretos em contos 2* (sem fonte de que sejam só organizadores)
- [x] P7 Editoras novas (out/2026): 196 levantadas em 2 lotes (`editoras_enriquecidas.csv`, fonte por linha; agregadores de CNPJ marcados "certeza média"). 21 duplicatas unificadas por `canonico` (273 → 252 editoras; `independente` segue canônica da autopublicação). Com sede: 77 → 226 (90%); com grupo: 21 → 35; indicações com editora de sede conhecida: 584 → 881 de 926 (95%). Sem sede (26): editoras pequenas sem fonte e `independente`. Grupo pela data da obra (ex.: Escarlate com PRH só a partir de out/2020; Pequena Zahar 2018 sem grupo)

## T6 Interface narrativa (RF-15 a RF-18, D15)
- [x] T6.1 `coleta.py midia` + `dados/pessoa_midia.csv` + tabela `pessoa_midia` (CHECK de licença) + export `midia` (CA-11.3) 🧪: 476 pessoas com QID, 209 fotos livres (só 1 recusada por falta de autoria e 1 por ser estátua), 427 verbetes da pt.wikipedia
- [x] T6.2 `coleta.py malha` + `web/br-uf.json` (27 UFs) (CA-07.3) 🧪
- [x] T6.3 Export `fontes` por domínio (CA-18.1) 🧪
- [x] T6.4 `metricas.historia`, `metricas.porEdicao`, `metricas.corAvatar` (CA-16.2, 17.2, 11.3) 🧪
- [x] T6.5 Abertura, navegação fixa com seção atual, tema, filtros recolhíveis (RF-15) 👁
- [x] T6.6 História guiada com gráfico de pontos e encaixe por passo (RF-16) 👁
- [x] T6.7 Linha do tempo com vencedoras e pequenos múltiplos (RF-17) 👁
- [x] T6.8 Coroplético por UF com clique que lista pessoas (CA-07.1) 👁
- [x] T6.9 Galeria, perfis com rota por hash, foto com crédito ou avatar (RF-11) 👁
- [x] T6.10 Referências (RF-18) 👁
- [x] T6.11 Conferência no navegador (claro, escuro, 1280 e 375 px, sem rolagem horizontal, console sem erros) e testes verdes (36 pytest + 17 node). `prefers-reduced-motion` só por CSS/JS (a ferramenta não emula)
- [x] T6.12 Duplicata achada pela mídia: `carpinejar` e `fabricio-carpinejar` têm o mesmo QID (Q5428242); unificar pelo procedimento do CLAUDE.md. Mesma pessoa ("Carpinejar" é apelido no item; todas as obras pela Bertrand Brasil): lista 2025 passa a "Fabrício Carpinejar", id único `fabricio-carpinejar`. 915 → 914 pessoas, 714 → 713 pessoas-autoras (contagens por edição não mudam: nenhuma edição tinha os dois ids); 475 QIDs, nenhum repetido; 208 fotos livres, 426 verbetes

## T7 Gênero atribuído pelo nome (CA-11.4, D16)
- [x] T7.1 `pessoa.genero_evidencia` + CHECKs, `v_participacao.genero_atribuido`, export e `coleta.py` 🧪
- [x] T7.2 `dados/coleta/pessoas_zgenero_1.csv`: gênero pelo primeiro nome para quem segue `nao_identificado`: 229 atribuídas (134 homens, 95 mulheres); 9 continuam `nao_identificado` (Aramyz, Cavito, Del Candeias, Duda Porto de Souza, Hada Maller, Leguy, Rai Soares, Seta Gimeno, W. J. Solha). Pessoas-autoras: 155 de 713 com gênero atribuído; % mulheres 31% → 39%
- [x] T7.3 `metricas`: contagem `generoAtribuido` em `kpis` e `historia` 🧪
- [x] T7.4 Asterisco nos números de gênero, nota de rodapé com n e contato, perfil e tabela marcados; contato na Metodologia (CA-13.2) 👁
- [x] T7.5 Chat: o prompt explica `genero_atribuido`

## T8 Sistema visual próprio (RF-19, D17)
- [x] T8.1 Tokens de motion, revelação ao rolar, botões, diálogo e painéis animados (CA-19.1) 👁
- [x] T8.2 Select próprio com teclado, checkbox, campos, detalhes, rolagem grossa, dicas (CA-19.2) 👁
- [x] T8.3 Links como chips; texto corrido na cor da marca (CA-19.3) 👁
- [x] T8.4 Abertura com carrossel de fotos, pontos e números animados (CA-19.4) 👁
- [x] T8.5 Logotipo com iluminação no hover; `web/logo.svg`; favicon; README atualizado (CA-19.5) 👁
- [x] T8.6 Menu de tema em botão de ícone de tamanho fixo (CA-19.6) 👁
- [x] T8.7 Teste de contraste dos tokens nos dois temas (CA-19.7) 🧪

## T9 Página de método e galeria paginada (RF-13, RF-18, CA-11.5, D18)
- [x] T9.1 `metricas.paginas` com teste 🧪
- [x] T9.2 Paginação na galeria e na tabela de pessoas, sem "mostrar mais" 👁
- [x] T9.3 `tema.js` compartilhado; `metodo.html` + `metodo.js` com método, cobertura e referências; navegação aponta para a página 👁

## T10 Gráficos em janelas, dicas e hover (RF-20, CA-19.8, CA-19.9, D19)
- [x] T10.1 Seções da Linha do tempo ao Júri viram `<dialog class="janela">`; grade de cartões "Gráficos"; navegação 👁
- [x] T10.2 Rota `#/grafico/<id>`, perfil por cima da janela, render só das janelas abertas 👁
- [x] T10.3 Fade de entrada e saída nas dicas (Plot e próprias) 👁
- [x] T10.4 Destaque do elemento sob o mouse e esmaecimento dos demais em todos os gráficos 👁

## T11 Diadorim (RF-12, D20)
- [x] T11.1 `server.py`: `POST /api/sql` e `GET /api/contexto`; sai `/api/chat` e a dependência `anthropic` 🧪
- [x] T11.2 `web/diadorim.js`: PKCE do OpenRouter, laço de ferramentas, Markdown seguro com links internos 👁
- [x] T11.3 Botão flutuante com retrato animado, painel com declaração de IA, sugestões e sair 👁
- [x] T11.4 Seção "Pergunte" sai da página; navegação e README atualizados 👁

## T12 Anel de retratos (CA-11.5, CA-11.6, D21)
- [x] T12.1 `metricas.anel` com teste (cabe na largura, sem sobreposição, n posições) 🧪
- [x] T12.2 Anel com centro informativo, brilho no hover/foco, clique abre o perfil 👁
- [x] T12.3 Paginação de 50 com setas laterais e teclas ←/→ 👁
- [x] T12.4 Brilho de fundo que segue o ponteiro em todos os blocos (CA-19.10) 👁
- [x] T12.5 Retrato da Diadorim redesenhado com volume e luz (pedido: menos boneco) 👁

## T13 Filtros por parte (RF-02, D22)
- [x] T13.1 `metricas.filtroParaTexto`/`filtroDeTexto` com teste de ida e volta 🧪
- [x] T13.2 `ui.montarFiltro` (período, menu de categorias, papel, resumo, limpar, CSV) 👁
- [x] T13.3 Panorama, cada janela e Autores com filtro próprio e estado na URL; sem filtro global nem barra de recorte 👁
- [x] T12.6 100 retratos por página, miolo de 24% e centro circular fixo com texto em cqi (pedido de ajuste) 👁

## T14 Busca e perfis de lugar (RF-21, RF-22, D23)
- [x] T14.1 `metricas.indiceBusca`, `buscar` e `perfilLugar` com testes 🧪
- [x] T14.2 `web/busca.js`: combobox no cabeçalho das duas páginas (atalhos `/` e Ctrl/⌘+K) 👁
- [x] T14.3 `web/lugares.js`: perfis de UF e região com mapa, números, gráficos e pessoas; rotas `#/uf/` e `#/regiao/` 👁
- [x] T14.4 Ligações: UF no perfil da pessoa, região no perfil da UF, UFs no perfil da região, botão no painel do mapa 👁

## T15 Diadorim: horário, passos, nova conversa, modelo (CA-12.8–12.11, D24)
- [x] T15.1 `responder` com `{modelo, aoPasso}` e teste dos passos 🧪
- [x] T15.2 Horário em toda mensagem e modelo nas respostas 👁
- [x] T15.3 Passos intermediários ao vivo, recolhidos no fim 👁
- [x] T15.4 Botão "Nova conversa" 👁
- [x] T15.5 Configuração com todos os modelos do OpenRouter (busca, filtros, preço, contexto) 👁

## T16 Exportar gráficos e tabelas (CA-14.2, CA-14.3, D25)
- [x] T16.1 `exportar.xlsx` (ZIP STORE + CRC-32) e CSV, com teste (o Python abre o arquivo) 🧪
- [x] T16.2 Gráfico → JPG com fundo / PNG sem fundo, com título, legenda e rodapé 👁
- [x] T16.3 Botão em todo gráfico e toda tabela; janela de opções nas duas páginas 👁

## T17 Correções e ajustes (out/2026)
- [x] T17.1 História: o gráfico voltou a ficar fixo. Uma regra `position: relative` da exportação sobrescrevia o `sticky`, e o gráfico rolava junto com o primeiro passo 👁
- [x] T17.2 Markdown completo no chat (tabelas, títulos, citações, código, linha, lista depois de parágrafo), tabelas do chat exportáveis (CA-12.5) 🧪
- [x] T17.3 Cabeçalho da Diadorim animado e iluminado no hover (CA-12.1) 👁
- [x] T17.4 "2 vezes 1º lugar" no lugar de "2 1º lugares"; linha do tempo do perfil com entrada escalonada e brilho no hover 👁
- [x] T17.5 Cobertura por edição (metodo.html): sem rolagem dupla; o contêiner externo também tinha `.rolagem` 👁

## T18 Deploy estático no Netlify (RNF-07, D26)
- [x] T18.1 Build exporta Parquet, `views.sql` e `contexto.json` 🧪
- [x] T18.2 `web/banco.js` (DuckDB-WASM) e Diadorim sem `/api`; `validarSQL` testado no Node 🧪
- [x] T18.3 `server.py` só estático; testes ajustados 🧪
- [x] T18.4 `netlify.toml`, deploy e domínio `literadados.gustavosimas.com` (Netlify DNS) 👁

## T19 Auditoria de desempenho, acessibilidade e resiliência (out/2026, RNF-05, RNF-08)
- [x] T19.1 Cronologia do perfil em ordem de ano, com júri e organização intercalados (CA-11.2) 🧪
- [x] T19.2 d3, Plot e d3-sankey com `defer`; tema salvo aplicado por script inline no `<head>` 👁
- [x] T19.3 Abertura reserva o espaço dos números (esqueleto invisível); CLS da carga 0,09 → 0 👁
- [x] T19.4 axe-core sem violações: marcas do Plot fora da árvore de acessibilidade (o `<svg>` tem rótulo e há tabela), mapa como `group`, iniciais do avatar ocultas, cabeçalho da Diadorim sem landmark duplicado 👁
- [x] T19.5 Aviso com "Tentar de novo" quando os dados não carregam ou uma parte falha ao desenhar 👁
- [x] T19.6 `X-Frame-Options: DENY` no `netlify.toml`; cache segue revalidado (arquivos sem hash) 👁

## T20 Diadorim com contexto, toque, desempenho, ranking e livros (out/2026)
- [x] T20.1 Resposta nunca seca: prompt, insistência automática e bloco "Quem são" montado do banco (CA-12.12) 🧪
- [x] T20.6 Chamada de ferramenta em texto executada e nunca exibida; placeholder do campo por módulo (CA-12.13, D28b) 🧪
- [x] T20.2 Alvos de toque de 44 px em `pointer: coarse`; anel com `capacidadeAnel` (CA-11.7) 🧪👁
- [x] T20.3 Fontes locais com fallback ajustado; Plot e d3-sankey sob demanda; miniaturas WebP (RNF-08, D27) 👁
- [x] T20.4 Janela de ranking (RF-23) 🧪👁
- [x] T20.5 Perfil de livro `#/obra/<id>` e coleta de capas (RF-24) 🧪👁

## T21 Série histórica 1959–2009 (out/2026, RF-25)
- [x] T21.1 Premiados 1959–2009 das categorias do recorte: site oficial × "Edições anteriores" da CBL (Wayback) × Wikipédia por edição; colocações e divergências resolvidas com fonte (`dados/coleta/historico/`) 🧪
- [x] T21.2 Listas públicas completas de 2000–2009 (CBL arquivada, Folha, DGABC), com editora da época; 1991–1999 sem lista completa achada 🧪
- [x] T21.3 Mapeamento de categorias antigas; `colocacao` até 5 (1993); regimes "1959–1992 vencedor por categoria" e "1993–2009 pódio" 🧪
- [x] T21.4 Filtros com série 1959–2025 e padrão 2010–2025 (ranking na série toda); aviso de edições sem lista pública (CA-25.2) 🧪👁
- [x] T21.5 Pessoas novas: Wikipédia + Wikidata em lote (ofício e ano conferidos), 3 lotes de pesquisa pelo protocolo; restante com `raca_busca = parcial` 
- [x] T21.6 `dados.json` < 1 MB: chaves nulas fora, `premiada`/`vencedora` derivadas da colocação, `papel` só quando não é autor (RNF-06) 🧪
- [x] T21.7 Busca de raça das 139 pessoas com `parcial` (`pessoas_hist_raca_4..6.csv`: 0 autodeclarações, 5 casos em `revisao_raca.csv`); sede/grupo das 60 editoras novas (51 com sede, 5 unificadas por `canonico`)
- [ ] T21.8 Pendências: capas pelo Google Books (cota anônima com limite 0 em 16/out; precisa de chave de API), revisão humana dos casos em `revisao_raca.csv`

## T22 Série completa por padrão (out/2026, CA-25.2 a CA-25.5, D30)
- [x] T22.1 Build sem `recorte`; padrão de todas as partes = 1959–2025; `filtrar` sem período não corta anos 🧪
- [x] T22.2 Textos com período a partir dos dados (abertura, história, lugar, exportação, descrição, método) 🧪👁
- [x] T22.3 Avisos de edições sem lista pública (história, funil, linha do tempo); marcos de 1993 e 2000 👁
- [x] T22.4 Editoras: indicações sem editora fora do ranking, com contagem 🧪👁
- [x] T22.5 Eixos com muitas edições (rótulos de 5/10 anos; barras que cabem no celular) 👁
- [x] T22.6 Diadorim: prompt com a série completa como padrão e o aviso das edições sem lista 🧪

## T23 Vários prêmios (RF-26, D31)
- [x] T23.0 Decisões DA-1 a DA-5 fechadas (spec RF-26, D31)
- [x] T23.1 Etapa 0: tabelas `premio` e `edicao`, `premio_id` em `categoria_edicao`, `indicacao` e `jurado`, listas do Jabuti em `dados/coleta/jabuti/`, `literadados.duckdb`; mesmos números de antes (CA-26.1, CA-26.2) 🧪
- [x] T23.2 `normalizar` com vários prêmios: casamento de pessoa por QID e nome (com `casamentos_revisar.csv`), de obra por título e sobrenome (CA-26.5) 🧪
- [x] T23.3 Editora por indicação, taxonomia comum com `Geral`, `etapa_lista` (CA-26.3, CA-26.4, CA-26.6) 🧪
- [x] T23.4 Coleta do prêmio piloto (DA-1), com fontes e checagem de vagas; pessoas novas pelo protocolo (gênero, UF/país, raça)
- [x] T23.5 Filtro de prêmio por parte e facetas por prêmio (CA-26.8, CA-26.9); `dados.json` dividido se passar de 1 MB (CA-26.14) 🧪👁
- [x] T23.6 Perfis, linha do tempo, busca e textos com vários prêmios (CA-26.10, CA-26.12) 🧪👁
- [x] T23.7 Janela Entre prêmios (`metricas.entrePremios`, CA-26.11) 🧪👁
- [x] T23.8 Diadorim, Método e Referências com vários prêmios; cobertura por prêmio (CA-26.7, CA-26.13) 🧪👁
- [x] T23.9 Gauntlet 1 (revisão adversarial + auditoria do RF-26): obra só casa pela mesma pessoa, editora sem herança, ordem explícita do prêmio, `dados.json` dividido, avisos/facetas em todos os gráficos, país via Wikidata, busca e textos 🧪👁
- [x] T23.10 Plataforma de prêmios (DA-4/DA-5 revistas, CA-26.15): padrão = todos os prêmios, história com seletor, textos e logotipo sem prêmio fixo, teste de varredura 🧪👁

## T24 Encontrável por buscadores e IAs e perfil de edição (out/2026, RF-27, RF-28, D32)
- [x] T24.1 Textos de contexto das 90 edições pelo protocolo (`dados/coleta/contexto/lote_*.csv` → `dados/edicao_contexto.csv`); tabela `edicao_contexto` e checagens no build 🧪
- [x] T24.2 `metricas.perfilEdicao` e perfil `#/edicao/<prêmio>/<ano>` com gráficos; anos da faixa de cobertura, busca e linha do tempo levam a ele 🧪👁
- [x] T24.3 `seo.py`: páginas de prêmio, edição, pessoa, UF, listas, perguntas e dados, com JSON-LD; sitemap, `llms.txt`, `llms-full.txt` 🧪
- [x] T24.4 `index.html` e `metodo.html`: canônico, Open Graph, JSON-LD, números reais na abertura, links de consulta; `robots.txt`, `404.html`, imagem `og.png` 🧪👁
- [x] T24.5 Paridade dos números com `metricas.historia`; páginas sem JS conferidas no navegador e no axe-core 🧪👁
- [ ] T24.6 Revisão humana dos 26 textos com `revisar` (`coleta.py contexto` lista); conferir colocações de 2001 (Romance e Contos e Crônicas: Folha de 19/05/2001 diverge da base) e as categorias sem vencedor em 1987, 1988 e 1992

## T25 Perfil de editora (out/2026, RF-29, D33)
- [x] T25.1 `metricas.perfilEditora` e perfil `#/editora/<id>` com gráfico e tabela 🧪👁
- [x] T25.2 Links para o perfil: livro, pessoa, edição, linha do tempo, busca, gráfico de editoras 👁
- [x] T25.3 Páginas estáticas `/editoras/<id>/` e `/editoras/` com paridade de números 🧪
- [x] T25.4 README atualizado (logotipo em PNG, badges, estado atual) 👁
- [x] T25.5 Identidade visual em todos os perfis de editoras e páginas permanentes: 16 logotipos oficiais com crédito; marca tipográfica nos demais, durante o carregamento e em caso de falha, conforme decisão do responsável. SVGs conferidos no navegador e rasters em folha de contato; descartada a marca da Nova Fronteira por resolução insuficiente (64 px). Testes de referências, HTTPS, acesso alternativo e geração estática (CA-29.4, D35). 👁
- [x] T25.6 Capas com lombada, páginas e inclinação 3D ao mover o cursor; crédito imóvel, toque e movimento reduzido respeitados. Testes de limites dos ângulos e retorno na saída, cancelamento, perda de foco e mudança de preferência; movimento conferido no navegador (CA-24.3, D35). 👁

## T26 Prêmio São Paulo de Literatura (out/2026, CA-26.16)
- [x] T26.0 Levantamento de prêmios candidatos (`dados/coleta/premios_candidatos.md`)
- [x] T26.1 Listas 2008–2025 (finalistas e vencedores) com duas fontes por ano; júri final 🧪
- [x] T26.2 Casamento de pessoas e obras com a base; editoras 🧪
- [x] T26.3 Pessoas novas pelo protocolo (gênero, UF de nascimento, raça por autodeclaração)
- [x] T26.4 Marcos e formato no painel; build, testes e conferência 🧪👁
- [x] T26.5 Textos de contexto das 18 edições (RF-28, protocolo `dados/coleta/contexto/PROTOCOLO.md`)
- [ ] T26.6 Busca de raça dos jurados do São Paulo que ficou `parcial`; conferências listadas em `dados/coleta/sao-paulo/LEIA.md`

## T27 Prêmio Literário Biblioteca Nacional (out/2026, CA-26.17)
- [x] T27.1 Premiados 1995–2025 das categorias do recorte, com duas fontes; júri onde publicado 🧪
- [x] T27.2 Casamento de pessoas e obras; editoras 🧪
- [x] T27.3 Pessoas novas pelo protocolo
- [x] T27.4 Textos de contexto das edições (RF-28)
- [x] T27.5 Marcos e formato no painel; build, testes e conferência 🧪👁
- [ ] T27.6 Pendências da FBN em `dados/coleta/biblioteca-nacional/LEIA.md` (identidades, coautoria do Infantil 2022, júri de 2011, raça dos jurados); decidir sobre as listas de habilitadas

## T28 Prêmio Sesc de Literatura (out/2026, CA-26.18)
- [x] T28.1 Coluna `premio.obras` (publicadas/inéditas) nos textos do prêmio, no Método e no prompt 🧪
- [x] T28.2 Vencedores 2004–2025 com duas fontes; júri onde publicado 🧪
- [x] T28.3 Pessoas novas pelo protocolo; textos de contexto (RF-28)
- [x] T28.4 Marcos e formato no painel; build, testes e conferência 🧪👁
- [ ] T28.5 Pendências do Sesc em `dados/coleta/sesc/LEIA.md` (Zé, Mizé no Oceanos 2008; inscritos de 2014; edição 2026)

## T29 Imagens com direitos reservados (out/2026, CA-11.3, CA-24.2, D34)
- [x] T29.1 Spec, design e esquema (`pessoa_foto`, `obra_capa.fonte` livre com página obrigatória) 🧪
- [x] T29.2 Coleta por agentes (`dados/coleta/imagens/PROTOCOLO.md`): capas em lojas/editoras, fotos em Wikipédias (inclusive não livres), sites de prêmios, editoras e perfis
- [x] T29.3 `coleta.py imagens` junta as coletas; build exporta; crédito em perfil, galeria e páginas estáticas 🧪👁
- [ ] T29.4 Segunda passada de imagens: +56 fotos e +19 capas em 21/10/2026; filas recalculadas (vencedores primeiro, até 3 livros distintos por pessoa). Restam 842 pessoas-autoras sem foto e 392 obras sem capa. Goodreads interrompido ao primeiro WAF (202); dez capas da Patuá recusadas por MIME incorreto. Nova coleta necessária para esgotar as filas.

## T30 Edição 2026 do Jabuti (nov/2026, CA-25.1)
- [x] T30.1 Listas 2026 (61 semifinalistas, 30 finalistas, 6 vencedores e o Livro do Ano) do site oficial, conferidas título a título contra o PublishNews; júri das seis categorias (página `jurados-2026`). Romance Literário com 11 semifinalistas nas duas fontes (provável empate). Regime renomeado para "2019–2026 vencedor único" 🧪
- [x] T30.2 Créditos: Daniel Kondo e Du Andrade passam a ilustradores (fonte em `observacao`); ilustradores de Infantil/Juvenil pela Martins Fontes; grafias corrigidas com o original em `observacao` (Ingrid Hass, Cláudio Moreno, Fernando A. Pires)
- [x] T30.3 Pessoas novas pelo protocolo (`pessoas_2026_3..5.csv`, 3 agentes, ~105 buscas): 39 pessoas, gênero com fonte em 29, 9 atribuídos (`pessoas_zgenero_7.csv`), 1 autodeclaração (Amanda Lobos, ilustradora; trecho em inglês, conferir). Unificados: Alcir Pécora → `antonio-alcir-bernardez-pecora`, José Henrique de Freitas Santos → `henrique-freitas`; casamentos entre prêmios de DJ Dolores, Contardo Calligaris, Edson Cruz e Abáz. 19 editoras novas (8 com sede; Arquipélago, Elo e Palavras unificadas por `canonico`). Texto de contexto (`contexto/lote_11.csv`)
- [ ] T30.4 Prêmio São Paulo 2026: rascunho em `dados/coleta/sao-paulo/rascunho_2026/` (finalistas e júri); integrar depois dos vencedores (15/12/2026). Oceanos 2026 também pendente

## T31 LeYa, Saramago, ABL e Camões; conjunto da obra (nov/2026, CA-26.19 a CA-26.22, RF-30, D36)
- [x] T31.1 Spec, design e schema: categoria `Conjunto da obra`, tabela `distincao`, `edicao.obras`, view `v_distincao`; checagens no build (distinção × vagas, sem livro na categoria) 🧪
- [x] T31.2 `normalizar` lê `homenageados.csv` e a coluna `obras` de `edicoes.csv`; build exporta `distincoes` e `premios_distincao` à parte e uma parte por prêmio só de distinção 🧪
- [x] T31.3 Painel: janela Conjunto da obra (`metricas.distincoes`), perfil de pessoa e de edição, busca, Método, abertura, Diadorim (`v_distincao`), páginas estáticas de pessoa; `metricas.nomeCurto` 🧪👁
- [x] T31.4 Coleta por agentes (`dados/coleta/{leya,saramago,abl,camoes}/LEIA.md`): LeYa 14 edições (vencedores e finalistas identificados, lista parcial), Saramago 13 (só vencedores; inéditos em 2022 e 2024), ABL 18 edições de prêmios por livro e Machado de Assis 1941–2026 (82), Camões 1989–2026 (38) com júri em todos os anos 🧪
- [x] T31.5 Pessoas novas (181) por API da pt.wikipedia/Wikidata, sem busca web (`pessoas_premios_1..4.csv`); 11 com gênero atribuído (`pessoas_zgenero_8.csv`); casamentos entre prêmios decididos em `<premio>/casamentos.csv`
- [x] T31.6 Busca de raça do protocolo para as 181 pessoas novas (`pessoas_raca_premios_1..4.csv`, 160 buscas): 160 completas, 21 parciais (teto), 1 autodeclaração (Paulina Chiziane, negra; trecho conferido no Observador); 4 casos em `revisao_raca.csv` (Edison Carneiro, Gilka Machado, José Craveirinha, Odete Semedo)
- [x] T31.7 Textos de contexto (RF-28) das 45 edições com livro (LeYa 14, Saramago 13, ABL 18; `contexto/lote_12.csv`, `lote_13.csv`), 10 marcados para revisão
- [ ] T31.8 Pendências nos LEIA: Machado de Assis 1944 e 1960 (REVISAR), Scliar na Poesia ABL 2000, Clair de Mattos, "Maria José Gomes Santos" (júri Saramago 2001), Isabel Lucas (local de nascimento), finalistas LeYa com título mudado na publicação

## T32 Portal e módulos, etapa 0 (nov/2026, RF-31, D37)
- [x] T32.0 Spec RF-31 a RF-34 e decisões DB-1 a DB-7 (fechadas em 2026-11-20); design D37 a D40
- [x] T32.1 `git mv web/index.html web/premios.html`; testes, `seo.py` (`NAV`, links "abrir no painel"), `metodo.html`, sitemap e `llms.txt` apontando para `premios.html`; mesmos números (CA-31.1) 🧪
- [x] T32.2 Portal `index.html`: script `rotas-antigas` e `test_rotas_antigas_redirecionam`; cartões com números do build (`build:portal`) (CA-31.2, CA-31.3) 🧪👁
- [x] T32.3 Cabeçalho com os módulos em todas as páginas, segunda linha com as seções do módulo; `test_cabecalho_igual_em_todas_as_paginas` (CA-31.4) 🧪👁
- [x] T32.4 Textos de plataforma (DB-1): título e descrição do portal, README, `llms.txt`, `og.png`; `FIXAM_UM_PREMIO` ampliado (CA-31.6) 🧪
- [x] T32.5 Diadorim por módulo: `data-modulo`, `contexto-<módulo>.json` (tabelas, views e prompt), `banco.js` carregando só o módulo (CA-31.7) 🧪
- [x] T32.6 `busca.json` e busca em todas as páginas (CA-31.5) 🧪👁
- [x] T32.7 Conferência no navegador (portal, links antigos, prêmios igual a antes) e axe-core 👁

## T33 Território (nov/2026, RF-32, D38)
- [x] T33.1 `coleta.py territorio` → `dados/territorio.csv`; tabela, checagens e conferência com `uf` (CA-32.1, CA-32.2) 🧪
- [x] T33.2 `v_pessoa_municipio`, `v_editora_municipio`, `dados/municipio_casamento.csv`; resolver os avisos de nome sem código (CA-32.3) 🧪
- [x] T33.3 Malha municipal por UF (`coleta.py malha`, `web/malha/<UF>.json`) (CA-32.5) 🧪
- [x] T33.4 Município no perfil de pessoa liga ao perfil de município (vai com T34.8; o código sai de `pessoa-municipio.json`, carregado só no perfil, porque o `dados.json` já tem 992 KB) 🧪👁

## T34 Módulo Leitura (nov/2026, RF-33, D39)
- [x] T34.1 Schema `indicador`, `recorte`, `indicador_valor`, `v_indicador`; checagens do build (CA-33.1 a CA-33.3) 🧪
- [x] T34.2 Coleta `alfabetizacao` (Censo 2022, SIDRA) 🧪
- [x] T34.3 Coleta `escolas_biblioteca` (Censo Escolar, últimos 10 anos) 🧪
- [x] T34.4 Coleta `livrarias_cnpj` e `editoras_cnpj` (Receita, de-para de municípios) 🧪
- [x] T34.5 Coleta `leitores` e `livros_por_ano` (Retratos da Leitura, edições publicadas) 🧪
- [x] T34.6 `leitura.json`, `leitura/<UF>.json`, `metricas.expandirLeitura` e paridade (CA-33.5, CA-31.8) 🧪
- [x] T34.7 `leitura.html`: mapa UF/município, série, recortes, URL, tabela e exportação (CA-33.6, CA-33.7) 🧪👁
- [x] T34.8 Perfil de município e bloco de leitura nos perfis de UF e região (CA-32.4) 👁
- [x] T34.9 Páginas estáticas `/leitura/`, bloco nas páginas de UF, dados abertos, Método "Leitura" (CA-33.8) 🧪👁
- [x] T34.10 Diadorim do módulo Leitura; perguntas de conferência com número igual ao SQL de referência 🧪

## T39 Leitura, segunda leva e panorama (nov/2026, CA-33.9, CA-33.10)
- [x] T39.1 Schema: `indicador.tema`, unidades `moeda` e `pontuacao`, dimensão `canal`, `indicador_valor.observacao`; amostral sem amostra só com o motivo (CA-33.1) 🧪
- [x] T39.2 `coleta.py leitura arquivo <fonte>` (protocolo `dados/coleta/leitura/PROTOCOLO.md`) e `coleta.py leitura pnad` (SIDRA 7113 e 7125; margem de 95% pelo CV)
- [x] T39.3 Transcrições por agentes: INAF 2001–2024, SAEB 2011–2021 por UF e rede, PISA 2000–2025, Produção e Vendas 2006–2025, Painel do Varejo 2014–2025, SNBP 2025–2026 por município, MUNIC (biblioteca pública e livraria) 2001–2021 por UF 🧪
- [x] T39.4 Panorama por tema em `leitura.html`, seletor de tema, indicador nacional sem mapa, moeda e pontuação na formatação (CA-33.10) 👁
- [ ] T39.5 SAEB pela planilha oficial do INEP (`download.inep.gov.br` fora do ar na coleta; a série veio do espelho da Base dos Dados), com 2023, 2025, municípios e alunos avaliados; amostras do PISA 2000–2009
- [ ] T39.6 Conferência humana: rótulos de gráfico do INAF 2024 (pp. 25–32); nota de país da OCDE sobre a amostra do PISA 2025; queda de municípios com biblioteca pública na MUNIC (97,1% em 2014 → 87,7% em 2018) e o salto de livrarias em 2001; total de exemplares vendidos de 2016 diferente da soma mercado + governo na fonte

## T35 Módulo Mapeamento, Florianópolis (nov/2026, RF-34, D40)
- [x] T35.1 Schema `livraria`, `clube`, `obra_mapeada`, `editora_mapeada`, `pessoa_atuacao`, `mapeamento_autoria`, `v_vinculo`; checagens de fonte, data e privacidade (CA-34.2, CA-34.8) 🧪
- [x] T35.2 `normalizar` lê `dados/coleta/mapeamento/<código>/` depois dos prêmios, com `remocoes.csv`; `test_mapeamento_nao_muda_premios` (CA-34.1) 🧪
- [x] T35.3 Protocolo `dados/coleta/mapeamento/4205407/LEIA.md` (definições, fontes, privacidade)
- [x] T35.4 Editoras e livrarias: `coleta.py mapeamento candidatas` (CNPJ + OSM), conferência, `livraria.csv` e `editoras.csv` (CA-34.4, CA-34.5)
- [x] T35.5 Autoras, autores e obras: vínculo de atuação com fonte, obras verificáveis, pessoas pelo protocolo (`pessoas_floripa_N.csv`) (CA-34.6, CA-34.7)
- [x] T35.6 Clubes do livro, com as regras de privacidade (CA-34.8)
- [x] T35.7 `mapeamento/4205407.json`, `metricas.resumoMapeamento`; `mapeamento.html` com mapa, listas e perfis; bloco "Em Florianópolis" no `premios.html` (CA-34.9, CA-34.10) 🧪👁
- [~] T35.8 Formulário (Netlify Forms) e página de agradecimento (feitos e conferidos no navegador). Detecção de formulários ligada em 21/11/2026, e o Netlify já registrou o formulário `mapeamento` (7 campos, com honeypot). Aviso por e-mail a cada envio ativado em Forms → Submission notifications, para o e-mail da conta, com o assunto "Literadados: novo pedido no mapeamento". Falta um envio de teste no site publicado (CA-34.11) 👁
- [x] T35.9 Páginas estáticas do mapeamento, páginas de pessoa com vínculo, dados abertos (CA-34.12) 🧪
- [x] T35.10 Diadorim do módulo Mapeamento 🧪

## T36 Pendências de conferência humana do mapeamento e da leitura (nov/2026)
- [x] T36.1 (21/11/2026) Livros & Livros aberta (Divulga UFSC, ago/2026); Paulus aberta (ponto de retirada ativo na loja on-line, Jerônimo Coelho, 119); Saraiva do Villa Romana fechou até jun/2023 (descartada em `candidatas.csv`); Sebo Mafalda é o nº 78; `candidatas.csv` ganhou a coluna `decisao` (17 entrou, 25 descartadas, 36 a conferir). Era: Florianópolis, livrarias: Livros & Livros (CCE/UFSC) e Paulus seguem abertas? Saraiva do Villa Romana fechou? Sebo Mafalda: número da loja; 74 candidatas em `dados/coleta/mapeamento/4205407/candidatas.csv`
- [x] T36.2 (21/11/2026) Asinha é selo da Ases da Literatura (mesmo CNPJ); sede em Florianópolis confirmada para Arquétipos, NilaPress e Pandion; Draft e Traços & Capturas saíram (só CNPJ; voltaram para `candidatas.csv`). Era: Florianópolis, editoras: Asinha como selo da Ases da Literatura ou editora à parte; sede só pelo CNPJ (Arquétipos, Draft, Pandion, NilaPress, Traços & Capturas)
- [x] T36.3 (21/11/2026) Vínculos de atuação dos cinco confirmados (pt.wikipedia, trecho literal); Cruz e Sousa e Antonieta de Barros: raça `negra` por fonte curada (página de autor do Literafro, via arquivo.pt); Ildefonso Juvenal e Trajano Margarida seguem REVISAR (só descrições de terceiros); Michelli Provensi é uma pessoa só, sem vínculo com a cidade. Era: Florianópolis, pessoas: Franklin Cascaes (nasceu em Itaguaçu, então São José, hoje Florianópolis continental); vínculos de atuação de figuras históricas (Péricles Prade, Crispim Mira, Horácio Nunes Pires, Nicolau Nagib Nahas, Victor Márcio Konder); raça de Cruz e Sousa, Antonieta de Barros, Ildefonso Juvenal e Trajano Margarida (descrições de terceiros, REVISAR; conferir o Literafro quando voltar); ficha de Michelli Provensi pode misturar duas pessoas
- [x] T36.4 (21/11/2026) Trilogia da Terra e Entre Páginas e Sinal saíram (ciclos de 2 encontros, não recorrentes; descartadas em `candidatas.csv`); Leia Mulheres Floripa ativo (nov/2026); local do Lygia Bojunga diverge nas fontes. Era: Florianópolis, clubes: "Trilogia da Terra" e "Entre Páginas e Sinal" contam como encontros recorrentes? Página do clube Lygia Bojunga (FCC) a conferir; Leia Mulheres Floripa
- [x] T36.5 Retratos da Leitura: leituras de gráfico conferidas página a página em 21/11/2026 (2015 pp. 56 e 64, 2007 p. 40, 2011 p. 64, 2019 pp. 22, 23 e 28, 2024 pp. 18 e 19, amostras e margens); nenhum valor mudou. Na p. 64 de 2015 a tabela diverge do gráfico em 5–10 e 18–24, e fica o gráfico (resultado em `dados/coleta/leitura/LEIA.md`)
- [x] T36.6 `São Estêvão (BA)` = Santo Estêvão (2928802): o IBGE não tem "São Estêvão" na BA. A Tribuna do Sertão (Estadão Conteúdo, 12/6/2026) diz "natural de São Estevão, no Recôncavo", e A Tarde (5/7/2026) diz "criado na zona rural de Santo Estevão" (Fabrício Oliveira)

## T37 Módulo Eventos literários (nov/2026, RF-35, D41)
- [x] T37.0 Spec RF-35 (decisões DB-8 a DB-10), design D41, protocolo `dados/coleta/eventos/LEIA.md`
- [x] T37.1 Schema `evento`, `evento_edicao`, `evento_homenageado`, `v_evento_edicao`; checagens de data, situação e público (CA-35.1 a CA-35.3) 🧪
- [x] T37.2 Coleta por agentes (Sudeste/Sul; Norte/Nordeste/Centro-Oeste) e `coleta.py eventos` 🧪
- [x] T37.3 `eventos.json`, funções puras e testes (CA-35.6) 🧪
- [x] T37.4 `eventos.html`: próximos, calendário, mapa por UF, filtros na URL, tabela, perfil de evento (CA-35.4 a CA-35.6) 👁
- [x] T37.5 Eventos no perfil de município e no mapeamento da cidade (CA-35.7) 👁
- [x] T37.6 Páginas estáticas, busca, portal, cabeçalho, dados abertos, Diadorim (CA-35.8, CA-35.9) 🧪
- [ ] T36.9 Decisões do mantenedor (21/11/2026): (a) nascimento em local que mudou de município: usar o município atual (Franklin Cascaes → Florianópolis, coerente com o código do IBGE de hoje) ou o da época (São José)?; (b) a Saraiva do Villa Romana entra em `livrarias.csv` como encerrada (2023)?; (c) o selo Asinha conta como editora à parte?; (d) clube de ciclo curto (2 ou 3 encontros) entra no mapeamento?; (e) o Lygia Bojunga se reúne na Casa da Literatura Catarinense ou no MIS/CIC?; (f) Sebo Estreito é duplicata do Eureka (mudou para a Heitor Blum) ou uma segunda loja? (@seboeu ou visita); (g) ler a tese da UFSC de Fábio Garcia atrás de autodeclaração de Ildefonso Juvenal
- [ ] T36.7 Clubes do Ponte de Palavras (p. 7 da programação de nov/2026): ~31 perfis que parecem clubes ficaram de fora por falta de nome e município confirmados sem abrir o Instagram (lista no relatório da coleta: clubedolivro_floripa, clubedolivro.floripa, clubedeleitura.esag, clubesereno, clubedolivrotheblackcat, paginas_da_ilha, leitura_sambaqui, entre outros); @cicfloripa pode ser o clube Lygia Bojunga; os 4 projetos de perfil pessoal (Bordando Escritores, Entre Páginas e Amigas, Tecendo Palavras, Através do Livro) podem ser da Grande Florianópolis

- [~] T36.8 (21/11/2026: Império = duas lojas; Árvore do Saber é CNPJ do Centro Holístico Luzes da Esperança; as 6 "incerta" e as 7 sem coordenada seguem iguais, sem sinal novo) Florianópolis, 3ª passada (nov/2026: +26 livrarias e sebos, +4 clubes): Sebo Eureka × Sebo Estreito (mesmo endereço na Heitor Blum, 411: duas lojas ou duplicata?); Sebo's Império matriz e filial como duas lojas; Árvore do Saber (CNPJ de associação: sebo de projeto social?); 6 livrarias "incerta" só com o guia da Touché (Nobel Floripa Shopping, Mangrich, Nova Era, Vivendo Evangelho, Mania de Ler, Guga); 7 lojas sem coordenada (Nominatim só acha a rua); tirar de `candidatas.csv` as que já entraram; Instagram a conferir: @seboivete, @sebosimperio, @seboacervodasletras, @sebobagagemcultural, @leiturafloripa, @snsbookclub

## T38 Pendências de conferência humana dos eventos (nov/2026)
- [x] T38.1 Datas achadas e acrescentadas em 21/11/2026: Flitabira 2026, Flipetrópolis 2024, Flup 2023, Fórum das Letras 2017–2018, Flinc 2025 (em Vila Velha), Porto Alegre 2015–2021, Bienal de SP 2016, Pan-Amazônica 2015/2017/2018, Bienal PE 2021, Flipelô 2022, FliParaíba 2025, Felib 2025, Bienal Bahia 2022, mais A Feira do Livro 2022–2024, Flin 2025, Bienal de Alagoas 2015/2017 e Festival da Palavra 2025. Ficam sem dia exato (fora): Jornada de Passo Fundo 2020/2027, Salipi 2013–2023, Pan-Amazônica 2016, Bienal PE 2017, Fliporto 2015–2019 e Flipelô 2020–2021
- [x] T38.2 FLIP 2020 sem homenageada (a homenagem a Bishop foi encerrada com a saída da curadora; edição virtual "sem homenagem e sem curador"); Bienal de Alagoas 2023 = 10ª; Flipipa coerente; FIL 2026 começa em 29/08; Fligê 2025 começa em 13/08; datas de "N dias" e de anúncio confirmadas (Flima 2025, Flim 2024, Paracatu, Porto Alegre 2025, Sesc PR, Flap, FeliS, Flicoop, Flipomerode 2024)
- [x] T38.3 Organizadores conferidos (Ponte de Palavras, Flinc, Tarrafa, Festival da Palavra, A Feira do Livro, Bienal Pantanal, Flimac, Flipipa, Bienal de Itabaiana); sem organizador nas fontes: Flima, Fligê, SaLiPa e Feira Literária Capixaba; Flicoop em Natal; Fliporto 2025–2026 em Recife; Flap = "1ª Festa Literária do Paraná" (sem duplicata)
- [x] T38.4 Lote 4: Bienal Rubem Braga, Festa Internacional da Palavra (Itaúnas), FLII (Vitória), Literalta (Vargem Alta), Lombada (PUCPR), Elos da Língua e Flup Pernambuco. RO e MT: nenhum evento no recorte; Bienal do Paraná 2025 e 2026 canceladas; Festival da Mantiqueira só até 2011
- [x] T38.5 SC: a edição de 2023 da Feira do Livro de Florianópolis virou evento à parte (Semana Municipal do Livro, Secretaria de Educação); Chapecó 2026 saiu (sem confirmação); Flipomerode 2024 confirmada; Joinville com 85 mil em 2025 e ano de início 2004 (11ª em 2014; NSC: "criada em abril de 2004"); Itajaí 2023 (6ª) acrescentada; Bienal Bahia sem o "90 mil" de 2022 (não tem fonte)
- [ ] T38.6 Decisões do mantenedor: (a) Fliporto 2024 = "13ª" (Folha PE) ou 19ª pela sequência da 21ª em 2026; sede do evento passa de Olinda para Recife? (b) Joinville: confirmar início em 2004 (o ND não diz "desde 2003"); (c) Florianópolis jun/2026 (Largo da Alfândega) é da CCL?; (d) edições com data só de anúncio e sem confirmação de que aconteceram (Lages 2018, Flipoços 2024 e 2026, Quindim 2026, Novo Hamburgo 2026, Bahia 2024, FLIM 2025, Flimac dez/2024, FLIB 2026, Felib 2025, Lombada 2025 e 2026, FLII 2026, Pan-Amazônica 2018): ficam como realizadas com nota ou saem?; (e) Flitabira: a "8ª edição" está anunciada para 27 a 31/10 sem ano, e só entra quando o ano for publicado

## T40 Fundo animado dos módulos (nov/2026, CA-31.12, D43)
- [x] T40.1 Curadoria de fotos livres do Commons por módulo em `dados/coleta/fundo/imagens.csv`
- [x] T40.2 `seo._fundo_modulos` + CSS + sorteio nas páginas de Leitura, Mapeamento e Eventos 👁
