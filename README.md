# Zort (mobil)

zort.ing'in mobil uygulaması. Ana ekran bir araç menüsü; şu an tek araç **Pin Note**,
yenileri aynı menüye eklenecek (`src/app/index.tsx` içindeki `tools` listesi).

## Pin Note

İğnelediğin her not ayrı bir bildirim olarak durur ve iğnesini kaldırana (ya da silene) kadar
bildirimlerden kalkmaz.

- Başlık + açıklama (açıklama isteğe bağlı)
- Her not = ayrı bir bildirim; düzenlenince bildirim güncellenir, silinince kalkar
- **İğneli / iğnesiz:** yeni not varsayılan olarak iğneli. İğnesiz not uygulamada durur ama
  bildirimde görünmez. Listedeki iğne düğmesiyle düzenleme ekranına girmeden değiştirilir.
- **Zaman aralığı:** varsayılan "Her zaman". İşareti kaldırınca başlangıç ve bitiş seçilir;
  not yalnızca bu aralıkta bildirimde görünür (uygulama kapalıyken de). Liste, notun
  durumunu gösterir: "... tarihinde başlar", "... tarihine kadar", "... tarihinde bitti".
- **Bildirimdeki düğmeler:** bildirimi genişletince **İğneyi kaldır** ve **Sil**. Uygulama
  kapalıyken de çalışır (aşağıya bakın).
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
src/components/
  NoteCard.tsx             listedeki not: iğne düğmesi, durum satırı
  PinSettings.tsx          düzenleme ekranındaki iğne / Her zaman / başlangıç-bitiş bölümü
  DateTimeField.tsx        tarih+saat satırı (iOS: kompakt seçici, Android: sistem pencereleri)
src/lib/
  db.ts                    SQLite şeması (v2: pinned, pin_start, pin_end) ve sorgular
  notes-context.tsx        notlar, bildirimleri eşitleme, bildirim düğmelerinin kuyruğunu işleme
  pin-status.ts            iğne durumu (iğnesiz / her zaman / başlayacak / görünüyor / bitti)
  i18n.ts, theme.ts        metinler (tr/en), zort.ing ile aynı renkler
modules/pinned-notifications/   bildirimler için native modül
  android/  (Kotlin)       ongoing bildirim, kaydırılınca geri koyma, açılışta geri yükleme,
                           zaman aralığı (alarm + timeout), İğneyi kaldır / Sil düğmeleri
  ios/      (Swift)        customDismissAction ile geri koyma, bildirime dokunma,
                           zamanlanmış bildirim, İğneyi kaldır / Sil düğmeleri
  index.ts                 JS API: syncPinnedNotes, requestPermission, ...
plugins/with-short-cxx-dir.js   Windows'ta 260 karakter yol sınırını aşmak için derleme ayarı
scripts/make-icons.mjs     uygulama ikonlarını zort.ing logosundan üretir
```

Uygulama bildirimleri tek tek yönetmez; her değişiklikten sonra not listesinin tamamını native
modüle verir (`syncPinnedNotes`), modül de bildirimleri listeye eşitler. Native taraf listeyi
kendisi de saklar. Böylece kaydırma ve yeniden başlatma durumları React Native hiç
başlamadan, doğrudan Kotlin/Swift tarafında halledilir.

Bildirime dokununca açılan bağlantı: `zort://pin-notes/<not id>`.

### Zaman aralığı

Zamanlama native tarafta, uygulama kapalıyken de çalışır:

- **Android:** bitişi olan bildirim, sistemin kendi zaman aşımıyla (`setTimeoutAfter`) tam
  bitiş anında kalkar. Başlangıçlar için bir sonraki başlangıç/bitiş anına tek bir alarm
  kurulur. Alarmlar yeniden başlatma, güncelleme ve saat/saat dilimi değişikliğinde yeniden
  kurulur. Exact alarm izni Android 13'e kadar varsayılan olarak verilir; Android 14+ verilmez,
  o zaman alarm inexact olur ve başlangıç (telefon boşta beklerken) birkaç dakika gecikebilir.
  Emülatörde (Android 17) gecikme 1 dakikanın altındaydı.
- **iOS:** başlayacak not tetikleyiciyle (`UNTimeIntervalNotificationTrigger`) zamanlanır,
  iOS onu zamanında gösterir. Ama iOS, gösterilmiş bir bildirimi belirli bir saatte kaldırmaya
  izin vermez: süresi biten not uygulama bir sonraki açıldığında (ya da bildirim kaydırılınca,
  çünkü artık geri konmaz) kalkar.

### Bildirimdeki "İğneyi kaldır" ve "Sil"

Düğmeler native tarafta işlenir: bildirim hemen kalkar ve işlem bir kuyruğa yazılır.
Uygulama açıksa anında, kapalıysa bir sonraki açılışta kuyruğu okuyup notlar
veritabanına işler ve kuyruğu onaylar (`getPendingNoteActions` / `acknowledgeNoteActions`).
Onaylanana kadar native taraf bu notları eşitlemede yok sayar; böylece işlemden önce
okunmuş bir liste, iğnesi kaldırılmış notu geri getiremez.

Native taraf veritabanına doğrudan yazmaz: expo-sqlite kendi SQLite kopyasını getiriyor;
aynı dosyayı aynı süreçte sistemin SQLite'ıyla açmak WAL veritabanını bozabilir.

Sil düğmesi onay sormaz (bildirim düğmesinde onay penceresi yok).

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
> "Tümünü temizle", uygulama güncellemesi ve yeniden başlatma sonrası geri yükleme;
> listeden iğne kaldırma, bildirimdeki İğneyi kaldır / Sil (uygulama açıkken ve kapalıyken),
> zaman aralığının başlangıcı (uygulama kapalıyken) ve bitişi.

## Sınırlar

- Android 16+, bir uygulamanın grupsuz bildirimlerini 2 taneden itibaren tek bir kapalı
  grupta toplar (eski sürümlerde 4'ten itibaren). Bunu önlemek için her not kendi grubunda,
  kendi özet (summary) bildirimiyle gönderilir. Tek elemanlı grup sadece notun kendisi
  olarak çizildiği için özet görünmez ve her not bildirimlerde ayrı durur.
- Android bir uygulamanın aynı anda en fazla ~50 bildirim göstermesine izin verir. Her not
  özetiyle birlikte 2 bildirim tuttuğu için bu yaklaşık 25 not eder; fazlası görünmez.
