import os
import re
import json
import google.generativeai as genai
from PIL import Image
from dotenv import load_dotenv

# .env dosyasından çevresel değişkenleri yükle
load_dotenv()

# Gemini yapılandırması
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("UYARI: GEMINI_API_KEY bulunamadı! Lütfen .env dosyanızı kontrol edin.")

SYSTEM_INSTRUCTION = """
You are a conservative dermatology assistant used for doctor support.

You must reply with a valid JSON object. Do not include markdown formatting like ```json.
The JSON object must strictly follow this structure:
{
  "analysis": "Your 4-paragraph plain English text...",
  "detailed_class": "The most specific condition inferred (e.g. 'acne vulgaris', 'healthy')",
  "detailed_probability": 0.95,
  "short_class": "A constrained class name from the approved list",
  "short_probability": 0.95
}

Short Class Rules:
The "short_class" value MUST be exactly ONE of the following words:
- acne
- eczema
- psoriasis
- fungal
- ringworm
- tinea
- hives
- urticaria
- dermatitis
- rosacea
- others

If the condition is healthy, undetected, undetermined, or anything else not explicitly listed above, you MUST return "others" for "short_class".

Analysis Formatting Rules:
- The "analysis" field MUST be plain English text.
- Do NOT use markdown in the analysis field.
- Do NOT use bullet points or headings in the analysis field.
- Do NOT mention hidden reasoning or probabilities in the analysis field.
- Do NOT mention that you corrected or summarized the complaint in the analysis field.

Before answering, silently do all of the following (do not include these steps in the text):
1) Correct obvious spelling mistakes in the patient's complaint.
2) Normalize and summarize the complaint into a short internal clinical impression.
3) Determine whether the uploaded image is actually relevant to dermatology.

Image relevance rules:
- If the uploaded content is not a dermatology-relevant skin image, your "analysis" text must be exactly:
  The most likely condition is undetected. The uploaded content does not appear to be a relevant dermatology image.
  In this case, set "detailed_class" to "undetected" and "short_class" to "others".
- Examples of irrelevant content include x-rays, CT scans, MRI scans, screenshots, documents, math problems, charts, random objects, or non-skin photos with no visible skin lesion.
- If the image is too blurry, too dark, too cropped, too distant, or otherwise not reliable for skin assessment, your "analysis" text must be exactly:
  The most likely condition is undetected. The image quality is not sufficient for a reliable dermatology assessment.
  In this case, set "detailed_class" to "undetected" and "short_class" to "others".

Diagnostic rules:
- Use the image as the primary evidence.
- Use patient metadata only as secondary supporting context.
- Use the external classifier output only as tertiary supporting context.
- Do not blindly trust the classifier.
- Do not invent visual findings.
- Do not rely mainly on past medical history.
- Past medical history may support recurrence only if the current image and present symptoms are also compatible with that condition.
- Ignore unrelated past conditions if they do not fit the current image and complaint.
- If the image clearly shows normal skin with no meaningful abnormality, you may say:
  The most likely condition is healthy skin.
- If the case is skin-related but too ambiguous for one reliable label, say:
  The most likely condition is undetermined.

Output format rules for "analysis":
- If the image is irrelevant or too poor quality, return only the exact undetected response as described above.
- Otherwise, the "analysis" field must contain exactly 4 short paragraphs.
- Paragraph 1 (Diagnosis): Must start exactly with "The most likely condition is ...". State the broad umbrella diagnosis and a more specific clinical subtype if reasonably supported. Keep it to 2-3 sentences.
- Paragraph 2 (Model Evaluation): Critically evaluate the external classifier's top predictions. Explicitly state whether you agree or disagree, supporting your stance with visual and symptomatic evidence. Keep it to 3-4 sentences.
- Paragraph 3 (Clinical Reasoning): Provide a deeper scientific justification. Connect the specific visual findings with the patient's reported symptoms, and briefly explain why other common conditions were ruled out. Keep it to 3-5 sentences.
- Paragraph 4 (Treatment Approach): Suggest a concise, conservative treatment strategy. Mention general skin care, potential topical or systemic approaches, and advise a dermatology review. Keep it to 3-5 sentences.

Specificity rules:
- Prefer a broad umbrella label first, because the same output may also be shown to the patient.
- Add a more specific subtype only if it is reasonably supported by the current image and current complaint.
- Do not force a subtype if the subtype is uncertain.

Advice rules:
- Only include low-risk, general advice.
- Avoid herbal, botanical, essential-oil, or natural remedy recommendations.
- Do not prescribe drugs or doses.
- Safe advice may include avoiding triggers, reducing irritant exposure, using a gentle fragrance-free moisturizer, and seeking dermatology review if persistent or worsening.
""".strip()

UNDETECTED_IRRELEVANT = (
    "The most likely condition is undetected. "
    "The uploaded content does not appear to be a relevant dermatology image."
)

UNDETECTED_QUALITY = (
    "The most likely condition is undetected. "
    "The image quality is not sufficient for a reliable dermatology assessment."
)

def _limit_sentences(text: str, max_sentences: int) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    parts = re.split(r'(?<=[.!?])\s+', text)
    parts = [p.strip() for p in parts if p.strip()]
    return " ".join(parts[:max_sentences]).strip()

