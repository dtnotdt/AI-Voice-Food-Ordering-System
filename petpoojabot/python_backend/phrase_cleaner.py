"""
Phrase Cleaner — strips filler words from user speech to isolate food item names.
Supports English, Hindi (Devanagari + romanized), and Gujarati filler words.
"""
import re
import unicodedata


# ── Filler words that carry no food-identification value ───────────────────

ENGLISH_FILLERS = {
    # Intent / action
    "add", "order", "give", "get", "want", "put", "make", "place",
    "include", "remove", "delete", "cancel", "increase", "decrease", "change",
    # Pronouns / articles / connectors
    "i", "me", "my", "we", "us", "the", "a", "an", "some", "to", "of",
    "and", "with", "without", "also", "more", "less", "extra", "no", "only", "it", "this", "that", "same",
    # Polite / filler
    "please", "can", "could", "would", "like", "just", "for", "is", "are", "do", "have", "has", "in",
    # Modifiers
    "spicy", "sweet", "cold", "hot", "crispy", "jain", "half", "full", "medium",
    # Cart / ordering
    "cart", "basket", "bill", "checkout", "pay", "done", "confirm",
    # Quantifiers
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
}

HINDI_FILLERS = {
    "mujhe", "chahiye", "karo", "kar", "de", "do", "dena", "dedo",
    "ek", "do", "teen", "char", "paanch",
    "bhi", "aur", "haan", "yeh", "woh", "lagao", "rakh",
    "mera", "meri", "mere", "humko", "hamein", "dijiye", "daal",
    "lao", "le", "lelo", "lo", "bolo", "bina", "mat", "nahi",
    "hatao", "hata", "nikalo", "hata do",
    "zyada", "kam", "extra", "thikha", "spicy",
    # Devanagari Hindi
    "मुझे", "चाहिए", "करो", "कर", "दे", "दो", "देना", "एक",
    "भी", "और", "हाँ", "यह", "वो", "लगाओ", "रख", "मेरा",
    "मेरी", "दीजिए", "डाल", "लाओ", "ले", "लो", "बोलो", "बिना", "मत", "नहीं",
    "हटाओ", "हटा", "निकालो", "कार्ट", "से", "ज़्यादा", "कम", "तीखा"
}

GUJARATI_FILLERS = {
    "mane", "apo", "karo", "ek", "be", "tran", "char", "panch",
    "pan", "ne", "jo", "aavo", "chhe", "apjo", "nakhjo", "raakho", "maaro",
    "maari", "lavo", "lo", "vagarna", "vagar", "nathi",
    "kadho", "kadhi", "door", "vadhare", "ochhu",
    # Gujarati script
    "મને", "આપો", "કરો", "એક", "બે", "ત્રણ", "ચાર", "પાંચ", "પણ", "ને", "જો",
    "આવો", "છે", "આપજો", "નાખજો", "રાખો", "મારો",
    "મારી", "લાવો", "લો", "વગરના", "વગર", "નથી",
    "કાઢો", "કાઢી", "દૂર", "કાર્ટમાંથી", "વધારે", "ઓછું"
}

MARATHI_FILLERS = {
    "mala", "pahije", "dya", "de", "kara", "ghya", "ani", "ek", "don", "teen",
    "nako", "kadhun", "taka", "jast", "kami", "shiwai",
    "मला", "पाहिजे", "द्या", "दे", "करा", "घ्या", "आणि", "एक", "दोन", "तीन",
    "नको", "काढून", "टाका", "जास्त", "कमी", "शिवाय"
}

TAMIL_FILLERS = {
    "ennakku", "venum", "kudu", "vei", "podu", "onnu", "rendu", "moonu",
    "illai", "venda", "remove", "eduthiru", "adhigam", "kuraiva", "mattum",
    "எனக்கு", "வேணும்", "குடு", "வெய்", "போடு", "ஒன்னு", "ரெண்டு", "மூனு",
    "இல்லை", "வேண்டாம்", "எடுத்துரு", "அதிகம்", "குறைவா", "மட்டும்"
}

MALAYALAM_FILLERS = {
    "enikku", "venam", "tharu", "onnu", "randu", "moonnu",
    "venda", "maattu", "ozhivaakku", "kooduthal", "kuravu",
    "എനിക്ക്", "വേണം", "തരൂ", "ഒന്ന്", "രണ്ട്", "മൂന്ന്",
    "വേണ്ട", "മാറ്റൂ", "ഒഴിവാക്കൂ", "കൂടുതൽ", "കുറവ്"
}

ARABIC_FILLERS = {
    "uridu", "aetini", "wahid", "ithnan", "thalatha", "bedoon", "min", "fadlik", "bila",
    "lakin", "wa", "aw", "zid", "naqis", "izala", "ilgha",
    "اريد", "اعطني", "واحد", "اثنان", "ثلاثة", "بدون", "من", "فضلك", "بلا",
    "لكن", "و", "او", "زد", "نقص", "ازالة", "الغاء"
}

ALL_FILLERS = (ENGLISH_FILLERS | HINDI_FILLERS | GUJARATI_FILLERS |
               MARATHI_FILLERS | TAMIL_FILLERS | MALAYALAM_FILLERS | ARABIC_FILLERS)

def normalize(text: str) -> str:
    """Lowercase, strip, collapse whitespace. Preserves Hindi/Gujarati vowel marks."""
    text = text.lower().strip()
    # Only strip accents from LATIN characters (diacritics on a-z)
    # Hindi matras (ा ि ी) and Gujarati matras (ા િ ી) are combining chars
    # and MUST be preserved
    nfkd = unicodedata.normalize('NFKD', text)
    result = []
    for ch in nfkd:
        if unicodedata.combining(ch):
            # Check if the previous non-combining char was Latin
            # If so, strip this combining mark (accent). Otherwise keep it.
            if result and 'LATIN' in unicodedata.name(result[-1], ''):
                continue  # Strip Latin accent (e.g., é → e)
            else:
                result.append(ch)  # Keep Devanagari/Gujarati matra
        else:
            result.append(ch)
    text = ''.join(result)
    text = re.sub(r'\s+', ' ', text)
    return text


def clean(text: str) -> str:
    """
    Remove filler words from the input text to isolate food item references.
    
    Steps:
        1. Normalize (lowercase, strip accents, collapse spaces)
        2. Remove filler words (whole-word boundary aware)
        3. Collapse remaining whitespace
        
    Returns:
        Cleaned text with only food-relevant words remaining.
    """
    text = normalize(text)

    # Split into tokens, check each against filler set
    tokens = text.split()
    cleaned_tokens = [t for t in tokens if t not in ALL_FILLERS]

    result = ' '.join(cleaned_tokens).strip()

    # If we stripped everything, return normalized original (safety fallback)
    if not result:
        return text

    return result
