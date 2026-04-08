"""
Automatic Alias Generator for Menu Items.
Generates pronunciation variants, Hindi/Gujarati transliterations,
Whisper error patterns, and shortened forms for every menu item.
"""
import re
import unicodedata


# ── Hindi & Gujarati transliterations for all 15 real menu items ────────────
# These are hand-crafted for accuracy; programmatic transliteration would be unreliable.
TRANSLITERATION_MAP = {
    "Veg Burger": {
        "hi": ["वेज बर्गर", "वेज बर्गेर", "वेज़ बर्गर"],
        "gu": ["વેજ બર્ગર", "વેજ બર્ગેર"],
    },
    "Paneer Pizza": {
        "hi": ["पनीर पिज़्ज़ा", "पनीर पिज्जा", "पनीर पीज़ा"],
        "gu": ["પનીર પિઝા", "પનીર પિઝ્ઝા"],
    },
    "Peri Peri Fries": {
        "hi": ["पेरी पेरी फ्राइज", "पेरी पेरी फ्राइज़", "पेरी फ्राइज"],
        "gu": ["પેરી પેરી ફ્રાઈઝ", "પેરી ફ્રાઈઝ"],
    },
    "Fries": {
        "hi": ["फ्राइज", "फ्राइज़", "फ्रेंच फ्राइज"],
        "gu": ["ફ્રાઈઝ", "ફ્રેન્ચ ફ્રાઈઝ"],
    },
    "Coke": {
        "hi": ["कोक", "कोका कोला", "कॉक"],
        "gu": ["કોક", "કોકા કોલા"],
    },
    "Garlic Bread": {
        "hi": ["गार्लिक ब्रेड", "गार्लिक ब्रैड", "लहसुन ब्रेड"],
        "gu": ["ગાર્લિક બ્રેડ", "લસણ બ્રેડ"],
    },
    "Pepsi": {
        "hi": ["पेप्सी", "पेप्सि"],
        "gu": ["પેપ્સી", "પેપ્સિ"],
    },
    "Cold Coffee": {
        "hi": ["कोल्ड कॉफी", "कोल्ड कॉफ़ी", "ठंडी कॉफी", "ठंडी कॉफ़ी"],
        "gu": ["કોલ્ડ કોફી", "ઠંડી કોફી"],
    },
    "Veg Wrap": {
        "hi": ["वेज रैप", "वेज व्रैप", "वेज़ रैप"],
        "gu": ["વેજ રેપ", "વેજ વ્રેપ"],
    },
    "Iced Tea": {
        "hi": ["आइस्ड टी", "आइस टी", "ठंडी चाय"],
        "gu": ["આઈસ્ડ ટી", "આઈસ ટી", "ઠંડી ચા"],
    },
    # ── Indian Menu Items (critical for the bot to work) ──────────────────
    "Misal Pav": {
        "hi": ["मिसल पाव", "मिसळ पाव", "मिसाल पाव", "मिसल पव", "मिसाल पव"],
        "gu": ["મિસળ પાવ", "મિસળ પવ", "મિસળ", "મિસ઼ળ"],
        "mr": ["मिसळ पाव", "मिसळ"],
    },
    "Vada Pav": {
        "hi": ["वड़ा पाव", "वड़ापाव", "वडा पाव", "बटाटा वड़ा"],
        "gu": ["વડા પાઉં", "વડા પાવ", "વડા", "વળ"],
        "mr": ["वडा पाव", "वडापाव"],
    },
    "Pav Bhaji": {
        "hi": ["पाव भाजी", "पाव भाजि", "पाव भाज़ी"],
        "gu": ["પાઉં ભાજી", "પવ ભાજી", "પાઉ ભાજી"],
        "mr": ["पाव भाजी"],
    },
    "Masala Fries": {
        "hi": ["मसाला फ्राइज", "मसाला फ्रेंच फ्राइज", "मसाले वाले फ्राइज"],
        "gu": ["મસાલા ફ્રાઈઝ", "મસાલા ફ્રાઈ"],
    },
    "Samosa": {
        "hi": ["समोसा", "समोसे"],
        "gu": ["સમોસા", "સમોસો"],
    },
    "Dosa": {
        "hi": ["डोसा", "दोसा"],
        "gu": ["ઢોસા", "ઢોશા"],
        "ta": ["தோசை", "டோசை"],
    },
    "Idli": {
        "hi": ["इडली", "इडली"],
        "ta": ["இட்லி"],
        "ml": ["ഇഡ്ലി"],
    },
    "Chai": {
        "hi": ["चाय", "चाई", "चहा"],
        "gu": ["ચા", "ચ"],
        "mr": ["चहा"],
    },
    "Lassi": {
        "hi": ["लस्सी", "लसी"],
        "gu": ["લસ્સી", "છાસ"],
    },
    "Biryani": {
        "hi": ["बिरयानी", "बिरयानि", "बिर्यानी"],
        "gu": ["બિરયાની", "બિરિયાની"],
        "ta": ["பிரியாணி"],
        "ar": ["برياني", "بريانى"],
    },
    "Paneer Tikka": {
        "hi": ["पनीर टिक्का", "पनीर टिक्का"],
        "gu": ["પનીર ટિક્કા", "પનીર ટીકા"],
    },
    "Butter Chicken": {
        "hi": ["बटर चिकन", "मक्खन मुर्ग", "बट्टर चिकन"],
        "gu": ["બટર ચિકન"],
    },
    "Shawarma": {
        "hi": ["शावरमा", "शावर्मा"],
        "ar": ["شاورما", "شاورمة"],
    },
    "Naan": {
        "hi": ["नान", "नाँ"],
        "gu": ["નાન"],
    },
    "Roti": {
        "hi": ["रोटी", "चपाती", "फुल्का"],
        "gu": ["રોટી", "ચપાટી"],
        "mr": ["पोळी"],
    },
}

