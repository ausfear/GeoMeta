"use client";

import React from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { BookMarked, Link2, Plus, Trash2 } from "lucide-react";
import { MetadataFormData, createEmptyAttribute } from "@/lib/metadata-schema";
import {
  EPSG_GROUPS,
  GEOMETRIC_OBJECT_TYPE_CODES,
  GRID_REPRESENTATION_CLASSES,
  KUGI_CITATION,
  LANGUAGE_CODES,
  MD_CELL_GEOMETRY_CODES,
  MD_COVERAGE_CONTENT_TYPE_CODES,
  MD_PIXEL_ORIENTATION_CODES,
  SCALE_PRESETS,
  SPATIAL_REPRESENTATION_TYPES,
  TOPOLOGY_LEVEL_CODES,
  findEpsgPreset,
} from "@/lib/iso-codelists";
import { Button, EmptyList, IsoCode, ItemBlock, Notice, Section, StepHeader, selectClass } from "@/components/ui/form";
import {
  CheckboxField,
  ChipsField,
  FormField,
  ItemTitle,
  ListRestoreButton,
  NumberField,
  QuickPicks,
  SelectField,
  TextAreaField,
  TextField,
  TriBoolField,
  useListField,
} from "@/components/ui/form-fields";
import { CitationFields } from "@/components/citation-fields";
import { cn } from "@/lib/utils";

const touch = { shouldDirty: true, shouldTouch: true, shouldValidate: true } as const;

/** Pilihan bersegmen untuk nilai enum kecil (mode resolusi, sub-kelas grid, tipe konten). */
function SegmentedField({ name, label, options, isoCode }: { name: string; label: string; options: Array<{ code: string; label: string; description?: string }>; isoCode?: string }) {
  return (
    <FormField name={name} label={label} isoCode={isoCode}>
      {({ value, onChange, onBlur }) => (
        <div role="radiogroup" aria-label={label} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {options.map((o) => {
            const active = value === o.code;
            return (
              <button
                key={o.code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  onChange(o.code);
                  onBlur();
                }}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors duration-150",
                  active ? "border-primary bg-primary-subtle" : "border-border hover:bg-muted"
                )}
              >
                <span className="block text-sm font-medium text-foreground">{o.label}</span>
                {o.description && <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{o.description}</span>}
              </button>
            );
          })}
        </div>
      )}
    </FormField>
  );
}

