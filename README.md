# Ciências em 3D

Simuladores 3D de Ciências para o Ensino Fundamental, feitos por **Matheus Fagioli** para as aulas do 6º ano.

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

## Estrutura

```
src/                 código das páginas
  index.html         página inicial
  fotossintese.html  simulador (layout e controles)
  fotossintese.js    os três níveis em 3D (Three.js), as partículas e as transições de zoom
  vendor/            biblioteca Three.js (licença MIT)
docs/                site pronto, publicado pelo GitHub Pages (gerado a partir de src/)
gerar_site.py        monta docs/ e injeta TODOS OS TEXTOS do simulador (edite os textos aqui)
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

## Instalar como app

O site é um PWA e funciona sem internet depois de aberto uma vez. Ao acrescentar um arquivo novo,
inclua-o na lista de `src/sw.js` e mude a `VERSAO`.
