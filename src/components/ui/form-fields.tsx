"use client";

import React, { useState } from "react";
import { useController, useFieldArray, useFormContext, useWatch, type FieldArrayPath, type FieldPath } from "react-hook-form";
import { RotateCcw, X } from "lucide-react";
import { Button, Field, IsoCode, checkboxClass, inputClass, selectClass, textareaClass, type ControlProps } from "@/components/ui/form";
import { DatePickerInput } from "@/components/ui/date-picker";
import type { ObligationType } from "@/components/ui/badge";
import { useBaseline, useFormUi } from "@/components/ui/form-context";
import { PROFILES, isLevelRequired } from "@/lib/completeness";
import type { MetadataFormData } from "@/lib/metadata-schema";
import { deepClone, fieldDomId, getAtPath, hasPath, summarizeValue, valuesEqual } from "@/lib/value-utils";
import { cn } from "@/lib/utils";

type Path = FieldPath<MetadataFormData>;

/* ------------------------------------------------------------------ */
/* Kewajiban terhadap profil aktif                                     */
/* ------------------------------------------------------------------ */

function useRequired(level: ObligationType | undefined, override?: boolean): boolean {
  const { profile } = useFormUi();
  if (override !== undefined) return override;
  if (level === "iso" || level === "sdi" || level === "walidata") return isLevelRequired(level, profile);
  return false;
}

function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/* ------------------------------------------------------------------ */
/* Tombol Kembalikan (per kolom) & Pulihkan daftar awal                */
/* ------------------------------------------------------------------ */

export function RevertButton({ label, baseValue, onRevert }: { label: React.ReactNode; baseValue: unknown; onRevert: () => void }) {
  const preview = summarizeValue(baseValue);
  const title = preview ? `Kembalikan ke nilai awal: ${preview}` : "Kosongkan kembali ke kondisi awal";
  return (
    <button
      type="button"
      onClick={onRevert}
      title={title}
      aria-label={`${title}${typeof label === "string" ? ` (${label})` : ""}`}
      className="inline-flex items-center gap-1 rounded px-1 text-[13px] text-muted-foreground transition-colors duration-150 hover:text-primary"
    >
      <RotateCcw className="h-[13px] w-[13px]" strokeWidth={1.75} aria-hidden="true" />
      Kembalikan
    </button>
  );
}

/** Status perubahan satu path terhadap baseline. Item baru (tanpa padanan di baseline) tidak dianggap berubah. */
function useBaselineDiff(name: string, current: unknown) {
  const baseline = useBaseline();
  const known = baseline !== null && hasPath(baseline, name);
  const baseValue = known ? getAtPath(baseline, name) : undefined;
  return { changed: known && !valuesEqual(current, baseValue), baseValue };
}

/* ------------------------------------------------------------------ */
/* FormField: pembungkus kolom yang terikat ke react-hook-form         */
/* ------------------------------------------------------------------ */

export interface FieldRender {
  control: ControlProps;
  value: any;
  onChange: (value: any) => void;
  onBlur: () => void;
  required: boolean;
}

export interface FormFieldProps {
  name: string;
  label: React.ReactNode;
  /** Tingkat kewajiban (badge) — menentukan juga apakah kolom dihitung untuk profil aktif. */
  level?: ObligationType;
  /** Paksa wajib/tidak, mis. kolom Bersyarat yang syaratnya sedang terpenuhi. */
  required?: boolean;
  isoCode?: string;
  hint?: React.ReactNode;
  conditionNote?: string;
  aside?: React.ReactNode;
  className?: string;
}

export function FormField({
  name,
  label,
  level,
  required: requiredOverride,
  isoCode,
  hint,
  conditionNote,
  aside,
  className,
  children,
}: FormFieldProps & { children: (field: FieldRender) => React.ReactNode }) {
  const { control, setValue } = useFormContext<MetadataFormData>();
  const { field, fieldState } = useController({ control, name: name as Path });
  const { profile, hideOptional } = useFormUi();
  const required = useRequired(level, requiredOverride);
  const { changed, baseValue } = useBaselineDiff(name, field.value);

  if (hideOptional && level && !required && !changed) return null;

  const formatError = fieldState.error?.message;
  const missingError =
    required && fieldState.isTouched && isEmptyValue(field.value) ? `Wajib diisi untuk profil ${PROFILES[profile].shortLabel}.` : null;
  const badge: ObligationType | undefined = level === "conditional" && requiredOverride ? "conditional" : level;

  return (
    <Field
      id={fieldDomId(name)}
      label={label}
      isoCode={isoCode}
      obligation={badge}
      conditionNote={conditionNote}
      hint={hint}
      aside={aside}
      error={formatError ?? missingError}
      className={className}
      actions={
        changed ? (
          <RevertButton
            label={label}
            baseValue={baseValue}
            onRevert={() => setValue(name as Path, deepClone(baseValue) as never, { shouldValidate: true, shouldDirty: true, shouldTouch: true })}
          />
        ) : null
      }
    >
      {(controlProps) =>
        children({
          control: controlProps,
          value: field.value,
          onChange: field.onChange,
          onBlur: field.onBlur,
          required,
        })
      }
    </Field>
  );
}

