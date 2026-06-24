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

# Definición de ítems para la Escala de Zarit (15 ítems)
ITEMS_EVALUACION = {
    1: {"dimension": "Tiempo/Carga", "label": "¿Sientes que cuidar a esta persona ocupa gran parte de tu tiempo?"},
    2: {"dimension": "Psicológica", "label": "¿Te sientes estresado/a al intentar equilibrar el cuidado con otras responsabilidades?"},
    3: {"dimension": "Tiempo/Carga", "label": "¿Sientes que no tienes suficiente tiempo para ti?"},
    4: {"dimension": "Física", "label": "¿Te has sentido agotado/a física o emocionalmente por cuidar?"},
    5: {"dimension": "Social", "label": "¿Sientes que tu vida social se ha visto afectada por el cuidado?"},
    6: {"dimension": "Social", "label": "¿Te sientes incómodo/a al invitar personas a casa por la situación de cuidado?"},
    7: {"dimension": "Relacional", "label": "¿Sientes que la persona que cuidas depende demasiado de ti?"},
    8: {"dimension": "Psicológica", "label": "¿Te preocupa no estar haciendo lo suficiente o hacerlo mal?"},
    9: {"dimension": "Emocional", "label": "¿Te has sentido tenso/a o irritable con frecuencia?"},
    10: {"dimension": "Física", "label": "¿Sientes que tu salud se ha visto afectada por el cuidado?"},
    11: {"dimension": "Psicológica", "label": "¿Sientes que has perdido control sobre tu vida desde que cuidas?"},
    12: {"dimension": "Tiempo/Carga", "label": "¿Te gustaría poder delegar el cuidado a alguien más?"},
    13: {"dimension": "Relacional", "label": "¿Sientes que la relación con la persona que cuidas se ha vuelto difícil?"},
    14: {"dimension": "Emocional", "label": "¿Sientes culpa por cómo manejas el cuidado?"},
    15: {"dimension": "Tiempo/Carga", "label": "¿Sientes que cuidar es una carga pesada para ti?"}
}

from adaptive_sampling import AdaptativeSampler
sampler_ema = AdaptativeSampler(ITEMS_EVALUACION)

