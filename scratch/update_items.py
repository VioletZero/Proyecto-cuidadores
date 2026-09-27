import re

file_path = '/home/violetzero/proyectoCuidadores/app.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

items_old = """ITEMS_EVALUACION = {
    # Zarit (7 ítems) - opciones 1 a 5
    "Z1": {"test": "Zarit", "label": "¿Siente usted que, a causa del tiempo que gasta con su familiar/paciente, ya no tiene tiempo para usted mismo?", "max_score": 5},
    "Z2": {"test": "Zarit", "label": "¿Se siente estresada(o) al tener que cuidar a su familiar/paciente y tener además de atender otras responsabilidades?", "max_score": 5},
    "Z3": {"test": "Zarit", "label": "¿Cree que la situación actual afecta a su relación con amigos u otros miembros de su familia de una forma negativa?", "max_score": 5},
    "Z4": {"test": "Zarit", "label": "¿Se siente agotada(o) cuando tiene que estar junto a su familiar/paciente?", "max_score": 5},
    "Z5": {"test": "Zarit", "label": "¿Siente usted que su salud se ha visto afectada por tener que cuidar a su familiar/paciente?", "max_score": 5},
    "Z6": {"test": "Zarit", "label": "¿Siente que ha perdido el control sobre su vida desde que la enfermedad familiar/paciente se manifestó?", "max_score": 5},
    "Z7": {"test": "Zarit", "label": "En general, ¿se siente muy sobrecargada(o) al tener que cuidar de su familia/paciente?", "max_score": 5},

    # PHQ-9 (9 ítems) - opciones 0 a 3
    "P1": {"test": "PHQ-9", "label": "Poco interés o placer en hacer las cosas", "max_score": 3},
    "P2": {"test": "PHQ-9", "label": "Sentirse desanimado/a, deprimido/a o sin esperanza", "max_score": 3},
    "P3": {"test": "PHQ-9", "label": "Problemas para dormir o mantenerse dormido/a, o dormir demasiado", "max_score": 3},
    "P4": {"test": "PHQ-9", "label": "Sentirse cansado/a o con poca energía", "max_score": 3},
    "P5": {"test": "PHQ-9", "label": "Poco apetito o comer en exceso", "max_score": 3},
    "P6": {"test": "PHQ-9", "label": "Sentirse mal consigo mismo/a, o sentir que es un fracaso o ha decepcionado a su familia", "max_score": 3},
    "P7": {"test": "PHQ-9", "label": "Problemas para concentrarse en las cosas, como leer el periódico o ver la televisión", "max_score": 3},
    "P8": {"test": "PHQ-9", "label": "¿Moverse o hablar tan despacio que otras personas podrían haberlo notado? O lo contrario, estar tan inquieto/a o agitado/a que se ha estado moviendo mucho más de lo normal", "max_score": 3},
    "P9": {"test": "PHQ-9", "label": "Pensamientos de que estaría mejor muerto/a o de lastimarse de alguna manera", "max_score": 3},

    # GAD-7 (7 ítems) - opciones 0 a 3
    "G1": {"test": "GAD-7", "label": "Sentirse nervioso/a, ansioso/a o con los nervios de punta", "max_score": 3},
    "G2": {"test": "GAD-7", "label": "No poder dejar de preocuparse o controlar la preocupación", "max_score": 3},
    "G3": {"test": "GAD-7", "label": "Preocuparse demasiado por diferentes cosas", "max_score": 3},
    "G4": {"test": "GAD-7", "label": "Dificultad para relajarse", "max_score": 3},
    "G5": {"test": "GAD-7", "label": "Estar tan inquieto/a que es difícil quedarse quieto/a", "max_score": 3},
    "G6": {"test": "GAD-7", "label": "Molestarse o irritarse fácilmente", "max_score": 3},
    "G7": {"test": "GAD-7", "label": "Sentir miedo como si algo terrible pudiera suceder", "max_score": 3},
}"""

