import os
import json

def limpiar_json(filepath):
    if os.path.exists(filepath):
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump([], f, ensure_ascii=False, indent=2)
        print(f"✅ Limpiado: {filepath}")
    else:
        print(f"⚠️ No encontrado: {filepath} (se creará vacío cuando la app lo necesite)")

def purgar_datos_prueba():
    print("Iniciando limpieza de la base de datos (JSON)...")
    path_evaluaciones = os.path.join('data', 'evaluaciones.json')
    path_foro = os.path.join('data', 'foro.json')
    
    limpiar_json(path_evaluaciones)
    limpiar_json(path_foro)
    print("Limpieza de backend completada con éxito.")
    print("\nNOTA: Los registros de 'racha' se guardan localmente en el dispositivo (AsyncStorage).")
    print("Para reiniciar la racha a 0 en el frontend, debes borrar los datos de la app CuidaML o reinstalarla.")

if __name__ == '__main__':
    purgar_datos_prueba()
