import json
import hashlib
import re
from pathlib import Path
import numpy as np
from sentence_transformers import SentenceTransformer
from avicenna_api.models import QAEmbedding


embedding_model = SentenceTransformer("BAAI/bge-base-en-v1.5")


def read_txt_file(file_path: str) -> str:
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def chunk_text_old(text: str) -> list[dict]:
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
            embedded_text = (
                f"Section: {current_section}\n"
                f"Question: {current_question.strip()}\n"
                f"Answer: {answer}"
            )
            chunks.append({
                "section": current_section,
                "question": current_question.strip(),
                "answer": answer,
                "text": embedded_text,
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


def chunk_text(text: str) -> list[dict]:
    lines = text.strip().splitlines()
    chunks = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        try:
            data = json.loads(line)

            question = data.get("question", "").strip()
            answer = data.get("answer", "").strip()

            if not question or not answer:
                continue

            embedded_text = (
                f"Question: {question}\n"
                f"Answer: {answer}"
            )

            chunks.append({
                "question": question,
                "answer": answer,
                "text": embedded_text,
            })

        except json.JSONDecodeError:
            # skip invalid lines
            continue

    return chunks


def generate_embeddings(texts: list[str]) -> np.ndarray:
    return embedding_model.encode(
        texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=True,
    )


def import_qa_file_to_db(file_path: str, delete_existing_for_file: bool = False) -> int:
    file_path_obj = Path(file_path)
    full_text = read_txt_file(str(file_path_obj))
    chunks = chunk_text(full_text)

    if not chunks:
        return 0

    if delete_existing_for_file:
        QAEmbedding.objects.filter(source_file=str(file_path_obj)).delete()

    texts = [chunk["text"] for chunk in chunks]
    embeddings = generate_embeddings(texts)

    objects_to_create = []

    for chunk, embedding in zip(chunks, embeddings):

        objects_to_create.append(
            QAEmbedding(
                question=chunk["question"],
                answer=chunk["answer"],
                embedding=embedding.tolist(),
                source_file=str(file_path_obj),
            )
        )

    if objects_to_create:
        QAEmbedding.objects.bulk_create(objects_to_create, batch_size=100)

    return len(objects_to_create)
