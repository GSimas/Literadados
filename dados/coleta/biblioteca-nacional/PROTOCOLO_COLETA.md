# Protocolo de coleta — Prêmio Literário Biblioteca Nacional (CA-26.17)

Uma pasta, um arquivo por edição: `lista_AAAA.csv` (e `jurados_AAAA.csv` quando a comissão julgadora estiver publicada).
Escreva com o módulo `csv` do Python. Não edite nenhum outro arquivo do projeto.

## `lista_AAAA.csv`

Cabeçalho exato:
```
ano,nome_original,categoria,titulo,autores,ilustradores,organizadores,editora,editora_pais,lista_curta,colocacao,fonte_1,fonte_2,observacao
```
- `ano`: o ano da edição como a FBN o nomeia ("Prêmio Literário 2015"). Se a fonte só der o ano da cerimônia, confira a qual edição corresponde.
- Só os prêmios do recorte, com estes `nome_original` e `categoria`:
  | `nome_original` | `categoria` | Anos |
  |---|---|---|
  | Prêmio Machado de Assis | `Romance` (`Prosa` em 1999–2002, quando cobria romance e conto — confirme na fonte e anote) | 1995– |
  | Prêmio Artur Azevedo | `Contos` | 1995–1998 |
  | Prêmio Clarice Lispector | `Contos` | 2005– |
  | Prêmio Alphonsus de Guimaraens | `Poesia` | 1995– |
  | Prêmio Glória Pondé | `Infantil e Juvenil` (2007–2011, quando era "infantil e juvenil"); `Juvenil` (2012–) | 2007– |
  | Prêmio Sylvia Orthof | `Infantil` | 2012– |
  | Prêmio Fundação Biblioteca Nacional | `Livro do Ano` | só 2004 |
  Ensaio (Mário de Andrade, Sérgio Buarque de Holanda), tradução (Paulo Rónai), projeto gráfico (Aloísio Magalhães), ilustração (Carybé), quadrinhos (Adolfo Aizen) e tradição oral (Akuli) ficam **fora**. Se um ano tiver um prêmio do recorte com outro nome, anote em `observacao` e use a categoria mais próxima.
- Uma linha por obra. `autores`, `ilustradores`, `organizadores`: nomes separados por ` | ` (barra vertical com espaços). Ilustrador só vai em `ilustradores` quando a fonte separa o crédito ("texto de X, ilustrações de Y"); no infantil, a FBN às vezes premia autor e ilustrador juntos — anote.
- `editora`: a editora da edição premiada, como na fonte (vazia se nenhuma fonte disser). `editora_pais`: `BR`.
- `lista_curta`: vazio. `colocacao`: `1` para vencedor (empate: dois `1`); em 2018 em diante, `1`, `2`, `3`; em 2017, `1` para o vencedor e vazio para os outros dois finalistas.
- `fonte_1` e `fonte_2`: duas fontes **independentes que você abriu**, para a obra e a colocação. Prefira: resultado oficial (gov.br/bn, bn.gov.br/bn.br no Wayback, Diário Oficial, Relatórios de Gestão, Anais da Biblioteca Nacional em memoria.bn.gov.br) + imprensa (Folha, Estadão, O Globo, G1, PublishNews) ou pt.wikipedia (que cita os Anais). Página que não abriu = não vale.
- `observacao`: o que for preciso (grafia corrigida e a original, empate, dúvida de categoria, editora sem fonte).

## `jurados_AAAA.csv` (quando houver)
```
ano,nome_original,nome,fonte,observacao
```
Comissão julgadora de cada prêmio do recorte, como publicada (portaria, resultado). Se a fonte não separar por prêmio, não invente: deixe o ano sem arquivo e anote no relatório.

## Fontes que funcionam (por curl, sem gastar cota)
- pt.wikipedia, uma página por prêmio (`index.php?title=<Título>&action=raw`): "Prêmio Machado de Assis (Fundação Biblioteca Nacional)", "Prêmio Clarice Lispector", "Prêmio Alphonsus de Guimaraens", "Prêmio Glória Pondé", "Prêmio Sylvia Orthof", "Prêmio Literário Biblioteca Nacional" (Artur Azevedo e o prêmio único de 2004). Já baixadas em `/private/tmp/claude-501/-Users-simasgs-Downloads-JabutiDados/859868fe-ecd2-47ba-a532-a28faf10f2d4/scratchpad/bn/w_*.txt`.
- Resultados oficiais: `https://www.gov.br/bn/pt-br/acesso-a-informacao-2/editais/premio-literario/premio-literario-AAAA` (2022–2026; PDFs em pastas às vezes trocadas: os de 2025 estão sob `/premio-literario-2024/`); anos antigos no Wayback (`web.archive.org/cdx/search/cdx?url=bn.gov.br/*premio*` e `bn.br/*`); PDFs com texto saem com `pypdf` (instalado no `.venv` do projeto: `/Users/simasgs/Downloads/JabutiDados/.venv/bin/python`). O resultado de 2017 é imagem (sem OCR disponível): use imprensa.
- Anais da BN: `memoria.bn.gov.br/DocReader/402630/<página>` (as referências da Wikipédia trazem as páginas).
- PublishNews (`/etiquetas/premio-literario-biblioteca-nacional`), Folha (`search.folha.uol.com.br`), Estadão, O Globo, G1.
- Armadilhas: conferir o ano da edição na própria fonte; a lista de "habilitadas" não é lista de finalistas.
