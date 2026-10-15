# JabutiDados — plano de coleta piloto

**Recorte final:** Prêmio Jabuti 2010–2025 · Romance, Contos, Poesia, Crônica, Infantil, Juvenil, Livro do Ano.
**Modelo:** [schema.sql](schema.sql). Cada aba da planilha corresponde a uma tabela, com as mesmas colunas.

## Objetivo do piloto

Medir **esforço** e **cobertura** antes de coletar as 16 edições. O piloto responde três perguntas:

1. Quanto tempo leva, em média, para completar uma pessoa (gênero, nascimento e raça)?
2. Para quantas pessoas é possível achar uma autodeclaração racial pública?
3. As listas de 2010–2017 existem completas e confiáveis online?

## Escopo do piloto

| Bloco | Edições | Tabelas | Volume estimado |
|---|---|---|---|
| **Estrutura** | **todas** (2010–2025) | `categoria_edicao` | cerca de 100 linhas |
| **Conteúdo** | **2016** (formato antigo, com pódio) e **2023** (formato atual, duas listas, Romance já dividido) | `indicacao`, `obra`, `autoria`, `editora`, `pessoa` | cerca de 110 indicações e 130 pessoas |
| **Júri** | 2023 | `jurado` (+ `pessoa`) | cerca de 18 pessoas |

A estrutura cobre as 16 edições já no piloto porque é barata. Ela mostra todas as mudanças de nome de categoria e de número de vagas, e as séries temporais dependem disso.

## Etapas

### 0. Planilha
- Uma aba por tabela, com o cabeçalho igual às colunas de `schema.sql`. Uma aba extra, `log`, registra pessoa, minutos gastos e observação.
- IDs são *slugs*: minúsculas, sem acento, palavras ligadas por hífen. Exemplos: `conceicao-evaristo`, `olhos-dagua`. Se duas obras tiverem o mesmo nome, acrescente o ano: `olhos-dagua-2014`.
- Célula vazia significa "não sei". Nunca escreva "N/A" nem "-".

### 1. Estrutura: `categoria_edicao` (2010–2025)
Para cada edição, registrar o nome oficial de cada categoria do recorte, a categoria padronizada correspondente e as vagas.

| Fato conhecido | Como fica no modelo |
|---|---|
| Até 2017: cerca de 10 finalistas e 1º, 2º e 3º lugares | `vagas_lista=10`, `vagas_curta=NULL`, `vagas_premio=3` |
| 2018: 10 finalistas, só o 1º lugar premiado | `vagas_lista=10`, `vagas_curta=NULL`, `vagas_premio=1` |
| A partir de 2019: lista de cerca de 10 semifinalistas, depois 5 finalistas e 1 vencedor | `vagas_lista=10`, `vagas_curta=5`, `vagas_premio=1` |
| "Contos e Crônicas" até 2017 | `categoria='Contos'` (a série de Crônica começa quando a categoria passa a existir sozinha) |
| A partir de 2020, "Romance" vira "Romance Literário" | `categoria='Romance'` |
| Livro do Ano de Ficção e Livro do Ano de Não Ficção até 2017 | duas linhas, ambas com `categoria='Livro do Ano'` |

Todos esses números precisam ser **confirmados edição por edição**. Fontes: regulamentos da CBL, catálogos oficiais em `premiojabuti.com.br/jabuti/catalogo-jabuti-AAAA.pdf` e matérias do PublishNews.

### 2. Listas: `indicacao`, `obra`, `autoria`, `editora` (2016 e 2023)
- **Duas fontes independentes para cada lista**, por exemplo catálogo da CBL mais PublishNews ou um jornal. Se as fontes divergirem, anote no `log`.
- Para edições antigas sem página oficial, buscar no Wayback Machine (`web.archive.org/web/*/premiojabuti.com.br*`).
- `lista_curta`: 1 ou 0 só em 2019 em diante; NULL antes disso.
- `colocacao`: 1, 2 ou 3; vazio se a obra não foi premiada.
- Infantil e Juvenil: registrar também quem ilustrou, com `papel='ilustrador'`. As análises contam só `papel='autor'`, a menos que se peça o contrário.
- Editora: sede (site da editora, em "Quem somos" ou "Contato") e grupo editorial. `grupo` vazio significa editora independente.

