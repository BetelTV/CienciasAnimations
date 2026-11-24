#!/usr/bin/env python3
"""
gerar_site.py — monta a pasta docs/ (site do GitHub Pages) a partir de src/.

    python gerar_site.py            # gera docs/
    python gerar_site.py --servir   # gera e abre um servidor local em http://localhost:8000

Todos os TEXTOS dos simuladores (títulos, explicações, curiosidades, perguntas para a turma e nomes das partes)
ficam aqui: CONFIG (fotossíntese) e CONFIG_DERIVA (deriva dos continentes). Para adaptar à sua turma, edite os textos abaixo e rode o script de novo:
eles são injetados nas páginas. A animação 3D roda no navegador (JavaScript/Three.js), para ficar fluida
até no celular e funcionar sem internet.
"""
import json
import shutil
import sys
from pathlib import Path

CONFIG = {
    "titulo": "Fotossíntese: da planta à clorofila",
    "equacao_palavras": "gás carbônico + água + luz → glicose + gás oxigênio",
    "equacao_simbolos": "6 CO₂ + 6 H₂O + luz → C₆H₁₂O₆ + 6 O₂",

    # Mensagens do medidor de fotossíntese (fator limitante)
    "medidor": {
        "otimo": "A fotossíntese está a todo vapor!",
        "luz": "Falta luz: a clorofila não tem energia suficiente para trabalhar.",
        "agua": "Falta água: a planta fecha os estômatos para não secar, e o gás carbônico quase não entra.",
        "co2": "Pouco gás carbônico no ar: falta matéria-prima para montar a glicose.",
        "escuro": "Sem luz não há fotossíntese. Mas a planta continua respirando, de dia e de noite.",
        "verde": "Luz verde: a clorofila quase não absorve essa cor. Ela é refletida, e é por isso que vemos as folhas verdes.",
        "acabando": "Sem luz, as baterias param de carregar. A montagem da glicose ainda usa as últimas e logo para.",
    },

    # Cores de luz do seletor e quanto a clorofila aproveita cada uma (0 a 1)
    "cores_luz": [
        {"id": "branca", "nome": "Luz do Sol (branca)", "eficiencia": 1.0},
        {"id": "vermelha", "nome": "Vermelha", "eficiencia": 0.9},
        {"id": "azul", "nome": "Azul", "eficiencia": 0.8},
        {"id": "verde", "nome": "Verde", "eficiencia": 0.12},
    ],

    # Os níveis do zoom, na ordem. "pronto": False aparece com cadeado ("em breve").
    "niveis": [
        {
            "id": "planta",
            "nome": "Planta",
            "titulo": "A planta inteira",
            "texto": "A planta é uma fábrica de alimento movida a luz. As raízes retiram água e sais minerais do solo, "
                     "e as folhas recebem a luz do Sol e o gás carbônico do ar. Com esses ingredientes a planta produz "
                     "glicose, o seu alimento, e libera gás oxigênio para o ambiente.",
            "caminhos": [
                ["agua", "Água e sais minerais sobem das raízes até as folhas pelo xilema (seiva bruta)."],
                ["co2", "O gás carbônico do ar entra pelas folhas."],
                ["luz", "A luz do Sol chega às folhas e fornece a energia."],
                ["o2", "O gás oxigênio produzido sai pelas folhas."],
                ["glicose", "A glicose desce pelo floema (seiva elaborada) e alimenta os frutos, as raízes e o crescimento."],
            ],
            "curiosidade": "Quase toda a madeira de uma árvore foi feita a partir do gás carbônico do ar, e não da terra!",
            "pergunta": "Se a planta ficar alguns dias no escuro, o que acontece com a produção de glicose? Teste no controle de luz.",
            "dica": "Clique na folha que está brilhando para entrar nela.",
            "detalhes": "O xilema transporta a seiva bruta (água e sais minerais) das raízes até as folhas, puxada principalmente "
                        "pela transpiração. O floema transporta a seiva elaborada, rica em sacarose (um açúcar feito a partir da "
                        "glicose), das folhas para as partes que consomem ou armazenam açúcar, como frutos, raízes e brotos.",
            "viagem": "Esta é a nossa planta. A água sobe das raízes, o gás carbônico entra pelas folhas e a glicose desce até os frutos. Vamos entrar em uma folha!",
            "pronto": True,
        },
        {
            "id": "folha",
            "nome": "Folha",
            "titulo": "Por dentro da folha",
            "texto": "A folha é formada por camadas de células. Em cima fica a epiderme, transparente, que deixa a luz passar. "
                     "No meio estão as células cheias de cloroplastos, onde a fotossíntese acontece. Embaixo ficam os "
                     "estômatos, pequenas aberturas que deixam o gás carbônico entrar e o oxigênio sair. As nervuras trazem "
                     "a água das raízes e levam a glicose embora.",
            "caminhos": [
                ["luz", "A luz atravessa a epiderme e chega às células de cima, as que mais fazem fotossíntese."],
                ["co2", "O gás carbônico entra pelos estômatos e se espalha pelos espaços de ar."],
                ["agua", "A água chega pelo xilema, dentro da nervura."],
                ["o2", "O oxigênio sai pelos mesmos estômatos."],
                ["glicose", "A glicose entra no floema e viaja para o resto da planta."],
            ],
            "curiosidade": "Os estômatos se fecham quando falta água, para a planta não desidratar. Diminua a água e observe!",
            "pergunta": "Por que a maioria dos estômatos fica na parte de baixo da folha, e não na de cima?",
            "dica": "Clique na célula destacada para ver como ela é por dentro.",
            "detalhes": "O mesófilo é formado pelo parênquima paliçádico, de células alongadas e cheias de cloroplastos, e pelo "
                        "parênquima lacunoso, com espaços que facilitam a circulação dos gases. Cada estômato tem duas "
                        "células-guarda, que mudam de forma ao ganhar ou perder água, abrindo ou fechando a fenda (ostíolo).",
            "viagem": "Por dentro da folha: a luz entra por cima, o gás carbônico pelos estômatos, embaixo, e a água pela nervura. Vamos entrar em uma célula!",
            "pronto": True,
        },
        {
            "id": "celula",
            "nome": "Célula",
            "titulo": "A célula vegetal",
            "texto": "Esta é uma célula vegetal. A parede celular, rígida, dá forma e sustentação. Logo abaixo dela fica a "
                     "membrana plasmática, que controla o que entra e o que sai. O vacúolo, bem grande, guarda água. O núcleo "
                     "comanda a célula. E os grãos verdes são os cloroplastos: as organelas que fazem a fotossíntese.",
            "caminhos": [
                ["luz", "A luz é captada pelos cloroplastos."],
                ["co2", "O gás carbônico atravessa a parede e a membrana até os cloroplastos."],
                ["agua", "A água vem das células vizinhas e do vacúolo."],
                ["o2", "O oxigênio sai da célula."],
                ["glicose", "A glicose produzida é usada pela própria célula ou enviada para outras partes da planta."],
            ],
            "curiosidade": "Os cloroplastos se movimentam dentro da célula e mudam de posição para aproveitar melhor a luz.",
            "pergunta": "Quais estruturas desta célula não existem na célula de um animal?",
            "dica": "Clique no cloroplasto destacado para entrar nele.",
            "detalhes": "A parede celular é feita principalmente de celulose. O vacúolo central, envolvido por uma membrana chamada "
                        "tonoplasto, mantém a pressão de turgor que deixa a célula firme. As células vizinhas se comunicam por "
                        "canais na parede, os plasmodesmos. A mitocôndria faz a respiração celular, que usa glicose e oxigênio "
                        "para liberar energia.",
            "viagem": "Esta é uma célula da folha. Os grãos verdes que circulam são os cloroplastos. Vamos entrar em um deles!",
            "pronto": True,
        },
        {
            "id": "cloroplasto",
            "nome": "Cloroplasto",
            "titulo": "O cloroplasto",
            "texto": "O cloroplasto tem duas membranas por fora e, por dentro, um líquido chamado estroma. Mergulhadas nele ficam "
                     "pilhas de discos verdes, os tilacoides. É como se houvesse duas fábricas trabalhando juntas: nos "
                     "tilacoides, a luz e a água carregam \"baterias\" de energia; no estroma, essas baterias e o gás carbônico "
                     "são usados para montar a glicose.",
            "caminhos": [
                ["luz", "A luz chega aos tilacoides."],
                ["agua", "A água vai para os tilacoides, onde é quebrada."],
                ["o2", "O oxigênio liberado vem da quebra da água."],
                ["bateria", "As baterias carregadas levam a energia dos tilacoides até o estroma..."],
                ["bateriaV", "...e voltam vazias para serem carregadas de novo."],
                ["co2", "O gás carbônico entra no estroma."],
                ["glicose", "No estroma, a glicose é montada e sai do cloroplasto."],
            ],
            "curiosidade": "Os cloroplastos têm o seu próprio material genético e se multiplicam dividindo-se ao meio, parecido com as bactérias.",
            "pergunta": "Apague a luz e espere alguns segundos. Por que a montagem da glicose também para, se ela acontece no estroma, longe dos tilacoides?",
            "dica": "Clique na pilha de tilacoides destacada para ver a membrana bem de perto.",
            "detalhes": "Nos tilacoides acontece a etapa fotoquímica (fase clara): a luz quebra a água (fotólise), libera O₂ e "
                        "produz ATP e NADPH, as \"baterias\". No estroma acontece a etapa química, o ciclo de Calvin: a enzima "
                        "rubisco fixa o CO₂ e, gastando ATP e NADPH, forma os açúcares que dão origem à glicose. O nome antigo "
                        "\"fase escura\" engana: o ciclo de Calvin depende dos produtos da fase clara e acontece durante o dia.",
            "viagem": "Dentro do cloroplasto: as pilhas verdes são os tilacoides, que carregam as baterias com a luz. No estroma, a glicose é montada. Vamos chegar mais perto da membrana!",
            "pronto": True,
        },
        {
            "id": "tilacoide",
            "nome": "Tilacoide",
            "titulo": "A membrana do tilacoide",
            "texto": "Esta é a membrana de um tilacoide, vista bem de perto. Nela ficam \"antenas\" feitas de clorofila, que "
                     "captam a luz. A energia da luz quebra a molécula de água: o oxigênio é liberado e a energia passa de uma "
                     "proteína para outra, como numa corrida de revezamento. No final, uma pequena turbina gira e carrega as "
                     "baterias que vão para o estroma.",
            "caminhos": [
                ["luz", "A luz é captada pelas antenas de clorofila."],
                ["agua", "A água é quebrada do lado de dentro do tilacoide."],
                ["o2", "O oxigênio liberado vem da água: é ele que nós respiramos!"],
                ["eletron", "A energia viaja pela membrana, de proteína em proteína."],
                ["h", "Partículas de hidrogênio se acumulam dentro do tilacoide e, ao passar pela turbina, fazem ela girar."],
                ["bateria", "A turbina e a segunda antena carregam as baterias."],
            ],
            "curiosidade": "Quase todo o oxigênio do ar que respiramos foi liberado pela quebra da água na fotossíntese de plantas e algas.",
            "pergunta": "Mude a cor da luz para verde. Por que as máquinas da membrana quase param?",
            "dica": "Clique na clorofila destacada, na antena, para ver a molécula.",
            "detalhes": "As antenas fazem parte dos fotossistemas II e I. No fotossistema II a água é quebrada "
                        "(2 H₂O → O₂ + 4 H⁺ + 4 elétrons). Os elétrons passam pelo citocromo b6f até o fotossistema I, que os "
                        "entrega ao NADP⁺, formando NADPH. Os íons H⁺ acumulados no lúmen voltam para o estroma pela ATP sintase, "
                        "que gira como um motor e produz ATP.",
            "viagem": "A membrana do tilacoide: as antenas captam a luz, a água é quebrada e o oxigênio é liberado. A turbina gira e carrega as baterias. Vamos ver uma clorofila!",
            "pronto": True,
        },
        {
            "id": "clorofila",
            "nome": "Clorofila",
            "titulo": "A molécula de clorofila",
            "texto": "Esta é a molécula de clorofila. Ela tem um anel de átomos de carbono e nitrogênio, com um átomo de magnésio "
                     "bem no centro, e uma cauda comprida que a prende na membrana. O anel absorve as luzes vermelha e azul e "
                     "aproveita a energia delas. A luz verde quase não é absorvida: ela é refletida e chega aos nossos olhos. "
                     "É por isso que as plantas são verdes!",
            "caminhos": [
                ["luz", "As luzes vermelha e azul são absorvidas pelo anel."],
                ["luzverde", "A luz verde é refletida: é ela que enxergamos."],
                ["eletron", "Ao absorver a luz, a clorofila solta um elétron cheio de energia."],
                ["minerais", "O magnésio do centro veio do solo, junto com os sais minerais absorvidos pelas raízes."],
            ],
            "curiosidade": "Quando falta magnésio no solo, a planta não consegue fabricar clorofila e as folhas ficam amareladas. Isso se chama clorose.",
            "pergunta": "Se a clorofila absorvesse todas as cores de luz, de que cor as plantas seriam?",
            "dica": "Troque a cor da luz e observe a molécula. Depois, siga o caminho de volta da glicose (botão 🍎).",
            "detalhes": "Fórmula da clorofila a: C₅₅H₇₂O₅N₄Mg. O anel é uma porfirina modificada (clorina), com quatro átomos de "
                        "nitrogênio ligados ao magnésio. A cauda de fitol, com 20 carbonos, fica mergulhada na membrana do "
                        "tilacoide. Os picos de absorção da clorofila a ficam perto de 430 nm (azul) e 662 nm (vermelho).",
            "viagem": "Chegamos à clorofila! O magnésio no centro veio do solo pelas raízes. Ela absorve as luzes vermelha e azul e reflete a verde. Agora, vamos seguir a glicose de volta até o fruto.",
            "pronto": True,
        },
    ],

    # Caminho de volta da glicose (do estroma até o fruto). "clique" é o pedido do modo guiado.
    "volta": [
        {"nivel": "cloroplasto", "texto": "A glicose acabou de ser montada no estroma. Agora ela vai sair do cloroplasto.",
         "clique": "Clique no ponto brilhante para levar a glicose para fora do cloroplasto."},
        {"nivel": "celula", "texto": "Ela atravessa o citoplasma e sai da célula, passando para as células vizinhas.",
         "clique": "Clique no ponto brilhante para a glicose atravessar a parede da célula."},
        {"nivel": "folha", "texto": "Na folha, ela entra no floema, dentro da nervura, e segue em direção ao caule.",
         "clique": "Clique no floema (o tubo laranja) para a glicose entrar nele."},
        {"nivel": "planta", "texto": "Pelo floema, ela viaja pelo galho até chegar ao fruto. Parte dela vira o açúcar que deixa o fruto doce!",
         "clique": "Clique no fruto para entregar a glicose."},
    ],
    "volta_fim": "Fim da viagem! A glicose feita com luz, água e gás carbônico virou alimento para a planta inteira.",

    # Nomes que aparecem presos às partes do modelo 3D (botão "Nomes das partes")
    "rotulos": {
        "sol": "Sol", "folhas": "Folhas", "caule": "Caule", "raizes": "Raízes", "frutos": "Frutos", "solo": "Solo",
        "folha_alvo": "Clique nesta folha",
        "cuticula": "Cutícula (camada de cera)", "epiderme_sup": "Epiderme superior",
        "palicadico": "Parênquima paliçádico (muita fotossíntese)", "lacunoso": "Parênquima lacunoso (espaços de ar)",
        "nervura": "Nervura", "xilema": "Xilema (água)", "floema": "Floema (glicose)",
        "epiderme_inf": "Epiderme inferior", "estomato": "Estômato", "celula_alvo": "Clique nesta célula",
        "parede": "Parede celular", "membrana": "Membrana plasmática", "vacuolo": "Vacúolo",
        "nucleo": "Núcleo", "cloroplastos": "Cloroplastos", "mitocondria": "Mitocôndria", "citoplasma": "Citoplasma",
        "cloroplasto_alvo": "Clique neste cloroplasto",
        "memb_ext": "Membrana externa", "memb_int": "Membrana interna", "estroma": "Estroma (líquido)",
        "granum": "Pilha de tilacoides", "lamela": "Ligação entre as pilhas", "fabrica": "Montagem da glicose",
        "tilacoide_alvo": "Clique nesta pilha",
        "lado_estroma": "Lado de fora (estroma)", "lado_lumen": "Lado de dentro do tilacoide", "membrana_til": "Membrana do tilacoide",
        "ps2": "Antena que quebra a água", "cit": "Proteína do revezamento", "ps1": "Segunda antena",
        "atp": "Turbina que carrega as baterias", "clorofila_alvo": "Clique nesta clorofila",
        "magnesio": "Magnésio (veio do solo!)", "anel": "Anel (absorve a luz)", "cauda": "Cauda (prende na membrana)",
        "nitrogenio": "Nitrogênio", "oxigenio_at": "Oxigênio", "carbono": "Carbono",
    },

    # Nomes científicos usados quando "Mais detalhes" está ligado (o que não estiver aqui continua igual)
    "rotulos_detalhes": {
        "xilema": "Xilema (seiva bruta)", "floema": "Floema (seiva elaborada)",
        "palicadico": "Parênquima paliçádico (mesófilo)", "lacunoso": "Parênquima lacunoso (mesófilo)",
        "estomato": "Estômato (células-guarda)", "nervura": "Feixe vascular (nervura)",
        "parede": "Parede celular (celulose)", "vacuolo": "Vacúolo (tonoplasto)",
        "granum": "Granum (tilacoides empilhados)", "lamela": "Lamela intergrana", "fabrica": "Ciclo de Calvin (rubisco)",
        "lado_lumen": "Lúmen do tilacoide", "membrana_til": "Bicamada lipídica",
        "ps2": "Fotossistema II", "cit": "Citocromo b6f", "ps1": "Fotossistema I", "atp": "ATP sintase",
        "anel": "Anel de porfirina (clorina)", "cauda": "Cauda de fitol (C₂₀)", "magnesio": "Magnésio (Mg²⁺)",
    },

    # Legenda das partículas (cores usadas em todos os níveis)
    "legenda": {
        "agua": "água", "minerais": "sais minerais", "co2": "gás carbônico", "luz": "luz",
        "o2": "gás oxigênio", "glicose": "glicose", "bateria": "bateria carregada", "bateriaV": "bateria vazia",
        "eletron": "energia (elétron)", "h": "hidrogênio", "luzverde": "luz verde (refletida)",
    },
    "legenda_detalhes": {
        "bateria": "ATP e NADPH", "bateriaV": "ADP e NADP⁺", "eletron": "elétron", "h": "íon H⁺", "glicose": "glicose (C₆H₁₂O₆)",
    },
}

