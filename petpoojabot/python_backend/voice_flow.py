"""
Voice Flow — Multi-turn conversation intent detection for the ordering pipeline.
Detects confirmation, upsell response, address, and final confirmation intents.
"""
import re
import unicodedata
from phrase_cleaner import normalize


# ── Confirmation Phrases (trigger upsell flow) ────────────────────────────
CONFIRM_PHRASES = [
    # English
    "confirm order", "place order", "complete order", "checkout",
    "order done", "finish order", "place my order", "yes confirm",
    "that's all confirm", "done ordering", "finalize order",
    "i'm done", "thats it", "that is all", "nothing else",
    "confirm my order",
    # Hindi (romanized)
    "confirm karo", "order confirm karo", "confirm kar do",
    "order kar do", "bas ho gaya", "aur nahi chahiye",
    # Hindi (Devanagari)
    "बस ऑर्डर कन्फर्म करो", "ऑर्डर कर दो", "कन्फर्म करो",
    "ऑर्डर कन्फर्म कर दो", "बस हो गया",
    "ऑर्डर कन्फर्म करो", "मेरा ऑर्डर कन्फर्म करो",
    "ऑर्डर प्लेस करो", "ऑर्डर पूरा करो", "बस ऑर्डर कर दो",
    # Gujarati
    "ઓર્ડર કન્ફર્મ કરો", "ઓર્ડર કરો", "બસ થઈ ગયું",
    "મારું ઓર્ડર કન્ફર્મ કરો", "ઓર્ડર મૂકો", "ઓર્ડર પૂરો કરો",
    "કન્ફર્મ કરો",
]

UPSELL_ACCEPT_PHRASES = [
    "yes", "sure", "ok", "okay", "yeah", "yep", "add it",
    "yes please", "go ahead", "sounds good", "why not",
    "haan", "ha", "theek hai", "daal do", "add karo",
    "हां", "हाँ", "ठीक है", "डाल दो",
    "હા", "ઠીક છે",
]

UPSELL_DECLINE_PHRASES = [
    "no", "nope", "no thanks", "skip", "that's all", "nothing else",
    "continue", "proceed", "move on", "not now", "no more",
    "nahi", "nahi chahiye", "bas", "aage badho", "mat",
    "नहीं", "नहीं चाहिए", "बस", "आगे बढ़ो",
    "ના", "નહીં", "બસ",
]

ADDRESS_CONFIRM_PHRASES = [
    "yes confirm", "correct", "right", "yes that's it", "confirm address",
    "correct location", "yes right", "confirm location", "haan sahi hai",
    "sahi hai", "theek hai", "correct hai",
    "हां सही है", "ठीक है", "सही है",
    "હા સાચું છે", "બરાબર છે",
]

ADDRESS_REJECT_PHRASES = [
    "no change", "wrong", "not correct", "change address", "galat",
    "galat hai", "nahi ye nahi", "change karo",
    "गलत", "गलत है", "बदलो",
    "ખોટું", "બદલો",
]

FINAL_CONFIRM_PHRASES = [
    "confirm final order", "place order now", "yes place order",
    "final confirm", "place it", "confirm", "yes",
    "haan place karo", "order place karo",
    "हां प्लेस करो", "ऑर्डर प्लेस करो", "कंफर्म",
    "હા પ્લેસ કરો",
]


def _normalize(text: str) -> str:
    """Lowercase + collapse spaces. Preserves Hindi/Gujarati vowel marks."""
    text = text.lower().strip()
    # Only strip accents from LATIN characters, preserve Devanagari/Gujarati matras
    nfkd = unicodedata.normalize('NFKD', text)
    result = []
    for ch in nfkd:
        if unicodedata.combining(ch):
            if result and 'LATIN' in unicodedata.name(result[-1], ''):
                continue  # Strip Latin accent
            else:
                result.append(ch)  # Keep Hindi/Gujarati matra
        else:
            result.append(ch)
    text = ''.join(result)
    text = re.sub(r'\s+', ' ', text)
    return text


def _match_phrases(text: str, phrases: list[str]) -> bool:
    """Check if text matches any phrase via sliding-window or substring."""
    norm = _normalize(text)
    norm_words = norm.split()
    for phrase in phrases:
        norm_phrase = _normalize(phrase)
        phrase_words = norm_phrase.split()
        
        # Method 1: Sliding window word match (your approach — good for exact multi-word)
        if len(phrase_words) > 0:
            for i in range(len(norm_words) - len(phrase_words) + 1):
                if norm_words[i:i+len(phrase_words)] == phrase_words:
                    return True
        
        # Method 2: Simple substring containment (catches partial matches)
        if len(norm_phrase) >= 3 and norm_phrase in norm:
            return True
    
    return False


def detect_flow_intent(text: str, current_state: str = "idle") -> dict:
    """
    Detect the conversational flow intent based on current state and user text.
    
    Args:
        text: user's speech text
        current_state: one of 'idle', 'upselling', 'addressing', 'final'
        
    Returns:
        dict with 'intent' and optional metadata
    """
    norm = _normalize(text)
    
    print(f"🔄 [VoiceFlow] State: {current_state}, Input: '{text}' → Normalized: '{norm}'")

    # State-dependent intent detection
    if current_state == "upselling":
        # Check decline FIRST to avoid false positives (e.g. "no thanks" matching "ha" in accept)
        if _match_phrases(text, UPSELL_DECLINE_PHRASES):
            return {"intent": "upsell_decline"}
        if _match_phrases(text, UPSELL_ACCEPT_PHRASES):
            return {"intent": "upsell_accept", "raw_text": text}
        # If they say something else, might be an item name to add
        return {"intent": "upsell_accept", "raw_text": text}

    if current_state == "addressing":
        if _match_phrases(text, ADDRESS_CONFIRM_PHRASES):
            return {"intent": "confirm_address"}
        if _match_phrases(text, ADDRESS_REJECT_PHRASES):
            return {"intent": "reject_address"}
        # Otherwise treat as address input
        return {"intent": "provide_address", "address_text": text}

    if current_state == "final":
        if _match_phrases(text, FINAL_CONFIRM_PHRASES):
            return {"intent": "final_confirm"}
        # Any negative → back to addressing
        if _match_phrases(text, ADDRESS_REJECT_PHRASES + UPSELL_DECLINE_PHRASES):
            return {"intent": "cancel_final"}
        return {"intent": "final_confirm"}  # Default to confirm in final state

    # idle state — check for order confirmation
    if _match_phrases(text, CONFIRM_PHRASES):
        return {"intent": "confirm_order"}

    # Not a flow intent — regular menu ordering
    return {"intent": "none"}
