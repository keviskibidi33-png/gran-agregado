import { useCallback, useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Beaker, ChevronDown, Download, Loader2, Trash2 } from 'lucide-react'
import { getGranAgregadoEnsayoDetail, saveAndDownloadGranAgregadoExcel, saveGranAgregadoEnsayo } from '@/services/api'
import type { GranAgregadoPayload } from '@/types'

const DRAFT_KEY = 'gran_agregado_form_draft_v1'
const DEBOUNCE_MS = 700

const SIEVE_LABELS = [
    '3 in',
    '2 1/2 in',
    '2 in',
    '1 1/2 in',
    '1 in',
    '3/4 in',
    '1/2 in',
    '3/8 in',
    'No. 4',
    'No. 8',
    'No. 10',
    'No. 16',
    'No. 30',
    'No. 40',
    'No. 50',
    'No. 100',
    'No. 200',
    '< 200',
] as const

const EQ_BALANZA = ['-', 'EQP-0046'] as const
const EQ_HORNO = ['-', 'EQP-0049'] as const
const REVISADO = ['-', 'FABIAN LA ROSA'] as const
const APROBADO = ['-', 'IRMA COAQUIRA'] as const
const ERROR_TAMIZADO_MAX_PCT = 0.3

const initialState = (): GranAgregadoPayload => ({
    muestra: '',
    numero_ot: '',
    fecha_ensayo: '',
    realizado_por: '',
    tipo_muestra: '',
    tamano_maximo_particula_visual_in: '',
    forma_particula: '',
    masa_muestra_humeda_inicial_total_global_g: null,
    masa_muestra_seca_global_g: null,
    masa_muestra_seca_constante_global_g: null,
    masa_muestra_seca_lavada_global_g: null,
    masa_muestra_humeda_inicial_total_fraccionada_g: null,
    masa_muestra_seca_inicial_total_fraccionada_g: null,
    masa_muestra_seca_grueso_g: null,
    masa_muestra_seca_constante_grueso_g: null,
    masa_muestra_humeda_fino_g: null,
    masa_muestra_seca_fino_g: null,
    masa_muestra_humeda_fraccion_g: null,
    masa_muestra_seca_fraccion_g: null,
    masa_muestra_seca_constante_fraccion_g: null,
    contenido_humedad_fraccion_pct: null,
    masa_muestra_seca_lavada_fraccion_g: null,
    masa_retenida_tamiz_g: Array.from({ length: SIEVE_LABELS.length }, () => null),
    masa_antes_tamizado_g: null,
    masa_despues_tamizado_g: null,
    error_tamizado_pct: null,
    balanza_01g_codigo: '-',
    horno_codigo: '-',
    observaciones: '',
    revisado_por: '-',
    revisado_fecha: '',
    aprobado_por: '-',
    aprobado_fecha: formatTodayShortDate(),
})

const parseNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}

const getCurrentYearShort = () => new Date().getFullYear().toString().slice(-2)
const formatTodayShortDate = () => {
    const d = new Date()
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yy = String(d.getFullYear()).slice(-2)
    return `${dd}/${mm}/${yy}`
}

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