# =====================================================================================================
# Simulador "Deriva dos continentes" (deriva.html). Todos os textos ficam aqui.
# =====================================================================================================
CONFIG_DERIVA = {
    "titulo": "Deriva dos continentes",

    # Níveis do zoom, na ordem (a "trilha" no alto da cena)
    "niveis": [
        {
            "id": "terra",
            "nome": "Terra no tempo",
            "titulo": "A Terra ao longo do tempo",
            "texto": "Há cerca de 300 milhões de anos, os continentes estavam unidos em um só bloco, a Pangeia, cercado por um "
                     "único oceano, a Pantalassa. Arraste a linha do tempo, ou aperte ▶, e veja a Pangeia se partir, o "
                     "Oceano Atlântico se abrir e a Índia viajar até a Ásia. Ligue as evidências e veja o que Alfred Wegener "
                     "usou para defender a sua ideia.",
            "curiosidade": "Os continentes continuam se movendo hoje: alguns centímetros por ano, mais ou menos a velocidade com que "
                           "as nossas unhas crescem. Satélites de GPS medem esse movimento.",
            "pergunta": "Volte para 270 milhões de anos e ligue os fósseis. Por que as manchas, separadas hoje por um oceano, "
                        "formam faixas contínuas na Pangeia?",
            "dica": "Use o botão 🧩 para encaixar a América do Sul na África. Clique nos pontos dos fósseis para saber onde foram encontrados.",
            "detalhes": "A reconstrução é simplificada: cada continente se move como um bloco rígido, e os contornos são os de hoje. "
                        "Na época, o nível do mar e as bordas dos continentes eram diferentes, e partes da Ásia, da América Central e "
                        "do Caribe ainda estavam se formando (por isso aparecem apagadas). O encaixe fica ainda melhor quando se usa a "
                        "borda da plataforma continental, a cerca de 1.000 m de profundidade, em vez da linha da praia.",
            "viagem": "Esta é a Terra. Vamos voltar 300 milhões de anos e ver os continentes unidos na Pangeia.",
        },
        {
            "id": "camadas",
            "nome": "Por dentro da Terra",
            "titulo": "As camadas da Terra",
            "texto": "A Terra é formada por camadas. Por fora fica a crosta, fina como a casca de um ovo. Abaixo dela está o manto, "
                     "a camada mais grossa, de rochas muito quentes. No centro fica o núcleo, de ferro e níquel: a parte de fora "
                     "é líquida e a de dentro é sólida. Clique em uma camada para conhecê-la.",
            "curiosidade": "Ninguém nunca foi até o manto: o furo mais fundo já feito, na Rússia, chegou a pouco mais de 12 km. "
                           "As camadas foram descobertas estudando como as ondas dos terremotos atravessam o planeta.",
            "pergunta": "Se a Terra fosse do tamanho de uma laranja, a crosta seria mais fina ou mais grossa do que a casca?",
            "dica": "Clique no rótulo laranja, ou duas vezes na borda do corte, para ver a litosfera de perto.",
            "detalhes": "As descontinuidades são as fronteiras onde a velocidade das ondas sísmicas muda de repente: Mohorovičić (Moho, "
                        "crosta/manto, 1909), Gutenberg (manto/núcleo, a 2.900 km, 1913) e Lehmann (núcleo externo/interno, a "
                        "5.150 km, descoberta pela sismóloga dinamarquesa Inge Lehmann em 1936). As ondas S (de cisalhamento) não "
                        "atravessam o núcleo externo, e foi assim que se descobriu que ele é líquido.",
            "viagem": "Agora vamos cortar a Terra como uma fruta e ver as camadas por dentro.",
        },
        {
            "id": "litosfera",
            "nome": "Litosfera de perto",
            "titulo": "A litosfera e as placas",
            "texto": "A litosfera é a camada rígida de fora: a crosta mais o topo do manto. Ela é quebrada em grandes pedaços, as "
                     "placas tectônicas. Existem dois tipos de crosta: a continental, grossa e mais leve, feita de rochas como o "
                     "granito, e a oceânica, fina e mais pesada, feita de basalto. Abaixo da litosfera fica a astenosfera, de rochas "
                     "tão quentes que se deformam devagar, como uma massinha muito dura. As placas deslizam sobre ela.",
            "curiosidade": "A crosta oceânica mais antiga tem cerca de 200 milhões de anos, muito menos que a idade da Terra (4,5 bilhões). "
                           "É que o fundo do mar é reciclado: nasce nas dorsais e afunda de volta no manto nas zonas de subducção.",
            "pergunta": "Por que, quando uma placa oceânica encontra uma continental, é sempre a oceânica que afunda?",
            "dica": "Clique na astenosfera (a camada laranja de baixo) para ver as correntes de convecção.",
            "detalhes": "A litosfera oceânica fica mais grossa e mais densa à medida que envelhece e esfria longe da dorsal; por isso ela "
                        "afunda na subducção. Embaixo das montanhas, a crosta continental fica mais grossa (a raiz da montanha), como "
                        "um iceberg que tem a maior parte escondida: é o equilíbrio isostático, um argumento que o próprio Wegener usou.",
            "viagem": "De perto: a crosta continental é grossa e leve, a oceânica é fina e pesada. Juntas com o topo do manto, formam a litosfera.",
        },
        {
            "id": "conveccao",
            "nome": "Convecção do manto",
            "titulo": "O motor: a convecção do manto",
            "texto": "O manto é sólido, mas é tão quente que flui muito devagar, alguns centímetros por ano. As rochas mais quentes, "
                     "perto do núcleo, ficam menos densas e sobem; ao chegar perto da superfície, esfriam, ficam mais densas e descem. "
                     "Essas correntes de convecção arrastam as placas. Nas dorsais nasce crosta nova; nas zonas de subducção a placa "
                     "oceânica mergulha de volta no manto. Este corte mostra o caminho entre o Pacífico e a África, passando pelos "
                     "Andes, pela América do Sul e pelo Atlântico.",
            "curiosidade": "Quando a lava esfria na dorsal, os minerais magnéticos ficam \"congelados\" apontando para o norte magnético "
                           "daquela época. Como o campo magnético da Terra se inverte de tempos em tempos, o fundo do mar ficou listrado, "
                           "com faixas iguais dos dois lados da dorsal.",
            "pergunta": "Ligue as faixas magnéticas. Por que as faixas do lado da América do Sul são iguais às do lado da África?",
            "dica": "Arraste a linha do tempo de 140 milhões de anos até hoje e veja o Atlântico nascer.",
            "detalhes": "Hoje se sabe que a maior parte da força vem da própria placa: a borda velha e fria que mergulha na subducção puxa "
                        "o resto da placa (\"puxão da placa\"), e a dorsal, mais alta, empurra (\"empurrão da dorsal\"). A convecção do "
                        "manto e essas forças fazem parte do mesmo sistema. O modelo mostra células de convecção simplificadas e está "
                        "fora de escala: a crosta e a litosfera foram engrossadas para ficarem visíveis.",
            "viagem": "O motor da deriva: as correntes de convecção do manto. Veja o Atlântico se abrir enquanto a placa de Nazca mergulha sob os Andes.",
        },
    ],

    # Escala do tempo geológico (milhões de anos). Cores da Comissão Internacional de Estratigrafia.
    "periodos": [
        {"nome": "Carbonífero", "inicio": 359, "fim": 299, "cor": "#67a599", "era": "Paleozoico"},
        {"nome": "Permiano", "inicio": 299, "fim": 252, "cor": "#f04028", "era": "Paleozoico"},
        {"nome": "Triássico", "inicio": 252, "fim": 201, "cor": "#812b92", "era": "Mesozoico"},
        {"nome": "Jurássico", "inicio": 201, "fim": 145, "cor": "#34b2c9", "era": "Mesozoico"},
        {"nome": "Cretáceo", "inicio": 145, "fim": 66, "cor": "#7fc64e", "era": "Mesozoico"},
        {"nome": "Paleógeno", "inicio": 66, "fim": 23, "cor": "#fd9a52", "era": "Cenozoico"},
        {"nome": "Neógeno", "inicio": 23, "fim": 2.6, "cor": "#ffe619", "era": "Cenozoico"},
        {"nome": "Quaternário", "inicio": 2.6, "fim": 0, "cor": "#f9f97f", "era": "Cenozoico"},
    ],
    # Acontecimentos que aparecem na linha do tempo (idade em milhões de anos)
    "marcos_tempo": [
        {"t": 300, "texto": "A Pangeia está formada. Uma grande camada de gelo cobre o sul do supercontinente."},
        {"t": 252, "texto": "Fim do Permiano: a maior extinção da história da vida."},
        {"t": 200, "texto": "A Pangeia começa a se partir: nasce o Atlântico Central, entre a América do Norte e a África."},
        {"t": 175, "texto": "A Pangeia se divide em dois: Laurásia, ao norte, e Gondwana, ao sul."},
        {"t": 133, "texto": "Grandes derrames de lava formam o basalto da Serra Geral (Brasil) e de Etendeka (Namíbia). A América do Sul começa a se separar da África."},
        {"t": 90, "texto": "A Índia se solta de Madagascar e viaja para o norte."},
        {"t": 66, "texto": "Fim dos dinossauros (menos as aves)."},
        {"t": 50, "texto": "A Índia encontra a Ásia: começa a nascer o Himalaia."},
        {"t": 0, "texto": "Hoje: os continentes continuam se movendo alguns centímetros por ano."},
    ],

    # Fósseis (os pontos de ocorrência ficam em deriva.js)
    "fosseis": [
        {
            "id": "mesosaurus", "nome": "Mesosaurus", "tipo": "réptil de água doce", "idade": "cerca de 280 milhões de anos (Permiano)",
            "onde": "Sul e Sudeste do Brasil (inclusive Rio Claro e Itapetininga, aqui em São Paulo), Uruguai, Namíbia e África do Sul.",
            "texto": "Um réptil pequeno, com cerca de 1 m, de focinho comprido e dentes finos, que vivia em lagos e mares rasos de água "
                     "doce ou salobra. No Brasil, os fósseis aparecem nas rochas da Formação Irati.",
            "porque": "Um animal de água doce não conseguiria atravessar milhares de quilômetros de oceano salgado. Se ele aparece só no "
                      "Brasil e no sul da África, os dois lugares deviam estar juntos.",
        },
        {
            "id": "glossopteris", "nome": "Glossopteris", "tipo": "planta (samambaia com sementes)", "idade": "cerca de 300 a 250 milhões de anos (Permiano)",
            "onde": "América do Sul (inclusive Sul do Brasil), África, Madagascar, Índia, Antártida e Austrália.",
            "texto": "Uma planta com folhas em forma de língua (glosso = língua), que formava florestas nos pântanos de clima frio a "
                     "temperado. Os restos dessas florestas viraram parte do carvão mineral do Sul do Brasil.",
            "porque": "As sementes eram grandes e pesadas demais para o vento ou as correntes levarem de um continente a outro. A planta "
                      "aparece em todos os continentes do sul, que formavam Gondwana.",
        },
        {
            "id": "lystrosaurus", "nome": "Lystrosaurus", "tipo": "réptil terrestre (parente distante dos mamíferos)", "idade": "cerca de 250 milhões de anos (início do Triássico)",
            "onde": "África do Sul, Índia e Antártida (também na China e na Rússia).",
            "texto": "Um animal do tamanho de um porco, com dois dentes em forma de presa e bico, que comia plantas. Foi um dos "
                     "sobreviventes da grande extinção do fim do Permiano.",
            "porque": "Era um animal terrestre e pesado, que não nadava longas distâncias. O fóssil achado na Antártida em 1969 foi uma "
                      "das provas que convenceram os cientistas, quase 40 anos depois da morte de Wegener.",
        },
        {
            "id": "cynognathus", "nome": "Cynognathus", "tipo": "réptil terrestre predador (parente distante dos mamíferos)", "idade": "cerca de 245 milhões de anos (Triássico)",
            "onde": "Argentina, África do Sul, Namíbia e Antártida.",
            "texto": "Um predador do tamanho de um lobo, com dentes parecidos com os dos cachorros (o nome quer dizer \"mandíbula de "
                     "cachorro\"). Era um parente distante dos mamíferos.",
            "porque": "Um animal terrestre encontrado dos dois lados do Atlântico Sul só faz sentido se a América do Sul e a África "
                      "estivessem ligadas por terra.",
        },
    ],

    # Outras evidências (camadas do globo)
    "evidencias": {
        "geleiras": {
            "nome": "Marcas de geleiras",
            "texto": "Há uns 300 milhões de anos, uma enorme camada de gelo cobria o sul da Pangeia. As geleiras arrastaram pedras e "
                     "riscaram as rochas (estrias glaciais) no Brasil, na África, na Índia, na Austrália e na Antártida, lugares hoje "
                     "quentes ou separados por oceanos. As setas mostram para onde o gelo andou: na Pangeia elas saem de um mesmo "
                     "centro. Perto de Campinas, o Parque da Rocha Moutonnée, em Salto, e o Parque do Varvito, em Itu, guardam essas marcas.",
        },
        "montanhas": {
            "nome": "Montanhas e rochas",
            "texto": "Cadeias de montanhas antigas continuam de um continente para o outro: os Apalaches (América do Norte) seguem nas "
                     "montanhas da Escócia e da Noruega e no noroeste da África. Rochas com cerca de 2 bilhões de anos do Maranhão "
                     "(São Luís) combinam com as de Gana, na África (Hurley, 1967). E os basaltos da Serra Geral, no Sul do Brasil, "
                     "são irmãos dos de Etendeka, na Namíbia: formaram-se juntos há 133 milhões de anos.",
        },
        "carvao": {
            "nome": "Carvão na Antártida",
            "texto": "Expedições do começo do século XX encontraram camadas de carvão e fósseis de Glossopteris nas montanhas da "
                     "Antártida. O carvão se forma de plantas soterradas em pântanos: ali já existiram florestas, impossíveis no "
                     "clima de hoje. Para Wegener, isso mostrava que os continentes mudaram de lugar em relação aos polos.",
        },
    },

    # Camadas da Terra (nível "Por dentro da Terra")
    "camadas": [
        {"id": "crosta_cont", "nome": "Crosta continental", "prof": "de 25 a 70 km de espessura (em média 35 km)", "estado": "sólida",
         "composicao": "rochas como o granito, ricas em silício e alumínio", "temperatura": "da temperatura ambiente a uns 400 °C na base",
         "densidade": "cerca de 2,7 g/cm³",
         "texto": "É a crosta que forma os continentes. É grossa e mais leve, por isso \"boia\" mais alto. Algumas rochas continentais têm mais de 4 bilhões de anos."},
        {"id": "crosta_oce", "nome": "Crosta oceânica", "prof": "de 5 a 10 km de espessura", "estado": "sólida",
         "composicao": "basalto e gabro, rochas escuras ricas em ferro e magnésio", "temperatura": "fria no fundo do mar, quente nas dorsais",
         "densidade": "cerca de 3,0 g/cm³",
         "texto": "Forma o fundo dos oceanos. É fina, mais pesada e jovem: nasce nas dorsais e é destruída nas zonas de subducção, por isso não passa de uns 200 milhões de anos."},
        {"id": "litosfera", "nome": "Litosfera", "prof": "da superfície até uns 100 km (até 250 km sob os continentes antigos)", "estado": "sólida e rígida",
         "composicao": "a crosta mais o topo do manto", "temperatura": "até cerca de 1.300 °C na base",
         "densidade": "de 2,7 a 3,3 g/cm³",
         "texto": "A camada rígida de fora, quebrada nas placas tectônicas. Não é o mesmo que a crosta: a litosfera inclui a crosta e um pedaço do manto."},
        {"id": "astenosfera", "nome": "Astenosfera", "prof": "de uns 100 km até uns 350 km", "estado": "sólida, mas plástica (se deforma devagar); uma parte bem pequena está fundida",
         "composicao": "peridotito, uma rocha do manto rica em olivina", "temperatura": "cerca de 1.300 °C a 1.600 °C",
         "densidade": "cerca de 3,3 g/cm³",
         "texto": "A parte de cima do manto que é \"mole\" o suficiente para fluir lentamente. As placas da litosfera deslizam sobre ela."},
        {"id": "manto_sup", "nome": "Manto superior", "prof": "da base da crosta até 660 km", "estado": "sólido (com a astenosfera plástica)",
         "composicao": "peridotito (silicatos de ferro e magnésio)", "temperatura": "de uns 500 °C no topo a uns 1.900 °C",
         "densidade": "de 3,3 a 4,0 g/cm³",
         "texto": "Inclui o topo rígido (parte da litosfera) e a astenosfera. Os vulcões das dorsais são alimentados por rochas do manto superior que derretem ao subir."},
        {"id": "manto_inf", "nome": "Manto inferior", "prof": "de 660 km a 2.900 km", "estado": "sólido, mas flui muito devagar",
         "composicao": "minerais de silício, magnésio e ferro compactados pela pressão", "temperatura": "de uns 1.900 °C a uns 4.000 °C na base",
         "densidade": "de 4,4 a 5,6 g/cm³",
         "texto": "A camada mais grossa da Terra, com mais da metade do volume do planeta. As correntes de convecção acontecem no manto, a poucos centímetros por ano."},
        {"id": "nucleo_ext", "nome": "Núcleo externo", "prof": "de 2.900 km a 5.150 km", "estado": "líquido",
         "composicao": "ferro e níquel", "temperatura": "de uns 4.000 °C a uns 5.000 °C",
         "densidade": "de 9,9 a 12,2 g/cm³",
         "texto": "Um oceano de metal líquido. O movimento desse metal gera o campo magnético da Terra, que protege o planeta e faz a bússola funcionar."},
        {"id": "nucleo_int", "nome": "Núcleo interno", "prof": "de 5.150 km até o centro, a 6.371 km", "estado": "sólido",
         "composicao": "ferro e níquel", "temperatura": "cerca de 5.200 °C, quase a temperatura da superfície do Sol",
         "densidade": "cerca de 13 g/cm³",
         "texto": "Apesar de ser a parte mais quente, é sólido: a pressão é tão grande (mais de 3 milhões de vezes a do ar) que o metal não consegue derreter."},
    ],
    "descontinuidades": [
        {"id": "moho", "nome": "Descontinuidade de Mohorovičić (Moho)", "texto": "Separa a crosta do manto. Descoberta em 1909 pelo croata Andrija Mohorovičić, estudando um terremoto."},
        {"id": "gutenberg", "nome": "Descontinuidade de Gutenberg", "texto": "Separa o manto do núcleo, a 2.900 km. Descrita em 1913 por Beno Gutenberg."},
        {"id": "lehmann", "nome": "Descontinuidade de Lehmann", "texto": "Separa o núcleo externo, líquido, do interno, sólido, a 5.150 km. Descoberta em 1936 pela dinamarquesa Inge Lehmann."},
    ],

    # Partes do bloco da litosfera e do corte da convecção (nomes que aparecem presos ao modelo)
    "rotulos": {
        "crosta_cont": "Crosta continental", "crosta_oce": "Crosta oceânica", "moho": "Moho",
        "manto_lit": "Manto litosférico (rígido)", "litosfera": "Litosfera", "astenosfera": "Astenosfera",
        "oceano": "Oceano", "raiz": "Raiz da montanha", "montanha": "Cordilheira", "dorsal": "Dorsal meso-oceânica",
        "magma": "Magma subindo", "manto": "Manto", "nucleo_ext": "Núcleo externo (líquido)", "nucleo_int": "Núcleo interno (sólido)",
        "manto_sup": "Manto superior", "manto_inf": "Manto inferior",
        "dorsal_atl": "Dorsal Mesoatlântica", "dorsal_pac": "Dorsal do Pacífico Leste", "fossa": "Fossa (zona de subducção)",
        "andes": "Cordilheira dos Andes", "am_sul": "América do Sul", "africa": "África", "atlantico": "Oceano Atlântico",
        "pacifico": "Oceano Pacífico", "nazca": "Placa de Nazca", "placa_mergulha": "A placa mergulha no manto",
        "sobe": "Rocha quente sobe", "desce": "Rocha fria desce", "pluma": "Pluma quente", "serra_geral": "Lava da Serra Geral",
        "rifte": "Rifte: o continente se parte", "vulcoes": "Vulcões", "camada_alvo_lit": "Clique aqui: a litosfera",
        "camada_alvo_ast": "Clique aqui: a astenosfera",
    },

    # Linha do tempo das ideias
    "historia": [
        {"ano": "1596", "nome": "Abraham Ortelius", "texto": "O cartógrafo flamengo nota que as Américas parecem ter sido \"arrancadas\" da Europa e da África, e sugere que terremotos e inundações as separaram.",
         "acao": {"nivel": "terra", "t": 0, "encaixe": True}, "botao": "🧩 Ver o encaixe"},
        {"ano": "1620", "nome": "Francis Bacon", "texto": "O filósofo inglês comenta a semelhança entre os litorais dos dois lados do Atlântico, mas não propõe que os continentes se movam.",
         "acao": {"nivel": "terra", "t": 0, "foco": [-20, -5]}, "botao": "🌍 Ver o Atlântico"},
        {"ano": "1858", "nome": "Antonio Snider-Pellegrini", "texto": "Desenha os continentes unidos e usa fósseis de plantas iguais nas minas de carvão da Europa e da América do Norte. Atribui a separação ao Dilúvio bíblico.",
         "acao": {"nivel": "terra", "t": 300, "foco": [-25, 35]}, "botao": "🕰️ Ver os continentes unidos"},
        {"ano": "1885", "nome": "Eduard Suess", "texto": "Batiza Gondwana, o conjunto dos continentes do sul com a mesma flora de Glossopteris. Mas, para ele, os continentes eram ligados por pontes de terra que afundaram, e não se moviam.",
         "acao": {"nivel": "terra", "t": 270, "fossil": "glossopteris", "foco": [30, -45]}, "botao": "🌿 Ver Gondwana"},
        {"ano": "1912–1915", "nome": "Alfred Wegener", "texto": "O meteorologista alemão apresenta a deriva dos continentes em 1912 e publica \"A Origem dos Continentes e Oceanos\" em 1915. Reúne evidências da geografia, dos fósseis, das rochas e dos climas antigos e chama o supercontinente de Pangeia.",
         "acao": {"nivel": "terra", "t": 300, "todas": True, "foco": [0, -20]}, "botao": "🔎 Ver as evidências"},
        {"ano": "1926–1928", "nome": "A rejeição", "texto": "Em um encontro em Nova York, a maioria dos geólogos rejeita a ideia. A crítica principal: que força seria capaz de empurrar continentes inteiros? Wegener não tinha uma boa resposta.",
         "acao": None, "botao": ""},
        {"ano": "1930", "nome": "A morte de Wegener", "texto": "Wegener morre durante uma expedição científica no gelo da Groenlândia, sem ver a sua teoria aceita.",
         "acao": {"nivel": "terra", "t": 0, "foco": [-40, 72]}, "botao": "❄️ Ver a Groenlândia"},
        {"ano": "1931", "nome": "Arthur Holmes", "texto": "O geólogo britânico propõe que correntes de convecção no manto, aquecido pela radioatividade das rochas, poderiam arrastar os continentes.",
         "acao": {"nivel": "conveccao", "t": 60}, "botao": "🔥 Ver a convecção"},
        {"ano": "1937", "nome": "Alexander du Toit", "texto": "O geólogo sul-africano, grande defensor de Wegener, publica \"Nossos continentes errantes\", com muitas evidências do hemisfério sul, como as marcas das geleiras.",
         "acao": {"nivel": "terra", "t": 300, "camada": "geleiras", "foco": [20, -50]}, "botao": "🧊 Ver as geleiras"},
        {"ano": "anos 1950", "nome": "O paleomagnetismo", "texto": "Estudando o magnetismo \"congelado\" nas rochas, cientistas como Keith Runcorn mostram que os continentes mudaram de posição em relação aos polos.",
         "acao": None, "botao": ""},
        {"ano": "1962", "nome": "Harry Hess", "texto": "O geólogo e oficial da Marinha americana propõe a expansão do assoalho oceânico: a crosta nova nasce nas dorsais e afunda nas fossas.",
         "acao": {"nivel": "conveccao", "t": 40}, "botao": "🌊 Ver a dorsal"},
        {"ano": "1963", "nome": "Vine, Matthews e Morley", "texto": "Explicam as faixas magnéticas simétricas dos dois lados das dorsais: é o registro das inversões do campo magnético na crosta que vai nascendo.",
         "acao": {"nivel": "conveccao", "t": 20, "faixas": True}, "botao": "🧲 Ver as faixas"},
        {"ano": "1965–1968", "nome": "A tectônica de placas", "texto": "J. Tuzo Wilson, Dan McKenzie, Jason Morgan, Xavier Le Pichon e outros juntam tudo em uma teoria: a litosfera é dividida em placas rígidas que se movem sobre o manto.",
         "acao": {"nivel": "litosfera"}, "botao": "🧱 Ver a litosfera"},
        {"ano": "1967", "nome": "Patrick Hurley", "texto": "Mede a idade de rochas e mostra que as rochas de cerca de 2 bilhões de anos de São Luís (MA) combinam com as de Gana, na África.",
         "acao": {"nivel": "terra", "t": 250, "camada": "montanhas", "foco": [-15, 0]}, "botao": "🪨 Ver as rochas"},
        {"ano": "1969", "nome": "Lystrosaurus na Antártida", "texto": "Edwin Colbert identifica fósseis de Lystrosaurus na Antártida, o mesmo animal da África do Sul e da Índia.",
         "acao": {"nivel": "terra", "t": 250, "fossil": "lystrosaurus", "foco": [50, -50]}, "botao": "🦎 Ver o Lystrosaurus"},
        {"ano": "hoje", "nome": "GPS e satélites", "texto": "Satélites medem o movimento das placas com precisão de milímetros. A América do Sul e a África continuam se afastando alguns centímetros por ano.",
         "acao": {"nivel": "terra", "t": 0}, "botao": "🛰️ Ver hoje"},
    ],

    # Viagem guiada (botão 🎬)
    "viagem": [
        {"nivel": "terra", "t": 0, "foco": [-25, -10], "texto": "Esta é a Terra de hoje. Repare no litoral do Brasil e no da África: parecem peças de um quebra-cabeça."},
        {"nivel": "terra", "t": 0, "foco": [-15, -10], "encaixe": True, "texto": "Juntando as duas, a América do Sul se encaixa na África. Abraham Ortelius já tinha reparado nisso em 1596."},
        {"nivel": "terra", "t": 0, "foco": [-15, -20], "fosseis": True, "texto": "Os fósseis contam a mesma história: o Mesosaurus, um réptil de água doce, só aparece no Brasil e no sul da África."},
        {"nivel": "terra", "anima": [0, 280], "foco": [5, -25], "fosseis": True, "texto": "Voltando no tempo até 280 milhões de anos, as manchas dos fósseis se juntam em faixas contínuas."},
        {"nivel": "terra", "t": 300, "foco": [20, -40], "camada": "geleiras", "texto": "Há 300 milhões de anos, uma camada de gelo cobria o sul da Pangeia. As marcas das geleiras, como as de Salto e Itu (SP), apontam para o mesmo centro."},
        {"nivel": "terra", "anima": [300, 0], "foco": [10, 0], "texto": "Agora para a frente: a Pangeia se parte, o Atlântico se abre e a Índia viaja até a Ásia."},
        {"nivel": "camadas", "texto": "Mas o que move os continentes? Vamos cortar a Terra: crosta, manto e núcleo."},
        {"nivel": "litosfera", "texto": "A litosfera, rígida, é quebrada em placas. A crosta continental é grossa e leve; a oceânica, fina e pesada."},
        {"nivel": "conveccao", "anima": [140, 0], "texto": "No manto, a rocha quente sobe e a fria desce, como a água numa panela, só que muito devagar. Veja o Atlântico nascer e a placa de Nazca mergulhar sob os Andes."},
        {"nivel": "conveccao", "t": 0, "faixas": True, "texto": "As faixas magnéticas do fundo do mar são iguais dos dois lados da dorsal: a prova de que o fundo do oceano se expande."},
    ],
}

