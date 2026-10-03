import nltk
import torch
import re
import json
import os
import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import BertTokenizer, BertForSequenceClassification
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from datetime import datetime, timezone, timedelta
import uuid
from risk_detector import RiskDetector

detector_riesgo = RiskDetector()

# ==========================================
# 1. Configuración de Recursos de IA y NLP
# ==========================================
# Descarga de paquetes necesarios para el procesamiento de texto en español [4]
nltk.download('punkt')
nltk.download('punkt_tab')
nltk.download('stopwords')

app = Flask(__name__)
CORS(app) # Permite la interoperabilidad con la App móvil [Chat History]

# Rutas locales del modelo ya entrenado (Fine-Tuning exitoso)
PATH_MODELO = './modelo_cuidadores'
PATH_MAPEO = 'mapeo_clases.json'

# Verificación de existencia del modelo entrenado
if not os.path.exists(PATH_MODELO) or not os.path.exists(PATH_MAPEO):
    print("ERROR: No se encontró el modelo entrenado o el archivo de mapeo.")
    exit()

# Carga del "cerebro" local: Tokenizador y Modelo BERT entrenado con MEACorpus
tokenizer = BertTokenizer.from_pretrained(PATH_MODELO)
modelo_ia = BertForSequenceClassification.from_pretrained(PATH_MODELO)
modelo_ia.eval() # Modo evaluación para predicciones [Chat History]

# Carga del mapeo de clases (ID -> Etiqueta: Depresión, Resiliencia, etc.)
with open(PATH_MAPEO, 'r', encoding='utf-8') as f:
    id_to_class = json.load(f)

# ==========================================
# 2. Funciones de Lógica de Negocio (NLP)
# ==========================================

def limpiar_texto(texto):
    """Normalización suave para no borrar palabras clave de bienestar [Chat History]."""
    texto = texto.lower()
    texto = re.sub(r'[^\w\s]', '', texto) 
    # Comentamos o eliminamos las stopwords para que BERT lea el 'bien' o el 'no'
    tokens = word_tokenize(texto)
    stop_words = set(stopwords.words('spanish'))
    tokens_limpios = [w for w in tokens if not w in stop_words]
    return texto # Retornamos el texto íntegro pero limpio

def predecir_emocion(texto_relato):
    """Clasifica el relato y devuelve la clase detectada junto con el nivel de sobrecarga probabilístico."""
    texto_limpio = limpiar_texto(texto_relato)

    #deteccion de sarcasmo
    palabras_positivas = ["maravilla", "excelente", "genial", "increíble", "feliz"]
    palabras_criticas = ["bomba", "morir", "matar", "infierno", "horrible", "desastre", "miserable"]
    
    texto_lower = texto_relato.lower()
    es_sarcastico_o_critico = any(p in texto_lower for p in palabras_criticas) and any(p in texto_lower for p in palabras_positivas)

    if es_sarcastico_o_critico:
        # Forzar la clase a Sobrecarga o Depresión debido a la severidad latente
        clase_detectada = "Sobrecarga"
        nivel_sobrecarga = "Sobrecarga intensa"
        return clase_detectada, nivel_sobrecarga
        
    # Tokenización con truncamiento para BERT
    inputs = tokenizer(texto_limpio, return_tensors="pt", truncation=True, padding=True, max_length=128)
    
    with torch.no_grad():
        outputs = modelo_ia(**inputs)
        logits = outputs.logits
        probs = torch.softmax(logits, dim=1)
        predicted_class_id = torch.argmax(logits, dim=1).item()
    
    clase_detectada = id_to_class[str(predicted_class_id)]
    prob_clase_detectada = probs[0][predicted_class_id].item()
    
    # Buscar probabilidad de la clase "Sobrecarga"
    id_sobrecarga = None
    for k, v in id_to_class.items():
        if v == "Sobrecarga":
            id_sobrecarga = int(k)
            break
            
    nivel_sobrecarga = "No calculable"
    if id_sobrecarga is not None:
        prob_sobrecarga = probs[0][id_sobrecarga].item()
        if prob_sobrecarga <= 0.46:
            nivel_sobrecarga = "No sobrecarga"
        elif prob_sobrecarga <= 0.55:
            nivel_sobrecarga = "Sobrecarga ligera"
        else:
            nivel_sobrecarga = "Sobrecarga intensa"
            
    # --- HEURÍSTICA DE CONTRASTE ---
    conectores = ["pero", "aunque", "sin embargo"]
    frases_resolucion = ["salir adelante", "lo logre", "lo logré", "pude", "sobrevivi", "sobreviví", "bien", "contenta", "buen dia", "buen día"]
    texto_eval = texto_relato.lower()
    
    if any(c in texto_eval for c in conectores) and any(f in texto_eval for f in frases_resolucion):
        if clase_detectada.lower() == "depresion":
            clase_detectada = "bienestar" if "contenta" in texto_eval or "buen d" in texto_eval else "agotamiento"
            
    # --- HEURÍSTICA DE INTERCEPCIÓN (WHITELIST RESILIENCIA ABSOLUTA) ---
    WHITELIST_RESILIENCIA = ["esperanza", "actitud positiva", "todo irá bien", "todo ira bien", "saldré adelante", "saldre adelante", "optimista", "paz", "tranquila", "agradecida", "muy bien", "estoy bien", "excelente", "feliz", "buen dia"]
    BLACKLIST_CONTRADICCION = ["explotar", "llorando", "rabia", "harto", "no aguanto", "mentira", "horrible", "peor", "desesperacion", "ironia", "sarcasmo", "colapsar"]
    RIESGO_VITAL = ["quitarme la vida", "acabar con todo", "no vale la pena", "desaparecer", "dormir y no despertar", "matar", "morir", "ya no quiero vivir", "tirarme", "no quiero estar vivo", "quiero morir"]
    
    tiene_positividad = any(w in texto_eval for w in WHITELIST_RESILIENCIA)
    tiene_contradiccion = any(c in texto_eval for c in BLACKLIST_CONTRADICCION)
    tiene_riesgo_vital = any(r in texto_eval for r in RIESGO_VITAL)

    # 1. FRENO DE EMERGENCIA ABSOLUTO
    if tiene_riesgo_vital:
        clase_detectada = "depresion"
    # 2. Solo si no hay riesgo de vida, evaluar sarcasmo/positividad
    elif tiene_positividad and not tiene_contradiccion:
        clase_detectada = "bienestar"
    elif tiene_positividad and tiene_contradiccion:
        clase_detectada = "frustracion"
            
    return clase_detectada, nivel_sobrecarga, prob_clase_detectada

