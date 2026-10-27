"use client";

import React, { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { BookmarkPlus, Copy, Trash2 } from "lucide-react";
import { MetadataFormData, ResponsibleParty } from "@/lib/metadata-schema";
import { CI_ROLE_CODES } from "@/lib/iso-codelists";
import { getContactPresets, saveContactPreset, ContactPreset } from "@/lib/contact-presets";
import { Button, Field, IsoCode, inputClass, selectClass } from "@/components/ui/form";
import { SelectField, TextField } from "@/components/ui/form-fields";
import type { ObligationType } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ContactKey = keyof ResponsibleParty;

interface ContactCardProps {
  /** Path kontak di form, mis. "metadataInfo.contacts.0". */
  name: string;
  title: React.ReactNode;
  /** Tingkat kewajiban per kolom; kolom yang tidak disebut bersifat Opsional. */
  levels?: Partial<Record<ContactKey, ObligationType>>;
  onRemove?: () => void;
  /** Tombol pintas menyalin kontak lain, mis. "Samakan dengan Bab 1". */
  copyFrom?: { label: string; path: string };
  /** Tanpa bingkai, untuk kontak yang berada di dalam item daftar. */
  bare?: boolean;
}

export function ContactCard({ name, title, levels = {}, onRemove, copyFrom, bare }: ContactCardProps) {
  const { getValues, setValue } = useFormContext<MetadataFormData>();
  const [presets, setPresets] = useState<ContactPreset[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState("");
  const presetInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPresets(getContactPresets());
  }, []);

  useEffect(() => {
    if (!showSaveDialog) return;
    presetInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowSaveDialog(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSaveDialog]);

  const current = () => getValues(name as never) as unknown as ResponsibleParty;

  // Peran kontak saat ini dipertahankan karena konteksnya (pemilik, distributor, ...) ditentukan kartu ini.
  const replaceContact = (source: ResponsibleParty) =>
    setValue(name as never, { ...source, role: current().role || source.role } as never, { shouldDirty: true, shouldTouch: true });

  const handleApplyPreset = (presetId: string) => {
    const selected = presets.find((p) => p.id === presetId);
    if (selected) replaceContact(selected.contact);
  };

  const handleSavePreset = () => {
    const contact = current();
    const presetName = presetNameInput.trim() || contact.organisationName.trim();
    if (!presetName) return;
    setPresets(saveContactPreset(presetName, contact));
    setShowSaveDialog(false);
    setPresetNameInput("");
  };

  const field = (key: Exclude<ContactKey, "role">, label: string, opts: { placeholder?: string; type?: string; wide?: boolean; autoComplete?: string; isoCode?: string } = {}) => (
    <TextField
      name={`${name}.${key}`}
      label={label}
      level={levels[key] ?? "optional"}
      isoCode={opts.isoCode ?? key}
      type={opts.type}
      autoComplete={opts.autoComplete}
      placeholder={opts.placeholder}
      className={opts.wide ? "md:col-span-2" : undefined}
    />
  );

  return (
    <div className={cn(!bare && "rounded-lg border border-border")}>
      <div className={cn("flex flex-wrap items-center justify-between gap-3", bare ? "pb-4" : "border-b border-border bg-muted/50 px-4 py-2.5")}>
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
          {title}
          <IsoCode>CI_ResponsibleParty</IsoCode>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {copyFrom && (
            <Button size="sm" onClick={() => replaceContact(getValues(copyFrom.path as never) as unknown as ResponsibleParty)}>
              <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
              {copyFrom.label}
            </Button>
          )}

          {presets.length > 0 && (
            <select
              aria-label="Isi cepat dari buku kontak"
              onChange={(e) => {
                handleApplyPreset(e.target.value);
                e.target.value = "";
              }}
              defaultValue=""
              className={cn(selectClass, "h-8 w-auto text-[13px]")}
            >
              <option value="" disabled>
                Isi dari buku kontak
              </option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <Button
            size="sm"
            onClick={() => {
              setPresetNameInput(current().organisationName || "");
              setShowSaveDialog(true);
            }}
            title="Simpan kontak ini agar bisa dipakai lagi di dataset lain"
          >
            <BookmarkPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
            Simpan ke buku kontak
          </Button>

          {onRemove && (
            <Button variant="danger" size="icon-sm" onClick={onRemove} aria-label="Hapus kontak ini" title="Hapus kontak ini">
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          )}
        </div>
      </div>

      <div className={cn("grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2", !bare && "p-4")}>
        {field("individualName", "Nama individu / narahubung", { placeholder: "Contoh: Budi Santoso, S.T., M.Sc." })}
        {field("positionName", "Jabatan", { placeholder: "Contoh: Kepala Bidang Sumber Daya Air" })}
        {field("organisationName", "Nama instansi / unit kerja", {
          wide: true,
          autoComplete: "organization",
          placeholder: "Contoh: Dinas PUPR dan Perumahan Rakyat Provinsi Kalimantan Timur",
        })}
        {field("phone", "Telepon kantor", { type: "tel", isoCode: "voice", placeholder: "Contoh: (0541) 276236" })}
        {field("facsimile", "Faksimili", { type: "tel", placeholder: "Contoh: (0541) 276237" })}
        {field("electronicMailAddress", "Email resmi", { type: "email", placeholder: "Contoh: pu@kaltimprov.go.id" })}
        {field("onlineUrl", "Situs web", { type: "url", isoCode: "onlineResource", placeholder: "https://dpu.kaltimprov.go.id" })}
        {field("deliveryPoint", "Alamat jalan", { wide: true, placeholder: "Contoh: Jl. Tengkawang No. 1" })}
        {field("city", "Kota / kabupaten", { placeholder: "Contoh: Samarinda" })}
        {field("administrativeArea", "Provinsi", { placeholder: "Contoh: Kalimantan Timur" })}
        {field("postalCode", "Kode pos", { placeholder: "Contoh: 75243" })}
        {field("country", "Negara", { placeholder: "Indonesia atau IDN" })}
        <SelectField
          name={`${name}.role`}
          label="Peran"
          isoCode="CI_RoleCode"
          level={levels.role ?? "optional"}
          options={CI_ROLE_CODES}
          emptyLabel={null}
          className="md:col-span-2"
        />
      </div>

      {showSaveDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(e) => e.target === e.currentTarget && setShowSaveDialog(false)}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="save-preset-title" className="w-full max-w-md space-y-5 rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="space-y-1.5">
              <h3 id="save-preset-title" className="text-base font-semibold text-foreground">
                Simpan ke buku kontak
              </h3>
              <p className="text-[13px] leading-normal text-muted-foreground">
                Kontak disimpan di browser ini dan bisa diisikan ke dataset lain dengan sekali pilih.
              </p>
            </div>
            <Field label="Nama di buku kontak" hint="Nama pendek yang mudah dikenali, mis. singkatan instansi.">
              {(control) => (
                <input
                  {...control}
                  ref={presetInputRef}
                  type="text"
                  value={presetNameInput}
                  onChange={(e) => setPresetNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSavePreset()}
                  placeholder="Contoh: DPUPR Kaltim"
                  className={inputClass}
                />
              )}
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>
                Batal
              </Button>
              <Button variant="primary" onClick={handleSavePreset}>
                Simpan ke buku kontak
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
