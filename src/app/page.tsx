"use client";

import React, { useState, useEffect, useMemo, useDeferredValue, useCallback } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Upload, ArrowRight, ArrowLeft, CheckCircle2, ChevronRight, Loader2, Download, FilePlus2, History } from "lucide-react";
import { Header, ViewControls } from "@/components/header";
import { Step1MetadataInfo } from "@/components/step1-metadata-info";
import { Step2Identification } from "@/components/step2-identification";
import { Step3SpatialContent } from "@/components/step3-spatial-content";
import { Step4QualityDistribution } from "@/components/step4-quality-distribution";
import { ProgressBar, Step5AdvancedPreview } from "@/components/step5-advanced-preview";
import { PushGeoNodeModal } from "@/components/push-geonode-modal";
import { Button, Field, IsoCode, IsoCodeProvider, Notice, checkboxClass, inputClass } from "@/components/ui/form";
import { BaselineContext, CompletenessContext, FormUiContext } from "@/components/ui/form-context";
import { MetadataFormData, createEmptyMetadataForm, metadataFormSchema } from "@/lib/metadata-schema";
import { parseIso19139ToForm, patchFormToIso19139 } from "@/lib/xml-engine";
import { saveDraftToStorage, loadDraftFromStorage, clearDraftStorage, type StoredDraft } from "@/lib/contact-presets";
import {
  DEFAULT_PROFILE,
  WIZARD_STEPS,
  calculateMetadataCompleteness,
  cardDomId,
  stepOfRequirement,
  type CardId,
  type ProfileId,
  type Requirement,
  type WizardStep,
} from "@/lib/completeness";
import { readGeoNodeInput, type GeoNodeUrlReading } from "@/lib/geonode-url";
import { deepClone, fieldDomId } from "@/lib/value-utils";
import { cn } from "@/lib/utils";

const SAMPLE_FILE = "/jaringan_irigasi_prov_kaltim_ISO_Metadata.xml";

type SourceType = "geonode" | "local" | "new";
type DatasetMeta = { baseUrl?: string; pk?: string; uuid: string; title: string; alternateTitle: string };

function generateUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Pratinjau hasil pembacaan URL GeoNode, diperbarui saat pengguna mengetik. */
function UrlReading({ reading }: { reading: GeoNodeUrlReading }) {
  if (reading.kind === "empty") return null;

  if (reading.kind === "invalid") {
    return <p className="text-[13px] text-rose-700 dark:text-rose-300">{reading.message}</p>;
  }

  if (reading.kind === "uuid-only") {
    return (
      <p className="text-[13px] leading-normal text-amber-800 dark:text-amber-300">
        UUID dikenali, tetapi alamat server GeoNode-nya belum diketahui. Tempel alamat lengkap halaman dataset agar metadata bisa dimuat.
      </p>
    );
  }

  const rows: Array<[string, string]> = [["Server", reading.host]];
  if (reading.alternate) rows.push(["Layer", reading.alternate]);
  if (reading.pk) rows.push(["ID dataset", reading.pk]);

  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-[auto,1fr] gap-x-5 gap-y-1.5 rounded-lg bg-muted px-4 py-3 text-[13px]">
        {rows.map(([term, value]) => (
          <React.Fragment key={term}>
            <dt className="text-muted-foreground">{term}</dt>
            <dd className="min-w-0 break-all font-mono text-foreground">{value}</dd>
          </React.Fragment>
        ))}
      </dl>
      {reading.warning && <p className="text-[13px] leading-normal text-amber-800 dark:text-amber-300">{reading.warning}</p>}
    </div>
  );
}

function safePatch(values: MetadataFormData, originalXml: string): string {
  try {
    return patchFormToIso19139(values, originalXml || undefined);
  } catch (err) {
    console.warn("Gagal memperbarui XML hasil patch:", err);
    return "";
  }
}

