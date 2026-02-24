export interface GranSueloPayload {
    muestra: string
    numero_ot: string
    fecha_ensayo: string
    realizado_por: string

    descripcion_turbo_organico?: string | null
    metodo_prueba: '-' | 'A' | 'B'
    tamizado_tipo: '-' | 'FRACCIONADO' | 'GLOBAL'
    metodo_muestreo: '-' | 'HUMEDO' | 'SECADO AL AIRE' | 'SECADO AL HORNO'

    tipo_muestra?: string | null
    condicion_muestra: '-' | 'ALTERADO' | 'INTACTA'
    tamano_maximo_particula_in?: string | null
    forma_particula?: string | null
    tamiz_separador?: string | null

    masa_seca_porcion_gruesa_cp_md_g?: number | null
    masa_humeda_porcion_fina_fp_mm_g?: number | null
    masa_seca_porcion_fina_fp_md_g?: number | null
    masa_seca_muestra_s_md_g?: number | null
    masa_seca_global_g?: number | null
    subespecie_masa_humeda_g?: number | null
    subespecie_masa_seca_g?: number | null
    contenido_agua_wfp_pct?: number | null

    masa_porcion_gruesa_lavada_cpwmd_g?: number | null
    masa_retenida_plato_cpmrpan_g?: number | null
    perdida_cpl_pct?: number | null
    masa_subespecimen_lavado_fina_g?: number | null
    masa_seca_muestra_perdida_smd_g?: number | null

    clasificacion_visual_simbolo?: string | null
    clasificacion_visual_nombre?: string | null
    excluyo_material: '-' | 'SI' | 'NO'
    excluyo_material_descripcion?: string | null
    problema_muestra: '-' | 'SI' | 'NO'
    problema_descripcion?: string | null
    proceso_dispersion: '-' | 'MANUAL' | 'BAÑO ULTRASÓNICO' | 'APARATO DE AGITACIÓN'
    masa_retenida_primer_tamiz_g?: number | null

    masa_retenida_tamiz_g: Array<number | null>

    balanza_01g_codigo?: string | null
    horno_110_codigo?: string | null

    observaciones?: string | null
    revisado_por?: string | null
    revisado_fecha?: string | null
    aprobado_por?: string | null
    aprobado_fecha?: string | null
}

export interface GranSueloEnsayoSummary {
    id: number
    numero_ensayo: string
    numero_ot: string
    cliente?: string | null
    muestra?: string | null
    fecha_documento?: string | null
    estado: string
    perdida_cpl_pct?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}

export interface GranSueloEnsayoDetail extends GranSueloEnsayoSummary {
    payload?: GranSueloPayload | null
}

export interface GranSueloSaveResponse {
    id: number
    numero_ensayo: string
    numero_ot: string
    estado: string
    perdida_cpl_pct?: number | null
    bucket?: string | null
    object_key?: string | null
    fecha_creacion?: string | null
    fecha_actualizacion?: string | null
}
