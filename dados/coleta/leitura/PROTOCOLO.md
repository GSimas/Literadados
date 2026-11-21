# Leitura — protocolo de transcrição de fontes (segunda leva, CA-33.9)

Fontes em PDF ou planilha (INAF, SAEB, PISA, mercado do livro, bibliotecas públicas) são transcritas por agentes para CSV;
`python coleta.py leitura arquivo <fonte>` converte em `dados/indicador_valor/<indicador>.csv`. Nunca invente nem estime número:
só o que está escrito na fonte, com a página ou a aba.

## `<fonte>_indicadores.csv` — o catálogo proposto (um por indicador)
`id,nome,definicao,unidade,tipo_fonte,nivel,fonte_nome,fonte_url,limitacoes,tema`
- `id`: slug curto e estável (`inaf_proficiente`, `saeb_lp_9ef`, `pisa_leitura`, `livros_exemplares_vendidos`…).
- `unidade` ∈ `percentual` (0–100), `contagem`, `media`, `moeda` (R$ correntes do ano), `pontuacao` (escala da avaliação).
- `tipo_fonte` ∈ `censo`, `registro_administrativo`, `pesquisa_amostral`.
- `nivel` ∈ `brasil`, `regiao`, `uf`, `municipio` (o mais fino que a fonte tem).
- `tema` ∈ `habitos`, `alfabetizacao`, `escola`, `mercado`, `bibliotecas`.
- `definicao` em uma frase; `limitacoes` diz o que o número não mede e as quebras de série (mudança de metodologia, de amostra).

## `<fonte>.csv` — os valores
`ano,indicador,territorio,dimensao,categoria,valor,numerador,denominador,amostra,margem,fonte_url,observacao`
- `territorio`: `BR`; regiões pelo código do IBGE (`1` Norte, `2` Nordeste, `3` Sudeste, `4` Sul, `5` Centro-Oeste); UFs pelo código
  do IBGE de 2 dígitos (`35` = SP, `42` = SC…); municípios pelo código de 7 dígitos.
- `dimensao`/`categoria` do vocabulário de `dados/recorte.csv` (`total/total`; `sexo/homens|mulheres`; `cor_raca/branca|preta|parda|negra|amarela|indigena`;
  `faixa_etaria/<A-B ou A+>`; `escolaridade/…`; `rede/publica|privada`; `situacao/urbana|rural`). Categoria que não existe no vocabulário:
  diga no relatório (pode ser acrescentada), não force.
- Pesquisa amostral: `amostra` obrigatória (entrevistas ou alunos da edição); `margem` quando a fonte declarar.
- Censo e registro em percentual: `numerador` e `denominador` quando a fonte publicar; se só publicar o percentual, use
  `tipo_fonte = pesquisa_amostral` não é o caso: deixe numerador/denominador vazios e diga em `observacao` (o build pede os dois para censo/registro).
- `fonte_url`: URL do PDF/planilha com página ou aba (`…pdf#page=12`, `…xlsx#aba=UF`).
- `ano`: ano de referência do dado (ano da prova, ano de campo, ano das vendas).

Escreva sempre com o módulo `csv` do Python. Downloads ficam fora do projeto (diretório temporário). User-Agent em pedidos a
sites: `Literadados (https://literadados.gustavosimas.com)`, nunca e-mail. Não use Instagram nem redes com login.
