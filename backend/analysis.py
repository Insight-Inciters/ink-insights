import re
import numpy as np
import spacy
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import PCA
from sklearn.cluster import KMeans
from nltk.sentiment import SentimentIntensityAnalyzer
from textblob import TextBlob
import text2emotion as te
import nltk
nltk.download('vader_lexicon', quiet=True)

nlp = spacy.load("en_core_web_md")

# ---------- FEATURE 1: Keywords ----------
def extract_keywords(text, top_n=20):
    clean = re.sub(r'[^a-zA-Z\s]', '', text.lower())
    vectorizer = CountVectorizer(stop_words='english')
    X = vectorizer.fit_transform([clean])
    freqs = X.toarray().sum(axis=0)
    vocab = vectorizer.get_feature_names_out()
    keywords = sorted(zip(vocab, freqs), key=lambda x: x[1], reverse=True)[:top_n]
    return {
        "unique": len(vocab),
        "top": keywords[0][0] if keywords else "—",
        "list": [{"token": w, "count": int(c)} for w, c in keywords]
    }

# ---------- FEATURE 2: Themes ----------
def cluster_themes(text):
    doc = nlp(text)
    tokens = [t for t in doc if t.is_alpha and not t.is_stop]
    if len(tokens) < 10:
        return {"clusters": 0, "top_theme": "Insufficient data"}

    vectors = np.array([t.vector for t in tokens])
    n_clusters = min(5, max(1, len(vectors)//50))
    kmeans = KMeans(n_clusters=n_clusters, n_init=10)
    labels = kmeans.fit_predict(vectors)

    cluster_words = []
    for i in range(n_clusters):
        words = [t.text for t, l in zip(tokens, labels) if l == i][:5]
        cluster_words.append(words)

    reduced = PCA(n_components=2).fit_transform(vectors)
    return {
        "clusters": n_clusters,
        "top_theme": [w[0] for w in cluster_words if w],
        "data": [{"word": t.text, "x": float(x), "y": float(y)} for t, (x, y) in zip(tokens[:200], reduced[:200])]
    }

# ---------- FEATURE 3: Sentiment ----------
def analyze_sentiment(text):
    sid = SentimentIntensityAnalyzer()
    s = sid.polarity_scores(text)
    return {
        "pos": round(s["pos"] * 100),
        "neu": round(s["neu"] * 100),
        "neg": round(s["neg"] * 100)
    }

# ---------- FEATURE 4: Emotions ----------
def detect_emotions(text):
    e = te.get_emotion(text)
    dominant = max(e, key=e.get) if e else "—"
    dist = {k: int(v * 100) for k, v in e.items()}
    return {"dominant": dominant, "distribution": dist}

# ---------- Combined ----------
def analyze_text(path):
    text = open(path, encoding='utf-8').read()
    return {
        "keywords": extract_keywords(text),
        "themes": cluster_themes(text),
        "sentiment": analyze_sentiment(text),
        "emotions": detect_emotions(text)
    }
