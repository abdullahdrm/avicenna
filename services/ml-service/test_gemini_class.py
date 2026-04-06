import requests
import json

URL = "http://127.0.0.1:8000/gemini_only_class"

def main():
    print("1. Sunucuya İstek Hazırlanıyor...")
    
    # Örnek bir hasta raporu (Gemini çıktısı gibi düşünelim)
    test_report = """
    Hasta Bilgileri: 21 yaşında erkek hasta. Özellikle yüz, omuz ve sırt bölgesinde kızarıklık, iltihaplı sivilceler ve siyah noktalar şikayetiyle başvurdu.
    Yapay Zeka Tahminleri: Acne and Rosacea. 
    Değerlendirme: Hastanın lezyonları, yaş ve bölge göz önüne alındığında şiddetli akne vulgaris ile uyumludur. Gerekli merhem ve antibiyotik tedavisine başlanması önerilir.
    """
    
    data = {
        "report": test_report
    }

    try:
        print("2. İstek API'ye Gönderiliyor...")
        response = requests.post(URL, json=data)
        
        if response.status_code == 200:
            json_cevap = response.json()
            print("\n✅ API'DEN GELEN BAŞARILI CEVAP:\n")
            print(json.dumps(json_cevap, indent=4, ensure_ascii=False))
        else:
            print(f"❌ HATA! API {response.status_code} kodu döndü.")
            print(response.text)

    except Exception as e:
        print(f"Beklenmeyen bir hata oluştu: {e}")
        print("Lütfen FastAPI sunucusunun (uvicorn) arka planda çalışıp çalışmadığını kontrol edin.")

if __name__ == "__main__":
    main()
