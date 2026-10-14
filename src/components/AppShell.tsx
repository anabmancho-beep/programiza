import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Home, Users, CalendarDays, Library, Building2, ShieldCheck, LogOut, Menu, X, Sprout } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { ROLE_LABELS } from "@/lib/constants";
import { Onboarding } from "@/components/Onboarding";
import { Loading, ErrorBox } from "@/components/states";

const NAV = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/personas", label: "Personas", icon: Users },
  { to: "/programaciones", label: "Programaciones", icon: CalendarDays },
  { to: "/banco", label: "Banco de actividades", icon: Library },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (me.isLoading) return <div className="mx-auto max-w-xl p-8"><Loading /></div>;
  if (me.error) return <div className="mx-auto max-w-xl p-8"><ErrorBox error={me.error} /></div>;
  if (!me.data?.center) return <Onboarding onSignOut={signOut} />;

  if (me.data.role === "familia") {
    return (
      <div className="mx-auto max-w-xl p-8 space-y-4">
        <h1 className="text-2xl font-semibold">Acceso de familias próximamente</h1>
        <p>Tu cuenta tiene el rol «Familia». Este acceso se habilitará en una próxima versión.</p>
        <button onClick={signOut} className="underline">Cerrar sesión</button>
      </div>
    );
  }

  const isAdmin = me.data.role === "admin";
  const nav = (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <Link key={to} to={to} onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/90 hover:bg-sidebar-accent"
          activeProps={{ className: "bg-sidebar-accent font-bold text-sidebar-accent-foreground" }}>
          <Icon className="h-5 w-5" aria-hidden /> {label}
        </Link>
      ))}
      {isAdmin && (
        <Link to="/centro" onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/90 hover:bg-sidebar-accent"
          activeProps={{ className: "bg-sidebar-accent font-bold text-sidebar-accent-foreground" }}>
          <Building2 className="h-5 w-5" aria-hidden /> Centro y equipo
        </Link>
      )}
      <Link to="/privacidad" onClick={() => setOpen(false)}
        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/90 hover:bg-sidebar-accent">
        <ShieldCheck className="h-5 w-5" aria-hidden /> Privacidad y datos
      </Link>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-card focus:p-2">Saltar al contenido</a>
      <header className="flex items-center justify-between bg-sidebar p-4 text-sidebar-foreground lg:hidden">
        <span className="flex items-center gap-2 font-display text-xl"><Sprout className="h-6 w-6 text-sidebar-primary" aria-hidden />Programiza</span>
        <button aria-label={open ? "Cerrar menú" : "Abrir menú"} aria-expanded={open} onClick={() => setOpen(!open)} className="rounded p-2">
          {open ? <X /> : <Menu />}
        </button>
      </header>
      <aside className={`${open ? "block" : "hidden"} bg-sidebar p-4 text-sidebar-foreground lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between`}>
        <div className="space-y-6">
          <div className="hidden items-center gap-2 px-2 pt-2 font-display text-2xl lg:flex">
            <Sprout className="h-7 w-7 text-sidebar-primary" aria-hidden />Programiza
          </div>
          {nav}
        </div>
        <div className="mt-6 rounded-lg border border-sidebar-border p-3 text-sm">
          <p className="font-bold">{me.data.center.name}</p>
          <p className="text-sidebar-foreground/80">{me.data.displayName ?? me.data.email}</p>
          <p className="text-sidebar-foreground/80">{ROLE_LABELS[me.data.role ?? ""] ?? "Sin rol"}</p>
          <button onClick={signOut} className="mt-3 flex items-center gap-2 font-bold text-sidebar-primary hover:underline">
            <LogOut className="h-4 w-4" aria-hidden /> Cerrar sesión
          </button>
        </div>
      </aside>
      <main id="contenido" className="mx-auto w-full max-w-6xl p-4 sm:p-8">{children}</main>
    </div>
  );
}
