**SPESIFIKASI UPGRADE V2: STANDAR LENGKAP SE BIG NO. 6 TAHUN 2021 (PROMSI), PROGRES PER BAB, MINI CALENDAR \& PER-FIELD UNDO**



Dokumen ini merupakan spesifikasi peningkatan (upgrade) di atas kode eksisting `GeoMeta Editor`. Pertahankan seluruh arsitektur \*Non-Destructive DOM-Based XML Patching\*, keamanan \*Stateless Passthrough\*, serta aturan estetika Anti-Slop pada `DESIGN.md`.



\---



\## 1. Perbaikan Bug Tanggal (`gco:DateTime`) \& Komponen Popup Mini Calendar



\### A. Normalisasi Parser, Zod Schema, dan Serializer Tanggal

1\. \*\*Saat Membaca XML (`parseIso19139ToForm`):\*\*

&#x20;  - XML dari GeoNode (`pycsw`) menyimpan tanggal menggunakan `<gco:DateTime>2026-10-13T01:56:05Z</gco:DateTime>`, sedangkan XML lain menggunakan `<gco:Date>2026-10-13</gco:Date>`.

&#x20;  - Ekstrak nilai dari `<gco:Date>` maupun `<gco:DateTime>`. Jika string berformat ISO timestamp (`YYYY-MM-DDTHH:mm:ss...`), potong dan normalkan menjadi `YYYY-MM-DD` untuk state Form UI, namun simpan metadata tipe tag atau jam aslinya di memori internal bila diperlukan.

2\. \*\*Pada Skema Validasi Zod (`metadata-schema.ts`):\*\*

&#x20;  - Gunakan `z.preprocess` pada semua field tanggal agar jika ada input string ISO `YYYY-MM-DDTHH:mm:ssZ`, nilainya otomatis dinormalkan ke `YYYY-MM-DD` sebelum dicek regex `^\\d{4}-\\d{2}-\\d{2}$`. Tidak boleh lagi muncul error validasi merah saat pertama kali memuat XML GeoNode.

3\. \*\*Saat Menulis/Patching XML (`patchFormToIso19139`):\*\*

&#x20;  - Jika node XML asli menggunakan `<gco:DateTime>`, perbarui bagian tanggalnya menjadi `YYYY-MM-DDT00:00:00Z` (atau pertahankan komponen waktu asli jika tanggal tidak berubah). Jika membuat elemen tanggal baru, gunakan `<gco:Date>YYYY-MM-DD</gco:Date>` kecuali pada `LI\_ProcessStep/dateTime` dan `usageDateTime` yang secara XSD wajib `<gco:DateTime>YYYY-MM-DDT00:00:00Z</gco:DateTime>`.



\### B. Komponen UI `DatePickerField` (Popup Mini Calendar)

Ganti seluruh input tanggal teks biasa (`dateStamp`, tanggal sitasi dataset, `dateOfNextUpdate`, `temporalExtent`, tanggal tahapan `LI\_ProcessStep`, tanggal evaluasi QC/QA, dan tanggal sitasi dokumen KUGI/Simbol/Skema) dengan komponen `DatePickerField`:

\- \*\*Tampilan Input:\*\* Kotak input bergaya konsisten (`font-mono` untuk angka tanggal `YYYY-MM-DD`) yang tetap mengizinkan ketik/tempel manual, dilengkapi tombol ikon `Calendar` di sisi kanan dalam satu kesatuan input.

\- \*\*Popup Mini Calendar (`Popover` + `Calendar` dari `shadcn/ui` / `react-day-picker`):\*\*

&#x20; - Gunakan lokalisasi Bahasa Indonesia (`date-fns/locale/id` — nama hari Sen..Min \& bulan Januari..Desember).

&#x20; - \*\*WAJIB memiliki Dropdown Bulan dan Dropdown Tahun (`1970` s/d `tahun sekarang + 5`)\*\* di bagian header kalender agar pengguna dapat melompat cepat ke tahun survei lama tanpa mengklik panah ratusan kali.

&#x20; - Bagian bawah popup memiliki 2 tombol aksi ringkas: \*\*`Hari Ini`\*\* (langsung memilih tanggal hari ini dan menutup popup) dan \*\*`Kosongkan`\*\* (hanya tampil jika kolom bersifat opsional).

&#x20; - Patuhi `DESIGN.md`: permukaan solid `bg-popover`, border `1px`, aksen tanggal terpilih biru-hijau (`bg-primary text-primary-foreground`), tanpa efek glow/animasi berlebihan.



\---



\## 2. Fitur Undo / Reset Per Kolom Isian (`Per-Field Snapshot Undo`)



Pengguna harus bisa mengembalikan nilai awal suatu kolom secara individual apabila tidak sengaja terhapus atau salah ketik saat mengedit XML dari GeoNode/file lokal.



\### Mekanisme Teknis:

1\. \*\*`initialFormValues` Snapshot:\*\*

&#x20;  - Setiap kali sumber metadata dimuat (dari Fetch URL GeoNode, Upload File `.xml`, atau Buat Baru), simpan salinan mendalam yang tidak berubah (`structuredClone` dalam React `ref` atau state `baselineValues`) terpisah dari state aktif `react-hook-form`.

