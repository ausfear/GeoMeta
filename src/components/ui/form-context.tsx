"use client";

import { createContext, useContext } from "react";
import type { MetadataFormData } from "@/lib/metadata-schema";
import type { CompletenessResult, ProfileId, Requirement } from "@/lib/completeness";
import { DEFAULT_PROFILE } from "@/lib/completeness";

/** Profil aktif dan filter "Sembunyikan kolom opsional". */
export const FormUiContext = createContext<{ profile: ProfileId; hideOptional: boolean }>({
  profile: DEFAULT_PROFILE,
  hideOptional: false,
});

export const useFormUi = () => useContext(FormUiContext);

/** Salinan nilai awal saat sumber metadata dimuat; dasar tombol "Kembalikan". */
export const BaselineContext = createContext<MetadataFormData | null>(null);

export const useBaseline = () => useContext(BaselineContext);

/** Hasil kalkulator kelengkapan + navigasi lompat-ke-kolom. Null di luar workspace. */
export const CompletenessContext = createContext<{
  result: CompletenessResult;
  jumpTo: (req: Requirement) => void;
} | null>(null);

export const useCompleteness = () => useContext(CompletenessContext);
