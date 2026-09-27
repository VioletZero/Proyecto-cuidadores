import re

file_path = '/home/violetzero/proyectoCuidadores/CuidaML/App.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Eliminar const PREGUNTAS = [...] 
content = re.sub(r'const PREGUNTAS = \[.*?\];', '', content, flags=re.DOTALL)

# 2. Reemplazar "registro" por "Diario"
content = content.replace('Tu registro ha sido guardado correctamente', 'Tu Diario ha sido guardado correctamente')
content = content.replace('enviar el registro sin', 'enviar el Diario sin')
content = content.replace('tu registro diario', 'tu Diario de hoy')
content = content.replace('en tu registro', 'en tu Diario')

# 3. Lógica de racha
racha_old = """          const hoyStr = new Date().toDateString();
          const ultimaRachaFecha = await AsyncStorage.getItem('@ultima_fecha_racha');
          
          let nuevaRacha = rachaDias;
          if (ultimaRachaFecha !== hoyStr) {
             const ayer = new Date();
             ayer.setDate(ayer.getDate() - 1);
             
             if (ultimaRachaFecha === ayer.toDateString()) {
                nuevaRacha += 1;
             } else {
                nuevaRacha = 1; // Reseteo o inicio de racha
             }
             
             setRachaDias(nuevaRacha);
             await AsyncStorage.setItem('@racha_dias', nuevaRacha.toString());
             await AsyncStorage.setItem('@ultima_fecha_racha', hoyStr);
"""
racha_new = """          const hoyStr = new Date().toDateString();
          const ultimaRachaFecha = await AsyncStorage.getItem('@ultima_fecha_racha');
          
          let nuevaRacha = rachaDias;
          if (!ultimaRachaFecha) {
             nuevaRacha = 1;
          } else if (ultimaRachaFecha !== hoyStr) {
             const ayer = new Date();
             ayer.setDate(ayer.getDate() - 1);
             if (ultimaRachaFecha === ayer.toDateString()) {
                nuevaRacha += 1;
             } else {
                nuevaRacha = 1; // Reseteo o inicio de racha
             }
          }
          if (ultimaRachaFecha !== hoyStr) {
             setRachaDias(nuevaRacha);
             await AsyncStorage.setItem('@racha_dias', nuevaRacha.toString());
             await AsyncStorage.setItem('@ultima_fecha_racha', hoyStr);
"""
content = content.replace(racha_old, racha_new)

# 4. Render preguntas
preguntas_old = """      {preguntasAMostrar.map((p: any) => (
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
      ))}"""
preguntas_new = """      {preguntasAMostrar.map((p: any) => {
        const minVal = p.test === 'Zarit' ? 1 : 0;
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
      )})}"""
content = content.replace(preguntas_old, preguntas_new)

# 5. Fetch preguntas fix
fetch_old = """        const response = await fetch('https://cuidaml.luzserver.org/preguntas_diarias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login_count: loginCount })
        });"""
fetch_new = """        const response = await fetch('https://cuidaml.luzserver.org/preguntas_diarias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login_count: loginCount, tipo_evaluacion: tipoEvaluacion })
        });"""
content = content.replace(fetch_old, fetch_new)
content = content.replace("[usuarioRegistrado, loginCount]", "[usuarioRegistrado, loginCount, tipoEvaluacion]")

# 6. Ayuda -> Recursos y Herramientas
ayuda_old = """          <Text style={[globalStyles.headerTitle, { marginBottom: 0, marginLeft: 10 }]}>Profesionales de apoyo</Text>"""
ayuda_new = """          <Text style={[globalStyles.headerTitle, { marginBottom: 0, marginLeft: 10 }]}>Recursos y Herramientas</Text>"""
content = content.replace(ayuda_old, ayuda_new)

prof_card_old = """        <View style={{ marginTop: 12 }}>
          {PROFESIONALES.map((p, i) => ("""
prof_card_new = """        
        {/* HERRAMIENTAS - REUBICADAS AQUÍ */}
        <View style={[globalStyles.card, { backgroundColor: theme.colors.background, marginBottom: 15 }]}>
          <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', fontSize: 16, marginBottom: 10 }]}>🛠️ Herramientas de Autocuidado</Text>
          <TouchableOpacity style={{ backgroundColor: theme.colors.primaryLight, padding: 12, borderRadius: 8, marginBottom: 8 }} onPress={() => Linking.openURL('https://wa.me/1234567890?text=Hola, quiero más ejercicios de respiración.')}>
             <Text style={{ fontFamily: 'Nunito-Bold', color: theme.colors.primaryDark }}>Técnicas de Respiración (4-7-8)</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ backgroundColor: theme.colors.primaryLight, padding: 12, borderRadius: 8 }}>
             <Text style={{ fontFamily: 'Nunito-Bold', color: theme.colors.primaryDark }}>Guía de Meditación Guiada</Text>
          </TouchableOpacity>
        </View>
        <Text style={[globalStyles.bodyText, { fontFamily: 'Nunito-Bold', fontSize: 16, marginBottom: 10, marginLeft: 5 }]}>👨‍⚕️ Profesionales de apoyo</Text>
        <View style={{ marginTop: 0 }}>
          {PROFESIONALES.map((p, i) => ("""
content = content.replace(prof_card_old, prof_card_new)

taskbar_old = """💬 Ayuda"""
taskbar_new = """📚 Recursos"""
content = content.replace(taskbar_old, taskbar_new)

# 7. Typography (Negritas en textos clave de la interfaz)
# El texto de "Tu espacio personal" -> "Diario Personal" y negrita
espacio_old = """Tu espacio personal"""
espacio_new = """Mi Diario"""
content = content.replace(espacio_old, espacio_new)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("App.tsx updated successfully.")