# ==========================================
# 3. Rutas de la API (Interoperabilidad)
# ==========================================

@app.route('/analizar_emocion', methods=['POST'])
def analizar_emocion():
    try:
        data = request.json
        relato_cuidador = data.get('texto_narrativo', '')
        puntaje_likert = data.get('puntos_sobrecarga', 0)
        nombre_usuario = data.get('nombre_usuario', 'Cuidador')

        # 1. Predicción IA con mapeo Zarit
        clase_detectada_bruta, nivel_sobrecarga, prob_clase = predecir_emocion(relato_cuidador)
        
        # Evaluacion rapida para el endpoint viejo
        riesgo_dict = detector_riesgo.evaluar_riesgo_clinico(
            texto_libre=relato_cuidador, 
            estado_cuestionario="Bienestar Alto" if puntaje_likert <= 2 else "Bienestar Moderado",
            clase_nlp_bruta=clase_detectada_bruta,
            prob_nlp=prob_clase
        )
        clase_detectada = riesgo_dict["clase_final"]
        
        # --- AJUSTE PARA CORREGIR DETECCIÓN ERRÓNEA ---
        texto_comparar = relato_cuidador.lower()
        palabras_bienestar = ["bien", "descansada", "excelente", "feliz", "tranquila"]
        
        # Si el usuario dice que está bien y el Likert es bajo, ignoramos el error de la IA
        if any(p in texto_comparar for p in palabras_bienestar) and puntaje_likert <= 2:
            clase_detectada = "bienestar"
            nivel_sobrecarga = "No sobrecarga"
        # ----------------------------------------------

        # 2. Generación de respuesta (Personalizada)
        if clase_detectada == "bienestar":
            mensaje_ia = f"Hola {nombre_usuario}, es gratificante leer que te sientes con '{clase_detectada}'. El descanso es vital."
        elif clase_detectada == "depresion":
            mensaje_ia = f"Hola {nombre_usuario}, he detectado señales de tristeza profunda. Cuentas con nuestro apoyo."
        elif clase_detectada == "sobrecarga":
            mensaje_ia = f"Hola {nombre_usuario}, parece que hoy ha sido un día pesado. Se perciben niveles de agotamiento ({nivel_sobrecarga}). Tu bienestar es prioridad."
        else:
            mensaje_ia = f"Hola {nombre_usuario}, se perciben señales de '{clase_detectada}'."

        es_alerta_clinica = clase_detectada in ["sobrecarga", "depresion"] or nivel_sobrecarga == "Sobrecarga intensa" or puntaje_likert >= 4
        
        print(f"Relato: {relato_cuidador} | Predicción final: {clase_detectada} ({nivel_sobrecarga}) | Likert: {puntaje_likert}")

        
        return jsonify({
            "status": "procesado",
            "mensaje_ia": mensaje_ia,
            "deteccion": clase_detectada,
            "nivel_sobrecarga_ml": nivel_sobrecarga,
            "es_alerta": es_alerta_clinica
        }), 200

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": "Error interno en el análisis de IA"}), 500

# ==========================================
# 4. Módulo de Evaluación de Salud Mental
# ==========================================

