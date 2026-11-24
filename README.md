# Ciências em 3D

Simuladores 3D de Ciências para o Ensino Fundamental, feitos por **Matheus Fagioli** para as aulas do 6º e do 7º ano.

**Site:** https://beteltv.github.io/CienciasAnimations/

## Fotossíntese: da planta à clorofila

Uma viagem de zoom por dentro de uma planta. Em cada nível, partículas coloridas mostram o caminho da água e dos sais
minerais, do gás carbônico, da luz, do gás oxigênio e da glicose. Os controles de **luz**, **água** e **gás carbônico**
valem para todos os níveis, e o medidor mostra qual deles está limitando a fotossíntese.

| Nível | O que mostra | Situação |
|---|---|---|
| 1. Planta | raízes, caule (com xilema e floema), folhas, frutos e o Sol; a folha murcha com pouca água | ✅ etapa 1 |
| 2. Folha | cutícula, epidermes, parênquima paliçádico e lacunoso, nervura e estômatos que abrem e fecham | ✅ etapa 1 |
| 3. Célula | parede, membrana, vacúolo, núcleo, mitocôndrias e cloroplastos em movimento (ciclose) | ✅ etapa 1 |
| 4. Cloroplasto | tilacoides, estroma e as "baterias" de energia (montagem da glicose para pouco depois da luz) | ✅ etapa 2 |
| 5. Tilacoide | antenas de clorofila, quebra da água, revezamento da energia e a turbina (ATP sintase) | ✅ etapa 2 |
| 6. Clorofila | a molécula átomo por átomo; absorve vermelho e azul, reflete o verde | ✅ etapa 2 |

Recursos extras:

- **Cor da luz** (branca, vermelha, azul, verde): com luz verde a fotossíntese quase para.
- **Mais detalhes**: liga os nomes científicos (fotossistemas, ATP/NADPH, ciclo de Calvin, mesófilo...) e um texto extra no painel. Desligado por padrão.
- **🍎 Caminho de volta**: a glicose sai do cloroplasto e vai até o fruto, com a câmera acompanhando. Na **volta guiada**, o aluno clica nos pontos brilhantes para levar a glicose.
- **🎬 Viagem completa**: percorre todos os níveis sozinho, com legendas, e termina no caminho de volta. Bom para projetar.

Habilidades da BNCC:

- EF06CI05 – Explicar a organização básica das células e seu papel como unidade estrutural e funcional dos seres vivos.
- EF06CI06 – Concluir, com base na análise de ilustrações e/ou modelos (físicos ou digitais), que os organismos são um complexo arranjo de sistemas com diferentes níveis de organização.

## Deriva dos continentes: a Terra por dentro e por fora

Da ideia de Wegener à tectônica de placas, em quatro níveis (`deriva.html`):

| Nível | O que mostra |
|---|---|
| 1. Terra no tempo | globo com os continentes de 300 milhões de anos até hoje (Pangeia, Laurásia, Gondwana, Tétis), régua do tempo geológico e o encaixe da América do Sul na África |
| 2. Por dentro da Terra | corte do planeta: crosta continental e oceânica, litosfera, astenosfera, mantos superior e inferior, núcleos externo e interno, descontinuidades |
| 3. Litosfera de perto | bloco com a crosta continental (e a raiz da montanha), a crosta oceânica, a Moho, o manto litosférico, a astenosfera e a dorsal |
| 4. Convecção do manto | corte do Pacífico à África, de 140 milhões de anos até hoje: correntes de convecção, o Atlântico nascendo, faixas magnéticas simétricas, a placa de Nazca mergulhando sob os Andes |

Evidências que podem ser ligadas no globo:

- **Fósseis** (em destaque): *Mesosaurus* (inclusive Rio Claro e Itapetininga, SP), *Glossopteris*, *Lystrosaurus* e *Cynognathus*, com ficha de cada um. Clique nos pontos para ver o lugar.
- **Geleiras**: a calota de gelo de ~300 milhões de anos e as setas das estrias glaciais (Salto e Itu, SP), que na Pangeia saem do mesmo centro.
- **Montanhas e rochas**: Apalaches, Caledonianas e Mauritânides alinhadas; rochas de 2 bilhões de anos de São Luís e de Gana; basaltos da Serra Geral e de Etendeka.
- **Carvão na Antártida**.

