import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { globalStyles, theme } from './src/styles/theme';

const App = () => {
  // Simulación del estado que recibirás de tu servidor Flask
  const [resultadoIA, setResultadoIA] = useState({
    deteccion: "Esperando...",
    mensaje_ia: "Escribe en tu diario para comenzar el análisis.",
    es_alerta: false
  });

  // Lógica de diseño dinámico: Intensificación de azul si hay alerta
  const colorTarjeta = resultadoIA.es_alerta 
    ? theme.colors.alertIntense 
    : theme.colors.primaryPastel;

  return (
    <ScrollView style={globalStyles.bentoContainer}>
      <Text style={globalStyles.headerTitle}>Mi Bienestar</Text>
      
      {/* Tarjeta Principal estilo Bento Box */}
      <View style={[globalStyles.card, { backgroundColor: colorTarjeta }]}>
        <Text style={[globalStyles.headerTitle, { fontSize: 18, color: theme.colors.white }]}>
          Detección: {resultadoIA.deteccion}
        </Text>
        <Text style={[globalStyles.bodyText, { color: theme.colors.white }]}>
          {resultadoIA.mensaje_ia}
        </Text>
      </View>

      {/* Tarjeta secundaria de acceso rápido */}
      <View style={globalStyles.card}>
        <Text style={globalStyles.bodyText}>
          Tu escala Likert hoy fue baja. ¡Sigue así!
        </Text>
      </View>

      {/* Botón de acción amigable */}
      <TouchableOpacity style={globalStyles.primaryButton}>
        <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold' }]}>
          NUEVO REGISTRO
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

export default App;