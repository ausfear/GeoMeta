# DESIGN SYSTEM & UI SPECIFICATION: GEOMETA EDITOR

## 1. Filosofi Desain & Arah Estetika
**Gaya Utama:** *Clean Civic Workspace* (Utilitas Pemerintahan & Teknis Modern).
Aplikasi ini digunakan oleh berbagai kalangan—mulai dari staf teknis GIS hingga staf administrasi perangkat daerah yang awam teknologi—untuk mengisi formulir metadata panjang tanpa merasa terintimidasi atau lelah mata.

### Prinsip Inti:
1. **Kejelasan di Atas Dekorasi:** Hirarki visual dibentuk melalui tipografi, jarak ruang (*whitespace*), dan garis batas halus (`1px`), bukan lewat efek visual mencolok.
2. **Ramah & Tidak Kaku:** Sudut komponen sedikit membulat namun tetap tegas (`rounded-lg` / `8px`), bahasa antarmuka manusiawi, dan kepadatan form longgar agar mudah dipindai mata.
3. **Tenang untuk Kerja Durasi Lama:** Warna latar tidak memantulkan silau berlebih di *Light Mode*, dan tidak menggunakan hitam pekat `#000000` yang membuat teks berpendar (*halation*) di *Dark Mode*.

---

## 2. Aturan Ketat Anti-Slop (WAJIB DITAATI)
- **DILARANG** menggunakan teks bergradasi (`bg-gradient-to-r bg-clip-text text-transparent`).
- **DILARANG** menggunakan tombol bergradasi warna-warni, efek *glow/neon shadow*, atau *glassmorphism* berlebihan (`backdrop-blur` berat di atas lingkaran warna-warni).
- **DILARANG** menambahkan ornamen latar belakang seperti *floating blobs*, *mesh gradients*, partikel, atau ilustrasi kartun/3D generik.
- **DILARANG** membuat halaman *marketing landing page* panjang berisi *hero banner* promosi, kalimat jargon ("Revolusi Pengelolaan Metadata Anda!"), atau kartu fitur palsu. Halaman awal harus langsung berupa **Workspace Pemilih Sumber Metadata** yang fungsional dan ringkas.
- **DILARANG** menyisipkan emoji (🚀, ✨, 📁, ✅, ⚠️) di judul halaman, label form, tombol, maupun pesan validasi. Gunakan ikon vektor garis konsisten dari `lucide-react` (`strokeWidth={1.75}`).
- **DILARANG** menggunakan animasi memantul (*spring/bounce*) atau efek membesar saat kursor lewat (`hover:scale-105`). Transisi dibatasi pada perubahan warna latar/border halus (`transition-colors duration-150`).
- **DILARANG** menumpuk kartu di dalam kartu hingga lebih dari 2 lapis (*nested card hell*). Gunakan garis pemisah horizontal (`Separator`) atau pengelompokan latar tipis untuk sub-bagian di dalam satu kartu.

---

## 3. Tipografi
Gunakan pasangan font dari `next/font/google` yang tidak kaku, hangat, dan memiliki keterbacaan karakter tinggi untuk teks Bahasa Indonesia panjang:

- **Font Utama (UI, Heading, Label & Input Form):** **`Plus Jakarta Sans`**
  - Bobot yang dimuat: `400` (Regular), `500` (Medium), `600` (SemiBold), `700` (Bold).
  - Alasan: Bentuk huruf humanis-geometris modern yang terbuka, tidak sekaku Inter/Roboto maupun kaku seperti font sistem lawas, serta sangat jelas membedakan karakter `I`, `l`, `1`, dan `0`, `O`.
- **Font Teknis / Monospace (UUID, Kode EPSG, Koordinat Bounding Box, URL & Pratinjau XML):** **`JetBrains Mono`**
  - Bobot yang dimuat: `400`, `500`.

### Skala Ukuran & Keterbacaan:
- **Judul Halaman / Nama Dataset Aktif:** `text-xl` (`20px`), `font-semibold`, `tracking-tight`.
- **Judul Seksi Form:** `text-base` (`16px`), `font-semibold`.
- **Label Input Form:** `text-sm` (`14px`), `font-medium` (jangan pernah gunakan `uppercase tracking-wider` kecil untuk label form karena sulit dibaca).
- **Teks di Dalam Input & Textarea:** `text-[15px]` atau `text-sm` (`14px`–`15px`) dengan `leading-relaxed` pada textarea agar nyaman dibaca pengguna segala usia.
- **Teks Bantuan / Penjelasan Kontekstual di Bawah Label:** `text-[13px]` (`leading-normal`), warna *muted foreground*. Dilarang menggunakan ukuran mikro di bawah `12px` untuk instruksi penting.

---

## 4. Sistem Warna (Aksen Biru-Hijau / Oceanic Teal + Light & Dark Mode)

