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
- [~] P4 Pessoas das 14 edições novas (690, em `pessoas_edicoes_1.csv`): Wikidata/Wikipédia por lote SPARQL (338 QIDs), Literafro (22 fonte curada) e protocolo de raça para 120 autores recentes. Gênero em 357, UF em 292, raça declarada em 29. **Faltam: busca de raça em 549 (`parcial`) e gênero/nascimento das demais, em lotes de ~120 por turno** (fila em ordem de prioridade: autores, edição mais recente). **Lote 1** (`pessoas_edicoes_2.csv`, 80 primeiros da fila, autores 2025–2024, protocolo em `dados/coleta/PROTOCOLO_PESSOAS.md`): só busca web (ambiente na nuvem sem Wikipédia/Wikidata), 147 buscas; +16 gênero, +16 UF, 1 busca de raça concluída, 0 autodeclarações. Autores: gênero 63%, UF 52%. Próximo lote: ordem 81+ da fila
- [ ] P5 Jurados de 2018 (nenhuma fonte achada: nem página oficial arquivada, nem imprensa; tentar catálogo/regulamento 2018 ou a CBL)
- [ ] P6 Ilustradores de Infantil/Juvenil 2010–2025: só 12 registrados; ~250 linhas marcadas "ilustrador não verificado/levantado" em `observacao`
- [ ] P7 Editoras novas: 273 editoras, só 77 com sede/grupo (as do piloto); levantar as demais em `editoras_enriquecidas.csv`