function SpatialRepresentation() {
  const { control, setValue } = useFormContext<MetadataFormData>();
  const type = useWatch({ control, name: "spatialAndContent.spatialRepresentationType" });
  const mode = useWatch({ control, name: "spatialAndContent.resolutionMode" });
  const scale = useWatch({ control, name: "spatialAndContent.scaleDenominator" });
  const gridClass = useWatch({ control, name: "spatialAndContent.gridDetail.representationClass" });

  return (
    <Section
      title="Representasi & resolusi spasial"
      isoCode="MD_SpatialRepresentation"
      card="spatial-representation"
      description="Jenis data, skala atau resolusi, dan rincian geometrinya (SE 6/2021 Poin 4.1.6)."
    >
      <SelectField
        name="spatialAndContent.spatialRepresentationType"
        label="Tipe representasi spasial"
        isoCode="spatialRepresentationType"
        level="sdi"
        options={SPATIAL_REPRESENTATION_TYPES}
      />

      <div className="space-y-4 border-t border-border pt-5">
        <SegmentedField
          name="spatialAndContent.resolutionMode"
          label="Resolusi spasial dinyatakan sebagai"
          isoCode="MD_Resolution"
          options={[
            { code: "scale", label: "Skala peta", description: "Penyebut skala, untuk data vektor." },
            { code: "distance", label: "Jarak / GSD", description: "Ukuran piksel di lapangan, untuk citra." },
          ]}
        />
        {mode === "distance" ? (
          <NumberField
            name="spatialAndContent.groundDistance"
            label="Resolusi jarak (GSD)"
            isoCode="distance"
            level="sdi"
            suffix="meter"
            placeholder="Contoh: 0.5"
            className="max-w-xs"
          />
        ) : (
          <div className="space-y-2.5">
            <NumberField
              name="spatialAndContent.scaleDenominator"
              label="Skala peta"
              isoCode="equivalentScale"
              level="sdi"
              integer
              prefix="1 :"
              hint="Isi angka penyebutnya saja, mis. 25000 untuk 1:25.000."
              placeholder="25000"
              className="max-w-xs"
            />
            <QuickPicks
              options={SCALE_PRESETS.map((s) => s.denominator)}
              value={scale}
              mono
              format={(d) => `1:${d.toLocaleString("id-ID")}`}
              onPick={(d) => setValue("spatialAndContent.scaleDenominator", d, touch)}
            />
          </div>
        )}
      </div>

      {type === "vector" && (
        <div className="space-y-5 border-t border-border pt-5">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-foreground">
            Rincian vektor <IsoCode>MD_VectorSpatialRepresentation</IsoCode>
          </p>
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-3">
            <SelectField name="spatialAndContent.vectorDetail.topologyLevel" label="Level topologi" isoCode="topologyLevel" level="optional" options={TOPOLOGY_LEVEL_CODES} />
            <SelectField
              name="spatialAndContent.vectorDetail.geometricObjectType"
              label="Objek geometri"
              isoCode="geometricObjectType"
              level="sdi"
              options={GEOMETRIC_OBJECT_TYPE_CODES}
            />
            <NumberField name="spatialAndContent.vectorDetail.geometricObjectCount" label="Jumlah objek" isoCode="geometricObjectCount" level="optional" integer />
          </div>
        </div>
      )}

      {type === "grid" && (
        <div className="space-y-5 border-t border-border pt-5">
          <SegmentedField name="spatialAndContent.gridDetail.representationClass" label="Sub-kelas grid" options={GRID_REPRESENTATION_CLASSES} />
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-3">
            <NumberField name="spatialAndContent.gridDetail.numberOfDimensions" label="Jumlah dimensi" isoCode="numberOfDimensions" level="optional" integer />
            <NumberField name="spatialAndContent.gridDetail.rowSize" label="Ukuran baris" isoCode="dimensionSize (row)" level="sdi" integer suffix="piksel" />
            <NumberField name="spatialAndContent.gridDetail.columnSize" label="Ukuran kolom" isoCode="dimensionSize (column)" level="sdi" integer suffix="piksel" />
            <SelectField name="spatialAndContent.gridDetail.cellGeometry" label="Geometri sel" isoCode="cellGeometry" level="optional" options={MD_CELL_GEOMETRY_CODES} />
            <TriBoolField
              name="spatialAndContent.gridDetail.transformationParameterAvailability"
              label="Parameter transformasi tersedia"
              isoCode="transformationParameterAvailability"
              level="optional"
            />
          </div>

          {gridClass === "georectified" && (
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
              <TriBoolField name="spatialAndContent.gridDetail.checkPointAvailability" label="Titik uji tersedia" isoCode="checkPointAvailability" level="optional" />
              <SelectField name="spatialAndContent.gridDetail.pointInPixel" label="Titik acuan piksel" isoCode="pointInPixel" level="optional" options={MD_PIXEL_ORIENTATION_CODES} />
              <TextField
                name="spatialAndContent.gridDetail.checkPointDescription"
                label="Deskripsi titik uji"
                isoCode="checkPointDescription"
                level="optional"
                placeholder="Contoh: 24 titik ICP hasil pengukuran GNSS"
              />
              <TextField
                name="spatialAndContent.gridDetail.transformationDescription"
                label="Deskripsi transformasi"
                isoCode="transformationDimensionDescription"
                level="optional"
              />
            </div>
          )}

          {gridClass === "georeferenceable" && (
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
              <TriBoolField name="spatialAndContent.gridDetail.controlPointAvailability" label="Titik kontrol tersedia" isoCode="controlPointAvailability" level="optional" />
              <TriBoolField
                name="spatialAndContent.gridDetail.orientationParameterAvailability"
                label="Parameter orientasi tersedia"
                isoCode="orientationParameterAvailability"
                level="optional"
              />
              <TextField
                name="spatialAndContent.gridDetail.orientationParameterDescription"
                label="Deskripsi parameter orientasi"
                isoCode="orientationParameterDescription"
                level="optional"
              />
              <TextField
                name="spatialAndContent.gridDetail.georeferencedParameters"
                label="Parameter georeferensi"
                isoCode="georeferencedParameters"
                level="optional"
                placeholder="Contoh: RPC"
              />
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function ReferenceSystems() {
  const { control, setValue } = useFormContext<MetadataFormData>();
  const systems = useListField("spatialAndContent.referenceSystems");
  const values = useWatch({ control, name: "spatialAndContent.referenceSystems" });

  return (
    <Section
      title="Sistem referensi spasial"
      isoCode="MD_ReferenceSystem"
      card="reference-system"
      description="Bab 2 & Poin 4.1.7 SE 6/2021."
      actions={
        <>
          <ListRestoreButton list={systems} />
          <Button size="sm" onClick={() => systems.append({ code: "", codeSpace: "EPSG", version: "" })}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            Tambah sistem referensi
          </Button>
        </>
      }
    >
      <Notice tone="info" title="Produk data SDI wajib mengacu pada SRGI 2013">
        <p>
          Pilih <span className="font-mono">EPSG:9470</span> untuk koordinat geografis, atau zona UTM SRGI 2013 (
          <span className="font-mono">EPSG:9476–9494</span>) untuk koordinat terproyeksi. Kalimantan Timur berada di zona 50N (
          <span className="font-mono">9480</span>) dan 50S (<span className="font-mono">9490</span>).
        </p>
      </Notice>

      {systems.fields.length === 0 && <EmptyList>Belum ada sistem referensi. Tambahkan minimal satu, sebaiknya SRGI 2013.</EmptyList>}
      {systems.fields.map((f, idx) => {
        const preset = findEpsgPreset(values?.[idx]?.code ?? "");
        return (
          <ItemBlock
            key={f.id}
            title={
              <ItemTitle isoCode="RS_Identifier">
                {preset ? `${preset.label}${preset.note ? ` (${preset.note})` : ""}` : `Sistem referensi ${idx + 1}`}
              </ItemTitle>
            }
            actions={
              <Button variant="danger" size="icon-sm" onClick={() => systems.remove(idx)} aria-label={`Hapus sistem referensi ${idx + 1}`}>
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            }
          >
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-foreground">Pilih dari daftar</span>
              <select
                value={preset?.code ?? ""}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setValue(`spatialAndContent.referenceSystems.${idx}.code`, e.target.value, touch);
                  setValue(`spatialAndContent.referenceSystems.${idx}.codeSpace`, "EPSG", touch);
                }}
                className={selectClass}
              >
                <option value="">Kode kustom</option>
                {EPSG_GROUPS.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.presets.map((p) => (
                      <option key={p.code} value={p.code}>
                        EPSG:{p.code} — {p.label}
                        {p.note ? ` (${p.note})` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-3">
              <TextField name={`spatialAndContent.referenceSystems.${idx}.code`} label="Kode" isoCode="code" level="sdi" mono inputMode="numeric" placeholder="9470" />
              <TextField name={`spatialAndContent.referenceSystems.${idx}.codeSpace`} label="Otoritas" isoCode="codeSpace" level="optional" mono placeholder="EPSG" />
              <TextField name={`spatialAndContent.referenceSystems.${idx}.version`} label="Versi" isoCode="version" level="optional" mono />
            </div>
          </ItemBlock>
        );
      })}
    </Section>
  );
}

function AttributeTable() {
  const attributes = useListField("spatialAndContent.contentInfo.attributes");
  return (
    <div className="space-y-3 border-t border-border pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Struktur atribut unsur</p>
          <p className="max-w-prose text-[13px] leading-normal text-muted-foreground">
            Opsional. Ditulis sebagai catatan sitasi katalog unsur agar tetap valid XSD ISO 19139.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ListRestoreButton list={attributes} />
          <Button size="sm" onClick={() => attributes.append(createEmptyAttribute())}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            Tambah atribut
          </Button>
        </div>
      </div>
      {attributes.fields.map((f, idx) => (
        <ItemBlock
          key={f.id}
          title={`Atribut ${idx + 1}`}
          actions={
            <Button variant="danger" size="icon-sm" onClick={() => attributes.remove(idx)} aria-label={`Hapus atribut ${idx + 1}`}>
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          }
        >
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
            <TextField name={`spatialAndContent.contentInfo.attributes.${idx}.name`} label="Nama atribut" mono placeholder="NAMOBJ" />
            <TextField name={`spatialAndContent.contentInfo.attributes.${idx}.dataType`} label="Tipe data" placeholder="String, Integer, Double" />
            <TextField name={`spatialAndContent.contentInfo.attributes.${idx}.definition`} label="Definisi" placeholder="Nama saluran irigasi" />
            <TextField name={`spatialAndContent.contentInfo.attributes.${idx}.domain`} label="Satuan / domain nilai" placeholder="Contoh: meter, atau Primer; Sekunder" />
          </div>
        </ItemBlock>
      ))}
    </div>
  );
}

function ContentInfo() {
  const { control, getValues, setValue } = useFormContext<MetadataFormData>();
  const type = useWatch({ control, name: "spatialAndContent.contentInfo.type" });
  const href = useWatch({ control, name: "spatialAndContent.contentInfo.featureCitationHref" });

  const fillKugi = () => {
    const current = getValues("spatialAndContent.contentInfo.catalogueCitation");
    setValue("spatialAndContent.contentInfo.catalogueCitation", { ...current, ...KUGI_CITATION, dateType: current.dateType || "publication" }, touch);
  };

  return (
    <Section
      title="Informasi konten & katalog unsur (KUGI)"
      isoCode="contentInfo"
      card="content"
      description="SNI ISO 19110 dan SE 6/2021 Bab 5 & Poin 4.1.8."
    >
      <SegmentedField
        name="spatialAndContent.contentInfo.type"
        label="Jenis konten"
        options={[
          { code: "vector", label: "Vektor", description: "Katalog unsur (MD_FeatureCatalogueDescription)." },
          { code: "raster", label: "Raster", description: "Deskripsi coverage (MD_CoverageDescription)." },
          { code: "none", label: "Tidak diisi", description: "Tidak menulis informasi konten." },
        ]}
      />

      {type === "vector" && (
        <>
          <ChipsField
            name="spatialAndContent.contentInfo.featureTypes"
            label="Nama / kode unsur geografi KUGI"
            isoCode="featureTypes"
            level="sdi"
            hint="Nama atau kode alfanumerik unik unsur sesuai KUGI."
            placeholder="Contoh: JaringanIrigasi_LN"
          />
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
            <TriBoolField
              name="spatialAndContent.contentInfo.complianceCode"
              label="Patuh SNI ISO 19110"
              isoCode="complianceCode"
              level="optional"
              yesLabel="Ya, patuh"
              noLabel="Tidak patuh"
            />
            <SelectField name="spatialAndContent.contentInfo.language" label="Bahasa katalog unsur" isoCode="language" level="optional" options={LANGUAGE_CODES} />
          </div>
          <CheckboxField
            name="spatialAndContent.contentInfo.includedWithDataset"
            label="Katalog unsur disertakan bersama dataset"
            hint="Centang bila berkas katalog ikut diunduh bersama data (includedWithDataset)."
          />

          <div className="space-y-4 border-t border-border pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-foreground">
                Sitasi katalog unsur <IsoCode>featureCatalogueCitation</IsoCode>
              </p>
              <Button size="sm" onClick={fillKugi}>
                <BookMarked className="h-3.5 w-3.5" strokeWidth={1.75} />
                Isi otomatis standar KUGI BIG
              </Button>
            </div>
            {href && (
              <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-[13px] text-muted-foreground">
                <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <span className="min-w-0">
                  Tautan katalog bawaan GeoNode tetap dipertahankan:{" "}
                  <span className="break-all font-mono text-xs text-foreground">{href}</span>
                </span>
              </p>
            )}
            <CitationFields
              name="spatialAndContent.contentInfo.catalogueCitation"
              titleLabel="Judul katalog unsur"
              titleLevel="sdi"
              titlePlaceholder={KUGI_CITATION.title}
            />
          </div>

          <AttributeTable />
        </>
      )}

      {type === "raster" && (
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-[2fr,1fr]">
          <TextAreaField
            name="spatialAndContent.contentInfo.attributeDescription"
            label="Deskripsi atribut piksel"
            isoCode="attributeDescription"
            level="sdi"
            rows={2}
            placeholder="Contoh: Nilai reflektansi kanal merah, hijau, biru"
          />
          <SelectField
            name="spatialAndContent.contentInfo.coverageContentType"
            label="Tipe konten"
            isoCode="MD_CoverageContentTypeCode"
            level="sdi"
            options={MD_COVERAGE_CONTENT_TYPE_CODES}
          />
        </div>
      )}
    </Section>
  );
}

export function Step3SpatialContent() {
  return (
    <div className="space-y-6">
      <StepHeader
        step={3}
        title="Representasi spasial, SRGI & KUGI"
        description="Jenis data dan resolusinya, sistem referensi geospasial, serta katalog unsur geografi."
      />
      <SpatialRepresentation />
      <ReferenceSystems />
      <ContentInfo />
    </div>
  );
}
