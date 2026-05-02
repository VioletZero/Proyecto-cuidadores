import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, StyleSheet } from 'react-native';
import { globalStyles, theme } from './src/styles/theme';

export default function App() {
  const [relato, setRelato] = useState('');
  const [sobrecarga, setSobrecarga] = useState(1);
  const [resultadoIA, setResultadoIA] = useState({
    deteccion: "Esperando registro",
    mensaje_ia: "Escribe cómo te sientes hoy y selecciona tu nivel de agotamiento.",
    es_alerta: false
  });

  const enviarAlServidor = async () => {
    if (!relato.trim()) {
      Alert.alert("Campo obligatorio", "Por favor, describe tu situación antes de enviar.");
      return;
    }

    try {
      // Interoperabilidad con el servidor Flask [Source 8]
      const response = await fetch('http://localhost:5000/analizar_emocion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          texto_narrativo: relato, 
          puntos_sobrecarga: sobrecarga 
        })
      });
      
      const data = await response.json();
      setResultadoIA(data);

      // --- MEJORA DE FEEDBACK ---
      // Limpiamos el texto y reiniciamos la escala para confirmar visualmente el envío
      setRelato(''); 
      setSobrecarga(1); 

    } catch (e) {
      Alert.alert("Error de Conexión", "No se pudo conectar con el motor de IA. Verifica ADB reverse y Flask.");
    }
  };

  // Intensificación dinámica de color según riesgo detectado [Source 8, 112]
  const colorTarjeta = resultadoIA.es_alerta ? theme.colors.alertIntense : theme.colors.primaryPastel;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView contentContainerStyle={globalStyles.container}>
        <Text style={globalStyles.headerTitle}>Mi Bienestar</Text>
        
        {/* TARJETA BENTO 1: Resultado de la IA */}
        <View style={[globalStyles.card, { backgroundColor: colorTarjeta }]}>
          <Text style={[globalStyles.headerTitle, { fontSize: 18, color: '#FFF' }]}>
            Detección: {resultadoIA.deteccion}
          </Text>
          <Text style={{ color: '#FFF', fontFamily: 'Nunito-Regular' }}>
            {resultadoIA.mensaje_ia}
          </Text>
        </View>

        {/* TARJETA BENTO 2: Escala Likert manual */}
        {/* ESCALA LIKERT MANUAL */}
        <View style={globalStyles.card}>
          <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', marginBottom: 15 }]}>
            ¿Qué tan cansado te sentiste hoy?
          </Text>
          <View style={styles.row}>
            <TouchableOpacity style={[styles.botonEscala, sobrecarga === 1 && styles.botonSeleccionado]} onPress={() => setSobrecarga(1)}>
              <Text style={[styles.textoBoton, sobrecarga === 1 && styles.textoSeleccionado]}>1</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.botonEscala, sobrecarga === 2 && styles.botonSeleccionado]} onPress={() => setSobrecarga(2)}>
              <Text style={[styles.textoBoton, sobrecarga === 2 && styles.textoSeleccionado]}>2</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.botonEscala, sobrecarga === 3 && styles.botonSeleccionado]} onPress={() => setSobrecarga(3)}>
              <Text style={[styles.textoBoton, sobrecarga === 3 && styles.textoSeleccionado]}>3</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.botonEscala, sobrecarga === 4 && styles.botonSeleccionado]} onPress={() => setSobrecarga(4)}>
              <Text style={[styles.textoBoton, sobrecarga === 4 && styles.textoSeleccionado]}>4</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.botonEscala, sobrecarga === 5 && styles.botonSeleccionado]} onPress={() => setSobrecarga(5)}>
              <Text style={[styles.textoBoton, sobrecarga === 5 && styles.textoSeleccionado]}>5</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* TARJETA BENTO 3: Diario Emocional con Contorno [Chat History] */}
        <View style={globalStyles.card}>
          <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold' }]}>
            Relato Narrativo
          </Text>
          <TextInput
            placeholder="Escribe aquí tu diario de hoy..."
            placeholderTextColor="#A0A0A0" 
            multiline
            value={relato} // Vinculación con el estado para permitir el borrado automático
            onChangeText={setRelato}
            style={[globalStyles.bodyText, globalStyles.inputArea]}
          />
        </View>

        <TouchableOpacity style={globalStyles.button} onPress={enviarAlServidor}>
          <Text style={globalStyles.buttonText}>GUARDAR Y ANALIZAR CON IA</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  botonEscala: {
    width: 45, height: 45, borderRadius: 22.5, borderWidth: 2,
    borderColor: theme.colors.primaryPastel, justifyContent: 'center', alignItems: 'center',
  },
  botonSeleccionado: { backgroundColor: theme.colors.alertIntense, borderColor: theme.colors.alertIntense },
  textoBoton: { fontFamily: 'Nunito-Bold', fontSize: 16, color: theme.colors.textMain },
  textoSeleccionado: { color: '#FFFFFF' },
});