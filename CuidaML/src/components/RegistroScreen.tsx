import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';

const { width } = Dimensions.get('window');

// Textos Legales Extensos Exactos (Capa 3)
const TEXTO_CONSENTIMIENTO_COMPLETO = `La presente aplicación móvil utiliza tecnologías de Inteligencia Artificial, Machine Learning y Procesamiento de Lenguaje Natural (NLP) con fines exclusivamente académicos, investigativos y de apoyo emocional general.

La aplicación no constituye un servicio médico, psicológico, psiquiátrico, terapéutico ni de emergencia, y no reemplaza la evaluación, diagnóstico, tratamiento o intervención realizada por profesionales de la salud.

El usuario reconoce y acepta que:
* Las respuestas y análisis emocionales son generados parcialmente mediante sistemas automatizados de Inteligencia Artificial y pueden contener errores, imprecisiones o interpretaciones incorrectas.
* Los resultados obtenidos no deben interpretarse como diagnósticos clínicos ni utilizarse como única base para decisiones médicas, psicológicas o personales.
* En situaciones de crisis emocional, riesgo de autolesión, ideación suicida o emergencia psicológica, deberá acudir inmediatamente a servicios profesionales especializados o líneas oficiales de atención.

El usuario declara que utiliza la aplicación de manera libre y voluntaria, bajo su propia responsabilidad, comprendiendo plenamente las limitaciones tecnológicas del sistema.

Asimismo, autoriza el tratamiento de la información suministrada para fines de investigación, análisis estadístico, mejora algorítmica y evaluación académica del proyecto, aplicando medidas razonables de confidencialidad, seguridad y anonimización de datos.

Al seleccionar la opción “Acepto”, el usuario declara que: Ha leído y comprendido el presente consentimiento informado; Entiende los alcances y limitaciones de la aplicación; Autoriza el tratamiento de sus datos conforme a las finalidades descritas; Acepta voluntariamente utilizar la plataforma bajo su propio criterio y responsabilidad.`;

const TEXTO_PRIVACIDAD_COMPLETO = `La aplicación podrá recopilar información relacionada con interacciones textuales, estados emocionales, resultados de evaluaciones y datos técnicos necesarios para el funcionamiento del sistema.

El tratamiento de los datos se realizará conforme a principios internacionales de: legalidad, transparencia, finalidad legítima, minimización de datos, confidencialidad, seguridad digital, responsabilidad tecnológica y protección de la dignidad humana.

La información será utilizada únicamente para: funcionamiento de la aplicación, análisis estadístico, investigación académica, mejora de modelos de Inteligencia Artificial, y optimización de la experiencia de usuario.

No se comercializarán datos personales identificables ni se compartirán con terceros no autorizados, salvo obligación legal o requerimiento de autoridad competente.

La aplicación implementa medidas razonables de seguridad orientadas a prevenir acceso no autorizado, alteración, pérdida o divulgación indebida de información.

El usuario podrá solicitar la actualización, corrección o eliminación de sus datos personales conforme a la legislación aplicable y a los principios internacionales de protección de datos.`;

const TEXTO_TERMINOS_COMPLETO = `El acceso y uso de la aplicación implica la aceptación plena de los presentes términos.

El usuario se compromete a utilizar la plataforma de manera lícita, ética y conforme a su finalidad académica y de apoyo emocional general.

Queda expresamente establecido que: La aplicación no ofrece servicios médicos ni psicológicos profesionales; No existen garantías de exactitud absoluta en la detección emocional o respuestas generadas por Inteligencia Artificial; Los desarrolladores, investigadores e instituciones vinculadas no serán responsables por decisiones tomadas por el usuario con base en la información suministrada por la plataforma.

La aplicación podrá actualizar funcionalidades, modelos algorítmicos, políticas y condiciones de uso cuando resulte necesario para fines técnicos, académicos, éticos o regulatorios.

El uso indebido de la plataforma, intentos de vulneración de seguridad o utilización contraria a la ley podrá ocasionar suspensión o terminación del acceso.

La continuidad en el uso de la aplicación después de modificaciones relevantes constituirá aceptación de las nuevas condiciones publicadas.`;

