"use client";

import React, { createContext, useContext, useId } from "react";
import { AlertCircle, Check, CheckCircle2, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ObligationBadge, type ObligationType } from "@/components/ui/badge";
import { useCompleteness, useFormUi } from "@/components/ui/form-context";
import { cardDomId, type CardId, type CompletenessStat } from "@/lib/completeness";

/* ------------------------------------------------------------------ */
/* Tampilan kode teknis ISO (toggle di header)                         */
/* ------------------------------------------------------------------ */

const IsoCodeContext = createContext(false);
export const IsoCodeProvider = IsoCodeContext.Provider;

export function IsoCode({ children }: { children: React.ReactNode }) {
  const show = useContext(IsoCodeContext);
  if (!show) return null;
  return <code className="font-mono text-xs font-normal text-muted-foreground">{children}</code>;
}

/* ------------------------------------------------------------------ */
/* Kelas kontrol input                                                 */
/* ------------------------------------------------------------------ */

const controlBase =
  "w-full rounded-lg border border-input-border bg-input text-[15px] text-foreground placeholder:text-muted-foreground/70 " +
  "transition-colors duration-150 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 " +
  "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground " +
  "aria-[invalid=true]:border-rose-400 dark:aria-[invalid=true]:border-rose-700";

export const inputClass = cn(controlBase, "h-10 px-3");
export const selectClass = cn(controlBase, "h-10 pl-3 pr-8");
export const textareaClass = cn(controlBase, "px-3 py-2.5 leading-relaxed");
export const checkboxClass = "h-4 w-4 shrink-0 rounded border-input-border accent-primary";

/* ------------------------------------------------------------------ */
/* Field: label + badge + panduan + kontrol + pesan validasi           */
/* ------------------------------------------------------------------ */

export interface ControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

interface FieldProps {
  label: React.ReactNode;
  isoCode?: string;
  obligation?: ObligationType;
  conditionNote?: string;
  hint?: React.ReactNode;
  error?: string | null;
  /** Elemen kecil di kanan baris label, mis. penghitung karakter. */
  aside?: React.ReactNode;
  /** Aksi mikro di baris label, mis. tombol "Kembalikan". */
  actions?: React.ReactNode;
  /** ID kontrol yang stabil (dipakai lompat-ke-kolom); bawaan dibuat otomatis. */
  id?: string;
  className?: string;
  children: (control: ControlProps) => React.ReactNode;
}

export function Field({ label, isoCode, obligation, conditionNote, hint, error, aside, actions, id: fixedId, className, children }: FieldProps) {
  const autoId = useId();
  const id = fixedId ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label htmlFor={id} className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-foreground">
          <span>{label}</span>
          {isoCode && <IsoCode>{isoCode}</IsoCode>}
        </label>
        <div className="flex items-center gap-2">
          {actions}
          {aside}
          {obligation && <ObligationBadge type={obligation} conditionNote={conditionNote} />}
        </div>
      </div>
      {hint && (
        <p id={hintId} className="text-[13px] leading-normal text-muted-foreground">
          {hint}
        </p>
      )}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-[13px] text-rose-700 dark:text-rose-300">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section: kartu seksi logis di dalam satu langkah                    */
/* ------------------------------------------------------------------ */

/** Chip "Terisi 4/5 (80%)" untuk item wajib profil aktif di sebuah kartu. */
export function CompletenessChip({ stat, className }: { stat: CompletenessStat; className?: string }) {
  const complete = stat.done >= stat.total;
  return (
    <span
      title={`${stat.done} dari ${stat.total} isian wajib profil aktif di kartu ini sudah terisi`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium tabular-nums",
        complete ? "border-accent-teal/40 bg-accent-teal/10 text-foreground" : "border-border bg-muted text-muted-foreground",
        className
      )}
    >
      {complete ? (
        <Check className="h-3 w-3 text-accent-teal" strokeWidth={2.5} aria-hidden="true" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true" />
      )}
      Terisi {stat.done}/{stat.total} ({stat.percent}%)
    </span>
  );
}