# Definición de ítems para la Escala de Zarit, PHQ-9 y GAD-7
ITEMS_EVALUACION = {
    # Zarit (7 ítems) - opciones 0 a 4
    "Z1": {"test": "Zarit", "label": "¿Sientes que, por el tiempo que dedicas a cuidar a tu familiar, la falta de tiempo libre es un problema?", "max_score": 4},
    "Z2": {"test": "Zarit", "label": "¿Sientes estrés por tener que cuidar a tu familiar y al mismo tiempo atender otras responsabilidades?", "max_score": 4},
    "Z3": {"test": "Zarit", "label": "¿Crees que la situación de cuidado afecta la relación con amigos u otros familiares de forma negativa?", "max_score": 4},
    "Z4": {"test": "Zarit", "label": "¿Sientes agotamiento cuando tienes que estar junto a tu familiar?", "max_score": 4},
    "Z5": {"test": "Zarit", "label": "¿Sientes que tu salud ha empeorado por tener que cuidar a tu familiar?", "max_score": 4},
    "Z6": {"test": "Zarit", "label": "¿Sientes la pérdida de control sobre tu vida desde que empezó la labor de cuidado?", "max_score": 4},
    "Z7": {"test": "Zarit", "label": "En general, ¿sientes una carga excesiva por la tarea de cuidar?", "max_score": 4},

    # PHQ-9 (9 ítems) - opciones 0 a 4
    "P1": {"test": "PHQ-9", "label": "¿Sientes poco interés o placer al hacer las cosas que antes te gustaban?", "max_score": 4},
    "P2": {"test": "PHQ-9", "label": "¿Sientes tristeza, desánimo o falta de esperanza?", "max_score": 4},
    "P3": {"test": "PHQ-9", "label": "¿Tienes problemas para dormir, o al contrario, duermes demasiado?", "max_score": 4},
    "P4": {"test": "PHQ-9", "label": "¿Sientes cansancio o falta de energía para hacer las actividades del día?", "max_score": 4},
    "P5": {"test": "PHQ-9", "label": "¿Tienes poco apetito, o al contrario, comes mucho más de lo habitual?", "max_score": 4},
    "P6": {"test": "PHQ-9", "label": "¿Sientes que la falta de cumplimiento a tus propias expectativas o a las de tu familia te afecta?", "max_score": 4},
    "P7": {"test": "PHQ-9", "label": "¿Tienes dificultad para mantener la concentración en actividades como ver televisión o leer?", "max_score": 4},
    "P8": {"test": "PHQ-9", "label": "¿Notas lentitud o agitación a un nivel que otras personas lo perciben?", "max_score": 4},
    "P9": {"test": "PHQ-9", "label": "¿Han surgido pensamientos vinculados con el deseo de no existir o hacerse daño?", "max_score": 4},

    # GAD-7 (7 ítems) - opciones 0 a 4
    "G1": {"test": "GAD-7", "label": "¿Sientes nerviosismo, ansiedad o la sensación de tensión constante?", "max_score": 4},
    "G2": {"test": "GAD-7", "label": "¿Sientes imposibilidad para dejar de sentir preocupación aunque lo intentes?", "max_score": 4},
    "G3": {"test": "GAD-7", "label": "¿Sientes preocupación excesiva por distintos temas al mismo tiempo?", "max_score": 4},
    "G4": {"test": "GAD-7", "label": "¿Hay dificultad para lograr la relajación, incluso en momentos libres?", "max_score": 4},
    "G5": {"test": "GAD-7", "label": "¿Sientes un nivel de inquietud que dificulta la permanencia en calma?", "max_score": 4},
    "G6": {"test": "GAD-7", "label": "¿Hay presencia de irritabilidad o molestia frecuente por detalles pequeños?", "max_score": 4},
    "G7": {"test": "GAD-7", "label": "¿Sientes temor o la sensación de que algo malo va a pasar en cualquier momento?", "max_score": 4},
}

from adaptive_sampling import AdaptativeSampler
sampler_ema = AdaptativeSampler(ITEMS_EVALUACION)

@app.route('/preguntas_diarias', methods=['POST'])
def preguntas_diarias():
    try:
        data = request.json or {}
        tipo_evaluacion = data.get('tipo_evaluacion', 'diario') # Puede ser 'baseline' o 'diario'
        inferencia_reciente = data.get('ultima_inferencia', 'No detectada')
        dia_rotacion = data.get('login_count', datetime.now(timezone.utc).timetuple().tm_yday)
        
        if tipo_evaluacion == 'baseline':
            preguntas = sampler_ema.obtener_preguntas_baseline()
        else:
            preguntas = sampler_ema.obtener_preguntas_diarias(inferencia_reciente, dia_rotacion)
        
        return jsonify({
            "status": "success",
            "preguntas": preguntas
        }), 200
    except Exception as e:
        print(f"Error generando EMA: {str(e)}")
        return jsonify({"error": "Error interno generando preguntas diarias."}), 500

