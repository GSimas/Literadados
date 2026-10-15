# Protocolo de pesquisa de pessoas (P4)

Lido por cada agente de coleta. Saída: CSV com o cabeçalho de `pessoas_edicoes_*.csv`, uma linha por pessoa do lote.

```
id,nome,wikidata,genero,genero_fonte,raca,raca_evidencia,raca_fonte,raca_trecho,ano_nascimento,municipio_nascimento,uf_nascimento,nascimento_fonte,observacao,raca_busca
```

## Regras gerais
- Preencha **só** o que o lote pede na coluna `falta`. Célula vazia = "não achei" (não apaga dado existente). Nunca escreva "N/A" ou "-".
- `id` e `nome` exatamente como no lote.
- Confirme a identidade pela obra/categoria/ano do lote. Homônimo (outra profissão, outro país, outra época) não serve: anote em `observacao` e deixe vazio.
- Toda célula preenchida tem fonte (URL da página onde o dado está, não da busca).
- Teto de buscas por agente: o número dado no pedido. Pare ao atingi-lo e marque as pessoas restantes em `observacao` com "não pesquisado (teto)".

## Gênero (`genero`, `genero_fonte`)
- Valores: `mulher`, `homem`, `nao_binario`. Só com texto que trate a pessoa no gênero explícito ("a escritora", "o autor", "ela nasceu", "ilustradora", pronome da própria pessoa). Nome próprio sozinho **não** basta.
- `genero_fonte`: URL do texto.

## Nascimento (`ano_nascimento`, `municipio_nascimento`, `uf_nascimento`, `nascimento_fonte`)
- UF = **UF de nascimento** (sigla, ex.: `SP`). Nascido fora do Brasil: `uf_nascimento` vazio e país em `observacao` ("nasceu em Paris, França").
- Só vale "nasceu em", "natural de", "nascido(a) em". Gentílico ("mineira", "carioca") e cidade onde mora/trabalha **não** valem.
- Os três campos vêm da **mesma** fonte, citada em `nascimento_fonte`. Se a fonte só dá o ano, preencha só o ano.
- Ordem de preferência: Enciclopédia Itaú Cultural, Wikipédia, biografia da editora/orelha, site do autor, entrevista.

## Raça (só quando `falta` contém `raca`)
- Busca: `"<nome>" ("sou negra" OR "sou negro" OR "mulher negra" OR "escritora negra" OR "escritor negro" OR "sou parda" OR "sou pardo" OR indígena)`, e Literafro (letras.ufmg.br/literafro).
- Só autodeclaração da própria pessoa, com **trecho literal** (`raca_trecho`), URL (`raca_fonte`) e `raca_evidencia=autodeclaracao` (ou `fonte_curada` para Literafro com afirmação de identidade).
- Valores: `preta`, `parda`, `negra`, `indigena`, `amarela`, `branca`. Nada achado: `sem_declaracao`.
- Rejeite e anote em `observacao` com "REVISAR": descrição de terceiros, alusão, ascendência ("descendente de…"), discurso indireto do jornalista.
- O índice do Literafro já foi conferido para todas as pessoas na coleta das edições; não gaste busca com ele, a menos que o resultado da busca acima aponte uma página do Literafro.
- `raca_busca=completa` quando a busca acima foi feita (uma busca com os termos do protocolo basta) e os resultados lidos; `parcial` só se a pessoa não foi pesquisada (teto) ou a busca falhou.
- Quando `falta` não contém `raca`, deixe `raca` e `raca_busca` vazios.

## Observação
Uma frase curta por pessoa: o que foi buscado e o que faltou ("1 busca: sem local de nascimento; mora em Curitiba").