2\. \*\*Deteksi Perubahan Per Kolom pada `FormFieldWrapper`:\*\*

&#x20;  - Setiap komponen pembungkus kolom menerima prop `name` (path field di `react-hook-form`, misal `"contacts.0.address.deliveryPoint"` atau `"identification.abstract"`).

&#x20;  - Bandingkan nilai aktif saat ini (`useWatch({ name })`) dengan nilai pada `baselineValues` di path yang sama (gunakan perbandingan nilai bersih yang menganggap `""` dan `undefined` setara).

&#x20;  - Apabila `currentValue !== baselineValue`:

&#x20;    - Tampilkan tombol aksi mikro di baris header kolom (di sebelah kanan atau di samping badge kewajiban): ikon `RotateCcw` (`13px`) + label tipis \*\*`Kembalikan`\*\* dengan warna teks aksen lembut (`text-muted-foreground hover:text-primary`).

&#x20;    - Saat kursor diarahkan (\*hover/title\*), tampilkan pratinjau nilai awalnya:

&#x20;      - Jika nilai awal ada isinya: `"Kembalikan ke nilai awal: Jl. Tengkawang No. 1"` (potong dengan `...` jika lebih dari 60 karakter).

&#x20;      - Jika nilai awal kosong: `"Kosongkan kembali ke kondisi awal"`.

&#x20;    - Saat diklik: panggil `form.setValue(name, structuredClone(baselineFieldValue), { shouldValidate: true, shouldDirty: true, shouldTouch: true })`. Hanya kolom tersebut yang kembali ke nilai awal!

3\. \*\*Undo untuk Seksi Berbentuk Daftar Dinamis (`useFieldArray`):\*\*

&#x20;  - Untuk daftar berulang (Kontak Metadata, Kontak Produsen, Sumber Data `LI\_Source`, Tahapan Proses `LI\_ProcessStep`, Laporan Kualitas `DQ\_Element`, dan Kata Kunci), selain tombol undo per sub-kolom pada indeks yang bersesuaian, sediakan juga tombol kecil \*\*`Pulihkan Daftar Awal`\*\* di sudut header kartu seksi jika jumlah item bertambah/terhapus dibanding `baselineValues`.



\---



\## 3. Sistem 3 Profil Standar \& Persentase Kelengkapan Per Bab



Mengacu pada \*\*SE Kepala BIG Nomor 6 Tahun 2021\*\* (SNI ISO 19131 Spesifikasi Produk Data, SNI 8843-1:2019 ProMSI, SNI ISO 19157 Kualitas Data, dan SNI ISO 19110 KUGI), banyak elemen yang berstatus \*Optional\* di XSD ISO 19115 murni namun \*\*harus diisi\*\* untuk kelengkapan Satu Data Indonesia (SDI).



\### A. Selector 3 Profil Kelengkapan di Top Bar (Pengganti Toggle Ringkas/Lengkap Lama)

Sediakan komponen pemilih profil (\*Segmented Control\* atau \*Select\* ringkas di Header):

1\. \*\*`ISO Minimum` (`iso\_core`):\*\* Hanya menghitung elemen \*Mandatory\* XSD ISO 19115/19139 murni (\~12 elemen). Kolom lanjutan tetap bisa dibuka bila diinginkan.

2\. \*\*`Standar SDI — Produsen` (`sdi\_produsen` — DEFAULT AKTIF):\*\* Menghitung seluruh `Wajib ISO` + seluruh elemen `Wajib SDI` yang wajib dilengkapi Produsen Data (Spesifikasi Produk Data, SRGI, KUGI, Silsilah `LI\_Source` \& `LI\_ProcessStep`, serta Evaluasi Kualitas QC/QE `DQ\_DataQuality`).

3\. \*\*`Verifikasi SDI — Walidata` (`sdi\_walidata`):\*\* Menghitung seluruh `sdi\_produsen` + elemen yang wajib dilengkapi oleh Walidata setelah Penjaminan Kualitas (QA) dan sebelum publikasi JIGN, yaitu \*\*Hasil Penjaminan Kualitas / Penggunaan (`MD\_Usage`)\*\* serta \*\*Kelengkapan Distributor \& Format Distribusi (`MD\_Distribution`)\*\*.



Tambahkan pula 1 checkbox filter kecil di atas area form: \*\*`Sembunyikan kolom Opsional`\*\* (tidak aktif secara default pada profil SDI agar semua isian relevan terlihat jelas).



\### B. Sistem Badge Kewajiban 4 Tingkat

1\. \*\*`Wajib ISO`\*\* (Rose/Merah lembut): Wajib secara skema XSD ISO 19139.

2\. \*\*`Wajib SDI`\*\* (Teal/Biru-Hijau lembut): Wajib untuk kelengkapan standar SE Kepala BIG No. 6 Tahun 2021 pada profil `sdi\_produsen` / `sdi\_walidata`.

3\. \*\*`Wajib QA Walidata`\*\* (Cyan/Indigo lembut): Wajib diisi oleh Walidata pada profil `sdi\_walidata`.

