import React from "react";
import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { renderToString } from "react-dom/server";
import { FormProvider, useForm } from "react-hook-form";
import { parseIso19139ToForm, patchFormToIso19139 } from "../src/lib/xml-engine";
import { MetadataFormData, createEmptyMetadataForm } from "../src/lib/metadata-schema";
import { calculateMetadataCompleteness, type ProfileId } from "../src/lib/completeness";
import { BaselineContext, CompletenessContext, FormUiContext } from "../src/components/ui/form-context";
import { Step1MetadataInfo } from "../src/components/step1-metadata-info";
import { Step2Identification } from "../src/components/step2-identification";
import { Step3SpatialContent } from "../src/components/step3-spatial-content";
import { Step4QualityDistribution } from "../src/components/step4-quality-distribution";
import { Step5AdvancedPreview } from "../src/components/step5-advanced-preview";
import { fillCompleteForm } from "./fixtures/full-form";

const SAMPLE_XML = fs.readFileSync(path.resolve(__dirname, "../jaringan_irigasi_prov_kaltim_ISO_Metadata.xml"), "utf-8");

/** Membuang penanda <!-- --> yang disisipkan SSR React di antara potongan teks. */
const text = (html: string) => html.replace(/<!-- -->/g, "");

function Harness({
  values,
  baseline,
  profile,
  hideOptional,
  children,
}: {
  values: MetadataFormData;
  baseline: MetadataFormData;
  profile: ProfileId;
  hideOptional: boolean;
  children: React.ReactNode;
}) {
  const form = useForm<MetadataFormData>({ defaultValues: values });
  const result = calculateMetadataCompleteness(values, profile);
  return (
    <FormProvider {...form}>
      <FormUiContext.Provider value={{ profile, hideOptional }}>
        <BaselineContext.Provider value={baseline}>
          <CompletenessContext.Provider value={{ result, jumpTo: () => {} }}>{children}</CompletenessContext.Provider>
        </BaselineContext.Provider>
      </FormUiContext.Provider>
    </FormProvider>
  );
}

const steps = (xml: string) => [
  ["Bab 1", <Step1MetadataInfo key="1" />],
  ["Bab 2", <Step2Identification key="2" />],
  ["Bab 3", <Step3SpatialContent key="3" />],
  ["Bab 4", <Step4QualityDistribution key="4" />],
  ["Bab 5", <Step5AdvancedPreview key="5" generatedXml={xml} originalXml={SAMPLE_XML} onGoToStep={() => {}} onOpenPushModal={() => {}} onDownloadXml={() => {}} />],
] as const;

describe("Uji asap UI: kelima bab ter-render tanpa error", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const parsed = parseIso19139ToForm(SAMPLE_XML).formData;
  const full = fillCompleteForm(parsed);
  const scenarios: Array<[string, MetadataFormData, MetadataFormData]> = [
    ["XML GeoNode Kaltim", parsed, parsed],
    ["form lengkap SE 6/2021 (dengan tombol Kembalikan)", full, parsed],
    ["metadata baru", createEmptyMetadataForm("11111111-2222-4333-8444-555555555555"), createEmptyMetadataForm()],
  ];

  for (const [label, values, baseline] of scenarios) {
    for (const profile of ["iso_core", "sdi_produsen", "sdi_walidata"] as const) {
      it(`${label}, profil ${profile}`, () => {
        const xml = patchFormToIso19139(values, SAMPLE_XML);
        for (const [name, element] of steps(xml)) {
          const html = text(
            renderToString(
              <Harness values={values} baseline={baseline} profile={profile} hideOptional={profile === "iso_core"}>
                {element}
              </Harness>
            )
          );
          expect(html, name).toContain(`${name} dari 5`);
        }
      });
    }
  }

  it("menampilkan tombol Kembalikan dengan tooltip nilai awal pada kolom yang berubah", () => {
    const changed = structuredClone(parsed);
    changed.metadataInfo.contacts[0].deliveryPoint = "";
    const html = renderToString(
      <Harness values={changed} baseline={parsed} profile="sdi_produsen" hideOptional={false}>
        <Step1MetadataInfo />
      </Harness>
    );
    expect(html).toContain("Kembalikan ke nilai awal: Jl. Tengkawang No. 1");
  });

  it("menampilkan chip kelengkapan per kartu dan Pulihkan daftar awal saat jumlah item berubah", () => {
    const changed = structuredClone(parsed);
    changed.metadataInfo.contacts = changed.metadataInfo.contacts.slice(0, 1);
    const html = renderToString(
      <Harness values={changed} baseline={parsed} profile="sdi_produsen" hideOptional={false}>
        <Step1MetadataInfo />
      </Harness>
    );
    expect(html).toContain("Pulihkan daftar awal");
    expect(text(html)).toMatch(/Terisi \d+\/\d+ \(\d+%\)/);
  });

  it("menyembunyikan kartu tanpa isian wajib saat filter opsional aktif di profil ISO Minimum", () => {
    const html = renderToString(
      <Harness values={parsed} baseline={parsed} profile="iso_core" hideOptional>
        <Step1MetadataInfo />
      </Harness>
    );
    expect(html).not.toContain("card-metadata-maintenance");
    expect(html).toContain("card-metadata-contact");
  });
});
