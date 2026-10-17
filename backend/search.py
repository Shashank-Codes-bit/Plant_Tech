"""Matching names to a shop's products (AI results, supplier-bill lines).

Whole words, never parts of words: "Pot" is not "Pothos" and "Rose" is not "Primrose".
"""
import re

from common import name_key

# Words that say nothing about which product it is.
GENERIC = {"plant", "plants", "the", "a", "an", "of", "and", "with", "in", "inch", "inches", "cm", "mm",
           "small", "big", "large", "medium", "mini", "no", "nos", "pcs", "pc", "piece", "pieces"}


def words(text: str | None) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9ऀ-ॿ]+", (text or "").lower())
            if w not in GENERIC and not w.isdigit()}


def _score(names_words: list[set[str]], product: dict) -> float:
    """2 + overlap when one side's words all appear in the other, else the plain overlap (0..1)."""
    best = 0.0
    for pw in (words(product["name"]), words(product.get("botanical_name"))):
        if not pw:
            continue
        for qw in names_words:
            if not qw:
                continue
            overlap = len(qw & pw) / len(qw | pw)
            best = max(best, 2 + overlap if (qw <= pw or pw <= qw) else overlap)
    return best


def best_product(products: list[dict], names: list[str]) -> tuple[dict | None, list[dict]]:
    """The one product these names mean (or None), and up to 3 other close products."""
    names = [n for n in names if n and n.strip()]
    keys = {name_key(n) for n in names} - {""}
    for p in products:  # exact name or botanical name
        if name_key(p["name"]) in keys or (p.get("botanical_name") and name_key(p["botanical_name"]) in keys):
            return p, []
    names_words = [words(n) for n in names]
    scored = sorted(((s, p) for p in products if (s := _score(names_words, p)) > 0), key=lambda sp: -sp[0])
    match = None
    if scored and scored[0][0] >= 2 and (len(scored) == 1 or scored[1][0] < scored[0][0]):
        match = scored[0][1]  # all words contained, and clearly the best
    similar = [p for s, p in scored if p is not match and s >= 0.3][:3]  # e.g. one of two words shared
    return match, similar