4\. \*\*`Bersyarat`\*\* (Amber) \& \*\*`Opsional`\*\* (Slate).



\### C. Mesin Perhitungan Persentase Kelengkapan Per Bab \& Per Kartu (`src/lib/completeness.ts`)

Bangun fungsi murni `calculateMetadataCompleteness(values, profile)` yang menghitung kelengkapan secara \*real-time\* (pastikan string placeholder GeoNode seperti `"None"`, `"No abstract provided"`, `"No information provided"` dihitung \*\*belum terisi\*\*):



1\. \*\*Di Sidebar Navigasi Kiri (Langkah / Bab 1 s/d 5):\*\*

&#x20;  - Setiap item Bab menampilkan:

&#x20;    - Nama Bab \& nomor langkah

&#x20;    - \*\*Angka Persentase (`0%` – `100%`)\*\* dan rasio item wajib profil aktif (contoh: `7/10 • 70%`)

&#x20;    - \*\*Mini Progress Bar tipis (`h-1.5 w-full rounded-full`)\*\* di bawah judul bab berwarna biru-hijau (`bg-primary`), berubah menjadi hijau-teal penuh + ikon `CheckCircle2` saat mencapai `100%`.

2\. \*\*Di Header Setiap Kartu Sub-Bagian dalam Form:\*\*

&#x20;  - Tampilkan \*chip\* ringkas di kanan atas kartu, misal: `Terisi 4/5 (80%)` untuk item wajib pada kartu tersebut, sehingga pengguna langsung tahu kartu mana di dalam suatu bab yang masih kurang tanpa harus menelusuri satu per satu.

3\. \*\*Di Sticky Top Bar \& Panel Pemeriksaan Akhir (Bab 5):\*\*

&#x20;  - Tampilkan persentase keseluruhan untuk profil aktif (misal: `Kelengkapan SDI: 78% (25/32)`), dan saat diklik membuka \*popover\* daftar kolom yang belum terisi beserta tombol klik-langsung (\*jump to field\*) yang otomatis berpindah ke bab terkait dan memfokuskan kursor ke kolom tersebut.



\---



\## 4. Rincian Lengkap Ekspansi Isian di Tiap Bab (Sesuai SE BIG No. 6 Tahun 2021)



Pastikan kelima bab mencakup seluruh elemen berikut dan terhubung penuh secara dua arah (\*parse\* \& \*patch\* sesuai urutan kanonik `xs:sequence` XSD ISO 19139):



\### BAB 1: Informasi Metadata (`MD\_Metadata`)

\- \*\*Identitas \& Ruang Lingkup Metadata:\*\*

&#x20; - `fileIdentifier` (`Wajib ISO`)

&#x20; - `language` (`Wajib ISO`, default `ind`) \& `characterSet` (`Wajib ISO`, default `utf8`)

&#x20; - `parentIdentifier` (`Opsional`)

&#x20; - `hierarchyLevel` (`Wajib SDI`, default `dataset`) \& `hierarchyLevelName` (`Wajib SDI` — jelaskan sebagai level jangkauan geografis/administrasi produk data sesuai SE 6/2021, misal `"Provinsi"`, `"Kabupaten/Kota"`, `"Nasional"`)

&#x20; - `dateStamp` (`Wajib ISO` — menggunakan `DatePickerField`)

&#x20; - `metadataStandardName` (default `"SNI 8843-1:2019 / ISO 19115"`) \& `metadataStandardVersion` (default `"1.0"`) (`Wajib SDI`)

&#x20; - `dataSetURI` (`Opsional`)

\- \*\*Kontak Penanggung Jawab Metadata (`gmd:contact` -> `CI\_ResponsibleParty`) \[`Wajib ISO`]:\*\*

&#x20; - Nama Individu, Nama Instansi (`Wajib ISO`), Jabatan (`Wajib SDI`), Telepon, Faksimili, Alamat Jalan (`Wajib SDI`), Kota, Provinsi, Kode Pos, Negara (`IDN` / `Indonesia`), Email (`Wajib ISO`), Website, dan Peran (`CI\_RoleCode`).

\- \*\*Pemeliharaan Metadata (`gmd:metadataMaintenance` -> `MD\_MaintenanceInformation`) \[`Wajib SDI` — SE 6/2021 Poin 4.1.1 \& 4.1.5]:\*\*

&#x20; - Frekuensi Pemutakhiran Metadata (`maintenanceAndUpdateFrequency`), Ruang Lingkup Pemutakhiran (`updateScope`), dan Catatan Pemeliharaan Metadata (`maintenanceNote`), dilengkapi tombol pintas \*\*"Samakan dengan Pemeliharaan Dataset"\*\*.

\- \*\*Batasan Metadata (`gmd:metadataConstraints`) \[`Opsional`]:\*\*

&#x20; - Klasifikasi keamanan atau batasan akses terhadap dokumen metadata itu sendiri bila berbeda dari dataset.



\### BAB 2: Identifikasi Produk Data, QA Walidata, Pemeliharaan \& Batasan

\- \*\*Identifikasi \& Sitasi Produk Data (`MD\_DataIdentification` — SNI ISO 19131 \& Poin 4.1.2):\*\*