/* ------------------------------------------------------------------ */
/* Kolom siap pakai                                                    */
/* ------------------------------------------------------------------ */

interface TextFieldProps extends FormFieldProps {
  placeholder?: string;
  type?: string;
  mono?: boolean;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  readOnly?: boolean;
  inputClassName?: string;
}

export function TextField({ placeholder, type = "text", mono, autoComplete = "off", inputMode, readOnly, inputClassName, ...props }: TextFieldProps) {
  return (
    <FormField {...props}>
      {({ control, value, onChange, onBlur }) => (
        <input
          {...control}
          type={type}
          autoComplete={autoComplete}
          inputMode={inputMode}
          readOnly={readOnly}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className={cn(inputClass, mono && "font-mono text-sm", readOnly && "bg-muted text-muted-foreground", inputClassName)}
        />
      )}
    </FormField>
  );
}

export function TextAreaField({ placeholder, rows = 4, counter, ...props }: FormFieldProps & { placeholder?: string; rows?: number; counter?: boolean }) {
  const { control } = useFormContext<MetadataFormData>();
  const value = useWatch({ control, name: props.name as Path }) as string | undefined;
  return (
    <FormField {...props} aside={counter ? <span className="text-xs tabular-nums text-muted-foreground">{(value ?? "").length} karakter</span> : props.aside}>
      {({ control: c, value: v, onChange, onBlur }) => (
        <textarea
          {...c}
          rows={rows}
          value={v ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          className={textareaClass}
        />
      )}
    </FormField>
  );
}

export interface Option {
  code: string;
  label: string;
}

export function SelectField({ options, emptyLabel = "Belum dipilih", ...props }: FormFieldProps & { options: Option[]; emptyLabel?: string | null }) {
  return (
    <FormField {...props}>
      {({ control, value, onChange, onBlur }) => {
        const current = (value as string) ?? "";
        const known = current === "" || options.some((o) => o.code === current);
        return (
          <select {...control} value={current} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} className={selectClass}>
            {emptyLabel !== null && <option value="">{emptyLabel}</option>}
            {!known && <option value={current}>{current} (dari XML)</option>}
            {options.map((o) => (
              <option key={o.code} value={o.code}>
                {o.label}
              </option>
            ))}
          </select>
        );
      }}
    </FormField>
  );
}

/** Boolean tiga keadaan ("", "true", "false") untuk gco:Boolean yang boleh belum ditentukan. */
export function TriBoolField({ yesLabel = "Ya", noLabel = "Tidak", ...props }: FormFieldProps & { yesLabel?: string; noLabel?: string }) {
  return (
    <SelectField
      {...props}
      emptyLabel="Belum ditentukan"
      options={[
        { code: "true", label: yesLabel },
        { code: "false", label: noLabel },
      ]}
    />
  );
}

export function NumberField({
  placeholder,
  integer,
  prefix,
  suffix,
  ...props
}: FormFieldProps & { placeholder?: string; integer?: boolean; prefix?: string; suffix?: string }) {
  return (
    <FormField {...props}>
      {({ control, value, onChange, onBlur }) => (
        <div className="flex items-center gap-2">
          {prefix && <span className="shrink-0 font-mono text-sm text-muted-foreground">{prefix}</span>}
          <input
            {...control}
            type="number"
            step={integer ? 1 : "any"}
            inputMode={integer ? "numeric" : "decimal"}
            value={value === null || value === undefined || Number.isNaN(value) ? "" : value}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") return onChange(null);
              const n = integer ? parseInt(raw, 10) : parseFloat(raw);
              onChange(Number.isFinite(n) ? n : null);
            }}
            onBlur={onBlur}
            placeholder={placeholder}
            className={cn(inputClass, "font-mono text-sm tabular-nums")}
          />
          {suffix && <span className="shrink-0 text-sm text-muted-foreground">{suffix}</span>}
        </div>
      )}
    </FormField>
  );
}

export function DateField(props: FormFieldProps) {
  return (
    <FormField {...props}>
      {({ control, value, onChange, onBlur, required }) => (
        <DatePickerInput {...control} value={value ?? ""} onChange={onChange} onBlur={onBlur} allowClear={!required} />
      )}
    </FormField>
  );
}

