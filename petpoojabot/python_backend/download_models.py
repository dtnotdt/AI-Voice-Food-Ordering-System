import os
import urllib.request
import certifi
import ssl

ssl_context = ssl.create_default_context(cafile=certifi.where())

MODELS_DIR = "models"
os.makedirs(MODELS_DIR, exist_ok=True)

models_to_download = {
    "english": ("en/en_US/lessac/medium/en_US-lessac-medium.onnx", "en_US-lessac-medium.onnx"),
    "hindi": ("hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx", "hi_IN-model.onnx"),
    "malayalam": ("ml/ml_IN/arjun/medium/ml_IN-arjun-medium.onnx", "ml_IN-model.onnx"),
    "arabic": ("ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx", "ar-model.onnx"),
    # As Piper lacks Gujarati/Marathi/Tamil officially, we map them locally to Hindi
    # Marathi and Hindi share Devanagari. Gujarati/Tamil might need transliteration later.
    "gujarati": ("hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx", "gu_IN-model.onnx"),
    "marathi": ("hi/hi_IN/pratham/medium/hi_IN-pratham-medium.onnx", "mr_IN-model.onnx"),
    "tamil": ("ml/ml_IN/arjun/medium/ml_IN-arjun-medium.onnx", "ta_IN-model.onnx"), # Malaylam is phonetically closest to Tamil in Dravidian family
}

base_url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/"
for lang, (remote_path, local_name) in models_to_download.items():
    onnx_url = base_url + remote_path
    json_url = onnx_url + ".json"
    
    onnx_path = os.path.join(MODELS_DIR, local_name)
    json_path = onnx_path + ".json"
    
    if not os.path.exists(onnx_path):
        print(f"Downloading {local_name}...")
        req = urllib.request.Request(onnx_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ssl_context) as r, open(onnx_path, 'wb') as f:
            f.write(r.read())
            
    if not os.path.exists(json_path):
        print(f"Downloading {local_name}.json...")
        req = urllib.request.Request(json_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, context=ssl_context) as r, open(json_path, 'wb') as f:
            f.write(r.read())

print("All models downloaded and mapped.")
