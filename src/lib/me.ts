import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Me = {
  userId: string;
  email: string | null;
  displayName: string | null;
  center: { id: string; name: string; join_code: string } | null;
  role: "admin" | "educador" | "profesional" | "familia" | null;
};

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me> => {
    const { data: u, error: ue } = await supabase.auth.getUser();
    if (ue || !u.user) throw new Error("No has iniciado sesión");
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("display_name, center_id, centers(id, name, join_code)")
      .eq("id", u.user.id)
      .maybeSingle();
    if (error) throw error;
    let role: Me["role"] = null;
    if (profile?.center_id) {
      const { data: r } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .eq("center_id", profile.center_id)
        .maybeSingle();
      role = (r?.role as Me["role"]) ?? null;
    }
    return {
      userId: u.user.id,
      email: u.user.email ?? null,
      displayName: profile?.display_name ?? null,
      center: (profile?.centers as Me["center"]) ?? null,
      role,
    };
  },
});

export const useMe = () => useQuery(meQuery);