Implementasikan tema menggunakan `next-themes` (`attribute="class"`, mendukung `light`, `dark`, dan `system`) dengan tombol *switch* tema yang selalu mudah dijangkau di bilah navigasi atas (*Top Header*).

### Palet Warna Eksplisit (CSS Variables / Tailwind Tokens):

#### A. Light Mode (`:root`)
- **Background Halaman Utama (`--background`):** `#F6F8FA` (Abu-kebiruan sangat lembut agar kartu putih terlihat bersih tanpa bayangan tebal).
- **Permukaan Kartu & Input (`--card` / `--surface`):** `#FFFFFF`
- **Permukaan Sekunder / Area Terkunci (`--muted`):** `#EFF3F6`
- **Garis Batas (`--border`):** `#CBD5E1` untuk input form (agar batas kotak input jelas terlihat oleh orang awam, bukan abu-abu pudar yang nyaris hilang!), dan `#E2E8F0` untuk pembatas kartu.
- **Teks Utama (`--foreground`):** `#0F172A` (Slate 900)
- **Teks Sekunder / Bantuan (`--muted-foreground`):** `#475569` (Slate 600 — kontras memenuhi standar aksesibilitas WCAG AA).
- **Aksen Utama Biru-Hijau (`--primary`):** `#0E7490` (Oceanic Cyan-Teal — tegas, profesional, kontras > 5.0:1 terhadap teks putih `#FFFFFF`).
  - Hover Primary: `#155E75`
- **Aksen Sekunder / Indikator Aktif (`--accent-teal`):** `#0D9488` (Teal 600 — untuk *progress bar*, *step* aktif/selesai, dan *focus ring* lembut `#0E7490/20`).
- ** Permukaan Aksen Lembut (`--primary-subtle`):** `#ECFEFF` / `#F0FDFA` (latar tipis tab aktif atau *callout* informasi).

#### B. Dark Mode (`.dark`)
- **Background Halaman Utama (`--background`):** `#0B1218` (Deep Petrol Slate — tenang di mata, bukan hitam mati).
- **Permukaan Kartu (`--card`):** `#111B24`
- **Permukaan Input Form:** `#0E161E` dengan border `#2A3B4C` (kotak input harus tampak sedikit cekung dan jelas batasnya).
- **Permukaan Sekunder / Area Terkunci (`--muted`):** `#172430`
- **Garis Batas (`--border`):** `#22313F`
- **Teks Utama (`--foreground`):** `#F1F5F9`
- **Teks Sekunder / Bantuan (`--muted-foreground`):** `#94A3B8`
- **Aksen Utama Biru-Hijau (`--primary`):** `#22D3EE` dipadukan nuansa `#2DD4BF` (gunakan `#14B8A6` / `#06B6D4` dengan teks tombol gelap `#042F2E` atau `#083344` agar sangat tajam dan nyaman dibaca di ruang gelap).
  - Hover Primary: `#2DD4BF`
- **Permukaan Aksen Lembut (`--primary-subtle`):** `#0F2933` (dengan border `#164E63`).

#### C. Warna Status Kewajiban Elemen (Pengganti Kotak Merah/Kuning/Hijau Mencolok CatMDEdit)
Gunakan komponen *Pill Badge* berukuran ringkas (`text-xs font-medium px-2 py-0.5 rounded-md border`) dengan warna teredam:
- **Wajib (Mandatory):**
  - Light: `bg-rose-50 text-rose-700 border-rose-200`
  - Dark: `bg-rose-950/40 text-rose-300 border-rose-800/60`
- **Bersyarat (Conditional):**
  - Light: `bg-amber-50 text-amber-800 border-amber-200`
  - Dark: `bg-amber-950/40 text-amber-300 border-amber-800/60`
- **Opsional (Optional):**
  - Light: `bg-slate-100 text-slate-600 border-slate-200`
  - Dark: `bg-slate-800/60 text-slate-400 border-slate-700`
  *(Catatan: Jangan gunakan warna hijau terang untuk badge "Opsional" agar mata pengguna tidak salah mengira kolom tersebut "sudah selesai diisi". Simpan warna hijau/teal khusus untuk indikator "Valid / Lengkap"!)*.

---

## 5. Tata Letak (Layout) & Anatomi Komponen

