import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, StyleSheet } from 'react-native';
import { globalStyles, theme } from './src/styles/theme';

interface EvaluacionResult {
  riesgo: string;
  puntaje_total: number;
  es_alerta_clinica: boolean;
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
  { id: 1, text: "¿Has sentido poco interés o placer en hacer las cosas que te gustan?" },
  { id: 2, text: "¿Te ha costado tomar la iniciativa o has sentido que te falta energía?" },
  { id: 3, text: "¿Te has sentido decaído, triste o sin muchas esperanzas?" },
  { id: 4, text: "¿Has sentido que no haces lo suficiente o te has sentido culpable?" },
  { id: 5, text: "¿Has notado la boca seca o algún temblor físico sin razón aparente?" },
  { id: 6, text: "¿Te has sentido inquieto o te ha costado quedarte quieto?" },
  { id: 7, text: "¿Te has preocupado demasiado por diferentes cosas del día a día?" },
  { id: 8, text: "¿Has sentido mucho miedo de repente o como si algo malo fuera a pasar?" },
  { id: 9, text: "¿Te has sentido más irritable o te has enojado con facilidad?" },
  { id: 10, text: "¿Te ha costado relajarte incluso después de haber terminado tus tareas?" },
  { id: 11, text: "¿Has sentido mucha tensión o los nervios de punta?" },
  { id: 12, text: "¿Sientes que has reaccionado de forma exagerada ante algunas situaciones?" },
  { id: 13, text: "¿Sientes que cuidar te consume demasiada energía últimamente?" },
  { id: 14, text: "¿Has sentido mucha carga física o mental acumulada por tus labores de cuidado?" },
  { id: 15, text: "¿Sientes que casi no tienes tiempo libre para ti mismo?" }
];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<string>('evaluacion'); // 'diario' o 'evaluacion'

  // Estado para la evaluación de salud mental
  const [respuestas, setRespuestas] = useState<Record<number, number>>({});
  const [comentarios, setComentarios] = useState<string>('');
  const [resultadoEval, setResultadoEval] = useState<EvaluacionResult | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);

  const handleSeleccion = (preguntaId: number, valor: number) => {
    setRespuestas(prev => ({ ...prev, [preguntaId]: valor }));
  };

  const enviarEvaluacion = async () => {
    if (Object.keys(respuestas).length < 15) {
      Alert.alert("Faltan preguntas", "Por favor responde las 15 preguntas antes de enviar.");
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
      comentarios_generales: comentarios
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

  const renderEvaluacion = () => (
    <ScrollView
      ref={scrollViewRef}
      contentContainerStyle={globalStyles.container}
    >
      <Text style={[globalStyles.headerTitle, { textAlign: 'center', marginBottom: 20 }]}>¿Cómo te has sentido últimamente?</Text>

      {resultadoEval && (
        <View style={[globalStyles.card, { backgroundColor: resultadoEval.es_alerta_clinica ? theme.colors.alertIntense : theme.colors.primaryPastel }]}>
          <Text style={[globalStyles.headerTitle, { fontSize: 18, color: '#FFF' }]}>
            Nivel de Riesgo: {resultadoEval.riesgo}
          </Text>
          
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

      {PREGUNTAS.map((p) => (
        <View key={p.id} style={[globalStyles.card, { padding: 15 }]}>
          <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', marginBottom: 10 }]}>
            {p.id}. {p.text}
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
            <Text style={styles.labelSmall}>Nunca</Text>
            <Text style={styles.labelSmall}>Casi Siempre</Text>
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