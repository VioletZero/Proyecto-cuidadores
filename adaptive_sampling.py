import random

class AdaptativeSampler:
    def __init__(self, items_evaluacion):
        self.items_evaluacion = items_evaluacion
        # Pool crítico rotativo (preguntas con mayor peso emocional/carga de Zarit)
        # 4: Agotamiento, 9: Tensión/Irritabilidad, 11: Pérdida de control, 15: Carga pesada
        self.pool_critico = [4, 9, 11, 15] 
        # Dimensiones para rotar cada día
        self.dimensiones = ["Tiempo/Carga", "Psicológica", "Física", "Social", "Relacional", "Emocional"]

    def obtener_preguntas_diarias(self, inferencia_reciente_clase, dia_rotacion):
        """
        Devuelve 3 a 4 preguntas según el estado del usuario mediante muestreo adaptativo (EMA).
        - inferencia_reciente_clase: Output reciente del modelo BERT (ej. 'Sobrecarga')
        - dia_rotacion: int (ej. un valor secuencial diario, o el día del mes)
        """
        preguntas_seleccionadas = []
        
        # 1. Pregunta Centinela (Rotativa dentro del pool crítico)
        id_centinela = self.pool_critico[dia_rotacion % len(self.pool_critico)]
        preguntas_seleccionadas.append(id_centinela)

        # 2. Selección por Inferencia Activa
        # Si la inferencia de BERT dice "Sobrecarga" o "Depresión", añadimos una pregunta de la esfera psico-emocional
        if inferencia_reciente_clase in ["Sobrecarga", "Depresión"]:
            candidatos_reactivos = [
                k for k, v in self.items_evaluacion.items() 
                if v["dimension"] in ["Psicológica", "Emocional"] and k not in preguntas_seleccionadas
            ]
            if candidatos_reactivos:
                preguntas_seleccionadas.append(random.choice(candidatos_reactivos))
        
        # 3. Rotación Estructurada (Cobertura de otras dimensiones)
        dim1 = self.dimensiones[dia_rotacion % len(self.dimensiones)]
        dim2 = self.dimensiones[(dia_rotacion + 1) % len(self.dimensiones)]
        
        candidatos_dim1 = [k for k, v in self.items_evaluacion.items() if v["dimension"] == dim1 and k not in preguntas_seleccionadas]
        candidatos_dim2 = [k for k, v in self.items_evaluacion.items() if v["dimension"] == dim2 and k not in preguntas_seleccionadas]
        
        if candidatos_dim1:
            preguntas_seleccionadas.append(random.choice(candidatos_dim1))
        
        # Solo agregamos una cuarta si el pool no llegó a 4 preguntas
        if len(preguntas_seleccionadas) < 4 and candidatos_dim2:
            preguntas_seleccionadas.append(random.choice(candidatos_dim2))
            
        # Failsafe: Asegurar un mínimo de 3 preguntas
        todas_las_llaves = list(self.items_evaluacion.keys())
        while len(preguntas_seleccionadas) < 3:
            candidato_extra = random.choice(todas_las_llaves)
            if candidato_extra not in preguntas_seleccionadas:
                preguntas_seleccionadas.append(candidato_extra)

        # Retornar el payload con la estructura requerida
        return [
            {"id": k, "text": self.items_evaluacion[k]["label"], "dimension": self.items_evaluacion[k]["dimension"]}
            for k in preguntas_seleccionadas
        ]
