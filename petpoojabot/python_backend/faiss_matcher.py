import pandas as pd
import faiss
import numpy as np
import os
import re
import unicodedata
from sentence_transformers import SentenceTransformer

DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backend', 'data', 'menu.csv')

class SemanticMenuMatcher:
    def __init__(self, model_name='all-MiniLM-L6-v2'):
        self.model = SentenceTransformer(model_name)
        self.load_menu()
        self.build_index()

    def load_menu(self):
        try:
            self.df = pd.read_csv(DATA_PATH)
            # Create a rich text representation for embedding, normalized to lowercase
            self.df['search_text'] = (self.df['name'] + " " + self.df['category'].fillna('') + " " + self.df['tags'].fillna('')).str.lower().str.strip()
            self.menu_items = self.df.to_dict('records')
            print(f"✅ Menu Matcher Loaded {len(self.menu_items)} items for FAISS indexing.")
        except Exception as e:
            print(f"❌ Error loading menu: {e}")
            self.df = pd.DataFrame()
            self.menu_items = []

    def build_index(self):
        if self.df.empty:
            return
        print("🧠 Building FAISS embeddings...")
        embeddings = self.model.encode(self.df['search_text'].tolist())
        dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dimension)
        self.index.add(np.array(embeddings).astype('float32'))
        print("✅ FAISS Index build complete.")

    @staticmethod
    def normalize(text: str) -> str:
        """Lowercase, strip, collapse whitespace, and remove accents for consistent matching."""
        text = text.lower().strip()
        # Normalize unicode (e.g. accented chars from Whisper)
        text = unicodedata.normalize('NFKD', text)
        text = ''.join(c for c in text if not unicodedata.combining(c))
        # Collapse multiple spaces
        text = re.sub(r'\s+', ' ', text)
        return text

    def match(self, query: str, top_k=1):
        if self.df.empty:
            return None
        
        normalized_query = self.normalize(query)
        print(f"🔍 FAISS matching normalized query: '{normalized_query}'")
        q_emb = self.model.encode([normalized_query]).astype('float32')
        distances, indices = self.index.search(q_emb, top_k)
        
        results = []
        for i in range(top_k):
            idx = indices[0][i]
            if idx != -1: 
                item = self.menu_items[idx]
                results.append({
                    "item": item,
                    "distance": float(distances[0][i])
                })
        
        return results[0] if top_k == 1 else results

matcher = SemanticMenuMatcher()
