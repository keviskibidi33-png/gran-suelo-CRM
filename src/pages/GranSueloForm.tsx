import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Beaker, ChevronDown, Download, Loader2, Trash2 } from 'lucide-react'
import { getGranSueloEnsayoDetail, saveAndDownloadGranSueloExcel, saveGranSueloEnsayo } from '@/services/api'
import type { GranSueloPayload } from '@/types'

const DRAFT_KEY = 'gran_suelo_form_draft_v1'
const DEBOUNCE_MS = 700

const SIEVE_LABELS = [
    '3 in',
    '2 in',
    '1 1/2 in',
    '1 in',
    '3/4 in',
    '3/8 in',
    'No. 4',
    'No. 10',
    'No. 20',
    'No. 40',
    'No. 60',
    'No. 100',
    'No. 140',
    'No. 200',
    '< No. 200',
] as const

const METODO = ['-', 'A', 'B'] as const
const TAMIZADO = ['-', 'FRACCIONADO', 'GLOBAL'] as const
const MUESTREO = ['-', 'HUMEDO', 'SECADO AL AIRE', 'SECADO AL HORNO'] as const
const CONDICION = ['-', 'ALTERADO', 'INTACTA'] as const
const SI_NO = ['-', 'SI', 'NO'] as const
const PROCESO = ['-', 'MANUAL', 'BAÑO ULTRASÓNICO', 'APARATO DE AGITACIÓN'] as const
const TAMIZ_SEPARADOR = ['-', 'No. 4', 'No. 10', 'No. 20'] as const
const EQ_BALANZA = ['-', 'EQP-0046'] as const
const EQ_HORNO = ['-', 'EQP-0049'] as const
const REVISADO = ['-', 'FABIAN LA ROSA'] as const
const APROBADO = ['-', 'IRMA COAQUIRA'] as const

const initialState = (): GranSueloPayload => ({
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',
    descripcion_turbo_organico: '',
    metodo_prueba: '-',
    tamizado_tipo: '-',
    metodo_muestreo: '-',
    tipo_muestra: '',
    condicion_muestra: '-',
    tamano_maximo_particula_in: '',
    forma_particula: '',
    tamiz_separador: '-',
    masa_seca_porcion_gruesa_cp_md_g: null,
    masa_humeda_porcion_fina_fp_mm_g: null,
    masa_seca_porcion_fina_fp_md_g: null,
    masa_seca_muestra_s_md_g: null,
    masa_seca_global_g: null,
    subespecie_masa_humeda_g: null,
    subespecie_masa_seca_g: null,
    contenido_agua_wfp_pct: null,
    masa_porcion_gruesa_lavada_cpwmd_g: null,
    masa_retenida_plato_cpmrpan_g: null,
    perdida_cpl_pct: null,
    masa_subespecimen_lavado_fina_g: null,
    masa_seca_muestra_perdida_smd_g: null,
    clasificacion_visual_simbolo: '',
    clasificacion_visual_nombre: '',
    excluyo_material: '-',
    excluyo_material_descripcion: '',
    problema_muestra: '-',
    problema_descripcion: '',
    proceso_dispersion: '-',
    masa_retenida_primer_tamiz_g: null,
    masa_retenida_tamiz_g: Array.from({ length: SIEVE_LABELS.length }, () => null),
    balanza_01g_codigo: '-',
    horno_110_codigo: '-',
    observaciones: '',
    revisado_por: '-',
    revisado_fecha: '',
    aprobado_por: '-',
    aprobado_fecha: '',
})

const parseNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

const getEnsayoId = (): number | null => {
    const raw = new URLSearchParams(window.location.search).get('ensayo_id')
    if (!raw) return null
    const n = Number(raw)
    return Number.isInteger(n) && n > 0 ? n : null
}