### A. Halaman Awal (Pemilih Sumber Metadata)
- Tampilkan kontainer terpusat (`max-w-3xl mx-auto py-12 px-4`) berisi:
  1. Header ringkas: Nama aplikasi, subjudul fungsi 1 kalimat lugas, tombol *Preset Buku Kontak*, dan tombol *Switch Dark/Light*.
  2. Tiga pilihan metode kerja yang bersih dalam bentuk **Tab atau Kartu Aksi Fungsional**:
     - **Tarik dari URL GeoNode** (aktif secara default: satu baris input URL lebar + tombol aksi utama `Muat Metadata`, serta opsi lipat *"Dataset privat? Masukkan akun GeoNode"*).
     - **Unggah File `.xml` Komputer** (area *dropzone* bersih bergaris putus-putus halus).
     - **Buat Metadata Baru** (tombol inisialisasi template SNI ISO 19115 kosong).
  3. Pita *Resume Draft* kecil di bagian bawah **hanya jika** terdeteksi ada draf sebelumnya yang tersimpan di `localStorage`.

### B. Workspace Editor Utama (2 Kolom Asimetris yang Fokus)
Gunakan kontainer maksimal `max-w-7xl mx-auto` dengan struktur:
1. **Sticky Top Bar (`h-14`, `border-b`):**
   - Kiri: Tombol kembali/ganti file + Judul dataset aktif + badge sumber (`GeoNode Linked` atau `File Lokal`).
   - Tengah/Kanan:
     - Switch **Mode Ringkas** vs **Mode Lengkap (13 Elemen)** dengan *segmented control* yang jelas.
     - Indikator progres pengisian elemen wajib (misal: `11/12 Wajib Terisi`).
     - Tombol **Switch Tema (Light/Dark)**.
     - Tombol sekunder **Unduh `.xml`** & tombol primer biru-hijau **Simpan ke GeoNode**.
2. **Sidebar Navigasi Wizard di Kiri (`w-64` pada layar `lg:`, berubah menjadi *Horizontal Stepper* rapi di layar tablet/mobile):**
   - Menampilkan **Langkah 1 s/d Langkah 5** secara vertikal.
   - Setiap langkah menampilkan nomor, nama langkah dalam Bahasa Indonesia, subteks ringkas elemen yang dicakup, serta ikon status kecil di kanan (titik merah lembut jika masih ada kolom *Wajib* yang kosong/bernilai placeholder GeoNode, atau centang biru-hijau jika seluruh isian wajib pada langkah tersebut beres).
   - Pengguna bebas berpindah antar-langkah kapan saja tanpa dikunci paksa (*non-blocking navigation*), sementara validasi penuh diperiksa saat pratinjau akhir/simpan.
3. **Area Formulir Utama di Kanan (`flex-1 max-w-4xl`):**
   - Dibagi menjadi kartu-kartu seksi logis (`bg-card border rounded-xl p-6 shadow-xs space-y-5`).
   - **Anatomi Setiap Field Input (Standar Konsisten):**
     - Baris atas: **Label Bahasa Indonesia** + **Badge Kewajiban** (`Wajib` / `Bersyarat` / `Opsional`) + tag kode ISO kecil opsional (`font-mono text-xs text-muted-foreground`, hanya tampil jika pengguna mengaktifkan tampilan kode teknis).
     - Baris kedua (jika perlu penjelasan): Kalimat panduan singkat 1 baris dalam Bahasa Indonesia sederhana *langsung terlihat di bawah label* (jangan menyembunyikan informasi krusial di balik ikon `?` yang harus di-*hover*, karena pengguna awam jarang melakukan *hover*!).
     - Baris ketiga: Komponen Input / Select / Textarea dengan ukuran tinggi minimal `h-10` (`40px`) agar mudah diklik.
     - Baris keempat: Pesan validasi spesifik berwarna merah lembut jika belum valid.
   - **Footer Navigasi di Bawah Form:** Tombol `Sebelumnya` dan `Langkah Berikutnya` agar pengguna mengalir secara alami dari Langkah 1 hingga Langkah 5.

### C. Desain Khusus Komponen Kunci
1. **Kartu Kontak (`CI_ResponsibleParty`) Terbuka:**
   - Tampil dalam kotak berbingkai rapi dengan header berisi dropdown **"Isi Cepat dari Buku Kontak"** dan tombol **"Simpan ke Buku Kontak"**.
   - Tata letak *grid* 2 kolom pada layar desktop (Nama Individu & Jabatan; Nama Instansi penuh 2 kolom; Telepon & Email; Alamat, Kota, Provinsi, Kode Pos) sehingga tidak memanjang berlebihan ke bawah namun seluruh cabangnya langsung terlihat tanpa klik tambahan.
2. **Kotak Proteksi Tautan Otomatis GeoNode (Langkah 4):**
   - Gunakan latar `--muted` dengan aksen garis kiri biru-hijau (`border-l-4 border-l-primary`), ikon gembok kecil (`Lock`), dan daftar ringkas tautan bawaan (`WMS`, `WFS`, `ZIP Shapefile`, `GeoJSON`, `PDF`, dll.) dalam tabel kompak 1 baris per item agar 13 tautan bawaan GeoNode tidak memenuhi layar.