# backend/vector_memory.py


class VectorMemory:
    """
    Lightweight in-session memory that tracks covered Q/A pairs
    and detects topic repetition via keyword overlap.

    (Drop-in replacement for FAISS-based version; no GPU needed.)
    """

    STOPWORDS = {
        "the", "and", "for", "you", "your", "can", "with", "that", "this",
        "from", "have", "had", "been", "they", "their", "what", "when", "how",
        "why", "are", "was", "will", "would", "could", "should", "about",
        "also", "there", "which", "more", "than", "such", "those", "these",
        "were", "while", "where", "into", "onto", "over", "under",
    }

    def __init__(self):
        self.qa_pairs: list[dict] = []

    def add_qa(self, question: str, answer: str) -> None:
        self.qa_pairs.append({"question": question, "answer": answer})

    def is_duplicate_topic(self, new_question: str, threshold: int = 3) -> bool:
        new_kw = self._extract_keywords(new_question)
        for past in self.qa_pairs:
            if len(new_kw & self._extract_keywords(past["question"])) >= threshold:
                return True
        return False

    def _extract_keywords(self, text: str) -> set[str]:
        return {
            w.strip(".,!?()[]\"'")
            for w in text.lower().split()
            if len(w) > 3 and w not in self.STOPWORDS
        }

    def recent_topics(self, limit: int = 5) -> list[str]:
        keywords: list[str] = []
        for entry in self.qa_pairs[-limit:]:
            kw = list(self._extract_keywords(entry["question"]))
            keywords.extend(kw[:3])
        return list(set(keywords))