Também tem a **📜 linha do tempo das ideias** (Ortelius, Bacon, Snider-Pellegrini, Suess, Wegener, a rejeição, Holmes, du Toit,
paleomagnetismo, Hess, Vine e Matthews, tectônica de placas, Hurley, *Lystrosaurus* na Antártida e GPS), com botões que levam a
simulação até cada ideia, e a **🎬 viagem guiada** para projetar.

A reconstrução é didática e simplificada: cada continente é um bloco rígido com o contorno de hoje (Natural Earth), posicionado
na Pangeia por ajuste das bordas (o encaixe América do Sul–África usa o polo de Bullard, 1965). Está em `src/reconstrucao.js`.

Habilidades da BNCC:

- EF06CI11 – Identificar as diferentes camadas que estruturam o planeta Terra (da estrutura interna à atmosfera) e suas principais características.
- EF07CI15 – Interpretar fenômenos naturais (como vulcões, terremotos e tsunamis) e justificar a rara ocorrência desses fenômenos no Brasil, com base no modelo das placas tectônicas.
- EF07CI16 – Justificar o formato das costas brasileira e africana com base na teoria da deriva dos continentes.

## Estrutura

```
src/                 código das páginas
  index.html         página inicial
  fotossintese.html  simulador (layout e controles)
  fotossintese.js    os três níveis em 3D (Three.js), as partículas e as transições de zoom
  deriva.html        simulador da deriva dos continentes (layout e controles)
  deriva.js          os quatro níveis: globo, corte, litosfera e convecção
  deriva.css         estilos próprios da deriva (régua do tempo, fichas, linha do tempo das ideias)
  reconstrucao.js    posição dos continentes ao longo do tempo (rotações em torno de polos)
  continentes.js     contornos dos continentes (Natural Earth, domínio público)
  vendor/            bibliotecas Three.js (MIT) e d3-geo (ISC)
docs/                site pronto, publicado pelo GitHub Pages (gerado a partir de src/)
gerar_site.py        monta docs/ e injeta TODOS OS TEXTOS dos simuladores (edite os textos aqui: CONFIG e CONFIG_DERIVA)
```

## Como usar

```bash
python gerar_site.py            # atualiza docs/ depois de mexer em src/ ou nos textos
python gerar_site.py --servir   # idem, e abre o site em http://localhost:8000
```

Os arquivos de `docs/` não abrem com duplo clique (o navegador bloqueia módulos JavaScript locais).
Use `python gerar_site.py --servir` ou o endereço do GitHub Pages.

## Atalhos pela URL (para preparar aulas)

- `fotossintese.html#nivel=folha&agua=15` folha com pouca água (estômatos fechados)
- `fotossintese.html#luz=0` a planta no escuro
- `fotossintese.html#nivel=celula&co2=30` célula com pouco gás carbônico
- `fotossintese.html#nivel=clorofila&cor=verde` a clorofila com luz verde
- `fotossintese.html#detalhes=1` com os nomes científicos
- `fotossintese.html#nomes=0` sem os nomes das partes (bom para avaliação)
- `deriva.html#t=0&encaixe=1` a América do Sul encaixada na África
- `deriva.html#t=270&fossil=mesosaurus` o *Mesosaurus* na Pangeia (troque por `glossopteris`, `lystrosaurus` ou `cynognathus`)
- `deriva.html#t=300&geleiras=1&fosseis=0` as marcas das geleiras
- `deriva.html#t=250&montanhas=1&fosseis=0` montanhas e rochas que continuam de um continente para o outro
- `deriva.html#nivel=camadas` as camadas da Terra (com `&detalhes=1`, as descontinuidades)
- `deriva.html#nivel=conveccao&t=140` o Atlântico prestes a nascer (`t=0`: hoje)

## Instalar como app

O site é um PWA e funciona sem internet depois de aberto uma vez. Ao acrescentar um arquivo novo,
inclua-o na lista de `src/sw.js` e mude a `VERSAO`.
