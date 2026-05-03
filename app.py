import nltk
import torch
import re
import json
import os
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
    """Clasifica el relato usando el modelo entrenado con fundamento científico [2, 7]."""
    texto_limpio = limpiar_texto(texto_relato)
    
    # Tokenización con truncamiento para BERT [8, 9]
    inputs = tokenizer(texto_limpio, return_tensors="pt", truncation=True, padding=True, max_length=128)
    
    with torch.no_grad():
        outputs = modelo_ia(**inputs)
        logits = outputs.logits
        predicted_class_id = torch.argmax(logits, dim=1).item()
    
    return id_to_class[str(predicted_class_id)]

# ==========================================
# 3. Rutas de la API (Interoperabilidad)
# ==========================================

@app.route('/analizar_emocion', methods=['POST'])
def analizar_emocion():
    try:
        data = request.json
        relato_cuidador = data.get('texto_narrativo', '')
        puntaje_likert = data.get('puntos_sobrecarga', 0)

        # 1. Tu predicción IA actual (la que ya te funciona)
        clase_detectada = predecir_emocion(relato_cuidador)
        
        # --- AJUSTE PARA CORREGIR DETECCIÓN ERRÓNEA ---
        texto_comparar = relato_cuidador.lower()
        palabras_bienestar = ["bien", "descansada", "excelente", "feliz", "tranquila"]
        
        # Si el usuario dice que está bien y el Likert es bajo, ignoramos el error de la IA
        if any(p in texto_comparar for p in palabras_bienestar) and puntaje_likert <= 2:
            clase_detectada = "Resiliencia"
        # ----------------------------------------------

        # 2. Generación de respuesta (Tu lógica original)
        if "Resiliencia" in clase_detectada:
            mensaje_ia = f"Es gratificante leer que te sientes con '{clase_detectada}'. El descanso es vital."
        elif "Depresión" in clase_detectada:
            mensaje_ia = "He detectado señales de tristeza profunda. No estás solo."
        elif "Sobrecarga" in clase_detectada:
            mensaje_ia = "Se perciben niveles de agotamiento. Tu bienestar es prioridad."
        else:
            mensaje_ia = f"Se perciben señales de '{clase_detectada}'."

        es_alerta_clinica = clase_detectada in ["Sobrecarga", "Depresión"] or puntaje_likert >= 4
        
        print(f"Relato: {relato_cuidador} | Predicción final: {clase_detectada} | Likert: {puntaje_likert}")

        
        return jsonify({
            "status": "procesado",
            "mensaje_ia": mensaje_ia,
            "deteccion": clase_detectada,
            "es_alerta": es_alerta_clinica
        }), 200

    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({"error": "Error interno en el análisis de IA"}), 500

# ==========================================
# 4. Módulo de Evaluación de Salud Mental
# ==========================================

# Definición de dimensiones e ítems para ML
ITEMS_EVALUACION = {
    1: {"dimension": "Depresión", "label": "¿Has sentido poco interés o placer en hacer las cosas que te gustan?"},
    2: {"dimension": "Depresión", "label": "¿Te ha costado tomar la iniciativa o has sentido que te falta energía?"},
    3: {"dimension": "Depresión", "label": "¿Te has sentido decaído, triste o sin muchas esperanzas?"},
    4: {"dimension": "Depresión", "label": "¿Has sentido que no haces lo suficiente o te has sentido culpable?"},
    5: {"dimension": "Ansiedad", "label": "¿Has notado la boca seca o algún temblor físico sin razón aparente?"},
    6: {"dimension": "Ansiedad", "label": "¿Te has sentido inquieto o te ha costado quedarte quieto?"},
    7: {"dimension": "Ansiedad", "label": "¿Te has preocupado demasiado por diferentes cosas del día a día?"},
    8: {"dimension": "Ansiedad", "label": "¿Has sentido mucho miedo de repente o como si algo malo fuera a pasar?"},
    9: {"dimension": "Estrés", "label": "¿Te has sentido más irritable o te has enojado con facilidad?"},
    10: {"dimension": "Estrés", "label": "¿Te ha costado relajarte incluso después de haber terminado tus tareas?"},
    11: {"dimension": "Estrés", "label": "¿Has sentido mucha tensión o los nervios de punta?"},
    12: {"dimension": "Estrés", "label": "¿Sientes que has reaccionado de forma exagerada ante algunas situaciones?"},
    13: {"dimension": "Carga del Cuidador", "label": "¿Sientes que cuidar te consume demasiada energía últimamente?"},
    14: {"dimension": "Carga del Cuidador", "label": "¿Has sentido mucha carga física o mental acumulada por tus labores de cuidado?"},
    15: {"dimension": "Carga del Cuidador", "label": "¿Sientes que casi no tienes tiempo libre para ti mismo?"}
}