&#x20; - Judul Produk Data (`title` — `Wajib ISO`)

&#x20; - Judul Alternatif / Nama Layer (`alternateTitle` — `Wajib SDI`)

&#x20; - Tanggal Referensi (`CI\_Date`: Tanggal \& Tipe Tanggal `creation`/`publication`/`revision` menggunakan `DatePickerField` — `Wajib ISO`, mendukung >1 tanggal misal tanggal pembuatan sekaligus tanggal publikasi)

&#x20; - Edisi (`edition` — `Opsional`), Kode Pengenal Sitasi (`identifier` — `Opsional`), Bentuk Penyajian (`presentationForm`, misal `mapDigital` — `Wajib SDI`)

&#x20; - Abstrak / Narasi Isi Data (`abstract` — `Wajib ISO`)

&#x20; - Tujuan Pembuatan Data (`purpose` — \*\*`Wajib SDI`\*\*, sesuai Gambaran Umum SNI ISO 19131)

&#x20; - Kredit / Instansi Pendukung (`credit` — `Opsional`)

&#x20; - Status Produk Data (`status` -> `MD\_ProgressCode` — `Wajib SDI`)

&#x20; - Kontak Pemilik / Produsen Data (`pointOfContact` — `Wajib SDI`, dengan preset Buku Kontak \& tombol salin dari Bab 1)

\- \*\*Klasifikasi Topik (21 Topik ProMSI) \& Kata Kunci:\*\*

&#x20; - \*\*21 Kategori Topik SNI 8843-1:2019 (`topicCategory` — `Wajib ISO`):\*\*

&#x20;   Sediakan \*multi-select\* lengkap 21 klasifikasi sesuai Tabel 1 SE 6/2021:

&#x20;   1. Pertanian/peternakan (`farming`), 2. Biota (`biota`), 3. Batas wilayah (`boundaries`), 4. Klimatologi, Meteorologi, Atmosfer (`climatologyMeteorologyAtmosphere`), 5. Ekonomi (`economy`), 6. Elevasi (`elevation`), 7. Lingkungan (`environment`), 8. Geoinformasi/Geosains (`geoscientificInformation`), 9. Kesehatan (`health`), 10. Citra satelit/basemap (`imageryBaseMapsEarthCover`), 11. Intelijen/Militer (`intelligenceMilitary`), 12. Air di darat (`inlandWaters`), 13. Lokasi (`location`), 14. Lautan (`oceans`), 15. Perencanaan/kadaster (`planningCadastre`), 16. Sosial masyarakat (`society`), 17. Konstruksi/struktur (`structure`), 18. Transportasi (`transportation`), 19. Utilitas/komunikasi (`utilitiesCommunication`), \*\*20. Ekstra terestrial\*\*, \*\*21. Bencana\*\*.

&#x20;   - \*Aturan Kompatibilitas XML untuk Topik 20 \& 21:\* Karena XSD `gmd:MD\_TopicCategoryCode` ISO 19139 hanya menerima 19 enumerasi asli, jika pengguna memilih \*\*Bencana\*\* atau \*\*Ekstra terestrial\*\*, tulis kode ISO terdekat (`environment` / `geoscientificInformation`) ke `<gmd:MD\_TopicCategoryCode>` DAN otomatis tambahkan blok `<gmd:descriptiveKeywords>` dengan kata kunci `"Bencana"` / `"Ekstra terestrial"` serta judul thesaurus `"SNI 8843-1:2019"` (dan baca kembali menjadi centang topik 20/21 saat impor!).

&#x20; - \*\*Kata Kunci Terstruktur (`descriptiveKeywords` — `Wajib SDI`):\*\*

&#x20;   Dukung kelompok kata kunci berdasarkan Tipe (`MD\_KeywordTypeCode`: Tema/`theme`, Lokasi/`place`, Waktu/`temporal`, Disiplin/`discipline`, Strata/`stratum`) beserta Nama Thesaurus opsional.

\- \*\*Cakupan Wilayah, Deskripsi Geografis \& Waktu (`extent` -> `EX\_Extent`):\*\*

&#x20; - Batas Koordinat Geografis (`EX\_GeographicBoundingBox`: Barat, Timur, Selatan, Utara — `Wajib ISO`).

&#x20; - \*\*Deskripsi Geografis / Wilayah Administrasi (`EX\_GeographicDescription` -> `geographicIdentifier` -> `MD\_Identifier/code`) \[`Wajib SDI` — SE 6/2021 Bab 2]:\*\* Contoh: `"Provinsi Kalimantan Timur"` atau kode wilayah Kemendagri/BPS.

&#x20; - Cakupan Waktu Data (`EX\_TemporalExtent`: Tanggal Mulai \& Tanggal Akhir dengan `DatePickerField` — `Opsional` / dianjurkan).

&#x20; - Cakupan Vertikal (`EX\_VerticalExtent`: Nilai Minimum \& Maksimum dalam meter — `Opsional`).

\- \*\*Penggunaan \& Hasil Penjaminan Kualitas / QA oleh Walidata (`resourceSpecificUsage` -> `MD\_Usage`) \[`Wajib QA Walidata` — SE 6/2021 Poin 1.1.3 \& 4.1.2]:\*\*

