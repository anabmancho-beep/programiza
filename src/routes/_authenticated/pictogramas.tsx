import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { usePictograms, usePictoUrls, PICTO_BUCKET } from "@/lib/pictos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms";
import { PageHeader, Loading, ErrorBox, Empty, Notice } from "@/components/states";
import { errMsg } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/pictogramas")({
  head: () => ({ meta: [{ title: "Pictogramas · Programiza" }, { name: "description", content: "Biblioteca de pictogramas e imágenes propias del centro." }, { property: "og:title", content: "Pictogramas · Programiza" }, { property: "og:description", content: "Pictogramas propios del centro para agendas visuales." }] }),
  component: Pictos,
});

const TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

function Pictos() {
  const me = useMe();
  const qc = useQueryClient();
  const list = usePictograms();
  const urls = usePictoUrls((list.data ?? []).map((p) => p.storage_path));
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [license, setLicense] = useState(false);
  const [busy, setBusy] = useState(false);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { toast.error("Elige una imagen"); return; }
    if (!TYPES.includes(file.type)) { toast.error("Formato no admitido. Usa PNG, JPG, WebP o SVG"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("La imagen no puede superar 2 MB"); return; }
    if (!name.trim()) { toast.error("Ponle un nombre"); return; }
    if (!license) { toast.error("Confirma que tienes licencia para usar la imagen"); return; }
    const cid = me.data!.center!.id;
    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `${cid}/${crypto.randomUUID()}.${ext}`;
    setBusy(true);
    try {
      const up = await supabase.storage.from(PICTO_BUCKET).upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;
      const { error } = await supabase.from("pictograms").insert({ center_id: cid, name: name.trim(), storage_path: path, license_confirmed: true });
      if (error) { await supabase.storage.from(PICTO_BUCKET).remove([path]); throw error; }
      toast.success("Pictograma añadido");
      setName(""); setFile(null); setLicense(false);
      (document.getElementById("pf") as HTMLInputElement | null)?.value && ((document.getElementById("pf") as HTMLInputElement).value = "");
      qc.invalidateQueries({ queryKey: ["pictograms"] });
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  }

  async function remove(id: string, path: string) {
    if (!confirm("¿Eliminar este pictograma? Las actividades que lo usan se quedarán sin imagen.")) return;
    const { error } = await supabase.from("pictograms").delete().eq("id", id);
    if (error) { toast.error(errMsg(error)); return; }
    await supabase.storage.from(PICTO_BUCKET).remove([path]);
    qc.invalidateQueries({ queryKey: ["pictograms"] });
  }

  return (
    <div>
      <PageHeader title="Pictogramas" subtitle="Imágenes propias del centro para las agendas visuales. Se pueden reutilizar en cualquier actividad." />
      <Notice title="Licencia de las imágenes">Sube solo imágenes propias o de las que el centro tenga licencia de uso (por ejemplo, pictogramas con licencia que permita este uso, respetando su atribución). Programiza no incluye ni descarga pictogramas de terceros. No subas fotos en las que se reconozca a personas.</Notice>
      <form onSubmit={upload} className="my-6 grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <Field id="pn" label="Nombre"><Input id="pn" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Lavarse las manos" /></Field>
        <Field id="pf" label="Imagen (PNG, JPG, WebP o SVG, máx. 2 MB)"><Input id="pf" type="file" accept={TYPES.join(",")} onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        <label className="flex items-start gap-2 sm:col-span-2">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={license} onChange={(e) => setLicense(e.target.checked)} />
          <span>Confirmo que el centro tiene derecho a usar esta imagen y que no muestra a ninguna persona reconocible.</span>
        </label>
        <div className="sm:col-span-2"><Button type="submit" disabled={busy}><Upload className="mr-2 h-4 w-4" />{busy ? "Subiendo…" : "Subir pictograma"}</Button></div>
      </form>
      {list.isLoading ? <Loading /> : list.error ? <ErrorBox error={list.error} /> : list.data!.length === 0 ? <Empty title="Todavía no hay pictogramas" /> : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {list.data!.map((p) => (
            <li key={p.id} className="rounded-xl border bg-card p-3 text-center">
              {urls.data?.[p.storage_path] ? <img src={urls.data[p.storage_path]} alt={p.name} className="mx-auto aspect-square w-full rounded object-contain" /> : <div className="aspect-square w-full rounded bg-muted" aria-hidden />}
              <p className="mt-2 font-bold">{p.name}</p>
              <Button size="sm" variant="ghost" aria-label={`Eliminar ${p.name}`} onClick={() => remove(p.id, p.storage_path)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
