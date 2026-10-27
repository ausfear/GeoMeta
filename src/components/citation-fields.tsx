"use client";

import React from "react";
import { DateField, TextField } from "@/components/ui/form-fields";
import type { ObligationType } from "@/components/ui/badge";

interface CitationFieldsProps {
  /** Path CitationRef di form, mis. "advanced.portrayalCatalogue". */
  name: string;
  titleLabel: string;
  titleLevel?: ObligationType;
  titlePlaceholder?: string;
  urlLabel?: string;
}

/** Judul, tanggal, edisi, penerbit, dan URL sebuah CI_Citation. */
export function CitationFields({ name, titleLabel, titleLevel = "optional", titlePlaceholder, urlLabel = "URL tautan online" }: CitationFieldsProps) {
  return (
    <div className="space-y-5">
      <TextField name={`${name}.title`} label={titleLabel} isoCode="title" level={titleLevel} placeholder={titlePlaceholder} />
      <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-3">
        <DateField name={`${name}.date`} label="Tanggal publikasi" isoCode="CI_Date" level="optional" />
        <TextField name={`${name}.edition`} label="Edisi" isoCode="edition" level="optional" placeholder="Contoh: 5.0" />
        <TextField name={`${name}.publisher`} label="Penerbit" isoCode="citedResponsibleParty" level="optional" placeholder="Contoh: Badan Informasi Geospasial" />
      </div>
      <TextField name={`${name}.url`} label={urlLabel} isoCode="onlineResource" level="optional" type="url" mono placeholder="https://" />
    </div>
  );
}
