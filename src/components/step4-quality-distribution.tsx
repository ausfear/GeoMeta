"use client";

import React, { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { MetadataFormData, createEmptyProcessStep, createEmptyReport, createEmptySource } from "@/lib/metadata-schema";
import {
  DISTRIBUTION_FORMAT_PRESETS,
  DQ_CATEGORIES,
  DQ_ELEMENT_TYPES,
  DQ_EVALUATION_METHOD_TYPE_CODES,
  MD_SCOPE_CODES,
  QUALITY_PACKAGES,
  getQualityElement,
} from "@/lib/iso-codelists";
import { GeoNodeLinksPanel } from "@/components/geonode-links-panel";
import { ContactCard } from "@/components/contact-card";
import { Button, EmptyList, IsoCode, ItemBlock, Section, StepHeader, selectClass } from "@/components/ui/form";
import {
  DateField,
  ItemTitle,
  ListRestoreButton,
  NumberField,
  QuickPicks,
  SelectField,
  TextAreaField,
  TextField,
  useListField,
} from "@/components/ui/form-fields";

const touch = { shouldDirty: true, shouldTouch: true, shouldValidate: true } as const;

function Sources() {
  const sources = useListField("qualityAndDistribution.sources");
  return (
    <Section
      title="Sumber data"
      isoCode="LI_Source"
      card="lineage-sources"
      description="Data dasar yang dipakai: citra, peta acuan, atau data survei."
      actions={
        <>
          <ListRestoreButton list={sources} />
          <Button size="sm" onClick={() => sources.append(createEmptySource())}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            Tambah sumber
          </Button>
        </>
      }
    >
      {sources.fields.length === 0 && <EmptyList>Belum ada sumber data. Standar SDI meminta minimal satu sumber.</EmptyList>}
      {sources.fields.map((f, idx) => (
        <ItemBlock
          key={f.id}
          title={<ItemTitle isoCode="LI_Source">Sumber {idx + 1}</ItemTitle>}
          actions={
            <Button variant="danger" size="icon-sm" onClick={() => sources.remove(idx)} aria-label={`Hapus sumber ${idx + 1}`}>
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          }
        >
          <TextAreaField
            name={`qualityAndDistribution.sources.${idx}.description`}
            label="Deskripsi sumber data"
            isoCode="description"
            level="sdi"
            rows={2}
            placeholder="Contoh: Citra Satelit Tegak Resolusi Tinggi tahun 2024 dan data survei lapangan DPUPR"
          />
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-3">
            <NumberField name={`qualityAndDistribution.sources.${idx}.scaleDenominator`} label="Skala sumber" isoCode="scaleDenominator" level="optional" integer prefix="1 :" />
            <TextField name={`qualityAndDistribution.sources.${idx}.citationTitle`} label="Judul sitasi sumber" isoCode="sourceCitation" level="optional" />
            <DateField name={`qualityAndDistribution.sources.${idx}.citationDate`} label="Tanggal sumber" isoCode="CI_Date" level="optional" />
          </div>
        </ItemBlock>
      ))}
    </Section>
  );
}

function ProcessSteps() {
  const steps = useListField("qualityAndDistribution.processSteps");
  return (
    <Section
      title="Tahapan proses produksi"
      isoCode="LI_ProcessStep"
      card="lineage-steps"
      description="Urutan pengumpulan, pengolahan, dan kontrol kualitas data."
      actions={
        <>
          <ListRestoreButton list={steps} />
          <Button size="sm" onClick={() => steps.append(createEmptyProcessStep())}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            Tambah tahapan
          </Button>
        </>
      }
    >
      {steps.fields.length === 0 && <EmptyList>Belum ada tahapan proses. Standar SDI meminta minimal satu tahapan.</EmptyList>}
      {steps.fields.map((f, idx) => (
        <ItemBlock
          key={f.id}
          title={<ItemTitle isoCode="LI_ProcessStep">Tahap {idx + 1}</ItemTitle>}
          actions={
            <Button variant="danger" size="icon-sm" onClick={() => steps.remove(idx)} aria-label={`Hapus tahap ${idx + 1}`}>
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          }
        >
          <TextAreaField
            name={`qualityAndDistribution.processSteps.${idx}.description`}
            label="Deskripsi tahapan"
            isoCode="description"
            level="sdi"
            rows={2}
            placeholder="Contoh: Digitasi on-screen saluran irigasi dari CSRT 2024"
          />
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-[2fr,1fr]">
            <TextField name={`qualityAndDistribution.processSteps.${idx}.rationale`} label="Rasional / tujuan tahap" isoCode="rationale" level="optional" />
            <DateField name={`qualityAndDistribution.processSteps.${idx}.date`} label="Tanggal pelaksanaan" isoCode="dateTime" level="optional" />
          </div>
          <details className="group rounded-lg bg-muted/50">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-150 group-open:rotate-90" strokeWidth={1.75} />
              Pelaksana tahap (opsional)
            </summary>
            <div className="px-3 pb-3">
              <ContactCard bare name={`qualityAndDistribution.processSteps.${idx}.processor`} title="Pelaksana" />
            </div>
          </details>
        </ItemBlock>
      ))}
    </Section>
  );
}

function QualityReports() {
  const { control } = useFormContext<MetadataFormData>();
  const reports = useListField("qualityAndDistribution.reports");
  const values = useWatch({ control, name: "qualityAndDistribution.reports" }) ?? [];
  const [pick, setPick] = useState(DQ_ELEMENT_TYPES[0].code);

  const addElement = (code: string) => {
    const def = getQualityElement(code);
    reports.append({ ...createEmptyReport(code), nameOfMeasure: def?.measureHint ?? "", evaluationMethodType: "directInternal" });
  };

  const loadPackage = (kind: keyof typeof QUALITY_PACKAGES) => {
    const existing = new Set(values.map((r) => r?.elementType));
    for (const code of QUALITY_PACKAGES[kind].elements) if (!existing.has(code)) addElement(code);
  };

  return (
    <Section
      title="Evaluasi kualitas data (SNI ISO 19157)"
      isoCode="DQ_DataQuality"
      card="quality"
      description="Laporan kontrol kualitas (QC) produsen. SE 6/2021 Bab 3 & Poin 4.1.14."
      actions={<ListRestoreButton list={reports} />}
    >
      <SelectField name="qualityAndDistribution.scope" label="Cakupan kualitas" isoCode="scope" level="sdi" options={MD_SCOPE_CODES} className="max-w-sm" />

      <div className="space-y-3 rounded-lg bg-muted/50 p-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => loadPackage("vector")}>
            {QUALITY_PACKAGES.vector.label}
          </Button>
          <Button size="sm" onClick={() => loadPackage("raster")}>
            {QUALITY_PACKAGES.raster.label}
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select aria-label="Sub-elemen kualitas" value={pick} onChange={(e) => setPick(e.target.value)} className={selectClass}>
            {DQ_CATEGORIES.map((category) => (
              <optgroup key={category} label={category}>
                {DQ_ELEMENT_TYPES.filter((d) => d.category === category).map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <Button variant="primary" onClick={() => addElement(pick)}>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Tambah sub-elemen
          </Button>
        </div>
      </div>

      {reports.fields.length === 0 && <EmptyList>Belum ada laporan kualitas. Muat paket di atas atau tambahkan sub-elemen satu per satu.</EmptyList>}

      {reports.fields.map((f, idx) => {
        const base = `qualityAndDistribution.reports.${idx}`;
        const def = getQualityElement(values[idx]?.elementType ?? "");
        return (
          <ItemBlock
            key={f.id}
            title={
              <ItemTitle isoCode={`gmd:${values[idx]?.elementType ?? ""}`}>
                <span className="text-muted-foreground">{def?.category ?? "Lainnya"}:</span> {def?.label ?? values[idx]?.elementType}
              </ItemTitle>
            }
            actions={
              <Button variant="danger" size="icon-sm" onClick={() => reports.remove(idx)} aria-label={`Hapus laporan kualitas ${idx + 1}`}>
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            }
          >
            <SelectField
              name={`${base}.elementType`}
              label="Sub-elemen kualitas"
              isoCode="AbstractDQ_Element"
              emptyLabel={null}
              options={DQ_ELEMENT_TYPES.map((d) => ({ code: d.code, label: `${d.category}: ${d.label}` }))}
            />
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
              <TextField name={`${base}.nameOfMeasure`} label="Nama ukuran kualitas" isoCode="nameOfMeasure" level="optional" placeholder={def?.measureHint} />
              <SelectField
                name={`${base}.evaluationMethodType`}
                label="Tipe metode evaluasi"
                isoCode="evaluationMethodType"
                level="optional"
                options={DQ_EVALUATION_METHOD_TYPE_CODES}
              />
            </div>
            <TextField name={`${base}.measureDescription`} label="Deskripsi ukuran" isoCode="measureDescription" level="optional" />
            <TextAreaField name={`${base}.evaluationMethodDescription`} label="Prosedur evaluasi" isoCode="evaluationMethodDescription" level="optional" rows={2} />
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-3">
              <TextField
                name={`${base}.procedureTitle`}
                label="Dokumen prosedur (KAK / QC)"
                isoCode="evaluationProcedure"
                level="optional"
                className="md:col-span-1"
                placeholder="Contoh: KAK Inventarisasi 2024"
              />
              <DateField name={`${base}.procedureDate`} label="Tanggal dokumen" level="optional" />
              <DateField name={`${base}.dateTime`} label="Tanggal evaluasi" isoCode="dateTime" level="optional" />
            </div>

            <div className="space-y-5 border-t border-border pt-5">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-foreground">
                Hasil kesesuaian <IsoCode>DQ_ConformanceResult</IsoCode>
              </p>
              <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-3">
                <TextField
                  name={`${base}.conformance.specificationTitle`}
                  label="Spesifikasi acuan"
                  isoCode="specification"
                  level="optional"
                  className="md:col-span-2"
                  placeholder="Contoh: Spesifikasi Produk Data Jaringan Irigasi 2024"
                />
                <SelectField
                  name={`${base}.conformance.pass`}
                  label="Status kesesuaian"
                  isoCode="pass"
                  level="optional"
                  emptyLabel="Belum dievaluasi"
                  options={[
                    { code: "true", label: "Lulus (sesuai spesifikasi)" },
                    { code: "false", label: "Tidak lulus" },
                  ]}
                />
              </div>
              <TextField name={`${base}.conformance.explanation`} label="Penjelasan hasil" isoCode="explanation" level="optional" />
            </div>

            <div className="grid grid-cols-1 gap-x-4 gap-y-5 border-t border-border pt-5 md:grid-cols-2">
              <TextField name={`${base}.quantitative.value`} label="Nilai terukur (opsional)" isoCode="DQ_QuantitativeResult/value" level="optional" mono placeholder="Contoh: 1.5" />
              <TextField name={`${base}.quantitative.valueUnit`} label="Satuan nilai" isoCode="valueUnit" level="optional" placeholder="Contoh: persen atau meter" />
            </div>
          </ItemBlock>
        );
      })}
    </Section>
  );
}

function DistributionFormat() {
  const { control, setValue } = useFormContext<MetadataFormData>();
  const name = useWatch({ control, name: "qualityAndDistribution.distributionFormat.name" });
  return (
    <Section title="Format pengiriman" isoCode="MD_Format" card="distribution-format">
      <div className="space-y-2.5">
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-[2fr,1fr]">
          <TextField name="qualityAndDistribution.distributionFormat.name" label="Nama format" isoCode="name" level="sdi" placeholder="ESRI Shapefile" />
          <TextField name="qualityAndDistribution.distributionFormat.version" label="Versi format" isoCode="version" level="sdi" mono placeholder="1.0" />
        </div>
        <QuickPicks options={DISTRIBUTION_FORMAT_PRESETS} value={name} label="" onPick={(v) => setValue("qualityAndDistribution.distributionFormat.name", v, touch)} />
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
        <TextField name="qualityAndDistribution.distributionFormat.specification" label="Spesifikasi / profil format" isoCode="specification" level="optional" />
        <TextField
          name="qualityAndDistribution.distributionFormat.fileDecompressionTechnique"
          label="Teknik dekompresi"
          isoCode="fileDecompressionTechnique"
          level="optional"
          placeholder="Contoh: ZIP"
        />
      </div>
    </Section>
  );
}

export function Step4QualityDistribution() {
  return (
    <div className="space-y-6">
      <StepHeader
        step={4}
        title="Kualitas, silsilah & distribusi"
        description="Riwayat pemerolehan data, evaluasi kualitas SNI ISO 19157, format, distributor, dan tautan akses data."
      />

      <Section title="Garis silsilah / pemerolehan data" isoCode="LI_Lineage" card="lineage" description="SE 6/2021 Bab 2 & Poin 4.1.4.">
        <TextAreaField
          name="qualityAndDistribution.lineageStatement"
          label="Pernyataan umum garis silsilah"
          isoCode="statement"
          level="sdi"
          rows={5}
          hint="Sumber data acuan, tahun survei, metode pengolahan, dan cara validasinya. Nilai ini juga dibaca GeoNode."
          placeholder="Contoh: Data diperoleh dari inventarisasi lapangan dan digitasi on-screen dokumen As-Built Drawing tahun 2024. Peta dasar mengacu pada Peta RBI BIG skala 1:25.000. Topologi telah diverifikasi."
        />
      </Section>

      <Sources />
      <ProcessSteps />
      <QualityReports />
      <DistributionFormat />

      <Section
        title="Distributor"
        isoCode="MD_Distributor"
        card="distributor"
        description="Pihak yang menyalurkan data dan ketentuan pemerolehannya. Dilengkapi Walidata sebelum publikasi JIGN."
      >
        <ContactCard
          name="qualityAndDistribution.distributor.contact"
          title="Kontak distributor"
          levels={{ organisationName: "walidata" }}
          copyFrom={{ label: "Samakan dengan Bab 1", path: "metadataInfo.contacts.0" }}
        />
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-[1fr,2fr]">
          <TextField name="qualityAndDistribution.distributor.fees" label="Biaya" isoCode="fees" level="optional" placeholder="Contoh: Tanpa biaya" />
          <TextField
            name="qualityAndDistribution.distributor.orderingInstructions"
            label="Instruksi pemerolehan"
            isoCode="orderingInstructions"
            level="walidata"
            placeholder="Contoh: Unduh melalui geoportal JIGD Kaltim atau ajukan surat ke DPUPR."
          />
        </div>
      </Section>

      <GeoNodeLinksPanel />
    </div>
  );
}
