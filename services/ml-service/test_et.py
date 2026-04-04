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
                print("\n✅ API'DEN GELEN BAŞARILI CEVAP:\n")
                
                # Çıktıyı güzel ve okunaklı yazdırmak için json.dumps kullanıyoruz
                print(json.dumps(json_cevap, indent=4, ensure_ascii=False))
            else:
                print(f"❌ HATA! API {response.status_code} kodu döndü.")
                print(response.text)

    except Exception as e:
        print(f"Beklenmeyen bir hata oluştu: {e}")
        print("Lütfen FastAPI sunucusunun (uvicorn) arka planda çalışıp çalışmadığını kontrol edin.")

if __name__ == "__main__":
    main()
