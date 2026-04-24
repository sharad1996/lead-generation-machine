export type LeadStatus = "new" | "contacted" | "converted";

export type RawLead = {
  name: string;
  mapsLink: string;
  phone?: string | null;
  website?: string | null;
  address?: string | null;
  rating?: number | null;
  location?: string | null;
};
