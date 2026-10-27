"use client";

import React from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { MetadataFormData, createDefaultContact, createEmptyKeywordGroup, todayIsoDate } from "@/lib/metadata-schema";
import {
  CI_DATE_TYPE_CODES,
  CI_PRESENTATION_FORM_CODES,
  GEOGRAPHIC_DESCRIPTION_PRESETS,
  MD_CLASSIFICATION_CODES,
  MD_KEYWORD_TYPE_CODES,
  MD_MAINTENANCE_FREQUENCY_CODES,
  MD_PROGRESS_CODES,
  MD_RESTRICTION_CODES,
  MD_SCOPE_CODES,
  MD_TOPIC_CATEGORIES,
  TOPIC_XSD_BRIDGE,
} from "@/lib/iso-codelists";
import { ContactCard } from "@/components/contact-card";
import { Button, EmptyList, IsoCode, ItemBlock, Section, StepHeader, checkboxClass } from "@/components/ui/form";
import {
  ChipsField,
  DateField,
  FormField,
  ItemTitle,
  ListRestoreButton,
  NumberField,
  QuickPicks,
  SelectField,
  TextAreaField,
  TextField,
  useListField,
} from "@/components/ui/form-fields";
import { getExtentError, needsOtherConstraints } from "@/lib/completeness";
import { cn } from "@/lib/utils";

const touch = { shouldDirty: true, shouldTouch: true, shouldValidate: true } as const;

const BBOX_PRESETS = [
  { name: "Indonesia", w: 95.0, e: 141.0, s: -11.0, n: 6.0 },
  { name: "Kalimantan Timur", w: 115.0, e: 119.5, s: -2.5, n: 2.5 },
  { name: "Pulau Kalimantan", w: 108.5, e: 119.5, s: -4.5, n: 4.5 },
  { name: "Jawa & Bali", w: 105.0, e: 116.0, s: -9.0, n: -5.5 },
  { name: "Sumatera", w: 95.0, e: 106.5, s: -6.0, n: 6.0 },
  { name: "Sulawesi", w: 118.5, e: 125.5, s: -6.0, n: 2.0 },
  { name: "Maluku & Papua", w: 124.0, e: 141.0, s: -9.5, n: 3.0 },
];

type Extent = MetadataFormData["identification"]["extent"];

/** Sketsa proporsional kotak batas, untuk memeriksa sekilas apakah bentuknya masuk akal. */
function ExtentSketch({ extent, invalid }: { extent: Extent; invalid: boolean }) {
  const width = (extent.eastBoundLongitude ?? 0) - (extent.westBoundLongitude ?? 0);
  const height = (extent.northBoundLatitude ?? 0) - (extent.southBoundLatitude ?? 0);
  const box = { w: 112, h: 72 };

  let rw = box.w;
  let rh = box.h;
  if (!invalid && width > 0 && height > 0) {
    const scale = Math.min(box.w / width, box.h / height);
    rw = Math.max(6, width * scale);
    rh = Math.max(6, height * scale);
  }
  const fmt = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 2 });

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox={`0 0 ${box.w + 8} ${box.h + 8}`} className="h-20 w-32" aria-hidden="true">
        <rect
          x={4 + (box.w - rw) / 2}
          y={4 + (box.h - rh) / 2}
          width={rw}
          height={rh}
          rx="2"
          className={invalid ? "fill-rose-500/10 stroke-rose-500" : "fill-primary/10 stroke-primary"}
          strokeWidth="1.5"
          strokeDasharray={invalid ? "4 3" : undefined}
        />
      </svg>
      <span className="font-mono text-xs text-muted-foreground">{invalid ? "Batas tidak valid" : `${fmt(width)}° × ${fmt(height)}°`}</span>
    </div>
  );
}

