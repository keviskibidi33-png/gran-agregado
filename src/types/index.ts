export interface EquiArenaPayload {
    muestra: string
    numero_ot: string
    fecha_ensayo: string
    realizado_por: string

    tipo_muestra: "-" | "SUELO" | "AGREGADO FINO"
    metodo_agitacion: "-" | "MANUAL" | "MECÁNICO"
    preparacion_muestra: "-" | "PROCEDIMIENTO A" | "PROCEDIMIENTO B"
    temperatura_solucion_c?: number | null
    masa_4_medidas_g?: number | null

    tiempo_saturacion_min: Array<number | null>
    tiempo_agitacion_seg: Array<number | null>
    tiempo_decantacion_min: Array<number | null>
    lectura_arcilla_in: Array<number | null>
    lectura_arena_in: Array<number | null>
    equivalente_arena_promedio_pct?: number | null

    equipo_balanza_01g_codigo?: string | null
    equipo_horno_110_codigo?: string | null
    equipo_equivalente_arena_codigo?: string | null
    equipo_agitador_ea_codigo?: string | null
    equipo_termometro_codigo?: string | null
    equipo_tamiz_no4_codigo?: string | null
    observaciones?: string | null

    revisado_por?: string | null
    revisado_fecha?: string | null
    aprobado_por?: string | null
    aprobado_fecha?: string | null
}

export interface EquiArenaEnsayoSummary {
    id: number
    numero_ensayo: string
    numero_ot: string
    cliente?: string | null
    muestra?: string | null
    fecha_documento?: string | null
    estado: string
    equivalente_arena_promedio_pct?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}

export interface EquiArenaEnsayoDetail extends EquiArenaEnsayoSummary {
    payload?: EquiArenaPayload | null
}

export interface EquiArenaSaveResponse {
    id: number
    numero_ensayo: string
    numero_ot: string
    estado: string
    equivalente_arena_promedio_pct?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}