### 3. Pessoas, preenchimento automático (Wikidata)

> **Nota da coleta piloto (14/10/2026):** o Wikidata ficou indisponível por limite de taxa (SPARQL e API de entidades). `coleta.py wikidata` tenta de novo, mas a coleta piloto seguiu por busca web, anotando o QID quando encontrado. Registre sempre `raca_busca` (`completa` ou `parcial`) para cada pessoa.
Rodar a consulta abaixo com os nomes coletados. Ela traz gênero, data de nascimento, cidade e UF.

```sparql
SELECT ?pessoa ?nome ?generoLabel ?nasc ?cidadeLabel ?uf WHERE {
  VALUES ?nome { "Conceição Evaristo"@pt "Cristovão Tezza"@pt }   # ← nomes da planilha
  ?pessoa rdfs:label ?nome ; wdt:P31 wd:Q5 .
  OPTIONAL { ?pessoa wdt:P21 ?genero }
  OPTIONAL { ?pessoa wdt:P569 ?nasc }
  OPTIONAL { ?pessoa wdt:P19 ?cidade .
             OPTIONAL { ?cidade wdt:P131* ?est . ?est wdt:P31 wd:Q485258 ; wdt:P300 ?uf } }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "pt". }
}
```
A consulta foi testada em 14/10/2026 e devolveu, por exemplo, Cristovão Tezza → Lages, BR-SC.

**Uma pessoa confere cada resultado:**
- Um nome pode bater com mais de uma pessoa. Confirme o QID pela biografia antes de copiar.
- Copie a fonte de cada dado para `genero_fonte` e `nascimento_fonte`, usando a URL do Wikidata.

### 4. Pessoas, complemento manual
**Nascimento** (o que faltou no Wikidata), por ordem de preferência:
1. Enciclopédia Itaú Cultural.
2. Wikipédia.
3. Biografia na orelha do livro ou no site da editora.
4. Site do próprio autor.

**Raça** (protocolo fixo, **limite de 10 minutos por pessoa**):
1. Buscar: `"<nome>" ("sou negra" OR "sou negro" OR "mulher negra" OR "escritora negra" OR "escritor negro" OR "sou parda" OR "sou pardo" OR indígena)`.
2. Procurar em entrevistas, perfis e falas públicas do próprio autor.
3. Consultar fontes curadas por identidade, como o portal Literafro da UFMG. Nesse caso, `raca_evidencia='fonte_curada'`.
4. Encontrou: preencha `raca`, `raca_evidencia`, `raca_fonte` (URL) e `raca_trecho`, com a **citação literal**.
5. Não encontrou: deixe `sem_declaracao`.
6. **Nunca** classificar por foto, sobrenome ou "parece". `branca` só entra com declaração explícita.

### 5. Júri (2023)
- Nomes publicados pela CBL após o resultado.
- Mesmo tratamento das etapas 3 e 4. A pessoa pode já existir na tabela `pessoa`: reaproveite o ID.

### 6. Controle de qualidade
- **Revisão dupla:** uma segunda pessoa revisa 10% das pessoas, sorteadas, sem ver o preenchimento original. Anote as divergências.
- **Consultas de consistência** (todas devem voltar vazias):

```sql
-- listas com tamanho diferente do registrado
SELECT c.ano, c.nome_original, c.vagas_lista, COUNT(i.obra_id) AS n
FROM categoria_edicao c LEFT JOIN indicacao i USING (ano, nome_original)
GROUP BY ALL HAVING n <> c.vagas_lista;

-- premiações a mais ou a menos
SELECT c.ano, c.nome_original, c.vagas_premio, COUNT(i.colocacao) AS n
FROM categoria_edicao c LEFT JOIN indicacao i USING (ano, nome_original)
GROUP BY ALL HAVING n <> c.vagas_premio;

-- obra sem autor
SELECT id FROM obra WHERE id NOT IN (SELECT obra_id FROM autoria WHERE papel = 'autor');
```

