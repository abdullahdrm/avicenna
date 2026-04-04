import os
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

def analyze_with_gemini(image: Image.Image, patient_info: str, top3_predictions: list) -> str:
    """
    Hastanın resmi, doktor/sistem notları(patient_info) ve PyTorch modelinin(Top-3)
    tahminini birleştirerek Gemini'ye gönderir.
    """
    if not GEMINI_API_KEY:
        return "Hata: Sunucuda GEMINI_API_KEY tanımlı değil."

    # Top-3 tahminlerini okunaklı bir metne dönüştür
    predictions_text = "\n".join(
        [f"- {item['class_name']} (Olasılık: {item['probability'] * 100:.2f}%)" for item in top3_predictions]
    )

    # Gemini'ye gidecek Prompt (İstem)
    # Bu metni Colab'da kullandığınız formata göre değiştirebilirsiniz.
    prompt = f"""
Sen uzman bir dermatologsun. Aşağıda bir hastaya ait klinik bilgiler ve yapay zeka (PyTorch) modelimizin cilt yüzeyindeki lezyona ilişkin yaptığı en iyi 3 hastalık tahmini bulunmaktadır.

Hasta Bilgileri:
{patient_info}

Yapay Zeka (Swin Model) Tahminleri:
{predictions_text}

Lütfen bu resmi, verilen hasta bilgilerini ve yapay zeka tahminlerini bir araya getirerek kapsamlı bir değerlendirme raporu yaz. Hangi hastalığın daha olası olduğunu ve sebebini belirt, ayrıca tavsiyelerde bulun.
"""

    try:
        # Görsel destekli model seçimi (Kullanıcı tercihi gemini-2.5-flash)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Resmi ve metni listeye koyarak model üzerinden generate_content çağrısı yapıyoruz
        response = model.generate_content([prompt, image])
        
        return response.text
    except Exception as e:
        return f"Gemini API Hatası: {str(e)}"
