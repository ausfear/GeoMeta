"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClass, selectClass, type ControlProps } from "@/components/ui/form";
import { isValidIsoDate, normalizeDateValue, todayIsoDate } from "@/lib/metadata-schema";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const FIRST_YEAR = 1970;

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parseIso(value: string): { y: number; m: number; d: number } | null {
  if (!isValidIsoDate(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  return { y, m: m - 1, d };
}

/** Menggeser tanggal ISO sejumlah hari/bulan dengan aritmetika UTC agar bebas zona waktu. */
function shiftIso(value: string, days: number, months = 0): string {
  const p = parseIso(value)!;
  const date = new Date(Date.UTC(p.y, p.m + months, 1));
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(p.d, lastDay) + days);
  return toIso(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function formatIndonesianDate(value: string): string {
  const p = parseIso(value);
  return p ? `${p.d} ${MONTHS[p.m]} ${p.y}` : value;
}

interface CalendarProps {
  value: string;
  allowClear: boolean;
  onSelect: (value: string) => void;
  onClose: () => void;
}

function MiniCalendar({ value, allowClear, onSelect, onClose }: CalendarProps) {
  const today = todayIsoDate();
  const initial = parseIso(value) ? value : today;
  const [focusDate, setFocusDate] = useState(initial);
  const focus = parseIso(focusDate)!;
  const gridRef = useRef<HTMLDivElement>(null);
  const shouldFocusDay = useRef(true);

  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = Math.min(FIRST_YEAR, focus.y); y <= Math.max(currentYear + 5, focus.y); y++) years.push(y);

  useEffect(() => {
    if (!shouldFocusDay.current) return;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focusDate}"]`)?.focus();
  }, [focusDate]);

  const setView = (y: number, m: number) => {
    shouldFocusDay.current = false;
    const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    setFocusDate(toIso(y, m, Math.min(focus.d, lastDay)));
  };

  const moveFocus = (next: string) => {
    shouldFocusDay.current = true;
    setFocusDate(next);
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const moves: Record<string, () => string> = {
      ArrowLeft: () => shiftIso(focusDate, -1),
      ArrowRight: () => shiftIso(focusDate, 1),
      ArrowUp: () => shiftIso(focusDate, -7),
      ArrowDown: () => shiftIso(focusDate, 7),
      PageUp: () => shiftIso(focusDate, 0, e.shiftKey ? -12 : -1),
      PageDown: () => shiftIso(focusDate, 0, e.shiftKey ? 12 : 1),
      Home: () => shiftIso(focusDate, -((new Date(Date.UTC(focus.y, focus.m, focus.d)).getUTCDay() + 6) % 7)),
      End: () => shiftIso(focusDate, 6 - ((new Date(Date.UTC(focus.y, focus.m, focus.d)).getUTCDay() + 6) % 7)),
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      moveFocus(move());
    }
  };

  // 6 minggu x 7 hari, minggu dimulai Senin
  const firstWeekday = (new Date(Date.UTC(focus.y, focus.m, 1)).getUTCDay() + 6) % 7;
  const start = shiftIso(toIso(focus.y, focus.m, 1), -firstWeekday);
  const days = Array.from({ length: 42 }, (_, i) => shiftIso(start, i));

  const navButton = "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground";

  return (
    <div className="w-[18.5rem] space-y-3 p-3">
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => setView(focus.m === 0 ? focus.y - 1 : focus.y, (focus.m + 11) % 12)} className={navButton} aria-label="Bulan sebelumnya">
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <select
          aria-label="Bulan"
          value={focus.m}
          onChange={(e) => setView(focus.y, Number(e.target.value))}
          className={cn(selectClass, "h-8 min-w-0 flex-1 pl-2 pr-6 text-[13px]")}
        >
          {MONTHS.map((name, i) => (
            <option key={name} value={i}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Tahun"
          value={focus.y}
          onChange={(e) => setView(Number(e.target.value), focus.m)}
          className={cn(selectClass, "h-8 w-[5.25rem] pl-2 pr-6 font-mono text-[13px] tabular-nums")}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setView(focus.m === 11 ? focus.y + 1 : focus.y, (focus.m + 1) % 12)} className={navButton} aria-label="Bulan berikutnya">
          <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>

      <div ref={gridRef} role="grid" aria-label={`${MONTHS[focus.m]} ${focus.y}`} onKeyDown={onGridKeyDown}>
        <div role="row" className="grid grid-cols-7">
          {WEEKDAYS.map((d) => (
            <span key={d} role="columnheader" className="pb-1 text-center text-xs font-medium text-muted-foreground">
              {d}
            </span>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, week) => (
          <div role="row" key={week} className="grid grid-cols-7">
            {days.slice(week * 7, week * 7 + 7).map((iso) => {
              const p = parseIso(iso)!;
              const inMonth = p.m === focus.m;
              const selected = iso === value;
              const isToday = iso === today;
              return (
                <span role="gridcell" key={iso} aria-selected={selected} className="flex justify-center py-0.5">
                  <button
                    type="button"
                    data-date={iso}
                    tabIndex={iso === focusDate ? 0 : -1}
                    onClick={() => onSelect(iso)}
                    aria-label={formatIndonesianDate(iso)}
                    aria-current={isToday ? "date" : undefined}
                    className={cn(
                      "h-8 w-8 rounded-md text-[13px] tabular-nums transition-colors duration-150",
                      selected
                        ? "bg-primary font-semibold text-primary-foreground"
                        : cn("hover:bg-muted", inMonth ? "text-foreground" : "text-muted-foreground/60"),
                      isToday && !selected && "font-semibold ring-1 ring-inset ring-primary/50"
                    )}
                  >
                    {p.d}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border pt-2.5">
        <button
          type="button"
          onClick={() => onSelect(today)}
          className="h-8 rounded-md px-2.5 text-[13px] font-semibold text-primary transition-colors duration-150 hover:bg-primary-subtle"
        >
          Hari ini
        </button>
        <div className="flex items-center gap-1">
          {allowClear && value && (
            <button
              type="button"
              onClick={() => onSelect("")}
              className="h-8 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
            >
              Kosongkan
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

interface DatePickerInputProps extends ControlProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Tombol "Kosongkan" hanya untuk kolom yang boleh kosong. */
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Input tanggal YYYY-MM-DD yang tetap bisa diketik/ditempel, dengan popup kalender mini.
 * Nilai seperti 2026-10-13T01:56:05Z atau 13/10/2026 dinormalkan saat kolom ditinggalkan.
 */
export function DatePickerInput({ value, onChange, onBlur, allowClear = true, disabled, className, ...control }: DatePickerInputProps) {
  const [open, setOpen] = useState(false);
  const [placeAbove, setPlaceAbove] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setPlaceAbove(window.innerHeight - rect.bottom < 380 && rect.top > 380);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const select = (next: string) => {
    onChange(next);
    onBlur?.();
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <input
        {...control}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => {
          const normalized = normalizeDateValue(e.target.value);
          if (normalized !== e.target.value) onChange(normalized);
          onBlur?.();
        }}
        placeholder="TTTT-BB-HH"
        className={cn(inputClass, "pr-11 font-mono text-sm tabular-nums")}
      />
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-label={value && isValidIsoDate(value) ? `Pilih tanggal, terpilih ${formatIndonesianDate(value)}` : "Pilih tanggal dari kalender"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-primary disabled:opacity-50"
      >
        <Calendar className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Pilih tanggal"
          className={cn(
            "absolute right-0 z-30 rounded-lg border border-border bg-card shadow-lg",
            placeAbove ? "bottom-full mb-1" : "top-full mt-1"
          )}
        >
          <MiniCalendar value={value} allowClear={allowClear} onSelect={select} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