&#x20; - Kartu khusus berlabel jelas \*\*"Hasil Penjaminan Kualitas (QA) \& Kelas Penggunaan — Diisi oleh Walidata"\*\*:

&#x20;   - Kelas Penggunaan / Rekomendasi Pemanfaatan Hasil QA (`specificUsage` — misal: \*"Telah lulus Penjaminan Kualitas (QA) Walidata Daerah; layak dibagi-pakaikan untuk perencanaan tingkat provinsi skala 1:25.000"\*).

&#x20;   - Tanggal Penjaminan Kualitas (`usageDateTime` — `DatePickerField`).

&#x20;   - Catatan Batasan/Temuan Evaluasi QA (`userDeterminedLimitations`).

&#x20;   - Kontak Walidata Pemeriksa (`userContactInfo` -> `CI\_ResponsibleParty`, mendukung isi cepat dari Buku Kontak).

\- \*\*Pemeliharaan Produk Data (`resourceMaintenance` -> `MD\_MaintenanceInformation`) \[`Wajib SDI`]:\*\*

&#x20; - Frekuensi Pembaruan (`maintenanceAndUpdateFrequency` — `Wajib SDI`), Tanggal Pembaruan Berikutnya (`dateOfNextUpdate` — `DatePickerField`), Ruang Lingkup Pemeliharaan (`updateScope`), serta Catatan Penyimpanan \& Pemeliharaan Data (`maintenanceNote` — sesuai Bab 2 Pemeliharaan Data).

\- \*\*Batasan Produk Data (`resourceConstraints`) \[`Wajib SDI` — Poin 4.1.3]:\*\*

&#x20; - Batasan Umum (`MD\_Constraints` -> `useLimitation` — `Wajib SDI`).

&#x20; - Batasan Hukum (`MD\_LegalConstraints` -> `accessConstraints` \[`Wajib SDI`], `useConstraints` \[`Wajib SDI`], dan `otherConstraints` \[otomatis `Wajib` bila salah satu bernilai `otherRestrictions`]).

&#x20; - Batasan Keamanan (`MD\_SecurityConstraints` -> `classification` \[`Wajib SDI`, default `unclassified` / Terbuka] \& `userNote`).

\- \*\*Informasi Tambahan Spesifikasi Produk (`supplementalInformation`) \[`Opsional`]:\*\*

&#x20; - Keterangan tambahan dari Spesifikasi Produk Data seperti persyaratan personil, peralatan survei, atau rujukan KAK.



\### BAB 3: Representasi Spasial, Sistem Referensi (SRGI) \& Konten (KUGI)

\- \*\*Representasi \& Resolusi Spasial (`spatialRepresentationType`, `spatialResolution`, `gmd:spatialRepresentationInfo`) \[`Wajib SDI` — Poin 4.1.6]:\*\*

&#x20; - Tipe Representasi Spasial (`vector`, `grid`, `textTable`, `tin` — `Wajib SDI`).

&#x20; - Resolusi Spasial (`MD\_Resolution` — `Wajib SDI`): Pilihan \*\*Skala Peta\*\* (`equivalentScale` misal `25000` dengan tombol cepat `1:5.000`, `1:10.000`, `1:25.000`, `1:50.000`, `1:100.000`, `1:250.000`) atau \*\*Resolusi Jarak/GSD\*\* (`distance` dalam `meter`).

&#x20; - Sub-form dinamis berdasarkan tipe:

&#x20;   - \*\*Jika Vektor (`MD\_VectorSpatialRepresentation`):\*\* Level Topologi (`topologyLevel`) dan Objek Geometri (`geometricObjectType`: Titik/`point`, Garis/`curve`, Poligon/`surface` + `geometricObjectCount`).

&#x20;   - \*\*Jika Grid/Raster:\*\* Pilihan sub-kelas \*\*`MD\_GridSpatialRepresentation`\*\*, \*\*`MD\_Georectified`\*\* (Jumlah Dimensi, Ukuran Baris \& Kolom, Geometri Sel `area`/`point`, Ketersediaan Titik Uji/`checkPointAvailability`, Deskripsi Transformasi, `pointInPixel`), atau \*\*`MD\_Georeferencable`\*\* (Ketersediaan Parameter Kontrol \& Parameter Orientasi) sesuai SE 6/2021 Poin 4.1.6.

\- \*\*Sistem Referensi Spasial — Prioritas SRGI (`gmd:referenceSystemInfo` -> `MD\_ReferenceSystem`) \[`Wajib SDI` — Bab 2 \& Poin 4.1.7]:\*\*

&#x20; - Tampilkan panduan singkat bahwa produk data SDI wajib mengacu pada \*\*SRGI 2013\*\*.

&#x20; - Sediakan \*preset dropdown\* cepat dikelompokkan rapi:

&#x20;   - \*\*SRGI 2013 (Rekomendasi Utama BIG):\*\* `EPSG:9489` (SRGI 2013 Geografis 2D), serta seluruh Zona UTM SRGI 2013 (`EPSG:9478` Zona 46N s/d `EPSG:9488` Zona 54S, dengan penanda jelas untuk zona Kalimantan Timur `EPSG:9480` \[UTM 50N] \& `EPSG:9485` \[UTM 50S]).

