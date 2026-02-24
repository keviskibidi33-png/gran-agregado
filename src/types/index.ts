export interface GranAgregadoPayload {
    muestra: string
    numero_ot: string
    fecha_ensayo: string
    realizado_por: string

    tipo_muestra?: string | null
    tamano_maximo_particula_visual_in?: string | null
    forma_particula?: string | null

    masa_muestra_humeda_inicial_total_global_g?: number | null
    masa_muestra_seca_global_g?: number | null
    masa_muestra_seca_constante_global_g?: number | null
    masa_muestra_seca_lavada_global_g?: number | null

    masa_muestra_humeda_inicial_total_fraccionada_g?: number | null
    masa_muestra_seca_inicial_total_fraccionada_g?: number | null
    masa_muestra_seca_grueso_g?: number | null
    masa_muestra_seca_constante_grueso_g?: number | null
    masa_muestra_humeda_fino_g?: number | null
    masa_muestra_seca_fino_g?: number | null
    masa_muestra_humeda_fraccion_g?: number | null
    masa_muestra_seca_fraccion_g?: number | null
    masa_muestra_seca_constante_fraccion_g?: number | null
    contenido_humedad_fraccion_pct?: number | null
    masa_muestra_seca_lavada_fraccion_g?: number | null

    masa_retenida_tamiz_g: Array<number | null>

    masa_antes_tamizado_g?: number | null
    masa_despues_tamizado_g?: number | null
    error_tamizado_pct?: number | null

    balanza_01g_codigo?: string | null
    horno_codigo?: string | null
    observaciones?: string | null

    revisado_por?: string | null
    revisado_fecha?: string | null
    aprobado_por?: string | null
    aprobado_fecha?: string | null
}

export interface GranAgregadoEnsayoSummary {
    id: number
    numero_ensayo: string
    numero_ot: string
    cliente?: string | null
    muestra?: string | null
    fecha_documento?: string | null
    estado: string
    error_tamizado_pct?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}

export interface GranAgregadoEnsayoDetail extends GranAgregadoEnsayoSummary {
    payload?: GranAgregadoPayload | null
}

export interface GranAgregadoSaveResponse {
    id: number
    numero_ensayo: string
    numero_ot: string
    estado: string
    error_tamizado_pct?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}
