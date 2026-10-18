import { describe, expect, it } from "vitest";
import { PICTOGRAM_LIBRARY, LIBRARY_CATEGORIES, getLibraryPicto, searchLibrary } from "@/lib/pictogram-library";

describe("Biblioteca básica de pictogramas", () => {
  it("tiene 500 elementos", () => {
    expect(PICTOGRAM_LIBRARY).toHaveLength(500);
    expect(LIBRARY_CATEGORIES).toHaveLength(20);
  });

  it("tiene ids únicos y correlativos lib-001…lib-500", () => {
    const ids = PICTOGRAM_LIBRARY.map((p) => p.id);
    expect(new Set(ids).size).toBe(500);
    ids.forEach((id, i) => expect(id).toBe(`lib-${String(i + 1).padStart(3, "0")}`));
    expect(getLibraryPicto("lib-001")?.word).toBe("ALEGRE");
    expect(getLibraryPicto("lib-500")?.word).toBe("PINGÜINO");
  });

  it("mantiene los emojis repetidos con palabras distintas", () => {
    expect(PICTOGRAM_LIBRARY.filter((p) => p.emoji === "🪚").map((p) => p.word)).toEqual(["SERRAR", "SIERRA"]);
    expect(PICTOGRAM_LIBRARY.filter((p) => p.emoji === "🎯").map((p) => p.word)).toEqual(["APUNTAR", "DIANA"]);
    expect(PICTOGRAM_LIBRARY.filter((p) => p.emoji === "🤏").map((p) => p.word)).toEqual(["PELLIZCAR", "POCO"]);
  });

  it("el buscador ignora tildes y mayúsculas", () => {
    expect(searchLibrary("cafe").map((p) => p.word)).toContain("CAFÉ");
    expect(searchLibrary("CAMIÓN").map((p) => p.word)).toContain("CAMIÓN");
    expect(searchLibrary("camion").map((p) => p.word)).toContain("CAMIÓN");
    expect(searchLibrary("pinguino").map((p) => p.word)).toContain("PINGÜINO");
  });

  it("busca también por significado y filtra por categoría", () => {
    expect(searchLibrary("lámpara mágica").map((p) => p.word)).toEqual(["GENIO"]);
    expect(searchLibrary("", "Animales")).toHaveLength(25);
  });

  it("rechaza ids inválidos", () => {
    expect(getLibraryPicto("lib-000")).toBeNull();
    expect(getLibraryPicto("lib-501")).toBeNull();
    expect(getLibraryPicto("lib-1")).toBeNull();
    expect(getLibraryPicto("xlib-001")).toBeNull();
    expect(getLibraryPicto(null)).toBeNull();
  });
});
