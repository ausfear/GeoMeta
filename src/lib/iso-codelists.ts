export interface CodelistItem {
  code: string;
  label: string;
  description: string;
}

export const CI_ROLE_CODES: CodelistItem[] = [
  { code: "author", label: "Pembuat Metadata (Author)", description: "Pihak yang menyusun atau mendokumentasikan metadata." },
  { code: "custodian", label: "Pengelola Data (Custodian)", description: "Pihak yang bertanggung jawab atas pemeliharaan dan pembaruan data." },
  { code: "distributor", label: "Penyalur (Distributor)", description: "Pihak yang mendistribusikan dataset ke publik atau pemangku kepentingan." },
  { code: "originator", label: "Pembuat Data Asli (Originator)", description: "Pihak yang pertama kali menghasilkan data mentah atau survei awal." },
  { code: "owner", label: "Pemilik Data (Owner)", description: "Instansi atau organisasi yang memiliki hak kepemilikan yuridis atas data." },
  { code: "pointOfContact", label: "Narahubung (Point of Contact)", description: "Pihak yang dapat dihubungi untuk pertanyaan atau klarifikasi mengenai data." },
  { code: "principalInvestigator", label: "Peneliti Utama (Principal Investigator)", description: "Peneliti atau analis penanggung jawab kegiatan pengumpulan data." },
  { code: "processor", label: "Pemroses Data (Processor)", description: "Pihak yang mengolah atau memodifikasi data dari bentuk mentah." },
  { code: "publisher", label: "Penerbit (Publisher)", description: "Pihak yang secara resmi mempublikasikan dataset." },
  { code: "resourceProvider", label: "Penyedia Sumber Daya (Resource Provider)", description: "Pihak yang menyediakan data atau layanan pendukung." },
  { code: "user", label: "Pengguna (User)", description: "Pihak yang menggunakan dataset untuk analisis atau visualisasi." },
];

export const MD_PROGRESS_CODES: CodelistItem[] = [
  { code: "completed", label: "Selesai (Completed)", description: "Data telah selesai disusun dan diverifikasi secara menyeluruh." },
  { code: "onGoing", label: "Pembaruan Berkala (On Going)", description: "Data terus diperbarui atau ditingkatkan secara berkesinambungan." },
  { code: "underDevelopment", label: "Dalam Pengembangan (Under Development)", description: "Data sedang dalam proses pengolahan, penyempurnaan, atau penyesuaian." },
  { code: "planned", label: "Dalam Perencanaan (Planned)", description: "Pengumpulan atau pembuatan data telah direncanakan untuk masa depan." },
  { code: "historicalArchive", label: "Diarsipkan (Historical Archive)", description: "Data historis yang tidak lagi diperbarui namun disimpan untuk dokumentasi." },
  { code: "obsolete", label: "Usang (Obsolete)", description: "Data sudah tidak berlaku dan telah digantikan oleh versi yang lebih baru." },
  { code: "required", label: "Diperlukan (Required)", description: "Data diwajibkan oleh regulasi atau kebutuhan teknis namun belum tersedia." },
];

export const CI_DATE_TYPE_CODES: CodelistItem[] = [
  { code: "creation", label: "Pembuatan (Creation)", description: "Tanggal data selesai dibuat untuk pertama kalinya." },
  { code: "publication", label: "Publikasi (Publication)", description: "Tanggal data diterbitkan secara resmi kepada pengguna/publik." },
  { code: "revision", label: "Revisi (Revision)", description: "Tanggal data diperiksa ulang atau dimodifikasi versinya." },
];

export const CI_PRESENTATION_FORM_CODES: CodelistItem[] = [
  { code: "mapDigital", label: "Peta Digital (mapDigital)", description: "Peta dalam format digital (vektor/raster) yang dapat diolah SIG." },
  { code: "mapHardcopy", label: "Peta Cetak (mapHardcopy)", description: "Peta fisik yang dicetak di atas kertas atau media fisik lain." },
  { code: "imageDigital", label: "Citra Digital (imageDigital)", description: "Foto udara, citra satelit, atau data raster penginderaan jauh." },
  { code: "documentDigital", label: "Dokumen Digital (documentDigital)", description: "Laporan, buku petunjuk, atau naskah kajian dalam format digital." },
  { code: "tableDigital", label: "Tabel Digital (tableDigital)", description: "Data statistik atau tabular dalam format spreadsheet/basis data." },
  { code: "modelDigital", label: "Model Digital (modelDigital)", description: "Model permukaan digital (DEM/DSM) atau model elevasi 3D." },
  { code: "videoDigital", label: "Video Digital (videoDigital)", description: "Rekaman video atau animasi perkembangan spasial digital." },
];

