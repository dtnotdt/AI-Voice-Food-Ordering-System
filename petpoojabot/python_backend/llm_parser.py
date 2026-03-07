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
        You are a highly accurate restaurant ordering AI assistant. 
        Your task is to parse a user's transcript (translated to English if necessary) into a strict JSON command structure.
        
        SUPPORTED INTENTS:
        - add_to_cart: User wants to order food. (e.g. "Add two burgers")
        - remove_item: User wants to remove food from the order. (e.g. "Remove coke")
        - modify_quantity: User wants to change the amount of an item. (e.g. "Make the pizza 3 instead of 2")
        - menu_query: User is asking about what's available. (e.g. "What drinks do you have?")
        - order_checkout: User wants to checkout/pay. (e.g. "Place the order")
        - cancel_order: User wants to cancel everything.
        - set_address: User is providing a delivery address. (e.g. "Deliver it to PG Sector 14")
        - unknown: Cannot understand intent.
        
        RULES:
        1. Always extract the item 'name', 'quantity' (integer), and 'instructions' (e.g. "extra onions", "less spicy") if the intent involves adding, modifying, or removing items.
        2. If the user refers to an item by its number (e.g. "item number 5"), extract "item #5" as the name.
        3. Do not invent intents outside of the list.
        4. Provide the result strictly matching the provided JSON schema.
        5. If the intent is set_address, store the full address string in the 'address' field.
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
            "category": None
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
                    print(f"🎯 LOCAL Add Resolved: {sm_result['item']['name']} (qty: {legacy_intent['quantity']}, score: {sm_result['score']:.2f})")
            elif is_checkout:
                legacy_intent["action"] = "checkout"
            else:
                # Default: try to match as an add (user might just say the item name)
                sm_result = smart_matcher.match(text)
                if sm_result and sm_result['score'] >= 0.6:
                    legacy_intent["action"] = "add"
                    legacy_intent["quantity"] = parse_quantity(text)
                    legacy_intent['item_id'] = int(sm_result['item']['id'])
                    legacy_intent['itemData'] = sm_result['item']
                    legacy_intent['search_query'] = sm_result['item']['name']
                    legacy_intent['match_score'] = sm_result['score']
                    legacy_intent['match_method'] = sm_result['method']
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
                "category": None
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
                    print(f"🎯 LLM SmartMatch Resolved: {sm_result['item']['name']} (ID: {legacy_intent['item_id']}, score: {sm_result['score']:.2f})")
                    
            return legacy_intent
            
        except Exception as e:
            print(f"❌ LLM Parsing Error: {e}")
            print("📝 Falling back to local multilingual regex parser...")
            # Use the same local fallback as when no API key is set
            t = text.lower()
            original_text = text
            
            remove_keywords_en = ["remove", "cancel", "delete"]
            remove_keywords_hi = ["हटाओ", "हटा", "निकालो", "कार्ट से हटाओ", "हटा दो"]
            remove_keywords_hi_roman = ["hatao", "hata", "nikalo", "cart se hatao", "hata do"]
            remove_keywords_gu = ["કાઢો", "કાઢી", "કાર્ટમાંથી કાઢો", "દૂર કરો"]
            remove_keywords_gu_roman = ["kadho", "kadhi", "door karo"]
            
            is_remove = any(k in t for k in remove_keywords_en + remove_keywords_hi_roman + remove_keywords_gu_roman)
            if not is_remove:
                is_remove = any(k in original_text for k in remove_keywords_hi + remove_keywords_gu)
            
            add_keywords_en = ["add", "want", "give me", "order", "get"]
            add_keywords_hi = ["चाहिए", "दो", "दे", "डालो", "लगाओ", "ऐड"]
            add_keywords_hi_roman = ["chahiye", "daal do", "de do", "dena", "lagao", "add karo", "daal", "dal do"]
            add_keywords_gu = ["આપો", "ઉમેરો", "નાખો", "જોઈએ"]
            add_keywords_gu_roman = ["aapo", "umero", "nakho", "joie"]
            
            is_add = any(k in t for k in add_keywords_en + add_keywords_hi_roman + add_keywords_gu_roman)
            if not is_add:
                is_add = any(k in original_text for k in add_keywords_hi + add_keywords_gu)
            
            checkout_keywords = ["checkout", "pay", "confirm order", "place order"]
            is_checkout = any(k in t for k in checkout_keywords)
            
            from smart_matcher import smart_matcher
            from quantity_parser import parse_quantity
            
            fallback = {
                "action": "unknown", "quantity": 1, "item_id": None,
                "itemData": None, "search_query": text, "instructions": None, "category": None
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
                    print(f"🎯 FALLBACK Add: {sm_result['item']['name']} (qty: {fallback['quantity']}, score: {sm_result['score']:.2f})")
            elif is_checkout:
                fallback["action"] = "checkout"
            else:
                sm_result = smart_matcher.match(text)
                if sm_result and sm_result['score'] >= 0.6:
                    fallback["action"] = "add"
                    fallback["quantity"] = parse_quantity(text)
                    fallback['item_id'] = int(sm_result['item']['id'])
                    fallback['itemData'] = sm_result['item']
                    fallback['search_query'] = sm_result['item']['name']
                    fallback['match_score'] = sm_result['score']
                    fallback['match_method'] = sm_result['method']
                    print(f"🎯 FALLBACK Implicit Add: {sm_result['item']['name']} (score: {sm_result['score']:.2f})")
            
            return fallback

llm_nlu = LLMParser()