&#x20;   - \*\*WGS 84 \& Web:\*\* `EPSG:4326` (WGS 84), `EPSG:32646`–`EPSG:32654` / `EPSG:32746`–`EPSG:32754` (WGS 84 UTM), `EPSG:3857`.

&#x20; - Kolom `code` (`Wajib SDI`), `codeSpace` (default `EPSG`), dan `version`. Dukung penambahan >1 sistem referensi (misal referensi vertikal/temporal).

\- \*\*Informasi Konten \& Katalog Unsur KUGI (`gmd:contentInfo` — SNI ISO 19110, Bab 5 \& Poin 4.1.8) \[`Wajib SDI`]:\*\*

&#x20; - \*\*Untuk Vektor (`MD\_FeatureCatalogueDescription`):\*\*

&#x20;   - Nama / Kode Unsur Geografi KUGI (`featureTypes` -> `LocalName`, misal `JaringanIrigasi\_LN` atau kode alfanumerik unik KUGI — `Wajib SDI`).

&#x20;   - Status Kepatuhan SNI ISO 19110 (`complianceCode` boolean) \& Disertakan bersama Dataset (`includedWithDataset` boolean).

&#x20;   - Bahasa Katalog Unsur (`language`, default `ind`).

&#x20;   - Sitasi Katalog Unsur (`featureCatalogueCitation`: Judul Katalog, Tanggal menggunakan `DatePickerField`, Edisi, dan URL Tautan Online), dilengkapi tombol 1-klik \*\*"Isi Otomatis Standar KUGI BIG (kugi.ina-sdi.or.id)"\*\* namun tetap menjaga atribut `uuidref`/`xlink:href` bawaan GeoNode jika ada!

&#x20;   - \*\*Tabel Struktur Atribut Unsur (Pembantu Dokumentasi KUGI):\*\* Daftar ringan opsional (Nama Atribut, Tipe Data, Definisi Bahasa Natural, Satuan/Domain Nilai) yang diserialisasikan dengan aman tanpa melanggar XSD ISO 19139.

&#x20; - \*\*Untuk Raster (`MD\_CoverageDescription`):\*\* Deskripsi Atribut (`attributeDescription`) \& Tipe Konten (`MD\_CoverageContentTypeCode`: `image`, `thematicClassification`, `physicalMeasurement`).



\### BAB 4: Manajemen Kualitas Data (SNI ISO 19157), Garis Silsilah \& Distribusi

\- \*\*Garis Silsilah / Pemerolehan Data (`LI\_Lineage` — Bab 2 \& Poin 4.1.4) \[`Wajib SDI`]:\*\*

&#x20; - Pernyataan Umum Garis Silsilah (`statement` — `Wajib SDI`).

&#x20; - \*\*Sumber Data (`LI\_Source` — \*repeatable\*, minimal 1 item untuk `Wajib SDI`):\*\*

&#x20;   - Deskripsi Sumber Data (`description` — misal \*"Citra Satelit Tegak Resolusi Tinggi tahun 2024 dan data survei lapangan DPUPR"\*), Penyebut Skala Sumber (`scaleDenominator`), serta Sitasi Sumber (`sourceCitation`: Judul Sumber \& Tanggal dengan `DatePickerField`).

&#x20; - \*\*Tahapan Proses Produksi (`LI\_ProcessStep` — \*repeatable\*, minimal 1 item untuk `Wajib SDI`):\*\*

&#x20;   - Deskripsi Tahapan Teknis Pengumpulan/Pengolahan/QC (`description`), Rasional/Tujuan Tahap (`rationale`), Tanggal Pelaksanaan (`dateTime` dengan `DatePickerField`), dan Pelaksana Tahap (`processor` -> `CI\_ResponsibleParty` opsional).

\- \*\*Evaluasi Kualitas Data (`DQ\_DataQuality` -> `report` — SNI ISO 19157, Bab 3 \& Poin 4.1.14) \[`Wajib SDI`]:\*\*

&#x20; - Cakupan Kualitas (`scope` -> `MD\_ScopeCode`, default `dataset` — `Wajib SDI`).

&#x20; - \*\*Builder 15 Sub-Elemen Kualitas SNI ISO 19157 (minimal 1 laporan kualitas untuk `Wajib SDI`):\*\*

&#x20;   Sediakan pemilih sub-elemen lengkap dalam 5 kategori resmi SE 6/2021 (pastikan tag XML tepat sesuai nama kelas XSD `gmd:`):

&#x20;   1. \*\*Kelengkapan (\*Completeness\*):\*\*

&#x20;      - Komisi / Kelebihan Data (`gmd:DQ\_CompletenessCommission`)

&#x20;      - Omisi / Ketiadaan Data (`gmd:DQ\_CompletenessOmission`)

&#x20;   2. \*\*Konsistensi Logis (\*Logical Consistency\*):\*\*

&#x20;      - Konsistensi Konseptual (`gmd:DQ\_ConceptualConsistency`)

&#x20;      - Konsistensi Domain / Atribut KUGI (`gmd:DQ\_DomainConsistency`)

