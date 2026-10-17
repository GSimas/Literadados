# Protocolo de coleta — Prêmio Sesc de Literatura (CA-26.18)

Uma pasta, um arquivo por edição: `lista_AAAA.csv` (e `jurados_AAAA.csv` quando a comissão julgadora estiver publicada).
Escreva com o módulo `csv` do Python. Não edite nenhum outro arquivo do projeto.

O prêmio julga **originais inéditos** de autores estreantes no gênero, inscritos com pseudônimo. O vencedor é publicado
depois (Record de 2004 a 2023; Editora Senac Rio desde 2024). Só os vencedores têm nome público: os finalistas de 2012–2013
saíram com pseudônimo e **não** entram.

## `lista_AAAA.csv`
```
ano,nome_original,categoria,titulo,autores,ilustradores,organizadores,editora,editora_pais,lista_curta,colocacao,fonte_1,fonte_2,observacao
```
- `ano`: o ano em que o resultado foi anunciado (a edição "2010/2011" do site antigo é a de 2011, se o resultado saiu em 2011 — confira na fonte e anote a numeração do Sesc, ex.: "8ª edição").
- Edições 2004–2025 (a de 2026 fica fora por enquanto).
- `nome_original` / `categoria`: `Romance` / `Romance`; `Conto` / `Contos` (desde 2006; confirme o 1º ano); `Poesia` / `Poesia` (desde 2024).
- `titulo`: o título do livro publicado (se mudou do original inscrito, anote o título do original em `observacao`).
- `autores`: nome como publicado; vários separados por ` | `.
- `editora`: **vazia** (o prêmio julga o original); a editora e o ano de publicação do livro vão em `observacao` ("publicado pela Record em 2005").
- `editora_pais`: vazio. `lista_curta`: vazio. `colocacao`: `1` (menção honrosa não entra como linha; anote em `observacao` do vencedor).
- Vencedor impugnado ou substituído (ex.: Poesia 2024: Igor Sarapuí impugnado, vencedor passou a ser Antonio Veloso Maia): entra só o vencedor final, com a história em `observacao`.
- `fonte_1`, `fonte_2`: duas fontes independentes que você abriu (site do Sesc e Wayback de `sesc.com.br/premiosesc/vencedores*.html`; pt.wikipedia "Prêmio Sesc de Literatura"; PublishNews `/etiquetas/premio-sesc-de-literatura`; Folha, O Globo, G1; página do livro na Record).

## `jurados_AAAA.csv` (quando houver)
```
ano,nome_original,nome,fonte,observacao
```
Comissão julgadora final (e, se a fonte separar, a de cada categoria). Não invente a categoria: se a comissão é comum, repita o nome em cada `nome_original` e diga em `observacao`.

## Armadilhas
- Conferir o ano na própria fonte. PublishNews e imprensa respondem a curl; a Wikipédia já errou grafias (*Outono de carne estranha*, não "Outro outono").
- Pessoa já na base com outra grafia: use a grafia de `dados/pessoa.csv` e anote a da fonte.
