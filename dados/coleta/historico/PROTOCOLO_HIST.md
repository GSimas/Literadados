# Protocolo da coleta histórica do Jabuti (1959–2009) — Literadados

Projeto: /Users/simasgs/Downloads/JabutiDados (leia CLAUDE.md, seção "Regras inegociáveis" e "Aprendizados").
Material nesta pasta (somente leitura, exceto sua saída):
- `premiados_1959_2009.csv` — todos os premiados do site oficial atual (https://www.premiojabuti.com.br/jabuti/premiados-por-edicao/premiacao/?ano=AAAA), todas as categorias. ATENÇÃO: a editora ali é a ATUAL do título, não a da época; não use.
- `p<ANO>.html` — as páginas oficiais baixadas.
- `cbl/<ANO>.html` e `cbl_1959_2008.csv` — páginas "Edições anteriores" do site antigo da CBL (Wayback, 2010), premiados por categoria na ordem da página; URLs em `cbl_urls.txt` (ano, timestamp, url → http://web.archive.org/web/<timestamp>/<url>). Não há 1990.
- `wiki/` — wikitexto da pt.wikipedia: "N.º Prêmio Jabuti" (N=1 é 1959; ano = 1958+N) e listas por categoria. As páginas por edição citam o livro "Prêmio Jabuti 50 anos" (CBL, 2008). Listas numeradas (# A # B # C) são 1º, 2º, 3º.
- `lista_hist_auto.csv` — rascunho gerado automaticamente, só categorias do recorte, colunas do projeto:
  ano,nome_original,titulo,autores,ilustradores,organizadores,editora,lista_curta,colocacao,fonte_1,fonte_2,observacao,categoria
  `colocacao` = "?" quando não foi possível decidir. `autores` separados por " | ".
- `disputas.txt` e `cbl_sem_par.txt` — casos a resolver.

## Recorte e mapeamento de categorias (decidido; não mude)
Só estas categorias atuais: Romance, Contos, Poesia, Crônica, Infantil, Juvenil, Infantil e Juvenil, Livro do Ano.
- "Contos / Crônicas / Novelas", "Contos e Crônicas", "Conto e Crônica", "Contos" → Contos
- "Literatura Infantil", "Infantil" → Infantil; "Literatura Juvenil", "Juvenil" → Juvenil
- "Infantil ou juvenil", "Livro Infantil ou juvenil", "Melhor Livro Infantil ou Juvenil", "Literatura Infantil/Juvenil" → Infantil e Juvenil
- "Livro do Ano Ficção", "Livro do Ano Não Ficção", "Melhor Livro de Ficção", "Melhor Livro de Não Ficção" → Livro do Ano (só a obra vencedora, colocacao 1)
- "Poesia" → Poesia
- FORA do recorte: Autor Revelação (qualquer variante), Ilustração, Produção editorial, Capa, Tradução, "Poesia – Especial"/"Categoria Especial", Personalidade, teatro e não ficção.
`nome_original` = nome da categoria como a edição o chamou (use o do site oficial).

## Regras
- Toda linha precisa de `fonte_1` (URL) e, se houver, `fonte_2` (outra fonte independente). Fonte de rede: URL da página, não da busca.
- Colocação: 1, 2, 3… ou vazio (na lista sem prêmio). Em edições de vencedor único, o vencedor é 1. Empate: mesma colocação repetida. "Menção honrosa": linha com colocação vazia e "Menção honrosa" em `observacao`. "In Memoriam": fora (precedente de 2010), anote no relatório.
- Nome de pessoa: grafia mais completa e usual (Wikipédia pt). Mesma pessoa com grafias diferentes → uma grafia só. Nunca junte pessoas diferentes.
- Coautoria: todos os autores em `autores` (" | "). Ilustrador creditado separado vai em `ilustradores`. Organizador de antologia em `organizadores`. "(coord.)" é organizador.
- `editora`: só se uma fonte DA ÉPOCA disser (página da CBL de época, notícia do ano, ficha da 1ª edição). Na dúvida, vazio.
- Toda decisão não óbvia: uma frase em `observacao` com a fonte ("1º pela Wikipédia 45.º Prêmio Jabuti; CBL lista em 1º").
- Confira o ano na própria fonte (armadilha: notícia de outro ano).
- Busca web: respeite o teto dado no pedido; prefira curl em pt.wikipedia.org (API), web.archive.org, premiojabuti.com.br, publishnews.com.br, acervo de jornais (não gasta cota de busca).