/**
 * 21 klasifikasi topik SNI 8843-1:2019 sesuai Tabel 1 SE Kepala BIG No. 6 Tahun 2021.
 * Kode 20 dan 21 berasal dari ISO 19115-1:2014 dan tidak dikenal XSD ISO 19139:2007,
 * sehingga dijembatani lewat TOPIC_XSD_BRIDGE saat ditulis ke XML.
 */
export const MD_TOPIC_CATEGORIES: CodelistItem[] = [
  { code: "farming", label: "Pertanian/peternakan", description: "Lahan sawah, perkebunan, peternakan, perikanan budidaya, dan irigasi pertanian." },
  { code: "biota", label: "Biota", description: "Habitat satwa, persebaran flora, keanekaragaman hayati, dan ekosistem." },
  { code: "boundaries", label: "Batas wilayah", description: "Batas negara, provinsi, kabupaten/kota, kecamatan, hingga desa/kelurahan." },
  { code: "climatologyMeteorologyAtmosphere", label: "Klimatologi, meteorologi, atmosfer", description: "Curah hujan, suhu udara, kecepatan angin, dan stasiun cuaca." },
  { code: "economy", label: "Ekonomi", description: "Kawasan industri, sentra bisnis, pasar, pariwisata, dan potensi ekonomi." },
  { code: "elevation", label: "Elevasi", description: "Garis kontur, titik tinggi, model elevasi digital (DEM), dan batimetri." },
  { code: "environment", label: "Lingkungan", description: "Kawasan lindung, konservasi, pencemaran, dan kualitas lingkungan." },
  { code: "geoscientificInformation", label: "Geoinformasi/geosains", description: "Formasi geologi, jenis tanah, potensi tambang, dan sesar." },
  { code: "health", label: "Kesehatan", description: "Rumah sakit, puskesmas, dan sebaran kesehatan masyarakat." },
  { code: "imageryBaseMapsEarthCover", label: "Citra satelit/basemap", description: "Citra satelit, ortofoto, peta rupabumi, dan tutupan lahan." },
  { code: "intelligenceMilitary", label: "Intelijen/militer", description: "Pangkalan militer, pos perbatasan, dan wilayah strategis pertahanan." },
  { code: "inlandWaters", label: "Air di darat", description: "Sungai, danau, waduk, jaringan irigasi, dan daerah aliran sungai." },
  { code: "location", label: "Lokasi", description: "Titik kontrol geodetik, toponim, dan alamat." },
  { code: "oceans", label: "Lautan", description: "Garis pantai, terumbu karang, oseanografi, dan pasang surut." },
  { code: "planningCadastre", label: "Perencanaan/kadaster", description: "Rencana tata ruang (RTRW/RDTR), bidang tanah, dan zonasi." },
  { code: "society", label: "Sosial masyarakat", description: "Kependudukan, cagar budaya, dan fasilitas sosial." },
  { code: "structure", label: "Konstruksi/struktur", description: "Gedung, fasilitas umum, bendungan, dan bangunan binaan." },
  { code: "transportation", label: "Transportasi", description: "Jalan, rel kereta api, bandara, pelabuhan, dan jalur logistik." },
  { code: "utilitiesCommunication", label: "Utilitas/komunikasi", description: "Jaringan listrik, pipa air/gas, dan menara telekomunikasi." },
  { code: "extraTerrestrial", label: "Ekstra terestrial", description: "Wilayah lebih dari 100 km di atas permukaan bumi, mis. data antariksa." },
  { code: "disaster", label: "Bencana", description: "Rawan bencana, kejadian bencana, dan mitigasi risiko bencana." },
];

/** Thesaurus penanda jembatan topik 20 & 21 di <gmd:descriptiveKeywords>. */
export const PROMSI_THESAURUS = "SNI 8843-1:2019";

