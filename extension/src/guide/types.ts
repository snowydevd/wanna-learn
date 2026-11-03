export type StepKind = "crear-archivo" | "codigo";

export interface Concepto { nombre: string; explicacion: string; docs: string }
/** `linea` es 1-based. */
export interface Ancla { texto?: string; linea?: number }
export interface Problema { archivo: string; linea: number; explicacion: string }
export interface Revision { aprobado: boolean; mensaje: string; problemas: Problema[]; sugerencias: string[] }

export interface Paso {
  id: number;
  tipo: StepKind;
  titulo: string;
  archivo: string;
  donde: string;
  ancla?: Ancla;
  objetivo: string;
  conceptos: Concepto[];
  /** Privado: nunca se muestra en el panel. */
  criterios: string[];
  /** Privado: nunca se muestra en el panel. */
  pistas: string[];
  hecho: boolean;
  nivelPista: number;
  ultimaPista?: string;
  ultimaRevision?: Revision;
}

export interface Guia {
  version: 1;
  pedido: string;
  titulo: string;
  panorama: string;
  /** Índice 0-based; igual a pasos.length cuando la guía terminó. */
  pasoActual: number;
  terminada: boolean;
  resumen?: string;
  pasos: Paso[];
}