# ── Whisper error patterns & phonetic variants per item ────────────────────
# Map of canonical name → list of common Whisper mistakes and phonetic spellings
WHISPER_VARIANTS = {
    "Veg Burger": [
        "veg burgr", "veg burgar", "veg berger", "veg buger", "veg burgerr",
        "veg borgr", "vegburger", "veg burger", "vej burger", "veg brgr",
        "veggie burger", "veg burge", "vege burger", "vage burger", 
        "veg bugar", "wage burger", "vez burger"
    ],
    "Paneer Pizza": [
        "paneer piza", "paneer pizaa", "paner pizza", "paner piza",
        "panir pizza", "paneer pizzaa", "pneer pizza", "paneer pissa",
        "paneer peeza", "panir piza", "panner pizza", "pnir pizza",
        "panneer pizza", "panneer piza", "pannir pizza"
    ],
    "Peri Peri Fries": [
        "peri fries", "peri fry", "peri peri fry", "perri perri fries",
        "peri peri french fries", "peri peri fraiz", "peri peri frise",
        "peri potato fries", "peri peri frays", "peri peri frye",
        "perry perry fries", "peri peri fris", "pp fries", "periperi fries",
        "peri peri freis", "perri fries", "piri piri fries", "piri fries"
    ],
    "Fries": [
        "fry", "french fries", "freis", "friez", "friess", "fraiz",
        "frise", "fryes", "french fry", "fraz", "aloo fries", "potato fries",
        "frais", "frys"
    ],
    "Coke": [
        "coca cola", "coca-cola", "cocacola", "kok", "cok", "coek",
        "koke", "coak", "cock", "coka", "coco cola", "cola"
    ],
    "Garlic Bread": [
        "garlic bred", "garlik bread", "garlic brad", "garlick bread",
        "garlic breads", "garlic braid", "garlicbread", "garlic bre",
        "garlic breadstick", "lahsun bread", "lasun bread"
    ],
    "Pepsi": [
        "pepsie", "pepci", "pepsy", "pepzie", "pepsee", "pepsii"
    ],
    "Cold Coffee": [
        "cold cofee", "cold coffe", "cold coffie", "cold coffey",
        "cold cofie", "colld coffee", "cold cafe", "iced coffee",
        "cold koffee", "cold kofi", "cold kaffee", "thandi coffee"
    ],
    "Veg Wrap": [
        "veg rap", "veg warp", "veg raap", "veg rap", "vegwrap",
        "vej wrap", "veg wraps", "veg raps", "veggie wrap",
        "vej rap", "vez wrap"
    ],
    "Iced Tea": [
        "ice tea", "iced tee", "iced teaa", "icetea", "ice tee",
        "iced t", "iced tii", "icete", "aice tea", "thandi chai"
    ],
    # ── Indian Items ────────────────────────────
    "Misal Pav": [
        "misal pav", "misel pav", "misal paw", "missal pav", "misal paw",
        "misaal pav", "misal pa", "misalpav", "misal", "misel", "misal paav",
        "misal pa", "missal", "missal pa", "misal bhaji", "missal pav",
        "misal pbhaji", "misal pao", "misel paav", "misal paaw", "missal pa",
        "mis pav", "misal pov", "missel pav", "misal paav", "misal pao",
        # Romanized Marathi/Hindi variants
        "misal paav", "misal paaw", "mishall pav", "mishal pav"
    ],
    "Vada Pav": [
        "vada pav", "wada pav", "vada pa", "wada pa", "vada pao", "wada pao",
        "batata vada", "batata wada", "vad pav", "vadapav", "wadapav",
        "wada paw", "vada paw", "vada pa", "bata vada", "potato pav",
        "potato fritter bun", "vada pao", "wada pao"
    ],
    "Pav Bhaji": [
        "pav bhaji", "pao bhaji", "pav bhaji", "pav baji", "pao baji",
        "pav bhajee", "pav bajee", "pav bhaji", "pav bhajji",
        "pao bhajji", "pav bhaaji", "pavbhaji", "paobhaji",
        "pav bhazhi", "pav bhage"
    ],
    "Masala Fries": [
        "masala fries", "masala freis", "masala frys", "masala fry",
        "masala french fries", "masala fraiz", "masala frise",
        "masala potato fries", "masala chips", "spicy fries",
        "masala friz", "masaala fries"
    ],
    "Samosa": [
        "samosa", "samoosa", "samosaa", "samousa", "samoza", "saamosaa",
        "samose", "singleton", "singada", "singara"
    ],
    "Dosa": [
        "dosa", "dosai", "dosha", "dossa", "dose", "dhosa", "thosai",
        "tosai", "plain dosa", "masala dosa", "rava dosa"
    ],
    "Idli": [
        "idli", "idle", "idly", "idlee", "iddly", "iddli", "idlii"
    ],
    "Chai": [
        "chai", "chay", "tea", "chais", "indian tea", "masala chai", "masala tea"
    ],
    "Lassi": [
        "lassi", "lassie", "laasi", "lassee", "lasi", "lasee", 
        "mango lassi", "sweet lassi", "salted lassi"
    ],
    "Biryani": [
        "biryani", "biriyani", "biryaani", "briyani", "beriani",
        "bryani", "beryani", "biriani", "biryaani", "biryani rice"
    ],
    "Paneer Tikka": [
        "paneer tikka", "panir tikka", "paner tikka", "paneer tika",
        "paneer tikaa", "pneer tikka", "paneer teka", "paneer chilli"
    ],
    "Butter Chicken": [
        "butter chicken", "butter chiken", "butter chikin", "murgh makhani",
        "makhani chicken", "butter chicken curry", "buttr chicken",
        "butter chick"
    ],
    "Shawarma": [
        "shawarma", "shawurma", "shwarma", "shawerma", "shawrma",
        "shawarma wrap", "chicken shawarma", "veg shawarma"
    ],
    "Naan": [
        "naan", "nan", "garlic naan", "butter naan", "na", "naaan"
    ],
    "Roti": [
        "roti", "chapati", "chapati", "phulka", "fulka", "rotis",
        "whole wheat roti", "plain roti"
    ],
}

