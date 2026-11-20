# Prêmio São Paulo de Literatura 2026 (rascunho)

Fora do build de propósito: o `normalizar` só lê `dados/coleta/sao-paulo/lista_*.csv`, e esta pasta fica de fora. Só entra edição com o resultado final (vencedores em 15/12/2026, na Biblioteca Parque Villa-Lobos).

- `lista_2026.csv`: os 20 finalistas (10 em Melhor Romance do Ano, 10 em Melhor Romance de Estreia; livros de 2025), da página oficial `premiacao/finalistas` (19/11/2026), conferidos contra a notícia oficial de finalistas. Falta a segunda fonte independente (PublishNews) e a coluna `colocacao`.
- `jurados_2026.csv`: o júri de 10 da página `curadoria/juri`. A curadoria de 5 que escolhe os vencedores não estava publicada.

Para integrar: preencher `colocacao = 1` dos dois vencedores, mover os dois CSVs para `../`, acrescentar 2026 em `../edicoes.csv` e `../categorias_edicao.csv` (renomear o regime para "2019–2026 …"), rodar `coleta.py normalizar` e pesquisar as pessoas novas pelo `../../PROTOCOLO_PESSOAS.md`.
