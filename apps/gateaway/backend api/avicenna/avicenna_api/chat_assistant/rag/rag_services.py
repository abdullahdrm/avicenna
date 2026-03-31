import re
import os
import numpy as np
import requests
from sentence_transformers import SentenceTransformer, CrossEncoder

embedding_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")


def read_txt_file(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def chunk_text(text: str) -> list[dict]:
    text = text.strip()
    lines = [line.rstrip() for line in text.splitlines()]
    chunks = []

    current_section = "Unknown"
    current_question = None
    current_answer_lines = []

    section_pattern = re.compile(r"^===\s*(.*?)\s*===$")
    question_pattern = re.compile(r"^Q\d+:\s*(.*)")
    answer_pattern = re.compile(r"^A:\s*(.*)")

    def save_current():
        nonlocal current_question, current_answer_lines
        if current_question:
            answer = "\n".join(current_answer_lines).strip()
            chunks.append({
                "section": current_section,
                "question": current_question.strip(),
                "answer": answer,
                "text": f"Section: {current_section}\nQuestion: {current_question.strip()}\nAnswer: {answer}"
            })
        current_question = None
        current_answer_lines = []

    for line in lines:
        stripped = line.strip()

        if not stripped:
            continue

        section_match = section_pattern.match(stripped)
        if section_match:
            save_current()
            current_section = section_match.group(1).strip()
            continue

        question_match = question_pattern.match(stripped)
        if question_match:
            save_current()
            current_question = question_match.group(1).strip()
            continue

        answer_match = answer_pattern.match(stripped)
        if answer_match:
            current_answer_lines = [answer_match.group(1).strip()]
            continue

        if current_question:
            current_answer_lines.append(stripped)

    save_current()
    return chunks


def generate_response(messages, open_router_key: str):
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {open_router_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": "meta-llama/llama-3-8b-instruct",
        "messages": messages
    }
    response = requests.post(url, headers=headers, json=data)
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def generate_embeddings(texts: list[str]) -> np.ndarray:
    return embedding_model.encode(
        texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False
    )


def retrieve_top_n_chunks(
    query: str,
    chunks: list[dict],
    chunk_embeddings: np.ndarray,
    top_n: int = 5
) -> list[dict]:
    query_embedding = embedding_model.encode(
        [query],
        normalize_embeddings=True,
        convert_to_numpy=True
    )[0]

    scores = np.dot(chunk_embeddings, query_embedding)
    top_indices = np.argsort(scores)[::-1][:top_n]

    results = []
    for idx in top_indices:
        results.append({
            "chunk_index": int(idx),
            "score": float(scores[idx]),
            "section": chunks[idx]["section"],
            "question": chunks[idx]["question"],
            "answer": chunks[idx]["answer"],
            "text": chunks[idx]["text"]
        })

    return results


def rerank_results(query: str, retrieved_chunks: list[dict], top_k: int = 3) -> list[dict]:
    pairs = [(query, item["text"]) for item in retrieved_chunks]
    rerank_scores = reranker.predict(pairs)

    for item, score in zip(retrieved_chunks, rerank_scores):
        item["rerank_score"] = float(score)

    reranked = sorted(
        retrieved_chunks,
        key=lambda x: x["rerank_score"],
        reverse=True
    )
    return reranked[:top_k]


def get_rag_result(query):
    current_path = os.getcwd()
    file_path = os.path.join(
        current_path, "avicenna_api/chat_assistant/rag/data.txt")
    top_n = 5

    full_text = read_txt_file(file_path)

    chunks = chunk_text(full_text)

    chunk_texts = [chunk["text"] for chunk in chunks]
    chunk_embeddings = generate_embeddings(chunk_texts)

    retrieved = retrieve_top_n_chunks(
        query=query,
        chunks=chunks,
        chunk_embeddings=chunk_embeddings,
        top_n=top_n
    )

    reranked = rerank_results(query, retrieved, top_k=3)

    print("User Query:", query)
    print("\nTop Retrieved and Reranked Chunks:")
    for idx, item in enumerate(reranked, 1):
        print(f"Answer: {item['answer']}")

    return [item["answer"] for item in reranked]