/** Topik ProMSI di luar enumerasi XSD ISO 19139: kode ISO terdekat + kata kunci penanda. */
export const TOPIC_XSD_BRIDGE: Record<string, { isoCode: string; keyword: string }> = {
  disaster: { isoCode: "environment", keyword: "Bencana" },
  extraTerrestrial: { isoCode: "geoscientificInformation", keyword: "Ekstra terestrial" },
};

export const MD_KEYWORD_TYPE_CODES: CodelistItem[] = [
  { code: "theme", label: "Tema", description: "Subjek atau topik data, mis. irigasi, sumber daya air." },
  { code: "place", label: "Lokasi", description: "Nama tempat atau wilayah, mis. Kalimantan Timur, Samarinda." },
  { code: "temporal", label: "Waktu", description: "Periode waktu, mis. 2024, Triwulan III." },
  { code: "discipline", label: "Disiplin", description: "Bidang ilmu, mis. hidrologi, geodesi." },
  { code: "stratum", label: "Strata", description: "Lapisan atau tingkatan, mis. permukaan, bawah tanah." },
];

export const MD_MAINTENANCE_FREQUENCY_CODES: CodelistItem[] = [
  { code: "continual", label: "Berkelanjutan (Continual)", description: "Data diperbarui terus menerus saat terjadi perubahan di lapangan." },
  { code: "daily", label: "Harian (Daily)", description: "Data diperbarui setiap hari kerja." },
  { code: "weekly", label: "Mingguan (Weekly)", description: "Data diperbarui seminggu sekali." },
  { code: "fortnightly", label: "Dua Mingguan (Fortnightly)", description: "Data diperbarui setiap dua minggu." },
  { code: "monthly", label: "Bulanan (Monthly)", description: "Data diperbarui sebulan sekali." },
  { code: "quarterly", label: "Triwulanan (Quarterly)", description: "Data diperbarui setiap 3 bulan." },
  { code: "biannually", label: "Semesteran (Biannually)", description: "Data diperbarui setiap 6 bulan." },
  { code: "annually", label: "Tahunan (Annually)", description: "Data diperbarui setahun sekali." },
  { code: "asNeeded", label: "Sesuai Kebutuhan (As Needed)", description: "Data diperbarui hanya bila ada perubahan atau permohonan khusus." },
  { code: "irregular", label: "Tidak Terjadwal (Irregular)", description: "Pembaruan tidak mengikuti interval waktu yang pasti." },
  { code: "notPlanned", label: "Tidak Diperbarui (Not Planned)", description: "Tidak ada rencana pembaruan lebih lanjut untuk dataset ini." },
  { code: "unknown", label: "Tidak Diketahui (Unknown)", description: "Frekuensi pembaruan belum dapat dipastikan." },
];

export const MD_SCOPE_CODES: CodelistItem[] = [
  { code: "dataset", label: "Dataset", description: "Satu kumpulan data yang dapat diidentifikasi." },
  { code: "series", label: "Seri", description: "Kumpulan dataset dengan spesifikasi produk yang sama." },
  { code: "featureType", label: "Tipe unsur", description: "Satu jenis unsur geografi di dalam dataset." },
  { code: "feature", label: "Unsur", description: "Satu objek unsur geografi." },
  { code: "attribute", label: "Atribut", description: "Satu atribut unsur." },
  { code: "tile", label: "Ubin (tile)", description: "Bagian dataset hasil pemotongan wilayah." },
  { code: "nonGeographicDataset", label: "Dataset non-geografis", description: "Data tanpa komponen lokasi." },
];

export const MD_RESTRICTION_CODES: CodelistItem[] = [
  { code: "license", label: "Lisensi Khusus (license)", description: "Penggunaan data diatur melalui dokumen lisensi tertentu." },
  { code: "copyright", label: "Hak Cipta (copyright)", description: "Data dilindungi undang-undang hak cipta instansi pembuat." },
  { code: "patent", label: "Paten (patent)", description: "Data memuat penemuan yang dipatenkan." },
  { code: "intellectualPropertyRights", label: "Hak Kekayaan Intelektual (intellectualPropertyRights)", description: "Data memuat hak kekayaan intelektual." },
  { code: "restricted", label: "Terbatas (restricted)", description: "Akses atau penggunaan dibatasi hanya untuk pihak yang berwenang." },
  { code: "otherRestrictions", label: "Batasan Lainnya (otherRestrictions)", description: "Batasan spesifik lain (wajib mengisi penjelasan rinci batasan)." },
];