@app.route('/evaluacion_mental', methods=['POST'])
def evaluacion_mental():
    try:
        data = request.json
        respuestas = data.get('respuestas', [])
        comentarios_generales = data.get('comentarios_generales', '')
        user_id = data.get('user_id', str(uuid.uuid4()))
        ubicacion = data.get('ubicacion', 'Desconocida')
        nombre_usuario = data.get('nombre_usuario', 'Cuidador')
        tipo_evaluacion = data.get('tipo_evaluacion', 'diario') # 'baseline' o 'diario'
        tipo_test = data.get('tipo_test', 'Test rápido')

        if not respuestas or len(respuestas) == 0:
            return jsonify({"error": "No se enviaron respuestas."}), 400

        # Puntuaciones por test
        scores = {"Zarit": 0, "PHQ-9": 0, "GAD-7": 0}
        counts = {"Zarit": 0, "PHQ-9": 0, "GAD-7": 0}
        item_scores = []

        # Procesar cada respuesta
        for r in respuestas:
            item_id = str(r.get('item_id'))
            score = int(r.get('score', 0))

            if item_id in ITEMS_EVALUACION:
                test_name = ITEMS_EVALUACION[item_id]["test"]
                label = ITEMS_EVALUACION[item_id]["label"]
                max_score = ITEMS_EVALUACION[item_id]["max_score"]
                
                # Limitar el score según el test
                min_val = 0
                score = max(min_val, min(max_score, score))
                
                scores[test_name] += score
                counts[test_name] += 1
                
                item_scores.append({
                    "item_id": item_id,
                    "label": label,
                    "score": score,
                    "test": test_name
                })

        # Extrapolación de puntajes si es diario
        if tipo_evaluacion == 'diario':
            if counts["Zarit"] > 0: scores["Zarit"] = int(scores["Zarit"] * (7 / counts["Zarit"]))
            if counts["PHQ-9"] > 0: scores["PHQ-9"] = int(scores["PHQ-9"] * (9 / counts["PHQ-9"]))
            if counts["GAD-7"] > 0: scores["GAD-7"] = int(scores["GAD-7"] * (7 / counts["GAD-7"]))

        # Categorización — escala unificada 0-4 por ítem
        # Zarit 7 ítems × 4 = 28 máx:  <12=Alto, 12-19=Moderado, >=20=Bajo
        # PHQ-9 9 ítems × 4 = 36 máx:  <12=Alto, 12-21=Moderado, >=22=Bajo
        # GAD-7 7 ítems × 4 = 28 máx:  <10=Alto, 10-17=Moderado, >=18=Bajo
        estado_bienestar = "Bienestar Alto"

        if scores["Zarit"] >= 20:
            estado_bienestar = "Bienestar Bajo"
        elif scores["Zarit"] >= 12:
            estado_bienestar = "Bienestar Moderado"

        if scores["PHQ-9"] >= 22:
            estado_bienestar = "Bienestar Bajo"
        elif scores["PHQ-9"] >= 12 and estado_bienestar == "Bienestar Alto":
            estado_bienestar = "Bienestar Moderado"

        if scores["GAD-7"] >= 18:
            estado_bienestar = "Bienestar Bajo"
        elif scores["GAD-7"] >= 10 and estado_bienestar == "Bienestar Alto":
            estado_bienestar = "Bienestar Moderado"

        # Análisis NLP del texto de desahogo
        clase_detectada_bruta = "bienestar"
        nivel_sobrecarga_ml = "No calculable"
        prob_clase = 0.0
        
        if comentarios_generales.strip():
            clase_detectada_bruta, nivel_sobrecarga_ml, prob_clase = predecir_emocion(comentarios_generales)

        # Evaluación de Riesgo Clínico Avanzado
        riesgo_dict = detector_riesgo.evaluar_riesgo_clinico(
            texto_libre=comentarios_generales, 
            estado_cuestionario=estado_bienestar, 
            clase_nlp_bruta=clase_detectada_bruta, 
            prob_nlp=prob_clase
        )
        
        es_alerta_clinica = riesgo_dict["es_alerta_clinica"]
        nivel_riesgo_clinico = riesgo_dict["nivel_riesgo"]
        incongruencia_evaluacion = riesgo_dict["incongruencia_evaluacion"]
        razon_override = riesgo_dict["razon_override"]
        clase_detectada = riesgo_dict["clase_final"] # Estandarizada a las 7 oficiales
        
        # --- HEURÍSTICA DE INTERCEPCIÓN (WHITELIST RESILIENCIA ABSOLUTA) ---
        WHITELIST_RESILIENCIA = ["esperanza", "actitud positiva", "todo irá bien", "todo ira bien", "saldré adelante", "saldre adelante", "optimista", "paz", "tranquila", "agradecida", "muy bien", "estoy bien", "excelente", "feliz", "buen dia"]
        BLACKLIST_CONTRADICCION = ["explotar", "llorando", "rabia", "harto", "no aguanto", "mentira", "horrible", "peor", "desesperacion", "ironia", "sarcasmo", "colapsar"]
        RIESGO_VITAL = ["quitarme la vida", "acabar con todo", "no vale la pena", "desaparecer", "dormir y no despertar", "matar", "morir", "ya no quiero vivir", "tirarme", "no quiero estar vivo", "quiero morir"]
        
        texto_eval_mental = comentarios_generales.lower()
        tiene_positividad = any(w in texto_eval_mental for w in WHITELIST_RESILIENCIA)
        tiene_contradiccion = any(c in texto_eval_mental for c in BLACKLIST_CONTRADICCION)
        tiene_riesgo_vital = any(r in texto_eval_mental for r in RIESGO_VITAL)

        # 1. FRENO DE EMERGENCIA ABSOLUTO
        if tiene_riesgo_vital:
            clase_detectada = "depresion"
            clase_detectada_bruta = "depresion"
            es_alerta_clinica = True
        # 2. Solo si no hay riesgo de vida, evaluar sarcasmo/positividad
        elif tiene_positividad and not tiene_contradiccion:
            clase_detectada = "bienestar"
            clase_detectada_bruta = "bienestar"
        elif tiene_positividad and tiene_contradiccion:
            clase_detectada = "frustracion"
            clase_detectada_bruta = "frustracion"

        # --- LÓGICA: NLP SOBREESCRIBE CUESTIONARIO ---
        # Árbitro de Ponderación Híbrido (Stress Test Fix)
        if clase_detectada == "bienestar" and prob_clase > 0.4:
            es_alerta_clinica = False
            nivel_riesgo_clinico = "BAJO"
            if estado_bienestar in ["Bienestar Bajo", "Riesgo Vital / Crisis"]:
                estado_bienestar = "Bienestar Moderado"
            incongruencia_evaluacion = True
            razon_override = "Texto libre positivo neutraliza cuestionario negativo."

        # Aislamiento de Crisis (Solo el catálogo léxico de riesgo vital activa la alerta clínica)
        if nivel_riesgo_clinico != "CRITICO":
            es_alerta_clinica = False

        # Reglas del Punto Medio
        if estado_bienestar == "Bienestar Alto" and clase_detectada == "agotamiento":
            estado_bienestar = "Bienestar Moderado"
        elif estado_bienestar == "Bienestar Moderado" and clase_detectada in ["bienestar", "estres", "sobrecarga"]:
            estado_bienestar = "Bienestar Moderado"

        if es_alerta_clinica:
            estado_bienestar = "Riesgo Vital / Crisis"
        elif clase_detectada in ["sobrecarga", "agotamiento", "depresion", "frustracion"] and not es_alerta_clinica and estado_bienestar != "Bienestar Moderado":
            if estado_bienestar == "Bienestar Alto" and prob_clase < 0.5:
                pass # Baja confianza en ML no anula un test 100% positivo
            else:
                estado_bienestar = "Bienestar Bajo"

        if nivel_riesgo_clinico == "CRITICO":
            estado_bienestar = "Riesgo Vital / Crisis"

        # Memoria Clínica (Historial para contexto del mensaje)
        path_evaluaciones = os.path.join('data', 'evaluaciones.json')
        evaluaciones_existentes = []
        historial_reciente = []
        volatilidad_alta = False
        
        if os.path.exists(path_evaluaciones):
            try:
                with open(path_evaluaciones, 'r', encoding='utf-8') as f:
                    evaluaciones_existentes = json.load(f)
                    
                evals_usuario = [e for e in evaluaciones_existentes if e.get('user_metadata', {}).get('id') == user_id]
                evals_usuario.sort(key=lambda x: x.get('user_metadata', {}).get('fecha', ''), reverse=True)
                historial_reciente = evals_usuario[:3]
                
                # Check Volatility
                if len(historial_reciente) > 0:
                    last_eval = historial_reciente[0]
                    last_date_str = last_eval.get('user_metadata', {}).get('fecha', '')
                    if last_date_str:
                        try:
                            last_date = datetime.fromisoformat(last_date_str.replace('Z', '+00:00'))
                            if (datetime.now(timezone.utc) - last_date).total_seconds() < 86400: # 24 hours
                                past_target = last_eval.get('predictive_target', '')
                                if (estado_bienestar == "Bienestar Alto" and past_target in ["Riesgo Vital / Crisis", "Bienestar Bajo"]) or \
                                   (estado_bienestar in ["Riesgo Vital / Crisis", "Bienestar Bajo"] and past_target == "Bienestar Alto"):
                                    volatilidad_alta = True
                        except:
                            pass
            except json.JSONDecodeError:
                pass

        # Generación de mensaje personalizado (Contextualizado con memoria)
        es_historial_negativo = any(e.get('predictive_target') in ["Bienestar Bajo", "Riesgo Vital / Crisis"] for e in historial_reciente)
        es_historial_positivo = all(e.get('predictive_target') in ["Bienestar Alto", "Bienestar Moderado"] for e in historial_reciente) if len(historial_reciente) > 0 else False

        if estado_bienestar == "Bienestar Alto":
            if es_historial_negativo:
                mensaje_ia = f"Qué alegría ver este avance, {nombre_usuario}. Sabemos que vienes de días pesados, así que celebra este momento de bienestar. Te lo mereces."
            else:
                mensaje_ia = f"Hola {nombre_usuario}, nos alegra ver que te encuentras en un buen estado. Sigue cuidándote."
        elif clase_detectada == "depresion" or nivel_riesgo_clinico == "CRITICO" or estado_bienestar == "Riesgo Vital / Crisis":
            if es_historial_positivo and volatilidad_alta:
                mensaje_ia = f"Hola {nombre_usuario}, has llevado un buen ritmo, es normal tener un día de bajón tan drástico. No te exijas de más hoy."
            else:
                mensaje_ia = f"Hola {nombre_usuario}, sentimos que hoy ha sido un día especialmente pesado. Recuerda que no tienes que cargar con todo en soledad. Queremos brindarte apoyo."
        elif estado_bienestar in ["Bienestar Moderado", "Bienestar Bajo"] or clase_detectada in ["sobrecarga", "agotamiento", "estres", "ansiedad", "frustracion"]:
            mensaje_ia = f"Hola {nombre_usuario}, parece que ha sido una jornada difícil. Tu bienestar es prioridad, tomate un momento para ti."
        else:
            mensaje_ia = f"Hola {nombre_usuario}, gracias por completar tu Diario de hoy."

        # Resumen Multidimensional adaptado
        resumen_dimensiones = {
            "Física": "Se detecta alta sobrecarga." if scores["Zarit"] >= 12 else "Sobrecarga en rangos manejables.",
            "Psicológica": "Señales de ánimo bajo." if scores["PHQ-9"] >= 12 else "Ánimo estable.",
            "Emocional": "Niveles elevados de ansiedad." if scores["GAD-7"] >= 10 else "Niveles de ansiedad estables."
        }

        # Protocolo de Intervención (trigger en leve-moderado)
        guia_respiracion = None
        if estado_bienestar in ["Bienestar Moderado", "Bienestar Bajo"] or scores["GAD-7"] >= 8:
            guia_respiracion = {
                "titulo": "Respiración (Técnica 4-7-8)",
                "instrucciones": [
                    "1. Inhala profundamente por la nariz durante 4 segundos.",
                    "2. Mantén la respiración durante 7 segundos.",
                    "3. Exhala lentamente por la boca, haciendo un sonido de soplido, durante 8 segundos."
                ]
            }

        puntaje_proporcional = scores["Zarit"] + scores["PHQ-9"] + scores["GAD-7"]

        # Formato de Salida de Datos (ML Ready)
        evaluacion_ml_ready = {
            "user_metadata": {
                "id": user_id,
                "nombre": nombre_usuario,
                "fecha": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                "ubicacion": ubicacion
            },
            "item_scores": item_scores,
            "puntaje_proporcional": puntaje_proporcional,
            "puntajes_test": scores,
            "tipo_evaluacion": tipo_evaluacion,
            "tipo_test": tipo_test,
            "nlp_corpus": comentarios_generales,
            "predictive_target": estado_bienestar,
            "emocion_detectada": clase_detectada,
            "nivel_riesgo_clinico": nivel_riesgo_clinico,
            "incongruencia_evaluacion": incongruencia_evaluacion,
            "razon_override": razon_override,
            "dimensiones_evaluadas": resumen_dimensiones,
            "intervencion": guia_respiracion,
            "volatilidad_alta": volatilidad_alta
        }

        # Guardar en archivo JSON local
        os.makedirs('data', exist_ok=True)
        evaluaciones_existentes.append(evaluacion_ml_ready)

        with open(path_evaluaciones, 'w', encoding='utf-8') as f:
            json.dump(evaluaciones_existentes, f, ensure_ascii=False, indent=2)

        # Lógica de Racha Centralizada
        path_usuarios = os.path.join('data', 'usuarios.json')
        nueva_racha = 1
        if os.path.exists(path_usuarios):
            with open(path_usuarios, 'r', encoding='utf-8') as f:
                usuarios = json.load(f)
            hoy_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            for u in usuarios:
                if u.get('user_id') == user_id or u.get('id') == user_id:
                    ultima_fecha = u.get('ultima_fecha_racha')
                    racha_actual = u.get('racha', 0)
                    racha_actual += 1
                    
                    u['racha'] = racha_actual
                    u['ultima_fecha_racha'] = hoy_str
                    nueva_racha = racha_actual
                    break
            with open(path_usuarios, 'w', encoding='utf-8') as f:
                json.dump(usuarios, f, ensure_ascii=False, indent=2)

        return jsonify({
            "status": "success",
            "puntaje_total": puntaje_proporcional,
            "estado_bienestar": estado_bienestar,
            "es_alerta_clinica": es_alerta_clinica,
            "nivel_riesgo_clinico": nivel_riesgo_clinico,
            "incongruencia_evaluacion": incongruencia_evaluacion,
            "razon_override": razon_override,
            "resumen_dimensiones": resumen_dimensiones,
            "guia_respiracion": guia_respiracion,
            "mensaje": "Registro procesado y guardado correctamente.",
            "mensaje_ia": mensaje_ia,
            "texto_narrativo": comentarios_generales,
            "deteccion": clase_detectada,
            "nueva_racha": nueva_racha
        }), 200

    except Exception as e:
        print(f"Error procesando evaluación: {str(e)}")
        return jsonify({"error": "Error interno en el servidor."}), 500

