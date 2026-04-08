from smart_matcher import smart_matcher
from llm_parser import llm_nlu

test_phrases = [
    "ek paneer pizza de do", 
    "rendu dosai venum without onion", 
    "peri peri fraiz add karo extra kam oil",
    "veg burgr",
    "pepci"
]

print("--- SMART MATCHER TEST ---")
for p in test_phrases:
    res = smart_matcher.match(p)
    if res:
        print(f"'{p}' -> Matched: {res['item']['name']} (Method: {res['method']}, Score: {res['score']:.2f}, Ambiguous: {res.get('needs_clarification', False)})")
    else:
        print(f"'{p}' -> NO MATCH")

print("\n--- LLM LOCAL FALLBACK TEST ---")
for p in test_phrases:
    res = llm_nlu.parse_intent(p)
    print(f"'{p}' -> Action: {res['action']}, Item: {res.get('search_query')}, Ambiguous: {res.get('needs_clarification', False)}")
