"use client";

import React, { useState } from "react";
import { Lock, Unlock, Plus, Trash2, ExternalLink } from "lucide-react";
import { OnlineResource, createEmptyOnlineResource } from "@/lib/metadata-schema";
import { CI_ONLINE_FUNCTION_CODES, ONLINE_PROTOCOLS } from "@/lib/iso-codelists";
import { Button, EmptyList, IsoCode, ItemBlock, Section } from "@/components/ui/form";
import { ItemTitle, ListRestoreButton, NumberField, SelectField, TextField, useListField } from "@/components/ui/form-fields";

function linkKind(res: OnlineResource) {
  for (const service of ["WMS", "WFS", "WMTS", "WCS", "CSW"]) if (res.protocol.includes(service)) return service;
  const ext = res.name.includes(".") ? res.name.split(".").pop() : "";
  return ext ? ext.toUpperCase() : "Tautan";
}

export function GeoNodeLinksPanel() {
  const links = useListField("qualityAndDistribution.onlineResources");
  const [unlockManual, setUnlockManual] = useState(false);

  // Indeks asli dipertahankan agar path form (onlineResources.N) tetap tepat setelah difilter.
  const indexed = links.fields.map((f, index) => ({ f: f as unknown as OnlineResource & { id: string }, index }));
  const locked = indexed.filter(({ f }) => f.isLockedGeoNode);
  const custom = indexed.filter(({ f }) => !f.isLockedGeoNode);

  return (
    <Section
      title="Opsi transfer digital"
      isoCode="MD_DigitalTransferOptions"
      card="transfer"
      description="Tautan layanan OGC dan unduhan data. Tautan bawaan GeoNode dikunci agar tidak hilang saat dipanen GeoNetwork."
      actions={
        <>
          <ListRestoreButton list={links} />
          <Button size="sm" onClick={() => links.append(createEmptyOnlineResource())}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            Tambah tautan
          </Button>
        </>
      }
    >
      {locked.length > 0 && (
        <div className="rounded-lg border border-border border-l-4 border-l-primary bg-muted p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                <Lock className="h-4 w-4 text-primary" strokeWidth={1.75} />
                Tautan bawaan GeoNode
                <span className="font-normal text-muted-foreground">{locked.length} tautan</span>
                <IsoCode>gmd:onLine</IsoCode>
              </p>
              <p className="max-w-prose text-[13px] leading-normal text-muted-foreground">Dibuat otomatis oleh GeoNode. Tidak perlu diubah.</p>
            </div>
            <Button
              size="sm"
              onClick={() => setUnlockManual(!unlockManual)}
              aria-pressed={unlockManual}
              title="Hanya untuk pengguna yang memahami struktur distribusi GeoNode"
            >
              {unlockManual ? (
                <>
                  <Unlock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
                  Kunci kembali
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Buka kunci
                </>
              )}
            </Button>
          </div>

          {unlockManual && (
            <p className="mt-3 text-[13px] text-amber-800 dark:text-amber-300">
              Kunci terbuka. Menghapus tautan bawaan akan menghilangkannya dari katalog GeoNetwork.
            </p>
          )}

          <ul className="mt-3 max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card">
            {locked.map(({ f, index }) => (
              <li key={f.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-16 shrink-0 font-mono text-xs font-medium text-muted-foreground">{linkKind(f)}</span>
                  <span className="truncate text-sm text-foreground" title={f.linkage}>
                    {f.description || f.name || f.linkage}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a
                    href={f.linkage}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-primary"
                    aria-label={`Buka ${f.description || f.name || "tautan"} di tab baru`}
                  >
                    <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                  </a>
                  {unlockManual && (
                    <Button variant="danger" size="icon-sm" onClick={() => links.remove(index)} aria-label="Hapus tautan ini">
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {custom.length === 0 && locked.length === 0 && (
        <EmptyList>Belum ada tautan akses. Tambahkan tautan layanan WMS/WFS atau tautan unduhan data.</EmptyList>
      )}

      {custom.map(({ f, index }, i) => (
        <ItemBlock
          key={f.id}
          title={<ItemTitle isoCode="CI_OnlineResource">Tautan tambahan {i + 1}</ItemTitle>}
          actions={
            <Button variant="danger" size="icon-sm" onClick={() => links.remove(index)} aria-label={`Hapus tautan tambahan ${i + 1}`}>
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </Button>
          }
        >
          <TextField
            name={`qualityAndDistribution.onlineResources.${index}.linkage`}
            label="URL"
            isoCode="linkage"
            type="url"
            mono
            placeholder="https://jigd.kaltimprov.go.id/geoserver/ows"
          />
          <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
            <SelectField name={`qualityAndDistribution.onlineResources.${index}.protocol`} label="Protokol" isoCode="protocol" options={ONLINE_PROTOCOLS} />
            <SelectField name={`qualityAndDistribution.onlineResources.${index}.functionCode`} label="Fungsi" isoCode="function" options={CI_ONLINE_FUNCTION_CODES} />
            <TextField name={`qualityAndDistribution.onlineResources.${index}.name`} label="Nama tautan / layer" isoCode="name" placeholder="Contoh: geonode:jaringan_irigasi" />
            <TextField name={`qualityAndDistribution.onlineResources.${index}.description`} label="Deskripsi singkat" isoCode="description" />
          </div>
        </ItemBlock>
      ))}

      <div className="border-t border-border pt-5">
        <NumberField
          name="qualityAndDistribution.transferSize"
          label="Ukuran file"
          isoCode="transferSize"
          level="optional"
          suffix="MB"
          placeholder="Contoh: 12.4"
          className="max-w-xs"
        />
      </div>
    </Section>
  );
}
