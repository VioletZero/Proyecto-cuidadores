import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, StyleSheet, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart, LineChartDataPoint } from './src/components/LineChart';
import { globalStyles, theme } from './src/styles/theme';
import { RegistroScreen } from './src/components/RegistroScreen';
import mensajesSoporte from './src/data/mensajesSoporte.json';
import { NotificacionModal } from './src/components/NotificacionModal';
import Sound from 'react-native-sound';
import notifee, { EventType } from '@notifee/react-native';

// Manejo de eventos de notificaciones en segundo plano (Requisito de Notifee)
notifee.onBackgroundEvent(async ({ type, detail }) => {
  // Las aperturas en frío se manejarán con getInitialNotification en App
});

// Habilitar categoría de reproducción para que suene incluso en silencio en algunos dispositivos
Sound.setCategory('Playback');

interface EvaluacionResult {
  estado_bienestar: string;
  puntaje_total: number;
  es_alerta_clinica: boolean;
  mensaje_ia?: string;
  resumen_dimensiones?: {
    Física: string;
    Psicológica: string;
    Emocional: string;
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
  const [vistaActual, setVistaActual] = useState<'evaluacion' | 'historial' | 'profesionales'>('evaluacion');
  const [historialData, setHistorialData] = useState<any[]>([]);
  const [riesgoCritico, setRiesgoCritico] = useState<{ activo: boolean; razon: string | null }>({ activo: false, razon: null });
  const [diasDesdeUltimoTest, setDiasDesdeUltimoTest] = useState<number>(0);

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
  const [loginCount, setLoginCount] = useState(1);
  const [sound, setSound] = useState<Sound | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioBarWidth, setAudioBarWidth] = useState(0);

  // Limpieza del audio al desmontar o cambiar de audio
  useEffect(() => {
    return () => {
      if (sound) {
        sound.release();
      }
    };
  }, [sound]);

