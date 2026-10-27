"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Download, CloudUpload, ArrowLeft, CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/form";
import { ObligationBadge } from "@/components/ui/badge";
import {
  PROFILES,
  PROFILE_ORDER,
  WIZARD_STEPS,
  stepOfRequirement,
  type CompletenessResult,
  type ProfileId,
  type Requirement,
} from "@/lib/completeness";

interface HeaderProps {
  datasetTitle?: string;
  sourceType?: "geonode" | "local" | "new";
  profile: ProfileId;
  onProfileChange: (profile: ProfileId) => void;
  showIsoCodes: boolean;
  onToggleIsoCodes: (show: boolean) => void;
  completeness: CompletenessResult | null;
  onJump: (req: Requirement) => void;
  onReset: () => void;
  onOpenDownload: () => void;
  onOpenPushModal: () => void;
}

const SOURCE_LABEL: Record<NonNullable<HeaderProps["sourceType"]>, string> = {
  geonode: "Tertaut GeoNode",
  local: "File lokal",
  new: "Metadata baru",
};

/** Tanda aplikasi: bingkai peta dengan garis graticule. */
function GeoMetaMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 text-primary" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="4" stroke="currentColor" strokeWidth="1.75" />
      <path d="M2.5 9.5h19M2.5 14.5h19M9.5 2.5v19M14.5 2.5v19" stroke="currentColor" strokeWidth="1" opacity="0.45" />
      <rect x="9.5" y="9.5" width="5" height="5" fill="currentColor" />
    </svg>
  );
}

/** Pemilih profil kelengkapan + tampilan kode ISO. Dipakai di header (desktop lebar) dan di atas form. */
export function ViewControls({
  profile,
  onProfileChange,
  showIsoCodes,
  onToggleIsoCodes,
  className,
}: Pick<HeaderProps, "profile" | "onProfileChange" | "showIsoCodes" | "onToggleIsoCodes"> & { className?: string }) {
  const segment = (active: boolean) =>
    cn(
      "h-8 whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium transition-colors duration-150",
      active ? "bg-card text-foreground shadow-xs ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <div role="radiogroup" aria-label="Profil kelengkapan" className="flex max-w-full overflow-x-auto rounded-lg bg-muted p-0.5">
        {PROFILE_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={profile === id}
            onClick={() => onProfileChange(id)}
            title={`${PROFILES[id].label}: ${PROFILES[id].description}`}
            className={segment(profile === id)}
          >
            {PROFILES[id].shortLabel}
          </button>
        ))}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-muted-foreground hover:text-foreground">
        <input
          type="checkbox"
          checked={showIsoCodes}
          onChange={(e) => onToggleIsoCodes(e.target.checked)}
          className="h-4 w-4 rounded border-input-border accent-primary"
        />
        Kode ISO
      </label>
    </div>
  );
}

/** Pil "Kelengkapan SDI: 78% (25/32)" yang membuka daftar isian wajib yang belum terisi. */
function CompletenessButton({ result, onJump }: { result: CompletenessResult; onJump: (req: Requirement) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const complete = result.missing.length === 0;
  const label = PROFILES[result.profile].scoreLabel;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors duration-150",
          complete ? "border-accent-teal/40 bg-accent-teal/10 text-foreground" : "border-border bg-muted text-foreground hover:bg-card"
        )}
      >
        {complete ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-accent-teal" strokeWidth={2} />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
        )}
        <span className="hidden text-muted-foreground xl:inline">Kelengkapan {label}:</span>
        <span className="tabular-nums">{result.percent}%</span>
        <span className="tabular-nums text-muted-foreground">
          ({result.done}/{result.total})
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform duration-150", open && "rotate-180")} strokeWidth={1.75} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Isian wajib yang belum terisi"
          className="absolute right-0 top-full z-50 mt-1 max-h-[70vh] w-[22rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">{PROFILES[result.profile].label}</p>
            <p className="text-[13px] text-muted-foreground">
              {complete ? "Semua isian wajib sudah terisi." : `${result.missing.length} isian wajib belum terisi.`}
            </p>
          </div>
          {WIZARD_STEPS.map((step) => {
            const items = result.missing.filter((r) => stepOfRequirement(r) === step.number);
            if (items.length === 0) return null;
            return (
              <div key={step.number} className="border-b border-border px-4 py-3 last:border-b-0">
                <p className="pb-1.5 text-[13px] font-semibold text-muted-foreground">
                  Bab {step.number}: {step.title}
                </p>
                <ul className="space-y-0.5">
                  {items.map((req) => (
                    <li key={req.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          onJump(req);
                        }}
                        className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors duration-150 hover:bg-muted"
                      >
                        <span className="min-w-0">{req.label}</span>
                        <ObligationBadge type={req.level} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Header({
  datasetTitle,
  sourceType,
  profile,
  onProfileChange,
  showIsoCodes,
  onToggleIsoCodes,
  completeness,
  onJump,
  onReset,
  onOpenDownload,
  onOpenPushModal,
}: HeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const inWorkspace = Boolean(datasetTitle);
  const isDark = resolvedTheme === "dark";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {inWorkspace ? (
            <>
              <Button variant="ghost" size="icon-sm" onClick={onReset} aria-label="Ganti sumber metadata" title="Ganti sumber metadata">
                <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
              </Button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground md:text-[15px]" title={datasetTitle}>
                  {datasetTitle}
                </p>
                {sourceType && <p className="truncate text-xs text-muted-foreground">{SOURCE_LABEL[sourceType]}</p>}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2.5">
              <GeoMetaMark />
              <span className="text-[15px] font-semibold tracking-tight text-foreground">GeoMeta Editor</span>
            </div>
          )}
        </div>

        {inWorkspace && (
          <ViewControls
            className="hidden flex-nowrap xl:flex"
            profile={profile}
            onProfileChange={onProfileChange}
            showIsoCodes={showIsoCodes}
            onToggleIsoCodes={onToggleIsoCodes}
          />
        )}

        <div className="flex shrink-0 items-center gap-2">
          {inWorkspace && completeness && (
            <div className="hidden md:block">
              <CompletenessButton result={completeness} onJump={onJump} />
            </div>
          )}

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={mounted ? (isDark ? "Pakai tema terang" : "Pakai tema gelap") : "Ganti tema"}
            title={mounted ? (isDark ? "Pakai tema terang" : "Pakai tema gelap") : undefined}
          >
            {mounted && isDark ? <Sun className="h-4 w-4" strokeWidth={1.75} /> : <Moon className="h-4 w-4" strokeWidth={1.75} />}
          </Button>

          {inWorkspace && (
            <>
              <Button variant="secondary" size="sm" onClick={onOpenDownload} aria-label="Unduh XML" title="Unduh XML" className="max-lg:w-8 max-lg:px-0">
                <Download className="h-4 w-4" strokeWidth={1.75} />
                <span className="hidden lg:inline">Unduh XML</span>
              </Button>
              <Button variant="primary" size="sm" onClick={onOpenPushModal} aria-label="Simpan ke GeoNode" title="Simpan ke GeoNode" className="max-lg:w-8 max-lg:px-0">
                <CloudUpload className="h-4 w-4" strokeWidth={1.75} />
                <span className="hidden lg:inline">Simpan ke GeoNode</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