RAIZ = Path(__file__).resolve().parent
SRC, DOCS = RAIZ / "src", RAIZ / "docs"


def main():
    DOCS.mkdir(exist_ok=True)
    cfg = json.dumps(CONFIG, ensure_ascii=False)
    cfg_deriva = json.dumps(CONFIG_DERIVA, ensure_ascii=False)
    for arq in SRC.iterdir():
        if arq.is_dir():
            shutil.copytree(arq, DOCS / arq.name, dirs_exist_ok=True)
        elif arq.suffix == ".html":
            html = arq.read_text(encoding="utf-8").replace("/*CONFIG*/{}", cfg).replace("/*CONFIG_DERIVA*/{}", cfg_deriva)
            (DOCS / arq.name).write_text(html, encoding="utf-8")
        else:
            shutil.copy2(arq, DOCS / arq.name)
    (DOCS / ".nojekyll").write_text("")
    print("Site gerado em", DOCS)
    if "--servir" in sys.argv:
        import functools, http.server, webbrowser
        h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(DOCS))
        print("Abrindo http://localhost:8000  (Ctrl+C para parar)")
        webbrowser.open("http://localhost:8000")
        http.server.ThreadingHTTPServer(("localhost", 8000), h).serve_forever()


if __name__ == "__main__":
    main()
