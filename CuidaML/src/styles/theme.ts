import { StyleSheet } from 'react-native';

export const theme = {
  colors: {
    background: '#FFFFFF', 
    white: '#FFFFFF',
    primaryPastel: '#AED9E0',   
    secondaryPastel: '#B8E0D2', 
    alertIntense: '#4A90E2',    
    textMain: '#2D3436',        
    textSecondary: '#636E72',
    borderLight: '#DCDDE1',     // Color para el contorno del input
    inputBg: '#F9F9F9',         // Fondo sutil para el área de texto
    cardShadow: 'rgba(0, 0, 0, 0.05)',
  },
  roundness: 24,
};

export const globalStyles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: theme.colors.background,
  },
  card: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.roundness,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: theme.colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: 'Nunito-Bold',
    color: theme.colors.textMain,
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 16,
    fontFamily: 'Nunito-Regular',
    color: theme.colors.textMain,
    lineHeight: 22,
  },
  // NUEVO: Estilo para diferenciar el espacio de escritura
  inputArea: {
    backgroundColor: theme.colors.inputBg,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: 16,
    padding: 12,
    minHeight: 120,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  button: {
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.secondaryPastel,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    elevation: 2,
  },
  buttonText: {
    fontFamily: 'Nunito-Bold',
    fontSize: 18,
    color: theme.colors.textMain,
    textTransform: 'uppercase',
  }
});