import { useCallback, useEffect, useState } from 'react'
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

const getCurrentYearShort = () => new Date().getFullYear().toString().slice(-2)

const normalizeMuestraCode = (raw: string): string => {
    const value = raw.trim().toUpperCase()
    if (!value) return ''

    const compact = value.replace(/\s+/g, '')
    const year = getCurrentYearShort()
    const match = compact.match(/^(\d+)(?:-SU)?(?:-(\d{2}))?$/)
    if (match) {
        return `${match[1]}-SU-${match[2] || year}`
    }
    return value
}

const normalizeNumeroOtCode = (raw: string): string => {
    const value = raw.trim().toUpperCase()
    if (!value) return ''

    const compact = value.replace(/\s+/g, '')
    const year = getCurrentYearShort()
    const patterns = [
        /^(?:N?OT-)?(\d+)(?:-(\d{2}))?$/,
        /^(\d+)(?:-(?:N?OT))?(?:-(\d{2}))?$/,
    ]

    for (const pattern of patterns) {
        const match = compact.match(pattern)
        if (match) {
            return `${match[1]}-${match[2] || year}`
        }
    }

    return value
}

const normalizeFlexibleDate = (raw: string): string => {
    const value = raw.trim()
    if (!value) return ''

    const digits = value.replace(/\D/g, '')
    const year = getCurrentYearShort()
    const pad2 = (part: string) => part.padStart(2, '0').slice(-2)
    const build = (d: string, m: string, y: string = year) => `${pad2(d)}/${pad2(m)}/${pad2(y)}`

    if (value.includes('/')) {
        const [d = '', m = '', yRaw = ''] = value.split('/').map((part) => part.trim())
        if (!d || !m) return value
        let yy = yRaw.replace(/\D/g, '')
        if (yy.length === 4) yy = yy.slice(-2)
        if (yy.length === 1) yy = `0${yy}`
        if (!yy) yy = year
        return build(d, m, yy)
    }

    if (digits.length === 2) return build(digits[0], digits[1])
    if (digits.length === 3) return build(digits[0], digits.slice(1, 3))
    if (digits.length === 4) return build(digits.slice(0, 2), digits.slice(2, 4))
    if (digits.length === 5) return build(digits[0], digits.slice(1, 3), digits.slice(3, 5))
    if (digits.length === 6) return build(digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6))
    if (digits.length >= 8) return build(digits.slice(0, 2), digits.slice(2, 4), digits.slice(6, 8))

    return value
}

const getEnsayoId = (): number | null => {
    const raw = new URLSearchParams(window.location.search).get('ensayo_id')
    if (!raw) return null
    const n = Number(raw)
    return Number.isInteger(n) && n > 0 ? n : null
}

type FormattedFieldKey = 'muestra' | 'numero_ot' | 'fecha_ensayo' | 'revisado_fecha' | 'aprobado_fecha'