@app.route('/usuario/<user_id>/evaluaciones', methods=['GET'])
def historial_evaluaciones_usuario(user_id):
    try:
        path_evaluaciones = os.path.join('data', 'evaluaciones.json')
        if not os.path.exists(path_evaluaciones):
            return jsonify({"status": "success", "historial": []}), 200
            
        with open(path_evaluaciones, 'r', encoding='utf-8') as f:
            evaluaciones = json.load(f)
            
        # Aislamiento estricto por user_id
        evaluaciones_usuario = [e for e in evaluaciones if e.get('user_metadata', {}).get('id') == user_id]
            
        # Ordenar por fecha descendente
        evaluaciones_usuario.sort(
            key=lambda x: x.get('user_metadata', {}).get('fecha', ''),
            reverse=True
        )
        
        limit = request.args.get('limit', default=50, type=int)
        evaluaciones_usuario = evaluaciones_usuario[:limit]
        
        historial_estandar = []
        for ev in evaluaciones_usuario:
            historial_estandar.append({
                "id_evaluacion": str(uuid.uuid4()), # Generar ID si no había
                "fecha": ev.get('user_metadata', {}).get('fecha'),
                "tipo_evaluacion": ev.get("tipo_evaluacion", "diario"),
                "tipo_test": ev.get("tipo_test", "Test rápido"),
                "emocion_predominante": ev.get("emocion_detectada", "bienestar"),
                "puntaje_resumen": ev.get("predictive_target", ""),
                "requirio_atencion": ev.get("es_alerta_clinica", False),
                "texto_libre": ev.get("nlp_corpus", "")
            })
        
        return jsonify({
            "status": "success",
            "historial": historial_estandar
        }), 200
        
    except Exception as e:
        print(f"Error leyendo historial: {str(e)}")
        return jsonify({"error": "Error interno al obtener el historial."}), 500

