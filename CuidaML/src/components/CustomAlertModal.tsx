import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import { theme } from '../styles/theme';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  buttons?: AlertButton[];
  onClose: () => void;
}

export const CustomAlertModal: React.FC<CustomAlertModalProps> = ({ visible, title, message, buttons, onClose }) => {
  const renderButtons = () => {
    if (!buttons || buttons.length === 0) {
      return (
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>OK</Text>
        </TouchableOpacity>
      );
    }

    return buttons.map((btn, index) => {
      const isCancel = btn.style === 'cancel';
      const isDestructive = btn.style === 'destructive';
      
      return (
        <TouchableOpacity
          key={index}
          style={[
            styles.button,
            buttons.length > 1 && { flex: 1, marginHorizontal: 5 },
            isCancel && styles.buttonCancel,
            isDestructive && styles.buttonDestructive,
          ]}
          onPress={() => {
            if (btn.onPress) btn.onPress();
            onClose();
          }}
        >
          <Text style={[
            styles.buttonText,
            isCancel && styles.buttonTextCancel,
            isDestructive && styles.buttonTextDestructive,
          ]}>
            {btn.text}
          </Text>
        </TouchableOpacity>
      );
    });
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.alertBox}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.message}>{message}</Text>
              <View style={styles.buttonContainer}>
                {renderButtons()}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBox: {
    width: '85%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontFamily: 'Nunito-Bold',
    fontSize: 18,
    color: theme.colors.textMain,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontFamily: 'Nunito-Regular',
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
  },
  button: {
    backgroundColor: theme.colors.primaryMain,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 100,
  },
  buttonCancel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#CCC',
  },
  buttonDestructive: {
    backgroundColor: theme.colors.error,
  },
  buttonText: {
    fontFamily: 'Nunito-Bold',
    color: '#FFF',
    fontSize: 14,
  },
  buttonTextCancel: {
    color: '#666',
  },
  buttonTextDestructive: {
    color: '#FFF',
  },
});