export default function GranSueloForm() {
    const [form, setForm] = useState<GranSueloPayload>(() => initialState())
    const [loading, setLoading] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(false)
    const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(() => getEnsayoId())

    const setField = useCallback(<K extends keyof GranSueloPayload>(key: K, value: GranSueloPayload[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }))
    }, [])

    const applyFormattedField = useCallback((key: FormattedFieldKey, formatter: (raw: string) => string) => {
        setForm((prev) => {
            const current = String(prev[key] ?? '')
            const formatted = formatter(current)
            if (formatted === current) return prev
            return { ...prev, [key]: formatted }
        })
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

    const renderText = (
        label: string,
        value: string | undefined | null,
        onChange: (v: string) => void,
        placeholder?: string,
        onBlur?: () => void,
    ) => (
        <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
            <input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                placeholder={placeholder}
                autoComplete="off"
                data-lpignore="true"
                className="w-full h-9 px-3 rounded-md border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
        </div>
    )

    const renderSelect = (label: string, value: string, options: readonly string[], onChange: (v: string) => void) => (
        <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full h-9 pl-3 pr-8 rounded-md border border-input bg-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                >
                    {options.map((o) => (
                        <option key={o} value={o}>
                            {o}
                        </option>
                    ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 pointer-events-none" />
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
            className="w-full h-9 px-3 rounded-md border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
            className="w-full h-9 px-3 rounded-md border border-input bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
    )

    const renderSelectControl = (value: string, options: readonly string[], onChange: (v: string) => void) => (
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full h-9 pl-3 pr-8 rounded-md border border-input bg-white text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
            >
                {options.map((o) => (
                    <option key={o} value={o}>
                        {o}
                    </option>
                ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 pointer-events-none" />
        </div>
    )

    const renderInlineField = (label: string, control: ReactNode) => (
        <div className="grid grid-cols-1 md:grid-cols-[minmax(260px,1fr)_minmax(280px,1fr)] gap-3 items-center">
            <p className="text-[15px] font-semibold text-slate-600">{label}</p>
            {control}
        </div>
    )

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-6">
            <div className="mx-auto max-w-[1360px] space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-slate-50">
                        <Beaker className="h-5 w-5 text-slate-900" />
                    </div>
                    <div>
                        <h1 className="text-base md:text-lg font-semibold text-slate-900">Gran Suelo - ASTM D6913/D6913M-17</h1>
                        <p className="text-xs text-slate-600">Formato fiel a plantilla Excel</p>
                    </div>
                </div>

                <div className="space-y-5">
                    {loadingEdit ? (
                        <div className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 flex items-center gap-2 shadow-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Cargando ensayo...
                        </div>
                    ) : null}

                    <div className="overflow-hidden rounded-2xl border border-slate-300 bg-slate-50 shadow-sm">
                        <div className="border-b border-slate-300 px-4 py-4 text-center">
                            <p className="text-[22px] font-semibold leading-tight text-slate-900">LABORATORIO DE ENSAYO DE MATERIALES</p>
                            <p className="text-lg font-semibold leading-tight text-slate-900">FORMATO N° F-LEM-P-SU-24.01</p>
                        </div>
                        <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-center">
                            <p className="text-sm font-semibold text-slate-900">
                                Standard Test Methods for Particle-Size Distribution (Gradation) of Soils Using Sieve Analysis
                            </p>
                            <p className="text-sm font-semibold text-slate-900">ASTM D6913/D6913M-17 (Reapproved 2025)</p>
                        </div>

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Encabezado</h2>
                        </div>
                        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                            {renderText('Muestra *', form.muestra, (v) => setField('muestra', v), '123-SU-26', () => applyFormattedField('muestra', normalizeMuestraCode))}
                            {renderText('N OT *', form.numero_ot, (v) => setField('numero_ot', v), '1234-26', () => applyFormattedField('numero_ot', normalizeNumeroOtCode))}
                            {renderText('Fecha ensayo', form.fecha_ensayo, (v) => setField('fecha_ensayo', v), 'DD/MM/AA', () => applyFormattedField('fecha_ensayo', normalizeFlexibleDate))}
                            {renderText('Realizado por *', form.realizado_por, (v) => setField('realizado_por', v))}
                        </div>
                    </div>

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Condiciones del ensayo</h2>
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

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Tamizado compuesto / global</h2>
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
                        </div>
                    </div>

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Clasificación e incidencias</h2>
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
                                'Describir exclusión (sección: "Se excluyó cualquier suelo o material de la muestra")',
                                renderTextControl(
                                    form.excluyo_material_descripcion,
                                    (v) => setField('excluyo_material_descripcion', v),
                                    'Texto que aparece junto a "Describirlo:" de esa sección',
                                ),
                            )}
                            {renderInlineField(
                                'Problema en muestra',
                                renderSelectControl(form.problema_muestra, SI_NO, (v) => setField('problema_muestra', v as GranSueloPayload['problema_muestra'])),
                            )}
                            {renderInlineField(
                                'Describir problema (sección: "Se encontró algún problema en la muestra")',
                                renderTextControl(
                                    form.problema_descripcion,
                                    (v) => setField('problema_descripcion', v),
                                    'Texto que aparece junto a "Describirlo:" de esa sección',
                                ),
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

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Tabla de pesos por tamiz</h2>
                        </div>
                        <div className="p-4 overflow-x-auto">
                            <table className="w-full min-w-[700px] text-sm">
                                <thead className="bg-slate-100 text-xs font-semibold text-slate-600">
                                    <tr>
                                        <th className="px-3 py-2 border-b border-r border-slate-300 text-left">Tamiz</th>
                                        <th className="px-3 py-2 border-b border-slate-300 text-left">Peso (g)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {SIEVE_LABELS.map((label, idx) => (
                                        <tr key={label}>
                                            <td className="px-3 py-2 border-b border-r border-slate-300">{label}</td>
                                            <td className="px-3 py-2 border-b border-slate-300">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={form.masa_retenida_tamiz_g[idx] ?? ''}
                                                    onChange={(e) => setSieveValue(idx, e.target.value)}
                                                    className="w-full h-8 px-2 rounded-md border border-input bg-white text-sm"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Equipos / observaciones / firmas</h2>
                        </div>
                        <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div className="space-y-3">
                                {renderSelect('Balanza 0.1 g', form.balanza_01g_codigo || '-', EQ_BALANZA, (v) => setField('balanza_01g_codigo', v))}
                                {renderSelect('Horno 110 °C', form.horno_110_codigo || '-', EQ_HORNO, (v) => setField('horno_110_codigo', v))}
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Observaciones</label>
                                    <textarea
                                        value={form.observaciones || ''}
                                        onChange={(e) => setField('observaciones', e.target.value)}
                                        rows={4}
                                        className="w-full px-3 py-2 rounded-md border border-input bg-white text-sm resize-none"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {renderSelect('Revisado por', form.revisado_por || '-', REVISADO, (v) => setField('revisado_por', v))}
                                    {renderSelect('Aprobado por', form.aprobado_por || '-', APROBADO, (v) => setField('aprobado_por', v))}
                                    {renderText('Fecha revisado', form.revisado_fecha || '', (v) => setField('revisado_fecha', v), 'DD/MM/AA', () => applyFormattedField('revisado_fecha', normalizeFlexibleDate))}
                                    {renderText('Fecha aprobado', form.aprobado_fecha || '', (v) => setField('aprobado_fecha', v), 'DD/MM/AA', () => applyFormattedField('aprobado_fecha', normalizeFlexibleDate))}
                                </div>
                            </div>
                        </div>
                    </div>

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button
                            onClick={clearAll}
                            disabled={loading}
                            className="h-11 rounded-lg border border-input bg-white text-foreground font-medium hover:bg-muted/60 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
                                    Guardar y Descargar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

