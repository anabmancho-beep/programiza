import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PICTO_BUCKET = "pictogramas";

export function usePictograms(enabled = true) {
  return useQuery({
    queryKey: ["pictograms"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("pictograms").select("id, name, storage_path, created_at").order("name");
      if (error) throw error;
      return data;
    },
  });
}

/** Signed URLs (1 h) for private pictogram files. */
export function usePictoUrls(paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p))].sort();
  return useQuery({
    queryKey: ["picto-urls", list],
    enabled: list.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(PICTO_BUCKET).createSignedUrls(list, 3600);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const d of data) if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
      return map;
    },
  });
}
