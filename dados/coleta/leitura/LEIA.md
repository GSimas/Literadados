# Retratos da Leitura

`retratos.csv`: números da pesquisa *Retratos da Leitura no Brasil* (Instituto Pró-Livro, IPL), transcritos à mão das PDFs oficiais em 2026-11-20. Dois indicadores:

- `leitores`: % de leitores na população de 5 anos ou mais. Leitor = leu, inteiro ou em partes, pelo menos 1 livro nos últimos 3 meses (definição mantida desde 2007; em 2007 o texto diz só "ter lido pelo menos 1 livro nos últimos 3 meses").
- `livros_por_ano`: média de livros lidos nos últimos 12 meses (inteiros + em partes) por habitante de 5 anos ou mais. Em 2007 a pergunta não separava inteiros e em partes (mudou em 2011); em 2015 mudou o conceito de "livro lido em partes".

`fonte_url` aponta para a página do PDF (`#page=N` = página do arquivo). Valores de gráfico foram lidos dos rótulos numéricos no texto do PDF; quando a ordem do texto era ambígua, a posição do rótulo na página (pdfminer) decidiu a categoria. `margem` só na linha `BR,leitores,total,total` (a margem declarada é para proporções; não vale para média de livros).

## Edições usadas

| Ano de campo | Edição | PDF | Amostra | Margem (95%) |
|---|---|---|---|---|
| 2007 (29/11–14/12) | 2ª | `2020/07/APRESENTACAO_RETRATOS_DA_LEITURA_NO_BRASIL_28MAIO.pdf` (apresentação de 28/5/2008) | 5.012 | 1,4% (p. 15) |
| 2011 (11/6–3/7) | 3ª | `2020/07/3_ed_pesquisa_retratos_leitura_IPL.pdf` | 5.012 | 1,4 (p. 20) |
| 2015 (23/11–14/12) | 4ª | `2020/07/Pesquisa_Retratos_da_Leitura_no_Brasil_-_2015.pdf` | 5.012 | não declarada na apresentação |
| 2019 (out/2019–jan/2020) | 5ª | `2020/12/5a_edicao_Retratos_da_Leitura-_IPL_dez2020-compactado.pdf` | 8.076 | 1,1 p.p. (p. 13) |
| 2024 (30/4–31/7) | 6ª | `2024/11/Apresentação_Retratos_da_Leitura_2024_13-11_SITE.pdf` | 5.504 | 1 p.p. (p. 10) |

Todos em `https://www.prolivro.org.br/wp-content/uploads/`. O nome do PDF de 2024 só responde com o "ç"/"ã" decompostos (NFD): `Apresentac%CC%A7a%CC%83o_...`.

## Páginas

- 2024: leitores total p. 15; escolaridade p. 18; sexo e idade p. 19; regiões p. 22 (tabela 2007–2024). Livros/ano: total p. 30; sexo e regiões p. 32; escolaridade e idade p. 33. As pp. 30–33 também trazem 2019 e 2015 (sexo), usados quando mais precisos que a edição original.
- 2019: total p. 20; sexo e idade p. 22; cor ou raça p. 23 (só Branca, Preta, Parda); escolaridade p. 24; regiões p. 28. Livros/ano 2019 vêm da apresentação de 2024 (duas casas; a 5ª edição, p. 41, dá uma casa).
- 2015: total p. 55; sexo e idade p. 56 (gráfico); escolaridade p. 65; regiões p. 67. Livros/ano: total e regiões p. 68; escolaridade p. 69; sexo da apresentação de 2024 (a 4ª edição não publica).
- 2011: total p. 61; sexo p. 62; idade p. 63; escolaridade p. 64; regiões p. 68. Livros/ano: total, sexo, idade e regiões p. 71 (com coluna 2007); escolaridade p. 72.
- 2007: total p. 35; escolaridade p. 40; idade p. 42 (faixas 50-59 e 60-69); regiões p. 37. Livros/ano: total p. 102; sexo p. 103; idade p. 105; escolaridade p. 106; regiões da coluna 2007 da tabela da 3ª edição (p. 71), porque o gráfico da p. 104 não traz o nome da região no texto.

Escolaridade: "Fundamental I / Até 4ª série" → `ate_fundamental_1`, "Fundamental II / 5ª a 8ª" → `fundamental_2`, "Ensino Médio" → `medio`, "Superior" → `superior`. Só 2011 publica "Não alfabetizado formal" à parte (3% de leitores), que não entrou; nas outras edições os não alfabetizados não aparecem como categoria.

## O que ficou de fora

- 1ª edição (campo 2000, lançada em 2001): universo de 14 anos ou mais com pelo menos 3 anos de escolaridade (49% da população), sem a definição de leitor por 3 meses ("leitor corrente" = lendo no dia da entrevista). Não é comparável.
- Cor ou raça: só a 5ª edição (2019) publica, e só Branca, Preta e Parda, para `leitores`. Nenhuma edição publica livros/ano por cor ou raça.
- 2007, `leitores` por sexo: a apresentação só dá a composição dos leitores ("55% são mulheres"), não o % de leitores entre homens e mulheres.
- `livros_por_ano` por idade em 2015: não publicado.
- Livros lidos nos últimos 3 meses (todas as edições): fora, por definição.
- Capitais e UFs: fora do escopo desta coleta.