export default function GranAgregadoForm() {
    const [form, setForm] = useState<GranAgregadoPayload>(() => initialState())
    const [loading, setLoading] = useState(false)
    const [loadingEdit, setLoadingEdit] = useState(false)
    const [editingEnsayoId, setEditingEnsayoId] = useState<number | null>(() => getEnsayoId())

    const filledSieves = useMemo(() => form.masa_retenida_tamiz_g.filter((v) => v != null).length, [form.masa_retenida_tamiz_g])
    const totalSieves = useMemo(
        () => Number(form.masa_retenida_tamiz_g.reduce((sum, v) => sum + (v ?? 0), 0).toFixed(3)),
        [form.masa_retenida_tamiz_g],
    )
    const derivedError = useMemo(() => {
        if (!form.masa_antes_tamizado_g || !form.masa_despues_tamizado_g || form.masa_antes_tamizado_g === 0) return null
        return Number((((form.masa_antes_tamizado_g - form.masa_despues_tamizado_g) / form.masa_antes_tamizado_g) * 100).toFixed(4))
    }, [form.masa_antes_tamizado_g, form.masa_despues_tamizado_g])
    const setField = useCallback(<K extends keyof GranAgregadoPayload>(key: K, value: GranAgregadoPayload[K]) => {
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
                const detail = await getGranAgregadoEnsayoDetail(editingEnsayoId)
                if (!cancelled && detail.payload) setForm({ ...initialState(), ...detail.payload })
            } catch {
                toast.error('No se pudo cargar ensayo Gran Agregado para edición.')
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
                const payload: GranAgregadoPayload = {
                    ...form,
                    error_tamizado_pct: form.error_tamizado_pct ?? derivedError,
                }

                if (download) {
                    const { blob } = await saveAndDownloadGranAgregadoExcel(payload, editingEnsayoId ?? undefined)
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `GRAN_AGREGADO_${form.numero_ot}_${new Date().toISOString().slice(0, 10)}.xlsx`
                    a.click()
                    URL.revokeObjectURL(url)
                } else {
                    await saveGranAgregadoEnsayo(payload, editingEnsayoId ?? undefined)
                }

                localStorage.removeItem(`${DRAFT_KEY}:${editingEnsayoId ?? 'new'}`)
                setForm(initialState())
                setEditingEnsayoId(null)
                if (window.parent !== window) window.parent.postMessage({ type: 'CLOSE_MODAL' }, '*')
                toast.success(download ? 'Gran Agregado guardado y descargado.' : 'Gran Agregado guardado.')
            } catch (error: unknown) {
                let msg = error instanceof Error ? error.message : 'Error desconocido'
                if (axios.isAxiosError(error) && typeof error.response?.data?.detail === 'string') msg = error.response.data.detail
                toast.error(`Error guardando Gran Agregado: ${msg}`)
            } finally {
                setLoading(false)
            }
        },
        [derivedError, editingEnsayoId, form],
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

    const renderNum = (label: string, value: number | null | undefined, onChange: (v: string) => void) => (
        <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
            <input
                type="number"
                step="any"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
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

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-6">
            <div className="mx-auto max-w-[1360px] space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-slate-50">
                        <Beaker className="h-5 w-5 text-slate-900" />
                    </div>
                    <div>
                        <h1 className="text-base md:text-lg font-semibold text-slate-900">Gran Agregado - ASTM C136/C136M-25</h1>
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
                            <p className="text-lg font-semibold leading-tight text-slate-900">FORMATO N° F-LEM-P-AG-19.01</p>
                        </div>
                        <div className="border-b border-slate-300 bg-slate-100 px-4 py-2 text-center">
                            <p className="text-sm font-semibold text-slate-900">Standard Test Method for Sieve Analysis of Fine and Coarse Aggregates</p>
                            <p className="text-sm font-semibold text-slate-900">ASTM C136/C136M-25</p>
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
                            <h2 className="text-sm font-semibold text-slate-900">Descripción y granulometría</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {renderText('Tipo de muestra', form.tipo_muestra, (v) => setField('tipo_muestra', v))}
                                {renderText('Tamaño máximo visual (in)', form.tamano_maximo_particula_visual_in, (v) => setField('tamano_maximo_particula_visual_in', v))}
                                {renderText('Forma de la partícula', form.forma_particula, (v) => setField('forma_particula', v))}
                            </div>
                            <div className="rounded-xl border border-slate-300 bg-slate-50">
                                <div className="px-3 py-2 border-b border-slate-300 bg-slate-100">
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Granulometría Global</h3>
                                </div>
                                <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                    {renderNum('Masa húmeda inicial total (g)', form.masa_muestra_humeda_inicial_total_global_g, (v) => setField('masa_muestra_humeda_inicial_total_global_g', parseNum(v)))}
                                    {renderNum('Masa muestra seca (g)', form.masa_muestra_seca_global_g, (v) => setField('masa_muestra_seca_global_g', parseNum(v)))}
                                    {renderNum('Masa muestra seca constante (g)', form.masa_muestra_seca_constante_global_g, (v) => setField('masa_muestra_seca_constante_global_g', parseNum(v)))}
                                    {renderNum('Masa muestra seca lavada (g)', form.masa_muestra_seca_lavada_global_g, (v) => setField('masa_muestra_seca_lavada_global_g', parseNum(v)))}
                                </div>
                            </div>
                            <div className="rounded-xl border border-slate-300 bg-slate-50">
                                <div className="px-3 py-2 border-b border-slate-300 bg-slate-100">
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Granulometría Fraccionada</h3>
                                </div>
                                <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {renderNum('Masa húmeda inicial total (g)', form.masa_muestra_humeda_inicial_total_fraccionada_g, (v) => setField('masa_muestra_humeda_inicial_total_fraccionada_g', parseNum(v)))}
                                    {renderNum('Masa muestra seco inicial total (g)', form.masa_muestra_seca_inicial_total_fraccionada_g, (v) => setField('masa_muestra_seca_inicial_total_fraccionada_g', parseNum(v)))}
                                </div>
                            </div>
                            <div className="space-y-3">
                                <div className="rounded-xl border border-slate-300 bg-slate-50 self-start">
                                    <div className="px-3 py-2 border-b border-slate-300 bg-slate-100">
                                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Grueso</h3>
                                    </div>
                                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {renderNum('Masa muestra seca (g)', form.masa_muestra_seca_grueso_g, (v) => setField('masa_muestra_seca_grueso_g', parseNum(v)))}
                                        {renderNum('Masa muestra seca constante (g)', form.masa_muestra_seca_constante_grueso_g, (v) => setField('masa_muestra_seca_constante_grueso_g', parseNum(v)))}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-slate-300 bg-slate-50 self-start">
                                    <div className="px-3 py-2 border-b border-slate-300 bg-slate-100">
                                        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">Fino</h3>
                                    </div>
                                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {renderNum('Masa muestra húmedo fino (g)', form.masa_muestra_humeda_fino_g, (v) => setField('masa_muestra_humeda_fino_g', parseNum(v)))}
                                        {renderNum('Masa muestra seco fino (g)', form.masa_muestra_seca_fino_g, (v) => setField('masa_muestra_seca_fino_g', parseNum(v)))}
                                        {renderNum('Masa muestra húmedo fracción (g)', form.masa_muestra_humeda_fraccion_g, (v) => setField('masa_muestra_humeda_fraccion_g', parseNum(v)))}
                                        {renderNum('Masa muestra seco fracción (g)', form.masa_muestra_seca_fraccion_g, (v) => setField('masa_muestra_seca_fraccion_g', parseNum(v)))}
                                        {renderNum('Masa muestra seco constante fracción (g)', form.masa_muestra_seca_constante_fraccion_g, (v) => setField('masa_muestra_seca_constante_fraccion_g', parseNum(v)))}
                                        {renderNum('Contenido humedad fracción (%)', form.contenido_humedad_fraccion_pct, (v) => setField('contenido_humedad_fraccion_pct', parseNum(v)))}
                                        {renderNum('Masa muestra seco lavado fracción (g)', form.masa_muestra_seca_lavada_fraccion_g, (v) => setField('masa_muestra_seca_lavada_fraccion_g', parseNum(v)))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Masa retenida por tamiz (g)</h2>
                        </div>
                        <div className="p-4 overflow-x-auto">
                            <table className="w-full min-w-[780px] text-sm">
                                <thead className="bg-slate-100 text-xs font-semibold text-slate-600">
                                    <tr>
                                        <th className="px-3 py-2 border-b border-r border-slate-300 text-left">Tamiz</th>
                                        <th className="px-3 py-2 border-b border-slate-300 text-left">Masa retenida (g)</th>
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
                            <h2 className="text-sm font-semibold text-slate-900">Control de error de tamizado</h2>
                        </div>
                        <div className="p-4 grid grid-cols-1 xl:grid-cols-[1.2fr_420px] gap-4 items-start">
                            <div className="border border-slate-300">
                                <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-center text-xs font-semibold text-slate-800">
                                    Error máximo permitido {ERROR_TAMIZADO_MAX_PCT}%
                                </div>
                                <table className="w-full text-sm">
                                    <tbody>
                                        <tr>
                                            <td className="border-b border-r border-slate-300 px-2 py-2">
                                                Masa muestra ANTES tamizado (g)
                                            </td>
                                            <td className="border-b border-slate-300 px-2 py-2">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={form.masa_antes_tamizado_g ?? ''}
                                                    onChange={(e) => setField('masa_antes_tamizado_g', parseNum(e.target.value))}
                                                    autoComplete="off"
                                                    data-lpignore="true"
                                                    className="w-full h-9 px-3 rounded-md border border-input bg-white text-sm"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border-b border-r border-slate-300 px-2 py-2">
                                                Masa muestra DESPUES tamizado (g)
                                            </td>
                                            <td className="border-b border-slate-300 px-2 py-2">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={form.masa_despues_tamizado_g ?? ''}
                                                    onChange={(e) => setField('masa_despues_tamizado_g', parseNum(e.target.value))}
                                                    autoComplete="off"
                                                    data-lpignore="true"
                                                    className="w-full h-9 px-3 rounded-md border border-input bg-white text-sm"
                                                />
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="border-r border-slate-300 px-2 py-2 font-semibold">
                                                Error de tamizado ((a-b)/(a)*100)
                                            </td>
                                            <td className="px-2 py-2">
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={form.error_tamizado_pct ?? derivedError ?? ''}
                                                    readOnly
                                                    className="w-full h-9 px-3 rounded-md border border-input bg-slate-50 text-sm"
                                                />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className="border border-slate-300 bg-white">
                                <div className="border-b border-slate-300 bg-slate-100 px-2 py-1 text-center text-xs font-semibold text-slate-800">
                                    Referencia Excel
                                </div>
                                <div className="p-2">
                                    <img
                                        src="/gran-agregado-ref.png"
                                        alt="Referencia de error de tamizado"
                                        className="w-full rounded-md border border-slate-200"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border border-slate-300 bg-white shadow-sm">
                        <div className="px-4 py-2.5 border-b border-slate-300 bg-slate-100">
                            <h2 className="text-sm font-semibold text-slate-900">Equipos / observaciones / firmas</h2>
                        </div>
                        <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div className="space-y-3">
                                {renderSelect('Balanza 0.1 g', form.balanza_01g_codigo || '-', EQ_BALANZA, (v) => setField('balanza_01g_codigo', v))}
                                {renderSelect('Horno', form.horno_codigo || '-', EQ_HORNO, (v) => setField('horno_codigo', v))}
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
                    <div className="border border-slate-300 bg-white p-3">
                        <table className="w-full text-xs">
                            <tbody>
                                <tr className="border-b border-slate-300">
                                    <td className="px-2 py-2">Tamices llenos</td>
                                    <td className="px-2 py-2 text-right font-semibold">{filledSieves}/{SIEVE_LABELS.length}</td>
                                </tr>
                                <tr className="border-b border-slate-300">
                                    <td className="px-2 py-2">Peso total (g)</td>
                                    <td className="px-2 py-2 text-right font-semibold">{totalSieves || '-'}</td>
                                </tr>
                                <tr className="border-b border-slate-300">
                                    <td className="px-2 py-2">Error derivado (%)</td>
                                    <td className="px-2 py-2 text-right font-semibold">{derivedError ?? '-'}</td>
                                </tr>
                                <tr>
                                    <td className="px-2 py-2">Error final (%)</td>
                                    <td className="px-2 py-2 text-right font-semibold">{form.error_tamizado_pct ?? derivedError ?? '-'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    </div>
                </div>
            </div>
        </div>
    )
}

