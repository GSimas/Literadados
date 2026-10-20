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
