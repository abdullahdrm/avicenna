import os
import re
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

Return ONLY plain English text.
Do NOT return JSON.
Do NOT return markdown.
Do NOT return bullet points.
Do NOT use headings.
Do NOT mention hidden reasoning.
Do NOT mention chain-of-thought.
Do NOT mention probabilities in the final answer.
Do NOT mention that you corrected or summarized the complaint.

Before answering, silently do all of the following:
1) Correct obvious spelling mistakes in the patient's complaint.
2) Normalize and summarize the complaint into a short internal clinical impression.
3) Determine whether the uploaded image is actually relevant to dermatology.

Image relevance rules:
- If the uploaded content is not a dermatology-relevant skin image, return exactly:
  The most likely condition is undetected. The uploaded content does not appear to be a relevant dermatology image.
- Examples of irrelevant content include x-rays, CT scans, MRI scans, screenshots, documents, math problems, charts, random objects, or non-skin photos with no visible skin lesion.
- If the image is too blurry, too dark, too cropped, too distant, or otherwise not reliable for skin assessment, return exactly:
  The most likely condition is undetected. The image quality is not sufficient for a reliable dermatology assessment.

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

Output format rules:
- If the image is irrelevant or too poor quality, return only the exact undetected response and nothing else.
- Otherwise return exactly 4 short paragraphs.
- Paragraph 1 (Diagnosis): Must start exactly with "The most likely condition is ...". State the broad umbrella diagnosis and a more specific clinical subtype if reasonably supported. Keep it to 2-3 sentences.
- Paragraph 2 (Model Evaluation): Critically evaluate the external classifier's top predictions. Explicitly state whether you agree or disagree, supporting your stance with visual and symptomatic evidence. Keep it to 3-4 sentences.
- Paragraph 3 (Clinical Reasoning): Provide a deeper scientific justification. Connect the specific visual findings (e.g., purulent pustules, annular scaling) with the patient's reported symptoms, and briefly explain why other common conditions were ruled out. Keep it to 3-5 sentences.
- Paragraph 4 (Treatment Approach): Suggest a concise, conservative treatment strategy. Mention general skin care, potential topical or systemic approaches if applicable, and advise a dermatology review. Keep it to 3-5 sentences.
- Do not use headings like "Reasoning" or "Model output". Do NOT use markdown formatting.

Specificity rules:
- Prefer a broad umbrella label first, because the same output may also be shown to the patient.
- Add a more specific subtype only if it is reasonably supported by the current image and current complaint.
- Example:
  The most likely condition is eczema. More specifically, this appears most consistent with contact dermatitis.
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

def analyze_with_gemini(image: Image.Image, patient_info: str, top3_predictions: list) -> str:
    """
    Hastanın resmi, doktor/sistem notları(patient_info) ve PyTorch modelinin(Top-3)
    tahminini birleştirerek Gemini'ye gönderir. Colab'daki spesifik prompt kullanılır.
    """
    if not GEMINI_API_KEY:
        return "Hata: Sunucuda GEMINI_API_KEY tanımlı değil."

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
- If the image is dermatology-related but still too uncertain for one reliable diagnosis, say:
  The most likely condition is undetermined.
- Start with a broad umbrella diagnosis that is easier for a patient to understand.
- Then, if supported, add a more specific clinical subtype or detail that may help the doctor.
- If a past condition is relevant and consistent with the current image and symptoms, you may mention that it could support recurrence or clinical context.
- Do not focus only on history; the current image must remain primary.
- Construct the output in exactly 4 paragraphs (Diagnosis, Model Evaluation, Clinical Reasoning, Treatment Approach).

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
            system_instruction=SYSTEM_INSTRUCTION
        )
        
        response = model.generate_content([prompt, image])
        
        return clean_response(response.text)
    except Exception as e:
        return f"Gemini API Hatası: {str(e)}"

def get_gemini_only_class(report: str) -> str:
    """
    Verilen hasta değerlendirme raporunu ('report') analiz eder ve 
    en olası hastalık sınıfını döner.
    Dönebileceği sınıflar: 'acne', 'eczema', 'psoriasis', 'fungus', 'others'
    """
    if not GEMINI_API_KEY:
        return "error: GEMINI_API_KEY tanımlı değil."

    prompt = f"""
Sen uzman bir tıp asistanısın. Aşağıda hasta için hazırlanmış bir değerlendirme raporu yer almaktadır.
Görevin, bu raporu okumak ve sonuçta hastanın taşıdığı düşünülen hastalık türünü değerlendirp SADECE TEK BİR KELİME çıktısı vermektir.

Sadece ve sadece şu kelimelerden BİRİNİ çıktı olarak vermelisin:
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

Kurallar:
- Eğer raporda egzema tabanlı bir teşhis varsa 'eczema' dön.
- Eğer raporda sedef hastalığı (psoriasis) veya benzeri tabanlı bir teşhis varsa 'psoriasis' dön.
- Eğer raporda mantar enfeksiyonu varsa 'fungus' dön.
- Eğer raporda akne (acne) teşhisi varsa 'acne' dön.
- Eğer raporda hives tabanlı bir teşhis varrsa 'hives' dön.
- Eğer raporda rosacea tabanlı bir teşhis varrsa 'rosacea' dön.
- Eğer raporda urticaria tabanlı bir teşhis varrsa 'urticaria' dön.
- Eğer raporda dermatitis tabanlı bir teşhis varrsa 'dermatitis' dön.
- Eğer raporda ringworm tabanlı bir teşhis varrsa 'ringworm' dön.
- Eğer raporda tinea tabanlı bir teşhis varrsa 'tinea' dön. 
- Eğer kişi sağlıklıysa, hastalık tespit edilmemişse veya yukarıdakiler dışında tamamen farklı bir sorun varsa 'others' dön.

KESİNLİKLE SADECE TEK BİR KELİME DÖN. NOKTALAMA İŞARETİ KULLANMA. AÇIKLAMA YAPMA.

Değerlendirme Raporu:
{report}
"""

    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        # Sadece metin gönderdiğimiz için generate_content'e direkt promptu verebiliriz
        response = model.generate_content(prompt)
        
        # Gelen yanıtı temizle ve küçük harfe çevir
        class_name = response.text.strip().lower()
        
        # Model açıklama vb. bir şey üretirse içinden kelimeyi bulmaya çalışalım
        allowed_classes = ['acne', 'eczema', 'psoriasis', 'fungus', 'others']
        for allowed in allowed_classes:
            if allowed in class_name:
                return allowed
        
        # Hiçbiri eşleşmezse others dön
        return "others"
    except Exception as e:
        return f"error"