@app.route('/evaluacion_mental', methods=['POST'])
def evaluacion_mental():
    try:
        data = request.json
        respuestas = data.get('respuestas', [])
        comentarios_generales = data.get('comentarios_generales', '')
        user_id = data.get('user_id', str(uuid.uuid4()))
        ubicacion = data.get('ubicacion', 'Desconocida')

        if not respuestas or len(respuestas) != 15:
            return jsonify({"error": "Se requieren exactamente 15 respuestas."}), 400

        puntajes_por_dimension = {
            "Depresión": 0,
            "Ansiedad": 0,
            "Estrés": 0,
            "Carga del Cuidador": 0
        }

        puntaje_total = 0
        item_scores = []

        # Procesar cada respuesta
        for r in respuestas:
            item_id = int(r.get('item_id'))
            score = int(r.get('score', 0))
            
            # Limitar el score a 0-4
            score = max(0, min(4, score))
            puntaje_total += score

            if item_id in ITEMS_EVALUACION:
                dimension = ITEMS_EVALUACION[item_id]["dimension"]
                label = ITEMS_EVALUACION[item_id]["label"]
                puntajes_por_dimension[dimension] += score
                
                item_scores.append({
                    "item_id": item_id,
                    "label": label,
                    "score": score,
                    "dimension": dimension
                })

        # Análisis NLP del texto de desahogo
        clase_detectada = "No detectada"
        if comentarios_generales.strip():
            clase_detectada = predecir_emocion(comentarios_generales)

        # Trigger Alerta Clínica (Umbral de 70% sobre un max de 16 para Depresión y Ansiedad = 11.2)
        es_alerta_clinica = False
        if puntajes_por_dimension["Depresión"] > 11 or puntajes_por_dimension["Ansiedad"] > 11:
            es_alerta_clinica = True

        # Clasificación de riesgo (Bajo, Medio, Alto, Crítico)
        if puntaje_total <= 15:
            riesgo = "Bajo"
        elif puntaje_total <= 25:
            riesgo = "Medio"
        elif puntaje_total < 40 and not es_alerta_clinica:
            riesgo = "Alto"
        else:
            riesgo = "Crítico"

        # Identificación de Patrones Longitudinales (Simulado con BERT)
        if clase_detectada in ["Sobrecarga", "Depresión"] and riesgo in ["Medio", "Alto"]:
            riesgo = "Crítico" if riesgo == "Alto" else "Alto"

        # Evaluación Multidimensional
        # Obtenemos el score de la pregunta 3 para la dimensión Espiritual
        score_p3 = next((int(r.get('score', 0)) for r in respuestas if int(r.get('item_id')) == 3), 0)
        
        resumen_dimensiones = {
            "Física": "Indicadores de fatiga y tensión física severa." if puntajes_por_dimension["Carga del Cuidador"] > 6 else "Estado físico reportado estable, sin tensión severa.",
            "Psicológica": "Niveles elevados de estrés cognitivo y ansiedad detectados." if (puntajes_por_dimension["Ansiedad"] + puntajes_por_dimension["Estrés"]) > 15 else "Carga psicológica en rangos manejables.",
            "Emocional": "Signos de tristeza profunda, soledad o desánimo." if puntajes_por_dimension["Depresión"] > 8 or clase_detectada == "Depresión" else "Equilibrio emocional relativo.",
            "Espiritual": "Posible pérdida de esperanza o sentido de propósito." if score_p3 >= 3 else "Sentido de propósito y esperanza preservados."
        }

        # Protocolo de Intervención (Nivel de Riesgo Alto/Crítico)
        guia_respiracion = None
        if riesgo in ["Alto", "Crítico"]:
            guia_respiracion = {
                "titulo": "Guía de Respiración de Emergencia (Técnica 4-7-8)",
                "instrucciones": [
                    "1. Inhala profundamente por la nariz durante 4 segundos.",
                    "2. Mantén la respiración durante 7 segundos.",
                    "3. Exhala lentamente por la boca, haciendo un sonido de soplido, durante 8 segundos."
                ]
            }

        # Formato de Salida de Datos (ML Ready)
        evaluacion_ml_ready = {
            "user_metadata": {
                "id": user_id,
                "fecha": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                "ubicacion": ubicacion
            },
            "item_scores": item_scores,
            "nlp_corpus": comentarios_generales,
            "predictive_target": riesgo,
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
            "puntaje_total": puntaje_total,
            "riesgo": riesgo,
            "es_alerta_clinica": es_alerta_clinica,
            "resumen_dimensiones": resumen_dimensiones,
            "guia_respiracion": guia_respiracion,
            "mensaje": "Evaluación procesada y guardada correctamente."
        }), 200

    except Exception as e:
        print(f"Error procesando evaluación: {str(e)}")
        return jsonify({"error": "Error interno en el servidor."}), 500

if __name__ == '__main__':
    # host='0.0.0.0' permite la conexión del teléfono a la IP de la PC [Chat History]
    app.run(debug=True, host='0.0.0.0', port=5000)
