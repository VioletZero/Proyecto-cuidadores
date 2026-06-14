import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';

interface NotificacionModalProps {
  visible: boolean;
  onClose: (actionType: string) => void;
  data: {
    id: string;
    notificationTitle: string;
    notificationPreview: string;
    modalHeader: string;
    modalBody: string;
    actionButtonText: string;
  } | null;
}

const { height } = Dimensions.get('window');

export const NotificacionModal: React.FC<NotificacionModalProps> = ({ visible, onClose, data }) => {
  if (!data) return null;

  // Renderizador básico de Markdown/Negritas/Viñetas para React Native
  const renderFormattedText = (text: string) => {
    return text.split('\n').map((line, index) => {
      const trimmedLine = line.trim();
      
      // Viñetas
      if (trimmedLine.startsWith('*')) {
        const content = trimmedLine.replace(/^\*\s*/, '');
        const parts = content.split('**');
        return (
          <View key={index} style={styles.bulletRow}>
            <Text style={styles.bulletIcon}>•</Text>
            <Text style={styles.bulletText}>
              {parts.map((part, i) => 
                i % 2 === 1 ? <Text key={i} style={styles.boldText}>{part}</Text> : part
              )}
            </Text>
          </View>
        );
      }
      
      // Líneas normales o vacías
      if (trimmedLine === '') {
        return <View key={index} style={styles.lineSpacer} />;
      }
      
      // Párrafos con soporte para **negrita**
      const parts = trimmedLine.split('**');
      return (
        <Text key={index} style={styles.paragraphText}>
          {parts.map((part, i) => 
            i % 2 === 1 ? <Text key={i} style={styles.boldText}>{part}</Text> : part
          )}
        </Text>
      );
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false} // Pantalla completa bloqueante
      onRequestClose={() => onClose('close')}
    >
      <SafeAreaView style={styles.container}>
        {/* Cabecera superior con botón de cerrar opcional */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Apoyo Emocional Especializado</Text>
          <TouchableOpacity style={styles.closeIconButton} onPress={() => onClose('close')}>
            <Text style={styles.closeIconText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Cuerpo Scrollable */}
        <ScrollView 
          style={styles.scrollArea} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <Text style={styles.modalHeaderTitle}>{data.modalHeader}</Text>
          <View style={styles.divider} />
          
          <View style={styles.bodyTextContainer}>
            {renderFormattedText(data.modalBody)}
          </View>
        </ScrollView>

        {/* Footer fijo con botón principal */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => onClose(data.actionButtonText)}
            activeOpacity={0.85}
          >
            <Text style={styles.actionButtonText}>
              {data.actionButtonText.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F2F6',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: 'Nunito-Bold',
    color: theme.colors.textSecondary,
    letterSpacing: 0.5,
  },
  closeIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F2F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIconText: {
    fontSize: 14,
    color: '#57606F',
    fontWeight: 'bold',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  modalHeaderTitle: {
    fontSize: 22,
    fontFamily: 'Nunito-Bold',
    color: theme.colors.primaryDark,
    lineHeight: 30,
    marginBottom: 16,
  },
  divider: {
    height: 3,
    backgroundColor: theme.colors.primaryPastel,
    width: 60,
    borderRadius: 2,
    marginBottom: 24,
  },
  bodyTextContainer: {
    flex: 1,
  },
  paragraphText: {
    fontSize: 16,
    fontFamily: 'Nunito-Regular',
    color: theme.colors.textMain,
    lineHeight: 25,
    marginBottom: 12,
  },
  boldText: {
    fontFamily: 'Nunito-Bold',
    fontWeight: 'bold',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingLeft: 8,
  },
  bulletIcon: {
    fontSize: 16,
    color: theme.colors.primaryMain,
    marginRight: 8,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Nunito-Regular',
    color: theme.colors.textMain,
    lineHeight: 24,
  },
  lineSpacer: {
    height: 12,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F2F6',
    backgroundColor: '#FFFFFF',
  },
  actionButton: {
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.secondaryMain,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  actionButtonText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
});
