# SPESIFIKASI TEKNIS \& PRODUK: GEO-METADATA EDITOR (ALTERNATIF MODERN CATMDEDIT)

## 1\. Konteks \& Tujuan Utama Proyek

Bangun aplikasi web modern bernama **GeoMeta Editor** sebagai pengganti aplikasi desktop lawas **CatMDEdit** untuk membuat, memperkaya, dan memvalidasi metadata geospasial sesuai standar **SNI ISO 19115 (ProMSI - Profil Metadata Spasial Indonesia)** dengan format pertukaran XML **ISO/TS 19139:2007 (`gmd:MD\_Metadata`)**.

### Masalah Utama yang Harus Diselesaikan:

1. **UX CatMDEdit Tidak Ramah Pengguna Awam:** CatMDEdit menampilkan *tree-view* XSD mentah berbahasa Inggris di mana elemen wajib (seperti `Contact` -> `CI\_ResponsibleParty`) tersembunyi hingga diklik manual. Aplikasi ini harus mengubahnya menjadi **Multi-Step Form Wizard Berbahasa Indonesia** dengan kolom yang langsung terbuka siap isi, dilengkapi penjelasan kontekstual dan contoh pengisian.
2. **Konflik Metadata GeoNode vs GeoNetwork (CSW Harvesting):**

   * Setiap dataset spasial yang diunggah ke **GeoNode** otomatis menghasilkan file `.xml` bawaan (berisi UUID, Bounding Box, Thumbnail, serta tautan unduhan WMS/WFS/ZIP/GeoJSON otomatis pada `<gmd:distributionInfo>`).
   * Namun, form internal GeoNode hanya mendukung sebagian kecil elemen ISO 19115. Jika pengguna membuat XML baru dari nol di aplikasi luar lalu mengunggahnya ke GeoNode dengan mode `metadata\_uploaded\_preserve = true`, maka tautan unduhan otomatis bawaan GeoNode akan hilang/tertimpa. Sebaliknya, jika `metadata\_uploaded\_preserve = false`, elemen lengkap ISO 19115 terpotong oleh database GeoNode dan gagal dipanen (*auto-harvested*) secara utuh oleh **GeoNetwork**.
3. **Solusi Inti Arsitektur — *Non-Destructive DOM-Based XML Patching*:**
Aplikasi ini **TIDAK BOLEH** menghapus struktur XML asli dari GeoNode lalu menulis ulang seluruh XML dari nol ketika mengedit metadata eksisting. Aplikasi harus membaca DOM XML asli GeoNode, mempertahankan seluruh *namespace*, UUID, *Bounding Box*, `graphicOverview`, dan daftar `<gmd:onLine>` bawaan GeoNode secara utuh, lalu hanya **menyisipkan/memperbarui (patch)** elemen-elemen ISO 19115 sesuai urutan sekuens XSD ISO/TS 19139 yang valid.

\---

## 2\. Tech Stack \& Arsitektur Sistem

* **Framework:** Next.js (App Router) + TypeScript (Strict Mode).
* **Styling \& Komponen UI:** Tailwind CSS + shadcn/ui + Lucide Icons.
* **State \& Validasi Form:** `react-hook-form` + `zod` (pesan validasi 100% Bahasa Indonesia).
* **Pemrosesan XML:** `@xmldom/xmldom` dan `xpath` (atau pembungkus `DOMParser` \& `XMLSerializer` yang *namespace-aware* dan konsisten di browser maupun Node.js untuk pengujian unit). **Dilarang menggunakan konverter JSON-ke-XML generik yang merusak urutan tag atau kehilangan atribut namespace/nilReason.**
* **Penyimpanan Lokal (Client-Side):**

  * `localStorage`: Hanya untuk menyimpan draf metadata sementara (auto-save) dan **Buku Kontak / Preset Profil Instansi** (`CI\_ResponsibleParty`) yang sering dipakai berulang.
  * `sessionStorage` (atau React Memory State): Opsional untuk menyimpan sementara URL GeoNode selama tab aktif. **Dilarang keras menyimpan password di `localStorage` atau database.**
* **Database:** Tanpa database (*100% Stateless*).

\---

## 3\. Alur Kerja Pengguna (User Workflow)

### A. 3 Mode Input Awal (Halaman Beranda / Inisialisasi)

1. **Tarik dari URL Dataset GeoNode (Utama):**

   * Pengguna menempelkan URL halaman dataset GeoNode (contoh: `https://geoportal.contoh.go.id/datasets/geonode:batas\_desa` atau `/catalogue/#/dataset/12345`) atau langsung UUID dataset.
   * Backend Next.js (`/api/geonode/fetch`) mengekstrak nama layer/PK/UUID, mencari metadata melalui REST API v2 GeoNode (`/api/v2/datasets/`) dan/atau endpoint CSW publik GeoNode (`/catalogue/csw?service=CSW\&version=2.0.2\&request=GetRecordById\&Id={uuid}\&ElementSetName=full\&outputSchema=http://www.isotc211.org/2005/gmd`).
   * Jika dataset bersifat privat/draft, pengguna dapat menyertakan kredensial GeoNode satu kali (*Stateless Basic Auth*).
   * XML asli disimpan sebagai `baseXmlDocument` di state aplikasi, dan seluruh nilai yang sudah ada diekstrak ke dalam Form.
2. **Unggah File `.xml` Lokal:**

   * Kotak *drag-and-drop* untuk membuka file `.xml` standar ISO 19139 (baik hasil unduhan GeoNode, GeoNetwork, maupun CatMDEdit lama).
