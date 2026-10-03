import re
import unicodedata

class RiskDetector:
    def __init__(self):
        # Capa A: Catálogo estructurado por categorías de las 7 oficiales
        self.lexico_categorias = {
            "bienestar": [r"\btranquilo\b", r"\bpaz\b", r"\banimado\b", r"\bcon energ[ií]as\b", r"\bbuen d[ií]a\b", r"\btodo bajo control\b", r"\bagradecido\b", r"\bcalma\b", r"\balegre\b", r"\bdescansado\b", r"\bapoyado\b", r"\besperanza\b", r"\bsaliendo adelante\b", r"\bmotivado\b"],
            "estres": [r"\bestresado\b", r"\bapurado\b", r"\bsin tiempo\b", r"\bmucha presi[oó]n\b", r"\btensa\b", r"\btensi[oó]n\b", r"\bacelerado\b", r"\bno paro un segundo\b", r"\bmil cosas a la vez\b", r"\bal l[ií]mite\b"],
            "ansiedad": [r"\bangustia\b", r"\bnervioso\b", r"\bno puedo dormir\b", r"\binsomnio\b", r"\btaquicardia\b", r"\bmiedo\b", r"\bp[aá]nico\b", r"\bintranquilo\b", r"\bpreocupado todo el tiempo\b", r"\btemor de que pase algo\b", r"\bsensaci[oó]n en el pecho\b"],
            "agotamiento": [r"\bagotado\b", r"\bcansado\b", r"\bsin fuerzas\b", r"\bsin energ[ií]as\b", r"\bdrenado\b", r"\bexhausto\b", r"\bpesadez\b", r"\bdolor de cuerpo\b", r"\bno me dan las piernas\b", r"\bmuerto de cansancio\b"],
            "depresion": [r"\bdeprimido\b", r"\btriste\b", r"\bvac[ií]o\b", r"\bganas de llorar\b", r"\bllanto\b", r"\bsin sentido\b", r"\bdesanimado\b", r"\bpena\b", r"\ben un pozo\b"],
            "sobrecarga": [r"\babrumado\b", r"\bno doy m[aá]s\b", r"\bno doy abasto\b", r"\bdemasiada carga\b", r"\bhago todo solo\b", r"\bnadie me ayuda\b", r"\bes demasiado para m[ií]\b", r"\bresponsabilidad excesiva\b", r"\basfixiado por las tareas\b"],
            "frustracion": [r"\bimpotente\b", r"\bfrustrado\b", r"\brabia\b", r"\bmolesto\b", r"\bno sirve de nada lo que hago\b", r"\binjusto\b", r"\bculpa\b", r"\bin[uú]til\b", r"\bno avanzo\b", r"\bharto de la situaci[oó]n\b"]
        }

        # Subcategorías críticas (Safety Override)
        self.riesgo_vital_directo = [
            r"\bquitarme la vida\b", r"\bacabar con todo\b", r"\bno vale la pena vivir\b",
            r"\bdesaparecer para siempre\b", r"\bdormir y no despertar\b", r"\bahorcar(?:me)?\b",
            r"\bcortarme\b", r"\bmatar(?:me)?\b", r"\btirarme\b", r"\bpastillas para no despertar\b",
            r"\bdarme un tiro\b", r"\bdeseo morir\b", r"\bmorir\b", r"\bya no quiero vivir\b", r"\bdesaparecer\b", r"\bdescansar en paz\b"
        ]

    def _normalizar_texto(self, texto):
        """
        Preprocesamiento robusto: minúsculas, remoción de tildes y reducción de caracteres repetidos.
        """
        texto = texto.lower()
        texto = ''.join(c for c in unicodedata.normalize('NFD', texto) if unicodedata.category(c) != 'Mn')
        texto = re.sub(r'(.)\1{2,}', r'\1', texto)
        return texto

    def _evaluar_capa_lexica(self, texto_normalizado):
        """
        Busca patrones léxicos de alta criticidad o la categoría predominante en el texto.
        """
        for patron in self.riesgo_vital_directo:
            if re.search(patron, texto_normalizado):
                return "CRITICO", "Ideación de daño o riesgo vital detectado", "depresion"
                
        conteos = {cat: 0 for cat in self.lexico_categorias}
        for cat, patrones in self.lexico_categorias.items():
            for patron in patrones:
                conteos[cat] += len(re.findall(patron, texto_normalizado))
                
        cat_predominante = max(conteos, key=conteos.get)
        max_conteo = conteos[cat_predominante]
        
        if max_conteo > 0:
            if cat_predominante == "depresion" and max_conteo >= 2:
                return "CRITICO", "Categoría depresión crítica predominante en texto", "depresion"
            return None, "Categoría léxica predominante", cat_predominante
            
        return None, None, None

    def evaluar_riesgo_clinico(self, texto_libre, estado_cuestionario, clase_nlp_bruta, prob_nlp):
        """
        Capa B: Pipeline de Decisión Híbrida.
        Combina el análisis léxico con los resultados de BETO y normaliza a las 7 categorías oficiales.
        """
        # 1. Estandarización de las 7 Categorías Oficiales
        mapa_etiquetas = {
            "resiliencia": "bienestar",
            "estres": "estres",
            "ansiedad": "ansiedad",
            "agotamiento": "agotamiento",
            "depresión": "depresion",
            "depresion": "depresion",
            "sobrecarga": "sobrecarga",
            "frustración": "frustracion",
            "frustracion": "frustracion",
            "bienestar": "bienestar"
        }
        
        # Etiqueta interna normalizada
        clase_nlp = mapa_etiquetas.get(clase_nlp_bruta.lower(), "bienestar")
        
        if not texto_libre.strip():
            es_alerta = estado_cuestionario in ["Bienestar Moderado", "Bienestar Bajo"]
            nivel_riesgo = "BAJO"
            if estado_cuestionario == "Bienestar Moderado":
                nivel_riesgo = "MODERADO"
            elif estado_cuestionario == "Bienestar Bajo":
                nivel_riesgo = "ALTO"
            
            return {
                "es_alerta_clinica": es_alerta,
                "nivel_riesgo": nivel_riesgo,
                "incongruencia_evaluacion": False,
                "razon_override": None,
                "clase_final": clase_nlp
            }

        texto_norm = self._normalizar_texto(texto_libre)
        
        # 2. Ejecutar Capa Léxica
        nivel_riesgo_lexico, razon_lexica, cat_lexica = self._evaluar_capa_lexica(texto_norm)
        
        # 3. Decisión Híbrida / Desempate
        clase_final = clase_nlp
        # Si la confianza de BETO es baja y el léxico encontró una categoría, usamos la léxica
        if prob_nlp < 0.50 and cat_lexica:
            clase_final = cat_lexica

        incongruencia = False
        es_alerta = False
        razon_override = None
        nivel_final = "BAJO"
        
        # 4. Safety Override Crítico Inmediato
        if nivel_riesgo_lexico == "CRITICO":
            es_alerta = True
            nivel_final = "CRITICO"
            clase_final = "depresion"
            razon_override = razon_lexica
            if estado_cuestionario == "Bienestar Alto":
                incongruencia = True
        else:
            # Análisis de incongruencia con el test
            cuestionario_positivo = (estado_cuestionario == "Bienestar Alto")
            nlp_negativo = (clase_final in ["depresion", "sobrecarga", "agotamiento", "ansiedad", "estres", "frustracion"])
            
            if cuestionario_positivo and nlp_negativo and (prob_nlp > 0.65 or cat_lexica == clase_final):
                incongruencia = True
                razon_override = f"Incongruencia detectada: Test Favorable vs {clase_final} (Confianza/Densidad Alta)"
                nivel_final = "MODERADO"
                es_alerta = True

            if not razon_override:
                if estado_cuestionario == "Bienestar Bajo":
                    nivel_final = "ALTO"
                    es_alerta = True
                elif estado_cuestionario == "Bienestar Moderado":
                    nivel_final = "MODERADO"
                    es_alerta = True
                elif nlp_negativo:
                    es_alerta = True
                    if nivel_final == "BAJO":
                        nivel_final = "MODERADO"

        return {
            "es_alerta_clinica": es_alerta,
            "nivel_riesgo": nivel_final,
            "incongruencia_evaluacion": incongruencia,
            "razon_override": razon_override,
            "clase_final": clase_final
        }
