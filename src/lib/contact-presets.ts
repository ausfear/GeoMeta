import { MetadataFormData, ResponsibleParty } from "./metadata-schema";

const STORAGE_KEY = "geometa_contact_presets";
// v2: bentuk form SE 6/2021. Draf v1 tidak kompatibel dan diabaikan.
const DRAFT_KEY = "geometa_metadata_draft_v2";

export interface ContactPreset {
  id: string;
  name: string; // Display label for preset dropdown
  contact: ResponsibleParty;
  createdAt: string;
}

export const DEFAULT_PRESETS: ContactPreset[] = [
  {
    id: "dpukaltim",
    name: "DPUPR Provinsi Kalimantan Timur",
    contact: {
      individualName: "",
      organisationName: "Dinas Pekerjaan Umum, Penataan Ruang dan Perumahan Rakyat Provinsi Kalimantan Timur",
      positionName: "Kepala Dinas",
      phone: "(0541) 276236",
      facsimile: "",
      deliveryPoint: "Jl. Tengkawang No. 1",
      city: "Samarinda",
      administrativeArea: "Kalimantan Timur",
      postalCode: "75243",
      country: "Indonesia",
      electronicMailAddress: "pu@kaltimprov.go.id",
      onlineUrl: "https://dpu.kaltimprov.go.id",
      role: "pointOfContact",
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "bappeda-kaltim",
    name: "Bappeda Provinsi Kalimantan Timur",
    contact: {
      individualName: "",
      organisationName: "Badan Perencanaan Pembangunan Daerah Provinsi Kalimantan Timur",
      positionName: "Kepala Bappeda",
      phone: "(0541) 743388",
      facsimile: "",
      deliveryPoint: "Jl. Kesuma Bangsa No. 2",
      city: "Samarinda",
      administrativeArea: "Kalimantan Timur",
      postalCode: "75123",
      country: "Indonesia",
      electronicMailAddress: "bappeda@kaltimprov.go.id",
      onlineUrl: "https://bappeda.kaltimprov.go.id",
      role: "pointOfContact",
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "big-promsi",
    name: "Badan Informasi Geospasial (BIG)",
    contact: {
      individualName: "",
      organisationName: "Badan Informasi Geospasial",
      positionName: "Kepala Pusat Pengelolaan dan Penyebarluasan Informasi Geospasial",
      phone: "(021) 8752062",
      facsimile: "(021) 8752064",
      deliveryPoint: "Jl. Raya Jakarta-Bogor KM. 46",
      city: "Cibinong",
      administrativeArea: "Jawa Barat",
      postalCode: "16911",
      country: "Indonesia",
      electronicMailAddress: "info@big.go.id",
      onlineUrl: "https://sinag.big.go.id",
      role: "custodian",
    },
    createdAt: new Date().toISOString(),
  },
];

export function getContactPresets(): ContactPreset[] {
  if (typeof window === "undefined") return DEFAULT_PRESETS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PRESETS));
      return DEFAULT_PRESETS;
    }
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PRESETS;
  } catch {
    return DEFAULT_PRESETS;
  }
}

export function saveContactPreset(name: string, contact: ResponsibleParty): ContactPreset[] {
  const current = getContactPresets();
  const newPreset: ContactPreset = {
    id: `preset_${Date.now()}`,
    name: name.trim() || contact.organisationName || "Preset Kontak Baru",
    contact: { ...contact },
    createdAt: new Date().toISOString(),
  };

  const updated = [newPreset, ...current];
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
  return updated;
}

export function deleteContactPreset(id: string): ContactPreset[] {
  const current = getContactPresets();
  const updated = current.filter((p) => p.id !== id);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }
  return updated;
}

// Draft storage functions (auto-save in localStorage). Tidak pernah memuat kredensial.
export function saveDraftToStorage(data: MetadataFormData, originalXml?: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        data,
        originalXml,
        savedAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.warn("Gagal menyimpan draf ke localStorage:", err);
  }
}

export interface StoredDraft {
  data: MetadataFormData;
  originalXml?: string;
  savedAt: string;
}

export function loadDraftFromStorage(): StoredDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const item = localStorage.getItem(DRAFT_KEY);
    const parsed = item ? JSON.parse(item) : null;
    return parsed?.data?.metadataInfo && parsed?.data?.qualityAndDistribution ? parsed : null;
  } catch {
    return null;
  }
}

export function clearDraftStorage(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
}
