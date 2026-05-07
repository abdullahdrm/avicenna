import google.generativeai as genai
import json
import re

API_KEY = "...."
genai.configure(api_key=API_KEY)

def generate_dermatology_data():
    # Setup model
    model = genai.GenerativeModel('gemini-2.5-flash')
    all_data = []
    
    # Target total count
    target_count = 1800
    batch_size = 100
    iterations = target_count // batch_size
    
    # Prompt for generating batches
    prompt = f"""
    Generate exactly {batch_size} comprehensive Q&A pairs about dermatology and skincare. 
    Act as if you are creating a foundational dataset from scratch. 
    
    The dataset MUST cover the following specific topics and sub-topics:
    - Skin types (oily, dry, combination, sensitive)
    - Cleansing & Exfoliation (double cleansing, AHA/BHA, physical vs. chemical)
    - Moisturizing & Barrier Repair (ceramides, transepidermal water loss, slugging)
    - Sun Protection (mineral vs. chemical, UVA/UVB, PA ratings, photoaging)
    - Acne (vulgaris, cystic, hormonal, fungal acne, blackheads, whiteheads)
    - Dermatological Conditions (rosacea, eczema, psoriasis, melasma, keratosis pilaris, contact dermatitis)
    - Ingredients (Niacinamide, Retinol, Vitamin C, Hyaluronic Acid, Azelaic Acid, Squalane, Peptides)
    - Nail Health (brittle nails, fungal infections, cuticle care)
    - Hair & Scalp (dandruff, seborrheic dermatitis, hair loss, traction alopecia)
    - Lip Care (angular cheilitis, chapped lips, cold sores)
    - Body Care & Hands/Feet (back acne, chafing, cracked heels, athlete's foot)
    - Traditional Remedies & Myths (debunking the use of lemon, garlic, toothpaste, or baking soda on skin)
    - Anti-Aging & Seasonal Skincare (winter dryness, crow's feet, retinoid use)
    - Safe Natural Support (cool compresses, plain ointments, gentle cleansing)

    Return the response ONLY as a valid JSON array in the following structure. Do not add Markdown formatting, greetings, or extra text:
    [
      {{
        "question": "Question here",
        "answer": "Answer here",
        "metadata": {{
          "category": "category_name",
          "condition": "condition_name",
          "topic": "sub_topic",
          "priority": 1
        }}
      }}
    ]
    """
    
    # Batch generation loop
    for i in range(iterations):
        response = model.generate_content(prompt)
        raw_text = response.text
        cleaned_text = re.sub(r'```json|```', '', raw_text).strip()
        
        try:
            dataset_batch = json.loads(cleaned_text)
            all_data.extend(dataset_batch)
        except json.JSONDecodeError:
            pass # Skip invalid batches
            
    return all_data

def filter_medical_advice(dataset):
    # Filter risky medical terms
    safe_data = []
    medical_keywords = re.compile(r'\b(cure|prescribe|dosage|accutane|antibiotics|surgery|medical advice)\b', re.IGNORECASE)
    
    for item in dataset:
        text_to_check = item.get("question", "") + " " + item.get("answer", "")
        if not medical_keywords.search(text_to_check):
            safe_data.append(item)
            
    return safe_data

def remove_duplicates(dataset):
    # Deduplicate by question
    seen_questions = set()
    unique_data = []
    
    for item in dataset:
        normalized_q = item.get("question", "").strip().lower()
        if normalized_q not in seen_questions:
            seen_questions.add(normalized_q)
            unique_data.append(item)
            
    return unique_data

def analyze_topics_and_build_prompt(dataset):
    # Extract topics for prompt
    topics = set()
    for item in dataset:
        category = item.get("metadata", {}).get("category")
        if category:
            topics.add(category.replace("_", " ").title())
            
    topic_list_str = ", ".join(topics)
    
    # Construct final system prompt
    system_prompt = f"""
### AVICENNA ASSISTANT SYSTEM PROMPT ###

**Role & Identity:**
You are 'Avicenna', a knowledgeable and evidence-based AI Skincare & Dermatology Assistant. Your expertise covers the following domains extracted from your generated knowledge base: {topic_list_str}.

**Core Directives:**
1. **No Medical Advice:** You are an AI, not a doctor. Never diagnose, prescribe, or provide exact medical treatment plans. If a user presents severe symptoms (e.g., bleeding, spreading infections, deep cystic acne), firmly advise them to consult a board-certified dermatologist.
2. **Grounding:** Base all your answers strictly on the provided 'avicenna_knowledge_cleaned.jsonl' dataset. Do not hallucinate skincare facts or invent ingredient interactions.
3. **Safety First:** Debunk harmful DIY skincare myths safely. Explain the science behind why things like baking soda or toothpaste are harmful to the skin barrier. Emphasize safe, gentle home care.
4. **Tone:** Maintain an empathetic, educational, and professional tone.
"""
    return system_prompt

def save_to_jsonl(dataset, filename="avicenna_knowledge_cleaned.jsonl"):
    # Export to JSONL format
    with open(filename, "w", encoding="utf-8") as f:
        for entry in dataset:
            f.write(json.dumps(entry) + "\n")

def main():
    # Execute full pipeline
    raw_dataset = generate_dermatology_data()
    
    if not raw_dataset:
        return
        
    safe_dataset = filter_medical_advice(raw_dataset)
    cleaned_dataset = remove_duplicates(safe_dataset)
    system_prompt = analyze_topics_and_build_prompt(cleaned_dataset)
    
    print(system_prompt)
    
    save_to_jsonl(cleaned_dataset)

if __name__ == "__main__":
    main()