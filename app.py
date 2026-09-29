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
from datetime import datetime, timezone
import uuid

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
    
    return clase_detectada, nivel_sobrecarga

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
        clase_detectada, nivel_sobrecarga = predecir_emocion(relato_cuidador)
        
        # --- AJUSTE PARA CORREGIR DETECCIÓN ERRÓNEA ---
        texto_comparar = relato_cuidador.lower()
        palabras_bienestar = ["bien", "descansada", "excelente", "feliz", "tranquila"]
        
        # Si el usuario dice que está bien y el Likert es bajo, ignoramos el error de la IA
        if any(p in texto_comparar for p in palabras_bienestar) and puntaje_likert <= 2:
            clase_detectada = "Resiliencia"
            nivel_sobrecarga = "No sobrecarga"
        # ----------------------------------------------

        # 2. Generación de respuesta (Personalizada)
        if "Resiliencia" in clase_detectada:
            mensaje_ia = f"Hola {nombre_usuario}, es gratificante leer que te sientes con '{clase_detectada}'. El descanso es vital."
        elif "Depresión" in clase_detectada:
            mensaje_ia = f"Hola {nombre_usuario}, he detectado señales de tristeza profunda. Cuentas con nuestro apoyo."
        elif "Sobrecarga" in clase_detectada:
            mensaje_ia = f"Hola {nombre_usuario}, parece que hoy ha sido un día pesado. Se perciben niveles de agotamiento ({nivel_sobrecarga}). Tu bienestar es prioridad."
        else:
            mensaje_ia = f"Hola {nombre_usuario}, se perciben señales de '{clase_detectada}'."

        es_alerta_clinica = clase_detectada in ["Sobrecarga", "Depresión"] or nivel_sobrecarga == "Sobrecarga intensa" or puntaje_likert >= 4
        
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
        clase_detectada = "No detectada"
        nivel_sobrecarga_ml = "No calculable"
        if comentarios_generales.strip():
            clase_detectada, nivel_sobrecarga_ml = predecir_emocion(comentarios_generales)

        # Trigger Alerta
        es_alerta_clinica = False
        if estado_bienestar in ["Bienestar Moderado", "Bienestar Bajo"] or clase_detectada in ["Sobrecarga", "Depresión"]:
            es_alerta_clinica = True

        # Generación de mensaje personalizado (Cambiado 'registro' a 'Diario')
        if "Resiliencia" in clase_detectada or (clase_detectada == "No detectada" and estado_bienestar == "Bienestar Alto"):
            mensaje_ia = f"Hola {nombre_usuario}, nos alegra ver que te encuentras en un buen estado. Sigue cuidándote."
        elif "Depresión" in clase_detectada:
            mensaje_ia = f"Hola {nombre_usuario}, hemos notado señales de decaimiento en tu Diario. Cuentas con nuestro apoyo."
        elif estado_bienestar in ["Bienestar Moderado", "Bienestar Bajo"] or clase_detectada == "Sobrecarga":
            mensaje_ia = f"Hola {nombre_usuario}, parece que hoy ha sido un día pesado. Tienes un estado de {estado_bienestar}. Tu bienestar es prioridad."
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
            "nlp_corpus": comentarios_generales,
            "predictive_target": estado_bienestar,
            "emocion_detectada": clase_detectada,
            "dimensiones_evaluadas": resumen_dimensiones,
            "intervencion": guia_respiracion
        }

        # Guardar en archivo JSON local
        path_evaluaciones = os.path.join('data', 'evaluaciones.json')
        # Crear data/ si no existe
        os.makedirs('data', exist_ok=True)
        
        evaluaciones_existentes = []
        if os.path.exists(path_evaluaciones):
            try:
                with open(path_evaluaciones, 'r', encoding='utf-8') as f:
                    evaluaciones_existentes = json.load(f)
            except json.JSONDecodeError:
                pass # Si el archivo está vacío o corrupto, lo inicializamos de nuevo

        evaluaciones_existentes.append(evaluacion_ml_ready)

        with open(path_evaluaciones, 'w', encoding='utf-8') as f:
            json.dump(evaluaciones_existentes, f, ensure_ascii=False, indent=2)

        return jsonify({
            "status": "success",
            "puntaje_total": puntaje_proporcional,
            "estado_bienestar": estado_bienestar,
            "es_alerta_clinica": es_alerta_clinica,
            "resumen_dimensiones": resumen_dimensiones,
            "guia_respiracion": guia_respiracion,
            "mensaje": "Registro procesado y guardado correctamente.",
            "mensaje_ia": mensaje_ia
        }), 200

    except Exception as e:
        print(f"Error procesando evaluación: {str(e)}")
        return jsonify({"error": "Error interno en el servidor."}), 500

@app.route('/historial_evaluaciones', methods=['GET'])
def historial_evaluaciones():
    try:
        path_evaluaciones = os.path.join('data', 'evaluaciones.json')
        if not os.path.exists(path_evaluaciones):
            return jsonify({"status": "success", "historial": []}), 200
            
        with open(path_evaluaciones, 'r', encoding='utf-8') as f:
            evaluaciones = json.load(f)
            
        # Ordenar por fecha descendente
        evaluaciones.sort(
            key=lambda x: x.get('user_metadata', {}).get('fecha', ''),
            reverse=True
        )
        
        # Devolver las últimas 50
        return jsonify({
            "status": "success",
            "historial": evaluaciones[:50]
        }), 200
        
    except Exception as e:
        print(f"Error leyendo historial: {str(e)}")
        return jsonify({"error": "Error interno al obtener el historial."}), 500


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