@app.route('/preguntas_diarias', methods=['POST'])
def preguntas_diarias():
    try:
        data = request.json or {}
        inferencia_reciente = data.get('ultima_inferencia', 'No detectada')
        # Usamos el login_count para rotar preguntas
        dia_rotacion = data.get('login_count', datetime.now(timezone.utc).timetuple().tm_yday)
        
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

        puntajes_por_dimension = {
            "Física": 0,
            "Psicológica": 0,
            "Emocional": 0,
            "Tiempo/Carga": 0,
            "Social": 0,
            "Relacional": 0
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
        nivel_sobrecarga_ml = "No calculable"
        if comentarios_generales.strip():
            clase_detectada, nivel_sobrecarga_ml = predecir_emocion(comentarios_generales)

        # Calcular puntaje proporcional (proyectado a 60 para mantener cortes de Zarit)
        max_posible_score = len(respuestas) * 4
        puntaje_proporcional = (puntaje_total / max_posible_score) * 60 if max_posible_score > 0 else 0

        # Lógica de Promedio Móvil para Monitoreo Diario
        puntaje_evaluar = puntaje_proporcional
        if tipo_evaluacion == 'diario':
            path_evaluaciones = os.path.join('data', 'evaluaciones.json')
            if os.path.exists(path_evaluaciones):
                try:
                    with open(path_evaluaciones, 'r', encoding='utf-8') as f:
                        historial = json.load(f)
                    
                    # Filtrar por usuario y últimos 7 días
                    ahora = datetime.now(timezone.utc)
                    puntajes_recientes = []
                    for ev in historial:
                        if ev.get("user_metadata", {}).get("id") == user_id:
                            fecha_str = ev.get("user_metadata", {}).get("fecha")
                            if fecha_str:
                                try:
                                    fecha_ev = datetime.fromisoformat(fecha_str.replace('Z', '+00:00'))
                                    dias_dif = (ahora - fecha_ev).days
                                    if 0 <= dias_dif <= 7:
                                        # Obtener el puntaje proporcional histórico (o calcularlo de sus items)
                                        p_prop = ev.get("puntaje_proporcional")
                                        if p_prop is None:
                                            # Fallback si no estaba guardado
                                            p_total = sum(i.get("score", 0) for i in ev.get("item_scores", []))
                                            m_score = len(ev.get("item_scores", [])) * 4
                                            p_prop = (p_total / m_score) * 60 if m_score > 0 else 0
                                        puntajes_recientes.append(p_prop)
                                except Exception:
                                    pass
                    
                    if puntajes_recientes:
                        # Promedio de los últimos 7 días + el actual
                        puntaje_evaluar = (sum(puntajes_recientes) + puntaje_proporcional) / (len(puntajes_recientes) + 1)
                except Exception as e:
                    print(f"Error leyendo historial para promedio móvil: {str(e)}")

        # Clasificación de estado de bienestar (Escala Zarit 0-60)
        if puntaje_evaluar <= 32:
            estado_bienestar = "Bienestar Alto"
        elif puntaje_evaluar <= 46:
            estado_bienestar = "Bienestar Moderado"
        else:
            estado_bienestar = "Bienestar Bajo"

        # Trigger Alerta
        es_alerta_clinica = False
        if estado_bienestar in ["Bienestar Moderado", "Bienestar Bajo"] or clase_detectada in ["Sobrecarga", "Depresión"]:
            es_alerta_clinica = True

        # Generación de mensaje personalizado
        if "Resiliencia" in clase_detectada or (clase_detectada == "No detectada" and estado_bienestar == "Bienestar Alto"):
            mensaje_ia = f"Hola {nombre_usuario}, nos alegra ver que te encuentras en un buen estado. Sigue cuidándote."
        elif "Depresión" in clase_detectada:
            mensaje_ia = f"Hola {nombre_usuario}, hemos notado señales de decaimiento en tu registro. Cuentas con nuestro apoyo."
        elif estado_bienestar in ["Bienestar Moderado", "Bienestar Bajo"] or clase_detectada == "Sobrecarga":
            mensaje_ia = f"Hola {nombre_usuario}, parece que hoy ha sido un día pesado. Tienes un estado de {estado_bienestar}. Tu bienestar es prioridad."
        else:
            mensaje_ia = f"Hola {nombre_usuario}, gracias por completar tu registro diario."

        # Resumen Multidimensional
        resumen_dimensiones = {
            "Física": "Se detecta agotamiento físico." if puntajes_por_dimension["Física"] > 4 else "Estado físico reportado estable.",
            "Psicológica": "Niveles elevados de estrés y preocupación." if puntajes_por_dimension["Psicológica"] > 6 else "Carga psicológica en rangos manejables.",
            "Emocional": "Presencia de culpa o irritabilidad frecuente." if puntajes_por_dimension["Emocional"] > 4 else "Equilibrio emocional relativo."
        }

        # Protocolo de Intervención (Bienestar Moderado/Bajo)
        guia_respiracion = None
        if estado_bienestar in ["Bienestar Moderado", "Bienestar Bajo"]:
            guia_respiracion = {
                "titulo": "Respiración (Técnica 4-7-8)",
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
                "nombre": nombre_usuario,
                "fecha": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
                "ubicacion": ubicacion
            },
            "item_scores": item_scores,
            "puntaje_proporcional": puntaje_proporcional,
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
            "puntaje_total": puntaje_total,
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


if __name__ == '__main__':
    # host='0.0.0.0' permite la conexión del teléfono a la IP de la PC [Chat History]
    app.run(debug=True, host='0.0.0.0', port=5000)
