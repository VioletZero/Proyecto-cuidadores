import pandas as pd
import torch
import json
import os
from torch.utils.data import Dataset, DataLoader
from transformers import BertTokenizer, BertForSequenceClassification
from torch.optim import AdamW
from sklearn.model_selection import train_test_split

# ==========================================
# 1. Carga y Preparación de Datos (Solo MEACorpus)
# ==========================================
# Este dataset es "data fundamentada" con 5,129 segmentos anotados [2, 4]
path_meacorpus = 'data/spanish-meacorpus-2023-dataset.csv'

try:
    # MEACorpus usa 'transcription' para el texto y 'label' para la emoción [5]
    df_raw = pd.read_csv(path_meacorpus)
    
    # Mapeo lógico para adaptar emociones de Ekman a categorías de CuidaML [2]
    # 'sadness' -> Depresión, 'fear' -> Ansiedad, 'anger' -> Sobrecarga, 'joy' -> Resiliencia
    mapeo_emociones = {
        'sadness': 'Depresión',
        'fear': 'Ansiedad',
        'anger': 'Sobrecarga',
        'joy': 'Resiliencia'
    }
    
    # Filtramos solo las categorías que tienen equivalencia directa en tu proyecto
    df = df_raw[df_raw['label'].isin(mapeo_emociones.keys())].copy()
    df['class'] = df['label'].map(mapeo_emociones)
    df = df.rename(columns={'transcription': 'text'}) # Normalizamos a 'text'
    
    print(f"Éxito: Cargados {len(df)} registros fundamentados del MEACorpus.")
    print(f"Distribución de clases finales:\n{df['class'].value_counts()}")

except Exception as e:
    print(f"Error crítico al leer el MEACorpus: {e}")
    exit()

# Mapeo de etiquetas a ID numéricos para BERT
class_list = df['class'].unique().tolist()
class_to_id = {label: i for i, label in enumerate(class_list)}
id_to_class = {i: label for label, i in class_to_id.items()}

# Guardar mapeo para que app.py pueda traducir las predicciones
with open('mapeo_clases.json', 'w', encoding='utf-8') as f:
    json.dump(id_to_class, f, ensure_ascii=False)

df['label_id'] = df['class'].map(class_to_id)

# División: 80% entrenamiento, 20% prueba [6, 7]
train_text, test_text, train_labels, test_labels = train_test_split(
    df['text'], df['label_id'], test_size=0.2, random_state=42
)

# ==========================================
# 2. Configuración del Dataset para BERT (BETO)
# ==========================================
# Usamos el modelo pre-entrenado en español de la Universidad de Chile [8, 9]
tokenizer = BertTokenizer.from_pretrained('dccuchile/bert-base-spanish-wwm-cased')

class MEADataset(Dataset):
    def __init__(self, texts, labels, tokenizer):
        self.texts = texts.tolist()
        self.labels = labels.tolist()
        self.tokenizer = tokenizer

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        encoding = self.tokenizer(
            self.texts[idx],
            truncation=True,
            padding='max_length',
            max_length=128,
            return_tensors='pt'
        )
        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.tensor(self.labels[idx], dtype=torch.long)
        }

train_loader = DataLoader(MEADataset(train_text, train_labels, tokenizer), batch_size=16, shuffle=True)

# ==========================================
# 3. Entrenamiento (Fine-Tuning Evolutivo)
# ==========================================
device = torch.device('cuda') if torch.cuda.is_available() else torch.device('cpu')
modelo = BertForSequenceClassification.from_pretrained(
    'dccuchile/bert-base-spanish-wwm-cased', 
    num_labels=len(class_list)
).to(device)

# Optimizador AdamW con regularización L2 para evitar sobreajuste [10, 11]
optimizer = AdamW(modelo.parameters(), lr=2e-5)

print(f"Iniciando entrenamiento fundamentado en: {device}...")
modelo.train()

for epoch in range(3):
    total_loss = 0
    for batch in train_loader:
        optimizer.zero_grad()
        input_ids = batch['input_ids'].to(device)
        attention_mask = batch['attention_mask'].to(device)
        labels = batch['labels'].to(device)
        
        outputs = modelo(input_ids, attention_mask=attention_mask, labels=labels)
        loss = outputs.loss
        loss.backward()
        optimizer.step()
        total_loss += loss.item()
    
    print(f"Época {epoch+1} completada. Pérdida: {total_loss/len(train_loader):.4f}")

# ==========================================
# 4. Guardar Modelo Final
# ==========================================
output_dir = './modelo_cuidadores'
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

modelo.save_pretrained(output_dir)
tokenizer.save_pretrained(output_dir)
print(f"Éxito: Modelo fundamentado guardado en {output_dir}")