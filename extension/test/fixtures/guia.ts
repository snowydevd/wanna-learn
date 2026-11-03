import type { Guia, Paso } from "../../src/guide/types";

export function paso(over: Partial<Paso> = {}): Paso {
  return {
    id: 1,
    tipo: "codigo",
    titulo: "Mutation para guardar la foto",
    archivo: "convex/photos.ts",
    donde: "al final del archivo",
    objetivo: "Guardar una foto con eventId y userId",
    conceptos: [{ nombre: "mutation", explicacion: "escribe en la base", docs: "https://docs.convex.dev/functions/mutation-functions" }],
    criterios: ["CRITERIO-SECRETO usa mutation"],
    pistas: ["PISTA-1 suave", "PISTA-2 media", "PISTA-3 fuerte"],
    hecho: false,
    nivelPista: 0,
    ...over,
  };
}

export function guia(over: Partial<Guia> = {}): Guia {
  return {
    version: 1,
    pedido: "subir fotos por evento",
    titulo: "Subida de fotos",
    panorama: "Schema, mutation y botón",
    pasoActual: 0,
    terminada: false,
    pasos: [
      paso({ id: 1, titulo: "Tabla photos", archivo: "convex/schema.ts", objetivo: "OBJ-1 tabla photos" }),
      paso({ id: 2, titulo: "Mutation", archivo: "convex/photos.ts", objetivo: "OBJ-2 mutation" }),
    ],
    ...over,
  };
}