&#x20;      - Konsistensi Format (`gmd:DQ\_FormatConsistency`)

&#x20;      - Konsistensi Topologis (`gmd:DQ\_TopologicalConsistency`)

&#x20;   3. \*\*Akurasi Posisi (\*Positional Accuracy\*):\*\*

&#x20;      - Akurasi Posisi Absolut / Eksternal (`gmd:DQ\_AbsoluteExternalPositionalAccuracy`)

&#x20;      - Akurasi Posisi Data Grid (`gmd:DQ\_GriddedDataPositionalAccuracy`)

&#x20;      - Akurasi Posisi Relatif / Internal (`gmd:DQ\_RelativeInternalPositionalAccuracy`)

&#x20;   4. \*\*Akurasi Tematik (\*Thematic Accuracy\*):\*\*

&#x20;      - Kebenaran Klasifikasi Tematik (`gmd:DQ\_ThematicClassificationCorrectness`)

&#x20;      - Kebenaran Atribut Non-Kuantitatif (`gmd:DQ\_NonQuantitativeAttributeAccuracy`)

&#x20;      - Akurasi Atribut Kuantitatif (`gmd:DQ\_QuantitativeAttributeAccuracy`)

&#x20;   5. \*\*Akurasi Temporal (\*Temporal Accuracy\*):\*\*

&#x20;      - Akurasi Waktu Pengukuran (`gmd:DQ\_AccuracyOfATimeMeasurement`)

&#x20;      - Konsistensi Temporal (`gmd:DQ\_TemporalConsistency`)

&#x20;      - Validitas Temporal (`gmd:DQ\_TemporalValidity`)

&#x20; - \*\*Tombol Preset Paket Kualitas 1-Klik:\*\*

&#x20;   - `Muat Paket Kualitas Vektor (Omisi, Komisi, Topologi, Domain KUGI)`

&#x20;   - `Muat Paket Kualitas Raster (Posisi Grid \& Klasifikasi Tematik)`

&#x20; - \*\*Isian di Dalam Setiap Kartu Sub-Elemen Kualitas (Sesuai Urutan Sekuens `AbstractDQ\_Element\_Type` XSD ISO 19139!):\*\*

&#x20;   1. `gmd:nameOfMeasure` (Nama Ukuran Kualitas, misal \*"Persentase kesalahan topologi overlap/gap"\*)

&#x20;   2. `gmd:measureDescription` (Deskripsi ukuran kualitas)

&#x20;   3. `gmd:evaluationMethodType` (`DQ\_EvaluationMethodTypeCode`: Evaluasi Langsung Internal/`directInternal`, Evaluasi Langsung Eksternal/`directExternal`, Evaluasi Tidak Langsung/`indirect`)

&#x20;   4. `gmd:evaluationMethodDescription` (Prosedur evaluasi kualitas)

&#x20;   5. `gmd:evaluationProcedure` (`CI\_Citation`: Judul Dokumen Kontrol Kualitas / KAK / Dokumen Elemen Kualitas \& Tanggal Dokumen via `DatePickerField`)

&#x20;   6. `gmd:dateTime` (Tanggal Evaluasi via `DatePickerField`)

&#x20;   7. `gmd:result` — dukung:

&#x20;      - \*\*Hasil Kesesuaian (`gmd:DQ\_ConformanceResult`):\*\* Judul Spesifikasi Acuan (`specification` -> `CI\_Citation`), Penjelasan Hasil (`explanation`), dan Status Kesesuaian (`pass`: `Lulus (Sesuai Spesifikasi)` = `true` / `Tidak Lulus` = `false`).

&#x20;      - \*\*Hasil Kuantitatif Opsional (`gmd:DQ\_QuantitativeResult`):\*\* Satuan Nilai (`valueUnit` — misal `meter` atau `persen`) dan Nilai Terukur (`value` -> `<gco:Record>`).

\- \*\*Informasi Distribusi (`gmd:distributionInfo` -> `MD\_Distribution` — Bab 2, Bab 5 \& Poin 4.1.10):\*\*

&#x20; - \*\*Format Pengiriman (`distributionFormat` -> `MD\_Format` — `Wajib SDI`):\*\* Nama Format (`name` — misal `ESRI Shapefile`, `GeoJSON`, `GeoPackage`), Versi Format (`version`), Spesifikasi/Profil Format (`specification`), dan Teknik Dekompresi Struktur File (`fileDecompressionTechnique`, misal `ZIP`).

&#x20; - \*\*Informasi Distributor (`distributor` -> `MD\_Distributor` — `Wajib QA Walidata`):\*\* Kontak Distributor (`distributorContact` -> `CI\_ResponsibleParty`, dengan tombol isi cepat dari Buku Kontak) dan Ketentuan/Instruksi Pemerolehan (`distributionOrderProcess` -> `MD\_StandardOrderProcess`: `fees` \& `orderingInstructions`).

&#x20; - \*\*Opsi Transfer Digital (`transferOptions` -> `MD\_DigitalTransferOptions` — `Wajib SDI`):\*\*

