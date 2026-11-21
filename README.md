# Zort (mobil)

zort.ing'in mobil uygulaması. Ana ekran bir araç menüsü: **Pin Note**, **Links** ve **Notes**; yenileri
aynı menüye eklenir (`src/app/index.tsx` içindeki `tools` listesi).

Üç listede de **favori** var: karttaki yıldızla (Links ve Notes'ta menüden de) işaretlenir,
favoriler listenin en üstünde durur; kendi aralarında ve geri kalanlarda listenin normal
sıralaması korunur (`src/lib/favorites.ts`, v5: her tabloda `favorite` sütunu). Favori yapmak
düzenleme sayılmaz, notun düzenleme tarihini değiştirmez. Pin Note'ta sıra: favoriler, sonra
iğneliler, sonra iğnesizler (her grupta en yeni üstte).

Android'de `expo-symbols` ikonları içi boş Material Symbols fontuyla çiziyor. Favorinin dolu
yıldızı için dolu fonttan yalnızca yıldız glifi alınıp `assets/fonts/star-filled.ttf`'e
konuyor (1,6 KB; fontun tamamı 1,4 MB). Yeniden üretmek için: `npm run star-font`.

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

## Links

Kaydettiğin linkler.

- Adres + isteğe bağlı başlık. `example.com/a` gibi yazılabilir, `https://` eklenir; web adresi
  olmayan şeyler kaydedilmez. Başlık yoksa listede sitenin adresi gösterilir.
- **Dokununca** (ya da basılı tutunca) küçük bir menü: **Aç** (varsayılan tarayıcıda),
  **Gizli sekmede aç**, **Linki kopyala**, Düzenle, Sil.
- Site ikonu (favicon) yok, yerine sitenin baş harfi: ikon için her linki üçüncü bir servise
  sormak gerekirdi.

### Gizli sekmede aç

Android'de bir uygulamanın linki "varsayılan tarayıcının gizli sekmesinde" açmasının genel bir
yolu yok; Chrome'un kendi Incognito ayarını yalnızca Google'ın uygulamalarından kabul ediyor.
Üçüncü parti uygulamalar için resmî yol **Ephemeral Custom Tab** (Chrome 136+,
`androidx.browser` 1.9+): varsayılan tarayıcıda açılan bir sekme; geçmiş, çerezler, önbellek
ve oturumlar yalnızca o sekmede yaşar ve sekme kapanınca silinir. Chrome'un menüsünde
"Open in Incognito Chrome" seçeneğiyle normal gizli sekmeye de geçilebilir.

- Seçenek yalnızca **varsayılan tarayıcı bunu destekliyorsa** görünür (`modules/link-opener`,
  `CustomTabsClient.isEphemeralBrowsingSupported`); uygulama her öne geldiğinde yeniden bakılır.
  Desteklemeyen bir tarayıcıda (ya da varsayılan tarayıcı seçilmemişse) menüde hiç çıkmaz.
- **iOS'ta yok:** Safari'nin ya da başka bir tarayıcının gizli sekmesini açmanın yolu yok.

## Notes

Bildirimlere girmeyen, yalnızca uygulamada duran notlar.

- Başlık (zorunlu) + açıklama (isteğe bağlı, 10.000 karaktere kadar)
- **Dokununca** (ya da basılı tutunca) menü: **Notu kopyala** (başlık, boş satır, açıklama),
  Düzenle, Sil
- Liste son düzenlenene göre sıralı; kartta düzenleme tarihi görünür
- Kodda Pin Note'un `Note` tipiyle karışmasın diye `Memo` adıyla geçer (`memos` tablosu)

## Yapı

```
src/app/                   ekranlar (Expo Router)
  _layout.tsx              veritabanı, bildirim eşitleme, iOS'ta bildirime dokununca not açma
  index.tsx                Zort ana ekranı: araç menüsü
  pin-notes/
    _layout.tsx            Pin Note ekranlarının yığını
    index.tsx              not listesi
    [id].tsx               not ekleme/düzenleme (id = "new" yeni not)
  links/
    index.tsx              link listesi, dokununca açılan menü
    [id].tsx               link ekleme/düzenleme
  notes/
    index.tsx              not listesi (Notes), dokununca açılan menü
    [id].tsx               not ekleme/düzenleme
src/components/
  NoteCard.tsx             listedeki not: iğne düğmesi, durum satırı
  PinSettings.tsx          düzenleme ekranındaki iğne / Her zaman / başlangıç-bitiş bölümü
  DateTimeField.tsx        tarih+saat satırı (iOS: kompakt seçici, Android: sistem pencereleri)
  ModalHeader.tsx          düzenleme ekranlarının Vazgeç / başlık / Kaydet çubuğu
  ActionSheet.tsx          alttan açılan küçük eylem menüsü
  LinkCard.tsx, MemoCard.tsx   listedeki link / not
  Toast.tsx                "Link kopyalandı" gibi kısa mesaj
src/lib/
  db.ts                    SQLite şeması (v2: pinned, pin_start, pin_end) ve sorgular
  notes-context.tsx        notlar, bildirimleri eşitleme, bildirim düğmelerinin kuyruğunu işleme
  pin-status.ts            iğne durumu (iğnesiz / her zaman / başlayacak / görünüyor / bitti)
  links-db.ts, links-context.tsx   linkler (v3: links tablosu)
  memos-db.ts, memos-context.tsx   Notes sayfasının notları (v4: memos tablosu)
  clipboard.ts             kopyalama (Android 13+ kendi onayını gösterdiği için mesajı atlar)
  url.ts                   elle yazılan adresi düzeltme ve doğrulama
  open-link.ts             tarayıcıda / gizli sekmede açma
  i18n.ts, theme.ts        metinler (tr/en), zort.ing ile aynı renkler
modules/pinned-notifications/   bildirimler için native modül
  android/  (Kotlin)       ongoing bildirim, kaydırılınca geri koyma, açılışta geri yükleme,
                           zaman aralığı (alarm + timeout), İğneyi kaldır / Sil düğmeleri
  ios/      (Swift)        customDismissAction ile geri koyma, bildirime dokunma,
                           zamanlanmış bildirim, İğneyi kaldır / Sil düğmeleri
  index.ts                 JS API: syncPinnedNotes, requestPermission, ...
modules/link-opener/       yalnızca Android: varsayılan tarayıcıda gizli (ephemeral) sekme
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
npm run build:apk
```

(`ANDROID_HOME` ve `JAVA_HOME` tanımlı olmalı.) APK:
`android/app/build/outputs/apk/release/app-release.apk`. Telefona at, kur (bilinmeyen
kaynaklara izin vermek gerekir). Telefonda **Zort** adıyla görünür.

Komut APK'yı yalnızca 64-bit ARM (`arm64-v8a`, son yılların tüm telefonları) için derler ve
Gradle'a daha fazla bellek verir (varsayılan 512 MB metaspace R8 adımında yetmiyor). Windows'taki
260 karakter yol sınırını uygulamanın C++ derlemesi için `plugins/with-short-cxx-dir.js` aşıyor;
ancak Reanimated'in kendi derlemesi 32-bit ARM'de (`armeabi-v7a`) sınırı yine aşıyor. Bu yüzden
o mimari derlenmiyor.

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
> zaman aralığının başlangıcı (uygulama kapalıyken) ve bitişi; Links: ekleme, doğrulama,
> açma, gizli sekmede açma (Chrome 149), kopyalama, silme.

## Sınırlar

- Android 16+, bir uygulamanın grupsuz bildirimlerini 2 taneden itibaren tek bir kapalı
  grupta toplar (eski sürümlerde 4'ten itibaren). Bunu önlemek için her not kendi grubunda,
  kendi özet (summary) bildirimiyle gönderilir. Tek elemanlı grup sadece notun kendisi
  olarak çizildiği için özet görünmez ve her not bildirimlerde ayrı durur.
- Android bir uygulamanın aynı anda en fazla ~50 bildirim göstermesine izin verir. Her not
  özetiyle birlikte 2 bildirim tuttuğu için bu yaklaşık 25 not eder; fazlası görünmez.
