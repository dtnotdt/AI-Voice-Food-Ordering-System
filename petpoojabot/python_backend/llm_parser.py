from pydantic import BaseModel, Field
from typing import List, Optional
import json
import os
from openai import OpenAI
from phrase_cleaner import clean as clean_phrase

# Ensure to set OPENAI_API_KEY in the environment
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key) if api_key else None

class OrderItem(BaseModel):
    name: str = Field(description="The name of the menu item identified from the user's speech")
    quantity: int = Field(default=1, description="The quantity of the item requested")
    instructions: Optional[str] = Field(default=None, description="Any special instructions for this item")

class IntentParsingResult(BaseModel):
    intent: str = Field(description="The primary action: 'add_to_cart', 'remove_item', 'modify_quantity', 'menu_query', 'order_checkout', 'cancel_order', 'set_address', or 'unknown'")
    items: Optional[List[OrderItem]] = Field(default=[], description="List of items associated with the intent")
    query_text: Optional[str] = Field(default=None, description="For menu_query, what the user is asking about")
    address: Optional[str] = Field(default=None, description="The extracted delivery address if the user provides one")

class LLMParser:
    def __init__(self):
        print("🧠 Translating Intent Parser (LLM) Initialized.")
        
    def _create_system_prompt(self):
        # Provide sample of menu to guide LLM but rely on SemanticMenuMatcher for fuzzy ID resolution
        return """
        You are a highly accurate, multilingual restaurant ordering AI assistant. 
        Your task is to parse a user's transcript (which may be in English, Hindi, Gujarati, Marathi, Tamil, Malayalam, Arabic, or transliterated code-mixed formats) into a strict JSON command structure.
        
        SUPPORTED INTENTS:
        - add_to_cart: User wants to order food. (e.g. "Add two burgers", "ek paneer pizza de do", "rendu dosai venum")
        - remove_item: User wants to remove food. (e.g. "Remove coke", "ye hatao")
        - modify_quantity: User wants to change the amount of an item. 
        - menu_query: User is asking about what's available. 
        - order_checkout: User wants to checkout/pay. 
        - cancel_order: User wants to cancel everything.
        - set_address: User is providing a delivery address.
        - unknown: Cannot understand intent.
        
        RULES:
        1. Always extract the item 'name', 'quantity' (integer).
        2. CRITICAL: Any special instructions, modifiers, or negative constraints (e.g., "extra onions", "less spicy", "bina mayo", "no cheese", "without ice", "medium cooked", "jain", "spicy") MUST be extracted entirely into the 'instructions' field. Do not include these in the 'name'.
        3. Even if the text is in Roman Hindi or Tamil slang, parse the intent correctly and map the core action.
        4. If the user refers to an item by its number (e.g. "item number 5"), extract "item #5" as the name.
        5. Provide the result strictly matching the provided JSON schema.
        6. If the intent is set_address, store the full address string in the 'address' field.
        """

    def parse_intent(self, text: str) -> dict:
        print(f"🤖 LLM Parsing Input: '{text}'")
        
        legacy_intent = {
            "action": "unknown",
            "quantity": 1,
            "item_id": None,
            "itemData": None,
            "search_query": text,
            "instructions": None,
            "category": None,
            "needs_clarification": False,
            "alternatives": []
        }
        
        if not client:
            print("⚠️ OPENAI_API_KEY not found. Using local fallback regex parser for demonstration.")
            # Fallback logic for basic commands — multilingual
            t = text.lower()
            original_text = text  # Preserve original for script-based matching
            
            # ── Remove detection (must check BEFORE add since "हटाओ" could co-occur with item names) ──
            remove_keywords_en = ["remove", "cancel", "delete"]
            remove_keywords_hi = ["हटाओ", "हटा", "निकालो", "कार्ट से हटाओ", "हटा दो"]
            remove_keywords_hi_roman = ["hatao", "hata", "nikalo", "cart se hatao", "hata do"]
            remove_keywords_gu = ["કાઢો", "કાઢી", "કાર્ટમાંથી કાઢો", "દૂર કરો"]
            remove_keywords_gu_roman = ["kadho", "kadhi", "door karo"]
            
            is_remove = any(k in t for k in remove_keywords_en + remove_keywords_hi_roman + remove_keywords_gu_roman)
            if not is_remove:
                is_remove = any(k in original_text for k in remove_keywords_hi + remove_keywords_gu)
            
            # ── Add detection ──
            add_keywords_en = ["add", "want", "give me", "order", "get"]
            add_keywords_hi = ["चाहिए", "दो", "दे", "डालो", "लगाओ", "ऐड"]
            add_keywords_hi_roman = ["chahiye", "daal do", "de do", "dena", "lagao", "add karo", "daal", "dal do"]
            add_keywords_gu = ["આપો", "ઉમેરો", "નાખો", "જોઈએ"]
            add_keywords_gu_roman = ["aapo", "umero", "nakho", "joie"]
            
            is_add = any(k in t for k in add_keywords_en + add_keywords_hi_roman + add_keywords_gu_roman)
            if not is_add:
                is_add = any(k in original_text for k in add_keywords_hi + add_keywords_gu)
            
            # ── Checkout detection ──
            checkout_keywords = ["checkout", "pay", "confirm order", "place order"]
            is_checkout = any(k in t for k in checkout_keywords)
            
            from smart_matcher import smart_matcher
            from quantity_parser import parse_quantity
            
            if is_remove:
                legacy_intent["action"] = "remove"
                sm_result = smart_matcher.match(text)
                if sm_result:
                    legacy_intent['item_id'] = int(sm_result['item']['id'])
                    legacy_intent['itemData'] = sm_result['item']
                    legacy_intent['search_query'] = sm_result['item']['name']
                    legacy_intent['match_score'] = sm_result['score']
                    legacy_intent['match_method'] = sm_result['method']
                    legacy_intent['needs_clarification'] = sm_result.get('needs_clarification', False)
                    legacy_intent['alternatives'] = sm_result.get('alternatives', [])
                    print(f"🗑️ LOCAL Remove Resolved: {sm_result['item']['name']} (score: {sm_result['score']:.2f})")
            elif is_add:
                legacy_intent["action"] = "add"
                legacy_intent["quantity"] = parse_quantity(text)
                sm_result = smart_matcher.match(text)
                if sm_result:
                    legacy_intent['item_id'] = int(sm_result['item']['id'])
                    legacy_intent['itemData'] = sm_result['item']
                    legacy_intent['search_query'] = sm_result['item']['name']
                    legacy_intent['match_score'] = sm_result['score']
                    legacy_intent['match_method'] = sm_result['method']
                    legacy_intent['needs_clarification'] = sm_result.get('needs_clarification', False)
                    legacy_intent['alternatives'] = sm_result.get('alternatives', [])
                    print(f"🎯 LOCAL Add Resolved: {sm_result['item']['name']} (qty: {legacy_intent['quantity']}, score: {sm_result['score']:.2f})")
            elif is_checkout:
                legacy_intent["action"] = "checkout"
            # ── Quantity-prefix implicit add: 'one misal pav', 'ek misal', '2 dosa' etc. ──
            # This is a key fix: quantity words before an item name mean 'add' even without 'add' keyword
            QUANTITY_TRIGGER_WORDS = [
                # English
                "one ", "two ", "three ", "four ", "five ", "six ", "seven ", "eight ", "nine ", "ten ",
                "a ", "an ", "1 ", "2 ", "3 ", "4 ", "5 ",
                # Hindi romanized
                "ek ", "do ", "char ", "paanch ", "teen ",
                # Gujarati romanized
                "ek ", "be ",
                # Tamil
                "onru ", "irantu ", "rendu ", "oru ",
                # Malayalam
                "onnu ", "randu ",
                # Arabic
                "wahid ", "ithnayn ",
            ]
            has_quantity_word = any(t.startswith(kw) for kw in QUANTITY_TRIGGER_WORDS)
            
            if not is_add and not is_remove and not is_checkout and has_quantity_word:
                is_add = True
                
            # Default: try to match as an add (user might just say the item name)
            sm_result = smart_matcher.match(text)
            if sm_result and sm_result['score'] >= 0.45:
                legacy_intent["action"] = "add"
                legacy_intent["quantity"] = parse_quantity(text)
                legacy_intent['item_id'] = int(sm_result['item']['id'])
                legacy_intent['itemData'] = sm_result['item']
                legacy_intent['search_query'] = sm_result['item']['name']
                legacy_intent['match_score'] = sm_result['score']
                legacy_intent['match_method'] = sm_result['method']
                legacy_intent['needs_clarification'] = sm_result.get('needs_clarification', False)
                legacy_intent['alternatives'] = sm_result.get('alternatives', [])
                print(f"🎯 LOCAL Implicit Add: {sm_result['item']['name']} (score: {sm_result['score']:.2f})")
                
            return legacy_intent
            
        try:
            response = client.beta.chat.completions.parse(
                model="gpt-4o",  # Prefer 4o for precise JSON, or 4o-mini
                messages=[
                    {"role": "system", "content": self._create_system_prompt()},
                    {"role": "user", "content": text}
                ],
                response_format=IntentParsingResult,
                temperature=0.1
            )
            
            structured_data = response.choices[0].message.parsed
            
            # Map "add_to_cart" to the legacy "add" mapping used in API, or we can transform it
            # Transform LLM Output to Legacy API structure for compatibility
            legacy_intent = {
                "action": "unknown",
                "quantity": 1,
                "item_id": None,
                "itemData": None,
                "search_query": text,
                "instructions": None,
                "category": None,
                "needs_clarification": False,
                "alternatives": []
            }
            
            # Map new schema to expected API structure
            if structured_data.intent == "add_to_cart":
                legacy_intent["action"] = "add"
            elif structured_data.intent == "remove_item":
                legacy_intent["action"] = "remove"
            elif structured_data.intent == "modify_quantity":
                legacy_intent["action"] = "increase" # Simplified legacy conversion
            elif structured_data.intent == "menu_query":
                legacy_intent["action"] = "category_qa"
                legacy_intent["category"] = structured_data.query_text
            elif structured_data.intent == "order_checkout":
                legacy_intent["action"] = "checkout"
            elif structured_data.intent == "set_address":
                legacy_intent["action"] = "address"
                legacy_intent["instructions"] = structured_data.address
            
            # Use smart matcher to find exactly what item was said if items array exists
            if structured_data.items and len(structured_data.items) > 0:
                first_item = structured_data.items[0]
                legacy_intent["quantity"] = first_item.quantity
                legacy_intent["instructions"] = first_item.instructions
                
                # Match name via SmartMatcher (alias + fuzzy + semantic)
                from smart_matcher import smart_matcher
                sm_result = smart_matcher.match(first_item.name)
                if sm_result:
                    legacy_intent['item_id'] = int(sm_result['item']['id'])
                    legacy_intent['itemData'] = sm_result['item']
                    legacy_intent['search_query'] = first_item.name
                    legacy_intent['match_score'] = sm_result['score']
                    legacy_intent['match_method'] = sm_result['method']
                    legacy_intent['needs_clarification'] = sm_result.get('needs_clarification', False)
                    legacy_intent['alternatives'] = sm_result.get('alternatives', [])
                    print(f"🎯 LLM SmartMatch Resolved: {sm_result['item']['name']} (ID: {legacy_intent['item_id']}, score: {sm_result['score']:.2f})")
                    
            return legacy_intent
            
        except Exception as e:
            print(f"❌ LLM Parsing Error: {e}")
            print("📝 Falling back to local multilingual regex parser...")
            # Use the same local fallback as when no API key is set
            t = text.lower()
            original_text = text
            
            remove_keywords_en = ["remove", "cancel", "delete", "drop", "take out"]
            remove_keywords_hi = ["हटाओ", "हटा", "निकालो", "कार्ट से हटाओ", "हटा दो", "मत"]
            remove_keywords_hi_roman = ["hatao", "hata", "nikalo", "cart se hatao", "hata do", "cancel karo"]
            remove_keywords_gu = ["કાઢો", "કાઢી", "કાર્ટમાંથી કાઢો", "દૂર કરો"]
            remove_keywords_gu_roman = ["kadho", "kadhi", "door karo"]
            remove_keywords_mar = ["kadhun taka", "nako", "kadha"]
            remove_keywords_tam = ["venda", "remove", "eduthiru", "vendam"]
            remove_keywords_mal = ["venda", "maattu", "ozhivaakku"]
            remove_keywords_ara = ["izala", "ilgha", "la urid"]
            
            is_remove = any(k in t for k in remove_keywords_en + remove_keywords_hi_roman + remove_keywords_gu_roman + remove_keywords_mar + remove_keywords_tam + remove_keywords_mal + remove_keywords_ara)
            if not is_remove:
                is_remove = any(k in original_text for k in remove_keywords_hi + remove_keywords_gu)
            
            add_keywords_en = ["add", "want", "give me", "order", "get", "include"]
            add_keywords_hi = ["चाहिए", "दो", "दे", "डालो", "लगाओ", "ऐड"]
            add_keywords_hi_roman = ["chahiye", "daal do", "de do", "dena", "lagao", "add karo", "daal", "dal do"]
            add_keywords_gu = ["આપો", "ઉમેરો", "નાખો", "જોઈએ"]
            add_keywords_gu_roman = ["aapo", "umero", "nakho", "joie"]
            add_keywords_mar = ["pahije", "dya", "de", "kara", "ghya"]
            add_keywords_tam = ["venum", "kudu", "vei", "podu"]
            add_keywords_mal = ["venam", "tharu"]
            add_keywords_ara = ["uridu", "aetini", "wahid"]
            
            is_add = any(k in t for k in add_keywords_en + add_keywords_hi_roman + add_keywords_gu_roman + add_keywords_mar + add_keywords_tam + add_keywords_mal + add_keywords_ara)
            if not is_add:
                is_add = any(k in original_text for k in add_keywords_hi + add_keywords_gu)
            
            checkout_keywords = ["checkout", "pay", "confirm order", "place order"]
            is_checkout = any(k in t for k in checkout_keywords)
            
            from smart_matcher import smart_matcher
            from quantity_parser import parse_quantity
            
            fallback = {
                "action": "unknown", "quantity": 1, "item_id": None,
                "itemData": None, "search_query": text, "instructions": None, "category": None,
                "needs_clarification": False, "alternatives": []
            }
            
            if is_remove:
                fallback["action"] = "remove"
                sm_result = smart_matcher.match(text)
                if sm_result:
                    fallback['item_id'] = int(sm_result['item']['id'])
                    fallback['itemData'] = sm_result['item']
                    fallback['search_query'] = sm_result['item']['name']
                    fallback['match_score'] = sm_result['score']
                    fallback['match_method'] = sm_result['method']
                    fallback['needs_clarification'] = sm_result.get('needs_clarification', False)
                    fallback['alternatives'] = sm_result.get('alternatives', [])
                    print(f"🗑️ FALLBACK Remove: {sm_result['item']['name']} (score: {sm_result['score']:.2f})")
            elif is_add:
                fallback["action"] = "add"
                fallback["quantity"] = parse_quantity(text)
                sm_result = smart_matcher.match(text)
                if sm_result:
                    fallback['item_id'] = int(sm_result['item']['id'])
                    fallback['itemData'] = sm_result['item']
                    fallback['search_query'] = sm_result['item']['name']
                    fallback['match_score'] = sm_result['score']
                    fallback['match_method'] = sm_result['method']
                    fallback['needs_clarification'] = sm_result.get('needs_clarification', False)
                    fallback['alternatives'] = sm_result.get('alternatives', [])
                    print(f"🎯 FALLBACK Add: {sm_result['item']['name']} (qty: {fallback['quantity']}, score: {sm_result['score']:.2f})")
            elif is_checkout:
                fallback["action"] = "checkout"
            else:
                QUANTITY_TRIGGER_WORDS = [
                    "one ", "two ", "three ", "a ", "an ", "1 ", "2 ", "3 ", "4 ", "5 ",
                    "ek ", "do ", "char ", "oru ", "rendu ", "wahid ",
                ]
                has_quantity_word = any(t.startswith(kw) for kw in QUANTITY_TRIGGER_WORDS)
                sm_result = smart_matcher.match(text)
                if sm_result and sm_result['score'] >= 0.45:
                    fallback["action"] = "add"
                    fallback["quantity"] = parse_quantity(text)
                    fallback['item_id'] = int(sm_result['item']['id'])
                    fallback['itemData'] = sm_result['item']
                    fallback['search_query'] = sm_result['item']['name']
                    fallback['match_score'] = sm_result['score']
                    fallback['match_method'] = sm_result['method']
                    fallback['needs_clarification'] = sm_result.get('needs_clarification', False)
                    fallback['alternatives'] = sm_result.get('alternatives', [])
                    print(f"🎯 FALLBACK Implicit Add: {sm_result['item']['name']} (score: {sm_result['score']:.2f})")
            
            return fallback

llm_nlu = LLMParser()