interface SectionProps {
  title: React.ReactNode;
  isoCode?: string;
  obligation?: ObligationType;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Kartu kelengkapan: menampilkan chip rasio dan menjadi target lompat-ke-kartu. */
  card?: CardId;
  /** Kartu berisi isian opsional saja; disembunyikan oleh filter "Sembunyikan kolom opsional". */
  optional?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function Section({ title, isoCode, obligation, description, actions, card, optional, className, children }: SectionProps) {
  const completeness = useCompleteness();
  const { hideOptional } = useFormUi();
  const stat = card ? completeness?.result.cards[card] : undefined;
  // Kartu tanpa isian wajib di profil aktif hanya berisi kolom opsional, jadi ikut disembunyikan filter.
  if (hideOptional && !stat && (optional || (card && completeness))) return null;

  return (
    <section
      id={card ? cardDomId(card) : undefined}
      tabIndex={card ? -1 : undefined}
      className={cn("scroll-mt-24 rounded-xl border border-border bg-card p-5 shadow-xs focus:outline-none sm:p-6", className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base font-semibold text-foreground">
            <span>{title}</span>
            {isoCode && <IsoCode>{isoCode}</IsoCode>}
            {obligation && <ObligationBadge type={obligation} />}
          </h3>
          {description && <p className="max-w-prose text-[13px] leading-normal text-muted-foreground">{description}</p>}
        </div>
        {(actions || stat) && (
          <div className="flex flex-wrap items-center justify-end gap-2">
            {actions}
            {stat && <CompletenessChip stat={stat} />}
          </div>
        )}
      </header>
      {children && <div className="mt-5 space-y-5">{children}</div>}
    </section>
  );
}

/** Satu item di dalam daftar dinamis (lapis kedua; tidak pernah berisi kartu lagi). */
export function ItemBlock({
  title,
  actions,
  className,
  children,
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-lg border border-border", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
        <p className="min-w-0 text-sm font-medium text-foreground">{title}</p>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
      <div className="space-y-5 p-4">{children}</div>
    </div>
  );
}

/** Daftar kosong: ajakan bertindak, bukan sekadar "tidak ada data". */
export function EmptyList({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-input-border px-4 py-3 text-[13px] text-muted-foreground">{children}</p>;
}

/* ------------------------------------------------------------------ */
/* Judul langkah wizard                                                */
/* ------------------------------------------------------------------ */

export function StepHeader({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[13px] font-medium text-primary">Bab {step} dari 5</p>
      <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tombol                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "sm" | "icon" | "icon-sm";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "border border-input-border bg-card text-foreground hover:bg-muted",
  ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40",
};

const buttonSizes: Record<ButtonSize, string> = {
  md: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-[13px]",
  icon: "h-10 w-10",
  "icon-sm": "h-8 w-8",
};

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-50",
    buttonVariants[variant],
    buttonSizes[size],
    className
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = "secondary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

/* ------------------------------------------------------------------ */
/* Notice: kotak informasi / status                                    */
/* ------------------------------------------------------------------ */

type NoticeTone = "info" | "success" | "warning" | "danger";

const noticeTones: Record<NoticeTone, { box: string; icon: string; Icon: LucideIcon }> = {
  info: {
    box: "border-primary-subtle-border bg-primary-subtle text-foreground",
    icon: "text-primary",
    Icon: Info,
  },
  success: {
    box: "border-accent-teal/30 bg-accent-teal/[0.06] text-foreground",
    icon: "text-accent-teal",
    Icon: CheckCircle2,
  },
  warning: {
    box: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200",
    icon: "text-amber-600 dark:text-amber-400",
    Icon: TriangleAlert,
  },
  danger: {
    box: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200",
    icon: "text-rose-600 dark:text-rose-400",
    Icon: AlertCircle,
  },
};

interface NoticeProps {
  tone?: NoticeTone;
  title?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
  children?: React.ReactNode;
}

export function Notice({ tone = "info", title, icon, className, children }: NoticeProps) {
  const style = noticeTones[tone];
  const Icon = icon ?? style.Icon;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-lg border p-4 text-sm", style.box, className)}
    >
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.icon)} strokeWidth={1.75} />
      <div className="min-w-0 space-y-1 leading-relaxed">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}
