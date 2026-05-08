import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, StyleSheet } from 'react-native';
import { globalStyles, theme } from './src/styles/theme';

interface EvaluacionResult {
  riesgo: string;
  puntaje_total: number;
  es_alerta_clinica: boolean;
  mensaje_ia?: string;
  resumen_dimensiones?: {
    Física: string;
    Psicológica: string;
    Emocional: string;
    Espiritual: string;
  };
  guia_respiracion?: {
    titulo: string;
    instrucciones: string[];
  };
}

const PREGUNTAS = [
  { id: 1, text: "¿Sientes que cuidar a esta persona ocupa gran parte de tu tiempo?" },
  { id: 2, text: "¿Te sientes estresado/a al intentar equilibrar el cuidado con otras responsabilidades?" },
  { id: 3, text: "¿Sientes que no tienes suficiente tiempo para ti?" },
  { id: 4, text: "¿Te has sentido agotado/a física o emocionalmente por cuidar?" },
  { id: 5, text: "¿Sientes que tu vida social se ha visto afectada por el cuidado?" },
  { id: 6, text: "¿Te sientes incómodo/a al invitar personas a casa por la situación de cuidado?" },
  { id: 7, text: "¿Sientes que la persona que cuidas depende demasiado de ti?" },
  { id: 8, text: "¿Te preocupa no estar haciendo lo suficiente o hacerlo mal?" },
  { id: 9, text: "¿Te has sentido tenso/a o irritable con frecuencia?" },
  { id: 10, text: "¿Sientes que tu salud se ha visto afectada por el cuidado?" },
  { id: 11, text: "¿Sientes que has perdido control sobre tu vida desde que cuidas?" },
  { id: 12, text: "¿Te gustaría poder delegar el cuidado a alguien más?" },
  { id: 13, text: "¿Sientes que la relación con la persona que cuidas se ha vuelto difícil?" },
  { id: 14, text: "¿Sientes culpa por cómo manejas el cuidado?" },
  { id: 15, text: "¿Sientes que cuidar es una carga pesada para ti?" }
];