export function CheckboxField({ name, label, hint }: { name: string; label: React.ReactNode; hint?: React.ReactNode }) {
  const { control, setValue } = useFormContext<MetadataFormData>();
  const { field } = useController({ control, name: name as Path });
  const { changed, baseValue } = useBaselineDiff(name, field.value);
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          id={fieldDomId(name)}
          type="checkbox"
          checked={Boolean(field.value)}
          onChange={(e) => field.onChange(e.target.checked)}
          onBlur={field.onBlur}
          className={cn(checkboxClass, "mt-0.5")}
        />
        <span className="space-y-0.5">
          <span className="block text-sm font-medium text-foreground">{label}</span>
          {hint && <span className="block text-[13px] leading-normal text-muted-foreground">{hint}</span>}
        </span>
      </label>
      {changed && (
        <RevertButton
          label={label}
          baseValue={baseValue}
          onRevert={() => setValue(name as Path, deepClone(baseValue) as never, { shouldDirty: true, shouldTouch: true })}
        />
      )}
    </div>
  );
}

/** Daftar string sebagai chip (kata kunci, nama unsur KUGI). */
export function ChipsField({ placeholder, addLabel = "Tambah", ...props }: FormFieldProps & { placeholder?: string; addLabel?: string }) {
  const [draft, setDraft] = useState("");
  return (
    <FormField {...props}>
      {({ control, value, onChange, onBlur }) => {
        const items: string[] = Array.isArray(value) ? value : [];
        const add = () => {
          const parts = draft
            .split(/[,;\n]/)
            .map((p) => p.trim())
            .filter((p) => p && !items.includes(p));
          if (parts.length) onChange([...items, ...parts]);
          setDraft("");
        };
        return (
          <div className="space-y-2.5">
            <div className="flex gap-2">
              <input
                {...control}
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    add();
                  }
                }}
                onBlur={() => {
                  if (draft.trim()) add();
                  onBlur();
                }}
                placeholder={placeholder}
                className={inputClass}
              />
              <Button onClick={add} disabled={!draft.trim()}>
                {addLabel}
              </Button>
            </div>
            {items.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Isian terpasang">
                {items.map((item) => (
                  <li key={item} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted py-1 pl-2.5 pr-1 text-sm text-foreground">
                    {item}
                    <button
                      type="button"
                      onClick={() => onChange(items.filter((i) => i !== item))}
                      aria-label={`Hapus ${item}`}
                      className="rounded p-0.5 text-muted-foreground transition-colors duration-150 hover:bg-card hover:text-rose-600"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      }}
    </FormField>
  );
}

/** Tombol pilihan cepat di bawah sebuah kolom (preset skala, level jangkauan, dll.). */
export function QuickPicks<T extends string | number>({
  options,
  value,
  onPick,
  label = "Isi cepat:",
  format = (v) => String(v),
  mono,
}: {
  options: readonly T[];
  value: unknown;
  onPick: (v: T) => void;
  label?: string;
  format?: (v: T) => string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {label && <span className="text-[13px] text-muted-foreground">{label}</span>}
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onPick(opt)}
            aria-pressed={active}
            className={cn(
              "h-8 rounded-md border px-2.5 text-[13px] font-medium transition-colors duration-150",
              mono && "font-mono tabular-nums",
              active ? "border-primary bg-primary-subtle text-foreground" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {format(opt)}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Daftar dinamis (useFieldArray) + Pulihkan daftar awal               */
/* ------------------------------------------------------------------ */

type ArrayPath = FieldArrayPath<MetadataFormData>;

export function useListField(name: string) {
  const { control } = useFormContext<MetadataFormData>();
  const array = useFieldArray({ control, name: name as ArrayPath });
  const baseline = useBaseline();
  const baseItems = baseline && hasPath(baseline, name) ? (getAtPath(baseline, name) as unknown[]) : null;
  const countChanged = baseItems !== null && baseItems.length !== array.fields.length;

  return {
    ...array,
    baselineCount: baseItems?.length ?? 0,
    countChanged,
    restore: () => {
      if (baseItems) array.replace(deepClone(baseItems) as never);
    },
  };
}

/** Muncul hanya bila jumlah item berbeda dari baseline (item bertambah atau terhapus). */
export function ListRestoreButton({ list }: { list: ReturnType<typeof useListField> }) {
  if (!list.countChanged) return null;
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={list.restore}
      title={list.baselineCount ? `Kembalikan daftar ke ${list.baselineCount} item awal` : "Kosongkan daftar seperti kondisi awal"}
    >
      <RotateCcw className="h-[13px] w-[13px]" strokeWidth={1.75} />
      Pulihkan daftar awal
    </Button>
  );
}

/** Judul kecil berisi kode ISO (untuk dipakai di dalam ItemBlock). */
export function ItemTitle({ children, isoCode }: { children: React.ReactNode; isoCode?: string }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-2">
      {children}
      {isoCode && <IsoCode>{isoCode}</IsoCode>}
    </span>
  );
}