export const MD_CLASSIFICATION_CODES: CodelistItem[] = [
  { code: "unclassified", label: "Terbuka (Unclassified)", description: "Informasi publik yang dapat diakses secara bebas tanpa batasan." },
  { code: "restricted", label: "Terbatas (Restricted)", description: "Informasi untuk kalangan dinas internal atau mitra tertentu." },
  { code: "confidential", label: "Rahasia (Confidential)", description: "Informasi yang jika terbuka dapat merugikan kepentingan dinas." },
  { code: "secret", label: "Sangat Rahasia (Secret)", description: "Informasi strategis berkeamanan tinggi." },
  { code: "topSecret", label: "Rahasia Negara (Top Secret)", description: "Informasi berkualifikasi tertinggi bagi keamanan negara." },
];

export const SPATIAL_REPRESENTATION_TYPES: CodelistItem[] = [
  { code: "vector", label: "Vektor (Vector)", description: "Titik, garis, atau poligon (Shapefile, GeoJSON, GeoPackage)." },
  { code: "grid", label: "Grid / Raster (Grid)", description: "Matriks piksel (GeoTIFF, NetCDF, HDF)." },
  { code: "textTable", label: "Tabel Teks (Text Table)", description: "Tabel berkoordinat XY (CSV, TSV)." },
  { code: "tin", label: "TIN (Triangulated Irregular Network)", description: "Jaring segitiga untuk representasi permukaan." },
  { code: "stereoModel", label: "Model Stereo (Stereo Model)", description: "Pasangan citra stereo untuk pengukuran 3D." },
  { code: "video", label: "Video", description: "Rekaman video bergeoreferensi." },
];

export const TOPOLOGY_LEVEL_CODES: CodelistItem[] = [
  { code: "geometryOnly", label: "Geometri saja (geometryOnly)", description: "Koordinat tanpa relasi topologi antar-objek." },
  { code: "topology1D", label: "Topologi 1D (topology1D)", description: "Konektivitas jaringan garis (node dan link)." },
  { code: "planarGraph", label: "Graf planar (planarGraph)", description: "Jaringan garis 2D tanpa persimpangan tak ber-node." },
  { code: "fullPlanarGraph", label: "Graf planar lengkap (fullPlanarGraph)", description: "Jaringan garis dan poligon 2D dengan topologi lengkap." },
  { code: "surfaceGraph", label: "Graf permukaan (surfaceGraph)", description: "Graf 1D yang setara dengan permukaan." },
  { code: "fullSurfaceGraph", label: "Graf permukaan lengkap (fullSurfaceGraph)", description: "Graf 2D yang setara dengan permukaan." },
  { code: "topology3D", label: "Topologi 3D (topology3D)", description: "Kompleks topologi 3D." },
  { code: "fullTopology3D", label: "Topologi 3D lengkap (fullTopology3D)", description: "Cakupan lengkap ruang 3D." },
  { code: "abstract", label: "Abstrak (abstract)", description: "Kompleks topologi tanpa realisasi geometri." },
];

export const GEOMETRIC_OBJECT_TYPE_CODES: CodelistItem[] = [
  { code: "point", label: "Titik (point)", description: "Lokasi tunggal berkoordinat XY." },
  { code: "curve", label: "Garis (curve)", description: "Unsur linier seperti sungai, jalan, saluran irigasi." },
  { code: "surface", label: "Poligon (surface)", description: "Luasan tertutup seperti batas desa atau kawasan." },
  { code: "complex", label: "Kompleks (complex)", description: "Gabungan beberapa tipe geometri." },
  { code: "composite", label: "Komposit (composite)", description: "Kumpulan geometri sejenis yang saling terhubung." },
  { code: "solid", label: "Solid (solid)", description: "Geometri 3D tertutup." },
];

export const MD_CELL_GEOMETRY_CODES: CodelistItem[] = [
  { code: "area", label: "Area", description: "Nilai sel mewakili seluruh luasan sel." },
  { code: "point", label: "Titik", description: "Nilai sel mewakili satu titik pengukuran." },
];

