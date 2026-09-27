import re

file_path = '/home/violetzero/proyectoCuidadores/CuidaML/App.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update minVal in the render logic
old_render = """      {preguntasAMostrar.map((p: any) => {
        const minVal = p.test === 'Zarit' ? 1 : 0;
        const maxVal = p.max_score || 4;
        const options = [];
        for (let i = minVal; i <= maxVal; i++) options.push(i);"""

new_render = """      {preguntasAMostrar.map((p: any) => {
        const minVal = 0;
        const maxVal = p.max_score || 4;
        const options = [];
        for (let i = minVal; i <= maxVal; i++) options.push(i);"""

content = content.replace(old_render, new_render)

# 2. Add Audio Player to "Herramientas de Autocuidado"
old_herramientas = """        {/* HERRAMIENTAS - REUBICADAS AQUÍ */}
        <View style={[globalStyles.card, { backgroundColor: theme.colors.background, marginBottom: 15 }]}>
          <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', fontSize: 16, marginBottom: 10 }]}>🛠️ Herramientas de Autocuidado</Text>
          <TouchableOpacity style={{ backgroundColor: theme.colors.primaryLight, padding: 12, borderRadius: 8, marginBottom: 8 }} onPress={() => Linking.openURL('https://wa.me/1234567890?text=Hola, quiero más ejercicios de respiración.')}>
             <Text style={{ fontFamily: 'Nunito-Bold', color: theme.colors.primaryDark }}>Técnicas de Respiración (4-7-8)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ backgroundColor: theme.colors.primaryLight, padding: 12, borderRadius: 8 }}>
             <Text style={{ fontFamily: 'Nunito-Bold', color: theme.colors.primaryDark }}>Guía de Meditación Guiada</Text>
          </TouchableOpacity>
        </View>"""

new_herramientas = """        {/* HERRAMIENTAS - REUBICADAS AQUÍ */}
        <View style={[globalStyles.card, { backgroundColor: theme.colors.background, marginBottom: 15 }]}>
          <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', fontSize: 16, marginBottom: 10 }]}>🛠️ Herramientas de Autocuidado</Text>
          
          <View style={{ backgroundColor: theme.colors.primaryLight, padding: 15, borderRadius: 8, marginBottom: 8 }}>
             <Text style={{ fontFamily: 'Nunito-Bold', color: theme.colors.primaryDark, marginBottom: 10 }}>Técnica de Respiración (4-7-8)</Text>
             <Text style={{ fontFamily: 'Nunito-Regular', color: theme.colors.textSecondary, marginBottom: 10, fontSize: 12 }}>
                1. Inhala profundamente por la nariz durante 4 segundos.{"\n"}
                2. Mantén la respiración durante 7 segundos.{"\n"}
                3. Exhala lentamente por la boca durante 8 segundos.
             </Text>
             <TouchableOpacity style={{ backgroundColor: theme.colors.primaryMain, padding: 10, borderRadius: 5, alignItems: 'center' }} onPress={reproducirAudio}>
                <Text style={{ color: '#FFF', fontFamily: 'Nunito-Bold' }}>
                   {isPlayingAudio ? '⏸ Pausar Ejercicio' : '▶ Reproducir Ejercicio'}
                </Text>
             </TouchableOpacity>
             {(sound || audioProgress > 0) && (
               <View style={{ height: 4, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 2, marginTop: 10, overflow: 'hidden', width: '100%' }}>
                 <View style={{ height: '100%', width: `${audioProgress * 100}%`, backgroundColor: theme.colors.primaryMain }} />
               </View>
             )}
          </View>
        </View>"""

content = content.replace(old_herramientas, new_herramientas)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("App.tsx actualizado con herramientas.")