3. **Buat Baru dari Template Kosong (SNI ISO 19115):**

   * Memuat kerangka dasar (`skeleton`) XML ISO/TS 19139:2007 yang valid, otomatis mengisi `fileIdentifier` (UUID v4 baru), `dateStamp` (tanggal hari ini `YYYY-MM-DD`), `language` (`ind`), `characterSet` (`utf8`), `hierarchyLevel` (`dataset`), dan `metadataStandardName` (`ISO 19115:2003/19139` atau `SNI ISO 19115`).

### B. 2 Mode Output / Penyimpanan

1. **Unduh File `.xml` (Default \& Tanpa Login):**

   * Mengekspor XML hasil *patching* yang sudah tervalidasi urutannya dengan nama file `{layer\_name\_atau\_uuid}\_metadata.xml`.
   * Menampilkan panduan singkat cara unggah manual ke GeoNode (mengingatkan pengguna untuk mencentang *Metadata Uploaded Preserve* pada pengaturan dataset GeoNode agar 13 elemen tetap utuh saat dipanen GeoNetwork).
2. **Simpan Langsung ke GeoNode (*Stateless Passthrough Auth*):**

   * Tersedia jika sesi dimulai dari URL GeoNode (atau pengguna memasukkan URL \& PK dataset target).
   * Membuka modal konfirmasi berisi input:

     * `Base URL GeoNode` \& `Dataset ID (PK)` (terisi otomatis dari tahap Fetch).
     * `Username GeoNode` \& `Password GeoNode` (input bertipe password, tidak pernah disimpan permanen).
     * Checkbox (aktif secara default): **"Pertahankan metadata lengkap untuk CSW/GeoNetwork (`metadata\_uploaded\_preserve: true`)"**.
   * Mengirim request melalui Next.js API Proxy (`/api/geonode/push`) yang meneruskan autentikasi ke GeoNode REST API v2.

\---

## 4\. Spesifikasi Keamanan Aplikasi (Wajib Diterapkan)

Karena menggunakan pendekatan *Stateless Passthrough Proxy*, terapkan lapisan keamanan berikut pada Next.js API Routes (`/api/geonode/\*`):

