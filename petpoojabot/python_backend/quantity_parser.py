"""
Quantity Parser — Extracts numeric quantities from spoken text.
Handles English, Hindi, Gujarati numbers, and common Whisper transcription errors.
"""
import re

# ── Word-to-Number Mapping ───────────────────────────────────────────────

WORD_NUMBERS = {
    # English
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "a": 1, "an": 1, "single": 1, "double": 2, "triple": 3,
    "half": 1, "couple": 2, "dozen": 12, "pair": 2,

    # Hindi (romanized)
    "ek": 1, "do": 2, "teen": 3, "chaar": 4, "paanch": 5,
    "che": 6, "saat": 7, "aath": 8, "nau": 9, "das": 10,
    "char": 4, "panch": 5, "chhah": 6, "aat": 8,
    "ekdam": 1, "ek piece": 1,

    # Hindi (Devanagari)
    "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5,
    "छह": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,

    # Gujarati (romanized)
    "be": 2, "tran": 3,

    # Gujarati (script)
    "એક": 1, "બે": 2, "ત્રણ": 3, "ચાર": 4, "પાંચ": 5,
    "છ": 6, "સાત": 7, "આઠ": 8, "નવ": 9, "દસ": 10,

    # Gujarati digit characters
    "૧": 1, "૨": 2, "૩": 3, "૪": 4, "૫": 5,
    "૬": 6, "૭": 7, "૮": 8, "૯": 9, "૧૦": 10,
}

# ── Common Whisper Transcription Errors ──────────────────────────────────
WHISPER_NUMBER_FIXES = {
    "to": 2, "too": 2, "tu": 2,
    "for": 4, "fore": 4,
    "won": 1, "wun": 1,
    "tree": 3, "free": 3,
    "ate": 8,
    "sicks": 6, "sex": 6,
    "fife": 5,
    "nein": 9,
}


def parse_quantity(text: str) -> int:
    """
    Extract a quantity number from spoken text.
    
    Priority:
        1. Explicit digit in the text (e.g., "add 2 burgers")
        2. Word number in the text (e.g., "add two burgers")
        3. Whisper correction (e.g., "add to burgers" → 2)
        4. Default to 1
    
    Args:
        text: raw speech transcription
        
    Returns:
        Integer quantity (minimum 1, maximum 99)
    """
    text_lower = text.lower().strip()
    
    # 1. Look for explicit digits first
    digit_match = re.search(r'\b(\d{1,2})\b', text_lower)
    if digit_match:
        qty = int(digit_match.group(1))
        if 1 <= qty <= 99:
            print(f"🔢 [QuantityParser] Digit found: {qty} in '{text}'")
            return qty
    
    # 2. Split into tokens and check word numbers
    tokens = text_lower.split()
    for token in tokens:
        if token in WORD_NUMBERS:
            qty = WORD_NUMBERS[token]
            print(f"🔢 [QuantityParser] Word number '{token}' → {qty} in '{text}'")
            return qty
    
    # 3. Check for Whisper transcription errors
    for token in tokens:
        if token in WHISPER_NUMBER_FIXES:
            qty = WHISPER_NUMBER_FIXES[token]
            print(f"🔢 [QuantityParser] Whisper fix '{token}' → {qty} in '{text}'")
            return qty
    
    # 4. Check multi-word phrases (e.g., "ek piece")
    for phrase, num in WORD_NUMBERS.items():
        if ' ' in phrase and phrase in text_lower:
            print(f"🔢 [QuantityParser] Phrase match '{phrase}' → {num} in '{text}'")
            return num
    
    # 5. Default
    print(f"🔢 [QuantityParser] No quantity found, defaulting to 1 for '{text}'")
    return 1


def strip_quantity_words(text: str) -> str:
    """
    Remove quantity words from text so the remaining text can be matched to a menu item.
    e.g., "add 2 veg burgers" → "add veg burgers"
         "do peri fries add karo" → "peri fries add karo"
    """
    text_lower = text.lower().strip()
    
    # Remove digits
    text_lower = re.sub(r'\b\d{1,2}\b', '', text_lower)
    
    # Remove known number words (but not words that could also be food items)
    # Be careful: "do" is Hindi for 2 but also English "do"
    safe_number_words = set(WORD_NUMBERS.keys()) - {"a", "an", "do", "be"}
    safe_number_words.update(WHISPER_NUMBER_FIXES.keys())
    # Remove "to" only at the beginning
    safe_number_words -= {"to", "too", "for"}
    
    tokens = text_lower.split()
    cleaned = [t for t in tokens if t not in safe_number_words]
    
    result = ' '.join(cleaned).strip()
    result = re.sub(r'\s+', ' ', result)
    
    return result if result else text_lower