PATH_DATASET_ENTRENAMIENTO = os.path.join('data', 'dataset_entrenamiento.json')

@app.route('/evaluaciones/feedback', methods=['POST'])
def registrar_feedback_evaluacion():
    try:
        data = request.json
        user_id = data.get('user_id')
        texto_libre = data.get('texto_libre', '').strip()
        emocion_predicha = data.get('emocion_predicha')
        emocion_corregida = data.get('emocion_corregida')

        if not user_id or not texto_libre or not emocion_corregida:
            return jsonify({"error": "Faltan datos obligatorios (user_id, texto_libre o emocion_corregida)."}), 400

        feedback_entry = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "texto_libre": texto_libre,
            "emocion_predicha": emocion_predicha,
            "emocion_corregida": emocion_corregida,
            "fecha": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        }

        os.makedirs('data', exist_ok=True)
        dataset = []
        if os.path.exists(PATH_DATASET_ENTRENAMIENTO):
            with open(PATH_DATASET_ENTRENAMIENTO, 'r', encoding='utf-8') as f:
                try:
                    dataset = json.load(f)
                except json.JSONDecodeError:
                    dataset = []

        dataset.append(feedback_entry)

        with open(PATH_DATASET_ENTRENAMIENTO, 'w', encoding='utf-8') as f:
            json.dump(dataset, f, ensure_ascii=False, indent=2)

        return jsonify({"status": "success", "mensaje": "Feedback guardado exitosamente."}), 200

    except Exception as e:
        print(f"Error registrando feedback: {str(e)}")
        return jsonify({"error": "Error interno al guardar feedback."}), 500

