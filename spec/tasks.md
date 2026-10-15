# Tarefas — JabutiDados

> Fase SDD 3/3. Cada tarefa aponta o requisito ou critério que entrega. Marque `[x]` só quando o critério estiver verificado: teste verde (🧪) ou conferência no navegador (👁).

## T1 Dados piloto
- [x] T1.1 Estrutura `categoria_edicao` 2010–2025 (RF-01): 111 linhas; tamanhos de lista conferidos de forma independente com as listas de 2016 e 2023
- [x] T1.2 Listas 2016 e 2023 → `indicacao`, `obra`, `autoria`, `editora` (RF-01): 123 indicações, 121 obras
- [x] T1.3 Jurados 2023 (RF-10): 18
- [x] T1.4 Pessoas: QID quando encontrado (RF-01, RF-11). O Wikidata ficou indisponível por limite de taxa; a pesquisa foi feita por busca web
- [~] T1.5 Pessoas: nascimento e raça pelo protocolo (RNF-04). Os 9 trechos de raça foram verificados (8 automaticamente, 1 à mão em PDF). **A busca de raça foi interrompida (`raca_busca = parcial`) para 121 de 153 pessoas: refazer em outro turno**
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
- [ ] P1 Segunda passada de raça e nascimento para as pessoas com `raca_busca = parcial`, em lotes menores por turno
- [ ] P2 Coletar as listas das outras 14 edições, em lotes por regime (2010–2017, 2018, 2019–2025)
- [ ] P3 Conferir o chat com credencial real e as três perguntas originais
