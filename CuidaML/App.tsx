import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, StyleSheet, Linking, StatusBar, Modal, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart, LineChartDataPoint } from './src/components/LineChart';
import { globalStyles, theme } from './src/styles/theme';
import { RegistroScreen } from './src/components/RegistroScreen';
import mensajesSoporte from './src/data/mensajesSoporte.json';
import mensajesEvaluacion from './src/data/mensajesEvaluacion.json';
import { NotificacionModal } from './src/components/NotificacionModal';
import { CustomAlertModal } from './src/components/CustomAlertModal';
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
  nivel_riesgo_clinico?: string;
  deteccion?: string;
  mensaje_ia?: string;
  mensaje_dinamico?: {
    id: string;
    titulo_corto: string;
    cuerpo: string;
    sugerencia_accion: string;
  };
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



export default function App() {
  const [cargando, setCargando] = useState(true);
  const [usuarioRegistrado, setUsuarioRegistrado] = useState(false);
  const [tipoEvaluacion, setTipoEvaluacion] = useState<'diario' | 'baseline'>('diario');
  const [vistaActual, setVistaActual] = useState<'evaluacion' | 'historial' | 'profesionales' | 'foro'>('evaluacion');
  const [historialData, setHistorialData] = useState<any[]>([]);
  const [riesgoCritico, setRiesgoCritico] = useState<{ activo: boolean; razon: string | null }>({ activo: false, razon: null });
  const [diasDesdeUltimoTest, setDiasDesdeUltimoTest] = useState<number>(0);
  const [rachaDias, setRachaDias] = useState<number>(0);
  const [mensajesForo, setMensajesForo] = useState<any[]>([]);
  const [nuevoMensajeForo, setNuevoMensajeForo] = useState('');
  const [cargandoForo, setCargandoForo] = useState(false);
  const [mensajeAResponder, setMensajeAResponder] = useState<any | null>(null);
  const [mensajeAEditar, setMensajeAEditar] = useState<any | null>(null);

  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons?: any[];
  }>({ visible: false, title: '', message: '' });

  const showAlert = (title: string, message: string, buttons?: any[]) => {
    setAlertConfig({ visible: true, title, message, buttons });
  };

  const hideAlert = () => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  };

  // Profesionales de apoyo (placeholders editables)
  const PROFESIONALES = [
    { nombre: 'Dra. Ana Martínez', especialidad: 'Psicología Clínica', telefono: '59891234567' },
    { nombre: 'Lic. Carlos Pérez', especialidad: 'Trabajo Social', telefono: '59892345678' },
    { nombre: 'Dra. Luisa Gómez', especialidad: 'Psicología de Cuidadores', telefono: '59893456789' },
  ];

  // Colores para el gráfico de torta
  const EMOTION_COLORS: Record<string, string> = {
    'Resiliencia': theme.colors.secondaryMain,
    'Sobrecarga': theme.colors.error,
    'Depresión': theme.colors.primaryDark,
    'Ansiedad': theme.colors.warning,
    'No detectada': theme.colors.borderLight,
  };

  // Estado para la evaluación de salud mental
  const [respuestas, setRespuestas] = useState<Record<string, number>>({});
  const [comentarios, setComentarios] = useState<string>('');
  const [nombreUsuario, setNombreUsuario] = useState<string>('');
  const [resultadoEval, setResultadoEval] = useState<EvaluacionResult | null>(null);
  const [preguntasActivas, setPreguntasActivas] = useState<any[]>([]);

  // Estado para la notificación psicoeducativa
  const [mensajeNotificacionActivo, setMensajeNotificacionActivo] = useState<any | null>(null);
  const [modalNotificacionVisible, setModalNotificacionVisible] = useState(false);
  const [testCycleIndex, setTestCycleIndex] = useState(0);
  const [hasCompletedInitialTest, setHasCompletedInitialTest] = useState(false);
  const [expandedHistorialItem, setExpandedHistorialItem] = useState<number | null>(null);
  const [sound, setSound] = useState<Sound | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioBarWidth, setAudioBarWidth] = useState(0);

  // Estados de Active Learning Feedback
  const [feedbackEnviado, setFeedbackEnviado] = useState(false);
  const [mostrarSelectorFeedback, setMostrarSelectorFeedback] = useState(false);

  // Estados para Modal de Recursos
  const [selectedResource, setSelectedResource] = useState<any>(null);
  const [isResourceModalVisible, setIsResourceModalVisible] = useState(false);

  const closeResourceModal = () => {
    setIsResourceModalVisible(false);
    if (sound && isPlayingAudio) {
      sound.pause();
      setIsPlayingAudio(false);
    }
    setTimeout(() => {
        setSelectedResource(null);
    }, 300);
  };

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
    let color = '#B8E0D2'; // Verde Pastel - Alto Bienestar
    let width = '100%';
    const lower = texto.toLowerCase();

    if (lower.includes('agotamiento') || lower.includes('elevados') || lower.includes('culpa') || lower.includes('irritabilidad')) {
      color = '#B39DDB'; // Lavanda - Bajo Bienestar / Contención
      width = '33%';
    } else if (lower.includes('moderado') || lower.includes('regular') || lower.includes('parcial')) {
      color = '#AED9E0'; // Azul Pastel - Bienestar Moderado
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

          // Limpiar resultado de sesión anterior (Cold Start)
          setResultadoEval(null);

          const rachaStr = await AsyncStorage.getItem('@racha_dias');
          if (rachaStr) setRachaDias(parseInt(rachaStr));

          const ultimaFechaStr = await AsyncStorage.getItem('@ultimo_test_completo_fecha');
          setHasCompletedInitialTest(!!ultimaFechaStr);

          if (!ultimaFechaStr) {
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
        // Lógica de Login vía Backend
        const res = await fetch('https://cuidaml.luzserver.org/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailParam, password: passwordParam })
        });
        const data = await res.json();
        
        if (!res.ok || data.error) {
          showAlert(
            'Credenciales incorrectas',
            data.error || 'El correo o la contraseña no coinciden con una cuenta registrada.'
          );
          return;
        }

        const nombreGuardado = data.user.nombre;
        const userId = data.user.user_id;
        
        await AsyncStorage.setItem('@usuario_registrado', 'true');
        await AsyncStorage.setItem('@nombre_usuario', nombreGuardado);
        await AsyncStorage.setItem('@user_id', userId);
        await AsyncStorage.setItem('@email_usuario', emailParam);

        const currentCountStr = await AsyncStorage.getItem('@login_count');
        const currentCount = currentCountStr ? parseInt(currentCountStr) : 1;
        const newCount = currentCount + 1;
        await AsyncStorage.setItem('@login_count', newCount.toString());
        setTipoEvaluacion('diario');

        await AsyncStorage.removeItem('@notificacion_diaria_index');
        await AsyncStorage.removeItem('@notificacion_ultima_fecha');

        setNombreUsuario(nombreGuardado);
        setUsuarioRegistrado(true);
        return;
      }
      
      // Lógica de Registro vía Backend
      if (emailParam && passwordParam && nombre) {
        const res = await fetch('https://cuidaml.luzserver.org/registro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombre, email: emailParam, password: passwordParam })
        });
        const data = await res.json();
        
        if (!res.ok || data.error) {
          showAlert('Error de Registro', data.error || 'No se pudo crear la cuenta.');
          return;
        }
        
        const userId = data.user.user_id;
        await AsyncStorage.setItem('@usuario_registrado', 'true');
        await AsyncStorage.setItem('@nombre_usuario', nombre);
        await AsyncStorage.setItem('@user_id', userId);
        await AsyncStorage.setItem('@email_usuario', emailParam);
        await AsyncStorage.setItem('@login_count', '1');
        
        setNombreUsuario(nombre);

        await AsyncStorage.removeItem('@notificacion_diaria_index');
        await AsyncStorage.removeItem('@notificacion_ultima_fecha');

        setTipoEvaluacion('baseline');
        setUsuarioRegistrado(true);
      }
    } catch (e) {
      showAlert('Error de conexión', 'No se pudo comunicar con el servidor.');
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
      showAlert('Error', 'No se pudo cerrar la sesión.');
    }
  };

  useEffect(() => {
    const fetchPreguntas = async () => {
      try {
        const response = await fetch('https://cuidaml.luzserver.org/preguntas_diarias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login_count: new Date().getDay(), tipo_evaluacion: tipoEvaluacion })
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
  }, [usuarioRegistrado, hasCompletedInitialTest, tipoEvaluacion]);

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

  const handleSeleccion = (preguntaId: string, valor: number) => {
    setRespuestas(prev => ({ ...prev, [preguntaId]: valor }));
  };

  const enviarEvaluacion = async () => {
    if (Object.keys(respuestas).length < preguntasActivas.length) {
      showAlert("Faltan preguntas", `Por favor responde las ${preguntasActivas.length} preguntas antes de enviar.`);
      return;
    }

    const enviarDatos = async () => {
      const userId = await AsyncStorage.getItem('@user_id') || 'local-user';
      const payload = {
        respuestas: Object.keys(respuestas).map(id => ({
          item_id: id,
          score: respuestas[id]
        })),
        comentarios_generales: comentarios,
        nombre_usuario: nombreUsuario.trim() || 'Cuidador',
        user_id: userId,
        tipo_evaluacion: tipoEvaluacion,
        tipo_test: tipoEvaluacion === 'baseline' ? 'Test completo' : 'Test rápido'
      };

      try {
        const response = await fetch('https://cuidaml.luzserver.org/evaluacion_mental', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (data.error) {
          showAlert("Error", data.error);
        } else {
          // --- LÓGICA DE MENSAJE DINÁMICO ANTI-REPETICIÓN ---
          let categoria = data.deteccion || 'bienestar';
          if (data.es_alerta_clinica && categoria === 'bienestar') categoria = 'sobrecarga';
          
          const catalogo = (mensajesEvaluacion as any)[categoria] || (mensajesEvaluacion as any)['bienestar'];
          
          const lastMsgId = await AsyncStorage.getItem(`@last_msg_id_${categoria}`);
          let opcionesFiltradas = catalogo.filter((m: any) => m.id !== lastMsgId);
          if (opcionesFiltradas.length === 0) opcionesFiltradas = catalogo; // fallback
          
          const rndIndex = Math.floor(Math.random() * opcionesFiltradas.length);
          const msgElegido = opcionesFiltradas[rndIndex];
          
          await AsyncStorage.setItem(`@last_msg_id_${categoria}`, msgElegido.id);
          
          const finalResult = { ...data, mensaje_dinamico: msgElegido } as EvaluacionResult;

          setResultadoEval(finalResult);
          await AsyncStorage.setItem('@ultimo_resultado', JSON.stringify(finalResult));
          await AsyncStorage.setItem('@ultimo_resultado_fecha', new Date().toDateString());
          if (tipoEvaluacion === 'baseline') {
            await AsyncStorage.setItem('@ultimo_test_completo_fecha', new Date().toISOString());
            setDiasDesdeUltimoTest(0);
          }
          setRespuestas({});
          setComentarios('');
          setFeedbackEnviado(false);
          setMostrarSelectorFeedback(false);

          // --- LOGICA DE RACHA DESDE BACKEND ---
          if (data.nueva_racha !== undefined) {
            setRachaDias(data.nueva_racha);
            await AsyncStorage.setItem('@racha_dias', data.nueva_racha.toString());

            // Notificaciones de Hitos
            if (data.nueva_racha === 3) {
              notifee.displayNotification({
                id: 'racha-3',
                title: '¡Qué bien! 🔥',
                body: 'Llevas 3 días cuidando de ti. Sigue así.',
                android: { channelId: 'default' }
              });
            } else if (data.nueva_racha === 7) {
              notifee.displayNotification({
                id: 'racha-7',
                title: '¡Felicidades! 🎉',
                body: 'Llevas una semana completa registrando tu diario. ¡Eres increíble!',
                android: { channelId: 'default' }
              });
            }
          }
          // -----------------------------

          // Esperar a que el layout se actualice con la tarjeta de resultado antes de hacer scroll
          setTimeout(() => {
            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
          }, 350);

          showAlert("¡Gracias!", "Tu Diario ha sido guardado correctamente.");
        }
      } catch (e) {
        showAlert("Error de Conexión", "Parece que no hay internet, revisa tu conexión.");
      }
    };

    if (!comentarios.trim()) {
      showAlert(
        "Espacio personal vacío",
        "¿Estás seguro de que quieres enviar el Diario sin hablar sobre ti o tu día en el espacio personal?",
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
      const userId = await AsyncStorage.getItem('@user_id') || 'local-user';
      const [resHist, resRiesgo] = await Promise.all([
        fetch(`https://cuidaml.luzserver.org/usuario/${userId}/evaluaciones?limit=50`),
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
      showAlert("Error", "No se pudo cargar el historial");
    }
  };

  const enviarFeedback = async (emocionCorregida: string) => {
    try {
      const userId = await AsyncStorage.getItem('@user_id') || 'local-user';
      await fetch('https://cuidaml.luzserver.org/evaluaciones/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          texto_libre: (resultadoEval as any)?.texto_narrativo || '',
          emocion_predicha: (resultadoEval as any)?.deteccion || '',
          emocion_corregida: emocionCorregida
        })
      });
      setFeedbackEnviado(true);
      setMostrarSelectorFeedback(false);
    } catch (e) {
      console.warn("Error enviando feedback:", e);
    }
  };

  const fetchForoMensajes = async () => {
    setCargandoForo(true);
    try {
      const response = await fetch('https://cuidaml.luzserver.org/foro/mensajes');
      const data = await response.json();
      if (data.status === 'success') {
        setMensajesForo(data.mensajes || []);
      }
    } catch (e) {
      console.warn("Error cargando foro", e);
    } finally {
      setCargandoForo(false);
    }
  };

  const enviarMensajeForo = async () => {
    if (!nuevoMensajeForo.trim()) return;
    try {
      let url = 'https://cuidaml.luzserver.org/foro/mensajes';
      let method = 'POST';
      let body: any = {
        autor: nombreUsuario || 'Cuidador',
        texto: nuevoMensajeForo.trim()
      };

      if (mensajeAEditar) {
        url = `https://cuidaml.luzserver.org/foro/mensajes/${mensajeAEditar.id}`;
        method = 'PUT';
      } else if (mensajeAResponder) {
        body.parent_id = mensajeAResponder.id;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (data.status === 'success') {
        setNuevoMensajeForo('');
        setMensajeAResponder(null);
        setMensajeAEditar(null);
        fetchForoMensajes();
        showAlert("¡Listo!", mensajeAEditar ? "Mensaje editado correctamente." : "Mensaje compartido con la comunidad.");
      }
    } catch (e) {
      showAlert("Error", "No se pudo realizar la acción en este momento.");
    }
  };

  const eliminarMensajeForo = (id: string) => {
    showAlert("Borrar Mensaje", "¿Estás seguro de que quieres eliminar este mensaje?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar", style: "destructive", onPress: async () => {
          try {
            const response = await fetch(`https://cuidaml.luzserver.org/foro/mensajes/${id}`, {
              method: 'DELETE'
            });
            const data = await response.json();
            if (data.status === 'success') {
              fetchForoMensajes();
              showAlert("Eliminado", "El mensaje fue borrado.");
            }
          } catch (e) {
            showAlert("Error", "No se pudo borrar el mensaje.");
          }
        }
      }
    ]);
  };

  // Calcular datos para LineChart
  const prepararDatosLineChart = (filtered: any[]): LineChartDataPoint[] => {
    // Tomar los últimos 10
    const ordenados = [...filtered].reverse().slice(-10);
    return ordenados.map((item, index) => {
      const estado = item.puntaje_resumen || item.predictive_target || 'Bienestar Moderado';
      let value = 2;
      let color = theme.colors.warning;
      if (estado === 'Bienestar Alto') { 
        value = 3; color = theme.colors.success; 
      } else if (estado === 'Bienestar Bajo' || estado === 'Riesgo Vital / Crisis' || estado === 'Atención Prioritaria') { 
        value = 1; color = theme.colors.error; 
      }

      const dateObj = new Date(item.fecha || item.user_metadata?.fecha);
      const label = dateObj.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
      return { label, value, color };
    });
  };

  const preguntasAMostrar = preguntasActivas;

  const renderEvaluacion = () => (
    <KeyboardAvoidingView 
      style={{ flex: 1 }} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={globalStyles.container}
      >
        {hasCompletedInitialTest && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.tabBtn, tipoEvaluacion === 'diario' && styles.tabBtnActive]}
              onPress={() => { setTipoEvaluacion('diario'); setResultadoEval(null); }}
            >
              <Text style={[styles.tabText, tipoEvaluacion === 'diario' && styles.tabTextActive]}>Test rápido</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, tipoEvaluacion === 'baseline' && styles.tabBtnActive]}
              onPress={() => { setTipoEvaluacion('baseline'); setResultadoEval(null); }}
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

      {resultadoEval && (() => {
        const colorBanner = resultadoEval.estado_bienestar === 'Riesgo Vital / Crisis' || resultadoEval.es_alerta_clinica ? '#9B59B6' : (resultadoEval.estado_bienestar === 'Bienestar Bajo' ? '#B39DDB' : '#AED9E0');
        const textColorBanner = resultadoEval.estado_bienestar === 'Riesgo Vital / Crisis' || resultadoEval.es_alerta_clinica ? '#FFF' : '#1F2937';
        const textoBanner = resultadoEval.estado_bienestar === 'Riesgo Vital / Crisis' || resultadoEval.es_alerta_clinica ? 'Atención Prioritaria' : resultadoEval.estado_bienestar.replace('Bienestar ', '');
        
        return (
          <View style={[globalStyles.card, { backgroundColor: colorBanner }]}>
            <Text style={[globalStyles.headerTitle, { fontSize: 18, color: textColorBanner }]}>
              Estado de bienestar: {textoBanner}
            </Text>

          {(resultadoEval.estado_bienestar !== 'Bienestar Alto' || resultadoEval.es_alerta_clinica) && (
            <View style={{ marginTop: 10, padding: 15, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8 }}>
              <TouchableOpacity style={{ alignItems: 'center', marginBottom: 10 }} onPress={reproducirAudio}>
                <Text style={{ color: textColorBanner, fontFamily: 'Nunito-Bold' }}>
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

          {resultadoEval.mensaje_dinamico ? (
            <View style={{ marginTop: 15, padding: 15, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10 }}>
              <Text style={{ color: textColorBanner, fontFamily: 'Nunito-Bold', fontSize: 16, marginBottom: 5 }}>
                {resultadoEval.mensaje_dinamico.titulo_corto}
              </Text>
              <Text style={{ color: textColorBanner, fontFamily: 'Nunito-Regular', fontSize: 14, marginBottom: 10 }}>
                {nombreUsuario.split(' ')[0]}, {resultadoEval.mensaje_dinamico.cuerpo.charAt(0).toLowerCase() + resultadoEval.mensaje_dinamico.cuerpo.slice(1)}
              </Text>
              <Text style={{ color: theme.colors.warning, fontFamily: 'Nunito-Bold', fontSize: 13 }}>
                💡 {resultadoEval.mensaje_dinamico.sugerencia_accion}
              </Text>
            </View>
          ) : (
            resultadoEval.mensaje_ia && (
              <Text style={{ color: textColorBanner, fontFamily: 'Nunito-Bold', fontSize: 15, marginTop: 10, textAlign: 'center' }}>
                {resultadoEval.mensaje_ia}
              </Text>
            )
          )}

          {resultadoEval.guia_respiracion && (
            <View style={{ marginTop: 15, padding: 15, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10 }}>
              <Text style={{ color: textColorBanner, fontFamily: 'Nunito-Bold', fontSize: 16, marginBottom: 5 }}>
                ⚠️ {resultadoEval.guia_respiracion.titulo}
              </Text>
              <Text style={{ color: textColorBanner, fontFamily: 'Nunito-Regular', marginBottom: 10, fontSize: 12 }}>
                Hemos detectado niveles altos de sobrecarga. Por favor, antes de continuar, acompáñame en este ejercicio:
              </Text>
              {resultadoEval.guia_respiracion.instrucciones.map((inst: string, idx: number) => (
                <Text key={idx} style={{ color: textColorBanner, fontFamily: 'Nunito-Bold', marginTop: 5 }}>
                  {inst}
                </Text>
              ))}
            </View>
          )}

          {resultadoEval.resumen_dimensiones && (
            <View style={{ marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
              <Text style={{ color: textColorBanner, fontFamily: 'Nunito-Bold', marginBottom: 8 }}>Resumen de bienestar:</Text>

              <Text style={{ color: textColorBanner, fontFamily: 'Nunito-Regular', fontSize: 13 }}>• Física: {resultadoEval.es_alerta_clinica ? "Alta carga detectada" : resultadoEval.resumen_dimensiones["Física"]}</Text>
              {renderSemaforoBar(resultadoEval.es_alerta_clinica ? "agotamiento" : resultadoEval.resumen_dimensiones["Física"])}

              <Text style={{ color: textColorBanner, fontFamily: 'Nunito-Regular', fontSize: 13 }}>• Psicológica: {resultadoEval.es_alerta_clinica ? "Requiere contención" : resultadoEval.resumen_dimensiones["Psicológica"]}</Text>
              {renderSemaforoBar(resultadoEval.es_alerta_clinica ? "elevados" : resultadoEval.resumen_dimensiones["Psicológica"])}

              <Text style={{ color: textColorBanner, fontFamily: 'Nunito-Regular', fontSize: 13 }}>• Emocional: {resultadoEval.es_alerta_clinica ? "Vulnerabilidad activa" : resultadoEval.resumen_dimensiones["Emocional"]}</Text>
              {renderSemaforoBar(resultadoEval.es_alerta_clinica ? "culpa" : resultadoEval.resumen_dimensiones["Emocional"])}
            </View>
          )}

            {resultadoEval.es_alerta_clinica && !resultadoEval.guia_respiracion && (
              <Text style={{ color: textColorBanner, fontFamily: 'Nunito-Bold', marginTop: 15, textAlign: 'center' }}>
                Te recomendamos tomar un descanso o buscar apoyo. Cuidar de ti es lo más importante.
              </Text>
            )}

            {!feedbackEnviado && (
              <View style={{ marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }}>
                <Text style={{ color: textColorBanner, fontFamily: 'Nunito-Bold', fontSize: 14, textAlign: 'center', marginBottom: 10 }}>
                  ¿Sientes que este resultado refleja cómo te sientes hoy?
                </Text>
                {!mostrarSelectorFeedback ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 15 }}>
                    <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 }} onPress={() => enviarFeedback((resultadoEval as any).deteccion || 'bienestar')}>
                      <Text style={{ color: textColorBanner, fontFamily: 'Nunito-Bold' }}>👍 Sí</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 }} onPress={() => setMostrarSelectorFeedback(true)}>
                      <Text style={{ color: textColorBanner, fontFamily: 'Nunito-Bold' }}>👎 No</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    <Text style={{ color: textColorBanner, fontFamily: 'Nunito-Regular', fontSize: 13, textAlign: 'center', marginBottom: 10 }}>
                      Ayúdanos a entenderte mejor. ¿Cuál de estas emociones describe mejor tu estado actual?
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                      {['bienestar', 'estres', 'ansiedad', 'agotamiento', 'depresion', 'sobrecarga', 'frustracion'].map(emocion => (
                        <TouchableOpacity key={emocion} style={{ backgroundColor: 'rgba(255,255,255,0.3)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 15 }} onPress={() => enviarFeedback(emocion)}>
                          <Text style={{ color: textColorBanner, fontFamily: 'Nunito-Bold', fontSize: 12, textTransform: 'capitalize' }}>{emocion}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        );
      })()}

      {preguntasAMostrar.map((p: any) => {
        const minVal = 0;
        const maxVal = p.max_score || 4;
        const options = [];
        for (let i = minVal; i <= maxVal; i++) options.push(i);

        let minLabel = "Nunca";
        let maxLabel = "Casi siempre";

        if (p.test === 'PHQ-9' || p.test === 'GAD-7') {
          minLabel = "Para nada";
          maxLabel = "Casi todos los días";
        }

        return (
          <View key={p.id} style={[globalStyles.card, { padding: 15 }]}>
            <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', marginBottom: 10 }]}>
              {p.text}
            </Text>
            <View style={styles.likertContainer}>
              {options.map(val => (
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
              <Text style={styles.labelSmall}>{minLabel} ({minVal})</Text>
              <Text style={styles.labelSmall}>{maxLabel} ({maxVal})</Text>
            </View>
          </View>
        )
      })}

      <View style={globalStyles.card}>
        <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', marginBottom: 10 }]}>
          Mi Diario
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



      <View style={{ height: 100 }} />
      <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderHistorial = () => {
    const historialFiltrado = historialData; // Backend ya filtra por user_id
    const lineData = prepararDatosLineChart(historialFiltrado);

    return (
      <ScrollView contentContainerStyle={globalStyles.container}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 10 }}>
          <Text style={[globalStyles.headerTitle, { marginBottom: 0, marginLeft: 10 }]}>Tu historial de bienestar</Text>
        </View>


        {/* Line chart de evolución */}
        {lineData.length > 0 && (() => {
          const screenWidth = Dimensions.get('window').width;
          const chartWidth = Math.max(screenWidth - 60, lineData.length * 60);
          return (
            <View style={[globalStyles.card, { alignItems: 'center', paddingBottom: 10 }]}>
              <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', marginBottom: 10 }]}>Evolución del Bienestar</Text>
              <ScrollView horizontal={true} showsHorizontalScrollIndicator={false}>
                <LineChart data={lineData} width={chartWidth} />
              </ScrollView>
            </View>
          );
        })()}

        {/* Lista de evaluaciones */}
        {historialFiltrado.length === 0 ? (
          <Text style={globalStyles.bodyText}>No hay evaluaciones previas guardadas.</Text>
        ) : (
          historialFiltrado.map((item, index) => {
            const dateObj = new Date(item.fecha || item.user_metadata?.fecha);
            const fecha = dateObj.toLocaleDateString();
            const hora = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const riesgo = item.puntaje_resumen || item.predictive_target || 'Desconocido';
            const riesgoMapeado = riesgo === 'Riesgo Vital / Crisis' ? 'Atención Prioritaria' : riesgo;
            const emocion = item.emocion_predominante || item.emocion_detectada || 'No calculada';
            const emocionCapitalized = emocion.charAt(0).toUpperCase() + emocion.slice(1);
            const nombre = item.user_metadata?.nombre || nombreUsuario;
            const tipo = item.tipo_test || (item.tipo_evaluacion === 'baseline' ? 'Test completo' : 'Test rápido');
            const tipoBg = tipo === 'Test completo' ? theme.colors.secondaryPastel : theme.colors.primaryPastel;

            return (
              <TouchableOpacity key={index} style={[globalStyles.card, { padding: 15, marginBottom: 15 }]} activeOpacity={0.8} onPress={() => setExpandedHistorialItem(expandedHistorialItem === index ? null : index)}>
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
                  <Text style={[globalStyles.bodyText, { fontSize: 14, color: riesgo === 'Bienestar Bajo' || riesgo === 'Riesgo Vital / Crisis' ? '#B39DDB' : (riesgo === 'Bienestar Moderado' ? '#AED9E0' : theme.colors.success) }]}>{riesgoMapeado}</Text>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <Text style={[globalStyles.bodyText, { fontSize: 14, fontFamily: 'Nunito-Bold' }]}>Emoción (NLP):</Text>
                  <Text style={[globalStyles.bodyText, { fontSize: 14 }]}>{emocionCapitalized}</Text>
                </View>
                
                {item.texto_libre ? (
                  <Text style={{ backgroundColor: '#f0f4f8', borderRadius: 8, color: '#555', fontStyle: 'italic', marginTop: 10, padding: 8 }}>
                    "{item.texto_libre}"
                  </Text>
                ) : null}
              </TouchableOpacity>
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
          <Text style={[globalStyles.headerTitle, { marginBottom: 0, marginLeft: 10 }]}>Recursos y Herramientas</Text>
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


        <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', fontSize: 16, marginBottom: 10, marginLeft: 5 }]}>👨‍⚕️ Profesionales de apoyo</Text>
        <View style={{ marginTop: 0, marginBottom: 20 }}>
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

        {/* HERRAMIENTAS - REUBICADAS AQUÍ */}
        <View style={[globalStyles.card, { backgroundColor: theme.colors.background, marginBottom: 15 }]}>
          <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', fontSize: 16, marginBottom: 10 }]}>🛠️ Herramientas de Autocuidado</Text>

          {mensajesSoporte.map((res: any, index: number) => (
            <TouchableOpacity 
              key={index}
              style={{ backgroundColor: theme.colors.primaryLight, padding: 15, borderRadius: 8, marginBottom: 10 }}
              onPress={() => {
                setSelectedResource(res);
                setIsResourceModalVisible(true);
              }}
            >
              <Text style={{ fontFamily: 'Nunito-Bold', color: theme.colors.primaryDark, marginBottom: 4 }}>
                {res.modalHeader || res.notificationTitle}
              </Text>
              <Text style={{ fontFamily: 'Nunito-Regular', color: theme.colors.textSecondary, fontSize: 12 }}>
                {res.notificationPreview}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  const renderMensajeForo = (m: any, isRespuesta: boolean = false) => {
    const esMio = m.autor === nombreUsuario;
    return (
      <View key={m.id} style={[globalStyles.card, {
        padding: 15,
        marginBottom: 15,
        backgroundColor: '#FFF',
        marginLeft: isRespuesta ? 30 : 0,
        borderWidth: 1,
        borderColor: '#EAEAEA',
        borderLeftWidth: isRespuesta ? 4 : 1,
        borderLeftColor: isRespuesta ? theme.colors.primaryPastel : '#EAEAEA'
      }]}>
        <Text style={{ fontFamily: 'Nunito-Regular', fontSize: 14, color: '#333' }}>
          {m.texto} {m.editado && <Text style={{ fontSize: 10, color: '#999' }}>(editado)</Text>}
        </Text>
        <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 12, color: theme.colors.primaryMain, marginTop: 8 }}>
          - {m.autor}
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
          {!isRespuesta && (
            <TouchableOpacity onPress={() => { setMensajeAResponder(m); setMensajeAEditar(null); setNuevoMensajeForo(''); }} style={{ marginRight: 15 }}>
              <Text style={{ color: theme.colors.primaryDark, fontSize: 13, fontFamily: 'Nunito-Bold' }}>Responder</Text>
            </TouchableOpacity>
          )}
          {esMio && (
            <>
              <TouchableOpacity onPress={() => { setMensajeAEditar(m); setMensajeAResponder(null); setNuevoMensajeForo(m.texto); }} style={{ marginRight: 15 }}>
                <Text style={{ color: theme.colors.warning, fontSize: 13, fontFamily: 'Nunito-Bold' }}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => eliminarMensajeForo(m.id)}>
                <Text style={{ color: theme.colors.error, fontSize: 13, fontFamily: 'Nunito-Bold' }}>Eliminar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {m.respuestas && m.respuestas.length > 0 && (
          <View style={{ marginTop: 10, borderLeftWidth: 2, borderLeftColor: '#EEE', paddingLeft: 10 }}>
            {m.respuestas.map((r: any) => renderMensajeForo(r, true))}
          </View>
        )}
      </View>
    );
  };

  const renderForo = () => (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 15, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#EEE' }}>
        <Text style={[globalStyles.headerTitle, { fontSize: 18, marginBottom: 8 }]}>Muro de Apoyo 💛</Text>
        <Text style={[globalStyles.bodyText, { fontSize: 12, color: '#666', marginBottom: 12 }]}>Un espacio seguro para compartir y leer mensajes de ánimo de otros cuidadores.</Text>

        {(mensajeAResponder || mensajeAEditar) && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5, backgroundColor: '#FFF3CD', padding: 8, borderRadius: 5 }}>
            <Text style={{ fontSize: 12, color: '#856404', fontFamily: 'Nunito-Bold' }}>
              {mensajeAResponder ? `Respondiendo a: ${mensajeAResponder.autor}` : 'Editando tu mensaje'}
            </Text>
            <TouchableOpacity onPress={() => { setMensajeAResponder(null); setMensajeAEditar(null); setNuevoMensajeForo(''); }}>
              <Text style={{ fontSize: 12, color: '#856404', fontFamily: 'Nunito-Bold' }}>Cancelar ✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <TextInput
          style={{ backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 8, padding: 12, fontFamily: 'Nunito-Regular', minHeight: 60, color: '#333' }}
          placeholder={mensajeAResponder ? "Escribe tu respuesta..." : "Escribe un mensaje de apoyo..."}
          placeholderTextColor="#888"
          multiline
          value={nuevoMensajeForo}
          onChangeText={setNuevoMensajeForo}
        />
        <TouchableOpacity
          style={{ backgroundColor: theme.colors.primaryMain, padding: 10, borderRadius: 8, marginTop: 10, alignItems: 'center' }}
          onPress={enviarMensajeForo}
        >
          <Text style={{ color: '#FFF', fontFamily: 'Nunito-Bold' }}>{mensajeAEditar ? 'Guardar Cambios' : 'Publicar Mensaje'}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 100 }}>
        {cargandoForo ? (
          <Text style={{ textAlign: 'center', marginTop: 20, fontFamily: 'Nunito-Regular' }}>Cargando mensajes...</Text>
        ) : mensajesForo.length === 0 ? (
          <Text style={{ textAlign: 'center', marginTop: 20, fontFamily: 'Nunito-Regular', color: '#666' }}>Aún no hay mensajes. ¡Sé el primero en escribir!</Text>
        ) : (
          mensajesForo.map((m) => renderMensajeForo(m, false))
        )}
      </ScrollView>
    </View>
  );

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
      <StatusBar backgroundColor="#000000" barStyle="light-content" />
      {!usuarioRegistrado ? (
        <RegistroScreen onRegistroExitoso={(nombre, emailP, passP, login) => handleRegistroExitoso(nombre, emailP, passP, login)} />
      ) : (
        <SafeAreaView style={styles.mainSafeArea}>
          {/* Cabecera de Usuario Autenticado */}
          <View style={styles.userHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.userHeaderText}>
                Hola, <Text style={styles.userNameText}>{nombreUsuario.split(' ')[0]}</Text> 💛
              </Text>
              {rachaDias > 0 && (
                <Text style={{ color: '#FF7F50', fontFamily: 'Nunito-Bold', fontSize: 12, marginTop: 2 }}>
                  🔥 Racha: {rachaDias}
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={cerrarSesion} style={styles.logoutBtn}>
              <Text style={styles.logoutBtnText}>Cerrar sesión 🚪</Text>
            </TouchableOpacity>
          </View>
          {vistaActual === 'evaluacion' ? renderEvaluacion() : vistaActual === 'historial' ? renderHistorial() : vistaActual === 'foro' ? renderForo() : renderProfesionales()}

          {/* Taskbar flotante */}
          <View style={styles.taskbarContainer}>
            <TouchableOpacity style={styles.taskbarBtn} onPress={() => { setVistaActual('historial'); fetchHistorial(); }}>
              <Text style={[styles.taskbarText, vistaActual === 'historial' && styles.taskbarTextActive]}>Historial</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.taskbarBtn} onPress={() => setVistaActual('evaluacion')}>
              <Text style={[styles.taskbarText, vistaActual === 'evaluacion' && styles.taskbarTextActive]}>Test</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.taskbarBtn} onPress={() => { setVistaActual('foro'); fetchForoMensajes(); }}>
              <Text style={[styles.taskbarText, vistaActual === 'foro' && styles.taskbarTextActive]}>Comunidad</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.taskbarBtn} onPress={() => setVistaActual('profesionales')}>
              <Text style={[styles.taskbarText, vistaActual === 'profesionales' && styles.taskbarTextActive]}>Recursos</Text>
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

      {/* Modal Emergente de Recursos de Autocuidado */}
      <Modal
        visible={isResourceModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={closeResourceModal}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxHeight: '85%', backgroundColor: '#FFF', borderRadius: 20, overflow: 'hidden', elevation: 10 }}>
            {selectedResource && (
              <ScrollView contentContainerStyle={{ padding: 20 }}>
                <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: theme.colors.primaryDark, marginBottom: 15 }}>
                  {selectedResource.modalHeader}
                </Text>
                
                <View style={{ marginBottom: 20 }}>
                  {selectedResource.modalBody.split('\n').map((par: string, pIdx: number) => {
                    const chunks = par.split(/(\*\*.*?\*\*|\*.*?\*)/g);
                    return (
                      <Text key={pIdx} style={{ fontSize: 14, fontFamily: 'Nunito-Regular', color: theme.colors.textMain, lineHeight: 22, marginBottom: 10 }}>
                        {chunks.map((text, i) => {
                          if (text.startsWith('**') && text.endsWith('**')) return <Text key={i} style={{ fontFamily: 'Nunito-Bold' }}>{text.slice(2, -2)}</Text>;
                          if (text.startsWith('*') && text.endsWith('*')) return <Text key={i} style={{ fontStyle: 'italic' }}>{text.slice(1, -1)}</Text>;
                          return text;
                        })}
                      </Text>
                    )
                  })}
                </View>

                {selectedResource.id === 'eje4' && (
                  <View style={{ backgroundColor: theme.colors.primaryLight, padding: 15, borderRadius: 10, marginBottom: 20 }}>
                    <Text style={{ fontFamily: 'Nunito-Bold', color: theme.colors.primaryDark, marginBottom: 10 }}>Control de Audio Guía</Text>
                    <TouchableOpacity style={{ backgroundColor: theme.colors.primaryMain, padding: 12, borderRadius: 8, alignItems: 'center' }} onPress={reproducirAudio}>
                      <Text style={{ color: '#FFF', fontFamily: 'Nunito-Bold' }}>
                        {isPlayingAudio ? '⏸ Pausar Ejercicio Guiado' : '▶ Reproducir Ejercicio Guiado'}
                      </Text>
                    </TouchableOpacity>
                    {(sound || audioProgress > 0) && (
                      <View style={{ height: 6, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 3, marginTop: 15, overflow: 'hidden', width: '100%' }}>
                        <View style={{ height: '100%', width: `${Math.min(100, Math.max(0, audioProgress * 100))}%`, backgroundColor: theme.colors.primaryMain }} />
                      </View>
                    )}
                  </View>
                )}

                <TouchableOpacity 
                  style={{ backgroundColor: theme.colors.textSecondary, padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 }}
                  onPress={closeResourceModal}
                >
                  <Text style={{ color: '#FFF', fontFamily: 'Nunito-Bold', fontSize: 16 }}>{selectedResource.actionButtonText || 'Cerrar'}</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <CustomAlertModal
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={hideAlert}
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
    alignSelf: 'center',
    width: '92%',
    maxWidth: 400,
    borderRadius: 30,
    flexDirection: 'row',
    backgroundColor: theme.colors.secondaryMain,
    borderTopWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 10,
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
    flexDirection: 'row',
    flex: 1,
    gap: 4,
  },
  taskbarText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 12,
    color: '#E0E0E0',
    textAlign: 'center',
  },
  taskbarTextActive: {
    color: '#FFFFFF',
    fontSize: 13,
  },
});