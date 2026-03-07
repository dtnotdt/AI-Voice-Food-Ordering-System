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
            # Also try the normalized-but-uncleaned version 
            # (in case filler removal was too aggressive)
            result = self._try_exact(normalized_input)
        if result:
            result['cleaned_input'] = cleaned
            result['raw_input'] = raw_input
            return result
        
        # Step 3: Fuzzy matching
        result = self._try_fuzzy(cleaned)
        if not result:
            result = self._try_fuzzy(normalized_input)
        if result:
            result['cleaned_input'] = cleaned
            result['raw_input'] = raw_input
            return result
        
        # Step 4: FAISS semantic fallback
        result = self._try_semantic(cleaned)
        if not result:
            result = self._try_semantic(normalized_input)
        if result:
            result['cleaned_input'] = cleaned
            result['raw_input'] = raw_input
            return result
        
        print(f"❌ [SmartMatcher] No match found for: '{raw_input}'")
        return None

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

    def _try_fuzzy(self, text: str, threshold: float = 0.70) -> dict | None:
        """Fuzzy match against all aliases using SequenceMatcher."""
        best_score = 0.0
        best_alias = None
        
        for alias in self.all_aliases:
            ratio = difflib.SequenceMatcher(None, text, alias).ratio()
            if ratio > best_score:
                best_score = ratio
                best_alias = alias
        
        if best_score >= threshold and best_alias:
            item = self.reverse_lookup[best_alias]
            print(f"✅ [SmartMatcher] FUZZY match: '{text}' ≈ '{best_alias}' → '{item['name']}' (score: {best_score:.2f})")
            return {
                'item': item,
                'score': best_score,
                'method': 'fuzzy',
                'distance': 1.0 - best_score,
            }
        return None

    def _try_semantic(self, text: str, max_distance: float = 1.2) -> dict | None:
        """FAISS semantic embedding search (existing infrastructure)."""
        result = faiss_matcher.match(text, top_k=1)
        if result and result['distance'] < max_distance:
            score = max(0.0, 1.0 - (result['distance'] / 2.0))
            item = result['item']
            print(f"✅ [SmartMatcher] SEMANTIC match: '{text}' → '{item['name']}' (dist: {result['distance']:.4f}, score: {score:.2f})")
            return {
                'item': item,
                'score': score,
                'method': 'semantic',
                'distance': result['distance'],
            }
        return None


# Module-level singleton
smart_matcher = SmartMatcher()
