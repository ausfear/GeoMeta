"use client";

import React, { useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Download, Copy, Check, CloudUpload, Plus, Trash2 } from "lucide-react";
import { MetadataFormData, createEmptyExtendedElement } from "@/lib/metadata-schema";
import { CONSTRAINT_LANGUAGE_PRESETS, MD_DATATYPE_CODES, MD_OBLIGATION_CODES, SCHEMA_LANGUAGE_PRESETS } from "@/lib/iso-codelists";
import { Button, EmptyList, ItemBlock, Notice, Section, StepHeader } from "@/components/ui/form";
import { ItemTitle, ListRestoreButton, QuickPicks, SelectField, TextField, useListField } from "@/components/ui/form-fields";
import { CitationFields } from "@/components/citation-fields";
import { ObligationBadge } from "@/components/ui/badge";
import { useCompleteness } from "@/components/ui/form-context";
import { PROFILES, WIZARD_STEPS, type RequirementLevel, type WizardStep, stepOfRequirement } from "@/lib/completeness";
import { computeLineDiff, normalizeOriginalXml } from "@/lib/xml-diff";
import { cn } from "@/lib/utils";

interface Step5Props {
  generatedXml: string;
  originalXml: string;
  onGoToStep: (step: WizardStep) => void;
  onOpenPushModal: () => void;
  onDownloadXml: () => void;
}

const touch = { shouldDirty: true, shouldTouch: true, shouldValidate: true } as const;
const LEVEL_ORDER: RequirementLevel[] = ["iso", "sdi", "walidata"];

export function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  const complete = percent >= 100;
  return (
    <span
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <span className={cn("block h-full rounded-full", complete ? "bg-accent-teal" : "bg-primary")} style={{ width: `${percent}%` }} />
    </span>
  );
}