PATH_USUARIOS = os.path.join('data', 'usuarios.json')

@app.route('/registro', methods=['POST'])
def registro_usuario():
    try:
        data = request.json
        nombre = data.get('nombre', '').strip()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if not email or not password or not nombre:
            return jsonify({"error": "Faltan datos obligatorios"}), 400

        if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            return jsonify({"error": "Correo electrónico con formato inválido"}), 400

        os.makedirs('data', exist_ok=True)
        usuarios = []
        if os.path.exists(PATH_USUARIOS):
            with open(PATH_USUARIOS, 'r', encoding='utf-8') as f:
                usuarios = json.load(f)

        if any(u.get('email') == email for u in usuarios):
            return jsonify({"error": "Este correo electrónico ya se encuentra registrado"}), 409

        user_id = str(uuid.uuid4())
        nuevo_usuario = {
            "user_id": user_id,
            "nombre": nombre,
            "email": email,
            "password": password
        }
        usuarios.append(nuevo_usuario)

        with open(PATH_USUARIOS, 'w', encoding='utf-8') as f:
            json.dump(usuarios, f, ensure_ascii=False, indent=2)

        return jsonify({"status": "success", "user": {"user_id": user_id, "nombre": nombre, "email": email}}), 201
    except Exception as e:
        print(f"Error en registro: {e}")
        return jsonify({"error": "Error interno"}), 500

@app.route('/login', methods=['POST'])
def login_usuario():
    try:
        data = request.json
        email = data.get('email', '').strip().lower()
        password = data.get('password', '')

        if os.path.exists(PATH_USUARIOS):
            with open(PATH_USUARIOS, 'r', encoding='utf-8') as f:
                usuarios = json.load(f)
            for u in usuarios:
                if u.get('email') == email and u.get('password') == password:
                    return jsonify({"status": "success", "user": {"user_id": u["user_id"], "nombre": u["nombre"], "email": u["email"]}}), 200

        return jsonify({"error": "Credenciales inválidas"}), 401
    except Exception as e:
        print(f"Error en login: {e}")
        return jsonify({"error": "Error interno"}), 500


@app.route('/nivel_riesgo_acumulado', methods=['GET'])
def nivel_riesgo_acumulado():
    """Analiza los últimos registros y determina si el estado acumulado requiere atención."""
    try:
        path_evaluaciones = os.path.join('data', 'evaluaciones.json')
        if not os.path.exists(path_evaluaciones):
            return jsonify({"riesgo_critico": False, "razon": "Sin historial"}), 200

        with open(path_evaluaciones, 'r', encoding='utf-8') as f:
            evaluaciones = json.load(f)

        # Ordenar por fecha descendente y tomar las últimas 5
        evaluaciones.sort(
            key=lambda x: x.get('user_metadata', {}).get('fecha', ''),
            reverse=True
        )
        recientes = evaluaciones[:5]

        niveles_altos = sum(
            1 for ev in recientes
            if ev.get('predictive_target') in ['Bienestar Bajo', 'Bienestar Moderado']
        )
        emociones_criticas = sum(
            1 for ev in recientes
            if ev.get('emocion_detectada') in ['Depresión', 'Sobrecarga']
        )

        riesgo_critico = niveles_altos >= 2 or emociones_criticas >= 2
        razon = None
        if riesgo_critico:
            if emociones_criticas >= 2:
                razon = "Se han detectado señales de agotamiento emocional en tus registros recientes."
            else:
                razon = "Tu estado de bienestar ha sido bajo o moderado en los últimos registros."

        return jsonify({
            "riesgo_critico": riesgo_critico,
            "razon": razon
        }), 200

    except Exception as e:
        print(f"Error evaluando riesgo acumulado: {str(e)}")
        return jsonify({"error": "Error interno."}), 500