## Métricas do piloto e critérios para seguir

| Métrica | Como medir | Meta para seguir com as 16 edições |
|---|---|---|
| Minutos por pessoa | aba `log` | multiplicar pelo total estimado (cerca de 650 pessoas) e ver se o esforço cabe |
| Cobertura de gênero | `SELECT * FROM v_cobertura` | ≥ 95% |
| Cobertura de UF de nascimento | idem | ≥ 85% |
| Cobertura de raça | idem | sem meta: o número **é** o achado. Abaixo de 40%, decidir sobre a etapa opcional abaixo |
| Divergência na revisão dupla | pessoas divergentes / pessoas revisadas | ≤ 5% |
| Listas 2016 completas | consistência da etapa 6 | 100%. Se faltar, reavaliar o início do recorte |

**Etapa opcional, se a cobertura de raça for baixa:** enviar a quem estiver sem declaração um questionário curto, com consentimento explícito, nas categorias do IBGE. Testar primeiro com 20 pessoas para medir a taxa de resposta. O envio é feito por você, não pela ferramenta.

## Limites que o modelo deixa visíveis

- **A autodeclaração é assimétrica.** Pessoas negras e indígenas costumam se declarar publicamente; pessoas brancas quase nunca. Por isso o indicador honesto é **"pelo menos X% negros"**, um piso, e a porcentagem de brancos não é calculável. O painel deve sempre exibir a cobertura ao lado do número (view `v_cobertura`).
- **Preto ou pardo.** Muitos autores dizem "sou negro" sem especificar, e isso vira `raca='negra'`. Perguntas sobre "autores pretos" tendem a ter resposta só no agrupamento **negros**, que é a coluna `negra` em `v_participacao`.
- **Livro do Ano conta duas vezes.** Depois de 2018, a obra que vence o Livro do Ano também venceu sua categoria. Nas contagens de "prêmios", isso soma dois, o que é intencional: foram dois prêmios.
- **Edição não é ano de publicação.** O prêmio sai no ano seguinte ao da publicação. As séries usam o ano da edição (`ano`); o ano de publicação fica em `obra.ano_publicacao`.

## Decisões já tomadas (posso mudar se você preferir)

1. **Romance de Entretenimento** (a partir de 2020) **fica fora.** "Romance" é Romance (até 2019) mais Romance Literário (2020 em diante).
2. **Livro do Ano antes de 2018:** entram os dois, Ficção e Não Ficção. Dá para filtrar por `nome_original`.
3. **Ilustradores** são coletados, mas não entram nas contagens por padrão.
4. **Coedições:** só a editora principal.

## Depois do piloto

1. Ajustar o modelo com o que o piloto revelar.
2. Coletar as 14 edições restantes, em lotes por regime: 2010–2017, 2018, 2019–2025.
3. Só então: carga no DuckDB, painel e IA.

## Fontes
- Regulamento 2024: <https://static.poder360.com.br/2024/04/regulamento-jabuti-2024-edicao-66-abr-2024.pdf>
- Romance de Entretenimento, 2020: <https://www.publishnews.com.br/materias/2020/03/17/jabuti-se-abre-para-a-literatura-mais-comercial>
- Reforma de 2018: <https://blogs.correiobraziliense.com.br/leiodetudo/mudancas-no-premio-jabuti/>
- Semifinalistas de 2019: <https://www.publishnews.com.br/materias/2019/10/03/jabuti-divulga-seus-semifinalistas>
- Catálogo 2024: <https://www.premiojabuti.com.br/jabuti/catalogo-jabuti-2024.pdf>
