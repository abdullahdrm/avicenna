import requests
import json
import os

# 1. API Adresimiz: FastAPI sunucusunun çalıştığı adres.
# (Sunucuyu terminalden uvicorn app.main:app komutuyla başlattığınızda genellikle localhost:8000 olur)
URL = "http://127.0.0.1:8000/analyze"

# 2. Resminizin Yolu: "test_et.py" dosyası ile aynı klasörde "ornek_resim.jpg" adında bir resim olması beklenir.
# Eğer resmin adı farklıysa buradaki 'ornek_resim.jpg' yazısını değiştirin.
RESIM_YOLU = "ornek_resim.jpg"

def main():
    if not os.path.exists(RESIM_YOLU):
        print(f"HATA: '{RESIM_YOLU}' bulunamadı!")
        print(f"Lütfen test etmek istediğiniz resmi '{RESIM_YOLU}' adıyla bu dosyayla aynı yere kopyalayın.")
        return

    print("1. Sunucuya İstek Hazırlanıyor...")
    
    # 3. Veritabanından geliyormuş gibi taklit ettiğimiz Dummy Veri
    data = {
        "patient_info": "Hasta 24 yaşında, yüzünde ve boynunda kızarık akneler var. Daha önce krem denemiş ama işe yaramamış."
    }

    # 4. Resmi dosyadan okuyoruz
    try:
        with open(RESIM_YOLU, "rb") as f:
            files = {
                "file": ("ornek_resim.jpg", f, "image/jpeg")
            }

            print("2. İstek API'ye Gönderiliyor (Tahmin süresi modelin performansına göre birkaç saniye sürebilir)...")
            response = requests.post(URL, data=data, files=files)
            
            # API'den gelen statü kodunu kontrol edelim (200 Başarılı demektir)
            if response.status_code == 200:
                json_cevap = response.json()
                print("\n✅ API'DEN GELEN 1. BAŞARILI CEVAP (/analyze):\n")
                print(json.dumps(json_cevap, indent=4, ensure_ascii=False))
                
                # Gemini Tarafından Üretilen Uzun Raporu Al
                gemini_report = json_cevap.get("gemini_analysis", "")
                
                if gemini_report:
                    print("\n3. Sınıflandırma İçin /gemini_only_class Endpoint'ine İstek Gönderiliyor...")
                    class_data = {"report": gemini_report}
                    class_url = "http://127.0.0.1:8000/gemini_only_class"
                    class_response = requests.post(class_url, json=class_data)
                    
                    if class_response.status_code == 200:
                        class_json = class_response.json()
                        print("\n✅ API'DEN GELEN 2. BAŞARILI CEVAP (/gemini_only_class):\n")
                        print(json.dumps(class_json, indent=4, ensure_ascii=False))
                    else:
                        print(f"❌ HATA! Sınıflandırma API'si {class_response.status_code} kodu döndü.")
                else:
                    print("Uyarı: 'gemini_analysis' alanı boş geldiği için sınıflandırma yapılamadı.")

            else:
                print(f"❌ HATA! API {response.status_code} kodu döndü.")
                print(response.text)

    except Exception as e:
        print(f"Beklenmeyen bir hata oluştu: {e}")
        print("Lütfen FastAPI sunucusunun (uvicorn) arka planda çalışıp çalışmadığını kontrol edin.")

if __name__ == "__main__":
    main()