# Combo shortened forms
COMBO_ALIASES = {
    "Combo 1: Veg Burger + Fries + Coke": [
        "combo 1", "combo one", "combo number 1", "veg burger combo",
        "burger fries coke combo", "कॉम्बो 1", "કોમ્બો 1",
    ],
    "Combo 2: Paneer Pizza + Garlic Bread + Pepsi": [
        "combo 2", "combo two", "combo number 2", "paneer pizza combo",
        "pizza garlic bread combo", "कॉम्बो 2", "કોમ્બો 2",
    ],
    "Combo 3: Peri Peri Fries + Cold Coffee": [
        "combo 3", "combo three", "combo number 3", "peri fries combo",
        "fries coffee combo", "कॉम्बो 3", "કોમ્બો 3",
    ],
    "Combo 4: Veg Wrap + Iced Tea": [
        "combo 4", "combo four", "combo number 4", "wrap tea combo",
        "veg wrap combo", "कॉम्बो 4", "કોમ્બો 4",
    ],
    "Combo 5: 2 Veg Burgers + 1 Large Fries + Coke": [
        "combo 5", "combo five", "combo number 5", "double burger combo",
        "2 burger combo", "कॉम्बो 5", "કોમ્બો 5",
    ],
}


def _normalize(text: str) -> str:
    """Lowercase, strip, collapse whitespace, remove accents."""
    text = text.lower().strip()
    text = unicodedata.normalize('NFKD', text)
    # Keep non-ASCII chars (Hindi/Gujarati) but remove combining marks
    text = ''.join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r'\s+', ' ', text)
    return text