function CitationDates() {
  const dates = useListField("identification.dates");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-foreground">
          Tanggal referensi <IsoCode>CI_Date</IsoCode>
        </p>
        <div className="flex items-center gap-2">
          <ListRestoreButton list={dates} />
          <Button size="sm" onClick={() => dates.append({ date: todayIsoDate(), dateType: "publication" })}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            Tambah tanggal
          </Button>
        </div>
      </div>
      <p className="text-[13px] leading-normal text-muted-foreground">Boleh lebih dari satu, mis. tanggal pembuatan sekaligus tanggal publikasi.</p>
      {dates.fields.length === 0 && <EmptyList>Belum ada tanggal referensi. Tambahkan minimal satu tanggal.</EmptyList>}
      {dates.fields.map((f, idx) => (
        <div key={f.id} className="grid grid-cols-1 items-start gap-x-4 gap-y-3 sm:grid-cols-[1fr,1fr,auto]">
          <DateField name={`identification.dates.${idx}.date`} label={`Tanggal ${idx + 1}`} level="iso" />
          <SelectField name={`identification.dates.${idx}.dateType`} label="Jenis tanggal" isoCode="dateType" options={CI_DATE_TYPE_CODES} emptyLabel={null} />
          <Button variant="danger" size="icon" onClick={() => dates.remove(idx)} aria-label={`Hapus tanggal ${idx + 1}`} className="sm:mt-[1.875rem]">
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </div>
      ))}
    </div>
  );
}