function AuditPanel({ onGoToStep, onOpenPushModal, onDownloadXml }: Omit<Step5Props, "generatedXml" | "originalXml">) {
  const completeness = useCompleteness();
  if (!completeness) return null;
  const { result, jumpTo } = completeness;
  const profile = PROFILES[result.profile];

  return (
    <Section
      title="Audit kelengkapan"
      description={`Profil ${profile.label}: ${result.done} dari ${result.total} isian wajib terisi.`}
      actions={
        <>
          <Button onClick={onDownloadXml}>
            <Download className="h-4 w-4" strokeWidth={1.75} />
            Unduh XML
          </Button>
          <Button variant="primary" onClick={onOpenPushModal}>
            <CloudUpload className="h-4 w-4" strokeWidth={1.75} />
            Simpan ke GeoNode
          </Button>
        </>
      }
    >
      {result.missing.length === 0 ? (
        <Notice tone="success" title={`Kelengkapan ${profile.scoreLabel} 100%`}>
          <p>Seluruh isian wajib untuk profil ini sudah terisi. Metadata siap diunduh atau disimpan ke GeoNode.</p>
        </Notice>
      ) : (
        <Notice tone="warning" title={`${result.missing.length} isian wajib belum terisi`}>
          <p>XML tetap bisa diunduh, tetapi produk data belum memenuhi profil {profile.label}.</p>
        </Notice>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
              <th className="py-2 pr-4 font-medium">Bab</th>
              <th className="py-2 pr-4 text-right font-medium">Terisi</th>
              <th className="w-1/3 py-2 font-medium">Kelengkapan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {WIZARD_STEPS.map((step) => {
              const stat = result.steps[step.number];
              return (
                <tr key={step.number}>
                  <td className="py-2.5 pr-4">
                    <button type="button" onClick={() => onGoToStep(step.number)} className="rounded text-left font-medium text-foreground hover:text-primary">
                      {step.number}. {step.title}
                    </button>
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                    {stat.total === 0 ? "Tidak ada isian wajib" : `${stat.done}/${stat.total}`}
                  </td>
                  <td className="py-2.5">
                    {stat.total > 0 && (
                      <span className="flex items-center gap-3">
                        <ProgressBar percent={stat.percent} />
                        <span className="w-10 shrink-0 text-right tabular-nums text-foreground">{stat.percent}%</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {LEVEL_ORDER.map((level) => {
        const items = result.missing.filter((r) => r.level === level);
        if (items.length === 0) return null;
        return (
          <div key={level} className="space-y-2.5 border-t border-border pt-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ObligationBadge type={level} /> belum terisi
            </p>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {items.map((req) => (
                <li key={req.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="mx-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />
                    <span className="text-foreground">{req.label}</span>
                  </span>
                  <button type="button" onClick={() => jumpTo(req)} className="shrink-0 rounded text-[13px] font-medium text-primary hover:underline">
                    Isi di bab {stepOfRequirement(req)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <p className="border-t border-border pt-4 text-[13px] leading-normal text-muted-foreground">
        Mengunggah XML secara manual ke GeoNode? Aktifkan <span className="font-medium text-foreground">Metadata Uploaded Preserve</span> di pengaturan
        dataset agar seluruh elemen ISO 19115 tetap utuh saat dipanen GeoNetwork.
      </p>
    </Section>
  );
}

function ExtensionElements() {
  const elements = useListField("advanced.metadataExtension.elements");
  return (
    <Section
      title="Ekstensi metadata"
      isoCode="MD_MetadataExtensionInformation"
      card="metadata-extension"
      optional
      description="Opsional (Poin 4.1.11). Untuk elemen informasi tambahan spesifik produk data di luar kelas standar."
      actions={
        <>
          <ListRestoreButton list={elements} />
          <Button size="sm" onClick={() => elements.append(createEmptyExtendedElement())}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            Tambah elemen
          </Button>
        </>
      }
    >
      <TextField name="advanced.metadataExtension.url" label="URL sumber ekstensi" isoCode="extensionOnLineResource" level="optional" type="url" mono placeholder="https://" />
      {elements.fields.length === 0 && <EmptyList>Belum ada elemen ekstensi.</EmptyList>}
      {elements.fields.map((f, idx) => {
        const base = `advanced.metadataExtension.elements.${idx}`;
        return (
          <ItemBlock
            key={f.id}
            title={<ItemTitle isoCode="MD_ExtendedElementInformation">Elemen {idx + 1}</ItemTitle>}
            actions={
              <Button variant="danger" size="icon-sm" onClick={() => elements.remove(idx)} aria-label={`Hapus elemen ekstensi ${idx + 1}`}>
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
              <TextField name={`${base}.name`} label="Nama elemen" isoCode="name" mono />
              <TextField name={`${base}.parentEntity`} label="Entitas induk" isoCode="parentEntity" hint="Pisahkan dengan koma bila lebih dari satu." />
              <SelectField name={`${base}.dataType`} label="Tipe data" isoCode="dataType" options={MD_DATATYPE_CODES} emptyLabel={null} />
              <SelectField name={`${base}.obligation`} label="Kewajiban" isoCode="obligation" options={MD_OBLIGATION_CODES} />
            </div>
            <TextField name={`${base}.definition`} label="Definisi" isoCode="definition" />
            <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
              <TextField name={`${base}.rule`} label="Aturan" isoCode="rule" />
              <TextField name={`${base}.rationale`} label="Alasan" isoCode="rationale" />
            </div>
          </ItemBlock>
        );
      })}
    </Section>
  );
}

function XmlDiffView({ originalXml, generatedXml }: { originalXml: string; generatedXml: string }) {
  const diff = useMemo(() => {
    if (!originalXml || !generatedXml) return undefined;
    try {
      return computeLineDiff(normalizeOriginalXml(originalXml), generatedXml);
    } catch {
      return null;
    }
  }, [originalXml, generatedXml]);

  if (!originalXml) {
    return <p className="p-5 text-sm text-muted-foreground">Metadata ini dibuat baru, jadi tidak ada XML asli untuk dibandingkan.</p>;
  }
  if (!diff) {
    return <p className="p-5 text-sm text-muted-foreground">Dokumen terlalu besar untuk dibandingkan baris per baris. Unduh XML untuk memeriksanya.</p>;
  }

  return (
    <div>
      <p className="border-b border-border px-4 py-2.5 text-[13px] text-muted-foreground sm:px-5">
        <span className="font-medium text-emerald-700 dark:text-emerald-300">{diff.added} baris ditambahkan</span>,{" "}
        <span className="font-medium text-rose-700 dark:text-rose-300">{diff.removed} baris dihapus</span> dibanding XML asli (namespace dan indentasi
        sudah diseragamkan).
      </p>
      <div className="max-h-[32rem] overflow-auto font-mono text-xs leading-relaxed">
        {diff.hunks.map((hunk, i) =>
          hunk.kind === "skip" ? (
            <div key={i} className="bg-muted px-4 py-1 text-muted-foreground">
              {hunk.count} baris tidak berubah
            </div>
          ) : (
            hunk.lines.map((line, j) => (
              <div
                key={`${i}-${j}`}
                className={cn(
                  "flex whitespace-pre",
                  line.kind === "added" && "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
                  line.kind === "removed" && "bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                )}
              >
                <span className="w-12 shrink-0 select-none pr-2 text-right text-muted-foreground">{line.newNo ?? ""}</span>
                <span className="w-4 shrink-0 select-none text-center">{line.kind === "added" ? "+" : line.kind === "removed" ? "-" : ""}</span>
                <span className="pr-4">{line.text}</span>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
}

export function Step5AdvancedPreview({ generatedXml, originalXml, onGoToStep, onOpenPushModal, onDownloadXml }: Step5Props) {
  const { control, setValue } = useFormContext<MetadataFormData>();
  const schema = useWatch({ control, name: "advanced.applicationSchema" });
  const [activeTab, setActiveTab] = useState<"xml" | "diff">("xml");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedXml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabClass = (active: boolean) =>
    cn(
      "h-8 rounded-md px-3 text-[13px] font-medium transition-colors duration-150",
      active ? "bg-card text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <div className="space-y-6">
      <StepHeader
        step={5}
        title="Penyajian, skema aplikasi & audit akhir"
        description="Katalog simbol dan kamus data yang dianjurkan SDI, lalu periksa kelengkapan dan XML hasil penambalan."
      />

      <AuditPanel onGoToStep={onGoToStep} onOpenPushModal={onOpenPushModal} onDownloadXml={onDownloadXml} />

      <Section
        title="Penyajian / katalog simbol"
        isoCode="MD_PortrayalCatalogueReference"
        card="portrayal"
        obligation="optional"
        description="Dianjurkan SDI (SNI ISO 19117, Poin 4.1.9): standar simbolisasi atau berkas SLD yang dipakai menyajikan peta."
      >
        <CitationFields
          name="advanced.portrayalCatalogue"
          titleLabel="Judul katalog simbol / standar penyajian peta"
          titlePlaceholder="Contoh: Standar Simbolisasi Peta Tematik Nasional BIG"
          urlLabel="URL berkas SLD / dokumen simbol"
        />
      </Section>

      <Section
        title="Skema aplikasi / kamus data"
        isoCode="MD_ApplicationSchemaInformation"
        card="application-schema"
        obligation="optional"
        description="Dianjurkan SDI (SNI ISO 19109, Poin 4.1.12): kamus data atau skema basis data produk."
      >
        <CitationFields
          name="advanced.applicationSchema.citation"
          titleLabel="Nama skema aplikasi / spesifikasi kamus data"
          titlePlaceholder="Contoh: Kamus Data Jaringan Irigasi DPUPR 2024"
          urlLabel="URL berkas skema aplikasi"
        />
        <div className="grid grid-cols-1 gap-x-4 gap-y-5 border-t border-border pt-5 md:grid-cols-2">
          <div className="space-y-2.5">
            <TextField name="advanced.applicationSchema.schemaLanguage" label="Bahasa skema" isoCode="schemaLanguage" level="optional" placeholder="XML Schema" />
            <QuickPicks
              options={SCHEMA_LANGUAGE_PRESETS}
              value={schema?.schemaLanguage}
              label=""
              onPick={(v) => setValue("advanced.applicationSchema.schemaLanguage", v, touch)}
            />
          </div>
          <div className="space-y-2.5">
            <TextField name="advanced.applicationSchema.constraintLanguage" label="Bahasa batasan" isoCode="constraintLanguage" level="optional" placeholder="OCL" />
            <QuickPicks
              options={CONSTRAINT_LANGUAGE_PRESETS}
              value={schema?.constraintLanguage}
              label=""
              onPick={(v) => setValue("advanced.applicationSchema.constraintLanguage", v, touch)}
            />
          </div>
        </div>
      </Section>

      <ExtensionElements />

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div role="tablist" aria-label="Tampilan hasil" className="flex rounded-lg bg-muted p-0.5">
            <button type="button" role="tab" aria-selected={activeTab === "xml"} onClick={() => setActiveTab("xml")} className={tabClass(activeTab === "xml")}>
              Pratinjau XML
            </button>
            <button type="button" role="tab" aria-selected={activeTab === "diff"} onClick={() => setActiveTab("diff")} className={tabClass(activeTab === "diff")}>
              Perbedaan dengan XML asli
            </button>
          </div>

          {activeTab === "xml" && (
            <Button size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-accent-teal" strokeWidth={2.25} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />}
              {copied ? "XML disalin" : "Salin XML"}
            </Button>
          )}
        </div>

        {activeTab === "xml" ? (
          <pre className="max-h-[32rem] overflow-auto bg-muted/50 p-4 font-mono text-xs leading-relaxed text-foreground sm:p-5">{generatedXml}</pre>
        ) : (
          <XmlDiffView originalXml={originalXml} generatedXml={generatedXml} />
        )}
      </section>
    </div>
  );
}
