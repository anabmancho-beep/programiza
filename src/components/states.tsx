import { AlertCircle, Loader2, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { errMsg } from "@/lib/constants";

export function Loading({ label = "Cargando…" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 py-10 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-destructive">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div>
        <p className="font-bold">No se han podido cargar los datos</p>
        <p className="text-sm">{errMsg(error)}</p>
      </div>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card p-10 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="text-lg font-bold">{title}</p>
      {children}
    </div>
  );
}

export function Notice({ tone = "warning", title, children }: { tone?: "warning" | "health" | "success"; title: string; children?: ReactNode }) {
  const cls =
    tone === "health"
      ? "bg-health text-health-foreground border-health-foreground/30"
      : tone === "success"
        ? "bg-success text-success-foreground border-success-foreground/30"
        : "bg-warning text-warning-foreground border-warning-foreground/30";
  return (
    <div role="note" className={`rounded-lg border p-4 ${cls}`}>
      <p className="font-bold">{title}</p>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
