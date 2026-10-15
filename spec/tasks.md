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
- [ ] P3 Conferir o chat com credencial real e as três perguntas originais
- [~] P4 Pessoas das 14 edições novas (690, em `pessoas_edicoes_1.csv`): Wikidata/Wikipédia por lote SPARQL (338 QIDs), Literafro (22 fonte curada) e protocolo de raça para 120 autores recentes. Gênero em 357, UF em 292, raça declarada em 29. **Faltam: busca de raça em 549 (`parcial`) e gênero/nascimento das demais, em lotes de ~120 por turno** (fila em ordem de prioridade: autores, edição mais recente). **Lote 1** (`pessoas_edicoes_2.csv`, 80 primeiros da fila, autores 2025–2024, protocolo em `dados/coleta/PROTOCOLO_PESSOAS.md`): só busca web (ambiente na nuvem sem Wikipédia/Wikidata), 147 buscas; +16 gênero, +16 UF, 1 busca de raça concluída, 0 autodeclarações. Autores: gênero 63%, UF 52%. **Lote 2** (`pessoas_edicoes_3.csv`, ordem 81–160, autores 2023–2021, 138 buscas): +16 gênero, +9 UF, 62 buscas de raça concluídas, 1 autodeclaração (Lindamir Salete Casagrande, branca; conferir com `coleta.py verificar`). Autores: gênero 65%, UF 53%, busca de raça completa 44%. **Lote 3** (`pessoas_edicoes_4.csv`, ordem 161–240, autores 2021–2020, 145 buscas): +14 gênero, +4 UF, 78 buscas de raça concluídas, 0 autodeclarações. Autores: gênero 67%, UF 54%, busca de raça completa 54%. **Lote 4** (`pessoas_edicoes_5.csv`, ordem 241–320, autores 2020–2019, 145 buscas): +21 gênero, +14 UF, 78 buscas de raça concluídas, 0 autodeclarações. Autores: gênero 70%, UF 56%, busca de raça completa 65%. **Lote 5** (`pessoas_edicoes_6.csv`, ordem 321–400, autores 2019–2016, 150 buscas): +16 gênero, +6 UF, 73 buscas de raça concluídas, 0 autodeclarações. Autores: gênero 72%, UF 56%, busca de raça completa 75%. **Lote 6** (`pessoas_edicoes_7.csv`, ordem 401–480, autores 2016–2013, 142 buscas): +11 gênero, +7 UF, 75 buscas de raça concluídas, 0 autodeclarações. Autores: gênero 73%, UF 57%, busca de raça completa 84%. Duplicata achada: `deborah-kietzmann-goldemberg` = `deborah-goldemberg` (unificar). **Lote 7** (`pessoas_edicoes_8.csv`, ordem 481–580, autores 2013–2010, 165 buscas): +16 gênero, +12 UF, 99 buscas de raça concluídas, 0 autodeclarações. **Fila esgotada.** Autores: gênero 75%, UF 59%, busca de raça completa 98% (18 `parcial`, em geral por recusa da ferramenta de busca). Pendências: gênero/UF dos que a busca web não achou (rodar com API da Wikipédia), casos "REVISAR" de raça. **Passada de créditos (out/2026):** 11 ilustradores/fotógrafa movidos de `autores` para `ilustradores` nas listas, com fonte em `observacao`; Deborah Kietzmann Goldemberg unificada em `deborah-goldemberg`. Ficam para decisão: organizadores listados como autores (Poesia reunida 2025, Caixa Rubem Braga 2017, Poesia Reunida – Euclides da Cunha 2010, De bala em prosa 2021); créditos sem confirmação (Rosinha 2021, Adilson Farias, Marlene Peret, Angela Lago em Bichos, Shirley Souza, Manoel Constantino)
- [ ] P5 Jurados de 2018 (nenhuma fonte achada: nem página oficial arquivada, nem imprensa; tentar catálogo/regulamento 2018 ou a CBL)
- [ ] P6 Ilustradores de Infantil/Juvenil 2010–2025: só 12 registrados (+11 na passada de créditos de out/2026, movidos de autores com fonte); ~250 linhas marcadas "ilustrador não verificado/levantado" em `observacao`
- [x] P8 `dados.json` abaixo de 1 MB (RNF-06, D13): participação compacta e `metricas.expandir` no navegador 🧪👁
- [x] P9 Organizadores fora das contagens (CA-01.5, D14): coluna `organizadores` nas listas, 13 organizadores movidos e Euclides da Cunha incluído como autor de *Poesia Reunida* (2010) 🧪👁. Saíram das contagens 14 pessoas que só organizaram (pessoas-autoras 741 → 728; indicações com autor 929 → 923, porque 6 antologias não listam autores). O piso de negros caiu de 26 para 24 (Esmeralda Ribeiro e Márcio Barbosa, organizadores de *Cadernos Negros*), e Kaká Werá (indígena) saiu. Ficaram como autores: os 3 curadores de *De bala em prosa* (CBL credita os 31 nomes como autores) e *Pretos em contos 2* (sem fonte de que sejam só organizadores)
- [ ] P7 Editoras novas: 273 editoras, só 77 com sede/grupo (as do piloto); levantar as demais em `editoras_enriquecidas.csv`