def _generate_english_variants(name: str) -> list[str]:
    """Generate case, plural/singular, and whitespace variants."""
    variants = set()
    low = name.lower()
    variants.add(low)
    variants.add(low.replace(' ', ''))        # "vegburger"
    variants.add(low.replace('-', ' '))        # "peri-peri" → "peri peri"
    variants.add(low.replace(' ', '-'))        # "peri peri" → "peri-peri"

    # Plural / singular toggle
    if low.endswith('s'):
        variants.add(low[:-1])                 # "fries" → "frie"
    else:
        variants.add(low + 's')                # "fry" → "frys"

    # Remove duplicate words  "peri peri" → "peri"
    words = low.split()
    if len(words) > 1:
        deduped = []
        for w in words:
            if w not in deduped:
                deduped.append(w)
        if len(deduped) < len(words):
            variants.add(' '.join(deduped))

    return list(variants)


def generate_aliases(menu_items: list[dict]) -> dict[int, list[str]]:
    """
    Generate a comprehensive alias dictionary for each menu item.
    
    Args:
        menu_items: list of dicts from menu CSV, each having 'id' and 'name'.
        
    Returns:
        dict mapping item ID → list of normalized alias strings.
    """
    alias_map: dict[int, list[str]] = {}

    for item in menu_items:
        item_id = int(item['id'])
        name = item['name']
        aliases = set()

        # 1. English variants (case, spacing, plural)
        aliases.update(_generate_english_variants(name))

        # 2. Whisper error patterns
        if name in WHISPER_VARIANTS:
            for v in WHISPER_VARIANTS[name]:
                aliases.add(_normalize(v))

        # 3. Hindi/Gujarati transliterations
        if name in TRANSLITERATION_MAP:
            for lang_variants in TRANSLITERATION_MAP[name].values():
                for v in lang_variants:
                    aliases.add(_normalize(v))

        # 4. Combo shorthand aliases
        if name in COMBO_ALIASES:
            for v in COMBO_ALIASES[name]:
                aliases.add(_normalize(v))

        # 5. For generic "Item N ..." entries, add "item N"
        generic_match = re.match(r'^Item\s+(\d+)\s+', name)
        if generic_match:
            n = generic_match.group(1)
            aliases.add(f"item {n}")
            aliases.add(f"item number {n}")
            aliases.add(f"item no {n}")
            aliases.add(f"item #{n}")

        # Remove empty strings
        aliases.discard('')
        alias_map[item_id] = sorted(aliases)

    return alias_map


def build_reverse_lookup(alias_map: dict[int, list[str]], menu_items: list[dict]) -> dict[str, dict]:
    """
    Build a reverse lookup: normalized alias string → menu item dict.
    Used for O(1) exact matching.
    """
    item_by_id = {int(m['id']): m for m in menu_items}
    reverse = {}
    for item_id, aliases in alias_map.items():
        item = item_by_id.get(item_id)
        if not item:
            continue
        for alias in aliases:
            reverse[alias] = item
    return reverse