1. **Proteksi SSRF (Server-Side Request Forgery):**

   * Sediakan variabel environment `ALLOWED\_GEONODE\_HOSTS` (daftar domain dipisahkan koma, contoh: `geoportal.kaltimprov.go.id,demo.geonode.org`). Jika variabel ini diisi, tolak semua URL tujuan yang `hostname`-nya tidak ada di dalam daftar putih.
   * Blokir secara mutlak protokol selain `https:` (kecuali `http://localhost` hanya saat `NODE\_ENV === 'development'`) serta blokir semua IP privat/loopback/link-local (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`).
2. **Zero Credential Persistence \& Redaksi Log:**

   * Kredensial hanya boleh dikirim via body/header HTTPS POST (dilarang menaruh username/password di URL query string).
   * Dilarang melakukan `console.log` terhadap header `Authorization` atau objek body yang memuat password. Hapus referensi kredensial segera setelah request ke upstream GeoNode selesai.
   * Tambahkan header `Cache-Control: no-store, no-cache, must-revalidate` pada semua response `/api/geonode/\*`.
3. **Proteksi XXE (XML External Entity) \& Batas Ukuran:**

   * Batasi ukuran maksimal payload XML sebesar **5 MB**.
   * Tolak dokumen XML yang mengandung deklarasi `<!DOCTYPE` atau `<!ENTITY` sebelum diproses oleh parser XML untuk mencegah serangan XXE dan *Billion Laughs*.
4. **Rate Limiting Sederhana:**

   * Terapkan pembatasan request berbasis IP di memori pada endpoint `/api/geonode/push` (misal maksimal 20 request per menit per IP) untuk mencegah penyalahgunaan *brute-force* ke server GeoNode tujuan.

\---

## 5\. Aturan Teknis XML ISO/TS 19139 \& Kompatibilitas GeoNode + GeoNetwork

### A. Deklarasi Namespace Standar pada `<gmd:MD\_Metadata>`

Pastikan elemen akar memiliki deklarasi namespace berikut (dan pertahankan namespace ekstra yang sudah ada pada XML asli GeoNode, termasuk variasi `gml` `http://www.opengis.net/gml` maupun `http://www.opengis.net/gml/3.2` sesuai dokumen sumbernya):

* `xmlns:gmd="http://www.isotc211.org/2005/gmd"`
* `xmlns:gco="http://www.isotc211.org/2005/gco"`
* `xmlns:gmx="http://www.isotc211.org/2005/gmx"`
* `xmlns:gml="http://www.opengis.net/gml"` (jika membuat baru, gunakan URI yang sama dengan standar `pycsw` GeoNode; jika melakukan *patch*, deteksi dan gunakan URI `gml` yang sudah dideklarasikan di root dokumen asli!)
* `xmlns:xlink="http://www.w3.org/1999/xlink"`
* `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`

### B. Format Penulisan Codelist (Kompatibel Ganda: `OWSLib` GeoNode \& XSD GeoNetwork)

Setiap elemen Codelist wajib menyertakan atribut `codeList`, `codeListValue` (dalam nilai standar bahasa Inggris ISO), DAN teks di dalam tag yang sama persis dengan `codeListValue`:

```xml
<gmd:role>
  <gmd:CI\_RoleCode
    codeList="\[http://standards.iso.org/ittf/PubliclyAvailableStandards/ISO\_19139\_Schemas/resources/codelist/ML\_gmxCodelists.xml#CI\_RoleCode](http://standards.iso.org/ittf/PubliclyAvailableStandards/ISO\_19139\_Schemas/resources/codelist/ML\_gmxCodelists.xml#CI\_RoleCode)"
    codeListValue="pointOfContact">pointOfContact</gmd:CI\_RoleCode>
</gmd:role>
```

### C. Penanganan Elemen Kosong

* Untuk elemen *Optional* yang tidak diisi pengguna dan belum ada di XML asli: **jangan buat tag kosong**, biarkan bersih.
* Untuk sub-elemen yang secara skema XSD diwajibkan ada di dalam blok induk yang sedang aktif namun nilainya belum diketahui, gunakan atribut `gco:nilReason="missing"`.

### D. Urutan Sekuens XSD Ketat (`xs:sequence` Canonical Order) — SANGAT KRITIS!

Validator XSD GeoNetwork akan menolak XML jika urutan anak elemen terbalik. Buat fungsi helper `insertInCanonicalOrder(parentNode, newNode, sequenceList)` menggunakan daftar urutan resmi berikut:

**1. Urutan Anak Langsung `<gmd:MD\_Metadata>`:**

1. `gmd:fileIdentifier`
2. `gmd:language`
3. `gmd:characterSet`
4. `gmd:parentIdentifier`
5. `gmd:hierarchyLevel`
6. `gmd:hierarchyLevelName`
7. `gmd:contact`
8. `gmd:dateStamp`
9. `gmd:metadataStandardName`
10. `gmd:metadataStandardVersion`
11. `gmd:dataSetURI`
12. `gmd:locale`
13. `gmd:spatialRepresentationInfo`
14. `gmd:referenceSystemInfo`
15. `gmd:metadataExtensionInfo`
16. `gmd:identificationInfo`
17. `gmd:contentInfo`
18. `gmd:distributionInfo`
19. `gmd:dataQualityInfo`
20. `gmd:portrayalCatalogueInfo`
21. `gmd:metadataConstraints`
22. `gmd:applicationSchemaInfo`
23. `gmd:metadataMaintenance`

**2. Urutan Anak Langsung `<gmd:MD\_DataIdentification>`:**

1. `gmd:citation`
2. `gmd:abstract`
3. `gmd:purpose`
4. `gmd:credit`
5. `gmd:status`
6. `gmd:pointOfContact`
7. `gmd:resourceMaintenance`
8. `gmd:graphicOverview` *(Wajib dipertahankan dari XML GeoNode agar thumbnail tidak hilang!)*
9. `gmd:resourceFormat`
10. `gmd:descriptiveKeywords`
11. `gmd:resourceSpecificUsage`
12. `gmd:resourceConstraints`
13. `gmd:aggregationInfo`
14. `gmd:spatialRepresentationType`
15. `gmd:spatialResolution`
16. `gmd:language`
17. `gmd:characterSet`
18. `gmd:topicCategory`
19. `gmd:environmentDescription`
20. `gmd:extent`
21. `gmd:supplementalInformation`

**3. Urutan Anak Langsung `<gmd:CI\_ResponsibleParty>`:**

1. `gmd:individualName`
2. `gmd:organisationName`
3. `gmd:positionName`
4. `gmd:contactInfo` (Urutan di dalam `gmd:CI\_Contact`: `phone` -> `address` -> `onlineResource` -> `hoursOfService` -> `contactInstructions`; urutan di dalam `gmd:CI\_Address`: `deliveryPoint` -> `city` -> `administrativeArea` -> `postalCode` -> `country` -> `electronicMailAddress`)
5. `gmd:role`

\---

### E. Aturan Khusus Penanganan Quirks XML Riil GeoNode (`pycsw 3.0`)

Berdasarkan sampel XML produksi GeoNode (`pycsw 3.0-dev`), mesin XML (`src/lib/xml-engine/`) WAJIB menerapkan aturan normalisasi berikut baik pada jalur URL Fetch maupun Upload File Lokal:



**1. Unwrapping `<csw:GetRecordByIdResponse>` \& Namespace Hoisting:**

* File `.xml` unduhan manual dari GeoNode sering masih terbungkus elemen akar `<csw:GetRecordByIdResponse>` di mana seluruh deklarasi `xmlns:\*` berada pada tag `<csw:GetRecordByIdResponse>`, bukan pada `<gmd:MD\_Metadata>`.
* Saat memuat XML (baik dari file lokal maupun CSW), jika elemen akar adalah `GetRecordByIdResponse`, ekstrak node `<gmd:MD\_Metadata>` dan \*\*salin (hoist) seluruh atribut `xmlns:\*` yang relevan (`xmlns:gmd`, `xmlns:gco`, `xmlns:gml`, `xmlns:gml32`, `xmlns:gmx`, `xmlns:xlink`, `xmlns:xsi`)\*\* ke elemen `<gmd:MD\_Metadata>`.
* Saat mengekspor/menyimpan XML, elemen akar \*\*WAJIB `<gmd:MD\_Metadata>`\*\* (tanpa bungkus `<csw:GetRecordByIdResponse>`), dan `xsi:schemaLocation` pada `<gmd:MD\_Metadata>` mengacu ke `http://www.isotc211.org/2005/gmd http://www.isotc211.org/2005/gmd/gmd.xsd`.



**2. Pembersihan Nilai Placeholder Bawaan GeoNode (Sentinel Strings):**

* Saat membaca XML ke state Form (`parseIso19139ToForm`), konversi nilai string placeholder bawaan GeoNode berikut menjadi string kosong `""` di UI agar tidak dianggap sudah terisi oleh validator kelengkapan:

&#x20;    - `"None"` (kecuali di dalam `<gmd:graphicOverview>` yang dikunci)

&#x20;    - `"No abstract provided"`

&#x20;    - `"No information provided"`

&#x20;    - `"Not Specified: The original author did not specify a license."`



**3. Normalisasi Codelist Non-Standar \& Pembersihan Constraint Cacat:**

&#x20;  - Petakan nilai `CI\_RoleCode` non-standar bawaan GeoNode saat impor dan simpan kembali dalam format camelCase resmi ISO 19115:

&#x20;    - `"Metadata Author"` -> `"author"`

&#x20;    - `"Point of Contact"` -> `"pointOfContact"`

&#x20;    - Pertahankan format atribut `codeSpace="ISOTC211/19115"` dan URL `codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#..."` agar seragam dengan struktur asli `pycsw`.

&#x20;  - Abaikan/bersihkan blok `<gmd:resourceConstraints>` duplikat bawaan GeoNode yang memiliki `codeListValue=""` kosong dan `otherConstraints` bernilai `"None"`.

&#x20;  - Untuk `<gmd:topicCategory>`, perhatikan bahwa `<gmd:MD\_TopicCategoryCode>` dalam XSD ISO 19139 adalah `xs:enumeration` biasa (tanpa atribut `codeList`/`codeListValue`), contoh: `<gmd:topicCategory><gmd:MD\_TopicCategoryCode>inlandWaters</gmd:MD\_TopicCategoryCode></gmd:topicCategory>`. Hapus atribut `gco:nilReason="missing"` pada `<gmd:topicCategory>` ketika pengguna telah memilih minimal satu kategori topik.

&#x20;  - Jika terdapat tag kosong `<gmd:spatialRepresentationInfo/>` di XML asli: isi di dalam node tersebut jika pengguna melengkapi Langkah 3, atau hapus tag kosong tersebut saat ekspor jika tidak diisi agar tidak melanggar validasi XSD.



4\. \*\*Dukungan Variasi Tipe Data `pycsw`:\*\*

&#x20;  - Parser tanggal harus mampu membaca baik `<gco:Date>` maupun `<gco:DateTime>` (format ISO-8601 `YYYY-MM-DDTHH:mm:ssZ`).

&#x20;  - Parser boolean (`<gco:Boolean>`) harus mengenali `"0"`/`"false"` sebagai `false` dan `"1"`/`"true"` sebagai `true`, serta menuliskannya kembali sebagai `"true"` atau `"false"` standar XSD.

&#x20;  - Pertahankan `<gmd:contentInfo>` eksisting dari GeoNode (khususnya atribut `uuidref` dan `xlink:href` pada `<gmd:featureCatalogueCitation>`) ketika pengguna tidak menggantinya secara eksplisit.



5\. \*\*Auto-Deteksi Metadata Server dari File XML Lokal:\*\*

&#x20;  - Saat pengguna mengunggah file `.xml` lokal, ekstrak otomatis informasi koneksi GeoNode jika tersedia di dalam XML:

&#x20;    - `baseUrl` \& `pk` dataset dari pola URL di `<gmd:featureCatalogueCitation xlink:href=".../dataset/{pk}/feature\_catalogue"/>` atau domain di `<gmd:onLine>`.

&#x20;    - `uuid` dari `<gmd:fileIdentifier>`.

&#x20;    - `typename` dari `<gmd:alternateTitle>` (misal `geonode:nama\_layer`).

&#x20;  - Dengan demikian, pengguna yang memulai dari file `.xml` lokal tetap bisa menggunakan fitur \*\*Simpan Langsung ke GeoNode\*\* tanpa perlu mencari angka PK dataset secara manual.



## 6\. Cakupan 13 Elemen Metadata \& Struktur Wizard UI (5 Langkah)

Seluruh antarmuka menggunakan Bahasa Indonesia yang mudah dipahami staf non-teknis. Setiap kolom input wajib memiliki:

* **Label Bahasa Indonesia** + nama teknis kecil di sampingnya dalam warna redup jika mode teknis diaktifkan.
* **Badge Kewajiban:** `Wajib` (Merah), `Bersyarat` (Kuning, lengkap dengan penjelasan syaratnya), atau `Opsional` (Hijau).
* **Tooltip / Teks Bantuan Kontekstual** dalam Bahasa Indonesia sehari-hari + *placeholder* contoh nyata instansi di Indonesia.
* **Global Filter Toggle di Header:** Switch **"Mode Ringkas (Isian Wajib \& Utama)"** vs **"Mode Lengkap (Seluruh 13 Elemen)"** agar pemula tidak kewalahan, namun pengguna tingkat lanjut tetap bisa mengakses ke-13 elemen secara penuh.

Catatan Cakupan: Aplikasi mencakup 13 elemen metadata dataset berikut (elemen ke-13 pada standar penuh yaitu *Informasi Metadata Layanan / SV\_ServiceIdentification* sengaja dikecualikan karena fokus pada dataset spasial):

1. Informasi Metadata (`MD\_Metadata`)
2. Informasi Identifikasi (`MD\_IdentificationInformation`)
3. Informasi Batasan (`MD\_Constraints`)
4. Informasi Garis Silsilah (`LI\_Lineage` — secara XSD ditempatkan di dalam `DQ\_DataQuality`)
5. Informasi Pemeliharaan (`MD\_MaintenanceInformation`)
6. Informasi Representasi Spasial (`MD\_SpatialRepresentation`)
7. Informasi Sistem Referensi (`MD\_ReferenceSystem`)
8. Informasi Konten (`MD\_ContentInformation`)
9. Informasi Katalog Portrayal (`MD\_PortrayalCatalogueReference`)
10. Informasi Distribusi (`MD\_Distribution`)
11. Informasi Ekstensi Metadata (`MD\_MetadataExtensionInformation`)
12. Informasi Skema Aplikasi (`MD\_ApplicationSchemaInformation`)
13. Kualitas Data (`DQ\_DataQuality`)

Kelompokkan ke-13 elemen tersebut ke dalam **5 Langkah (Tab Wizard)** berikut:

### Langkah 1: Informasi Dasar \& Kontak Metadata

*Mencakup: (1) Informasi Metadata (`MD\_Metadata`)*

* **Identitas Metadata:**

  * `fileIdentifier` (Wajib): Otomatis terisi dari XML GeoNode (dikunci dengan tombol "Buka Kunci" jika darurat) atau tombol *Generate UUID* jika buat baru.
  * `dateStamp` (Wajib): Tanggal pembuatan/pembaruan metadata (otomatis hari ini, bisa diubah).
  * `language` (Bersyarat): Dropdown (`ind` - Bahasa Indonesia \[Default], `eng` - Bahasa Inggris).
  * `characterSet` (Bersyarat): Default `utf8`.
  * `hierarchyLevel` (Bersyarat): Default `dataset` (pilihan lain: `series`, `featureType`).
  * `hierarchyLevelName` (Bersyarat): Default `"dataset"`.
  * `parentIdentifier` (Opsional): UUID metadata induk jika merupakan bagian dari seri peta.
  * `dataSetURI` (Opsional): URI unik dataset (otomatis dipertahankan dari GeoNode jika ada).
  * `metadataStandardName` \& `metadataStandardVersion` (Opsional, terisi default `ISO 19115:2003/19139` \& `1.0`).
* **Kontak Penanggung Jawab Metadata (`gmd:contact` -> `CI\_ResponsibleParty`) \[Wajib, Bisa >1]:**

  * **PENTING:** Langsung tampilkan seluruh kolom input terbuka dalam komponen Kartu Kontak (tanpa harus klik Edit untuk memunculkan cabang seperti di CatMDEdit!):

    * Nama Individu (`individualName` - Bersyarat: minimal salah satu dari Nama Individu, Instansi, atau Jabatan wajib diisi)
    * Nama Instansi / Unit Kerja (`organisationName` - disarankan Wajib secara UI)
    * Jabatan (`positionName`)
    * Nomor Telepon (`voice`) \& Faksimili (`facsimile` - opsional)
    * Alamat Jalan (`deliveryPoint`), Kota/Kabupaten (`city`), Provinsi (`administrativeArea`), Kode Pos (`postalCode`), Negara (`country`, default `Indonesia`), Email (`electronicMailAddress`)
    * Situs Web Instansi (`onlineResource` -> `linkage`)
    * Peran (`role` -> `CI\_RoleCode` - Wajib, default `pointOfContact` / Narahubung).
  * **Fitur Buku Kontak Lokal:** Tombol **"Simpan sebagai Preset Kontak"** dan dropdown **"Isi Cepat dari Preset Tersimpan"** (tersimpan di `localStorage`) agar pengguna tidak perlu mengetik ulang alamat instansi berulang kali.

### Langkah 2: Identifikasi Data, Pemeliharaan \& Batasan

*Mencakup: (2) Informasi Identifikasi (`MD\_IdentificationInformation`), (5) Informasi Pemeliharaan (`MD\_MaintenanceInformation`), (3) Informasi Batasan (`MD\_Constraints`)*

* **Sitasi \& Deskripsi Utama (`citation`, `abstract`, `purpose`, `status`):**

  * Judul Dataset (`title` - Wajib).
  * Judul Alternatif (`alternateTitle` - Opsional).
  * Tanggal Referensi Dataset (`date` + `dateType`: Pembuatan/`creation`, Publikasi/`publication`, atau Revisi/`revision` - Wajib minimal 1).
  * Edisi (`edition` - Opsional) \& Bentuk Penyajian (`presentationForm`, misal `mapDigital` / Peta Digital).
  * Abstrak / Ringkasan Isi Data (`abstract` - Wajib, textarea dengan penghitung karakter \& panduan menulis abstrak yang baik).
  * Tujuan Pembuatan Data (`purpose` - Opsional namun tampil di Mode Ringkas).
  * Kredit / Sumber Pendanaan (`credit` - Opsional).
  * Status Kemajuan Data (`status` -> `MD\_ProgressCode`: Selesai/`completed`, Pembaruan Berkala/`onGoing`, Dalam Perencanaan/`planned`, Diarsipkan/`historicalArchive`, Perlu Pembaruan/`underDevelopment`).
* **Kategori \& Kata Kunci:**

  * Kategori Topik ISO (`topicCategory` - Wajib untuk dataset, multi-select dengan terjemahan Bahasa Indonesia untuk ke-19 kode ISO seperti Batas Wilayah/`boundaries`, Perencanaan \& Kadaster/`planningCadastre`, Transportasi/`transportation`, Perairan Darat/`inlandWaters`, Pertanian/`farming`, Lingkungan/`environment`, Kesehatan/`health`, Citra \& Peta Dasar/`imageryBaseMapsEarthCover`, Utilitas \& Komunikasi/`utilitiesCommunication`, dll.).
  * Kata Kunci (`descriptiveKeywords` - tag input interaktif, otomatis dikelompokkan dalam `MD\_Keywords`, tanpa menghapus blok keyword thesaurus bawaan GeoNode jika ada).
* **Kontak Produsen / Pemilik Data (`pointOfContact` -> `CI\_ResponsibleParty`):**

  * Gunakan komponen Kartu Kontak yang sama + tombol pintas **"Samakan dengan Kontak Metadata di Langkah 1"**.
* **Cakupan Wilayah \& Waktu (`extent` -> `EX\_Extent`):**

  * Batas Koordinat Geografis (`EX\_GeographicBoundingBox` - Wajib: Barat/`westBoundLongitude`, Timur/`eastBoundLongitude`, Selatan/`southBoundLatitude`, Utara/`northBoundLatitude` dalam derajat desimal, validasi rentang `-180..180` dan `-90..90`). Otomatis terisi dari XML GeoNode. Sediakan juga preset cepat koordinat wilayah Indonesia \& tombol opsional untuk ekstrak otomatis *Bounding Box* dari file `.geojson` lokal di browser.
  * Cakupan Waktu Data (`EX\_TemporalExtent` - Opsional: Tanggal Mulai \& Tanggal Akhir keberlakuan data).
* **Informasi Pemeliharaan (`resourceMaintenance` -> `MD\_MaintenanceInformation`):**

  * Frekuensi Pembaruan (`maintenanceAndUpdateFrequency` -> `MD\_MaintenanceFrequencyCode`: Tahunan/`annually`, Semesteran/`biannually`, Triwulanan/`quarterly`, Bulanan/`monthly`, Sesuai Kebutuhan/`asNeeded`, Tidak Terjadwal/`irregular`, Tidak Diperbarui/`notPlanned`, Berkelanjutan/`continual`).
  * Tanggal Pembaruan Berikutnya (`dateOfNextUpdate` - Opsional) \& Catatan Pemeliharaan (`maintenanceNote` - Opsional, serta opsi menerapkan ke `metadataMaintenance`).
* **Informasi Batasan (`resourceConstraints` \& `metadataConstraints` -> `MD\_Constraints` / `MD\_LegalConstraints` / `MD\_SecurityConstraints`):**

  * Batasan Penggunaan Umum (`useLimitation` - teks bebas, misal: *"Wajib mencantumkan sumber data dalam setiap publikasi"*).
  * Batasan Akses Hukum (`accessConstraints` -> `MD\_RestrictionCode`, misal Lisensi/`license`, Hak Cipta/`copyright`, Batasan Lainnya/`otherRestrictions`).
  * Batasan Penggunaan Hukum (`useConstraints` -> `MD\_RestrictionCode`).
  * Keterangan Batasan Lainnya (`otherConstraints` - Bersyarat: **wajib muncul dan diisi otomatis/manual apabila `accessConstraints` atau `useConstraints` bernilai `otherRestrictions`** — ini syarat validasi INSPIRE/GeoNetwork yang sangat sering menyebabkan error!).
  * Klasifikasi Keamanan (`MD\_SecurityConstraints` -> `classification`: Terbuka/`unclassified`, Terbatas/`restricted`, Rahasia/`confidential`, Sangat Rahasia/`secret`).

### Langkah 3: Karakteristik Spasial, Sistem Referensi \& Konten

*Mencakup: (6) Informasi Representasi Spasial (`MD\_SpatialRepresentation`), (7) Informasi Sistem Referensi (`MD\_ReferenceSystem`), (8) Informasi Konten (`MD\_ContentInformation`)*

* **Tipe \& Resolusi Spasial (pada `MD\_DataIdentification` \& `MD\_SpatialRepresentation`):**

  * Tipe Representasi Spasial (`spatialRepresentationType`: Vektor/`vector`, Grid-Raster/`grid`, Tabel Teks/`textTable`, TIN/`tin`).
  * Resolusi Spasial (`spatialResolution`): Pilihan input **Skala Peta** (`equivalentScale` -> penyebut skala seperti `25000` untuk 1:25.000, dilengkapi preset `1:5.000`, `1:25.000`, `1:50.000`, `1:250.000`) ATAU **Jarak Resolusi Tanah** (`distance` dalam satuan `meter`, untuk data raster/citra).
  * Detail `gmd:spatialRepresentationInfo`:

    * Jika Vektor (`MD\_VectorSpatialRepresentation`): Level Topologi (`topologyLevel`, default `geometryOnly`) dan Tipe Objek Geometri (`geometricObjectType`: Titik/`point`, Garis/`curve`, Poligon/`surface`, Kompleks/`complex`) beserta perkiraan jumlah fitur (`geometricObjectCount` - opsional).
    * Jika Grid/Raster (`MD\_GridSpatialRepresentation`): Jumlah Dimensi (`numberOfDimensions`, default `2`), Ukuran Baris \& Kolom (`dimensionName`: `row` \& `column`, `dimensionSize`), serta Geometri Sel (`cellGeometry`: `area` atau `point`).
* **Sistem Referensi Koordinat (`gmd:referenceSystemInfo` -> `MD\_ReferenceSystem`):**

  * Dropdown Preset Cepat + Input Kustom untuk Kode Sistem Referensi (`code`) \& Otoritas (`codeSpace`, default `EPSG`):

    * `EPSG:4326` — WGS 84 (Geografis)
    * `EPSG:9489` — SRGI 2013 (Geografis Nasional Indonesia)
    * `EPSG:32749` s/d `EPSG:32754` \& `EPSG:32646` s/d `EPSG:32654` — Zona UTM Wilayah Indonesia (WGS 84)
    * `EPSG:9478` s/d `EPSG:9488` — Zona UTM Wilayah Indonesia (SRGI 2013)
    * `EPSG:3857` — WGS 84 / Pseudo-Mercator
* **Informasi Konten (`gmd:contentInfo` -> `MD\_ContentInformation`):**

  * Mode Vektor (`MD\_FeatureCatalogueDescription`): Nama Fitur/Unsur (misal kode/nama unsur KUGI), Bahasa, apakah katalog fitur disertakan bersama dataset (`includedWithDataset`), dan Sitasi Dokumen Katalog Unsur (`featureCatalogueCitation`: Judul \& Tanggal). Sediakan juga bagian opsional daftar atribut tabel sederhana yang dapat dikonversi ke ringkasan katalog atau `supplementalInformation`.
  * Mode Raster (`MD\_CoverageDescription`): Deskripsi Atribut Piksel (`attributeDescription`) \& Tipe Konten (`contentType`: Citra/`image`, Klasifikasi Tematik/`thematicClassification`, Pengukuran Fisik/`physicalMeasurement`).

### Langkah 4: Kualitas Data, Garis Silsilah (Lineage) \& Distribusi

*Mencakup: (13) Kualitas Data (`DQ\_DataQuality`), (4) Informasi Garis Silsilah (`LI\_Lineage`), (10) Informasi Distribusi (`MD\_Distribution`)*

* **Kualitas Data \& Silsilah (`gmd:dataQualityInfo` -> `DQ\_DataQuality`):**

  * Cakupan Kualitas (`scope` -> `MD\_ScopeCode`, default `dataset`).
  * **Uraian Garis Silsilah / Riwayat Pengolahan Data (`lineage` -> `LI\_Lineage` -> `statement`) \[Sangat Penting \& Tampil Utama]:** Textarea luas dengan panduan Bahasa Indonesia untuk menjelaskan asal-usul sumber data dasar, tahun survei/citra, metode pengolahan, dan proses verifikasi hingga dataset terbentuk (nilai ini juga dibaca langsung oleh `OWSLib` GeoNode!).
  * Tahapan Proses Detail (`LI\_ProcessStep` - Opsional, *repeatable*): Deskripsi langkah teknis \& tanggal proses.
  * Sumber Data Dasar (`LI\_Source` - Opsional, *repeatable*): Deskripsi sumber peta/citra acuan \& skala sumber.
  * Laporan Kualitas Kuantitatif/Konseptual (`report` - Opsional): Konsistensi Topologi/Domain (`DQ\_DomainConsistency` -> `DQ\_ConformanceResult`: nama spesifikasi acuan, penjelasan, dan status Lulus/`pass` boolean) serta Akurasi Posisi (`DQ\_AbsoluteExternalPositionalAccuracy`).
* **Informasi Distribusi (`gmd:distributionInfo` -> `MD\_Distribution`):**

  * Format Distribusi (`distributionFormat` -> `MD\_Format`: Nama format seperti `ESRI Shapefile`, `GeoJSON`, `GeoPackage`, `GeoTIFF`, `WMS` beserta `version` misal `1.0`).
  * **Panel Proteksi Tautan Bawaan GeoNode (`transferOptions` -> `MD\_DigitalTransferOptions` -> `onLine`):**

    * Tampilkan seluruh `<gmd:onLine>` yang terdeteksi dari XML asli GeoNode di dalam kotak bertanda **"Tautan Otomatis GeoNode (Terkunci \& Aman)"** lengkap dengan badge protokolnya (`OGC:WMS`, `OGC:WFS`, `WWW:DOWNLOAD-1.0-http--download`, dll.).
    * Secara default, tautan ini **tidak boleh dihapus atau diubah** saat menyimpan XML agar link unduhan di GeoNode \& GeoNetwork tetap berfungsi. Sediakan switch kecil *"Buka Kunci Edit Manual"* hanya untuk pengguna ahli.
    * Sediakan tombol **"+ Tambah Tautan Eksternal Tambahan"** untuk menyisipkan node `<gmd:onLine>` baru (URL, Protokol, Nama Tautan, Deskripsi, Fungsi seperti Unduhan/`download` atau Informasi/`information`) di bawah tautan bawaan GeoNode.

### Langkah 5: Metadata Lanjutan (Opsional) \& Pratinjau XML

*Mencakup: (9) Informasi Katalog Portrayal (`MD\_PortrayalCatalogueReference`), (11) Informasi Ekstensi Metadata (`MD\_MetadataExtensionInformation`), (12) Informasi Skema Aplikasi (`MD\_ApplicationSchemaInformation`)*

* Tiga bagian *Accordion* rapi yang terlipat secara default (namun langsung terbuka jika XML yang diimpor sudah memiliki data pada bagian tersebut):

  1. **Katalog Portrayal / Aturan Simbolisasi Peta (`MD\_PortrayalCatalogueReference`):** Judul acuan simbolisasi (misal: *"Standar Simbolisasi Peta Rupa Bumi / KUGI BIG"*), Tanggal publikasi acuan, dan URL file SLD/dokumen aturan simbol.
  2. **Skema Aplikasi (`MD\_ApplicationSchemaInformation`):** Judul Skema Aplikasi (misal: *"Katalog Unsur Geografi Indonesia (KUGI) v5"*), Tanggal Skema, Bahasa Skema (`XML Schema` / `GML`), dan Bahasa Batasan (`OCL` / `SQL`).
  3. **Ekstensi Metadata (`MD\_MetadataExtensionInformation`):** URL Sumber Ekstensi Online \& daftar elemen perluasan (`name`, `definition`, `obligation`, `dataType`, `rationale`, `source` `CI\_ResponsibleParty`).
* **Panel Pemeriksaan Akhir \& Live XML Preview:**

  * Ringkasan skor/status kelengkapan (jumlah elemen Wajib yang sudah terisi vs belum terisi, disertai tombol lompat langsung ke kolom yang kurang).
  * Tab **Pratinjau Kode XML** (*syntax highlighted*) dan tab **Perbandingan Perubahan (Diff View)** antara XML asli GeoNode dan XML hasil *patching*.
  * Tombol Aksi Utama: **Unduh File `.xml`** dan **Simpan ke GeoNode**.

\---

## 7\. Detail Integrasi API GeoNode (`/api/geonode/\*`)

1. **`POST /api/geonode/fetch`**

   * Menerima `{ targetUrlOrUuid: string, auth?: { baseUrl?: string, username: string, password: string } }`.
   * Melakukan validasi keamanan URL (SSRF check).
   * Strategi resolusi cerdas untuk GeoNode v3.x \& v4.x:

     * Jika input berupa URL halaman dataset seperti `https://host/datasets/geonode:layer\_name` atau `https://host/catalogue/#/dataset/123`:

       1. Panggil `GET {origin}/api/v2/datasets/?filter{alternate}=geonode:layer\_name` atau `GET {origin}/api/v2/datasets/123` (sertakan header `Authorization: Basic ...` jika `auth` diberikan).
       2. Ambil `pk`, `uuid`, `title`, `alternate`, dan `links` / `metadata\_uploaded\_preserve` dari respons JSON.
       3. Ambil XML lengkap melalui endpoint CSW: `GET {origin}/catalogue/csw?service=CSW\&version=2.0.2\&request=GetRecordById\&Id={uuid}\&ElementSetName=full\&outputSchema=http://www.isotc211.org/2005/gmd`. (Jika di dalam `<csw:GetRecordByIdResponse>` terdapat `<gmd:MD\_Metadata>`, ekstrak elemen `<gmd:MD\_Metadata>` beserta seluruh deklarasi `xmlns:\*` yang diwarisi dari root CSW agar XML berdiri sendiri secara valid!).
   * Mengembalikan `{ xml: string, datasetMeta: { baseUrl, pk, uuid, title, alternate, preserveFlag } }`.
2. **`POST /api/geonode/push`**

   * Menerima `{ baseUrl: string, pk: number | string, xml: string, preserveMetadata: boolean, auth: { username: string, password: string } }`.
   * Melakukan validasi SSRF, cek XXE pada `xml`, dan rate limiting.
   * Mengirim `PUT {baseUrl}/api/v2/datasets/{pk}/metadata` menggunakan header `Authorization: Basic ...` dan format payload sesuai spesifikasi GeoNode REST API v2 (dukung pengiriman multipart file `metadata\_file` maupun raw `application/xml` dengan mekanisme fallback jika versi GeoNode berbeda).
   * Jika `preserveMetadata === true`, lanjutkan dengan `PATCH {baseUrl}/api/v2/datasets/{pk}` dengan body JSON `{ "metadata\_uploaded\_preserve": true }`.
   * Mengembalikan status keberhasilan beserta pesan diagnostik yang jelas dalam Bahasa Indonesia jika gagal (misal: `401 Kredensial GeoNode salah`, `403 Akun tidak memiliki izin edit dataset ini`, dll.).

\---

## 8\. Urutan Tahapan Pengerjaan (Execution Roadmap)

Kerjakan proyek ini secara berurutan per fase dan pastikan setiap fase bebas error TypeScript/build sebelum lanjut ke fase berikutnya:

* **Fase 1 — Inisialisasi Proyek \& Kamus Standar ISO 19115:**
Setup Next.js + TypeScript + Tailwind + shadcn/ui. Buat file konstanta kamus lengkap (`src/lib/iso-codelists.ts`) berisi seluruh kode resmi ISO 19115 beserta label \& deskripsi Bahasa Indonesia, serta skema data TypeScript + Zod (`src/lib/metadata-schema.ts`) untuk ke-13 elemen metadata.
* **Fase 2 — Mesin Inti *Non-Destructive XML Parser \& Patcher* + Unit Test:**
Bangun modul `src/lib/xml-engine/` yang menangani:
(a) Sanitasi keamanan XXE,
(b) Ekstraksi `<gmd:MD\_Metadata>` dari bungkus `<csw:GetRecordByIdResponse>` tanpa kehilangan deklarasi `xmlns`,
(c) Pembacaan XML ke state Form (`parseIso19139ToForm`),
(d) Penambalan state Form kembali ke DOM XML asli sesuai urutan kanonik `xs:sequence` (`patchFormToIso19139`), menjaga `<gmd:distributionInfo>` dan `<gmd:graphicOverview>` bawaan GeoNode tetap utuh.
Buat pengujian otomatis (`vitest`) untuk membuktikan: *import sample XML GeoNode -> ubah \& tambah 13 elemen -> export XML -> urutan tag 100% sesuai sekuens XSD dan link WMS/WFS asli tidak hilang*.
* **Fase 3 — Backend Proxy Aman (`/api/geonode/fetch` \& `/api/geonode/push`):**
Implementasikan API Routes dengan proteksi SSRF, validasi input, ekstraksi metadata dari URL GeoNode, dan *Stateless Passthrough Auth*.
* **Fase 4 — Antarmuka Utama, Buku Kontak \& 5 Langkah Wizard Bahasa Indonesia:**
Bangun halaman inisialisasi (URL GeoNode / Upload XML / Buat Baru), Header dengan *Mode Ringkas vs Mode Lengkap*, komponen Kartu Kontak terbuka dengan fitur Preset `localStorage`, serta kelima tab langkah pengisian beserta panel proteksi tautan GeoNode.
* **Fase 5 — Validasi Interaktif, Diff XML Preview \& Polish Akhir:**
Tambahkan indikator kelengkapan per tab, pratinjau kode XML \& *Diff View*, modal *Push to GeoNode* dengan panduan unggah manual sebagai alternatif, serta file `.env.example` dan `README.md` dokumentasi penggunaan.

