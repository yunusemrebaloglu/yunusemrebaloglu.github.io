# Midnight Run

Vanilla JavaScript ve WebGL ile geliştirilmiş, neon gece atmosferinde tek oyunculu
3D sonsuz otoyol oyunu. Sunucu, derleme adımı, CDN veya harici model gerektirmez.
Araba modelleri ve şehir geometrisi kodla üretilir.

## Oynanış

- **APEX GT:** dengeli sürüş, 245 km/h.
- **PHANTOM R:** daha yüksek son hız, 290 km/h.
- **VORTEX S:** hızlı ivmelenme ve keskin direksiyon, 220 km/h.
- WASD veya ok tuşları: gaz, fren ve direksiyon.
- Shift veya boşluk: nitro. Nitro kullanılmadığında yeniden dolar.
- Escape veya P: duraklat / devam et.
- Mobil cihazlarda çoklu dokunmayı destekleyen ekran düğmeleri bulunur.
- Araç gaz verilmeden de hızlanır. Yol kenarı hızı düşürür.
- Her metre 2 puan, güvenli sollama 50 puan, yakın geçiş 150 puan kazandırır.
- Trafiğe çarpınca yarış biter. Rekor tarayıcının `localStorage` alanında saklanır.
- Ses isteğe bağlıdır ve kullanıcı etkinleştirdiğinde Web Audio ile üretilir.
- Sekme veya pencere odağı kaybolduğunda oyun otomatik duraklar.

Eski iki oyunculu 2D prototip, bu tek oyunculu sürümle değiştirilmiştir.
Eski PNG dosyaları bu sürümde kullanılmaz.

## Yerelde çalıştırma

ES modülleri nedeniyle sayfayı `file://` üzerinden değil, bir HTTP sunucusuyla aç:

```sh
python3 -m http.server 8080
```

Ardından `http://localhost:8080` adresini ziyaret et. Güncel, WebGL destekli
Chrome, Firefox veya Safari gerekir. WebGL kullanılamazsa açıklayıcı hata gösterilir.

## Testler

Node.js 18 veya üstü ile bağımlılık kurmadan:

```sh
node --test game-core.test.mjs
```

Testler araç özelliklerini, nitroyu, fren önceliğini, çarpışmaları, yakın geçiş
puanlarını, yol kenarını, kare hızından bağımsız fiziği ve zaman adımı sınırını kapsar.

## GitHub Pages

Bu dosyaları deponun varsayılan dalına gönder. GitHub'da **Settings → Pages →
Deploy from a branch** üzerinden ilgili dalı ve **/(root)** klasörünü seç.
Site `https://yunusemrebaloglu.github.io/` adresinde çalışır.
Tüm kaynak yolları göreli olduğundan alt klasörde yayınlama da desteklenir.
