import React from "react";
import { cn } from "@/lib/utils";

/** Tingkat kewajiban SE Kepala BIG No. 6 Tahun 2021: Wajib ISO, Wajib SDI, Wajib QA Walidata, Bersyarat, Opsional. */
export type ObligationType = "iso" | "sdi" | "walidata" | "conditional" | "optional";

interface ObligationBadgeProps {
  type: ObligationType;
  conditionNote?: string;
  className?: string;
}

const styles: Record<ObligationType, { label: string; title: string; className: string }> = {
  iso: {
    label: "Wajib ISO",
    title: "Wajib menurut skema XSD ISO 19115/19139",
    className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
  },
  sdi: {
    label: "Wajib SDI",
    title: "Wajib untuk kelengkapan Satu Data Indonesia (SE Kepala BIG No. 6 Tahun 2021)",
    className: "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/60",
  },
  walidata: {
    label: "Wajib QA Walidata",
    title: "Diisi Walidata setelah Penjaminan Kualitas, sebelum publikasi JIGN",
    className: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/60",
  },
  conditional: {
    label: "Bersyarat",
    title: "Wajib diisi bila syaratnya terpenuhi",
    className: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
  },
  optional: {
    label: "Opsional",
    title: "Boleh dikosongkan",
    className: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700",
  },
};

export function ObligationBadge({ type, conditionNote, className }: ObligationBadgeProps) {
  const style = styles[type];
  return (
    <span
      title={type === "conditional" ? conditionNote || style.title : style.title}
      className={cn("inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium", style.className, className)}
    >
      {style.label}
    </span>
  );
}