# ==========================================
# Rutas del Foro / Muro de Apoyo
# ==========================================

PATH_FORO = os.path.join('data', 'foro.json')

@app.route('/foro/mensajes', methods=['GET'])
def obtener_mensajes_foro():
    try:
        if not os.path.exists(PATH_FORO):
            return jsonify({"status": "success", "mensajes": []}), 200
        with open(PATH_FORO, 'r', encoding='utf-8') as f:
            mensajes = json.load(f)
        return jsonify({"status": "success", "mensajes": mensajes}), 200
    except Exception as e:
        print(f"Error obteniendo foro: {e}")
        return jsonify({"error": "Error interno"}), 500

@app.route('/foro/mensajes', methods=['POST'])
def publicar_mensaje_foro():
    try:
        data = request.get_json()
        if not data or not data.get('autor') or not data.get('texto'):
            return jsonify({"error": "Faltan datos (autor y texto requeridos)"}), 400
        
        nuevo_mensaje = {
            "id": str(uuid.uuid4()),
            "autor": data['autor'],
            "texto": data['texto'],
            "fecha": datetime.now(timezone.utc).isoformat(),
            "respuestas": []
        }

        if not os.path.exists('data'):
            os.makedirs('data')
            
        mensajes = []
        if os.path.exists(PATH_FORO):
            with open(PATH_FORO, 'r', encoding='utf-8') as f:
                mensajes = json.load(f)
                
        parent_id = data.get('parent_id')
        if parent_id:
            encontrado = False
            for m in mensajes:
                if m.get('id') == parent_id:
                    if 'respuestas' not in m:
                        m['respuestas'] = []
                    m['respuestas'].append(nuevo_mensaje)
                    encontrado = True
                    break
            if not encontrado:
                return jsonify({"error": "Mensaje principal no encontrado"}), 404
        else:
            mensajes.insert(0, nuevo_mensaje) # Más recientes arriba
        
        with open(PATH_FORO, 'w', encoding='utf-8') as f:
            json.dump(mensajes, f, ensure_ascii=False, indent=4)
            
        return jsonify({"status": "success", "mensaje": nuevo_mensaje}), 201
    except Exception as e:
        print(f"Error publicando en foro: {e}")
        return jsonify({"error": "Error interno"}), 500

@app.route('/foro/mensajes/<mensaje_id>', methods=['DELETE'])
def eliminar_mensaje_foro(mensaje_id):
    try:
        if not os.path.exists(PATH_FORO):
            return jsonify({"error": "No hay mensajes"}), 404
            
        with open(PATH_FORO, 'r', encoding='utf-8') as f:
            mensajes = json.load(f)
            
        nuevo_mensajes = []
        eliminado = False
        
        for m in mensajes:
            if m.get('id') == mensaje_id:
                eliminado = True
                continue 
                
            if 'respuestas' in m:
                res_len = len(m['respuestas'])
                m['respuestas'] = [r for r in m['respuestas'] if r.get('id') != mensaje_id]
                if len(m['respuestas']) < res_len:
                    eliminado = True
            
            nuevo_mensajes.append(m)
            
        if not eliminado:
            return jsonify({"error": "Mensaje no encontrado"}), 404
            
        with open(PATH_FORO, 'w', encoding='utf-8') as f:
            json.dump(nuevo_mensajes, f, ensure_ascii=False, indent=4)
            
        return jsonify({"status": "success", "mensaje": "Eliminado correctamente"}), 200
    except Exception as e:
        print(f"Error eliminando en foro: {e}")
        return jsonify({"error": "Error interno"}), 500

@app.route('/foro/mensajes/<mensaje_id>', methods=['PUT'])
def editar_mensaje_foro(mensaje_id):
    try:
        data = request.get_json()
        if not data or not data.get('texto'):
            return jsonify({"error": "Faltan datos (texto requerido)"}), 400
            
        if not os.path.exists(PATH_FORO):
            return jsonify({"error": "No hay mensajes"}), 404
            
        with open(PATH_FORO, 'r', encoding='utf-8') as f:
            mensajes = json.load(f)
            
        editado = False
        
        for m in mensajes:
            if m.get('id') == mensaje_id:
                m['texto'] = data['texto']
                m['editado'] = True
                editado = True
                break
                
            if 'respuestas' in m:
                for r in m['respuestas']:
                    if r.get('id') == mensaje_id:
                        r['texto'] = data['texto']
                        r['editado'] = True
                        editado = True
                        break
                if editado:
                    break
            
        if not editado:
            return jsonify({"error": "Mensaje no encontrado"}), 404
            
        with open(PATH_FORO, 'w', encoding='utf-8') as f:
            json.dump(mensajes, f, ensure_ascii=False, indent=4)
            
        return jsonify({"status": "success", "mensaje": "Editado correctamente"}), 200
    except Exception as e:
        print(f"Error editando en foro: {e}")
        return jsonify({"error": "Error interno"}), 500


if __name__ == '__main__':
    # host='0.0.0.0' permite la conexión del teléfono a la IP de la PC [Chat History]
    app.run(debug=True, host='0.0.0.0', port=5000)
