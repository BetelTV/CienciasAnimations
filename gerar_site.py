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
    },

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
            "dica": "Clique em um cloroplasto. A viagem para dentro dele chega na próxima etapa!",
            "pronto": True,
        },
        {"id": "cloroplasto", "nome": "Cloroplasto", "titulo": "O cloroplasto", "pronto": False},
        {"id": "tilacoide", "nome": "Tilacoide", "titulo": "A membrana do tilacoide", "pronto": False},
        {"id": "clorofila", "nome": "Clorofila", "titulo": "A molécula de clorofila", "pronto": False},
    ],

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
    },

    # Legenda das partículas (cores usadas em todos os níveis)
    "legenda": {
        "agua": "água", "minerais": "sais minerais", "co2": "gás carbônico", "luz": "luz",
        "o2": "gás oxigênio", "glicose": "glicose",
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
