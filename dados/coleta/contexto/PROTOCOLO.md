# Protocolo — texto de contexto de cada edição (RF-28, CA-28.3)

Um texto por edição (prêmio + ano), em português do Brasil, no tom de um jornalista literário:
o que se passava no país e no mundo do livro naquele ano, e como foi a premiação. Ele aparece no
perfil da edição (painel e página estática `/premios/<prêmio>/<ano>/`), ao lado dos dados e gráficos.

## Saída

Um CSV por lote em `dados/coleta/contexto/lote_<N>.csv`, UTF-8, gravado com o módulo `csv` do Python
(aspas onde precisar), com este cabeçalho exato:

```
premio_id,ano,texto,fontes,revisar
```

- `premio_id`: `jabuti` ou `oceanos`.
- `texto`: 120 a 220 palavras, 2 ou 3 parágrafos separados por uma linha em branco (`\n\n`). Sem título, sem markdown,
  sem listas. Prosa original: nunca copie frases das fontes; no máximo uma citação curta (até 15 palavras), entre aspas
  e atribuída a quem disse, e só se estiver literalmente na fonte.
- `fontes`: URLs que sustentam os fatos do texto, separadas por ` ; ` (espaço, ponto e vírgula, espaço). Pelo menos uma
  por edição. Página que você abriu e leu, não só um resultado de busca.
- `revisar`: vazio quando tudo está sustentado; senão, uma frase curta dizendo o que precisa de conferência humana.

## O que o texto pode dizer

1. **Os dados da própria base valem como fonte** (não precisam de URL): quem venceu, em que categoria, com que livro e
   editora, quantas obras na lista, empates, desclassificações registradas em `observacao`. Consulte assim:
   ```bash
   cd /Users/simasgs/Downloads/JabutiDados
   .venv/bin/python -c "import duckdb; c=duckdb.connect('literadados.duckdb', read_only=True); print(c.sql(\"SELECT categoria, nome_original, colocacao, lista_curta, titulo, editora, nome, papel FROM v_participacao WHERE premio='jabuti' AND ano=1975 ORDER BY categoria, colocacao NULLS LAST\"))"
   ```
   E as notas da coleta: `grep -h ",1975," dados/coleta/jabuti/*.csv dados/coleta/historico/*.csv` (coluna `observacao`).
   A tabela `edicao` traz o regime (formato) e a fonte oficial; `categoria_edicao` traz `etapa_lista` e as vagas;
   `jurado` traz o júri divulgado.
2. **Contexto histórico** (política, economia, censura, mercado editorial, movimentos literários, mortes e
   lançamentos marcantes daquele ano) só com fonte que você leu. Fato amplamente conhecido e datado (ex.: AI-5 em
   dezembro de 1968, Diretas Já em 1984, pandemia em 2020) pode entrar, mas prefira ancorar em uma fonte.
3. **Como foi a premiação**: cerimônia (data, local), novidades de regulamento, polêmicas, recusas, empates, primeira
   vez de algo — sempre com fonte, conferindo o **ano da edição na própria página** (matéria sobre 2006 aparece em busca
   de 2016).

## O que o texto nunca diz

- Raça, cor ou etnia de qualquer pessoa, a não ser que a base já tenha autodeclaração (`pessoa.raca` preenchida) — e,
  mesmo assim, só se for relevante e com o termo da base. Nunca infira por nome, foto ou descrição de terceiros.
- Gênero que a base marca como atribuído (`genero_evidencia = 'atribuicao'`): não use pronome/flexão que dependa dele;
  reescreva a frase de modo neutro.
- Opinião sobre a qualidade dos livros, adjetivos de julgamento ("o melhor romance da década") sem fonte que o diga,
  previsões, fatos sem fonte, citações inventadas.
- Números de percentuais: o painel mostra os números ao lado, com n. O texto conta a história.

## Onde procurar (sem gastar cota de busca)

`curl` não gasta a cota de buscas web. Use-o primeiro:
- pt.wikipedia, verbete da edição: `https://pt.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=17.º_Prêmio_Jabuti`
  (N=1 é 1959; para N.º use `N.º_Prêmio_Jabuti`). Verbetes de prêmio, de autores e do ano (`1975_no_Brasil`,
  `1975_na_literatura`).
- Site oficial: `https://www.premiojabuti.com.br/jabuti/premiados-por-edicao/premiacao/?ano=AAAA` (a editora ali é a atual,
  não a da época).
- Wayback do site antigo da CBL: `https://web.archive.org/web/2009/http://www.cbl.org.br/jabuti/2009/telas/edicoes-anteriores/premio-AAAA.aspx`.
- PublishNews, G1, Folha (acervo), Estadão, O Globo, sites da Associação Oceanos (`associacaooceanos.org`) e do Itaú Cultural.
  Algumas páginas vêm com gzip: `curl -sL --compressed`. Normalize entidades HTML (`html.unescape`).

WebSearch (cota compartilhada, ~200 por turno somando todos os agentes): **no máximo 45 buscas no seu lote**.
Gaste-as no contexto que o `curl` não deu.

## Antes de entregar

- Releia cada texto contra os dados da base (nomes, títulos, categorias, colocações) e contra as fontes.
- Edição com pouca informação: texto menor (mínimo 80 palavras), honesto, centrado no que a base e as fontes mostram,
  e `revisar` explicando a lacuna.
- Responda no fim com: quantas edições escreveu, quantas buscas web usou e a lista de `revisar` preenchidos.