export default function GranSueloForm() {
    const [form, setForm] = useState<GranSueloPayload>(() => initialState())
    const [loading, setLoading] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(false)
    const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(() => getEnsayoId())

    const filledSieves = useMemo(() => form.masa_retenida_tamiz_g.filter((v) => v != null).length, [form.masa_retenida_tamiz_g])
    const totalSieves = useMemo(
        () => Number(form.masa_retenida_tamiz_g.reduce((sum, v) => sum + (v ?? 0), 0).toFixed(3)),
        [form.masa_retenida_tamiz_g],
    )
    const progressSummary = useMemo(() => {
        const hasText = (value: string | null | undefined) => Boolean(value && value.trim() !== '' && value.trim() !== '-')
        const hasNum = (value: number | null | undefined) => value != null

        const sections = [
            {
                label: 'Encabezado',
                ready: hasText(form.muestra) && hasText(form.numero_ot) && hasText(form.realizado_por),
                detail: `${[form.muestra, form.numero_ot, form.realizado_por].filter((v) => hasText(v)).length}/3`,
            },
            {
                label: 'Condiciones',
                ready:
                    form.metodo_prueba !== '-' &&
                    form.tamizado_tipo !== '-' &&
                    form.metodo_muestreo !== '-' &&
                    form.condicion_muestra !== '-' &&
                    hasText(form.tipo_muestra),
                detail: form.metodo_prueba === '-' ? 'Método pendiente' : undefined,
            },
            {
                label: 'Tamizado comp./global',
                ready:
                    hasNum(form.masa_seca_porcion_gruesa_cp_md_g) ||
                    hasNum(form.masa_humeda_porcion_fina_fp_mm_g) ||
                    hasNum(form.masa_seca_porcion_fina_fp_md_g) ||
                    hasNum(form.masa_seca_muestra_s_md_g) ||
                    hasNum(form.masa_seca_global_g),
                detail: hasNum(form.perdida_cpl_pct) ? `CPL: ${form.perdida_cpl_pct}` : undefined,
            },
            {
                label: 'Clasificación',
                ready: form.excluyo_material !== '-' && form.problema_muestra !== '-' && form.proceso_dispersion !== '-',
                detail: form.proceso_dispersion === '-' ? 'Dispersión pendiente' : undefined,
            },
            {
                label: 'Tabla tamices',
                ready: filledSieves > 0,
                detail: `${filledSieves}/${SIEVE_LABELS.length}`,
            },
            {
                label: 'Equipos y cierre',
                ready: form.balanza_01g_codigo !== '-' && form.horno_110_codigo !== '-',
                detail: hasText(form.revisado_por) && hasText(form.aprobado_por) ? 'Firmas listas' : 'Sin firmas',
            },
        ]

        const readyCount = sections.filter((section) => section.ready).length
        const completion = Math.round((readyCount / sections.length) * 100)

        return { completion, sections }
    }, [
        filledSieves,
        form.aprobado_por,
        form.balanza_01g_codigo,
        form.condicion_muestra,
        form.excluyo_material,
        form.horno_110_codigo,
        form.metodo_muestreo,
        form.metodo_prueba,
        form.masa_humeda_porcion_fina_fp_mm_g,
        form.masa_seca_global_g,
        form.masa_seca_muestra_s_md_g,
        form.masa_seca_porcion_fina_fp_md_g,
        form.masa_seca_porcion_gruesa_cp_md_g,
        form.muestra,
        form.numero_ot,
        form.perdida_cpl_pct,
        form.problema_muestra,
        form.proceso_dispersion,
        form.realizado_por,
        form.revisado_por,
        form.tamizado_tipo,
        form.tipo_muestra,
    ])

    const setField = useCallback(<K extends keyof GranSueloPayload>(key: K, value: GranSueloPayload[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }))
    }, [])

    const setSieveValue = useCallback((index: number, raw: string) => {
        setForm((prev) => {
            const next = [...prev.masa_retenida_tamiz_g]
            next[index] = parseNum(raw)
            return { ...prev, masa_retenida_tamiz_g: next }
        })
    }, [])

    useEffect(() => {
        const raw = localStorage.getItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
        if (!raw) return
        try {
            setForm({ ...initialState(), ...JSON.parse(raw) })
        } catch {
            // ignore draft corruption
        }
    }, [editingEnsayoId])

    useEffect(() => {
        const timer = window.setTimeout(() => {
            localStorage.setItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`, JSON.stringify(form))
        }, DEBOUNCE_MS)
        return () => window.clearTimeout(timer)
    }, [editingEnsayoId, form])

    useEffect(() => {
        if (!editingEnsayoId) return
        let cancelled = false
        const run = async () => {
            setLoadingEdit(true)
            try {
                const detail = await getGranSueloEnsayoDetail(editingEnsayoId)
                if (!cancelled && detail.payload) setForm({ ...initialState(), ...detail.payload })
            } catch {
                toast.error('No se pudo cargar ensayo Gran Suelo para edición.')
            } finally {
                if (!cancelled) setLoadingEdit(false)
            }
        }
        void run()
        return () => {
            cancelled = true
        }
    }, [editingEnsayoId])

    const clearAll = useCallback(() => {
        if (!window.confirm('Se limpiarán los datos no guardados. ¿Deseas continuar?')) return
        localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
        setForm(initialState())
    }, [editingEnsayoId])

    const save = useCallback(
        async (download: boolean) => {
            if (!form.muestra || !form.numero_ot || !form.realizado_por) {
                toast.error('Complete Muestra, N OT y Realizado por.')
                return
            }
            setLoading(true)
            try {
                if (download) {
                    const { blob } = await saveAndDownloadGranSueloExcel(form, editingEnsayoId ?? undefined)
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `GRAN_SUELO_${form.numero_ot}_${new Date().toISOString().slice(0, 10)}.xlsx`
                    a.click()
                    URL.revokeObjectURL(url)
                } else {
                    await saveGranSueloEnsayo(form, editingEnsayoId ?? undefined)
                }

                localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
                setForm(initialState())
                setEditingEnsayoId(null)
                if (window.parent !== window) window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*')
                toast.success(download ? 'Gran Suelo guardado y descargado.' : 'Gran Suelo guardado.')
            } catch (error: unknown) {
                let msg = error instanceof Error ? error.message : 'Error desconocido'
                if (axios.isAxiosError(error) && typeof error.response?.data?.detail === 'string') msg = error.response.data.detail
                toast.error(`Error guardando Gran Suelo: ${msg}`)
            } finally {
                setLoading(false)
            }
        },
        [editingEnsayoId, form],
    )

    const renderText = (label: string, value: string | undefined | null, onChange: (v: string) => void, placeholder?: string) => (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                data-lpignore="true"
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
        </div>
    )

    const renderNum = (label: string, value: number | null | undefined, onChange: (v: string) => void) => (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <input
                type="number"
                step="any"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                autoComplete="off"
                data-lpignore="true"
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
        </div>
    )

    const renderSelect = (label: string, value: string, options: readonly string[], onChange: (v: string) => void) => (
        <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full h-9 pl-3 pr-8 rounded-md border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    {options.map((o) => (
                        <option key={o} value={o}>
                            {o}
                        </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
        </div>
    )

    const renderTextControl = (value: string | undefined | null, onChange: (v: string) => void, placeholder?: string) => (
        <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            data-lpignore="true"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
    )

    const renderNumControl = (value: number | null | undefined, onChange: (v: string) => void) => (
        <input
            type="number"
            step="any"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="off"
            data-lpignore="true"
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
    )

    const renderSelectControl = (value: string, options: readonly string[], onChange: (v: string) => void) => (
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-9 pl-3 pr-8 rounded-md border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
            >
                {options.map((o) => (
                    <option key={o} value={o}>
                        {o}
                    </option>
                ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
    )

    const renderInlineField = (label: string, control: ReactNode) => (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(260px,1fr)_minmax(280px,1fr)] gap-3 items-center">
            <p className="text-[15px] font-semibold text-slate-600">{label}</p>
            {control}
        </div>
    )

    return (
        <div className="max-w-[1780px] mx-auto p-4 md:p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                    <Beaker className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-foreground">Granulometría de Suelos - ASTM D6913/D6913M-17</h1>
                    <p className="text-sm text-muted-foreground">Formulario operativo Gran Suelo</p>
                </div>
            </div>

            <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-5">
                <div className="space-y-5">
                    {loadingEdit ? (
                        <div className="h-10 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Cargando ensayo...
                        </div>
                    ) : null}

                    <div className="bg-card border border-border rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Encabezado</h2>
                        </div>
                        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                            {renderText('Muestra *', form.muestra, (v) => setField('muestra', v), '123-SU-26')}
                            {renderText('N OT *', form.numero_ot, (v) => setField('numero_ot', v), '1234-26')}
                            {renderText('Fecha ensayo', form.fecha_ensayo, (v) => setField('fecha_ensayo', v), 'DD/MM/AA')}
                            {renderText('Realizado por *', form.realizado_por, (v) => setField('realizado_por', v))}
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Condiciones del ensayo</h2>
                        </div>
                        <div className="p-4 space-y-3">
                            {renderInlineField(
                                'Método de prueba',
                                renderSelectControl(form.metodo_prueba, METODO, (v) => setField('metodo_prueba', v as GranSueloPayload['metodo_prueba'])),
                            )}
                            {renderInlineField(
                                'Tamizado',
                                renderSelectControl(form.tamizado_tipo, TAMIZADO, (v) => setField('tamizado_tipo', v as GranSueloPayload['tamizado_tipo'])),
                            )}
                            {renderInlineField(
                                'Método de muestreo',
                                renderSelectControl(form.metodo_muestreo, MUESTREO, (v) => setField('metodo_muestreo', v as GranSueloPayload['metodo_muestreo'])),
                            )}
                            {renderInlineField(
                                'Describa si es turbo u orgánico',
                                renderTextControl(form.descripcion_turbo_organico, (v) => setField('descripcion_turbo_organico', v)),
                            )}
                            {renderInlineField('Tipo de muestra', renderTextControl(form.tipo_muestra, (v) => setField('tipo_muestra', v)))}
                            {renderInlineField(
                                'Condición muestra',
                                renderSelectControl(form.condicion_muestra, CONDICION, (v) => setField('condicion_muestra', v as GranSueloPayload['condicion_muestra'])),
                            )}
                            {renderInlineField(
                                'Tamaño máximo partícula (in)',
                                renderTextControl(form.tamano_maximo_particula_in, (v) => setField('tamano_maximo_particula_in', v)),
                            )}
                            {renderInlineField(
                                'Forma de la partícula',
                                renderTextControl(form.forma_particula, (v) => setField('forma_particula', v)),
                            )}
                            {renderInlineField(
                                'Tamiz separador',
                                renderSelectControl(form.tamiz_separador || '-', TAMIZ_SEPARADOR, (v) => setField('tamiz_separador', v)),
                            )}
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Tamizado compuesto / global</h2>
                        </div>
                        <div className="p-4 space-y-3">
                            {renderInlineField(
                                'CP, Md (g)',
                                renderNumControl(form.masa_seca_porcion_gruesa_cp_md_g, (v) => setField('masa_seca_porcion_gruesa_cp_md_g', parseNum(v))),
                            )}
                            {renderInlineField(
                                'FP, Mm (g)',
                                renderNumControl(form.masa_humeda_porcion_fina_fp_mm_g, (v) => setField('masa_humeda_porcion_fina_fp_mm_g', parseNum(v))),
                            )}
                            {renderInlineField(
                                'FP, Md (g)',
                                renderNumControl(form.masa_seca_porcion_fina_fp_md_g, (v) => setField('masa_seca_porcion_fina_fp_md_g', parseNum(v))),
                            )}
                            {renderInlineField(
                                'S, Md (g)',
                                renderNumControl(form.masa_seca_muestra_s_md_g, (v) => setField('masa_seca_muestra_s_md_g', parseNum(v))),
                            )}
                            {renderInlineField(
                                'Masa seca global (g)',
                                renderNumControl(form.masa_seca_global_g, (v) => setField('masa_seca_global_g', parseNum(v))),
                            )}
                            {renderInlineField(
                                'SubS masa húmeda (g)',
                                renderNumControl(form.subespecie_masa_humeda_g, (v) => setField('subespecie_masa_humeda_g', parseNum(v))),
                            )}
                            {renderInlineField(
                                'SubS masa seca (g)',
                                renderNumControl(form.subespecie_masa_seca_g, (v) => setField('subespecie_masa_seca_g', parseNum(v))),
                            )}
                            {renderInlineField(
                                'Contenido agua wfp (%)',
                                renderNumControl(form.contenido_agua_wfp_pct, (v) => setField('contenido_agua_wfp_pct', parseNum(v))),
                            )}
                            {renderInlineField(
                                'CPwMd (g)',
                                renderNumControl(form.masa_porcion_gruesa_lavada_cpwmd_g, (v) => setField('masa_porcion_gruesa_lavada_cpwmd_g', parseNum(v))),
                            )}
                            {renderInlineField(
                                'CP, Mrpan (g)',
                                renderNumControl(form.masa_retenida_plato_cpmrpan_g, (v) => setField('masa_retenida_plato_cpmrpan_g', parseNum(v))),
                            )}
                            {renderInlineField(
                                'CPL (%)',
                                renderNumControl(form.perdida_cpl_pct, (v) => setField('perdida_cpl_pct', parseNum(v))),
                            )}
                            {renderInlineField(
                                'Subespécimen lavado fina (g)',
                                renderNumControl(form.masa_subespecimen_lavado_fina_g, (v) => setField('masa_subespecimen_lavado_fina_g', parseNum(v))),
                            )}
                            {renderInlineField(
                                'S, Md pérdida (g)',
                                renderNumControl(form.masa_seca_muestra_perdida_smd_g, (v) => setField('masa_seca_muestra_perdida_smd_g', parseNum(v))),
                            )}
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Clasificación e incidencias</h2>
                        </div>
                        <div className="p-4 space-y-3">
                            {renderInlineField(
                                'Clasificación símbolo',
                                renderTextControl(form.clasificacion_visual_simbolo, (v) => setField('clasificacion_visual_simbolo', v)),
                            )}
                            {renderInlineField(
                                'Clasificación nombre',
                                renderTextControl(form.clasificacion_visual_nombre, (v) => setField('clasificacion_visual_nombre', v)),
                            )}
                            {renderInlineField(
                                'Se excluyó material',
                                renderSelectControl(form.excluyo_material, SI_NO, (v) => setField('excluyo_material', v as GranSueloPayload['excluyo_material'])),
                            )}
                            {renderInlineField(
                                'Describir exclusión',
                                renderTextControl(form.excluyo_material_descripcion, (v) => setField('excluyo_material_descripcion', v)),
                            )}
                            {renderInlineField(
                                'Problema en muestra',
                                renderSelectControl(form.problema_muestra, SI_NO, (v) => setField('problema_muestra', v as GranSueloPayload['problema_muestra'])),
                            )}
                            {renderInlineField(
                                'Describir problema',
                                renderTextControl(form.problema_descripcion, (v) => setField('problema_descripcion', v)),
                            )}
                            {renderInlineField(
                                'Proceso de dispersión',
                                renderSelectControl(form.proceso_dispersion, PROCESO, (v) => setField('proceso_dispersion', v as GranSueloPayload['proceso_dispersion'])),
                            )}
                            {renderInlineField(
                                'Masa retenida primer tamiz (g)',
                                renderNumControl(form.masa_retenida_primer_tamiz_g, (v) => setField('masa_retenida_primer_tamiz_g', parseNum(v))),
                            )}
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Tabla de pesos por tamiz</h2>
                        </div>
                        <div className="p-4 overflow-x-auto">
                            <table className="w-full min-w-[700px] text-sm">
                                <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2 border-b border-r border-border text-left">Tamiz</th>
                                        <th className="px-3 py-2 border-b border-border text-left">Peso (g)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {SIEVE_LABELS.map((label, idx) => (
                                        <tr key={label}>
                                            <td className="px-3 py-2 border-b border-r border-border">{label}</td>
                                            <td className="px-3 py-2 border-b border-border">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={form.masa_retenida_tamiz_g[idx] ?? ''}
                                                    onChange={(e) => setSieveValue(idx, e.target.value)}
                                                    className="w-full h-8 px-2 rounded-md border border-input bg-background text-sm"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Equipos / observaciones / firmas</h2>
                        </div>
                        <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div className="space-y-3">
                                {renderSelect('Balanza 0.1 g', form.balanza_01g_codigo || '-', EQ_BALANZA, (v) => setField('balanza_01g_codigo', v))}
                                {renderSelect('Horno 110 °C', form.horno_110_codigo || '-', EQ_HORNO, (v) => setField('horno_110_codigo', v))}
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-muted-foreground mb-1">Observaciones</label>
                                    <textarea
                                        value={form.observaciones || ''}
                                        onChange={(e) => setField('observaciones', e.target.value)}
                                        rows={4}
                                        className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {renderSelect('Revisado por', form.revisado_por || '-', REVISADO, (v) => setField('revisado_por', v))}
                                    {renderSelect('Aprobado por', form.aprobado_por || '-', APROBADO, (v) => setField('aprobado_por', v))}
                                    {renderText('Fecha revisado', form.revisado_fecha || '', (v) => setField('revisado_fecha', v), 'DD/MM/AA')}
                                    {renderText('Fecha aprobado', form.aprobado_fecha || '', (v) => setField('aprobado_fecha', v), 'DD/MM/AA')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button
                            onClick={clearAll}
                            disabled={loading}
                            className="h-11 rounded-lg border border-input bg-background text-foreground font-medium hover:bg-muted/60 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Trash2 className="h-4 w-4" />
                            Limpiar todo
                        </button>
                        <button
                            onClick={() => void save(false)}
                            disabled={loading}
                            className="h-11 rounded-lg border border-primary text-primary font-semibold hover:bg-primary/10 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                            onClick={() => void save(true)}
                            disabled={loading}
                            className="h-11 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Procesando...
                                </>
                            ) : (
                                <>
                                    <Download className="h-4 w-4" />
                                    Guardar y descargar Excel
                                </>
                            )}
                        </button>
                    </div>
                </div>

                <aside className="hidden xl:block">
                    <div className="sticky top-4 bg-card border border-border rounded-lg shadow-sm p-4 text-xs space-y-4">
                        <div>
                            <h3 className="text-sm font-semibold text-foreground">Formulario / Tabla de información</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">Seguimiento en vivo del ensayo</p>
                        </div>

                        <div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <span>Avance general</span>
                                <span className="font-semibold text-foreground">{progressSummary.completion}%</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all"
                                    style={{ width: `${progressSummary.completion}%` }}
                                />
                            </div>
                        </div>

                        <div className="overflow-hidden rounded-md border border-border">
                            <table className="w-full text-xs">
                                <tbody>
                                    {progressSummary.sections.map((section) => (
                                        <tr key={section.label} className="border-b border-border last:border-b-0">
                                            <td className="px-3 py-2 text-muted-foreground">{section.label}</td>
                                            <td className="px-3 py-2 text-right">
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                                        section.ready
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    }`}
                                                >
                                                    {section.ready ? 'OK' : 'Pend.'}
                                                </span>
                                                {section.detail ? <span className="ml-2 text-muted-foreground">{section.detail}</span> : null}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <table className="w-full border border-border">
                            <tbody>
                                <tr className="border-b">
                                    <td className="px-2 py-2">Tamices llenos</td>
                                    <td className="px-2 py-2 text-right font-semibold">
                                        {filledSieves}/{SIEVE_LABELS.length}
                                    </td>
                                </tr>
                                <tr className="border-b">
                                    <td className="px-2 py-2">Peso total (g)</td>
                                    <td className="px-2 py-2 text-right font-semibold">{totalSieves || '-'}</td>
                                </tr>
                                <tr>
                                    <td className="px-2 py-2">CPL (%)</td>
                                    <td className="px-2 py-2 text-right font-semibold">{form.perdida_cpl_pct ?? '-'}</td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="text-xs text-muted-foreground border border-border rounded-md p-3 bg-muted/20 space-y-1">
                            <p>
                                <span className="font-medium text-foreground">Muestra:</span> {form.muestra || '-'}
                            </p>
                            <p>
                                <span className="font-medium text-foreground">N OT:</span> {form.numero_ot || '-'}
                            </p>
                            <p>
                                <span className="font-medium text-foreground">Realizado:</span> {form.realizado_por || '-'}
                            </p>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    )
}
