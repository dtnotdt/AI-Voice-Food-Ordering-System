"""
Test suite for the Smart Matching system.
Validates alias generation, phrase cleaning, and 3-tier matching accuracy.
"""
import sys
import os

# Ensure we can import from the same directory
sys.path.insert(0, os.path.dirname(__file__))

from phrase_cleaner import clean
from smart_matcher import smart_matcher

PASS = 0
FAIL = 0

def test(input_text: str, expected_name: str, category: str):
    global PASS, FAIL
    result = smart_matcher.match(input_text)
    
    if result is None:
        matched = "(no match)"
        score = 0
        method = "none"
    else:
        matched = result['item']['name']
        score = result['score']
        method = result['method']
    
    ok = matched == expected_name
    status = "✅ PASS" if ok else "❌ FAIL"
    
    if ok:
        PASS += 1
    else:
        FAIL += 1
    
    print(f"  {status} | [{category}] \"{input_text}\" → \"{matched}\" (expected: \"{expected_name}\") [score: {score:.2f}, method: {method}]")
    return ok


def test_cleaner(input_text: str, expected: str):
    global PASS, FAIL
    result = clean(input_text)
    ok = result == expected
    status = "✅ PASS" if ok else "❌ FAIL"
    if ok:
        PASS += 1
    else:
        FAIL += 1
    print(f"  {status} | clean(\"{input_text}\") → \"{result}\" (expected: \"{expected}\")")


if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("  PHRASE CLEANER TESTS")
    print("=" * 70 + "\n")
    
    test_cleaner("add peri peri fries", "peri peri fries")
    test_cleaner("mujhe cold coffee chahiye", "cold coffee")
    test_cleaner("can I get a veg burger", "veg burger")
    test_cleaner("give me one coke please", "coke")
    test_cleaner("peri fries add karo", "peri fries")
    test_cleaner("मुझे वेज बर्गर दे दो", "वेज बरगर")
    test_cleaner("મને પેરી પેરી ફ્રાઈઝ આપો", "પેરી પેરી ફરાઈઝ")
    test_cleaner("order two paneer pizza", "paneer pizza")
    
    print("\n" + "=" * 70)
    print("  SMART MATCHER TESTS")
    print("=" * 70)
    
    print("\n── Case Insensitivity ──")
    test("VEG BURGER", "Veg Burger", "case")
    test("veg burger", "Veg Burger", "case")
    test("Veg Burger", "Veg Burger", "case")
    test("COLD COFFEE", "Cold Coffee", "case")
    
    print("\n── Filler Word Removal ──")
    test("add peri peri fries", "Peri Peri Fries", "filler")
    test("mujhe cold coffee chahiye", "Cold Coffee", "filler")
    test("can I get a veg burger", "Veg Burger", "filler")
    test("give me one coke please", "Coke", "filler")
    test("peri fries add karo", "Peri Peri Fries", "filler")
    
    print("\n── Shortened Names ──")
    test("peri fries", "Peri Peri Fries", "short")
    test("combo 1", "Combo 1: Veg Burger + Fries + Coke", "short")
    test("combo two", "Combo 2: Paneer Pizza + Garlic Bread + Pepsi", "short")
    
    print("\n── Whisper Errors / Typos ──")
    test("veg burgr", "Veg Burger", "whisper")
    test("cold cofee", "Cold Coffee", "whisper")
    test("garlic bred", "Garlic Bread", "whisper")
    test("paneer piza", "Paneer Pizza", "whisper")
    test("peri peri fraiz", "Peri Peri Fries", "whisper")
    test("ice tea", "Iced Tea", "whisper")
    test("pepci", "Pepsi", "whisper")
    
    print("\n── Hindi Transliteration ──")
    test("वेज बर्गर", "Veg Burger", "hindi")
    test("पनीर पिज़्ज़ा", "Paneer Pizza", "hindi")
    test("पेरी पेरी फ्राइज", "Peri Peri Fries", "hindi")
    test("कोल्ड कॉफी", "Cold Coffee", "hindi")
    test("गार्लिक ब्रेड", "Garlic Bread", "hindi")
    
    print("\n── Gujarati Transliteration ──")
    test("વેજ બર્ગર", "Veg Burger", "gujarati")
    test("પેરી પેરી ફ્રાઈઝ", "Peri Peri Fries", "gujarati")
    test("કોલ્ડ કોફી", "Cold Coffee", "gujarati")
    
    print("\n── Hindi Sentence (fillers + transliteration) ──")
    test("मुझे वेज बर्गर दे दो", "Veg Burger", "hindi_sentence")
    test("वेज बर्गर ऐड करो", "Veg Burger", "hindi_sentence")
    
    print("\n── Gujarati Sentence (fillers + transliteration) ──")
    test("મને વેજ બર્ગર આપો", "Veg Burger", "gujarati_sentence")
    
    print("\n── Romanized Hindi ──")
    test("veg burger add karo", "Veg Burger", "romanized")
    test("ek cold coffee dena", "Cold Coffee", "romanized")
    
    print("\n" + "=" * 70)
    print(f"  RESULTS: {PASS} passed, {FAIL} failed out of {PASS + FAIL} total")
    print("=" * 70 + "\n")
