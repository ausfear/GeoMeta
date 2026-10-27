"use client";

import React, { useEffect, useRef, useState } from "react";
import { CloudUpload, Lock, X, Loader2 } from "lucide-react";
import { Button, Field, Notice, checkboxClass, inputClass } from "@/components/ui/form";
import { cn } from "@/lib/utils";

interface PushGeoNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  xmlContent: string;
  defaultBaseUrl?: string;
  defaultPk?: string;
  onDownloadManual: () => void;
}

export function PushGeoNodeModal({
  isOpen,
  onClose,
  xmlContent,
  defaultBaseUrl = "",
  defaultPk = "",
  onDownloadManual,
}: PushGeoNodeModalProps) {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [pk, setPk] = useState(defaultPk);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [preserveMetadata, setPreserveMetadata] = useState(true);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{
    type: "idle" | "success" | "error";
    message: string;
  }>({ type: "idle", message: "" });

  const firstFieldRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Modal selalu terpasang, jadi isi ulang dari dataset aktif setiap kali dibuka.
  // Sengaja hanya bergantung pada isOpen agar render ulang induk tidak mereset pesan status.
  useEffect(() => {
    if (!isOpen) return;
    setBaseUrl((current) => current || defaultBaseUrl);
    setPk((current) => current || defaultPk);
    setStatus({ type: "idle", message: "" });
    firstFieldRef.current?.focus();

    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseUrl.trim() || !pk.trim() || !username.trim() || !password) {
      setStatus({
        type: "error",
        message: "Isi alamat server, ID dataset, username, dan password sebelum menyimpan.",
      });
      return;
    }

    setLoading(true);
    setStatus({ type: "idle", message: "" });

    try {
      const res = await fetch("/api/geonode/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: baseUrl.trim(),
          pk: pk.trim(),
          xml: xmlContent,
          preserveMetadata,
          auth: {
            username: username.trim(),
            password,
          },
        }),
      });

      const json = await res.json();

      if (res.ok) {
        setStatus({
          type: "success",
          message: json.message || "Metadata tersimpan di GeoNode.",
        });
        // Hapus password dari memori setelah berhasil
        setPassword("");
      } else {
        setStatus({
          type: "error",
          message: json.error || "GeoNode menolak penyimpanan metadata.",
        });
      }
    } catch (err: any) {
      setStatus({
        type: "error",
        message: err.message || "Proxy GeoNode tidak bisa dihubungi.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-modal-title"
        className="max-h-[100dvh] w-full max-w-lg overflow-y-auto rounded-t-xl border border-border bg-card shadow-xl sm:rounded-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="space-y-1">
            <h2 id="push-modal-title" className="flex items-center gap-2 text-base font-semibold text-foreground">
              <CloudUpload className="h-4 w-4 text-primary" strokeWidth={1.75} />
              Simpan ke GeoNode
            </h2>
            <p className="text-[13px] text-muted-foreground">Metadata di server akan diganti dengan XML hasil penambalan.</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Tutup">
            <X className="h-4 w-4" strokeWidth={1.75} />
          </Button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          {status.type === "success" && (
            <Notice tone="success" title="Metadata tersimpan di GeoNode">
              <p>{status.message} GeoNetwork akan memanen perubahan ini pada jadwal berikutnya.</p>
            </Notice>
          )}
          {status.type === "error" && (
            <Notice tone="danger" title="Metadata belum tersimpan">
              <p>{status.message}</p>
            </Notice>
          )}

          <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-[1fr,7rem]">
            <Field label="Alamat server GeoNode">
              {(control) => (
                <input
                  {...control}
                  ref={firstFieldRef}
                  type="url"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://geoportal.kaltimprov.go.id"
                  className={cn(inputClass, "font-mono text-sm")}
                />
              )}
            </Field>
            <Field label="ID dataset">
              {(control) => (
                <input
                  {...control}
                  type="text"
                  inputMode="numeric"
                  value={pk}
                  onChange={(e) => setPk(e.target.value)}
                  placeholder="737"
                  className={cn(inputClass, "font-mono text-sm")}
                />
              )}
            </Field>
            <Field label="Username GeoNode" className="sm:col-span-2">
              {(control) => (
                <input
                  {...control}
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
            <Field label="Password GeoNode" className="sm:col-span-2">
              {(control) => (
                <input
                  {...control}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              )}
            </Field>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted p-4">
            <input
              type="checkbox"
              checked={preserveMetadata}
              onChange={(e) => setPreserveMetadata(e.target.checked)}
              className={cn(checkboxClass, "mt-0.5")}
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-foreground">Pertahankan metadata lengkap untuk GeoNetwork</span>
              <span className="block text-[13px] leading-normal text-muted-foreground">
                Mengaktifkan <code className="font-mono text-xs text-foreground">metadata_uploaded_preserve</code> agar elemen ISO 19115 tidak
                dipangkas GeoNode saat dipanen GeoNetwork.
              </span>
            </span>
          </label>

          <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            Password hanya diteruskan ke GeoNode untuk permintaan ini dan tidak disimpan.
          </p>

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => {
                onDownloadManual();
                onClose();
              }}
              className="self-start rounded text-[13px] font-medium text-primary hover:underline"
            >
              Unduh XML untuk diunggah manual
            </button>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>
                Tutup
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Menyimpan" : "Simpan ke GeoNode"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
