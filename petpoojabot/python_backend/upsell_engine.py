import pandas as pd
from mlxtend.frequent_patterns import apriori, association_rules
from itertools import combinations
import os

class UpsellEngine:
    def __init__(self):
        self.rules = pd.DataFrame()
        self.train_dummy_model()

    def train_dummy_model(self):
        # We will simulate a past POS transaction dataset since there's no real DB yet
        # Common associations: Burger -> Fries, Pizza -> Coke
        transactions = [
            ['Veg Burger', 'Fries', 'Coke'],
            ['Paneer Pizza', 'Coke'],
            ['Veg Burger', 'Fries'],
            ['Peri Peri Fries', 'Cold Coffee'],
            ['Veg Wrap', 'Iced Tea'],
            ['Paneer Pizza', 'Garlic Bread', 'Pepsi'],
            ['Veg Burger', 'Coke'],
            ['Garlic Bread', 'Pepsi'],
            ['Peri Peri Fries', 'Coke'],
            ['Veg Burger', 'Fries', 'Coke', 'Cold Coffee']
        ]
        
        # Convert to one-hot encoded DataFrame for mlxtend
        all_items = set(item for transaction in transactions for item in transaction)
        encoded_vals = []
        for transaction in transactions:
            encoded_vals.append({item: (item in transaction) for item in all_items})
            
        df = pd.DataFrame(encoded_vals)
        
        # Discover frequent itemsets
        try:
            frequent_itemsets = apriori(df, min_support=0.1, use_colnames=True)
            if not frequent_itemsets.empty:
                # Generate association rules
                self.rules = association_rules(frequent_itemsets, metric="lift", min_threshold=1.2)
                print(f"📈 Upsell Engine initialized with {len(self.rules)} association rules.")
            else:
                print("⚠️ Upsell Engine: No frequent itemsets found.")
        except Exception as e:
            print(f"❌ Upsell Engine Error: {e}")

    def get_upsell(self, cart_items):
        if self.rules.empty or not cart_items:
            return None
            
        # Find rules where all items in the antecedent are in the cart
        # We prioritize rules that have at least one cart item in the antecedent
        matching_rules = []
        
        for idx, row in self.rules.iterrows():
            antecedents = set(row['antecedents'])
            consequents = set(row['consequents'])
            
            # Check if any cart item matches the antecedents
            if antecedents.intersection(set(cart_items)):
                # Recommend items not already in the cart
                recommendations = consequents - set(cart_items)
                if recommendations:
                    matching_rules.append({
                        'recommendation': list(recommendations)[0],
                        'lift': row['lift'],
                        'confidence': row['confidence']
                    })
                    
        if not matching_rules:
            return None
            
        # Sort by lift (highest first)
        matching_rules.sort(key=lambda x: x['lift'], reverse=True)
        return matching_rules[0]['recommendation']

    def get_voice_upsell(self, cart_item_names: list[str], max_suggestions: int = 3) -> list[dict]:
        """
        Get multiple smart upsell suggestions for voice ordering flow.
        Combines association rules with hardcoded pairing knowledge.
        
        Returns:
            List of dicts: [{ name, reason }]
        """
        cart_lower = [name.lower() for name in cart_item_names]
        suggestions = []
        seen = set()
        
        # ── Hardcoded smart pairings (domain knowledge) ──────────────
        PAIRINGS = {
            "veg burger": [
                {"name": "Fries", "reason": "goes great with burgers"},
                {"name": "Coke", "reason": "popular combo drink"},
                {"name": "Cold Coffee", "reason": "customers love it with burgers"},
            ],
            "paneer pizza": [
                {"name": "Garlic Bread", "reason": "classic pizza side"},
                {"name": "Coke", "reason": "popular combo drink"},
                {"name": "Pepsi", "reason": "refreshing with pizza"},
            ],
            "peri peri fries": [
                {"name": "Cold Coffee", "reason": "balances the spice"},
                {"name": "Coke", "reason": "refreshing pairing"},
            ],
            "fries": [
                {"name": "Veg Burger", "reason": "classic burger + fries"},
                {"name": "Coke", "reason": "popular combo drink"},
            ],
            "veg wrap": [
                {"name": "Iced Tea", "reason": "light and refreshing"},
                {"name": "Cold Coffee", "reason": "popular pairing"},
            ],
            "garlic bread": [
                {"name": "Pepsi", "reason": "goes well together"},
            ],
            "cold coffee": [
                {"name": "Garlic Bread", "reason": "great snack pairing"},
            ],
        }
        
        # Collect from hardcoded pairings
        for item in cart_lower:
            for pairing_key, paired_items in PAIRINGS.items():
                if pairing_key in item:
                    for p in paired_items:
                        if p["name"].lower() not in cart_lower and p["name"] not in seen:
                            suggestions.append(p)
                            seen.add(p["name"])
        
        # Also try association rules
        rule_rec = self.get_upsell(cart_item_names)
        if rule_rec and rule_rec not in seen and rule_rec.lower() not in cart_lower:
            suggestions.append({"name": rule_rec, "reason": "frequently ordered together"})
            seen.add(rule_rec)
        
        # If still empty, suggest popular beverages
        if not suggestions:
            has_beverage = any(
                b in ' '.join(cart_lower) 
                for b in ["coke", "pepsi", "coffee", "tea"]
            )
            if not has_beverage:
                suggestions.append({"name": "Cold Coffee", "reason": "popular add-on"})
                suggestions.append({"name": "Coke", "reason": "refreshing drink"})
        
        result = suggestions[:max_suggestions]
        print(f"🎯 [Upsell] Suggestions for {cart_item_names}: {[s['name'] for s in result]}")
        return result


engine = UpsellEngine()
