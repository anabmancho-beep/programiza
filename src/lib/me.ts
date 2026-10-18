import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Me = {
  userId: string;
  email: string | null;
  displayName: string | null;
  center: { id: string; name: string; join_code: string } | null;
  role: "admin" | "educador" | "profesional" | "familia" | null;
};

const meCacheKey = (uid: string) => `me-cache:${uid}`;

async function offlineMe(): Promise<Me | null> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return null;
  try { const v = localStorage.getItem(meCacheKey(uid)); return v ? (JSON.parse(v) as Me) : null; } catch { return null; }
}

const isNet = (e: unknown) =>
  (typeof navigator !== "undefined" && !navigator.onLine) ||
  /fetch|network|Load failed/i.test(String((e as { message?: string })?.message ?? e));

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const cached = await offlineMe();
      if (cached) return cached;
    }
    try {
      const { data: u, error: ue } = await supabase.auth.getUser();
      if (ue && isNet(ue)) throw ue;
      if (ue || !u.user) throw new Error("No has iniciado sesión");
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("display_name, center_id, centers(id, name, join_code)")
        .eq("id", u.user.id)
        .maybeSingle();
      if (error) throw error;
      let role: Me["role"] = null;
      if (profile?.center_id) {
        const { data: r, error: re } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", u.user.id)
          .eq("center_id", profile.center_id)
          .maybeSingle();
        if (re && isNet(re)) throw re;
        role = (r?.role as Me["role"]) ?? null;
      }
      const me: Me = {
        userId: u.user.id,
        email: u.user.email ?? null,
        displayName: profile?.display_name ?? null,
        center: (profile?.centers as Me["center"]) ?? null,
        role,
      };
      try { localStorage.setItem(meCacheKey(me.userId), JSON.stringify(me)); } catch { /* sin almacenamiento */ }
      return me;
    } catch (e) {
      if (isNet(e)) { const cached = await offlineMe(); if (cached) return cached; }
      throw e;
    }
  },
});

export const useMe = () => useQuery(meQuery);