def clean_response(text: str) -> str:
    if not text:
        return UNDETECTED_QUALITY

    s = text.strip()

    # remove accidental code fences
    s = re.sub(r"^```[a-zA-Z0-9_-]*\n?", "", s)
    s = re.sub(r"```$", "", s).strip()

    s = s.strip()
    if s == UNDETECTED_IRRELEVANT or s == UNDETECTED_QUALITY:
        return s

    # split into paragraphs if present
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", s) if p.strip()]

    if len(paragraphs) == 0:
        return UNDETECTED_QUALITY

    # Process up to 4 paragraphs
    p1 = _limit_sentences(paragraphs[0] if len(paragraphs) > 0 else "", 4)
    if not p1.lower().startswith("the most likely condition is"):
        p1 = "The most likely condition is undetermined. " + p1

    final_paragraphs = [p1]
    
    if len(paragraphs) > 1:
        final_paragraphs.append(_limit_sentences(paragraphs[1], 5))
    if len(paragraphs) > 2:
        final_paragraphs.append(_limit_sentences(paragraphs[2], 6))
    if len(paragraphs) > 3:
        final_paragraphs.append(_limit_sentences(paragraphs[3], 6))

    return "\n\n".join(final_paragraphs)

def analyze_with_gemini(image: Image.Image, patient_info: str, top3_predictions: list) -> dict:
    """
    Hastanın resmi, doktor/sistem notları(patient_info) ve PyTorch modelinin(Top-3)
    tahminini birleştirerek Gemini'ye gönderir. Colab'daki spesifik prompt kullanılır.
    """
    if not GEMINI_API_KEY:
        return {
            "gemini_analysis": "Hata: Sunucuda GEMINI_API_KEY tanımlı değil.",
            "gemini_final_response": {"class": "error", "probability": 0.0},
            "gemini_final_response_form": {"class": "error", "probability": 0.0}
        }

    classifier_summary_lines = []
    for rank, item in enumerate(top3_predictions, start=1):
        classifier_summary_lines.append(f"{rank}. {item['class_name']} ({item['probability'] * 100:.2f}%)")
    classifier_summary = "\n".join(classifier_summary_lines)

    prompt = f"""
Review ONE uploaded image together with the patient information and the external dermatology classifier output below.

Task:
- Identify the single most likely skin condition.
- Use the image as the main evidence and the patient information as supporting context.
- Treat the external classifier output as secondary support only; do not follow it blindly.
- If the upload is irrelevant to dermatology, return the exact undetected response.
- If the case is skin-related but too ambiguous for one reliable diagnosis, say:
  The most likely condition is undetermined.
- Start with a broad umbrella diagnosis that is easier for a patient to understand.
- Then, if supported, add a more specific clinical subtype or detail that may help the doctor.
- If a past condition is relevant and consistent with the current image and symptoms, you may mention that it could support recurrence or clinical context.
- Do not focus only on history; the current image must remain primary.
- Construct the text in exactly 4 paragraphs (Diagnosis, Model Evaluation, Clinical Reasoning, Treatment Approach) and place it in the "analysis" field of the JSON.

Classifier accuracy is %71.5, so be careful about result.
External dermatology classifier top predictions:
{classifier_summary}

Preferred style example:
The most likely condition is eczema. More specifically, this appears most consistent with contact dermatitis of the hands. The overall clinical presentation strongly suggests an environmental irritant etiology rather than a primary infectious process.

The classifier explicitly predicted "Eczema Photos" correctly in its top predictions. Although it also suggested "Tinea Ringworm Candidiasis", the characteristic raised scaly borders of a fungal infection are absent here. Therefore, the model's eczema prediction is visually and symptomatically supported.

Clinical analysis reveals ill-defined erythematous plaques with deep fissures across the palmar surfaces. These visual findings, combined with the patient's reported worsening after frequent detergent exposure and intense localized pruritus, confidently rule out systemic conditions. Psoriasis is less likely due to the lack of distinct silvery scaling.

For treatment, reducing environmental irritant exposure is the primary recommendation. Using a gentle fragrance-free and ceramide-rich moisturizer can help restore the skin barrier. If the rash persists or worsens, a dermatology review is advised for potential short-course topical corticosteroid therapy.

Patient information:
{patient_info}
""".strip()

    try:
        model = genai.GenerativeModel(
            'gemini-2.5-flash',
            system_instruction=SYSTEM_INSTRUCTION,
            generation_config={"response_mime_type": "application/json"}
        )
        
        response = model.generate_content([prompt, image])
        
        text = response.text.strip()
        if text.startswith("```"):
            text = text.strip("` \n")
            if text.lower().startswith("json"):
                text = text[4:].strip()
                
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            data = {
                "analysis": text,
                "detailed_class": "undetected",
                "detailed_probability": 0.0,
                "short_class": "others",
                "short_probability": 0.0
            }
            
        analysis_text = clean_response(data.get("analysis", ""))
        detailed_class = data.get("detailed_class", "others")
        try:
            detailed_prob = float(data.get("detailed_probability", 0.0))
        except:
            detailed_prob = 0.0
            
        short_class = data.get("short_class", "others").lower()
        if short_class not in ['acne', 'eczema', 'psoriasis', 'fungal', 'ringworm', 'tinea', 'hives', 'urticaria', 'dermatitis', 'rosacea', 'others']:
            short_class = 'others'
            
        try:
            short_prob = float(data.get("short_probability", 0.0))
        except:
            short_prob = 0.0
            
        return {
            "gemini_analysis": analysis_text,
            "gemini_final_response": {"class": detailed_class, "probability": detailed_prob},
            "gemini_final_response_form": {"class": short_class, "probability": short_prob}
        }
    except Exception as e:
        return {
            "gemini_analysis": f"Gemini API Hatası: {str(e)}",
            "gemini_final_response": {"class": "error", "probability": 0.0},
            "gemini_final_response_form": {"class": "error", "probability": 0.0}
        }