export default function Home() {
  // Status aplikasi
  const [isInitialized, setIsInitialized] = useState(false);
  const [sourceType, setSourceType] = useState<SourceType>("geonode");
  const [profile, setProfile] = useState<ProfileId>(DEFAULT_PROFILE);
  const [hideOptional, setHideOptional] = useState(false);
  const [showIsoCodes, setShowIsoCodes] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);

  // Form, baseline undo & XML asli
  const form = useForm<MetadataFormData>({
    defaultValues: createEmptyMetadataForm(),
    resolver: zodResolver(metadataFormSchema),
    mode: "onTouched",
  });
  const [baseline, setBaseline] = useState<MetadataFormData | null>(null);
  const [originalXml, setOriginalXml] = useState<string>("");
  const [datasetMeta, setDatasetMeta] = useState<DatasetMeta>({ uuid: "", title: "", alternateTitle: "" });

  // Pemilih sumber
  const [geonodeUrlInput, setGeonodeUrlInput] = useState("");
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [showAuthFields, setShowAuthFields] = useState(false);
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const [showPushModal, setShowPushModal] = useState(false);
  const [savedDraft, setSavedDraft] = useState<StoredDraft | null>(null);

  useEffect(() => {
    setSavedDraft(loadDraftFromStorage());
  }, []);

  const values = useWatch({ control: form.control }) as MetadataFormData;
  const deferredValues = useDeferredValue(values);

  const completeness = useMemo(
    () => (isInitialized ? calculateMetadataCompleteness(values, profile) : null),
    [values, profile, isInitialized]
  );

  // XML hanya dihitung saat dibutuhkan (Bab 5 atau modal simpan) agar mengetik tetap ringan.
  const generatedXml = useMemo(
    () => (isInitialized && (currentStep === 5 || showPushModal) ? safePatch(deferredValues, originalXml) : ""),
    [deferredValues, originalXml, isInitialized, currentStep, showPushModal]
  );

  // Simpan draf otomatis (tanpa kredensial) setelah pengguna berhenti mengetik.
  useEffect(() => {
    if (!isInitialized) return;
    const timer = setTimeout(() => saveDraftToStorage(deferredValues, originalXml), 600);
    return () => clearTimeout(timer);
  }, [deferredValues, originalXml, isInitialized]);

  const urlReading = useMemo(() => readGeoNodeInput(geonodeUrlInput), [geonodeUrlInput]);
  const canFetch = urlReading.kind === "url" && !fetchLoading;

  /** Memuat sumber baru: nilai form, baseline untuk tombol Kembalikan, dan XML aslinya. */
  const openWorkspace = (formValues: MetadataFormData, opts: { xml: string; source: SourceType; meta: DatasetMeta; baseline?: MetadataFormData }) => {
    form.reset(formValues);
    setBaseline(deepClone(opts.baseline ?? formValues));
    setOriginalXml(opts.xml);
    setDatasetMeta(opts.meta);
    setSourceType(opts.source);
    setIsInitialized(true);
    setCurrentStep(1);
    setLoadError("");
    window.scrollTo({ top: 0 });
  };

  const openXml = (xml: string, source: SourceType) => {
    const parsed = parseIso19139ToForm(xml);
    openWorkspace(parsed.formData, { xml, source, meta: parsed.datasetMeta });
  };

  const handleFetchFromGeoNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canFetch) return;

    setFetchLoading(true);
    setLoadError("");

    try {
      const res = await fetch("/api/geonode/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrlOrUuid: geonodeUrlInput.trim(),
          auth: authUsername ? { username: authUsername.trim(), password: authPassword } : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Metadata tidak bisa diambil dari GeoNode.");
      }
      openXml(json.xml, "geonode");
    } catch (err: any) {
      setLoadError(err.message || "Server GeoNode tidak bisa dihubungi.");
    } finally {
      setFetchLoading(false);
    }
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xml")) {
      setLoadError(`"${file.name}" bukan file .xml. Pilih file metadata ISO 19139 berekstensi .xml.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        openXml(event.target?.result as string, "local");
      } catch (err: any) {
        setLoadError(`File "${file.name}" tidak bisa dibaca sebagai XML ISO 19139: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSampleFile = async () => {
    setFetchLoading(true);
    setLoadError("");
    try {
      const res = await fetch(SAMPLE_FILE);
      if (!res.ok) {
        throw new Error("file contoh tidak ditemukan di folder public.");
      }
      openXml(await res.text(), "geonode");
    } catch (err: any) {
      setLoadError(`Contoh data tidak bisa dimuat: ${err.message}`);
    } finally {
      setFetchLoading(false);
    }
  };

  const handleCreateNew = () => {
    const freshUuid = generateUuid();
    openWorkspace(createEmptyMetadataForm(freshUuid), {
      xml: "",
      source: "new",
      meta: { uuid: freshUuid, title: "Dataset baru", alternateTitle: "" },
    });
  };

  const handleResumeDraft = () => {
    if (!savedDraft) return;
    const { data, originalXml: xml = "" } = savedDraft;
    let draftBaseline: MetadataFormData = data;
    let meta: DatasetMeta = {
      uuid: data.metadataInfo.fileIdentifier,
      title: data.identification.title || "Draf tersimpan",
      alternateTitle: data.identification.alternateTitle,
    };
    if (xml) {
      try {
        // Baseline tetap nilai XML sumber, sehingga "Kembalikan" mengacu ke isi GeoNode, bukan isi draf.
        const parsed = parseIso19139ToForm(xml);
        draftBaseline = parsed.formData;
        meta = { ...meta, baseUrl: parsed.datasetMeta.baseUrl, pk: parsed.datasetMeta.pk };
      } catch {
        // XML draf rusak: pakai isi draf sebagai baseline
      }
    }
    openWorkspace(data, { xml, source: xml ? "geonode" : "new", meta, baseline: draftBaseline });
  };

  const handleDownloadXml = () => {
    const xml = safePatch(form.getValues(), originalXml);
    const filename = `${datasetMeta.alternateTitle?.replace(/^geonode:/, "") || datasetMeta.title || datasetMeta.uuid || "metadata"}_ISO_Metadata.xml`;
    const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const goToStep = (step: WizardStep) => {
    setCurrentStep(step);
    window.scrollTo({ top: 0 });
  };

  /** Berpindah ke bab terkait lalu memfokuskan kolom; bila kolomnya tidak bisa difokus, ke kartunya. */
  const jumpTo = useCallback(
    (req: Requirement) => {
      const target = req.focus ? req.focus(form.getValues()) : `card:${req.card}`;
      setCurrentStep(stepOfRequirement(req));
      setTimeout(() => {
        const card = target.startsWith("card:") ? (target.slice(5) as CardId) : req.card;
        const el =
          (!target.startsWith("card:") && document.getElementById(fieldDomId(target))) || document.getElementById(cardDomId(card));
        el?.scrollIntoView({ block: "center" });
        el?.focus({ preventScroll: true });
      }, 50);
    },
    [form]
  );

  const changeProfile = (next: ProfileId) => {
    setProfile(next);
    // ISO Minimum: kolom lanjutan disembunyikan, tetapi tetap bisa dibuka lewat filter.
    setHideOptional(next === "iso_core");
  };

  const nextStep = WIZARD_STEPS.find((s) => s.number === currentStep + 1);
  const completenessValue = useMemo(() => (completeness ? { result: completeness, jumpTo } : null), [completeness, jumpTo]);

  return (
    <IsoCodeProvider value={showIsoCodes}>
      <FormProvider {...form}>
        <FormUiContext.Provider value={{ profile, hideOptional }}>
          <BaselineContext.Provider value={baseline}>
            <CompletenessContext.Provider value={completenessValue}>
              <div className="flex min-h-screen flex-col bg-background text-foreground">
                <Header
                  datasetTitle={isInitialized ? values.identification?.title || datasetMeta.title || "Dataset tanpa judul" : undefined}
                  sourceType={isInitialized ? sourceType : undefined}
                  profile={profile}
                  onProfileChange={changeProfile}
                  showIsoCodes={showIsoCodes}
                  onToggleIsoCodes={setShowIsoCodes}
                  completeness={completeness}
                  onJump={jumpTo}
                  onReset={() => setIsInitialized(false)}
                  onOpenDownload={handleDownloadXml}
                  onOpenPushModal={() => setShowPushModal(true)}
                />

                {!isInitialized ? (
                  /* ---------------------------- Pemilih sumber ---------------------------- */
                  <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-10 sm:py-14">
                    <div className="space-y-2">
                      <h1 className="text-xl font-semibold tracking-tight text-foreground">Buka metadata yang akan diisi</h1>
                      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                        Lengkapi metadata sesuai SE Kepala BIG No. 6 Tahun 2021 tanpa menghapus UUID, thumbnail, dan tautan unduhan yang sudah
                        dibuat GeoNode.
                      </p>
                    </div>

                    {loadError && (
                      <Notice tone="danger" title="Metadata belum bisa dibuka">
                        <p>{loadError}</p>
                      </Notice>
                    )}

                    <section className="rounded-xl border border-border bg-card p-5 shadow-xs sm:p-6">
                      <h2 className="text-base font-semibold text-foreground">Tarik dari GeoNode</h2>
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        Metadata diambil lewat REST API dan CSW GeoNode, lalu dibuka untuk diedit tanpa mengubah server.
                      </p>

                      <form onSubmit={handleFetchFromGeoNode} className="mt-5 space-y-4">
                        <Field label="Alamat halaman dataset" hint="Salin dari bilah alamat browser saat membuka dataset di GeoNode.">
                          {(control) => (
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <input
                                {...control}
                                type="text"
                                inputMode="url"
                                autoComplete="off"
                                spellCheck={false}
                                value={geonodeUrlInput}
                                onChange={(e) => setGeonodeUrlInput(e.target.value)}
                                placeholder="https://geoportal.kaltimprov.go.id/datasets/geonode:jaringan_irigasi"
                                className={cn(inputClass, "font-mono text-sm")}
                              />
                              <Button type="submit" variant="primary" disabled={!canFetch}>
                                {fetchLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {fetchLoading ? "Memuat metadata" : "Muat metadata"}
                              </Button>
                            </div>
                          )}
                        </Field>

                        <div aria-live="polite">
                          <UrlReading reading={urlReading} />
                        </div>

                        <div>
                          <button
                            type="button"
                            onClick={() => setShowAuthFields(!showAuthFields)}
                            aria-expanded={showAuthFields}
                            className="inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-primary hover:underline"
                          >
                            <ChevronRight className={cn("h-4 w-4 transition-transform duration-150", showAuthFields && "rotate-90")} strokeWidth={1.75} />
                            Dataset privat? Masuk dengan akun GeoNode
                          </button>

                          {showAuthFields && (
                            <div className="mt-3 space-y-3 border-l-2 border-border pl-4">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="Username GeoNode">
                                  {(control) => (
                                    <input
                                      {...control}
                                      type="text"
                                      autoComplete="username"
                                      value={authUsername}
                                      onChange={(e) => setAuthUsername(e.target.value)}
                                      className={inputClass}
                                    />
                                  )}
                                </Field>
                                <Field label="Password GeoNode">
                                  {(control) => (
                                    <input
                                      {...control}
                                      type="password"
                                      autoComplete="current-password"
                                      value={authPassword}
                                      onChange={(e) => setAuthPassword(e.target.value)}
                                      className={inputClass}
                                    />
                                  )}
                                </Field>
                              </div>
                              <p className="text-[13px] text-muted-foreground">Akun hanya diteruskan ke GeoNode untuk permintaan ini dan tidak disimpan.</p>
                            </div>
                          )}
                        </div>
                      </form>
                    </section>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragging(false);
                          handleFile(e.dataTransfer.files?.[0]);
                        }}
                        className={cn(
                          "flex cursor-pointer flex-col justify-between gap-4 rounded-xl border border-dashed p-5 transition-colors duration-150 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary",
                          isDragging ? "border-primary bg-primary-subtle" : "border-input-border bg-card hover:bg-muted/60"
                        )}
                      >
                        <div className="space-y-1">
                          <span className="flex items-center gap-2 text-base font-semibold text-foreground">
                            <Upload className="h-4 w-4 text-primary" strokeWidth={1.75} />
                            Unggah file .xml
                          </span>
                          <span className="block text-[13px] leading-normal text-muted-foreground">
                            Tarik file ke sini, atau klik untuk memilih. Menerima XML ISO 19139 dari GeoNode, GeoNetwork, atau CatMDEdit.
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-primary">Pilih file dari komputer</span>
                        <input
                          type="file"
                          accept=".xml,application/xml,text/xml"
                          onChange={(e) => {
                            handleFile(e.target.files?.[0]);
                            e.target.value = "";
                          }}
                          className="sr-only"
                        />
                      </label>

                      <div className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
                        <div className="space-y-1">
                          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
                            <FilePlus2 className="h-4 w-4 text-primary" strokeWidth={1.75} />
                            Buat metadata baru
                          </h2>
                          <p className="text-[13px] leading-normal text-muted-foreground">
                            Kerangka SNI 8843-1:2019 dengan UUID baru, tanggal hari ini, dan SRGI 2013.
                          </p>
                        </div>
                        <Button variant="secondary" onClick={handleCreateNew} className="self-start">
                          Buat metadata baru
                        </Button>
                      </div>
                    </div>

                    <p className="text-[13px] text-muted-foreground">
                      Ingin mencoba dulu?{" "}
                      <button
                        type="button"
                        onClick={handleLoadSampleFile}
                        disabled={fetchLoading}
                        className="rounded font-medium text-primary hover:underline disabled:opacity-50"
                      >
                        Buka contoh metadata Jaringan Irigasi Provinsi Kalimantan Timur
                      </button>
                    </p>

                    {savedDraft && (
                      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <History className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{savedDraft.data.identification?.title || "Draf tanpa judul"}</p>
                            <p className="text-[13px] text-muted-foreground">
                              Draf tersimpan {new Date(savedDraft.savedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              clearDraftStorage();
                              setSavedDraft(null);
                            }}
                          >
                            Hapus draf
                          </Button>
                          <Button variant="primary" size="sm" onClick={handleResumeDraft}>
                            Lanjutkan draf
                          </Button>
                        </div>
                      </div>
                    )}
                  </main>
                ) : (
                  /* ---------------------------- Workspace editor ---------------------------- */
                  <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-6 lg:py-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
                      <nav aria-label="Bab pengisian" className="shrink-0 lg:w-64">
                        <ol className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:sticky lg:top-20 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
                          {WIZARD_STEPS.map((step) => {
                            const isActive = currentStep === step.number;
                            const own = completeness?.steps[step.number];
                            // Bab 5 tidak punya isian wajib; tampilkan kelengkapan keseluruhan sebagai audit akhir.
                            const stat = step.number === 5 || !own || own.total === 0 ? completeness : own;
                            const percent = stat?.percent ?? 0;
                            const complete = percent >= 100;

                            return (
                              <li key={step.number} className="shrink-0">
                                <button
                                  type="button"
                                  onClick={() => goToStep(step.number)}
                                  aria-current={isActive ? "step" : undefined}
                                  className={cn(
                                    "flex w-[14.5rem] items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 lg:w-full",
                                    isActive ? "bg-primary-subtle ring-1 ring-primary-subtle-border" : "hover:bg-muted"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                                      complete
                                        ? "text-accent-teal"
                                        : isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "border border-input-border text-muted-foreground"
                                    )}
                                  >
                                    {complete ? <CheckCircle2 className="h-6 w-6" strokeWidth={1.75} aria-label="Lengkap" /> : step.number}
                                  </span>
                                  <span className="min-w-0 flex-1 space-y-1">
                                    <span className="block text-sm font-medium text-foreground">{step.title}</span>
                                    {stat && (
                                      <span className="flex items-baseline justify-between gap-2 text-[13px] tabular-nums">
                                        <span className="text-muted-foreground">
                                          {step.number === 5 ? "Keseluruhan " : ""}
                                          {stat.done}/{stat.total} wajib
                                        </span>
                                        <span className={cn("font-medium", complete ? "text-accent-teal" : "text-foreground")}>{percent}%</span>
                                      </span>
                                    )}
                                    <ProgressBar percent={percent} />
                                    <span className="block">
                                      <IsoCode>{step.isoCode}</IsoCode>
                                    </span>
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ol>
                      </nav>

                      <div className="min-w-0 max-w-4xl flex-1 space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5">
                          <ViewControls
                            className="xl:hidden"
                            profile={profile}
                            onProfileChange={changeProfile}
                            showIsoCodes={showIsoCodes}
                            onToggleIsoCodes={setShowIsoCodes}
                          />
                          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-muted-foreground hover:text-foreground">
                            <input type="checkbox" checked={hideOptional} onChange={(e) => setHideOptional(e.target.checked)} className={checkboxClass} />
                            Sembunyikan kolom opsional
                          </label>
                          <p className="hidden text-[13px] text-muted-foreground xl:block">
                            Kolom yang berubah dari nilai awal bisa dikembalikan lewat tombol Kembalikan di labelnya.
                          </p>
                        </div>

                        {currentStep === 1 && <Step1MetadataInfo />}
                        {currentStep === 2 && <Step2Identification />}
                        {currentStep === 3 && <Step3SpatialContent />}
                        {currentStep === 4 && <Step4QualityDistribution />}
                        {currentStep === 5 && (
                          <Step5AdvancedPreview
                            generatedXml={generatedXml}
                            originalXml={originalXml}
                            onGoToStep={goToStep}
                            onOpenPushModal={() => setShowPushModal(true)}
                            onDownloadXml={handleDownloadXml}
                          />
                        )}

                        <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
                          <Button variant="secondary" disabled={currentStep === 1} onClick={() => goToStep(Math.max(1, currentStep - 1) as WizardStep)}>
                            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
                            Sebelumnya
                          </Button>

                          {nextStep ? (
                            <Button variant="primary" onClick={() => goToStep(nextStep.number)}>
                              <span className="sm:hidden">Berikutnya</span>
                              <span className="hidden sm:inline">Lanjut ke {nextStep.title.toLowerCase()}</span>
                              <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                            </Button>
                          ) : (
                            <Button variant="primary" onClick={handleDownloadXml}>
                              <Download className="h-4 w-4" strokeWidth={1.75} />
                              Unduh XML
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </main>
                )}

                <PushGeoNodeModal
                  isOpen={showPushModal}
                  onClose={() => setShowPushModal(false)}
                  xmlContent={generatedXml}
                  defaultBaseUrl={datasetMeta.baseUrl || ""}
                  defaultPk={datasetMeta.pk || ""}
                  onDownloadManual={handleDownloadXml}
                />
              </div>
            </CompletenessContext.Provider>
          </BaselineContext.Provider>
        </FormUiContext.Provider>
      </FormProvider>
    </IsoCodeProvider>
  );
}