function TopicCategories() {
  return (
    <FormField name="identification.topicCategories" label="Pilih satu atau beberapa klasifikasi" isoCode="MD_TopicCategoryCode" level="iso">
      {({ value, onChange, onBlur }) => {
        const selected: string[] = Array.isArray(value) ? value : [];
        const toggle = (code: string) => {
          onChange(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
          onBlur();
        };
        return (
          <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <legend className="sr-only">21 kategori topik SNI 8843-1:2019</legend>
            {MD_TOPIC_CATEGORIES.map((cat, i) => {
              const isSelected = selected.includes(cat.code);
              const bridge = TOPIC_XSD_BRIDGE[cat.code];
              return (
                <label
                  key={cat.code}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-150",
                    isSelected ? "border-primary bg-primary-subtle" : "border-border hover:bg-muted"
                  )}
                >
                  <input type="checkbox" checked={isSelected} onChange={() => toggle(cat.code)} className={cn(checkboxClass, "mt-0.5")} />
                  <span className="min-w-0 space-y-0.5">
                    <span className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-foreground">
                      <span className="tabular-nums text-muted-foreground">{i + 1}.</span>
                      {cat.label}
                      <IsoCode>{cat.code}</IsoCode>
                    </span>
                    <span className="block text-[13px] leading-snug text-muted-foreground">{cat.description}</span>
                    {bridge && (
                      <span className="block text-xs leading-snug text-muted-foreground">
                        Ditulis ke XML sebagai <code className="font-mono">{bridge.isoCode}</code> + kata kunci {bridge.keyword}.
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </fieldset>
        );
      }}
    </FormField>
  );
}

function KeywordGroups() {
  const groups = useListField("identification.keywordGroups");
  return (
    <Section
      title="Kata kunci"
      isoCode="descriptiveKeywords"
      card="keywords"
      description="Dikelompokkan menurut tipe agar mudah ditemukan di katalog GeoNetwork dan geoportal."
      actions={
        <>
          <ListRestoreButton list={groups} />
          <Button size="sm" onClick={() => groups.append(createEmptyKeywordGroup(groups.fields.length === 0 ? "theme" : "place"))}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            Tambah kelompok
          </Button>
        </>
      }
    >
      {groups.fields.length === 0 && <EmptyList>Belum ada kata kunci. Tambahkan kelompok kata kunci tema terlebih dahulu.</EmptyList>}
      {groups.fields.map((f, idx) => (
        <ItemBlock
          key={f.id}
          title={<ItemTitle isoCode="MD_Keywords">Kelompok {idx + 1}</ItemTitle>}
          actions={
            <Button variant="danger" size="icon-sm" onClick={() => groups.remove(idx)} aria-label={`Hapus kelompok kata kunci ${idx + 1}`}>
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
            <SelectField name={`identification.keywordGroups.${idx}.type`} label="Tipe kata kunci" isoCode="MD_KeywordTypeCode" options={MD_KEYWORD_TYPE_CODES} />
            <TextField
              name={`identification.keywordGroups.${idx}.thesaurusName`}
              label="Nama thesaurus"
              isoCode="thesaurusName"
              level="optional"
              placeholder="Contoh: GEMET, KUGI"
            />
          </div>
          <ChipsField
            name={`identification.keywordGroups.${idx}.keywords`}
            label="Kata kunci"
            isoCode="keyword"
            level="sdi"
            hint="Tekan Enter setelah setiap kata kunci, atau pisahkan dengan koma."
            placeholder="Contoh: irigasi"
          />
        </ItemBlock>
      ))}
    </Section>
  );
}

function ExtentSection() {
  const { control, setValue } = useFormContext<MetadataFormData>();
  const extent = useWatch({ control, name: "identification.extent" }) as Extent;
  const extentError = getExtentError(extent);

  const coord = (key: "westBoundLongitude" | "eastBoundLongitude" | "southBoundLatitude" | "northBoundLatitude", label: string, position: string) => (
    <NumberField name={`identification.extent.${key}`} label={label} isoCode={key} className={position} />
  );

  return (
    <Section
      title="Cakupan wilayah, deskripsi geografis & waktu"
      isoCode="EX_Extent"
      card="extent"
      description="Koordinat terluar dataset dalam derajat desimal (WGS 84). Bujur −180 s.d. 180, lintang −90 s.d. 90."
    >
      <QuickPicks
        options={BBOX_PRESETS.map((p) => p.name)}
        value={
          BBOX_PRESETS.find(
            (p) => extent.westBoundLongitude === p.w && extent.eastBoundLongitude === p.e && extent.southBoundLatitude === p.s && extent.northBoundLatitude === p.n
          )?.name
        }
        onPick={(name) => {
          const p = BBOX_PRESETS.find((b) => b.name === name)!;
          setValue("identification.extent", { ...extent, westBoundLongitude: p.w, eastBoundLongitude: p.e, southBoundLatitude: p.s, northBoundLatitude: p.n }, touch);
        }}
      />

      <div className="grid grid-cols-2 items-center gap-4 sm:grid-cols-[1fr,auto,1fr] sm:grid-rows-[auto,auto,auto]">
        {coord("northBoundLatitude", "Utara", "order-4 sm:order-none sm:col-start-2 sm:row-start-1")}
        {coord("westBoundLongitude", "Barat", "order-1 sm:order-none sm:col-start-1 sm:row-start-2")}
        <div className="hidden sm:col-start-2 sm:row-start-2 sm:block">
          <ExtentSketch extent={extent} invalid={Boolean(extentError)} />
        </div>
        {coord("eastBoundLongitude", "Timur", "order-2 sm:order-none sm:col-start-3 sm:row-start-2")}
        {coord("southBoundLatitude", "Selatan", "order-3 sm:order-none sm:col-start-2 sm:row-start-3")}
      </div>
      {extentError && (
        <p role="alert" className="text-[13px] text-rose-700 dark:text-rose-300">
          {extentError}
        </p>
      )}

      <div className="space-y-2.5 border-t border-border pt-5">
        <TextField
          name="identification.extent.geographicDescription"
          label="Deskripsi geografis / wilayah administrasi"
          isoCode="EX_GeographicDescription"
          level="sdi"
          hint="Nama wilayah atau kode wilayah Kemendagri/BPS (SE 6/2021 Bab 2)."
          placeholder="Contoh: Provinsi Kalimantan Timur atau 64"
        />
        <QuickPicks
          options={GEOGRAPHIC_DESCRIPTION_PRESETS}
          value={extent.geographicDescription}
          label=""
          onPick={(v) => setValue("identification.extent.geographicDescription", v, touch)}
        />
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-5 border-t border-border pt-5 md:grid-cols-2">
        <DateField name="identification.extent.temporalBegin" label="Cakupan waktu: mulai" isoCode="beginPosition" level="optional" />
        <DateField name="identification.extent.temporalEnd" label="Cakupan waktu: akhir" isoCode="endPosition" level="optional" />
        <NumberField name="identification.extent.verticalMin" label="Elevasi minimum" isoCode="minimumValue" level="optional" suffix="meter" />
        <NumberField name="identification.extent.verticalMax" label="Elevasi maksimum" isoCode="maximumValue" level="optional" suffix="meter" />
      </div>
    </Section>
  );
}

function ProducerContacts() {
  const pocs = useListField("identification.pointOfContacts");
  return (
    <Section
      title="Kontak pemilik / produsen data"
      isoCode="pointOfContact"
      card="producer"
      description="Instansi yang memproduksi atau berwenang atas produk data ini."
      actions={
        <>
          <ListRestoreButton list={pocs} />
          <Button size="sm" onClick={() => pocs.append(createDefaultContact("owner"))}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            Tambah produsen
          </Button>
        </>
      }
    >
      {pocs.fields.length === 0 && <EmptyList>Belum ada kontak produsen data.</EmptyList>}
      {pocs.fields.map((f, idx) => (
        <ContactCard
          key={f.id}
          name={`identification.pointOfContacts.${idx}`}
          title={pocs.fields.length > 1 ? `Produsen data ${idx + 1}` : "Produsen data"}
          levels={{ organisationName: "sdi", electronicMailAddress: "sdi" }}
          copyFrom={{ label: "Samakan dengan Bab 1", path: "metadataInfo.contacts.0" }}
          onRemove={pocs.fields.length > 1 ? () => pocs.remove(idx) : undefined}
        />
      ))}
    </Section>
  );
}

export function Step2Identification() {
  const { control } = useFormContext<MetadataFormData>();
  const constraints = useWatch({ control, name: "identification.constraints" });
  const needsOther = needsOtherConstraints(constraints);

  return (
    <div className="space-y-6">
      <StepHeader
        step={2}
        title="Identifikasi produk data"
        description="Judul, ringkasan isi, kategori, cakupan wilayah, hasil QA Walidata, pemeliharaan, dan aturan penggunaan produk data."
      />

      <Section title="Identifikasi & sitasi produk data" isoCode="MD_DataIdentification" card="citation" description="Sesuai Spesifikasi Produk Data SNI ISO 19131 dan SE 6/2021 Poin 4.1.2.">
        <TextField name="identification.title" label="Judul produk data" isoCode="title" level="iso" placeholder="Contoh: Jaringan Irigasi Provinsi Kalimantan Timur" />
        <TextField
          name="identification.alternateTitle"
          label="Judul alternatif / nama layer"
          isoCode="alternateTitle"
          level="sdi"
          mono
          hint="Nama layer di GeoServer/GeoNode, biasanya diawali geonode:."
          placeholder="geonode:jaringan_irigasi_prov_kaltim"
        />
        <CitationDates />
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 border-t border-border pt-5 md:grid-cols-3">
          <SelectField name="identification.presentationForm" label="Bentuk penyajian" isoCode="presentationForm" level="sdi" options={CI_PRESENTATION_FORM_CODES} />
          <TextField name="identification.edition" label="Edisi" isoCode="edition" level="optional" placeholder="Contoh: 2024" />
          <TextField name="identification.identifierCode" label="Kode pengenal sitasi" isoCode="identifier" level="optional" mono />
        </div>
        <TextAreaField
          name="identification.abstract"
          label="Abstrak / narasi isi data"
          isoCode="abstract"
          level="iso"
          counter
          rows={5}
          hint="Apa yang dipetakan, wilayahnya, tahun perolehan data, dan kegunaannya."
          placeholder="Contoh: Sebaran saluran irigasi primer dan sekunder di daerah irigasi kewenangan Provinsi Kalimantan Timur, hasil inventarisasi dan digitasi tahun 2024."
        />
        <TextAreaField
          name="identification.purpose"
          label="Tujuan pembuatan data"
          isoCode="purpose"
          level="sdi"
          rows={2}
          hint="Gambaran umum Spesifikasi Produk Data SNI ISO 19131."
          placeholder="Contoh: Mendukung penyusunan masterplan pengelolaan sumber daya air."
        />
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
          <SelectField name="identification.status" label="Status produk data" isoCode="MD_ProgressCode" level="sdi" options={MD_PROGRESS_CODES} />
          <TextField name="identification.credit" label="Kredit / instansi pendukung" isoCode="credit" level="optional" />
        </div>
      </Section>

      <Section
        title="Kategori topik (21 topik ProMSI)"
        isoCode="topicCategory"
        card="topics"
        description="Klasifikasi SNI 8843-1:2019 sesuai Tabel 1 SE 6/2021."
      >
        <TopicCategories />
      </Section>

      <KeywordGroups />
      <ExtentSection />
      <ProducerContacts />

      <Section
        title="Hasil penjaminan kualitas (QA) & kelas penggunaan — diisi oleh Walidata"
        isoCode="MD_Usage"
        card="usage"
        description="Diisi Walidata setelah Penjaminan Kualitas, sebelum publikasi JIGN (SE 6/2021 Poin 1.1.3 & 4.1.2)."
      >
        <TextAreaField
          name="identification.usage.specificUsage"
          label="Kelas penggunaan / rekomendasi pemanfaatan hasil QA"
          isoCode="specificUsage"
          level="walidata"
          rows={3}
          placeholder="Contoh: Telah lulus Penjaminan Kualitas (QA) Walidata Daerah; layak dibagi-pakaikan untuk perencanaan tingkat provinsi skala 1:25.000."
        />
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-[1fr,2fr]">
          <DateField name="identification.usage.usageDate" label="Tanggal penjaminan kualitas" isoCode="usageDateTime" level="walidata" />
          <TextField
            name="identification.usage.userDeterminedLimitations"
            label="Catatan batasan / temuan evaluasi QA"
            isoCode="userDeterminedLimitations"
            level="optional"
            placeholder="Contoh: Jaringan tersier belum dipetakan."
          />
        </div>
        <ContactCard name="identification.usage.contact" title="Kontak Walidata pemeriksa" levels={{ organisationName: "walidata" }} />
      </Section>

      <Section title="Pemeliharaan produk data" isoCode="resourceMaintenance" card="resource-maintenance">
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-3">
          <SelectField
            name="identification.maintenance.frequency"
            label="Frekuensi pembaruan"
            isoCode="maintenanceAndUpdateFrequency"
            level="sdi"
            options={MD_MAINTENANCE_FREQUENCY_CODES}
          />
          <DateField name="identification.maintenance.dateOfNextUpdate" label="Pembaruan berikutnya" isoCode="dateOfNextUpdate" level="optional" />
          <SelectField
            name="identification.maintenance.updateScope"
            label="Ruang lingkup pemeliharaan"
            isoCode="updateScope"
            level="optional"
            options={MD_SCOPE_CODES.map((s) => ({ code: s.code, label: s.label }))}
          />
        </div>
        <TextAreaField
          name="identification.maintenance.note"
          label="Catatan penyimpanan & pemeliharaan data"
          isoCode="maintenanceNote"
          level="optional"
          rows={2}
          placeholder="Contoh: Disimpan di server JIGD Kaltim dan dicadangkan tiap bulan."
        />
      </Section>

      <Section title="Batasan produk data" isoCode="resourceConstraints" card="resource-constraints" description="SE 6/2021 Poin 4.1.3.">
        <TextField
          name="identification.constraints.useLimitation"
          label="Batasan umum"
          isoCode="useLimitation"
          level="sdi"
          placeholder="Contoh: Wajib mencantumkan sumber data dalam setiap publikasi."
        />
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
          <SelectField name="identification.constraints.accessConstraints" label="Batasan akses" isoCode="accessConstraints" level="sdi" options={MD_RESTRICTION_CODES} />
          <SelectField name="identification.constraints.useConstraints" label="Batasan penggunaan" isoCode="useConstraints" level="sdi" options={MD_RESTRICTION_CODES} />
        </div>
        <TextField
          name="identification.constraints.otherConstraints"
          label="Keterangan batasan lainnya"
          isoCode="otherConstraints"
          level="conditional"
          required={needsOther}
          conditionNote="Wajib bila batasan akses atau penggunaan bernilai Batasan Lainnya (otherRestrictions)."
          hint={needsOther ? "Wajib diisi karena batasan akses atau penggunaan adalah Batasan Lainnya." : "Wajib bila salah satu batasan di atas adalah Batasan Lainnya."}
          placeholder="Contoh: Data terbuka sesuai kebijakan Satu Data Indonesia."
        />
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 border-t border-border pt-5 md:grid-cols-2">
          <SelectField
            name="identification.constraints.securityClassification"
            label="Klasifikasi keamanan"
            isoCode="MD_ClassificationCode"
            level="sdi"
            options={MD_CLASSIFICATION_CODES}
          />
          <TextField name="identification.constraints.securityUserNote" label="Catatan keamanan" isoCode="userNote" level="optional" />
        </div>
      </Section>

      <Section title="Informasi tambahan spesifikasi produk" isoCode="supplementalInformation" card="supplemental" optional>
        <TextAreaField
          name="identification.supplementalInformation"
          label="Keterangan tambahan"
          level="optional"
          rows={3}
          hint="Mis. persyaratan personil, peralatan survei, atau rujukan KAK."
        />
      </Section>
    </div>
  );
}
