import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PieChart } from './src/components/PieChart';
import { globalStyles, theme } from './src/styles/theme';
import { RegistroScreen } from './src/components/RegistroScreen';
import mensajesSoporte from './src/data/mensajesSoporte.json';
import { NotificacionModal } from './src/components/NotificacionModal';

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
  const [cargando, setCargando] = useState(true);
  const [usuarioRegistrado, setUsuarioRegistrado] = useState(false);
  const [tipoEvaluacion, setTipoEvaluacion] = useState<'diario' | 'baseline'>('diario');
  const [vistaActual, setVistaActual] = useState<'evaluacion' | 'historial'>('evaluacion');
  const [historialData, setHistorialData] = useState<any[]>([]);
  const [riesgoCritico, setRiesgoCritico] = useState<{ activo: boolean; razon: string | null }>({ activo: false, razon: null });
  const [mostrarProfesionales, setMostrarProfesionales] = useState(false);

  // Profesionales de apoyo (placeholders editables)
  const PROFESIONALES = [
    { nombre: 'Dra. Ana Martínez', especialidad: 'Psicología Clínica', telefono: '59891234567' },
    { nombre: 'Lic. Carlos Pérez', especialidad: 'Trabajo Social', telefono: '59892345678' },
    { nombre: 'Dra. Luisa Gómez', especialidad: 'Psicología de Cuidadores', telefono: '59893456789' },
  ];

  // Colores para el gráfico de torta
  const EMOTION_COLORS: Record<string, string> = {
    'Resiliencia':     theme.colors.secondaryMain,
    'Sobrecarga':      theme.colors.error,
    'Depresión':       theme.colors.primaryDark,
    'Ansiedad':        theme.colors.warning,
    'No detectada':    theme.colors.borderLight,
  };

  // Estado para la evaluación de salud mental
  const [respuestas, setRespuestas] = useState<Record<number, number>>({});
  const [comentarios, setComentarios] = useState<string>('');
  const [nombreUsuario, setNombreUsuario] = useState<string>('');
  const [resultadoEval, setResultadoEval] = useState<EvaluacionResult | null>(null);
  const [preguntasActivas, setPreguntasActivas] = useState(PREGUNTAS);

  // Estado para la notificación psicoeducativa
  const [mensajeNotificacionActivo, setMensajeNotificacionActivo] = useState<any | null>(null);
  const [modalNotificacionVisible, setModalNotificacionVisible] = useState(false);
  const [testCycleIndex, setTestCycleIndex] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    const cargarDatosUsuario = async () => {
      const startTime = Date.now();
      try {
        const guardado = await AsyncStorage.getItem('@usuario_registrado');
        const nombre = await AsyncStorage.getItem('@nombre_usuario');
        if (guardado === 'true' && nombre) {
          setNombreUsuario(nombre);
          setUsuarioRegistrado(true);

          // Cargar último resultado si coincide con la fecha de hoy
          const guardadoFecha = await AsyncStorage.getItem('@ultimo_resultado_fecha');
          if (guardadoFecha === new Date().toDateString()) {
            const resultadoStr = await AsyncStorage.getItem('@ultimo_resultado');
            if (resultadoStr) {
              setResultadoEval(JSON.parse(resultadoStr));
            }
          }
        }
      } catch (e) {
        console.warn('Error cargando datos de usuario:', e);
      } finally {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 3000 - elapsed);
        setTimeout(() => {
          setCargando(false);
        }, remaining);
      }
    };
    cargarDatosUsuario();
  }, []);

  const handleRegistroExitoso = async (nombre: string, emailParam?: string, passwordParam?: string, modoLogin?: boolean) => {
    try {
      if (modoLogin && emailParam && passwordParam) {
        // Verificar credenciales guardadas
        const emailGuardado = await AsyncStorage.getItem('@email_usuario');
        const passGuardado  = await AsyncStorage.getItem('@pass_usuario');
        if (emailParam.trim().toLowerCase() !== emailGuardado || passwordParam !== passGuardado) {
          Alert.alert(
            'Credenciales incorrectas',
            'El correo o la contraseña no coinciden con una cuenta registrada. '
            + 'Si eres nuevo, elige Regístrate.'
          );
          return;
        }
        // Login exitoso: recuperar nombre guardado
        const nombreGuardado = await AsyncStorage.getItem('@nombre_usuario') ?? nombre;
        await AsyncStorage.setItem('@usuario_registrado', 'true');
        await AsyncStorage.setItem('@nombre_usuario', nombreGuardado);
        setNombreUsuario(nombreGuardado);
        setUsuarioRegistrado(true);
        return;
      }
      // Registro nuevo: guardar todo
      await AsyncStorage.setItem('@usuario_registrado', 'true');
      await AsyncStorage.setItem('@nombre_usuario', nombre);
      if (emailParam) { await AsyncStorage.setItem('@email_usuario', emailParam.trim().toLowerCase()); }
      if (passwordParam) { await AsyncStorage.setItem('@pass_usuario', passwordParam); }
      setNombreUsuario(nombre);
      setUsuarioRegistrado(true);
    } catch (e) {
      Alert.alert('Error', 'No se pudieron guardar los datos de registro localmente.');
    }
  };

  const cerrarSesion = async () => {
    try {
      await AsyncStorage.removeItem('@usuario_registrado');
      await AsyncStorage.removeItem('@ultimo_resultado');
      await AsyncStorage.removeItem('@ultimo_resultado_fecha');
      setNombreUsuario('');
      setUsuarioRegistrado(false);
      setResultadoEval(null);
      setVistaActual('evaluacion');
    } catch (e) {
      Alert.alert('Error', 'No se pudo cerrar la sesión.');
    }
  };

  useEffect(() => {
    const fetchPreguntas = async () => {
      try {
        const response = await fetch('https://cuidaml.luzserver.org/preguntas_diarias', {
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

  const processDeepLink = (url: string) => {
    if (!url) return;
    const match = url.match(/id=([^&]+)/);
    if (match && match[1]) {
      const messageId = match[1];
      const messageData = mensajesSoporte.find(m => m.id === messageId);
      if (messageData) {
        setMensajeNotificacionActivo(messageData);
        setModalNotificacionVisible(true);
      }
    }
  };

  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      processDeepLink(event.url);
    };
    const subscription = Linking.addEventListener('url', handleUrl);

    Linking.getInitialURL().then((url) => {
      if (url) {
        processDeepLink(url);
      }
    });

    const interval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 13 && now.getMinutes() === 0) {
        Alert.alert(
          "CuidaML - Apoyo Diario 💛",
          "Tienes un nuevo mensaje de apoyo disponible: \"¿Estoy cansado o sobrecargado?\"",
          [
            {
              text: "Ver ahora",
              onPress: () => {
                processDeepLink("cuida_ml://notification-popup?id=eje1");
              }
            },
            {
              text: "Más tarde",
              style: "cancel"
            }
          ]
        );
      }
    }, 60000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
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
      const response = await fetch('https://cuidaml.luzserver.org/evaluacion_mental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.error) {
        Alert.alert("Error", data.error);
      } else {
        setResultadoEval(data as EvaluacionResult);
        await AsyncStorage.setItem('@ultimo_resultado', JSON.stringify(data));
        await AsyncStorage.setItem('@ultimo_resultado_fecha', new Date().toDateString());
        setRespuestas({});
        setComentarios('');

        // Esperar a que el layout se actualice con la tarjeta de resultado antes de hacer scroll
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }, 350);

        Alert.alert("¡Gracias!", "Tu registro ha sido guardado correctamente.");
      }
    } catch (e) {
      Alert.alert("Error de Conexión", "No se pudo conectar con el servidor Flask.");
    }
  };

  const fetchHistorial = async () => {
    try {
      const [resHist, resRiesgo] = await Promise.all([
        fetch('https://cuidaml.luzserver.org/historial_evaluaciones'),
        fetch('https://cuidaml.luzserver.org/nivel_riesgo_acumulado'),
      ]);
      const dataHist = await resHist.json();
      const dataRiesgo = await resRiesgo.json();

      if (dataHist.status === 'success') {
        setHistorialData(dataHist.historial);
      }
      if (dataRiesgo.riesgo_critico !== undefined) {
        setRiesgoCritico({ activo: dataRiesgo.riesgo_critico, razon: dataRiesgo.razon });
      }
      setVistaActual('historial');
    } catch (e) {
      Alert.alert("Error", "No se pudo cargar el historial");
    }
  };

  // Calcular distribución de emociones para el pie chart
  const calcularDistribucionEmociones = (filtered: any[]) => {
    const conteo: Record<string, number> = {};
    filtered.forEach(item => {
      const emocion = item.emocion_detectada || 'No detectada';
      conteo[emocion] = (conteo[emocion] || 0) + 1;
    });
    return Object.entries(conteo).map(([emocion, cantidad]) => ({
      x: emocion,
      y: cantidad,
      label: `${Math.round((cantidad / Math.max(1, filtered.length)) * 100)}%`,
      color: EMOTION_COLORS[emocion] || theme.colors.textSecondary,
    }));
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

      <TouchableOpacity
        style={[globalStyles.button, { backgroundColor: theme.colors.primaryLight, marginTop: 15 }]}
        onPress={fetchHistorial}
      >
        <Text style={[globalStyles.buttonText, { fontSize: 15 }]}>
          Historial y Profesionales Disponibles
        </Text>
      </TouchableOpacity>

      {/* Botón de Prueba para Desarrolladores */}
      <TouchableOpacity
        style={[globalStyles.button, { backgroundColor: '#F1F2F6', marginTop: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: '#A4B0BE' }]}
        onPress={() => {
          const ids = ['eje1', 'eje2', 'eje3', 'eje4'];
          const currentId = ids[testCycleIndex];
          const nextIndex = (testCycleIndex + 1) % ids.length;
          setTestCycleIndex(nextIndex);

          const msg = mensajesSoporte.find(m => m.id === currentId);
          if (msg) {
            Alert.alert(
              `Notificación: ${msg.notificationTitle} 💛`,
              msg.notificationPreview,
              [
                {
                  text: "Ver ahora",
                  onPress: () => {
                    processDeepLink(`cuida_ml://notification-popup?id=${currentId}`);
                  }
                },
                {
                  text: "Más tarde",
                  style: "cancel"
                }
              ]
            );
          }
        }}
      >
        <Text style={[globalStyles.buttonText, { fontSize: 13, color: '#57606F' }]}>
          🔔 SIMULAR NOTIFICACIÓN (EJE {(testCycleIndex + 1)}/4)
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  const renderHistorial = () => {
    const historialFiltrado = historialData.filter(
      item => item.user_metadata?.nombre === nombreUsuario
    );
    const pieData = calcularDistribucionEmociones(historialFiltrado);

    return (
      <ScrollView contentContainerStyle={globalStyles.container}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 10 }}>
          <TouchableOpacity onPress={() => { setVistaActual('evaluacion'); setMostrarProfesionales(false); }} style={{ padding: 10 }}>
            <Text style={styles.backBtnText}>◀ Volver</Text>
          </TouchableOpacity>
          <Text style={[globalStyles.headerTitle, { marginBottom: 0, marginLeft: 10 }]}>Histórico</Text>
        </View>

        {/* Sección Unificada de Profesionales de Apoyo */}
        <View style={[globalStyles.card, { backgroundColor: theme.colors.primaryLight, borderLeftWidth: 4, borderLeftColor: theme.colors.primaryMain, marginBottom: 15 }]}>
          <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', fontSize: 15, marginBottom: 6 }]}>
            {riesgoCritico.activo ? '💛 Un momento para ti' : '💛 Apoyo profesional a tu alcance'}
          </Text>
          <Text style={[globalStyles.bodyText, { fontSize: 14, marginBottom: 12 }]}>
            {riesgoCritico.activo 
              ? `${riesgoCritico.razon} Sabemos que cuidar a alguien puede ser agotador. ¿Te gustaría hablar con alguien que puede ayudarte?`
              : 'Queremos acompañarte en cada paso. Si en algún momento sientes sobrecarga o necesitas conversar, ponemos a tu disposición profesionales especializados en apoyo a cuidadores.'
            }
          </Text>
          <TouchableOpacity
            style={[globalStyles.button, { backgroundColor: theme.colors.secondaryPastel, height: 44 }]}
            onPress={() => setMostrarProfesionales(v => !v)}
          >
            <Text style={[globalStyles.buttonText, { fontSize: 14 }]}>
              {mostrarProfesionales ? 'Ocultar profesionales' : 'Ver profesionales disponibles'}
            </Text>
          </TouchableOpacity>

          {mostrarProfesionales && (
            <View style={{ marginTop: 12 }}>
              {PROFESIONALES.map((p, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.profesionalCard}
                  onPress={() => Linking.openURL(`https://wa.me/${p.telefono}?text=Hola%20${encodeURIComponent(p.nombre)}%2C%20me%20gustar%C3%ADa%20recibir%20apoyo%20como%20cuidador%2Fa.`)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', fontSize: 14 }]}>{p.nombre}</Text>
                    <Text style={[globalStyles.bodyText, { fontSize: 12, color: theme.colors.textSecondary }]}>{p.especialidad}</Text>
                  </View>
                  <Text style={{ fontSize: 22 }}>💬</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Pie chart de emociones */}
        {pieData.length > 0 && (
          <View style={[globalStyles.card, { alignItems: 'center', paddingBottom: 10 }]}>
            <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', marginBottom: 10 }]}>Distribución de Emociones</Text>
            <PieChart data={pieData} size={220} />
            {/* Leyenda */}
            <View style={{ width: '100%', marginTop: 12 }}>
              {pieData.map((d, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: d.color, marginRight: 8 }} />
                  <Text style={[globalStyles.bodyText, { fontSize: 13 }]}>{d.x} — {d.y} evaluación{d.y !== 1 ? 'es' : ''} ({d.label})</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Lista de evaluaciones */}
        {historialFiltrado.length === 0 ? (
          <Text style={globalStyles.bodyText}>No hay evaluaciones previas guardadas.</Text>
        ) : (
          historialFiltrado.map((item, index) => {
            const fecha = new Date(item.user_metadata?.fecha).toLocaleDateString();
            const hora = new Date(item.user_metadata?.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const riesgo = item.predictive_target || 'Desconocido';
            const emocion = item.emocion_detectada || 'No calculada';
            const nombre = item.user_metadata?.nombre;
            const tipo = item.tipo_evaluacion === 'baseline' ? 'Test Completo' : 'Check-in Diario';
            const tipoBg = item.tipo_evaluacion === 'baseline' ? theme.colors.secondaryPastel : theme.colors.primaryPastel;

            return (
              <View key={index} style={[globalStyles.card, { padding: 15, marginBottom: 15 }]}>
                {/* Fila superior: fecha + badge tipo */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', fontSize: 13, color: theme.colors.textSecondary }]}>
                    {fecha} · {hora}{nombre && nombre !== 'Cuidador' ? `  —  ${nombre}` : ''}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: tipoBg }]}>
                    <Text style={styles.badgeText}>{tipo}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <Text style={[globalStyles.bodyText, { fontSize: 14, fontFamily: 'Nunito-Bold' }]}>Riesgo (Zarit):</Text>
                  <Text style={[globalStyles.bodyText, { fontSize: 14, color: riesgo === 'Alta' || riesgo === 'Moderada' ? theme.colors.error : theme.colors.success }]}>{riesgo}</Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <Text style={[globalStyles.bodyText, { fontSize: 14, fontFamily: 'Nunito-Bold' }]}>Emoción (NLP):</Text>
                  <Text style={[globalStyles.bodyText, { fontSize: 14 }]}>{emocion}</Text>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  };

  if (cargando) {
    return (
      <View style={styles.splashContainer}>
        <Text style={styles.splashEmoji}>💛</Text>
        <Text style={globalStyles.headerTitle}>CuidaML</Text>
        <Text style={[globalStyles.bodyText, styles.splashText]}>
          Cargando tu diario de bienestar...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {!usuarioRegistrado ? (
        <RegistroScreen onRegistroExitoso={(nombre, emailP, passP, login) => handleRegistroExitoso(nombre, emailP, passP, login)} />
      ) : (
        <SafeAreaView style={styles.mainSafeArea}>
          {/* Cabecera de Usuario Autenticado */}
          <View style={styles.userHeader}>
            <Text style={styles.userHeaderText}>
              Hola, <Text style={styles.userNameText}>{nombreUsuario}</Text> 💛
            </Text>
            <TouchableOpacity onPress={cerrarSesion} style={styles.logoutBtn}>
              <Text style={styles.logoutBtnText}>Cerrar sesión 🚪</Text>
            </TouchableOpacity>
          </View>
          {vistaActual === 'evaluacion' ? renderEvaluacion() : renderHistorial()}
        </SafeAreaView>
      )}

      {/* Modal Emergente Psicoeducativo de Notificación */}
      <NotificacionModal
        visible={modalNotificacionVisible}
        onClose={(actionType) => {
          setModalNotificacionVisible(false);
          console.log("Modal cerrado vía acción:", actionType);
        }}
        data={mensajeNotificacionActivo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBtn: { flex: 1, padding: 10, borderWidth: 1, borderColor: theme.colors.primaryPastel, alignItems: 'center', marginHorizontal: 5, borderRadius: 8 },
  tabBtnActive: { backgroundColor: theme.colors.primaryPastel },
  tabText: { fontFamily: 'Nunito-Bold', color: theme.colors.textMain },
  tabTextActive: { color: theme.colors.textMain },
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
  likertTextSelected: { color: '#FFFFFF' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 11,
    color: theme.colors.textMain,
  },
  profesionalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: theme.colors.cardShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F2F6',
    backgroundColor: '#FFFFFF',
  },
  userHeaderText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 14,
    color: '#636E72',
  },
  userNameText: {
    color: '#1D4ED8',
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E76F51',
    borderRadius: 12,
    backgroundColor: 'rgba(231, 111, 81, 0.05)',
  },
  logoutBtnText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 11,
    color: '#E76F51',
  },
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  splashEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  splashText: {
    textAlign: 'center',
    color: '#636E72',
    marginTop: 8,
  },
  backBtnText: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    color: '#1D4ED8',
  },
  historialHintText: {
    fontSize: 11,
    fontFamily: 'Nunito-Bold',
    color: theme.colors.primaryMain,
    letterSpacing: 0.3,
  },
  mainSafeArea: {
    flex: 1,
  },
});