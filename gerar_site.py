#!/usr/bin/env python3
"""
gerar_site.py — monta a pasta docs/ (site do GitHub Pages) a partir de src/.

    python gerar_site.py            # gera docs/
    python gerar_site.py --servir   # gera e abre um servidor local em http://localhost:8000

Todos os TEXTOS do simulador (títulos, explicações, curiosidades, perguntas para a turma e nomes das partes)
ficam aqui em CONFIG. Para adaptar à sua turma, edite os textos abaixo e rode o script de novo:
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

RAIZ = Path(__file__).resolve().parent
SRC, DOCS = RAIZ / "src", RAIZ / "docs"


def main():
    DOCS.mkdir(exist_ok=True)
    cfg = json.dumps(CONFIG, ensure_ascii=False)
    for arq in SRC.iterdir():
        if arq.is_dir():
            shutil.copytree(arq, DOCS / arq.name, dirs_exist_ok=True)
        elif arq.suffix == ".html":
            (DOCS / arq.name).write_text(arq.read_text(encoding="utf-8").replace("/*CONFIG*/{}", cfg),
                                         encoding="utf-8")
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
