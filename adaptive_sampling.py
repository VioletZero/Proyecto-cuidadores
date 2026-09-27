import random

class AdaptativeSampler:
    def __init__(self, items_evaluacion):
        self.items_evaluacion = items_evaluacion

    def obtener_preguntas_diarias(self, inferencia_reciente_clase=None, dia_rotacion=None):
        """
        Devuelve 3 preguntas de cada test (Zarit, PHQ-9, GAD-7) de forma aleatoria (9 en total).
        """
        preguntas_seleccionadas = []
        zarit_keys = [k for k, v in self.items_evaluacion.items() if v["test"] == "Zarit"]
        phq9_keys = [k for k, v in self.items_evaluacion.items() if v["test"] == "PHQ-9"]
        gad7_keys = [k for k, v in self.items_evaluacion.items() if v["test"] == "GAD-7"]

        preguntas_seleccionadas.extend(random.sample(zarit_keys, min(3, len(zarit_keys))))
        preguntas_seleccionadas.extend(random.sample(phq9_keys, min(3, len(phq9_keys))))
        preguntas_seleccionadas.extend(random.sample(gad7_keys, min(3, len(gad7_keys))))

        return [
            {
                "id": k, 
                "text": self.items_evaluacion[k]["label"], 
                "test": self.items_evaluacion[k]["test"],
                "max_score": self.items_evaluacion[k]["max_score"]
            }
            for k in preguntas_seleccionadas
        ]

    def obtener_preguntas_baseline(self):
        """
        Devuelve TODAS las preguntas (Línea base rigurosa).
        """
        return [
            {
                "id": k, 
                "text": v["label"], 
                "test": v["test"],
                "max_score": v["max_score"]
            }
            for k, v in self.items_evaluacion.items()
        ]
