import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Sin conexión no se puede validar con el servidor: se usa la sesión guardada en el dispositivo.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const { data: s } = await supabase.auth.getSession();
      if (s.session) return;
      throw redirect({ to: "/auth" });
    }
    const { data, error } = await supabase.auth.getUser();
    if (!data.user) {
      if (error && /fetch|network|Load failed/i.test(error.message)) {
        const { data: s } = await supabase.auth.getSession();
        if (s.session) return;
      }
      throw redirect({ to: "/auth" });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