export const MD_PIXEL_ORIENTATION_CODES: CodelistItem[] = [
  { code: "center", label: "Tengah piksel (center)", description: "Titik acuan berada di tengah piksel." },
  { code: "lowerLeft", label: "Kiri bawah (lowerLeft)", description: "Titik acuan di sudut kiri bawah piksel." },
  { code: "lowerRight", label: "Kanan bawah (lowerRight)", description: "Titik acuan di sudut kanan bawah piksel." },
  { code: "upperRight", label: "Kanan atas (upperRight)", description: "Titik acuan di sudut kanan atas piksel." },
  { code: "upperLeft", label: "Kiri atas (upperLeft)", description: "Titik acuan di sudut kiri atas piksel." },
];

export const MD_COVERAGE_CONTENT_TYPE_CODES: CodelistItem[] = [
  { code: "image", label: "Citra (image)", description: "Nilai piksel berupa pantulan atau intensitas citra." },
  { code: "thematicClassification", label: "Klasifikasi tematik (thematicClassification)", description: "Nilai piksel berupa kode kelas, mis. tutupan lahan." },
  { code: "physicalMeasurement", label: "Pengukuran fisik (physicalMeasurement)", description: "Nilai piksel berupa besaran fisik, mis. elevasi atau suhu." },
];

export const GRID_REPRESENTATION_CLASSES: CodelistItem[] = [
  { code: "grid", label: "Grid umum", description: "MD_GridSpatialRepresentation: dimensi dan ukuran sel saja." },
  { code: "georectified", label: "Tergeorektifikasi", description: "MD_Georectified: grid sudah terkoreksi ke sistem koordinat, mis. ortofoto." },
  { code: "georeferenceable", label: "Dapat digeoreferensi", description: "MD_Georeferenceable: grid dengan parameter kontrol/orientasi, mis. citra mentah." },
];

export const DQ_EVALUATION_METHOD_TYPE_CODES: CodelistItem[] = [
  { code: "directInternal", label: "Evaluasi langsung internal", description: "Diperiksa hanya terhadap data itu sendiri." },
  { code: "directExternal", label: "Evaluasi langsung eksternal", description: "Dibandingkan dengan data acuan di luar dataset." },
  { code: "indirect", label: "Evaluasi tidak langsung", description: "Disimpulkan dari informasi lain, mis. silsilah." },
];

export interface QualityElementDef {
  code: string;
  label: string;
  category: string;
  measureHint: string;
}

/** 15 sub-elemen kualitas data SNI ISO 19157 dalam 5 kategori SE 6/2021. Kode = nama kelas XSD gmd:. */
export const DQ_ELEMENT_TYPES: QualityElementDef[] = [
  { code: "DQ_CompletenessCommission", category: "Kelengkapan", label: "Komisi (kelebihan data)", measureHint: "Persentase unsur berlebih terhadap data acuan" },
  { code: "DQ_CompletenessOmission", category: "Kelengkapan", label: "Omisi (ketiadaan data)", measureHint: "Persentase unsur yang tidak terekam" },
  { code: "DQ_ConceptualConsistency", category: "Konsistensi logis", label: "Konsistensi konseptual", measureHint: "Jumlah unsur yang melanggar skema konseptual" },
  { code: "DQ_DomainConsistency", category: "Konsistensi logis", label: "Konsistensi domain / atribut KUGI", measureHint: "Persentase nilai atribut di luar domain KUGI" },
  { code: "DQ_FormatConsistency", category: "Konsistensi logis", label: "Konsistensi format", measureHint: "Jumlah kesalahan struktur format berkas" },
  { code: "DQ_TopologicalConsistency", category: "Konsistensi logis", label: "Konsistensi topologis", measureHint: "Persentase kesalahan topologi overlap/gap" },
  { code: "DQ_AbsoluteExternalPositionalAccuracy", category: "Akurasi posisi", label: "Akurasi posisi absolut / eksternal", measureHint: "RMSE horizontal terhadap titik uji (CE90)" },
  { code: "DQ_GriddedDataPositionalAccuracy", category: "Akurasi posisi", label: "Akurasi posisi data grid", measureHint: "RMSE posisi piksel terhadap titik kontrol" },
  { code: "DQ_RelativeInternalPositionalAccuracy", category: "Akurasi posisi", label: "Akurasi posisi relatif / internal", measureHint: "Selisih jarak relatif antarunsur" },
  { code: "DQ_ThematicClassificationCorrectness", category: "Akurasi tematik", label: "Kebenaran klasifikasi tematik", measureHint: "Akurasi keseluruhan matriks kesalahan (overall accuracy)" },
  { code: "DQ_NonQuantitativeAttributeAccuracy", category: "Akurasi tematik", label: "Kebenaran atribut non-kuantitatif", measureHint: "Persentase atribut kualitatif yang salah" },
  { code: "DQ_QuantitativeAttributeAccuracy", category: "Akurasi tematik", label: "Akurasi atribut kuantitatif", measureHint: "RMSE nilai atribut terukur" },
  { code: "DQ_AccuracyOfATimeMeasurement", category: "Akurasi temporal", label: "Akurasi waktu pengukuran", measureHint: "Selisih waktu rekaman terhadap waktu sebenarnya" },
  { code: "DQ_TemporalConsistency", category: "Akurasi temporal", label: "Konsistensi temporal", measureHint: "Jumlah urutan kejadian yang tidak konsisten" },
  { code: "DQ_TemporalValidity", category: "Akurasi temporal", label: "Validitas temporal", measureHint: "Persentase nilai waktu di luar rentang berlaku" },
];

