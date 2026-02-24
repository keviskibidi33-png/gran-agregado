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
                label: 'Descripción',
                ready: hasText(form.tipo_muestra) && hasText(form.tamano_maximo_particula_visual_in),
                detail: hasText(form.forma_particula) ? 'Forma registrada' : 'Falta forma',
            },
            {
                label: 'Granulometría',
                ready:
                    hasNum(form.masa_muestra_humeda_inicial_total_global_g) ||
                    hasNum(form.masa_muestra_seca_global_g) ||
                    hasNum(form.masa_muestra_humeda_inicial_total_fraccionada_g) ||
                    hasNum(form.masa_muestra_seca_inicial_total_fraccionada_g),
                detail: hasNum(form.contenido_humedad_fraccion_pct) ? `Humedad: ${form.contenido_humedad_fraccion_pct}%` : undefined,
            },
            {
                label: 'Tabla tamices',
                ready: filledSieves > 0,
                detail: `${filledSieves}/${SIEVE_LABELS.length}`,
            },
            {
                label: 'Control de error',
                ready: hasNum(form.error_tamizado_pct) || hasNum(derivedError),
                detail: (form.error_tamizado_pct ?? derivedError) != null ? `${form.error_tamizado_pct ?? derivedError}%` : undefined,
            },
            {
                label: 'Equipos y cierre',
                ready: form.balanza_01g_codigo !== '-' && form.horno_codigo !== '-',
                detail: hasText(form.revisado_por) && hasText(form.aprobado_por) ? 'Firmas listas' : 'Sin firmas',
            },
        ]

        const readyCount = sections.filter((section) => section.ready).length
        const completion = Math.round((readyCount / sections.length) * 100)

        return { completion, sections }
    }, [
        derivedError,
        filledSieves,
        form.aprobado_por,
        form.balanza_01g_codigo,
        form.contenido_humedad_fraccion_pct,
        form.error_tamizado_pct,
        form.forma_particula,
        form.horno_codigo,
        form.masa_muestra_humeda_inicial_total_fraccionada_g,
        form.masa_muestra_humeda_inicial_total_global_g,
        form.masa_muestra_seca_global_g,
        form.masa_muestra_seca_inicial_total_fraccionada_g,
        form.muestra,
        form.numero_ot,
        form.realizado_por,
        form.revisado_por,
        form.tamano_maximo_particula_visual_in,
        form.tipo_muestra,
    ])

    const setField = useCallback(<K extends keyof GranAgregadoPayload>(key: K, value: GranAgregadoPayload[K]) => {
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

    return (
        <div className="max-w-[1780px] mx-auto p-4 md:p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-primary/10">
                    <Beaker className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-foreground">Granulometría de Agregados - ASTM C136/C136M-25</h1>
                    <p className="text-sm text-muted-foreground">Formulario operativo Gran Agregado</p>
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
                            <h2 className="text-sm font-semibold text-foreground">Descripción y granulometría</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {renderText('Tipo de muestra', form.tipo_muestra, (v) => setField('tipo_muestra', v))}
                                {renderText('Tamaño máximo visual (in)', form.tamano_maximo_particula_visual_in, (v) => setField('tamano_maximo_particula_visual_in', v))}
                                {renderText('Forma de la partícula', form.forma_particula, (v) => setField('forma_particula', v))}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                {renderNum('Global: masa húmeda inicial (g)', form.masa_muestra_humeda_inicial_total_global_g, (v) => setField('masa_muestra_humeda_inicial_total_global_g', parseNum(v)))}
                                {renderNum('Global: masa seca (g)', form.masa_muestra_seca_global_g, (v) => setField('masa_muestra_seca_global_g', parseNum(v)))}
                                {renderNum('Global: masa seca constante (g)', form.masa_muestra_seca_constante_global_g, (v) => setField('masa_muestra_seca_constante_global_g', parseNum(v)))}
                                {renderNum('Global: masa seca lavada (g)', form.masa_muestra_seca_lavada_global_g, (v) => setField('masa_muestra_seca_lavada_global_g', parseNum(v)))}
                                {renderNum('Frac: masa húmeda inicial total (g)', form.masa_muestra_humeda_inicial_total_fraccionada_g, (v) => setField('masa_muestra_humeda_inicial_total_fraccionada_g', parseNum(v)))}
                                {renderNum('Frac: masa seca inicial total (g)', form.masa_muestra_seca_inicial_total_fraccionada_g, (v) => setField('masa_muestra_seca_inicial_total_fraccionada_g', parseNum(v)))}
                                {renderNum('Frac: masa seca grueso (g)', form.masa_muestra_seca_grueso_g, (v) => setField('masa_muestra_seca_grueso_g', parseNum(v)))}
                                {renderNum('Frac: masa seca constante grueso (g)', form.masa_muestra_seca_constante_grueso_g, (v) => setField('masa_muestra_seca_constante_grueso_g', parseNum(v)))}
                                {renderNum('Frac: masa húmeda fino (g)', form.masa_muestra_humeda_fino_g, (v) => setField('masa_muestra_humeda_fino_g', parseNum(v)))}
                                {renderNum('Frac: masa seca fino (g)', form.masa_muestra_seca_fino_g, (v) => setField('masa_muestra_seca_fino_g', parseNum(v)))}
                                {renderNum('Frac: masa húmeda fracción (g)', form.masa_muestra_humeda_fraccion_g, (v) => setField('masa_muestra_humeda_fraccion_g', parseNum(v)))}
                                {renderNum('Frac: masa seca fracción (g)', form.masa_muestra_seca_fraccion_g, (v) => setField('masa_muestra_seca_fraccion_g', parseNum(v)))}
                                {renderNum('Frac: masa seca constante fracción (g)', form.masa_muestra_seca_constante_fraccion_g, (v) => setField('masa_muestra_seca_constante_fraccion_g', parseNum(v)))}
                                {renderNum('Frac: contenido humedad (%)', form.contenido_humedad_fraccion_pct, (v) => setField('contenido_humedad_fraccion_pct', parseNum(v)))}
                                {renderNum('Frac: masa seca lavada (g)', form.masa_muestra_seca_lavada_fraccion_g, (v) => setField('masa_muestra_seca_lavada_fraccion_g', parseNum(v)))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Masa retenida por tamiz (g)</h2>
                        </div>
                        <div className="p-4 overflow-x-auto">
                            <table className="w-full min-w-[780px] text-sm">
                                <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2 border-b border-r border-border text-left">Tamiz</th>
                                        <th className="px-3 py-2 border-b border-border text-left">Masa retenida (g)</th>
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
                            <h2 className="text-sm font-semibold text-foreground">Control de error de tamizado</h2>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                            {renderNum('Masa antes tamizado (g)', form.masa_antes_tamizado_g, (v) => setField('masa_antes_tamizado_g', parseNum(v)))}
                            {renderNum('Masa después tamizado (g)', form.masa_despues_tamizado_g, (v) => setField('masa_despues_tamizado_g', parseNum(v)))}
                            {renderNum('Error tamizado (%)', form.error_tamizado_pct, (v) => setField('error_tamizado_pct', parseNum(v)))}
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-lg shadow-sm">
                        <div className="px-4 py-2.5 border-b border-border bg-muted/50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-foreground">Equipos / observaciones / firmas</h2>
                        </div>
                        <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                            <div className="space-y-3">
                                {renderSelect('Balanza 0.1 g', form.balanza_01g_codigo || '-', EQ_BALANZA, (v) => setField('balanza_01g_codigo', v))}
                                {renderSelect('Horno', form.horno_codigo || '-', EQ_HORNO, (v) => setField('horno_codigo', v))}
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
                                <tr className="border-b">
                                    <td className="px-2 py-2">Error derivado (%)</td>
                                    <td className="px-2 py-2 text-right font-semibold">{derivedError ?? '-'}</td>
                                </tr>
                                <tr>
                                    <td className="px-2 py-2">Error final (%)</td>
                                    <td className="px-2 py-2 text-right font-semibold">{form.error_tamizado_pct ?? derivedError ?? '-'}</td>
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
