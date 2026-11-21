# Zort (mobil)

zort.ing'in mobil uygulaması. Ana ekran bir araç menüsü; şu an tek araç **Pin Note**,
yenileri aynı menüye eklenecek (`src/app/index.tsx` içindeki `tools` listesi).

## Pin Note

Eklediğin her not ayrı bir bildirim olarak durur ve sen uygulamadan silene kadar
bildirimlerden kalkmaz.

- Başlık + açıklama (açıklama isteğe bağlı)
- Her not = ayrı bir bildirim; düzenlenince bildirim güncellenir, silinince kalkar
- Bildirime dokununca uygulama o notun düzenleme ekranında açılır
- Açık/koyu tema, Türkçe/İngilizce (telefon diline göre)
- Veriler yalnızca telefonda (SQLite); sunucu, hesap, internet yok

### "Kaldırılamaz bildirim" nasıl sağlanıyor

Hiçbir platform üçüncü parti uygulamalara gerçekten silinemeyen bildirim vermiyor. Bu yüzden
amaç, bildirim kaldırılsa bile not durduğu sürece **geri gelmesi**:

| Durum | Android | iOS |
|---|---|---|
| "Tümünü temizle" | Etkilemez (ongoing bildirim) | Bildirim geri gelir* |
| Tek tek kaydırma | Android 13 ve öncesi: kaydırılamaz. Android 14+: kaydırılabilir ama anında geri gelir | Anında geri gelir* |
| Telefon yeniden başlatma | Açılışta otomatik geri gelir | Uygulama açılınca geri gelir |
| Uygulama güncelleme | Otomatik geri gelir | Uygulama açılınca geri gelir |
| Uygulamayı açma | Eksik ne varsa tamamlanır | Eksik ne varsa tamamlanır |

\* iOS, kaydırılan bildirimi uygulamaya bildirir (`customDismissAction`) ve uygulamayı bunun
için arka planda uyandırır. Apple bunu her durumda garanti etmiyor; kaçan olursa uygulama
bir sonraki açılışta tamamlar.

Kullanıcının kendi kararı olan yollar her zaman açık: sistem ayarlarından uygulamanın
bildirimlerini kapatmak, Android'de uygulamayı "Durmaya zorla" ile kapatmak (sonraki
açılışa kadar bildirimler gelmez).

Bildirimler sessiz: ses çıkarmaz, ekranı açmaz, üstten düşmez (Android'de "düşük önem"
kanalı, iOS'ta "passive"). Geri gelen bir bildirim seni rahatsız etmez.

## Yapı

```
src/app/                   ekranlar (Expo Router)
  _layout.tsx              veritabanı, bildirim eşitleme, iOS'ta bildirime dokununca not açma
  index.tsx                Zort ana ekranı: araç menüsü
  pin-notes/
    _layout.tsx            Pin Note ekranlarının yığını
    index.tsx              not listesi
    [id].tsx               not ekleme/düzenleme (id = "new" yeni not)
src/lib/
  db.ts                    SQLite şeması ve sorgular
  notes-context.tsx        notlar + her değişiklikte bildirimleri eşitleme
  i18n.ts, theme.ts        metinler (tr/en), zort.ing ile aynı renkler
modules/pinned-notifications/   bildirimler için native modül
  android/  (Kotlin)       ongoing bildirim, kaydırılınca geri koyma, açılışta geri yükleme
  ios/      (Swift)        customDismissAction ile geri koyma, bildirime dokunma
  index.ts                 JS API: syncPinnedNotes, requestPermission, ...
plugins/with-short-cxx-dir.js   Windows'ta 260 karakter yol sınırını aşmak için derleme ayarı
scripts/make-icons.mjs     uygulama ikonlarını zort.ing logosundan üretir
```

Uygulama bildirimleri tek tek yönetmez; her değişiklikten sonra not listesinin tamamını native
modüle verir (`syncPinnedNotes`), modül de bildirimleri listeye eşitler. Native taraf listeyi
kendisi de saklar. Böylece kaydırma ve yeniden başlatma durumları React Native hiç
başlamadan, doğrudan Kotlin/Swift tarafında halledilir.

Bildirime dokununca açılan bağlantı: `zort://pin-notes/<not id>`.

## İkonlar

İkonlar zort.ing'in logosundan (`../zort.ing/public/favicon.svg`) üretilir. Logo değişirse:

```bash
npm run icons
```

`assets/` altına iOS ikonu, Android'in ön/arka plan ve tek renkli (temalı ikon) katmanları,
açılış ekranı görseli ve ana ekrandaki logo yazılır.

## Kurulum ve çalıştırma

Gerekenler: Node 20+, Android için JDK 17+ ve Android SDK.

```bash
npm install
npm run typecheck
```

### Android: telefona APK kurma

```bash
npx expo prebuild --platform android --clean
cd android
gradlew.bat assembleRelease
```

APK: `android/app/build/outputs/apk/release/app-release.apk`. Telefona at, kur
(bilinmeyen kaynaklara izin vermek gerekir). Telefonda **Zort** adıyla görünür.

Windows'taki 260 karakter yol sınırı `plugins/with-short-cxx-dir.js` ile aşılıyor (C++
derlemesi proje kökündeki `.cx` klasöründe yapılır); ek bir ayar gerekmez.

Release APK şu an Expo şablonundaki **debug anahtarıyla** imzalanıyor. Kendi kullanımın için
yeterli. Ancak anahtarı değiştirirsen, telefondaki uygulama yeni APK ile güncellenmez;
önce kaldırıp yeniden kurman gerekir (notlar da silinir). Kalıcı bir anahtar istersen
`keytool` ile bir keystore oluşturup `android/app/build.gradle` içindeki `signingConfigs`'e
ekle.

Geliştirme sırasında: `npx expo run:android` (emülatör veya USB ile bağlı telefon).

### iOS

iOS uygulaması yalnızca macOS + Xcode ile derlenebilir. Windows'tan iki yol var:

1. **EAS Build (bulut):** `npx eas-cli@latest build -p ios --profile personal`.
   Store dışı kurulum (ad hoc) için **ücretli Apple Developer hesabı** ($99/yıl) gerekir.
   iPhone'unu önce `npx eas-cli@latest device:create` ile kaydet.
2. **Bir Mac'te Xcode:** `npx expo run:ios --device`. Ücretsiz Apple ID ile de olur ama
   uygulama 7 günde bir yeniden yüklenmeli.

> iOS tarafı (Swift) bu makinede derlenemediği için henüz hiç derlenmedi ve cihazda
> denenmedi. İlk iOS derlemesinde küçük düzeltmeler gerekebilir. Android tarafı Android 17
> emülatöründe uçtan uca denendi: ekleme, düzenleme, silme, kaydırınca geri gelme,
> "Tümünü temizle", uygulama güncellemesi ve yeniden başlatma sonrası geri yükleme.

## Sınırlar

- Android bir uygulamanın aynı anda en fazla ~50 bildirim göstermesine izin verir; daha
  fazla notun bildirimleri görünmez.
- Yeni Android sürümleri (16+) aynı uygulamanın bildirimlerini 2 taneden itibaren tek bir
  grupta toplar. Her not yine ayrı bir bildirimdir: grup açılınca alt alta görünür, her
  biri ayrı ayrı açılır, kaydırılır ve geri gelir. Bu gruplamayı uygulama kapatamaz.
  Eski sürümlerde gruplama 4 bildirimden itibaren başlar.