items_new = """ITEMS_EVALUACION = {
    # Zarit (7 ítems) - opciones 0 a 4
    "Z1": {"test": "Zarit", "label": "¿Siente usted que, a causa del tiempo que gasta con su familiar/paciente, ya no tiene tiempo para usted mismo?", "max_score": 4},
    "Z2": {"test": "Zarit", "label": "¿Se siente estresada(o) al tener que cuidar a su familiar/paciente y tener además de atender otras responsabilidades?", "max_score": 4},
    "Z3": {"test": "Zarit", "label": "¿Cree que la situación actual afecta a su relación con amigos u otros miembros de su familia de una forma negativa?", "max_score": 4},
    "Z4": {"test": "Zarit", "label": "¿Se siente agotada(o) cuando tiene que estar junto a su familiar/paciente?", "max_score": 4},
    "Z5": {"test": "Zarit", "label": "¿Siente usted que su salud se ha visto afectada por tener que cuidar a su familiar/paciente?", "max_score": 4},
    "Z6": {"test": "Zarit", "label": "¿Siente que ha perdido el control sobre su vida desde que la enfermedad familiar/paciente se manifestó?", "max_score": 4},
    "Z7": {"test": "Zarit", "label": "En general, ¿se siente muy sobrecargada(o) al tener que cuidar de su familia/paciente?", "max_score": 4},

    # PHQ-9 (9 ítems) - opciones 0 a 4
    "P1": {"test": "PHQ-9", "label": "¿Sientes poco interés o placer en hacer las cosas?", "max_score": 4},
    "P2": {"test": "PHQ-9", "label": "¿Te has sentido desanimado/a, deprimido/a o sin esperanza?", "max_score": 4},
    "P3": {"test": "PHQ-9", "label": "¿Has tenido problemas para dormir o mantenerte dormido/a, o has dormido demasiado?", "max_score": 4},
    "P4": {"test": "PHQ-9", "label": "¿Te has sentido cansado/a o con poca energía?", "max_score": 4},
    "P5": {"test": "PHQ-9", "label": "¿Has tenido poco apetito o has comido en exceso?", "max_score": 4},
    "P6": {"test": "PHQ-9", "label": "¿Te has sentido mal contigo mismo/a, o has sentido que eres un fracaso o que has decepcionado a tu familia?", "max_score": 4},
    "P7": {"test": "PHQ-9", "label": "¿Has tenido problemas para concentrarte en cosas como leer o ver la televisión?", "max_score": 4},
    "P8": {"test": "PHQ-9", "label": "¿Te has movido o hablado tan despacio que otros lo han notado, o por el contrario, has estado tan inquieto/a que te has movido mucho más de lo normal?", "max_score": 4},
    "P9": {"test": "PHQ-9", "label": "¿Has tenido pensamientos de que estarías mejor muerto/a o de lastimarte de alguna manera?", "max_score": 4},

    # GAD-7 (7 ítems) - opciones 0 a 4
    "G1": {"test": "GAD-7", "label": "¿Te has sentido nervioso/a, ansioso/a o con los nervios de punta?", "max_score": 4},
    "G2": {"test": "GAD-7", "label": "¿Has sentido que no puedes dejar de preocuparte o controlar tu preocupación?", "max_score": 4},
    "G3": {"test": "GAD-7", "label": "¿Te has preocupado demasiado por diferentes cosas?", "max_score": 4},
    "G4": {"test": "GAD-7", "label": "¿Has tenido dificultad para relajarte?", "max_score": 4},
    "G5": {"test": "GAD-7", "label": "¿Has estado tan inquieto/a que te resulta difícil quedarte quieto/a?", "max_score": 4},
    "G6": {"test": "GAD-7", "label": "¿Te has molestado o irritado fácilmente?", "max_score": 4},
    "G7": {"test": "GAD-7", "label": "¿Has sentido miedo como si algo terrible pudiera suceder?", "max_score": 4},
}"""

content = content.replace(items_old, items_new)

# También necesitamos cambiar la validación del score min_val de 1 a 0 en Zarit,
# porque en evaluacion_mental pusimos: min_val = 1 if test_name == "Zarit" else 0
content = content.replace('min_val = 1 if test_name == "Zarit" else 0', 'min_val = 0')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("app.py actualizado.")
