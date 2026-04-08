"""
Smart Matcher — Unified 3-tier menu item matching engine.

Combines exact alias lookup, fuzzy string matching, and FAISS semantic search
to reliably identify menu items from noisy voice input.
"""
import difflib
from phrase_cleaner import clean as clean_phrase, normalize
from alias_generator import generate_aliases, build_reverse_lookup
from faiss_matcher import matcher as faiss_matcher


class SmartMatcher:
    def __init__(self):
        # Use the FAISS matcher's already-loaded menu items
        menu_items = faiss_matcher.menu_items
        
        # Generate aliases and build reverse lookup
        self.alias_map = generate_aliases(menu_items)
        self.reverse_lookup = build_reverse_lookup(self.alias_map, menu_items)
        
        # Build flat list of all alias strings for fuzzy matching
        self.all_aliases = list(self.reverse_lookup.keys())
        
        total_aliases = sum(len(v) for v in self.alias_map.values())
        print(f"🧠 Smart Matcher initialized: {len(menu_items)} items, {total_aliases} aliases indexed.")

    def match(self, raw_text: str, top_k: int = 1) -> dict | None:
        """
        Match user input to a menu item using 3-tier strategy.
        
        Pipeline:
            1. Clean filler words from input
            2. Try exact alias lookup (O(1))
            3. Try fuzzy string matching (best ratio ≥ 0.70)
            4. Fall back to FAISS semantic search
            
        Args:
            raw_text: raw user speech text (may contain fillers, wrong case, etc.)
            top_k: number of results for FAISS fallback (only top-1 used for scoring)
            
        Returns:
            dict with keys: item (menu item dict), score (0-1), method (str), 
            cleaned_input (str), raw_input (str)
            Returns None if no match found above thresholds.
        """
        raw_input = raw_text
        
        # Step 1: Clean filler words
        cleaned = clean_phrase(raw_text)
        normalized_input = normalize(raw_text)
        
        print(f"📝 [SmartMatcher] Raw: '{raw_input}'")
        print(f"📝 [SmartMatcher] Cleaned: '{cleaned}'")
        
        # Step 2: Exact alias lookup
        result = self._try_exact(cleaned)
        if not result:
            result = self._try_exact(normalized_input)
        if result:
            result['cleaned_input'] = cleaned
            result['raw_input'] = raw_input
            result['needs_clarification'] = False
            return result
        
        # Step 3: Fuzzy matching
        results = self._try_fuzzy(cleaned)
        if not results:
            results = self._try_fuzzy(normalized_input)
        if results:
            return self._evaluate_ambiguity(results, raw_input, cleaned)
        
        # Step 4: FAISS semantic fallback
        results = self._try_semantic(cleaned)
        if not results:
            results = self._try_semantic(normalized_input)
        if results:
            return self._evaluate_ambiguity(results, raw_input, cleaned)
        
        print(f"❌ [SmartMatcher] No match found for: '{raw_input}'")
        return None

    def _evaluate_ambiguity(self, results: list, raw_text: str, cleaned: str) -> dict:
        if len(results) == 1 or results[0]['score'] > 0.95:
            res = results[0]
            res['cleaned_input'] = cleaned
            res['raw_input'] = raw_text
            res['needs_clarification'] = False
            return res
            
        margin = results[0]['score'] - results[1]['score']
        res = results[0]
        res['cleaned_input'] = cleaned
        res['raw_input'] = raw_text
        
        if margin < 0.10 and results[0]['item']['id'] != results[1]['item']['id']:
            print(f"⚠️ [SmartMatcher] AMBIGUITY DETECTED: ({res['score']:.2f}) {results[0]['item']['name']} vs ({results[1]['score']:.2f}) {results[1]['item']['name']}")
            res['needs_clarification'] = True
            res['alternatives'] = [results[1]['item']]
        else:
            res['needs_clarification'] = False
            
        return res

    def _try_exact(self, text: str) -> dict | None:
        """O(1) lookup against alias dictionary."""
        item = self.reverse_lookup.get(text)
        if item:
            print(f"✅ [SmartMatcher] EXACT alias match: '{text}' → '{item['name']}' (score: 1.00)")
            return {
                'item': item,
                'score': 1.0,
                'method': 'exact_alias',
                'distance': 0.0,
            }
        return None

    def _try_fuzzy(self, text: str, threshold: float = 0.70) -> list | None:
        """Fuzzy match against all aliases using SequenceMatcher."""
        matches = []
        for alias in self.all_aliases:
            ratio = difflib.SequenceMatcher(None, text, alias).ratio()
            if ratio >= threshold:
                matches.append((ratio, alias))
        
        if not matches:
            return None
            
        matches.sort(key=lambda x: x[0], reverse=True)
        
        results = []
        seen_ids = set()
        for m in matches:
            item = self.reverse_lookup[m[1]]
            if item['id'] not in seen_ids:
                seen_ids.add(item['id'])
                results.append({
                    'item': item,
                    'score': m[0],
                    'method': 'fuzzy',
                    'distance': 1.0 - m[0],
                    'alias_matched': m[1]
                })
            if len(results) >= 2:
                break
                
        if results:
            print(f"✅ [SmartMatcher] FUZZY match: '{text}' ≈ '{results[0]['alias_matched']}' → '{results[0]['item']['name']}' (score: {results[0]['score']:.2f})")
            return results
        return None

    def _try_semantic(self, text: str, max_distance: float = 1.2) -> list | None:
        """FAISS semantic embedding search (existing infrastructure)."""
        faiss_results = faiss_matcher.match(text, top_k=2)
        if not faiss_results: return None
        
        # Force it into a list if top_k=1 was accidentally used
        if isinstance(faiss_results, dict):
            faiss_results = [faiss_results]
            
        valid_results = []
        for r in faiss_results:
            if r['distance'] < max_distance:
                score = max(0.0, 1.0 - (r['distance'] / 2.0))
                valid_results.append({
                    'item': r['item'],
                    'score': score,
                    'method': 'semantic',
                    'distance': r['distance']
                })
                
        if valid_results:
            print(f"✅ [SmartMatcher] SEMANTIC match: '{text}' → '{valid_results[0]['item']['name']}' (dist: {valid_results[0]['distance']:.4f}, score: {valid_results[0]['score']:.2f})")
            return valid_results
        return None


# Module-level singleton
smart_matcher = SmartMatcher()
