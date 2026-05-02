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

if __name__ == '__main__':
    # host='0.0.0.0' permite la conexión del teléfono a la IP de la PC [Chat History]
    app.run(debug=True, host='0.0.0.0', port=5000)