  useEffect(() => {
    let interval: any;
    if (sound && isPlayingAudio) {
      interval = setInterval(() => {
        sound.getCurrentTime((seconds) => {
          if (audioDuration > 0) {
            setAudioProgress(seconds / audioDuration);
          }
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [sound, isPlayingAudio, audioDuration]);

  const renderSemaforoBar = (texto: string) => {
    let color = '#10B981'; // Verde - Alto Bienestar
    let width = '100%';
    const lower = texto.toLowerCase();
    
    if (lower.includes('agotamiento') || lower.includes('elevados') || lower.includes('culpa') || lower.includes('irritabilidad')) {
      color = '#EF4444'; // Rojo - Bajo Bienestar
      width = '33%';
    } else if (lower.includes('moderado') || lower.includes('regular') || lower.includes('parcial')) {
      color = '#F59E0B'; // Amarillo - Bienestar Moderado
      width = '66%';
    }

    return (
      <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3, marginTop: 4, marginBottom: 12, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: width as any, backgroundColor: color, borderRadius: 3 }} />
      </View>
    );
  };

  const reproducirAudio = () => {
    try {
      if (sound) {
        if (isPlayingAudio) {
          sound.pause();
          setIsPlayingAudio(false);
        } else {
          sound.play((success) => {
            setIsPlayingAudio(false);
            if (success) setAudioProgress(1);
          });
          setIsPlayingAudio(true);
        }
        return;
      }
      const newSound = new Sound('respiracion.mp3', Sound.MAIN_BUNDLE, (error) => {
        if (error) {
          console.warn("No se pudo cargar el audio de respiración:", error);
          return;
        }
        setSound(newSound);
        setAudioDuration(newSound.getDuration());
        newSound.play((success) => {
          setIsPlayingAudio(false);
          if (success) setAudioProgress(1);
        });
        setIsPlayingAudio(true);
      });
    } catch (e) {
      console.warn("Error síncrono al instanciar Sound:", e);
    }
  };

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
          const countStr = await AsyncStorage.getItem('@login_count');
          if (countStr) setLoginCount(parseInt(countStr));

          // Calcular días desde último test completo
          const ultimaFechaStr = await AsyncStorage.getItem('@ultimo_test_completo_fecha');
          let dias = 7; // por defecto obligar si no hay registro
          if (ultimaFechaStr) {
             const ultimaFecha = new Date(ultimaFechaStr);
             const hoy = new Date();
             const diffTime = Math.abs(hoy.getTime() - ultimaFecha.getTime());
             dias = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          }
          setDiasDesdeUltimoTest(dias);
          
          if (dias >= 7 || !countStr) {
             setTipoEvaluacion('baseline');
          } else {
             setTipoEvaluacion('diario');
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
        
        const currentCountStr = await AsyncStorage.getItem('@login_count');
        const currentCount = currentCountStr ? parseInt(currentCountStr) : 1;
        const newCount = currentCount + 1;
        await AsyncStorage.setItem('@login_count', newCount.toString());
        setLoginCount(newCount);
        setTipoEvaluacion('diario');
        
        await AsyncStorage.removeItem('@notificacion_diaria_index');
        await AsyncStorage.removeItem('@notificacion_ultima_fecha');

        setNombreUsuario(nombreGuardado);
        setUsuarioRegistrado(true);
        return;
      }
      // Registro nuevo: guardar todo
      await AsyncStorage.setItem('@usuario_registrado', 'true');
      await AsyncStorage.setItem('@nombre_usuario', nombre);
      await AsyncStorage.setItem('@login_count', '1');
      if (emailParam) { await AsyncStorage.setItem('@email_usuario', emailParam.trim().toLowerCase()); }
      if (passwordParam) { await AsyncStorage.setItem('@pass_usuario', passwordParam); }
      setNombreUsuario(nombre);
      setLoginCount(1);
      
      await AsyncStorage.removeItem('@notificacion_diaria_index');
      await AsyncStorage.removeItem('@notificacion_ultima_fecha');

      setTipoEvaluacion('baseline');
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
          body: JSON.stringify({ login_count: loginCount })
        });
        const data = await response.json();
        if (data.preguntas && data.preguntas.length > 0) {
          setPreguntasActivas(data.preguntas);
        }
      } catch (e) {
        console.warn("No se pudo cargar EMA, usando fallback.");
      }
    };
    if (usuarioRegistrado) {
      fetchPreguntas();
    }
  }, [usuarioRegistrado, loginCount]);

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
    async function setupNotifications() {
      await notifee.requestPermission();
      await notifee.createChannel({
        id: 'default',
        name: 'Canal por Defecto',
        importance: 4,
      });
    }
    setupNotifications();

    const handleUrl = (event: { url: string }) => {
      processDeepLink(event.url);
    };
    const subscription = Linking.addEventListener('url', handleUrl);

    Linking.getInitialURL().then((url) => {
      if (url) {
        processDeepLink(url);
      }
    });

    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS && detail.notification?.data?.id) {
        processDeepLink(`cuida_ml://notification-popup?id=${detail.notification.data.id}`);
      }
    });

    notifee.getInitialNotification().then(initialNotification => {
      if (initialNotification && initialNotification.notification?.data?.id) {
        processDeepLink(`cuida_ml://notification-popup?id=${initialNotification.notification.data.id}`);
      }
    });

    const interval = setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 14 && now.getMinutes() === 0) {
        try {
          const ultimaFecha = await AsyncStorage.getItem('@notificacion_ultima_fecha');
          if (ultimaFecha === now.toDateString()) return;

          const indexStr = await AsyncStorage.getItem('@notificacion_diaria_index');
          const index = indexStr ? parseInt(indexStr) : 0;

          if (index < mensajesSoporte.length) {
            const msg = mensajesSoporte[index];
            notifee.displayNotification({
              id: 'apoyo-diario',
              title: `CuidaML - Apoyo Diario 💛`,
              body: `${msg.notificationTitle}: ${msg.notificationPreview}`,
              data: { id: msg.id },
              android: {
                channelId: 'default',
                pressAction: { id: 'default' }
              }
            });
            await AsyncStorage.setItem('@notificacion_ultima_fecha', now.toDateString());
            await AsyncStorage.setItem('@notificacion_diaria_index', (index + 1).toString());
          }
        } catch (e) {
          console.warn("Error enviando notificacion", e);
        }
      }
    }, 60000);

    return () => {
      subscription.remove();
      clearInterval(interval);
      unsubscribeNotifee();
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

    const enviarDatos = async () => {
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
          if (tipoEvaluacion === 'baseline') {
             await AsyncStorage.setItem('@ultimo_test_completo_fecha', new Date().toISOString());
             setDiasDesdeUltimoTest(0);
          }
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

    if (!comentarios.trim()) {
      Alert.alert(
        "Espacio personal vacío",
        "¿Estás seguro de que quieres enviar el registro sin hablar sobre ti o tu día en el espacio personal?",
        [
          { text: "No, escribiré algo", style: "cancel" },
          { text: "Sí, enviar vacío", onPress: () => enviarDatos() }
        ]
      );
      return;
    }

    enviarDatos();
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

  // Calcular datos para LineChart
  const prepararDatosLineChart = (filtered: any[]): LineChartDataPoint[] => {
    // Tomar los últimos 10
    const ordenados = [...filtered].reverse().slice(-10);
    return ordenados.map((item, index) => {
      const estado = item.predictive_target || 'Bienestar Moderado';
      let value = 2;
      let color = theme.colors.warning;
      if (estado === 'Bienestar Alto') { value = 3; color = theme.colors.success; }
      else if (estado === 'Bienestar Bajo') { value = 1; color = theme.colors.error; }
      
      const label = new Date(item.user_metadata?.fecha).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
      return { label, value, color };
    });
  };

  const preguntasAMostrar = tipoEvaluacion === 'baseline' ? PREGUNTAS : preguntasActivas;

  const renderEvaluacion = () => (
    <ScrollView
      ref={scrollViewRef}
      contentContainerStyle={globalStyles.container}
    >
      {diasDesdeUltimoTest < 7 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20, marginTop: 10 }}>
          <TouchableOpacity 
            style={[styles.tabBtn, tipoEvaluacion === 'diario' && styles.tabBtnActive]}
            onPress={() => { setTipoEvaluacion('diario'); setRespuestas({}); setResultadoEval(null); }}
          >
            <Text style={[styles.tabText, tipoEvaluacion === 'diario' && styles.tabTextActive]}>Check-in diario</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tabBtn, tipoEvaluacion === 'baseline' && styles.tabBtnActive]}
            onPress={() => { setTipoEvaluacion('baseline'); setRespuestas({}); setResultadoEval(null); }}
          >
            <Text style={[styles.tabText, tipoEvaluacion === 'baseline' && styles.tabTextActive]}>Test completo</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={[globalStyles.headerTitle, { textAlign: 'center', marginBottom: 20 }]}>
        {tipoEvaluacion === 'diario' ? 'Hoy quiero saber cómo estás 💛 (30 segundos)' : 'Háblame un poco de ti'}
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
        <View style={[globalStyles.card, { backgroundColor: '#3B82F6' }]}>
          <Text style={[globalStyles.headerTitle, { fontSize: 18, color: '#FFF' }]}>
            Estado de bienestar: {resultadoEval.estado_bienestar}
          </Text>

          {(resultadoEval.estado_bienestar !== 'Bienestar Alto' || resultadoEval.es_alerta_clinica) && (
             <View style={{ marginTop: 10, padding: 15, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 }}>
               <TouchableOpacity style={{ alignItems: 'center', marginBottom: 10 }} onPress={reproducirAudio}>
                 <Text style={{ color: '#FFF', fontFamily: 'Nunito-Bold' }}>
                   {isPlayingAudio ? '⏸ Pausar ejercicio' : '▶ Reproducir ejercicio'}
                 </Text>
               </TouchableOpacity>
               
               {(sound || audioProgress > 0) && (
                 <TouchableOpacity 
                   activeOpacity={0.8}
                   style={{ height: 20, justifyContent: 'center', marginVertical: 5 }} 
                   onLayout={(e) => setAudioBarWidth(e.nativeEvent.layout.width)}
                   onPress={(e) => {
                     if (sound && audioBarWidth > 0 && audioDuration > 0) {
                       const locX = e.nativeEvent.locationX;
                       const pct = Math.min(1, Math.max(0, locX / audioBarWidth));
                       const newTime = pct * audioDuration;
                       sound.setCurrentTime(newTime);
                       setAudioProgress(pct);
                     }
                   }}
                 >
                   <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3, overflow: 'hidden' }}>
                     <View style={{ height: '100%', width: `${Math.min(100, Math.max(0, audioProgress * 100))}%`, backgroundColor: theme.colors.success, borderRadius: 3 }} />
                   </View>
                 </TouchableOpacity>
               )}
             </View>
          )}

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
              <Text style={{ color: '#FFF', fontFamily: 'Nunito-Bold', marginBottom: 8 }}>Resumen de bienestar:</Text>
              
              <Text style={{ color: '#FFF', fontFamily: 'Nunito-Regular', fontSize: 13 }}>• Física: {resultadoEval.resumen_dimensiones["Física"]}</Text>
              {renderSemaforoBar(resultadoEval.resumen_dimensiones["Física"])}
              
              <Text style={{ color: '#FFF', fontFamily: 'Nunito-Regular', fontSize: 13 }}>• Psicológica: {resultadoEval.resumen_dimensiones["Psicológica"]}</Text>
              {renderSemaforoBar(resultadoEval.resumen_dimensiones["Psicológica"])}
              
              <Text style={{ color: '#FFF', fontFamily: 'Nunito-Regular', fontSize: 13 }}>• Emocional: {resultadoEval.resumen_dimensiones["Emocional"]}</Text>
              {renderSemaforoBar(resultadoEval.resumen_dimensiones["Emocional"])}
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
          {tipoEvaluacion === 'diario' ? 'Háblame sobre tu día. Escribir ayuda a liberar la carga.' : 'Háblame un poco de ti. Escribir ayuda a liberar la carga.'}
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
        <Text style={globalStyles.buttonText}>Enviar respuestas</Text>
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
            notifee.displayNotification({
              title: `Notificación: ${msg.notificationTitle} 💛`,
              body: msg.notificationPreview,
              data: { id: currentId },
              android: {
                channelId: 'default',
                pressAction: { id: 'default' }
              }
            });
          }
        }}
      >
        <Text style={[globalStyles.buttonText, { fontSize: 13, color: '#57606F' }]}>
          🔔 Simular notificación (EJE {(testCycleIndex + 1)}/4)
        </Text>
      </TouchableOpacity>

      <View style={{ height: 100 }} />
    </ScrollView>
  );

  const renderHistorial = () => {
    const historialFiltrado = historialData.filter(
      item => item.user_metadata?.nombre === nombreUsuario
    );
    const lineData = prepararDatosLineChart(historialFiltrado);

    return (
      <ScrollView contentContainerStyle={globalStyles.container}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 10 }}>
          <Text style={[globalStyles.headerTitle, { marginBottom: 0, marginLeft: 10 }]}>Tu historial de bienestar</Text>
        </View>


        {/* Line chart de evolución */}
        {lineData.length > 0 && (
          <View style={[globalStyles.card, { alignItems: 'center', paddingBottom: 10 }]}>
            <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', marginBottom: 10 }]}>Evolución del Bienestar</Text>
            <LineChart data={lineData} />
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
                    {fecha} · {hora}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: tipoBg }]}>
                    <Text style={styles.badgeText}>{tipo}</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <Text style={[globalStyles.bodyText, { fontSize: 14, fontFamily: 'Nunito-Bold' }]}>Estado de Bienestar:</Text>
                  <Text style={[globalStyles.bodyText, { fontSize: 14, color: riesgo === 'Bienestar Bajo' || riesgo === 'Bienestar Moderado' ? theme.colors.error : theme.colors.success }]}>{riesgo}</Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <Text style={[globalStyles.bodyText, { fontSize: 14, fontFamily: 'Nunito-Bold' }]}>Emoción (NLP):</Text>
                  <Text style={[globalStyles.bodyText, { fontSize: 14 }]}>{emocion}</Text>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  const renderProfesionales = () => {
    return (
      <ScrollView contentContainerStyle={globalStyles.container}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 10 }}>
          <Text style={[globalStyles.headerTitle, { marginBottom: 0, marginLeft: 10 }]}>Profesionales de apoyo</Text>
        </View>

        <View style={[globalStyles.card, { backgroundColor: theme.colors.primaryLight, borderLeftWidth: 4, borderLeftColor: theme.colors.primaryMain, marginBottom: 15 }]}>
          <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', fontSize: 15, marginBottom: 6 }]}>
            {riesgoCritico.activo ? '💛 Un momento para ti' : '💛 Apoyo profesional a tu alcance'}
          </Text>
          <Text style={[globalStyles.bodyText, { fontSize: 14, marginBottom: 12 }]}>
            {riesgoCritico.activo 
              ? `${riesgoCritico.razon} Sé que cuidar a alguien puede ser agotador. ¿Te gustaría hablar con alguien que pueda ayudarte?`
              : 'Quiero acompañarte en cada paso. Si en algún momento sientes sobrecarga o necesitas conversar, pongo a tu disposición profesionales especializados en apoyo a cuidadores.'
            }
          </Text>
        </View>

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
        <View style={{ height: 100 }} />
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
          {vistaActual === 'evaluacion' ? renderEvaluacion() : vistaActual === 'historial' ? renderHistorial() : renderProfesionales()}

          {/* Taskbar flotante */}
          <View style={styles.taskbarContainer}>
            <TouchableOpacity style={styles.taskbarBtn} onPress={() => { setVistaActual('historial'); fetchHistorial(); }}>
              <Text style={[styles.taskbarText, vistaActual === 'historial' && styles.taskbarTextActive]}>📊 Historial</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.taskbarBtn} onPress={() => setVistaActual('evaluacion')}>
              <Text style={[styles.taskbarText, vistaActual === 'evaluacion' && styles.taskbarTextActive]}>📝 Test</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.taskbarBtn} onPress={() => setVistaActual('profesionales')}>
              <Text style={[styles.taskbarText, vistaActual === 'profesionales' && styles.taskbarTextActive]}>💬 Profesionales</Text>
            </TouchableOpacity>
          </View>
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
  taskbarContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 30,
    flexDirection: 'row',
    backgroundColor: theme.colors.secondaryMain,
    borderTopWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  taskbarBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  taskbarText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  taskbarTextActive: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});