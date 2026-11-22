# Zort (mobil)

zort.ing'in mobil uygulaması. Ana ekran bir araç menüsü: **Pins**, **Notes**, **Links** ve
**Görevler** (Android'de ana ekran için **Hızlı ekle** ve **Görevler** widget'ları var); yenileri
aynı menüye eklenir (`src/app/index.tsx` içindeki `tools` listesi).

Dört listede de **favori** var: karttaki yıldızla (Links ve Notes'ta menüden de) işaretlenir,
favoriler listenin en üstünde durur; kendi aralarında ve geri kalanlarda listenin normal
sıralaması korunur (`src/lib/favorites.ts`, v5: her tabloda `favorite` sütunu). Favori yapmak
düzenleme sayılmaz, notun düzenleme tarihini değiştirmez. Pins'te sıra: favoriler, sonra
iğneliler, sonra iğnesizler (her grupta en yeni üstte).

Android'de `expo-symbols` ikonları içi boş Material Symbols fontuyla çiziyor. Favorinin dolu
yıldızı için dolu fonttan yalnızca yıldız glifi alınıp `assets/fonts/star-filled.ttf`'e
konuyor (1,6 KB; fontun tamamı 1,4 MB). Yeniden üretmek için: `npm run star-font`.

## Pins

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
- Kodda Pins'in `Note` tipiyle karışmasın diye `Memo` adıyla geçer (`memos` tablosu)

## Görevler

Yapılacaklar (kodda `tasks`, İngilizcede "Tasks").

- Başlık (zorunlu) + açıklama (isteğe bağlı) + **tarih ve saat** (isteğe bağlı) + **yineleme**
- **Liste gruplu:** Gecikmiş (önceki günler), Bugün, Yarın, Yaklaşan, Tarihsiz, Tamamlananlar.
  Her grupta favoriler üstte, sonra en yakın tarih. Bugün içinde saati geçmiş görev "Bugün"de
  kalır ama tarihi ve halkası kırmızıya döner. Gruplar gece yarısı ve her saat geçtiğinde kendiliğinden
  güncellenir.
- Karttaki halkaya dokununca tamamlanır; altta **Geri al** çıkar. Tamamlananlar katlanır, oradan
  geri alınabilir ya da **Temizle** ile silinir.
- Karta dokununca düzenleme ekranı açılır.

### Hatırlatma (Android)

- Tarihli her görevde **Hatırlatma:** Yok / Tam zamanında / 5, 15, 30 dk / 1 saat / 1 gün önce.
  Yeni görevlerde varsayılan "Tam zamanında" (widget'ın + penceresinden eklenenlerde de); hatırlatmadan
  önce eklenmiş görevlerde "Yok". Karttaki zil, görevin hatırlatması olduğunu gösterir.
- Zamanı gelince sesli, üstten düşen bir bildirim gelir ("Görev hatırlatmaları" kanalı): başlık,
  tarih, açıklama; **Tamamla** ve **10 dk ertele** düğmeleri. Bildirime dokununca görev açılır.
  Uygulama kapalıyken de, telefon yeniden başladıktan sonra da çalışır; kapalıyken kaçırılanlar
  açılışta gelir.
- Yinelenen görevde hatırlatma, görevin üzerinde olduğu tarih için gelir; tamamlanınca bir sonraki
  tarih için kurulur. Tamamlanmamış bir görev sonraki tekrarlarında yeniden hatırlatmaz.
- Görev tamamlanınca, silinince ya da daha sonraki bir saate alınınca gösterilen hatırlatması kalkar.
  Saati çoktan geçmiş bir hatırlatmayla kaydedilen görev hatırlatma göndermez.
- **İzinler:** hatırlatma ilk kurulduğunda bildirim izni istenir. Android 14+ tam zamanlı alarma
  varsayılan olarak izin vermiyor; izin yoksa hatırlatma (telefon boşta beklerken) birkaç dakika,
  emülatörde görüldüğü gibi 7 dakikaya kadar gecikebilir. Düzenleme ekranı bunu söyler ve **İzin ver**
  ile sistem ayarını açar; izin verilince alarmlar hemen tam zamanlı olarak yeniden kurulur.
- Alarm gibi tam ekran, susturulana kadar çalan bir hatırlatma bilerek yok: Android 14+'da tam
  ekran bildirim izni Play'de yalnızca alarm ve arama uygulamalarına veriliyor.
- Nasıl çalışıyor: `TaskReminders` (`modules/quick-add`) widget'ın görev listesini kullanır ve
  tüm görevler için tek bir alarm kurar (en yakın hatırlatma). Alarm çalınca son kontrolden bu
  yana zamanı gelen her hatırlatmayı gönderir; kontrol zamanı saklandığı için hiçbiri iki kez
  gitmez, alarm gecikse de kaybolmaz. **Tamamla**, widget'taki halka ile aynı yoldan geçer
  (dokunuş zamanı kuyruğa yazılır, uygulama aynı sonucu kendine uygular).
- iOS'ta yok (modül yalnızca Android).

### Yineleme

- **Her X gün / hafta / ay / yıl** (X: 1–99). Haftalıkta **şu günlerde**: haftanın 7 gününden
  istenenler (en az biri seçili kalır; sıra dile göre, Türkçede Pazartesi başta).
- **Başlangıç:** yalnızca gün. Aylık ve yıllık kurallar başlangıcın tarihini tutar; ayın 31'i kısa
  aylarda ayın son günü, 29 Şubat artık olmayan yıllarda 28 Şubat olur. "2 haftada bir" başlangıcın
  bulunduğu haftadan (Pazartesi–Pazar) sayılır.
- **Bitiş:** Hiçbir zaman / Şu tarihte (o gün dahil) / Şu kadar tekrardan sonra (ilki dahil, 1–999).
- Yinelenen görevde düzenleme ekranındaki alan yalnızca **saat**tir; günleri kural belirler.
  Ekranda "Sıradaki: …" ile görevin hangi gün çıkacağı görünür. Kural hiç gerçekleşmeyecekse
  (bitiş geçmişte, ya da başlangıçtan önce) kaydedilmez.
- Yinelenen görev **tek satırdır**: tamamlanınca bir sonraki tarihine geçer, seri bitince
  tamamlanmış olur. Geride kalmış bir görev (3 gün yapılmamış günlük görev) tamamlanınca kaçırılan
  günler sıraya dizilmez, bugün ya da sonraki ilk güne geçer. Başlangıcı geçmişte olan yeni bir
  seri de bugünden başlar. Tekrar sayısı her zaman başlangıçtan sayılır.
- Kuralı değiştirmeden düzenlemek (başlık, saat) görevi bulunduğu tekrarda bırakır; kuralı
  değiştirmek seriyi bugünden yeniden hesaplar.
- Mantık saf TypeScript'tir ve testlidir: `src/lib/recurrence.ts` (kural hangi günlere düşer),
  `src/lib/task-logic.ts` (zamanlama, tamamlama, gruplama). Günler yerel takvimle hesaplanır
  (24 saat eklenmez), yaz saati geçişlerinde saat kaymaz; testler bu yüzden yaz saati olan bir
  dilimde çalışır (`jest.global-setup.js`).

## Widget: Görevler (Android)

4×4 widget: üstte logo, "Görevler" ve sayılar ("4 görev · 1 gecikmiş"), sağda **+**; altında
yapılacak görevler, en yakın tarihli üstte, tarihsizler sonda. Boyutu değiştirilebilir.

- **Halkaya dokununca** görev tamamlanır ve widget'tan kalkar; yinelenen görev sıradaki tarihine
  geçer. Uygulama açık olmasa da çalışır.
- **Göreve dokununca** uygulamada o görevin düzenleme ekranı açılır; başlığa dokununca Görevler listesi.
- **+** ana ekranın üstünde küçük bir **Yeni görev** penceresi açar: başlık, açıklama ve tarih
  (Tarih yok / Bugün / Yarın / Tarih seç) ile saat. Yineleme için **Uygulamada aç**: yazılan ve
  seçilenle dolu düzenleme ekranı açılır (`zort://tasks/new?title=…&due=…`).
- Geciken görevin halkası ve tarihi kırmızı, bugünün tarihi mavi. Açık/koyu tema telefonu izler.
- Widget gece yarısı ve bir görevin saati geldiğinde (gecikti olarak işaretlemek için) kendini
  yeniler; saat, saat dilimi ve dil değişince de. Bu yenileme tek bir inexact alarmla yapılır, izin
  istemez, birkaç dakika gecikebilir.

Nasıl çalışıyor:

- Liste uygulamadan native tarafa gönderilir (`syncTasksWidget`, her değişiklikte); widget onu
  React Native'i başlatmadan çizer (`TaskStore`, `TasksWidgetProvider`, `TasksWidgetService`).
- Widget'tan tamamlama veritabanına doğrudan yazılmaz (aynı nedenle: Pins'teki "İğneyi kaldır"
  gibi). Native taraf görevi kendi listesinde ilerletir ve dokunuşun **zamanını** kuyruğa yazar;
  uygulama açıkken hemen, değilse sonraki açılışta `completeTask` aynı zamanla uygulanır, böylece
  sonuç widget'ın gösterdiğiyle aynı olur. Yinelenen görevin sonraki 30 tekrarı listeyle gelir;
  widget'tan bundan fazla tamamlanırsa görev uygulama açılana kadar widget'ta görünmez.
- Satır dokunuşları görünmez bir Activity'den geçer (`TaskWidgetActionActivity`): widget listesinde
  tüm satırlar için tek bir tıklama şablonu var ve uygulamayı açmak bir Activity başlatmayı gerektirir;
  yeni Android sürümleri bunu bir broadcast receiver'dan engelliyor.
- Widget'taki renkler düzende sabit, görünürlükle seçilir: kodda çözülseler uygulamanın kendi tema
  ayarını izlerlerdi, ana ekranınkini değil.
- Kodu Hızlı ekle ile aynı modülde (`modules/quick-add`): **+** aynı pencereyi (`QuickAddActivity`)
  `type: "task"` ile açar.

## Widget: Hızlı ekle (Android)

Ana ekrana eklenen widget'ta her eklenebilen şey için bir düğme var: **Pins**, **Not**,
**Link** (ana menüdeki sırayla). 4×1, hücrenin ortasında ince bir şerit; daraltılınca yalnızca ikonlar kalır (Android 12+).
Renkler uygulamanınki, açık/koyu temayı telefona göre izler.

Bir düğmeye dokununca uygulama açılmaz: ana ekranın üstünde alttan küçük bir **Hızlı ekle**
penceresi kayar. Tür orada değiştirilebilir; girilen değer o türün zorunlu alanını doldurur:

| Tür | Değer | Sonuç |
|---|---|---|
| Pins | başlık | iğneli, "Her zaman"; bildirim hemen çıkar |
| Not | başlık | açıklamasız not |
| Link | web adresi (Links'teki gibi doğrulanır) | başlıksız link |

Altta yan yana iki düğme var:

- **Ekle:** kaydeder; pencere kapanır ve "Linklere eklendi" gibi bir sistem bildirimi (toast)
  görünür.
- **Uygulamada aç:** alan boşsa seçili türün listesini açar. Bir şey yazıldıysa o türün yeni
  kayıt ekranını yazılanla dolu açar (`zort://pin-notes/new?title=…`, `zort://links/new?url=…`),
  açıklama, zaman aralığı ya da link başlığı da eklenip kaydedilir. Vazgeçilince altta liste
  durur.

Nasıl çalışıyor:

- Widget klasik bir AppWidget (`modules/quick-add`, RemoteViews). `expo-widgets` Android'de
  bir düğmeden belirli bir pencere açmayı desteklemiyor ve Compose bağımlılıkları getiriyordu.
- Pencere ayrı, saydam bir Activity (`QuickAddActivity`): uygulamanın React Native'ini
  paylaşır ve `index.ts`'de kayıtlı ikinci kök bileşen `QuickAdd`'i (`src/quick-add`) çizer.
  Yani veritabanı, doğrulama ve bildirim eşitleme uygulamadakiyle aynı kod. Kendi görevinde
  açılır, "Son kullanılanlar"da görünmez; kapanınca nerede kaldıysan oraya dönersin.
- Uygulama arka planda açıksa onun listeleri de hemen yenilenir (`src/lib/data-events.ts`);
  yoksa eski listeyle bildirimleri eşitleyip yeni notu kaldırabilirdi.
- iOS'ta widget yok (WidgetKit uzantısı ayrı bir hedef ister).

## Google ile giriş ve yedek

Ana sayfanın altındaki **Google Drive yedeği** satırı → Yedekleme ekranı. Kullanıcı yalnızca
"Google ile giriş yap"a basar; başka ayar yoktur.

- **Nereye:** kullanıcının Drive'ındaki uygulamaya özel gizli klasör (`appDataFolder`, izin
  `drive.appdata`): Zort kullanıcının hiçbir dosyasını göremez, yedek de Drive'da dosya olarak
  görünmez. Tek dosya: `zort-backup.json`, dört tablonun bütün satırları (tema hariç).
- **Ne zaman:** her değişiklikten 3 sn sonra; uygulama arka plana geçerken hemen (orada
  zamanlayıcılar durur). Widget'tan eklenenler de dahil. "Yedeklenmedi" bilgisi cihazda saklanır,
  uygulama kapanırsa sonraki açılışta tamamlanır. Bağlantı yoksa bir sonraki değişiklikte ya da
  açılışta yeniden dener.
- **Girişte:** Drive'da yedek yoksa cihazdaki veri ilk yedek olur. Yedek varsa ve cihaz boşsa
  (format, yeni telefon, yeniden kurulum) kendiliğinden geri yüklenir. İkisinde de veri varsa
  hangisinin kalacağı sorulur; seçilene kadar hiçbir şeyin üstüne yazılmaz.
- **Geri yükleme** cihazdaki dört tablonun yerine geçer (tek işlemde, yarım kalmaz); listeler ve
  Pins bildirimleri yeniden okunur.
- **Çıkış:** veriler cihazda ve Drive'da kalır. "Drive'daki yedeği sil" yedeği silip çıkış yapar.
- Tek cihaz için tasarlandı: iki cihaz aynı anda kullanılırsa son yedekleyen kazanır.

### Dosyaya yedek

Yedekleme ekranının **Dosya** bölümü, Drive'a alternatif (ya da ek) olarak verinin tamamını tek bir
dosyaya aktarır; hesap gerekmez.

- **Dosyaya kaydet:** sistemin "Farklı kaydet" ekranı açılır, ad hazır gelir
  (`zort-yedek-2026-11-22-1530.json`); İndirilenler, hafıza kartı ya da bir bulut sürücünün klasörü
  seçilebilir, ad değiştirilebilir. Klasör seçici (`ACTION_OPEN_DOCUMENT_TREE`) değil
  `ACTION_CREATE_DOCUMENT` kullanılır: Android 11+ klasör seçicide İndirilenler'e izin vermiyor.
  expo-file-system bunu sunmadığı için küçük bir native modül var (`modules/save-file`).
- **Paylaş:** dosya paylaşım menüsüyle bir uygulamaya gönderilir (e-posta, mesajlaşma, Drive…).
  Dosya önbellekte bir klasöre yazılır, bir sonraki paylaşımda silinir.
- **Dosyadan geri yükle:** dosya seçilir, içeriği denetlenir; dosyadaki ve telefondaki sayılar
  gösterilip onay istenir. Telefondaki dört tablonun yerine tek işlemde geçer; hemen ardından
  **Geri al** çıkar (öncesi bellekte tutulur). Pins bildirimleri, widget'lar ve listeler yenilenir;
  Drive'a giriş yapılmışsa geri yüklenen veri Drive'a da yedeklenir.
- Dosya Drive yedeğiyle aynı JSON'dur (`backup-format.ts`): eski sürümün dosyası yeni uygulamada
  açılır, yeni sürümün dosyası eski uygulamada "Zort'u güncelle" der, Zort yedeği olmayan ya da
  bozuk dosya (en fazla 20 MB) hiçbir şeye dokunmadan reddedilir.
- Son dosya yedeğinin tarihi saklanır ve ekranda görünür; Drive kapalıyken ana ekrandaki satır da
  onu gösterir ("Drive kapalı · Son dosya: …"). Paylaşım bu tarihi değiştirmez (gönderilip
  gönderilmediği bilinemez).
- iOS'ta "Dosyaya kaydet" yok (paylaşım menüsünün "Dosyalara Kaydet"i aynı işi görür).

### Yedek ve uygulama güncellemeleri

Cihazdaki veri güncellemede hiç kaybolmaz: veritabanı şeması sürümlü (`DATABASE_VERSION`,
`src/lib/db.ts`), her değişiklik ilk açılışta sırayla çalışan bir geçiş adımıdır. Drive yedeği
de sürümlerle uyumlu kalacak şekilde kurulu (`src/lib/backup-format.ts`):

- Yedek, onu alan uygulamanın şema sürümünü taşır; dosyada ve Drive meta verisinde
  (`appProperties.schema`).
- **Eski yedek, yeni uygulamada:** yedekte olmayan tablo (yedek o araçtan önce alınmış)
  geri yüklemede cihazda olduğu gibi kalır; yedekte olmayan sütun varsayılan değerini alır;
  uygulamanın artık bilmediği tablo ve sütunlar yok sayılır. Yeniden adlandırma gibi
  varsayılanla çözülmeyen değişiklikler için `UPGRADES`'e o şema sürümünün adımı eklenir.
- **Yeni yedek, eski uygulamada:** geri yüklenmez ve üstüne yazılmaz ("Zort'u güncelle"); yoksa
  eski sürüm, bilmediği verileri yedekten düşürürdü.
- Geri yükleme tek işlemdir: bir satır bile yazılamazsa hiçbir şey değişmez.

**Yeni bir araç (menü) eklerken:** `db.ts`'de tabloyu yeni bir geçiş adımıyla oluştur ve
`DATABASE_VERSION`'ı artır, sonra tablonun adını `backup-format.ts`'deki `BACKUP_TABLES`'a ekle.
Yeni sütunlar `DEFAULT` ile eklenmeli. Testler (`npm test`) eski/yeni yedek kurallarını ve
gerçek bir veritabanında yedek → geri yükleme gidiş-dönüşünü sınar.

Kurulum (bir kez, uygulama sahibi): Google Cloud projesi `Zort`, Drive API açık, OAuth izin
ekranı **In production** ("Testing"de izin 7 günde bir düşer), kapsam `drive.appdata`
(hassas değil, inceleme gerekmez). İstemciler:

- Android `Zort debug` ve `Zort release`: paket `ing.zort.mobile`, SHA-1'ler "İmza anahtarı"
  tablosunda; Play'e çıkınca Play'in uygulama imzalama anahtarı için bir tane daha
- Web `Zort web`: Client ID'si `src/lib/google-auth.ts`'de (gizli değil)

Kütüphane `@react-native-google-signin/google-signin` (ücretsiz "Original" API). Config plugin'i
eklenmedi: Android'de gerekmiyor, plugin de seçeneksiz Firebase dosyası bekliyor. iOS'a geçince
bir iOS istemcisi oluşturup plugin'i `iosUrlScheme` ile ekle. `DEVELOPER_ERROR` (kod 10) = bu
derlemenin SHA-1'i Google Cloud'da yok.

## Yapı

```
src/app/                   ekranlar (Expo Router)
  _layout.tsx              veritabanı, bildirim eşitleme, iOS'ta bildirime dokununca not açma
  index.tsx                Zort ana ekranı: araç menüsü
  pin-notes/
    _layout.tsx            Pins ekranlarının yığını
    index.tsx              not listesi
    [id].tsx               not ekleme/düzenleme (id = "new" yeni not)
  links/
    index.tsx              link listesi, dokununca açılan menü
    [id].tsx               link ekleme/düzenleme
  tasks/
    index.tsx              görev listesi (gruplu), tamamlama ve Geri al
    [id].tsx               görev ekleme/düzenleme: tarih-saat, yineleme
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
  tasks-db.ts, tasks-context.tsx   görevler (v6: tasks tablosu), widget eşitleme ve kuyruğu
  recurrence.ts            yineleme kuralları: hangi günler (saf, testli)
  task-logic.ts            zamanlama, tamamlama, gruplama, widget'a giden görev (saf, testli)
  task-format.ts           görev tarihleri ve kuralların metni
  clipboard.ts             kopyalama (Android 13+ kendi onayını gösterdiği için mesajı atlar)
  data-events.ts           uygulama ve Hızlı ekle penceresi arasında "veri değişti" sinyali
  backup.ts                Drive yedeği: ne zaman yedeklenir, giriş/geri yükleme akışı
  backup-data.ts           yedeğin içeriği (anlık görüntü al, geri yükle)
  backup-format.ts         yedek dosyasının biçimi; eski/yeni sürüm kuralları, BACKUP_TABLES
  backup-file.ts           dosyaya yedek: Farklı kaydet, paylaş, dosyadan okuma
  __tests__/               yedek biçimi ve gerçek veritabanıyla geri yükleme testleri
src/test-utils/            testler için Node SQLite üzerinde expo-sqlite benzeri veritabanı
  drive.ts, google-auth.ts Drive REST çağrıları; Google ile giriş ve erişim jetonu
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
modules/save-file/         yalnızca Android: sistemin "Farklı kaydet" ekranıyla dosya kaydetme
modules/quick-add/         yalnızca Android: Hızlı ekle ve Görevler widget'ları, açtıkları pencere
src/quick-add/             pencerelerin React tarafı (QuickAddRoot, QuickAddFrame, QuickAddSheet,
                           TaskQuickAddSheet)
index.ts                   giriş: expo-router + "QuickAdd" kök bileşeni
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
npm test        # Jest (jest-expo); veritabanı testleri Node'un kendi SQLite'ıyla çalışır,
                # tarih testleri America/New_York diliminde (yaz saati geçişleri için)
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

Prebuild `--no-clean` ile çalışır: IntelliJ açıkken `android/` klasörü kilitlendiği için
klasörü silip yeniden kuramıyor. Bir plugin ya da native kütüphane **kaldırıldığında** bir kez
IDE kapalıyken `npx expo prebuild --platform android --clean` çalıştır.

### İmza anahtarı

Release derlemeleri (APK ve AAB) Zort'un kendi **yükleme anahtarıyla** imzalanır
(`plugins/with-release-signing.js`). Anahtar ve şifresi projede değil:

- anahtar: `C:\Users\mehme\.zort\zort-upload.jks` (alias `zort-upload`)
- şifreler: `~/.gradle/gradle.properties` içindeki `ZORT_UPLOAD_*` satırları

**İkisini de güvenli bir yere yedekle** (parola yöneticisi, şifreli bulut). Anahtar
kaybolursa telefondaki uygulama bir daha güncellenemez; Play'de de yükleme anahtarı ancak
Google'a başvurarak sıfırlanır. Anahtar yoksa (başka bir bilgisayar) derleme yine çalışır ama
debug anahtarıyla imzalanır ve Gradle uyarır.

| Anahtar | SHA-1 | Nerede kullanılır |
|---|---|---|
| debug (`android/app/debug.keystore`) | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` | `expo run:android`, emülatör |
| yükleme (`zort-upload.jks`) | `67:12:1F:81:F1:10:E7:81:2B:8B:D7:AC:64:AD:97:40:DA:72:67:AD` | `build:apk`, `build:aab` |

Google girişi bu parmak izleriyle çalışır: Google Cloud'daki Android OAuth istemcileri bunları
içermeli (aşağıda "Google ile giriş ve yedek").

### Google Play'e hazırlık

- `npm run build:aab` → `android/app/build/outputs/bundle/release/app-release.aab`
  (arm64-v8a + x86_64). Play'e APK değil bu yüklenir.
- Her yüklemede `app.json`'daki `android.versionCode` bir artmalı; `version` kullanıcıya
  görünen sürüm.
- Paket adı `ing.zort.mobile` (iOS bundle ID de aynı) Play'de kalıcıdır, sonradan değişmez.
- Play App Signing açıkken Google uygulamayı kendi **uygulama imzalama anahtarıyla** yeniden
  imzalar: Play Console → Test ve yayınla → Kurulum → Uygulama bütünlüğü'ndeki o SHA-1'i de
  Google Cloud'a üçüncü bir Android istemcisi olarak ekle, yoksa Play'den kurulan uygulamada
  Google girişi `DEVELOPER_ERROR` verir.
- Android'in otomatik yedeği kapalı (`allowBackup: false`): asıl yedek Google Drive; günlük
  sistem yedeği eski bir veritabanını sessizce geri yükleyip onunla çakışabilirdi.
- Google hesabı verisi kullanıldığı için Play bir gizlilik politikası adresi ve "Veri
  güvenliği" formu ister (ne saklandığı: notlar, linkler; nerede: kullanıcının kendi Drive'ı).

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
