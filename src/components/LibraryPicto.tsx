import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/forms";
import { LIBRARY_CATEGORIES, getLibraryPicto, searchLibrary, type LibraryPicto } from "@/lib/pictogram-library";
import { cn } from "@/lib/utils";

// El color de cada categoría viene de los datos de la biblioteca; el texto va siempre oscuro para un contraste alto.
const INK = "#111111";

/** Pictograma de la biblioteca: emoji decorativo + palabra siempre visible (texto accesible). */
export function LibraryPictoView({ id, size = "md", className }: { id: string | null | undefined; size?: "sm" | "md" | "lg"; className?: string }) {
  const p = getLibraryPicto(id);
  if (!p) return null;
  const box = size === "lg" ? "h-40 w-40" : size === "md" ? "h-20 w-20" : "h-12 w-12";
  const emoji = size === "lg" ? "text-7xl" : size === "md" ? "text-4xl" : "text-2xl";
  const word = size === "lg" ? "text-base" : "text-[0.65rem]";
  return (
    <span className={cn("flex shrink-0 flex-col items-center justify-center rounded-xl border-2 p-1 text-center", box, className)} style={{ backgroundColor: p.color, color: INK, borderColor: INK }}>
      <span aria-hidden="true" className={cn("leading-none", emoji)}>{p.emoji}</span>
      <span className={cn("mt-1 font-bold uppercase leading-tight", word)}>{p.word}</span>
    </span>
  );
}

const PAGE = 60;

export function LibraryCard({ p, selected, onSelect }: { p: LibraryPicto; selected?: boolean; onSelect?: (p: LibraryPicto) => void }) {
  const content = (
    <>
      <span aria-hidden="true" className="text-5xl leading-none">{p.emoji}</span>
      <span className="mt-2 text-base font-bold uppercase">{p.word}</span>
      <span className="mt-1 text-sm">{p.meaning}</span>
    </>
  );
  const cls = cn("flex h-full w-full flex-col items-center rounded-xl border-2 p-3 text-center", selected ? "ring-4 ring-ring ring-offset-2" : "");
  const style = { backgroundColor: p.color, color: INK, borderColor: INK };
  if (!onSelect) return <div className={cls} style={style}>{content}</div>;
  return (
    <button type="button" className={cn(cls, "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring focus-visible:ring-offset-2")} style={style}
      aria-pressed={selected} aria-label={`${p.word}: ${p.meaning}`} onClick={() => onSelect(p)}>
      {content}
    </button>
  );
}

/** Buscador + filtro por categoría + rejilla paginada ("Mostrar más"). */
export function LibraryBrowser({ selectedId, onSelect, compact, idPrefix = "lib" }: { selectedId?: string | null; onSelect?: (p: LibraryPicto) => void; compact?: boolean; idPrefix?: string }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [limit, setLimit] = useState(compact ? 24 : PAGE);
  const results = useMemo(() => searchLibrary(q, cat), [q, cat]);
  const shown = results.slice(0, limit);
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input id={`${idPrefix}-q`} aria-label="Buscar pictograma por palabra o significado" placeholder="Buscar: comer, autobús, alegre…" className="pl-9"
            value={q} onChange={(e) => { setQ(e.target.value); setLimit(compact ? 24 : PAGE); }} />
        </div>
        <NativeSelect id={`${idPrefix}-cat`} aria-label="Filtrar por categoría" value={cat} onChange={(e) => { setCat(e.target.value); setLimit(compact ? 24 : PAGE); }}>
          <option value="">Todas las categorías</option>
          {LIBRARY_CATEGORIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </NativeSelect>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">{results.length === 0 ? "" : `${results.length} pictograma${results.length === 1 ? "" : "s"}`}</p>
      {results.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center">
          <p className="font-bold">Sin resultados</p>
          <p className="text-sm text-muted-foreground">Prueba con otra palabra o elige «Todas las categorías».</p>
        </div>
      ) : (
        <ul className={cn("grid gap-3", compact ? "max-h-80 grid-cols-2 overflow-y-auto p-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5")}>
          {shown.map((p) => <li key={p.id}><LibraryCard p={p} selected={selectedId === p.id} onSelect={onSelect} /></li>)}
          {shown.length < results.length && (
            <li className="col-span-full flex justify-center">
              <Button type="button" variant="outline" onClick={() => setLimit((l) => l + PAGE)}>Mostrar más ({results.length - shown.length} restantes)</Button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
