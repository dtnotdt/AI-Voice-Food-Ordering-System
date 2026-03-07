import re

class NLUEngine:
    def __init__(self):
        # We simulate the Translation Pipeline logic from V6, but in robust Python
        self.intent_map = {
            'add': ['add', 'get', 'want', 'order', 'give me', 'include'],
            'remove': ['remove', 'delete', 'cancel', 'drop', 'take out'],
            'increase': ['increase', 'add more', 'plus', 'extra'],
            'decrease': ['decrease', 'less', 'reduce', 'minus'],
            'nav_cart': ['cart', 'basket', 'my order', 'show'],
            'checkout': ['confirm', 'checkout', 'pay', 'done', 'proceed', 'place'],
            'category_qa': ['what', 'which', 'do you have', 'options', 'menu']
        }
        
        self.categories = {
            'Starters': ['starter', 'appetizer'],
            'Main Course': ['main course', 'main', 'meal'],
            'Combos': ['combo', 'thali'],
            'Beverages': ['drink', 'beverage', 'cold drink'],
            'Desserts': ['dessert', 'sweet', 'ice cream'],
            'Sides': ['side', 'extra']
        }
        
        print("🧠 Python NLU Engine Initialized.")

    def parse_intent(self, translated_text: str):
        text = translated_text.lower().strip()
        
        # Default fallback
        action = 'add'
        for act, keywords in self.intent_map.items():
            if any(k in text for k in keywords):
                if act == 'nav_cart' and any(k in text for k in self.intent_map['add']):
                    continue
                action = act
                if act != 'add':
                    break
                    
        # Extract Quantity
        qty = 1
        num_patterns = {
            1: [r'\b(one|a|an)\b', r'\b1\b'],
            2: [r'\b(two|couple)\b', r'\b2\b'],
            3: [r'\b(three)\b', r'\b3\b'],
            4: [r'\b(four)\b', r'\b4\b'],
            5: [r'\b(five)\b', r'\b5\b']
        }
        
        for q, patterns in num_patterns.items():
            for p in patterns:
                if re.search(p, text):
                    qty = q
                    break
                    
        # Extract Item Number (e.g. "item 5")
        item_id = None
        id_match = re.search(r'(?:item|number|no|#)\s*(\d+)', text)
        if id_match:
            item_id = int(id_match.group(1))

        # Extract Special Instructions
        instructions = None
        instruction_keywords = ['extra', 'less', 'no', 'make it', 'without']
        for word in instruction_keywords:
            idx = text.find(word)
            if idx != -1:
                # Get everything after the keyword
                rest = text[idx:].strip()
                if len(rest) > 3:
                    instructions = rest
                break

        # Check Category QA
        category_target = None
        if action == 'category_qa':
            for cat, keywords in self.categories.items():
                if any(re.search(fr'\b{k}\b', text) for k in keywords):
                    category_target = cat
                    break

        return {
            "action": action,
            "quantity": qty,
            "item_id": item_id,
            "search_query": text, # Raw text to pass to FAISS
            "instructions": instructions,
            "category": category_target
        }

nlu = NLUEngine()