export const DQ_CATEGORIES = Array.from(new Set(DQ_ELEMENT_TYPES.map((d) => d.category)));

export function getQualityElement(code: string): QualityElementDef | undefined {
  return DQ_ELEMENT_TYPES.find((d) => d.code === code);
}

export const QUALITY_PACKAGES: Record<"vector" | "raster", { label: string; elements: string[] }> = {
  vector: {
    label: "Muat paket kualitas vektor (omisi, komisi, topologi, domain KUGI)",
    elements: ["DQ_CompletenessOmission", "DQ_CompletenessCommission", "DQ_TopologicalConsistency", "DQ_DomainConsistency"],
  },
  raster: {
    label: "Muat paket kualitas raster (posisi grid & klasifikasi tematik)",
    elements: ["DQ_GriddedDataPositionalAccuracy", "DQ_ThematicClassificationCorrectness"],
  },
};

export interface EpsgPreset {
  code: string;
  label: string;
  note?: string;
}

/**
 * Kode sesuai registri EPSG (diverifikasi di epsg.io): SRGI2013 geografis 2D = 9470,
 * UTM 46N–52N = 9476–9482, UTM 47S–54S = 9487–9494. EPSG:9489 adalah UTM 49S, bukan geografis.
 */
const SRGI_UTM_NORTH = [46, 47, 48, 49, 50, 51, 52].map((zone, i) => ({ zone, code: 9476 + i }));
const SRGI_UTM_SOUTH = [47, 48, 49, 50, 51, 52, 53, 54].map((zone, i) => ({ zone, code: 9487 + i }));
const KALTIM_ZONES: Record<string, string> = { "50N": "Kalimantan Timur bagian utara", "50S": "Kalimantan Timur bagian selatan" };

export const EPSG_GROUPS: Array<{ label: string; presets: EpsgPreset[] }> = [
  {
    label: "SRGI 2013 (rekomendasi utama BIG)",
    presets: [
      { code: "9470", label: "SRGI 2013 Geografis 2D" },
      ...SRGI_UTM_NORTH.map(({ zone, code }) => ({ code: String(code), label: `SRGI 2013 / UTM ${zone}N`, note: KALTIM_ZONES[`${zone}N`] })),
      ...SRGI_UTM_SOUTH.map(({ zone, code }) => ({ code: String(code), label: `SRGI 2013 / UTM ${zone}S`, note: KALTIM_ZONES[`${zone}S`] })),
    ],
  },
  {
    label: "WGS 84 & web",
    presets: [
      { code: "4326", label: "WGS 84 Geografis" },
      { code: "3857", label: "WGS 84 / Pseudo-Mercator" },
      ...[46, 47, 48, 49, 50, 51, 52, 53, 54].map((z) => ({ code: String(32600 + z), label: `WGS 84 / UTM ${z}N` })),
      ...[47, 48, 49, 50, 51, 52, 53, 54].map((z) => ({ code: String(32700 + z), label: `WGS 84 / UTM ${z}S` })),
    ],
  },
];

export const EPSG_PRESETS: EpsgPreset[] = EPSG_GROUPS.flatMap((g) => g.presets);