export default function App() {
  const [tipoEvaluacion, setTipoEvaluacion] = useState<'diario' | 'baseline'>('diario');

  // Estado para la evaluación de salud mental
  const [respuestas, setRespuestas] = useState<Record<number, number>>({});
  const [comentarios, setComentarios] = useState<string>('');
  const [nombreUsuario, setNombreUsuario] = useState<string>('');
  const [resultadoEval, setResultadoEval] = useState<EvaluacionResult | null>(null);
  const [preguntasActivas, setPreguntasActivas] = useState(PREGUNTAS);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const fetchPreguntas = async () => {
      try {
        const response = await fetch('http://localhost:5000/preguntas_diarias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await response.json();
        if (data.preguntas && data.preguntas.length > 0) {
          setPreguntasActivas(data.preguntas);
        }
      } catch (e) {
        console.warn("No se pudo cargar EMA, usando fallback.");
      }
    };
    fetchPreguntas();
  }, []);

  const handleSeleccion = (preguntaId: number, valor: number) => {
    setRespuestas(prev => ({ ...prev, [preguntaId]: valor }));
  };

  const enviarEvaluacion = async () => {
    if (Object.keys(respuestas).length < preguntasActivas.length) {
      Alert.alert("Faltan preguntas", `Por favor responde las ${preguntasActivas.length} preguntas antes de enviar.`);
      return;
    }

    if (!comentarios.trim()) {
      Alert.alert("Espacio de desahogo", "Por favor tómate un momento para escribir cómo te sientes en la caja de texto al final. Este espacio es para ti.");
      return;
    }

    const payload = {
      respuestas: Object.keys(respuestas).map(id => ({
        item_id: parseInt(id),
        score: respuestas[parseInt(id)]
      })),
      comentarios_generales: comentarios,
      nombre_usuario: nombreUsuario.trim() || 'Cuidador',
      tipo_evaluacion: tipoEvaluacion
    };

    try {
      const response = await fetch('http://localhost:5000/evaluacion_mental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.error) {
        Alert.alert("Error", data.error);
      } else {
        setResultadoEval(data as EvaluacionResult);
        setRespuestas({});
        setComentarios('');

        // Esperar a que el layout se actualice con la tarjeta de resultado antes de hacer scroll
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }, 100);

        Alert.alert("¡Gracias!", "Tu registro ha sido guardado correctamente.");
      }
    } catch (e) {
      Alert.alert("Error de Conexión", "No se pudo conectar con el servidor Flask.");
    }
  };

  const preguntasAMostrar = tipoEvaluacion === 'baseline' ? PREGUNTAS : preguntasActivas;

  const renderEvaluacion = () => (
    <ScrollView
      ref={scrollViewRef}
      contentContainerStyle={globalStyles.container}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20, marginTop: 10 }}>
        <TouchableOpacity 
          style={[styles.tabBtn, tipoEvaluacion === 'diario' && styles.tabBtnActive]}
          onPress={() => { setTipoEvaluacion('diario'); setRespuestas({}); setResultadoEval(null); }}
        >
          <Text style={[styles.tabText, tipoEvaluacion === 'diario' && styles.tabTextActive]}>Check-in Diario</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, tipoEvaluacion === 'baseline' && styles.tabBtnActive]}
          onPress={() => { setTipoEvaluacion('baseline'); setRespuestas({}); setResultadoEval(null); }}
        >
          <Text style={[styles.tabText, tipoEvaluacion === 'baseline' && styles.tabTextActive]}>Test Completo</Text>
        </TouchableOpacity>
      </View>

      <Text style={[globalStyles.headerTitle, { textAlign: 'center', marginBottom: 20 }]}>
        {tipoEvaluacion === 'diario' ? 'Hoy queremos saber cómo estás 💛 (30 segundos)' : 'Evaluación Completa de Bienestar'}
      </Text>

      <View style={[globalStyles.card, { padding: 15, marginBottom: 15 }]}>
        <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', marginBottom: 5 }]}>
          ¿Cuál es tu nombre?
        </Text>
        <TextInput
          placeholder="Tu nombre (opcional)"
          placeholderTextColor="#A0A0A0"
          value={nombreUsuario}
          onChangeText={setNombreUsuario}
          style={[globalStyles.bodyText, globalStyles.inputArea, { minHeight: 45, padding: 10, marginBottom: 5 }]}
        />
      </View>

      <View style={[globalStyles.card, { padding: 15, marginBottom: 15 }]}>
        <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', textAlign: 'center', marginBottom: 5 }]}>
          Escala de Respuestas:
        </Text>
        <Text style={[globalStyles.bodyText, { fontSize: 13, textAlign: 'center' }]}>
          0: Nunca  |  1: Rara vez  |  2: Algunas veces
        </Text>
        <Text style={[globalStyles.bodyText, { fontSize: 13, textAlign: 'center' }]}>
          3: Bastantes veces  |  4: Casi siempre
        </Text>
      </View>

      {resultadoEval && (
        <View style={[globalStyles.card, {
          backgroundColor:
            resultadoEval.riesgo === 'Alta' ? (theme.colors.alertIntense || '#1D4ED8') :
              resultadoEval.riesgo === 'Moderada' ? '#3B82F6' :
                resultadoEval.riesgo === 'Leve' ? '#93C5FD' :
                  (theme.colors.primaryPastel || '#DBEAFE')
        }]}>
          <Text style={[globalStyles.headerTitle, { fontSize: 18, color: '#FFF' }]}>
            Nivel de Riesgo: {resultadoEval.riesgo}
          </Text>

          {resultadoEval.mensaje_ia && (
            <Text style={{ color: '#FFF', fontFamily: 'Nunito-Bold', fontSize: 15, marginTop: 10, textAlign: 'center' }}>
              {resultadoEval.mensaje_ia}
            </Text>
          )}

          {resultadoEval.guia_respiracion && (
            <View style={{ marginTop: 15, padding: 15, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10 }}>
              <Text style={{ color: '#FFF', fontFamily: 'Nunito-Bold', fontSize: 16, marginBottom: 5 }}>
                ⚠️ {resultadoEval.guia_respiracion.titulo}
              </Text>
              <Text style={{ color: '#FFF', fontFamily: 'Nunito-Regular', marginBottom: 10, fontSize: 12 }}>
                Hemos detectado niveles altos de sobrecarga. Por favor, antes de continuar, acompáñame en este ejercicio:
              </Text>
              {resultadoEval.guia_respiracion.instrucciones.map((inst: string, idx: number) => (
                <Text key={idx} style={{ color: '#FFF', fontFamily: 'Nunito-Bold', marginTop: 5 }}>
                  {inst}
                </Text>
              ))}
            </View>
          )}

          {resultadoEval.resumen_dimensiones && (
            <View style={{ marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
              <Text style={{ color: '#FFF', fontFamily: 'Nunito-Bold', marginBottom: 5 }}>Resumen de Bienestar:</Text>
              <Text style={{ color: '#FFF', fontFamily: 'Nunito-Regular', fontSize: 13, marginBottom: 3 }}>• Física: {resultadoEval.resumen_dimensiones["Física"]}</Text>
              <Text style={{ color: '#FFF', fontFamily: 'Nunito-Regular', fontSize: 13, marginBottom: 3 }}>• Psicológica: {resultadoEval.resumen_dimensiones["Psicológica"]}</Text>
              <Text style={{ color: '#FFF', fontFamily: 'Nunito-Regular', fontSize: 13, marginBottom: 3 }}>• Emocional: {resultadoEval.resumen_dimensiones["Emocional"]}</Text>
              <Text style={{ color: '#FFF', fontFamily: 'Nunito-Regular', fontSize: 13, marginBottom: 3 }}>• Espiritual: {resultadoEval.resumen_dimensiones["Espiritual"]}</Text>
            </View>
          )}

          {resultadoEval.es_alerta_clinica && !resultadoEval.guia_respiracion && (
            <Text style={{ color: '#FFF', fontFamily: 'Nunito-Bold', marginTop: 15, textAlign: 'center' }}>
              Te recomendamos tomar un descanso o buscar apoyo. Cuidar de ti es lo más importante.
            </Text>
          )}
        </View>
      )}

      {preguntasAMostrar.map((p: any) => (
        <View key={p.id} style={[globalStyles.card, { padding: 15 }]}>
          <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', marginBottom: 10 }]}>
            {tipoEvaluacion === 'baseline' ? `${p.id}. ${p.text}` : p.text}
          </Text>
          <View style={styles.likertContainer}>
            {[0, 1, 2, 3, 4].map(val => (
              <TouchableOpacity
                key={val}
                style={[styles.likertBtn, respuestas[p.id] === val && styles.likertSelected]}
                onPress={() => handleSeleccion(p.id, val)}
              >
                <Text style={[styles.likertText, respuestas[p.id] === val && styles.likertTextSelected]}>{val}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.likertLabels}>
            <Text style={styles.labelSmall}>Nunca (0)</Text>
            <Text style={styles.labelSmall}>Casi Siempre (4)</Text>
          </View>
        </View>
      ))}

      <View style={globalStyles.card}>
        <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', marginBottom: 10 }]}>
          Tu espacio personal
        </Text>
        <Text style={{ fontSize: 12, color: '#666', marginBottom: 10, fontFamily: 'Nunito-Regular' }}>
          Este espacio es libre. Desahógate, cuéntanos cómo estuvo tu día o qué te preocupa. Escribir ayuda a liberar la carga.
        </Text>
        <TextInput
          placeholder="Escribe aquí todo lo que necesites"
          placeholderTextColor="#A0A0A0"
          multiline
          value={comentarios}
          onChangeText={setComentarios}
          style={[globalStyles.bodyText, globalStyles.inputArea, { minHeight: 100 }]}
        />
      </View>

      <TouchableOpacity style={globalStyles.button} onPress={enviarEvaluacion}>
        <Text style={globalStyles.buttonText}>ENVIAR Y VER RESULTADO</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {renderEvaluacion()}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBtn: { flex: 1, padding: 10, borderWidth: 1, borderColor: theme.colors.primaryPastel, alignItems: 'center', marginHorizontal: 5, borderRadius: 8 },
  tabBtnActive: { backgroundColor: theme.colors.primaryPastel },
  tabText: { fontFamily: 'Nunito-Bold', color: theme.colors.textMain },
  tabTextActive: { color: '#FFF' },
  likertContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  likertLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5, paddingHorizontal: 5 },
  labelSmall: { fontSize: 10, color: '#777', fontFamily: 'Nunito-Regular' },
  likertBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 2,
    borderColor: theme.colors.primaryPastel, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#FFF'
  },
  likertSelected: { backgroundColor: theme.colors.primaryPastel },
  likertText: { fontFamily: 'Nunito-Bold', fontSize: 16, color: theme.colors.textMain },
  likertTextSelected: { color: '#FFFFFF' }
});