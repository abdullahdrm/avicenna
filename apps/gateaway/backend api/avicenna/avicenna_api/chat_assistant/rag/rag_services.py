from sentence_transformers import SentenceTransformer, CrossEncoder
from pgvector.django import CosineDistance

from avicenna_api.models import QAEmbedding

embedding_model = SentenceTransformer("BAAI/bge-base-en-v1.5")
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")


def retrieve_top_n_chunks(query: str, top_n: int = 5) -> list[dict]:
    query_embedding = embedding_model.encode(
        query,
        normalize_embeddings=True
    ).tolist()

    results = (
        QAEmbedding.objects
        .annotate(distance=CosineDistance("embedding", query_embedding))
        .order_by("distance")[:top_n]
    )

    retrieved = []
    for item in results:
        retrieved.append({
            "id": item.id,
            "question": item.question,
            "answer": item.answer,
            "content": item.content,
            "distance": float(item.distance),
        })

    return retrieved


def rerank_results(query: str, retrieved_chunks: list[dict], top_k: int = 3) -> list[dict]:
    if not retrieved_chunks:
        return []

    pairs = [
        (query, f"Question: {item['question']}\nAnswer: {item['answer']}")
        for item in retrieved_chunks
    ]

    rerank_scores = reranker.predict(pairs)

    for item, score in zip(retrieved_chunks, rerank_scores):
        item["rerank_score"] = float(score)

    reranked = sorted(
        retrieved_chunks,
        key=lambda x: x["rerank_score"],
        reverse=True
    )

    return reranked[:top_k]


def get_rag_result(query: str, top_n: int = 5, top_k: int = 3) -> list[dict]:
    retrieved = retrieve_top_n_chunks(query=query, top_n=top_n)
    reranked = rerank_results(
        query=query, retrieved_chunks=retrieved, top_k=top_k)

    return [item["answer"] for item in reranked]