&#x20;   - Pertahankan panel terkunci untuk seluruh `<gmd:onLine>` otomatis bawaan GeoNode (`OGC:WMS`, `OGC:WFS`, `WWW:DOWNLOAD...`).

&#x20;   - Dukung penambahan tautan layanan OGC terbuka (`WMS`, `WFS`, `WMTS`, `WCS`, `CSW`) maupun tautan unduhan tambahan, serta kolom Ukuran File (`transferSize` dalam MB).



\### BAB 5: Penyajian (Katalog Simbol), Skema Aplikasi, Ekstensi \& Audit Akhir

\*(Buka kartu Penyajian \& Skema Aplikasi secara terlihat jelas pada profil `sdi\_produsen` dan `sdi\_walidata`, jangan disembunyikan rapat!)\*

\- \*\*Penyajian / Katalog Simbol (`gmd:portrayalCatalogueInfo` -> `MD\_PortrayalCatalogueReference` — SNI ISO 19117, Bab 2 \& Poin 4.1.9) \[`Opsional` / Dianjurkan SDI]:\*\*

&#x20; - Judul Katalog Simbol / Standar Penyajian Peta, Tanggal Publikasi (`DatePickerField`), Edisi, dan URL Tautan SLD/Dokumen Simbol.

\- \*\*Skema Aplikasi / Kamus Data (`gmd:applicationSchemaInfo` -> `MD\_ApplicationSchemaInformation` — SNI ISO 19109, Bab 2 \& Poin 4.1.12) \[`Opsional` / Dianjurkan SDI]:\*\*

&#x20; - Nama Skema Aplikasi / Spesifikasi Kamus Data, Tanggal (`DatePickerField`), Bahasa Skema (`GML` / `XML Schema`), Bahasa Batasan (`OCL` / `SQL`), dan URL File Skema Aplikasi (`schemaAscii` / `onlineResource`).

\- \*\*Ekstensi Metadata (`gmd:metadataExtensionInfo` — Poin 4.1.11) \[`Opsional`]:\*\*

&#x20; - Untuk mendefinisikan elemen informasi tambahan spesifik produk data di luar kelas standar.

\- \*\*Panel Audit Kelengkapan Per Bab \& Pratinjau Diff XML:\*\*

&#x20; - Tampilkan tabel ringkasan progres Bab 1 s/d Bab 5 lengkap dengan persentase masing-masing, daftar item `Wajib ISO` dan `Wajib SDI` yang belum terisi (dengan tombol klik lompat ke kolom terkait), serta tab Pratinjau XML \& Diff View.



\---



\## 5. Urutan Pengerjaan \& Pengujian Wajib

1\. \*\*Tahap A — Perbaikan Tanggal \& Komponen `DatePickerField` + Fitur `Per-Field Undo`:\*\*

&#x20;  Perbaiki normalisasi `<gco:DateTime>` di parser/Zod/serializer, bangun komponen `DatePickerField` ber-dropdown Bulan \& Tahun dalam Bahasa Indonesia, dan integrasikan sistem `baselineValues` + tombol `Kembalikan` per kolom di komponen pembungkus field.

2\. \*\*Tahap B — Ekspansi Skema Data \& Mesin XML untuk SE 6/2021:\*\*

&#x20;  Perluas TypeScript types, Zod schema, `parseIso19139ToForm`, dan `patchFormToIso19139` untuk mencakup seluruh elemen baru (21 Topik ProMSI dengan jembatan XSD 19139, `EX\_GeographicDescription`, `MD\_Usage` QA Walidata, `MD\_Georectified`/`MD\_Georeferencable`, preset SRGI 2013, KUGI `MD\_FeatureCatalogueDescription`, `LI\_Source` \& `LI\_ProcessStep`, 15 sub-elemen `DQ\_DataQuality` sesuai urutan XSD `AbstractDQ\_Element\_Type`, `MD\_Distributor`, dan `metadataMaintenance`).

3\. \*\*Tahap C — Mesin Persentase Kelengkapan 3 Profil (`completeness.ts`) \& Update UI Bab 1–5:\*\*

&#x20;  Implementasikan pemilih 3 Profil (`ISO Minimum`, `Standar SDI — Produsen`, `Verifikasi SDI — Walidata`), persentase + \*progress bar\* per bab di Sidebar, \*chip\* rasio per kartu, serta form UI Bab 1–5 sesuai aturan visual `DESIGN.md`.

4\. \*\*Tahap D — Verifikasi Otomatis:\*\*

&#x20;  - Tambahkan unit test menggunakan `jaringan\_irigasi\_prov\_kaltim\_ISO\_Metadata.xml` untuk menguji: (1) `2026-10-13T01:56:05Z` terbaca sebagai `2026-10-13` tanpa error validasi, (2) semua 15 kelas `DQ\_DataQuality`, `LI\_Source`, `LI\_ProcessStep`, dan `MD\_Usage` ter-\*serialize\* dalam urutan `xs:sequence` ISO 19139 yang tepat tanpa menghapus 13 `<gmd:onLine>` bawaan GeoNode, dan (3) kalkulator persentase per bab menghitung nilai dengan benar untuk ketiga profil.

&#x20;  - Jalankan `tsc --noEmit` dan `vitest run` hingga 100% lulus.