interface RegistroScreenProps {
  onRegistroExitoso: (nombreUsuario: string, email?: string, password?: string, modoLogin?: boolean) => void;
}

type TipoDoc = 'consentimiento' | 'privacidad' | 'terminos' | null;

export const RegistroScreen: React.FC<RegistroScreenProps> = ({ onRegistroExitoso }) => {
  // Manejo de estados del Formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');

  // Modo login vs registro
  const [esLogin, setEsLogin] = useState(false);

  // Manejo de consentimiento
  const [checkboxActivo, setCheckboxActivo] = useState(false);

  // Estados para los modales legales
  const [modalActivo, setModalActivo] = useState<TipoDoc>(null);
  const [verTextoCompleto, setVerTextoCompleto] = useState(false);

  // Estados de validación con feedback on-blur
  const [emailTocado, setEmailTocado] = useState(false);
  const [passwordTocado, setPasswordTocado] = useState(false);

  // Validaciones locales rápidas
  const emailValido = email.trim().length > 0 && email.includes('@');
  const passwordValida = password.length >= 6;
  const nombreValido = nombre.trim().length > 0;

  const mensajeEmail = emailTocado && !emailValido && email.trim().length > 0
    ? 'Por favor ingresa un correo válido (ej. nombre@dominio.com).'
    : emailTocado && email.trim().length === 0
    ? 'El correo es obligatorio.'
    : null;

  const mensajePassword = passwordTocado && !passwordValida && password.length > 0
    ? `La contraseña debe tener al menos 6 caracteres (actual: ${password.length}).`
    : passwordTocado && password.length === 0
    ? 'La contraseña es obligatoria.'
    : null;

  // El botón se habilita según el modo
  const formularioListo = esLogin
    ? (emailValido && passwordValida)
    : (checkboxActivo && emailValido && passwordValida && nombreValido);

  const handleAccionPrincipal = () => {
    if (esLogin) {
      if (!emailValido || !passwordValida) {
        Alert.alert('Datos Incompletos', 'Por favor, completa los campos correctamente.');
        return;
      }
      // Pasar credenciales al padre para verificación real
      onRegistroExitoso('', email, password, true);
    } else {
      if (!formularioListo) {
        if (!checkboxActivo) {
          Alert.alert('Consentimiento Requerido', 'Debes leer y aceptar el Consentimiento Informado, la Política de Privacidad y los Términos de Uso antes de continuar.');
        } else {
          Alert.alert('Datos Incompletos', 'Por favor, completa correctamente todos los campos:\n• El nombre es obligatorio\n• El correo debe ser válido\n• La contraseña debe tener al menos 6 caracteres');
        }
        return;
      }
      onRegistroExitoso(nombre.trim(), email, password, false);
    }
  };

  const abrirDocumento = (tipo: TipoDoc) => {
    setModalActivo(tipo);
    setVerTextoCompleto(false); // Iniciar siempre en la versión resumida (Capa 2)
  };

  // Obtener contenidos del modal activo
  const obtenerContenidoLegal = (): { titulo: string; resumen: string[]; completo: string } => {
    switch (modalActivo) {
      case 'consentimiento':
        return {
          titulo: 'Consentimiento Informado',
          resumen: [
            'La aplicación móvil utiliza Inteligencia Artificial (IA) con fines estrictamente académicos e investigativos de apoyo emocional.',
            'No sustituye consultas psicológicas, médicas, psiquiátricas ni tratamientos clínicos profesionales de salud.',
            'En caso de crisis grave o riesgo de autolesión, debes recurrir a servicios de emergencia o profesionales de salud calificados.',
            'Autorizas el tratamiento confidencial y anonimizado de tus datos para el estudio y optimización académica de los algoritmos.'
          ],
          completo: TEXTO_CONSENTIMIENTO_COMPLETO,
        };
      case 'privacidad':
        return {
          titulo: 'Política de Privacidad',
          resumen: [
            'Recopilamos tus interacciones de diario y estados emocionales para el correcto funcionamiento del modelo de IA.',
            'Aplicamos principios de legalidad, minimización de datos y confidencialidad para proteger tu información.',
            'Tus datos no serán vendidos ni compartidos con terceros sin tu consentimiento expreso o por orden judicial.',
            'Tienes derecho a solicitar la consulta, actualización o eliminación de tus datos en cualquier momento.'
          ],
          completo: TEXTO_PRIVACIDAD_COMPLETO,
        };
      case 'terminos':
        return {
          titulo: 'Términos y Condiciones',
          resumen: [
            'El uso de la aplicación implica la aceptación plena de estos términos con fines éticos y legales.',
            'Los desarrolladores e investigadores no asumen responsabilidad alguna por las decisiones que tomes basándote en la IA.',
            'La aplicación puede sufrir cambios en sus algoritmos y políticas cuando sea necesario por criterios científicos o éticos.',
            'Cualquier intento de burlar la seguridad o uso ilegal puede provocar la suspensión de tu cuenta.'
          ],
          completo: TEXTO_TERMINOS_COMPLETO,
        };
      default:
        return { titulo: '', resumen: [], completo: '' };
    }
  };

  const contenido = obtenerContenidoLegal();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          
          {/* Cabecera / Branding */}
          <View style={styles.headerContainer}>
            <Text style={styles.welcomeEmoji}>💛</Text>
            <Text style={styles.mainTitle}>CuidaML</Text>
            <Text style={styles.subtitle}>
              {esLogin ? 'Inicia sesión para continuar cuidando' : 'Apoyo emocional asistido por IA responsable'}
            </Text>
          </View>

          {/* 1. Formulario de Registro / Login */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{esLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</Text>

            {!esLogin && (
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Nombre o Pseudónimo</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ej. María"
                  placeholderTextColor="#A4B0BE"
                  value={nombre}
                  onChangeText={setNombre}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Correo Electrónico</Text>
              <TextInput
                style={[styles.textInput, emailTocado && !emailValido && styles.textInputError]}
                placeholder="ejemplo@correo.com"
                placeholderTextColor="#A4B0BE"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(t) => { setEmail(t); setEmailTocado(false); }}
                onBlur={() => setEmailTocado(true)}
              />
              {mensajeEmail ? <Text style={styles.fieldErrorText}>{mensajeEmail}</Text> : null}
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>Contraseña (mínimo 6 caracteres)</Text>
              <TextInput
                style={[styles.textInput, passwordTocado && !passwordValida && styles.textInputError]}
                placeholder="••••••••"
                placeholderTextColor="#A4B0BE"
                secureTextEntry
                autoCapitalize="none"
                value={password}
                onChangeText={(t) => { setPassword(t); setPasswordTocado(false); }}
                onBlur={() => setPasswordTocado(true)}
              />
              {mensajePassword ? <Text style={styles.fieldErrorText}>{mensajePassword}</Text> : null}
            </View>

            {/* Alternador de modo dentro de la tarjeta */}
            <TouchableOpacity
              style={styles.toggleModeBtnInline}
              onPress={() => { setEsLogin(!esLogin); setEmailTocado(false); setPasswordTocado(false); }}
              activeOpacity={0.8}
            >
              <Text style={styles.toggleModeText}>
                {esLogin
                  ? '¿No tienes una cuenta? Regístrate gratis'
                  : '¿Ya tienes una cuenta? Inicia sesión'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 2. Capa 1: Aviso Breve de Privacidad e IA (Ocultar en Login) */}
          {!esLogin && (
            <View style={styles.warningContainer}>
              <View style={styles.warningHeader}>
                <Text style={styles.warningEmoji}>⚠️</Text>
                <Text style={styles.warningTitle}>Aviso sobre la IA y Privacidad (Capa 1)</Text>
              </View>
              <View style={styles.warningDivider} />
              
              <View style={styles.bulletRow}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.bulletText}>
                  Esta aplicación utiliza <Text style={styles.boldText}>Inteligencia Artificial</Text> para brindar apoyo emocional general.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.bulletText}>
                  <Text style={styles.boldText}>No reemplaza</Text> la atención médica, psicológica ni psiquiátrica profesional.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.bulletText}>
                  Los resultados de la IA pueden contener <Text style={styles.boldText}>errores o interpretaciones inexactas</Text>.
                </Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.bulletText}>
                  Tus datos serán tratados de <Text style={styles.boldText}>forma confidencial</Text> para fines académicos y de mejora del sistema.
                </Text>
              </View>
            </View>
          )}

          {/* 3. Capa 2: Enlaces a Documentos Legales (Ocultar en Login) */}
          {!esLogin && (
            <View style={styles.linksCard}>
              <Text style={styles.linksCardTitle}>Documentos Legales Obligatorios</Text>
              <Text style={styles.linksCardSubtitle}>
                Toca cada enlace para revisar los detalles antes de registrarte:
              </Text>
              <View style={styles.linksRow}>
                <TouchableOpacity style={styles.legalLinkBtn} onPress={() => abrirDocumento('consentimiento')}>
                  <Text style={styles.legalLinkText}>📜 Consentimiento</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.legalLinkBtn} onPress={() => abrirDocumento('privacidad')}>
                  <Text style={styles.legalLinkText}>🔒 Privacidad</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.legalLinkBtn} onPress={() => abrirDocumento('terminos')}>
                  <Text style={styles.legalLinkText}>🛠️ Términos</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 4. Mecanismo de Consentimiento (Checkbox) (Ocultar en Login) */}
          {!esLogin && (
            <View style={styles.checkboxContainer}>
              <TouchableOpacity
                style={[styles.checkboxSquare, checkboxActivo && styles.checkboxSquareActive]}
                onPress={() => setCheckboxActivo(!checkboxActivo)}
                activeOpacity={0.7}
              >
                {checkboxActivo && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.checkboxTextContainer}
                onPress={() => setCheckboxActivo(!checkboxActivo)}
                activeOpacity={0.9}
              >
                <Text style={styles.checkboxLabel}>
                  He leído y acepto el{' '}
                  <Text style={styles.checkboxUnderlineText} onPress={(e) => { e.stopPropagation(); abrirDocumento('consentimiento'); }}>Consentimiento Informado</Text>, la{' '}
                  <Text style={styles.checkboxUnderlineText} onPress={(e) => { e.stopPropagation(); abrirDocumento('privacidad'); }}>Política de Privacidad</Text> y los{' '}
                  <Text style={styles.checkboxUnderlineText} onPress={(e) => { e.stopPropagation(); abrirDocumento('terminos'); }}>Términos y Condiciones de Uso</Text>.
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 5. Botón de Acción Principal */}
          <TouchableOpacity
            style={[
              styles.btnRegistro,
              !formularioListo && styles.btnRegistroDisabled
            ]}
            onPress={handleAccionPrincipal}
            disabled={!formularioListo}
            activeOpacity={0.85}
          >
            <Text style={styles.btnRegistroText}>
              {esLogin ? 'INICIAR SESIÓN' : 'CREAR CUENTA CUIDAML'}
            </Text>
          </TouchableOpacity>

          {!esLogin && !checkboxActivo && (
            <Text style={styles.helperText}>
              * Debes marcar la casilla de consentimiento para habilitar el registro.
            </Text>
          )}



          <View style={styles.spacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL LEGAL DE DOBLE CAPA (RESUMEN + COMPLETO) */}
      <Modal
        visible={modalActivo !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalActivo(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            {/* Cabecera del modal */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{contenido.titulo}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setModalActivo(null)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Sub-cabecera indicativa de capa */}
            <View style={styles.layerIndicator}>
              <Text style={styles.layerIndicatorText}>
                {verTextoCompleto 
                  ? 'Documento completo' 
                  : 'Resumen rápido'}
              </Text>
            </View>

            {/* Contenido (Scrollable) */}
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              {!verTextoCompleto ? (
                // Capa 2: Resumen en viñetas
                <View>
                  <Text style={styles.summaryIntro}>
                    Por favor, lee estos puntos clave que resumen tus derechos y responsabilidades:
                  </Text>
                  {contenido.resumen.map((punto, index) => (
                    <View key={index} style={styles.summaryBulletRow}>
                      <Text style={styles.summaryBulletIcon}>✨</Text>
                      <Text style={styles.summaryBulletText}>{punto}</Text>
                    </View>
                  ))}
                  <View style={styles.summaryFooterContainer}>
                    <Text style={styles.summaryFooterText}>
                      Si necesitas revisar toda la terminología jurídica, haz clic en el botón de abajo.
                    </Text>
                  </View>
                </View>
              ) : (
                // Capa 3: Texto Completo Exacto
                <View>
                  <Text style={styles.fullLegalText}>{contenido.completo}</Text>
                </View>
              )}
            </ScrollView>

            {/* Botones de acción del Modal */}
            <View style={styles.modalActions}>
              
              {/* Botón para alternar Capa 2 / Capa 3 */}
              <TouchableOpacity
                style={[
                  styles.toggleLayerBtn,
                  verTextoCompleto ? styles.toggleLayerBtnActive : null
                ]}
                onPress={() => setVerTextoCompleto(!verTextoCompleto)}
              >
                <Text style={[
                  styles.toggleLayerBtnText,
                  verTextoCompleto ? styles.toggleLayerBtnTextActive : null
                ]}>
                  {verTextoCompleto ? '◀ Ver resumen rápido' : '🔍 Leer documento completo'}
                </Text>
              </TouchableOpacity>

              {/* Botón de aceptación / cierre principal */}
              <TouchableOpacity
                style={styles.modalAcceptBtn}
                onPress={() => {
                  // Si lee y cierra, le ayudamos marcando que acepta o solo cerramos.
                  // Para consentimiento informado explícito estricto, dejamos la decisión
                  // de marcar la casilla en la pantalla principal, para que sea un consentimiento
                  // de checkbox voluntario y consciente.
                  setModalActivo(null);
                }}
              >
                <Text style={styles.modalAcceptBtnText}>ENTENDIDO Y CERRAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  mainTitle: {
    fontSize: 32,
    fontFamily: 'Nunito-Bold',
    fontWeight: 'bold',
    color: theme.colors.textMain,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 10,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F2F6',
    elevation: 3,
    shadowColor: theme.colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    color: theme.colors.textMain,
    marginBottom: 16,
  },
  inputWrapper: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontFamily: 'Nunito-Bold',
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: 6,
  },
  textInput: {
    height: 48,
    backgroundColor: theme.colors.inputBg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 15,
    color: theme.colors.textMain,
    fontFamily: 'Nunito-Regular',
  },
  // 2. Capa 1: Aviso Breve
  warningContainer: {
    backgroundColor: 'rgba(244, 162, 97, 0.07)', // Fondo sutil naranja de advertencia
    borderWidth: 1.5,
    borderColor: theme.colors.warning,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  warningEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  warningTitle: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    color: '#D35400', // Tono marrón-naranja visible
  },
  warningDivider: {
    height: 1,
    backgroundColor: 'rgba(244, 162, 97, 0.2)',
    marginBottom: 10,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingRight: 12,
  },
  bulletPoint: {
    fontSize: 14,
    color: '#D35400',
    marginRight: 6,
    lineHeight: 18,
  },
  bulletText: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: theme.colors.textMain,
    lineHeight: 18,
    flex: 1,
  },
  boldText: {
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
  },
  // 3. Capa 2: Enlaces Legales
  linksCard: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  linksCardTitle: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    color: theme.colors.textMain,
    marginBottom: 4,
  },
  linksCardSubtitle: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legalLinkBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.colors.primaryPastel,
    borderRadius: 10,
    paddingVertical: 8,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  legalLinkText: {
    fontSize: 11,
    fontFamily: 'Nunito-Bold',
    fontWeight: '600',
    color: theme.colors.primaryDark,
  },
  // 4. Checkbox
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  checkboxSquare: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
    backgroundColor: '#FFFFFF',
  },
  checkboxSquareActive: {
    backgroundColor: theme.colors.primaryDark,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxTextContainer: {
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: theme.colors.textMain,
    lineHeight: 18,
  },
  checkboxUnderlineText: {
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    color: theme.colors.primaryDark,
    textDecorationLine: 'underline',
  },
  // 5. Botón de Registro
  btnRegistro: {
    height: 52,
    backgroundColor: theme.colors.secondaryMain,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  btnRegistroDisabled: {
    backgroundColor: '#A4B0BE',
    opacity: 0.5,
    elevation: 0,
    shadowOpacity: 0,
  },
  btnRegistroText: {
    fontSize: 15,
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  helperText: {
    fontSize: 12,
    color: theme.colors.error,
    fontFamily: 'Nunito-Regular',
    textAlign: 'center',
    marginTop: 8,
  },

  // Estilos del Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: width * 0.9,
    maxHeight: '80%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#ECEFF1',
    paddingBottom: 12,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    color: theme.colors.textMain,
    flex: 1,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F2F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#57606F',
    fontWeight: 'bold',
  },
  layerIndicator: {
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  layerIndicatorText: {
    fontSize: 11,
    color: '#1E88E5',
    fontFamily: 'Nunito-Bold',
    fontWeight: '600',
  },
  modalScroll: {
    flexGrow: 0,
    marginVertical: 6,
  },
  modalScrollContent: {
    paddingBottom: 16,
  },
  summaryIntro: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: theme.colors.textSecondary,
    marginBottom: 14,
    lineHeight: 20,
  },
  summaryBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingRight: 10,
  },
  summaryBulletIcon: {
    fontSize: 14,
    marginRight: 8,
    marginTop: 2,
  },
  summaryBulletText: {
    fontSize: 13,
    fontFamily: 'Nunito-Regular',
    color: theme.colors.textMain,
    lineHeight: 18,
    flex: 1,
  },
  summaryFooterContainer: {
    marginTop: 10,
    backgroundColor: '#FAFAFA',
    padding: 10,
    borderRadius: 8,
  },
  summaryFooterText: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  fullLegalText: {
    fontSize: 12.5,
    fontFamily: 'Nunito-Regular',
    color: theme.colors.textMain,
    lineHeight: 19,
    textAlign: 'justify',
  },
  modalActions: {
    borderTopWidth: 1,
    borderColor: '#ECEFF1',
    paddingTop: 14,
    marginTop: 8,
  },
  toggleLayerBtn: {
    height: 40,
    borderWidth: 1.5,
    borderColor: theme.colors.primaryDark,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleLayerBtnActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primaryMain,
  },
  toggleLayerBtnText: {
    fontSize: 13,
    fontFamily: 'Nunito-Bold',
    fontWeight: '600',
    color: theme.colors.primaryDark,
  },
  toggleLayerBtnTextActive: {
    color: theme.colors.primaryDark,
  },
  modalAcceptBtn: {
    height: 44,
    backgroundColor: theme.colors.secondaryMain,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAcceptBtnText: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  keyboardContainer: {
    flex: 1,
  },
  spacer: {
    height: 40,
  },
  toggleModeBtnInline: {
    paddingTop: 14,
    paddingBottom: 4,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F2F6',
    marginTop: 8,
  },
  toggleModeText: {
    fontSize: 13,
    fontFamily: 'Nunito-Bold',
    fontWeight: '700',
    color: theme.colors.primaryDark,
    textDecorationLine: 'underline',
  },
  textInputError: {
    borderColor: theme.colors.error,
  },
  fieldErrorText: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: theme.colors.error,
    marginTop: 4,
    marginLeft: 2,
  },
});
