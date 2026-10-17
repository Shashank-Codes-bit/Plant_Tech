"""Matching names to products: what a person types in search, and what the AI or a supplier bill reads.

Search works across scripts and spellings: "गुलाब", "gulab", "gulaab" and "rose" all find Rose (Hindi is
turned into Latin letters, then both sides are reduced to a rough sound-alike form). Matching AI and bill
names uses whole words, never parts of words: "Pot" is not "Pothos" and "Rose" is not "Primrose".
"""
import re

from common import name_key

# ---- typed search ------------------------------------------------------------------------------

VOWELS = {"अ": "a", "आ": "aa", "इ": "i", "ई": "ii", "उ": "u", "ऊ": "uu", "ऋ": "ri", "ए": "e", "ऐ": "ai", "ओ": "o",
          "औ": "au", "ऑ": "o"}
SIGNS = {"ा": "aa", "ि": "i", "ी": "ii", "ु": "u", "ू": "uu", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au",
         "ॉ": "o", "ॅ": "e"}
CONSONANTS = {"क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n", "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
              "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
              "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
              "ष": "sh", "स": "s", "ह": "h", "ळ": "l"}
NUKTA = {"क": "q", "ख": "kh", "ग": "g", "ज": "z", "ड": "r", "ढ": "rh", "फ": "f"}  # क़ ज़ ड़ … (letter + ़)


def translit(text: str) -> str:
    """Devanagari to plain Latin letters (गुलाब -> gulab, तुलसी -> tulasii); other text is kept."""
    out: list[str] = []
    chars = list(text)
    i = 0
    while i < len(chars):
        c = chars[i]
        nxt = chars[i + 1] if i + 1 < len(chars) else ""
        if c in CONSONANTS:
            sound = CONSONANTS[c]
            if nxt == "़":
                sound = NUKTA.get(c, sound)
                i += 1
                nxt = chars[i + 1] if i + 1 < len(chars) else ""
            if nxt in SIGNS:
                out.append(sound + SIGNS[nxt])
                i += 2
                continue
            if nxt == "्":
                out.append(sound)
                i += 2
                continue
            # The built-in "a" is not said at the end of a word.
            end = not nxt or not ("ऀ" <= nxt <= "ॿ")
            out.append(sound if end else sound + "a")
        elif c in VOWELS:
            out.append(VOWELS[c])
        elif c in "ंँ":
            out.append("n")
        elif c == "ः":
            out.append("h")
        elif c in SIGNS or c in "़्":
            pass
        else:
            out.append(c)
        i += 1
    return "".join(out)


def phonetic(text: str) -> str:
    """A rough sound-alike form of Latin text, so different spellings meet: tulsi = tulasi, gulaab = gulab."""
    s = re.sub(r"[^a-z]", "", translit(text).lower())
    for a, b in (("ph", "f"), ("w", "v"), ("z", "j"), ("q", "k"), ("ck", "k"), ("x", "ks"), ("ee", "i"), ("oo", "u"),
                 ("y", "i")):
        s = s.replace(a, b)
    s = re.sub(r"([bcdgjklmnprstv])h", r"\1", s)  # aspirated letters: kh, gh, ch, dh, bh, sh …
    s = re.sub(r"(.)\1+", r"\1", s)  # aa -> a, ii -> i, doubled consonants
    s = re.sub(r"(?<=[^aeiou])a(?=[^aeiou])", "", s)  # a short "a" between consonants is often not written
    return s


EXACT, STARTS, CONTAINS = 3, 2, 1


def match_level(query: str, term: str) -> int:
    """EXACT = the same name, STARTS = a word starts with what was typed, CONTAINS = contains it, 0 = no match."""
    qk, tk = name_key(query), name_key(term)
    if not qk or not tk:
        return 0
    qp, tp = phonetic(query), phonetic(term)
    best = 0
    for q, t, ok in ((qk, tk, True), (qp, tp, len(qp) >= 2 and bool(tp))):
        if not ok:
            continue
        if q == t:
            return EXACT
        if t.startswith(q) or any(w.startswith(q) for w in t.split()):
            best = max(best, STARTS)
        elif q in t:
            best = max(best, CONTAINS)
    return best


def search_score(query: str, terms: list[str]) -> int:
    """How well terms match: 0 = no match. A match on the first term (the item's own name) beats the same
    kind of match on another name, so "money" lists Money Plant before Jade Plant ("money tree")."""
    best = 0
    for i, term in enumerate(terms):
        if term and (level := match_level(query, term)):
            best = max(best, level * 2 + (1 if i == 0 else 0))
    return best


def library_terms(entry: dict | None) -> list[str]:
    if not entry or entry.get("removed"):
        return []
    return [entry.get("name", ""), entry.get("name_hi", ""), entry.get("botanical", ""), *entry.get("aliases", [])]


def product_terms(product: dict, entry: dict | None = None) -> list[str]:
    """A product is found by its own name, botanical name and code, and by its shared entry's other names."""
    return [product["name"], product.get("botanical_name", ""), product.get("sku", ""), *library_terms(entry)]


# ---- AI and supplier-bill names ------------------------------------------------------------------

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