export function findEpsgPreset(code: string): EpsgPreset | undefined {
  return EPSG_PRESETS.find((p) => p.code === code.replace(/^EPSG:/i, "").trim());
}

export const SCALE_PRESETS = [
  { denominator: 5000, label: "1:5.000 (peta desa/kelurahan)" },
  { denominator: 10000, label: "1:10.000 (kawasan perkotaan)" },
  { denominator: 25000, label: "1:25.000 (RDTR / kecamatan)" },
  { denominator: 50000, label: "1:50.000 (RTRW kabupaten)" },
  { denominator: 100000, label: "1:100.000 (wilayah)" },
  { denominator: 250000, label: "1:250.000 (RTRW provinsi)" },
];

export const HIERARCHY_LEVEL_NAME_PRESETS = ["Nasional", "Provinsi", "Kabupaten/Kota", "Kecamatan", "Desa/Kelurahan"];

export const LANGUAGE_CODES: CodelistItem[] = [
  { code: "ind", label: "Bahasa Indonesia (ind)", description: "" },
  { code: "eng", label: "Bahasa Inggris (eng)", description: "" },
];

export const CHARACTER_SET_CODES: CodelistItem[] = [
  { code: "utf8", label: "UTF-8 (utf8)", description: "Disarankan untuk semua metadata baru." },
  { code: "utf16", label: "UTF-16 (utf16)", description: "" },
  { code: "8859part1", label: "ISO 8859-1 (8859part1)", description: "" },
  { code: "usAscii", label: "US-ASCII (usAscii)", description: "" },
];

export const DISTRIBUTION_FORMAT_PRESETS = ["ESRI Shapefile", "GeoJSON", "GeoPackage", "GeoTIFF", "KML", "CSV"];

export const ONLINE_PROTOCOLS: CodelistItem[] = [
  { code: "OGC:WMS", label: "Layanan peta OGC WMS", description: "" },
  { code: "OGC:WFS", label: "Layanan unsur OGC WFS", description: "" },
  { code: "OGC:WMTS", label: "Layanan ubin OGC WMTS", description: "" },
  { code: "OGC:WCS", label: "Layanan coverage OGC WCS", description: "" },
  { code: "OGC:CSW", label: "Katalog OGC CSW", description: "" },
  { code: "WWW:DOWNLOAD-1.0-http--download", label: "Unduhan berkas", description: "" },
  { code: "WWW:LINK-1.0-http--link", label: "Tautan halaman web", description: "" },
];

export const CI_ONLINE_FUNCTION_CODES: CodelistItem[] = [
  { code: "download", label: "Unduhan", description: "" },
  { code: "information", label: "Informasi", description: "" },
  { code: "offlineAccess", label: "Akses luring", description: "" },
  { code: "order", label: "Pemesanan", description: "" },
  { code: "search", label: "Pencarian", description: "" },
];

export const SCHEMA_LANGUAGE_PRESETS = ["GML", "XML Schema", "UML"];
export const CONSTRAINT_LANGUAGE_PRESETS = ["OCL", "SQL"];

export const MD_DATATYPE_CODES: CodelistItem[] = [
  { code: "characterString", label: "Teks (characterString)", description: "" },
  { code: "class", label: "Kelas (class)", description: "" },
  { code: "codelist", label: "Daftar kode (codelist)", description: "" },
  { code: "enumeration", label: "Enumerasi (enumeration)", description: "" },
  { code: "codelistElement", label: "Elemen daftar kode (codelistElement)", description: "" },
  { code: "association", label: "Asosiasi (association)", description: "" },
];

export const MD_OBLIGATION_CODES: CodelistItem[] = [
  { code: "mandatory", label: "Wajib (mandatory)", description: "" },
  { code: "optional", label: "Opsional (optional)", description: "" },
  { code: "conditional", label: "Bersyarat (conditional)", description: "" },
];

export const GEOGRAPHIC_DESCRIPTION_PRESETS = ["Provinsi Kalimantan Timur", "Kota Samarinda", "Kota Balikpapan", "Kabupaten Kutai Kartanegara"];

/** Isi otomatis sitasi katalog unsur dari standar KUGI BIG. */
export const KUGI_CITATION = {
  title: "Katalog Unsur Geografi Indonesia (KUGI)",
  edition: "5.0",
  url: "https://kugi.ina-sdi.or.id",
  publisher: "Badan Informasi Geospasial",
};
