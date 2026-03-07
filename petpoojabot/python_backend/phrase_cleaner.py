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
    "include", "remove", "delete", "cancel", "increase", "decrease",
    # Pronouns / articles / connectors
    "i", "me", "my", "we", "us", "the", "a", "an", "some", "to", "of",
    "and", "with", "also", "more", "it", "this", "that",
    # Polite / filler
    "please", "can", "could", "would", "like", "just",
    # Quantifiers (handled separately in NLU, strip from matching)
    "one", "two", "three", "four", "five",
    # Cart / ordering
    "cart", "basket", "bill", "checkout", "pay",
    # Misc common
    "do", "does", "have", "has", "is", "are", "in",
}

HINDI_FILLERS = {
    # Romanized Hindi
    "mujhe", "chahiye", "karo", "kar", "de", "do", "dena", "dedo",
    "ek", "bhi", "aur", "haan", "yeh", "woh", "lagao", "rakh",
    "mera", "meri", "mere", "humko", "hamein", "dijiye", "daal",
    "lao", "le", "lelo", "lo", "bolo",
    "hatao", "hata", "nikalo", "hata do",  # Remove action words
    # Devanagari Hindi
    "मुझे", "चाहिए", "करो", "कर", "दे", "दो", "देना", "एक",
    "भी", "और", "हाँ", "यह", "वो", "लगाओ", "रख", "मेरा",
    "मेरी", "दीजिए", "डाल", "लाओ", "ले", "लो", "बोलो",
    "हटाओ", "हटा", "निकालो", "कार्ट", "से",  # Remove action words
}

GUJARATI_FILLERS = {
    # Romanized Gujarati
    "mane", "apo", "karo", "ek", "be", "pan", "ne", "jo",
    "aavo", "chhe", "apjo", "nakhjo", "raakho", "maaro",
    "maari", "lavo", "lo",
    "kadho", "kadhi", "door",  # Remove action words
    # Gujarati script
    "મને", "આપો", "કરો", "એક", "બે", "પણ", "ને", "જો",
    "આવો", "છે", "આપજો", "નાખજો", "રાખો", "મારો",
    "મારી", "લાવો", "લો",
    "કાઢો", "કાઢી", "દૂર", "કાર્ટમાંથી",  # Remove action words
}

ALL_FILLERS = ENGLISH_FILLERS | HINDI_FILLERS | GUJARATI_FILLERS


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
