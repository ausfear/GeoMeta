"use client";

import React, { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Plus, Lock, Unlock, RefreshCw, Copy } from "lucide-react";
import { MetadataFormData, createDefaultContact, DEFAULT_STANDARD_NAME } from "@/lib/metadata-schema";
import {
  CHARACTER_SET_CODES,
  HIERARCHY_LEVEL_NAME_PRESETS,
  LANGUAGE_CODES,
  MD_CLASSIFICATION_CODES,
  MD_MAINTENANCE_FREQUENCY_CODES,
  MD_SCOPE_CODES,
} from "@/lib/iso-codelists";
import { ContactCard } from "@/components/contact-card";
import { Button, EmptyList, Section, StepHeader, inputClass } from "@/components/ui/form";
import { DateField, FormField, ListRestoreButton, QuickPicks, SelectField, TextAreaField, TextField, useListField } from "@/components/ui/form-fields";
import { cn } from "@/lib/utils";

function generateUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const touch = { shouldDirty: true, shouldTouch: true, shouldValidate: true } as const;

export function Step1MetadataInfo() {
  const { control, setValue, getValues } = useFormContext<MetadataFormData>();
  const [unlockUuid, setUnlockUuid] = useState(false);
  const contacts = useListField("metadataInfo.contacts");
  const levelName = useWatch({ control, name: "metadataInfo.hierarchyLevelName" });

  return (
    <div className="space-y-6">
      <StepHeader step={1} title="Informasi metadata" description="Identitas dokumen metadata, penanggung jawabnya, dan jadwal pemutakhirannya." />

      <Section title="Identitas & ruang lingkup metadata" isoCode="MD_Metadata" card="metadata-identity">
        <FormField
          name="metadataInfo.fileIdentifier"
          label="UUID dokumen metadata"
          isoCode="fileIdentifier"
          level="iso"
          hint="Pengenal unik dataset di GeoNode dan GeoNetwork. Jangan diubah untuk dataset yang sudah terbit."
        >
          {({ control: c, value, onChange, onBlur }) => (
            <div className="flex gap-2">
              <input
                {...c}
                type="text"
                value={value ?? ""}
                readOnly={!unlockUuid}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                className={cn(inputClass, "font-mono text-sm", !unlockUuid && "bg-muted text-muted-foreground")}
              />
              <Button
                size="icon"
                onClick={() => setUnlockUuid(!unlockUuid)}
                aria-pressed={unlockUuid}
                aria-label={unlockUuid ? "Kunci UUID" : "Buka kunci UUID untuk diubah"}
                title={unlockUuid ? "Kunci UUID" : "Buka kunci UUID untuk diubah"}
              >
                {unlockUuid ? <Unlock className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={1.75} /> : <Lock className="h-4 w-4" strokeWidth={1.75} />}
              </Button>
              {unlockUuid && (
                <Button size="icon" onClick={() => setValue("metadataInfo.fileIdentifier", generateUuid(), touch)} aria-label="Buat UUID baru" title="Buat UUID baru">
                  <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                </Button>
              )}
            </div>
          )}
        </FormField>

        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-3">
          <DateField name="metadataInfo.dateStamp" label="Tanggal metadata" isoCode="dateStamp" level="iso" hint="Tanggal metadata dibuat atau terakhir diperbarui." />
          <SelectField name="metadataInfo.language" label="Bahasa metadata" isoCode="language" level="iso" options={LANGUAGE_CODES} />
          <SelectField name="metadataInfo.characterSet" label="Set karakter" isoCode="characterSet" level="iso" options={CHARACTER_SET_CODES} />
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
          <SelectField
            name="metadataInfo.hierarchyLevel"
            label="Jenis sumber daya"
            isoCode="hierarchyLevel"
            level="sdi"
            options={MD_SCOPE_CODES.map((s) => ({ code: s.code, label: `${s.label} (${s.code})` }))}
          />
          <div className="space-y-2.5">
            <TextField
              name="metadataInfo.hierarchyLevelName"
              label="Level jangkauan produk data"
              isoCode="hierarchyLevelName"
              level="sdi"
              hint="Level geografis/administrasi produk data sesuai SE 6/2021."
              placeholder="Contoh: Provinsi"
            />
            <QuickPicks options={HIERARCHY_LEVEL_NAME_PRESETS} value={levelName} label="" onPick={(v) => setValue("metadataInfo.hierarchyLevelName", v, touch)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-[2fr,1fr]">
          <TextField name="metadataInfo.metadataStandardName" label="Nama standar metadata" isoCode="metadataStandardName" level="sdi" placeholder={DEFAULT_STANDARD_NAME} />
          <TextField name="metadataInfo.metadataStandardVersion" label="Versi standar" isoCode="metadataStandardVersion" level="sdi" mono placeholder="1.0" />
        </div>
        <button
          type="button"
          onClick={() => {
            setValue("metadataInfo.metadataStandardName", DEFAULT_STANDARD_NAME, touch);
            setValue("metadataInfo.metadataStandardVersion", "1.0", touch);
          }}
          className="-mt-2 rounded text-[13px] font-medium text-primary hover:underline"
        >
          Pakai {DEFAULT_STANDARD_NAME} versi 1.0
        </button>

        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
          <TextField
            name="metadataInfo.parentIdentifier"
            label="UUID metadata induk"
            isoCode="parentIdentifier"
            level="optional"
            mono
            hint="Isi hanya jika dataset ini bagian dari sebuah seri."
          />
          <TextField name="metadataInfo.dataSetURI" label="URI dataset" isoCode="dataSetURI" level="optional" type="url" mono placeholder="https://" />
        </div>
      </Section>

      <Section
        title="Kontak penanggung jawab metadata"
        isoCode="gmd:contact"
        card="metadata-contact"
        description="Instansi atau petugas yang mendokumentasikan dan memvalidasi metadata ini."
        actions={
          <>
            <ListRestoreButton list={contacts} />
            <Button size="sm" onClick={() => contacts.append(createDefaultContact())}>
              <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
              Tambah kontak
            </Button>
          </>
        }
      >
        {contacts.fields.length === 0 && <EmptyList>Belum ada kontak. Tambahkan minimal satu kontak penanggung jawab metadata.</EmptyList>}
        {contacts.fields.map((f, idx) => (
          <ContactCard
            key={f.id}
            name={`metadataInfo.contacts.${idx}`}
            title={contacts.fields.length > 1 ? `Kontak metadata ${idx + 1}` : "Kontak metadata"}
            levels={{ organisationName: "iso", electronicMailAddress: "iso", role: "iso", positionName: "sdi", deliveryPoint: "sdi" }}
            onRemove={contacts.fields.length > 1 ? () => contacts.remove(idx) : undefined}
          />
        ))}
      </Section>

      <Section
        title="Pemeliharaan metadata"
        isoCode="MD_MaintenanceInformation"
        card="metadata-maintenance"
        description="Seberapa sering dokumen metadata ini ditinjau dan dimutakhirkan (SE 6/2021 Poin 4.1.1 & 4.1.5)."
        actions={
          <Button
            size="sm"
            onClick={() => {
              const dataset = getValues("identification.maintenance");
              setValue("metadataInfo.maintenance", { frequency: dataset.frequency, updateScope: dataset.updateScope, note: dataset.note }, touch);
            }}
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
            Samakan dengan pemeliharaan dataset
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
          <SelectField
            name="metadataInfo.maintenance.frequency"
            label="Frekuensi pemutakhiran metadata"
            isoCode="maintenanceAndUpdateFrequency"
            level="sdi"
            options={MD_MAINTENANCE_FREQUENCY_CODES}
          />
          <SelectField
            name="metadataInfo.maintenance.updateScope"
            label="Ruang lingkup pemutakhiran"
            isoCode="updateScope"
            level="optional"
            options={MD_SCOPE_CODES.map((s) => ({ code: s.code, label: s.label }))}
          />
        </div>
        <TextAreaField name="metadataInfo.maintenance.note" label="Catatan pemeliharaan metadata" isoCode="maintenanceNote" level="optional" rows={3} />
      </Section>

      <Section
        title="Batasan metadata"
        isoCode="metadataConstraints"
        card="metadata-constraints"
        optional
        description="Isi hanya bila akses ke dokumen metadata ini berbeda dari akses ke datasetnya."
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
          <SelectField name="metadataInfo.constraints.classification" label="Klasifikasi dokumen metadata" isoCode="classification" level="optional" options={MD_CLASSIFICATION_CODES} />
          <TextField name="metadataInfo.constraints.useLimitation" label="Batasan penggunaan metadata" isoCode="useLimitation" level="optional" />
        </div>
      </Section>
    </div>
  );
}
