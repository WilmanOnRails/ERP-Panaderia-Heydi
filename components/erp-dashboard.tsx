'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Archive, Bell, Boxes, ChevronDown, ClipboardList, Edit3, Factory, LayoutDashboard, Menu, Package, Pause, Plus, Search, ShoppingBasket, Trash2, Truck, Users, X, CheckCircle2, AlertTriangle, Download, FileText, CreditCard, Receipt } from 'lucide-react'
import { BillingModule } from '@/components/billing-module'
import type { BillingData } from '@/components/billing-module'

type OrderStatus = 'Pendiente' | 'En proceso' | 'Finalizada' | 'Cancelada'
type RecordItem = { id: string; name: string; code?: string; detail: string; status: string; data?: Record<string, string> }
type Order = { id: string; product: string; qty: number; produced: number; date: string; status: OrderStatus; startedAt?: string; finishedAt?: string; minutes?: number; cost?: number }
type Material = { id: string; name: string; code: string; unit: string; stock: number; cost: number }
type QcAction = 'Liberación' | 'Retrabajo' | 'Retorno retrabajo' | 'Scrap'
type QcBuckets = { pending: number; rework: number }
type QcRecord = { id: string; date: string; product: string; action: QcAction; qty: number; from: string; reason: string; value: number }
type MovementType = 'Entrada' | 'Consumo' | 'Producción' | 'Venta' | 'Despacho' | 'Devolución' | QcAction
type Movement = { id: number; date: string; type: MovementType; code: string; material: string; qty: number; unit: string; total: number; ref: string }
type PurchaseStatus = 'Pendiente' | 'Recibida parcial' | 'Recibida' | 'Cancelada'
type PurchaseLine = { code: string; qty: number; cost: number; received: number }
type Purchase = { id: string; supplier: string; date: string; status: PurchaseStatus; lines: PurchaseLine[]; notes?: string }
type SaleLine = { product: string; qty: number; price: number }
type Sale = { id: string; kind: 'Venta' | 'Despacho'; customer: string; date: string; lines: SaleLine[]; total: number }
type Field = { key: string; label: string; type?: string; required?: boolean }

// ---------- Utilidades ----------
const now = () => new Date().toLocaleString('es-NI')
const userInitials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase() ?? '').join('')
const num = (value: number, decimals = 2) => value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
const money = (value: number) => `C$ ${num(value)}`
const pct = (value: number) => `${num(value * 100, 1)}%`
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)
// Ingredientes de la receta: una línea por insumo con el formato CÓDIGO=cantidad por lote (ej. MP-101=5)
const parseIngredients = (text = '') => text.split(/\r?\n|;/).map((line) => line.split('=')).filter((p) => p.length === 2 && p[0].trim() && Number(p[1]) > 0).map(([code, qty]) => ({ code: code.trim(), qty: Number(qty) }))

// Receta y necesidades de insumos de una orden (la usan Disponibilidad, Iniciar y Finalizar)
function getNeeds(order: Order, records: Record<string, RecordItem[]>, materials: Material[]) {
  const product = (records.Productos ?? []).find((p) => p.name.toLowerCase() === order.product.toLowerCase())
  const bom = product?.code ? (records['BOM / Recetas'] ?? []).find((r) => (r.code ?? '').toUpperCase().startsWith(product.code!.toUpperCase())) : undefined
  const lines = parseIngredients(bom?.data?.ingredients)
  const batches = order.qty / (Number(bom?.data?.bomUnits) || order.qty)
  const needs = lines.map((line) => ({ line, m: materials.find((x) => x.code === line.code), need: line.qty * batches }))
  return { product, bom, lines, needs }
}
// Codigo y precio de un producto del catalogo
const productInfo = (records: Record<string, RecordItem[]>, name: string) => {
  const p = (records.Productos ?? []).find((x) => x.name.toLowerCase() === name.toLowerCase())
  const price = Number(p?.data?.price) || Number((p?.detail ?? '').match(/C\$\s*([\d.,]+)/)?.[1]?.replace(/,/g, '')) || 0
  return { code: p?.code ?? name, price }
}
// Numero de documento: OC-2026-0001, VT-2026-0001...
const nextDoc = (prefix: string, count: number) => `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

// Etiquetas de los tres "cubos" de producto terminado
const qcLabel: Record<'pending' | 'rework' | 'available', string> = { pending: 'Pendiente de liberación', rework: 'En retrabajo', available: 'Disponible (liberado)' }
// Costo unitario promedio de produccion de un producto (para valorar el scrap)
const unitCostOf = (orders: Order[], product: string) => {
  const done = orders.filter((o) => o.status === 'Finalizada' && o.product.toLowerCase() === product.toLowerCase() && (o.cost ?? 0) > 0 && o.produced > 0)
  const units = sum(done.map((o) => o.produced))
  return units ? sum(done.map((o) => o.cost ?? 0)) / units : 0
}

const groups = [
  { label: 'Panel principal', items: [['Dashboard', LayoutDashboard]] },
  { label: 'Datos maestros', items: [['Productos', Package], ['Materias primas', ShoppingBasket], ['BOM / Recetas', ClipboardList], ['Rutas de producción', Factory], ['Almacenes', Archive], ['Proveedores', Truck], ['Clientes', Users]] },
  { label: 'Compras', items: [['Órdenes de compra', ClipboardList], ['Recepción de material', Truck]] },
  { label: 'Facturación', items: [['Cotizaciones', FileText], ['Facturación', Receipt], ['Registro de pagos', CreditCard], ['Devoluciones y notas de crédito', ClipboardList]] },
  { label: 'Inventario', items: [['Existencias', Boxes], ['Entradas', Plus], ['Salidas', Package], ['Movimientos', ClipboardList]] },
  { label: 'Producción', items: [['Órdenes de producción', Factory], ['Disponibilidad de materiales', Boxes], ['Consumo de materias primas', ShoppingBasket], ['Seguimiento de operaciones', ClipboardList], ['Productos terminados', Package], ['Calidad y liberación', CheckCircle2]] },
  { label: 'Reportes', items: [['Reportes de gestión', ClipboardList]] },
  { label: 'Administración', items: [['Usuarios y roles', Users], ['Mi cuenta', Users], ['Configuración', ClipboardList]] },
]

const materialFields: Field[] = [{ key: 'name', label: 'Nombre de materia prima', required: true }, { key: 'code', label: 'Código', required: true }, { key: 'unit', label: 'Unidad de medida (lb, kg, unidad...)', required: true }]

const fields: Record<string, Field[]> = {
  Productos: [{ key: 'name', label: 'Nombre de producto', required: true }, { key: 'code', label: 'Código de producto', required: true }, { key: 'breadType', label: 'Tipo de pan', required: true }, { key: 'units', label: 'Unidades', type: 'number', required: true }, { key: 'price', label: 'Precio', type: 'number', required: true }],
  'Materias primas': materialFields,
  'BOM / Recetas': [{ key: 'name', label: 'Nombre de receta', required: true }, { key: 'code', label: 'Código (empieza con el código del producto)', required: true }, { key: 'bomUnits', label: 'Unidades que rinde el lote', type: 'number', required: true }, { key: 'description', label: 'Descripción de la receta', type: 'textarea', required: true }, { key: 'ingredients', label: 'Ingredientes de la receta (cantidad necesaria para un lote completo)', type: 'ingredients', required: true }],
  'Rutas de producción': [{ key: 'name', label: 'Nombre de ruta', required: true }, { key: 'code', label: 'Código', required: true }, { key: 'operations', label: 'Operaciones', type: 'textarea', required: true }, { key: 'duration', label: 'Duración estimada (minutos)', type: 'number', required: true }],
  Almacenes: [{ key: 'name', label: 'Nombre del almacén', required: true }, { key: 'code', label: 'Código', required: true }, { key: 'warehouseType', label: 'Tipo de almacén', required: true }, { key: 'location', label: 'Ubicación', required: true }],
  Proveedores: [{ key: 'name', label: 'Nombre del proveedor', required: true }, { key: 'lastName', label: 'Apellidos', required: true }, { key: 'identity', label: 'Cédula de identidad', required: true }, { key: 'phone', label: 'Número de teléfono', required: true }, { key: 'email', label: 'Correo electrónico', type: 'email', required: true }],
  Clientes: [{ key: 'name', label: 'Nombre del cliente', required: true }, { key: 'phone', label: 'Teléfono', required: true }, { key: 'address', label: 'Dirección', required: true }, { key: 'email', label: 'Correo electrónico', type: 'email', required: true }, { key: 'code', label: 'Código', required: true }],
  'Órdenes de producción': [{ key: 'order', label: 'Orden', required: true }, { key: 'product', label: 'Producto', type: 'product', required: true }, { key: 'planned', label: 'Planificado', type: 'number', required: true }, { key: 'produced', label: 'Producido', type: 'number', required: true }, { key: 'status', label: 'Estado', required: true }],
  'Usuarios y roles': [{ key: 'name', label: 'Nombre completo', required: true }, { key: 'username', label: 'Nombre de usuario', required: true }, { key: 'code', label: 'Código', required: true }, { key: 'phone', label: 'Teléfono' }, { key: 'email', label: 'Correo electrónico', type: 'email', required: true }, { key: 'role', label: 'Rol', required: true }, { key: 'password', label: 'Contraseña (mínimo 12 caracteres; en edición dejar en blanco para conservarla)', type: 'password' }],
}

const initial: Record<string, RecordItem[]> = {
  Productos: [{ id: 'P-001', name: 'Gemelos', code: 'GEM-000', detail: 'Repostería · 80 und/lote · C$ 180', status: 'Activo', data: { name: 'Gemelos', code: 'GEM-000', breadType: 'Repostería', units: '80', price: '180' } }],
  // OJO: la cantidad de ingredientes es un EJEMPLO. Edita la receta con las cantidades reales del lote de gemelos.
  'BOM / Recetas': [{ id: 'BOM-001', name: 'Receta Gemelos — lote estándar', code: 'GEM-000 v1.0', detail: '80 unidades · Receta vigente', status: 'Activo', data: { name: 'Receta Gemelos — lote estándar', code: 'GEM-000 v1.0', bomUnits: '80', description: '80 unidades · Receta vigente', ingredients: 'MP-101=5' } }],
  'Rutas de producción': [{ id: 'RT-001', name: 'Ruta Gemelos estándar', code: 'GEM-000 v1.0', detail: '12 operaciones · 158 minutos', status: 'Activo' }],
  Almacenes: [{ id: 'AL-001', name: 'Bodega de materias primas', code: 'AL-001', detail: 'Materias primas · Sector C', status: 'Activo' }],
  Proveedores: [{ id: 'PR-001', name: 'Distribuidora El Trigal', detail: '2222-0101 · compras@trigal.ni', status: 'Activo' }],
  Clientes: [{ id: 'CL-001', name: 'Cafetería Las Américas', code: 'CL-001', detail: '2255-1200 · Managua', status: 'Activo' }],
}
const initialMaterials: Material[] = [{ id: 'MP-101', name: 'Harina especial', code: 'MP-101', unit: 'lb', stock: 4.5, cost: 0 }]
const initialOrders: Order[] = [{ id: 'OP-2024-0018', product: 'Gemelos', qty: 80, produced: 40, date: 'Hoy, 08:30', status: 'En proceso' }, { id: 'OP-2024-0015', product: 'Gemelos', qty: 80, produced: 0, date: '28 Oct, 10:20', status: 'Pendiente' }]

function Badge({ status }: { status: string }) { const label = status === 'approved' ? 'Aprobado' : status === 'pending' ? 'Pendiente de aprobación' : status === 'rejected' ? 'Rechazado' : status; return <span className={`status-badge ${status === 'Activo' || status === 'Finalizada' || status === 'Recibida' || status === 'approved' ? 'success' : status === 'En proceso' || status === 'Recibida parcial' ? 'progress' : 'warning'}`}><span className="status-dot" />{label}</span> }

function Head({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children?: ReactNode }) { return <section className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="subtitle">{subtitle}</p></div>{children}</section> }
function Table({ head, rows, empty = 'No hay registros para mostrar.' }: { head: string[]; rows: (string | number)[][]; empty?: string }) { return <section className="panel module-panel">{rows.length ? <div className="table-scroll"><table><thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div> : <div className="empty-state"><AlertTriangle />{empty}</div>}</section> }

export function ErpDashboard({ currentUser: initialUser, isAdmin, logoutButton }: { currentUser: { id: number; fullName: string; username: string; email: string; phone: string; role: string }; isAdmin: boolean; logoutButton: ReactNode }) {
  const [currentUser, setCurrentUser] = useState(initialUser)
  const [active, setActive] = useState('Dashboard'); const [records, setRecords] = useState(initial); const [orders, setOrders] = useState(initialOrders); const [materials, setMaterials] = useState(initialMaterials); const [movements, setMovements] = useState<Movement[]>([]); const [search, setSearch] = useState(''); const [notice, setNotice] = useState(''); const [modal, setModal] = useState<{ module: string; item?: RecordItem } | null>(null); const [detail, setDetail] = useState<RecordItem | null>(null); const [finalizing, setFinalizing] = useState<Order | null>(null); const [form, setForm] = useState<Record<string, string>>({}); const [loaded, setLoaded] = useState(false)
  const [expandedGroup, setExpandedGroup] = useState('Panel principal')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [purchases, setPurchases] = useState<Purchase[]>([]); const [sales, setSales] = useState<Sale[]>([]); const [productStock, setProductStock] = useState<Record<string, number>>({}); const [purchaseDraft, setPurchaseDraft] = useState<{ code: string; qty: number }[] | null>(null)
  const [qc, setQc] = useState<Record<string, QcBuckets>>({}); const [qcRequired, setQcRequired] = useState<Record<string, boolean>>({}); const [qcLog, setQcLog] = useState<QcRecord[]>([])
  const [billing, setBilling] = useState<BillingData>({ quotes: [], invoices: [], payments: [], creditNotes: [] })
  const [workspaceError, setWorkspaceError] = useState('')
  const workspaceVersion = useRef(0)
  const saveQueue = useRef(Promise.resolve())
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const response = await fetch('/api/workspace', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error?.message ?? 'No se pudieron cargar los datos del ERP.')
      if (cancelled) return
      let saved = result.data && typeof result.data === 'object' && !Array.isArray(result.data) ? result.data as Record<string, unknown> : {}
      let version = Number.isSafeInteger(result.version) ? result.version : 0
      if (version === 0 && Object.keys(saved).length === 0) {
        let legacyData: string | null = null
        let legacyBilling: string | null = null
        try {
          legacyData = window.localStorage.getItem('erp-heydi-datos')
          legacyBilling = window.localStorage.getItem('erp-heydi-facturacion')
        } catch {
          // Browser storage may be disabled; the server workspace remains the source of truth.
        }
        if (legacyData || legacyBilling) {
          const legacy = legacyData ? JSON.parse(legacyData) as Record<string, unknown> : {}
          const legacyBillingData = legacyBilling ? JSON.parse(legacyBilling) as Partial<BillingData> : {}
          const legacyRecords = legacy.records && typeof legacy.records === 'object' && !Array.isArray(legacy.records)
            ? legacy.records as Record<string, unknown>
            : {}
          const { 'Usuarios y roles': _users, ...savedRecords } = legacyRecords as Record<string, RecordItem[]>
          saved = {
            ...legacy,
            records: savedRecords,
            billing: {
              quotes: Array.isArray(legacyBillingData.quotes) ? legacyBillingData.quotes : [],
              invoices: Array.isArray(legacyBillingData.invoices) ? legacyBillingData.invoices : [],
              payments: Array.isArray(legacyBillingData.payments) ? legacyBillingData.payments : [],
              creditNotes: Array.isArray(legacyBillingData.creditNotes) ? legacyBillingData.creditNotes : [],
            },
          }
          const migrationResponse = await fetch('/api/workspace', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ version, data: saved }),
          })
          const migrationResult = await migrationResponse.json()
          if (!migrationResponse.ok) throw new Error(migrationResult.error?.message ?? 'No se pudieron migrar los datos guardados en este navegador.')
          version = migrationResult.version
          try {
            window.localStorage.removeItem('erp-heydi-datos')
            window.localStorage.removeItem('erp-heydi-facturacion')
          } catch {
            setNotice('Los datos se sincronizaron con el servidor, pero no se pudo borrar la copia local antigua.')
          }
        }
      }
      workspaceVersion.current = version
      if (saved.records && typeof saved.records === 'object' && !Array.isArray(saved.records)) {
        const { 'Usuarios y roles': _users, ...savedRecords } = saved.records as Record<string, RecordItem[]>
        setRecords(savedRecords)
      }
      if (Array.isArray(saved.orders)) setOrders(saved.orders as Order[])
      if (Array.isArray(saved.materials)) setMaterials(saved.materials as Material[])
      if (Array.isArray(saved.movements)) setMovements(saved.movements as Movement[])
      if (Array.isArray(saved.purchases)) setPurchases(saved.purchases as Purchase[])
      if (Array.isArray(saved.sales)) setSales(saved.sales as Sale[])
      if (saved.productStock && typeof saved.productStock === 'object' && !Array.isArray(saved.productStock)) setProductStock(saved.productStock as Record<string, number>)
      if (saved.qc && typeof saved.qc === 'object' && !Array.isArray(saved.qc)) setQc(saved.qc as Record<string, QcBuckets>)
      if (saved.qcRequired && typeof saved.qcRequired === 'object' && !Array.isArray(saved.qcRequired)) setQcRequired(saved.qcRequired as Record<string, boolean>)
      if (Array.isArray(saved.qcLog)) setQcLog(saved.qcLog as QcRecord[])
      if (saved.billing && typeof saved.billing === 'object' && !Array.isArray(saved.billing)) {
        const billingData = saved.billing as Partial<BillingData>
        setBilling({
          quotes: Array.isArray(billingData.quotes) ? billingData.quotes : [],
          invoices: Array.isArray(billingData.invoices) ? billingData.invoices : [],
          payments: Array.isArray(billingData.payments) ? billingData.payments : [],
          creditNotes: Array.isArray(billingData.creditNotes) ? billingData.creditNotes : [],
        })
      }
      setLoaded(true)
    })().catch((error: unknown) => {
      if (!cancelled) setWorkspaceError(error instanceof Error ? error.message : 'No se pudieron cargar los datos del ERP.')
    })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (!loaded || workspaceError) return
    const { 'Usuarios y roles': _users, ...savedRecords } = records
    const data = { records: savedRecords, orders, materials, movements, purchases, sales, productStock, qc, qcRequired, qcLog, billing }
    saveQueue.current = saveQueue.current.then(async () => {
      const response = await fetch('/api/workspace', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: workspaceVersion.current, data }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error?.message ?? 'No se pudieron guardar los datos del ERP.')
      workspaceVersion.current = result.version
    }).catch((error: unknown) => {
      setWorkspaceError(error instanceof Error ? error.message : 'No se pudieron guardar los datos del ERP.')
    })
  }, [loaded, workspaceError, records, orders, materials, movements, purchases, sales, productStock, qc, qcRequired, qcLog, billing])
  const resetAll = () => { if (!window.confirm('Se borrarán todos los datos registrados y volverán los datos iniciales. ¿Continuar?')) return; setRecords(initial); setOrders(initialOrders); setMaterials(initialMaterials); setMovements([]); setPurchases([]); setSales([]); setProductStock({}); setQc({}); setQcRequired({}); setQcLog([]); setBilling({ quotes: [], invoices: [], payments: [], creditNotes: [] }); notify('Datos restablecidos') }
  const selectPage = (label: string) => {
    setActive(label)
    setSearch('')
    setSidebarOpen(false)
    const group = groups.find(({ items }) => items.some(([item]) => item === label))
    if (group) setExpandedGroup(group.label)
  }
  // Carga en un clic los datos de ejemplo: 5 insumos con compra registrada y la receta completa (las órdenes quedan listas para finalizar)
  const loadDemo = () => {
    if (!window.confirm('Se reemplazarán los datos actuales por los datos de ejemplo (insumos, compras y receta). ¿Continuar?')) return
    const stamp = now()
    const demo = [['MP-101', 'Harina especial', 'lb', 30, 22, 'Factura 001'], ['MP-102', 'Azúcar blanca', 'lb', 8, 20, 'Factura 001'], ['MP-103', 'Margarina', 'lb', 8, 55, 'Factura 002'], ['MP-104', 'Huevos', 'unidad', 60, 6, 'Factura 002'], ['MP-105', 'Levadura', 'lb', 1.5, 90, 'Factura 003']] as const
    setMaterials(demo.map(([code, name, unit, qty, cost]) => ({ id: code, name, code, unit, stock: code === 'MP-101' ? qty + 4.5 : qty, cost })))
    setMovements(demo.map(([code, name, unit, qty, cost, ref], i) => ({ id: Date.now() + i, date: stamp, type: 'Entrada' as const, code, material: name, qty, unit, total: qty * cost, ref })).reverse())
    setRecords({ ...initial, 'BOM / Recetas': initial['BOM / Recetas'].map((r) => ({ ...r, data: { ...r.data!, ingredients: 'MP-101=12\nMP-102=3\nMP-103=3\nMP-104=24\nMP-105=0.5' } })) })
    setOrders(initialOrders)
    setPurchases([]); setSales([]); setProductStock({}); setQc({}); setQcRequired({}); setQcLog([]); setBilling({ quotes: [], invoices: [], payments: [], creditNotes: [] })
    notify('Datos de ejemplo cargados: ahora finaliza las dos órdenes')
  }
  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(''), 4000) }
  useEffect(() => {
    if (!loaded || !isAdmin || active !== 'Usuarios y roles') return
    let cancelled = false
    void (async () => {
      const users: { id: number; fullName: string; username: string; code: string; phone: string; email: string; role: string; status: string }[] = []
      let page = 1
      let hasMore = true
      while (hasMore && !cancelled) {
        const response = await fetch(`/api/users?page=${page}&limit=100`, { cache: 'no-store' })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error?.message ?? 'No se pudieron cargar los usuarios.')
        users.push(...result.data)
        hasMore = result.pagination.hasMore
        page += 1
      }
      if (!cancelled) {
        const userRecords: RecordItem[] = users.map((user) => ({
          id: String(user.id),
          name: user.fullName,
          code: user.code,
          detail: `${user.username} · ${user.email} · ${user.phone || 'Sin teléfono'} · ${user.role}`,
          status: user.status,
          data: { name: user.fullName, username: user.username, code: user.code, phone: user.phone, email: user.email, role: user.role, status: user.status },
        }))
        setRecords((current) => ({ ...current, 'Usuarios y roles': userRecords }))
      }
    })().catch((error: unknown) => { if (!cancelled) notify(error instanceof Error ? error.message : 'No se pudieron cargar los usuarios.') })
    return () => { cancelled = true }
  }, [active, isAdmin, loaded])
  const moduleFields = fields[active] ?? []
  const productNames = (records.Productos ?? []).map((p) => p.name)
  const finishedRows = Array.from(new Set([...productNames, ...Object.keys(productStock), ...Object.keys(qc)])).map((name) => [name, `${num(productStock[name] ?? 0, 0)} und`, `${num(qc[name]?.pending ?? 0, 0)} und`, `${num(qc[name]?.rework ?? 0, 0)} und`])
  const visible = useMemo(() => (records[active] ?? []).filter((item) => `${item.name} ${item.code ?? ''} ${item.detail}`.toLowerCase().includes(search.toLowerCase())), [records, active, search])
  const openModal = (module: string, item?: RecordItem) => {
    selectPage(module)
    if (module === 'Órdenes de producción') {
      const order = item as unknown as Order | undefined
      setForm(item?.data ?? { order: order?.id ?? '', product: order?.product ?? '', planned: order?.qty ? String(order.qty) : '', produced: order?.produced ? String(order.produced) : '0', status: order?.status ?? 'Pendiente' })
    } else {
      setForm(item?.data ?? { name: item?.name ?? '', code: item?.code ?? '', description: item?.detail ?? '' })
    }
    setModal({ module, item })
  }
  const editMaterial = (m: Material) => openModal('Materias primas', { id: m.id, name: m.name, code: m.code, detail: '', status: 'Activo', data: { name: m.name, code: m.code, unit: m.unit } })
  const save = async () => {
    if (!modal) return
    if (modal.module === 'Usuarios y roles') {
      const creating = !modal.item
      if (!form.name?.trim() || !form.username?.trim() || !form.code?.trim() || !form.email?.trim() || !form.role?.trim()) {
        notify('Completa los campos obligatorios del usuario')
        return
      }
      if (creating && (form.password?.length ?? 0) < 12) {
        notify('La contraseña debe tener al menos 12 caracteres')
        return
      }
      const payload = {
        fullName: form.name.trim(),
        username: form.username.trim(),
        code: form.code.trim(),
        phone: form.phone?.trim() ?? '',
        email: form.email.trim(),
        role: form.role,
        ...(form.password ? { password: form.password } : {}),
      }
      try {
        const response = await fetch(creating ? '/api/users' : `/api/users/${modal.item!.id}`, {
          method: creating ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error?.message ?? 'No se pudo guardar el usuario.')
        const user = result.data
        const item: RecordItem = {
          id: String(user.id),
          name: user.fullName,
          code: user.code,
          detail: `${user.username} · ${user.email} · ${user.phone || 'Sin teléfono'} · ${user.role}`,
          status: user.status,
          data: { name: user.fullName, username: user.username, code: user.code, phone: user.phone, email: user.email, role: user.role, status: user.status },
        }
        setRecords((current) => ({
          ...current,
          'Usuarios y roles': creating
            ? [item, ...(current['Usuarios y roles'] ?? [])]
            : (current['Usuarios y roles'] ?? []).map((row) => row.id === item.id ? item : row),
        }))
        setModal(null)
        notify(creating ? 'Usuario creado; ya puede iniciar sesión con su usuario o correo' : 'Usuario actualizado')
      } catch (error) {
        notify(error instanceof Error ? error.message : 'No se pudo guardar el usuario.')
      }
      return
    }
    if (modal.module === 'Órdenes de producción') {
      if (!form.order?.trim() || !form.product?.trim() || !form.planned) return
      const order: Order = { id: form.order.trim(), product: form.product.trim(), qty: Number(form.planned), produced: Number(form.produced || 0), date: 'Ahora', status: (form.status as OrderStatus) || 'Pendiente' }
      setOrders((current) => modal.item ? current.map((row) => row.id === modal.item?.id ? order : row) : [order, ...current])
      setModal(null)
      notify(`Orden ${order.id} ${modal.item ? 'actualizada' : 'creada'}`)
      return
    }
    if (modal.module === 'Materias primas') {
      if (!form.name?.trim() || !form.code?.trim() || !form.unit?.trim()) return
      const code = form.code.trim()
      if (!modal.item && materials.some((m) => m.code === code)) { notify('Ya existe una materia prima con ese código'); return }
      if (modal.item) setMaterials((current) => current.map((m) => m.id === modal.item?.id ? { ...m, name: form.name.trim(), code, unit: form.unit.trim() } : m))
      else setMaterials((current) => [...current, { id: code, name: form.name.trim(), code, unit: form.unit.trim(), stock: 0, cost: 0 }])
      setModal(null)
      notify(modal.item ? 'Materia prima actualizada' : 'Materia prima creada: genera su orden de compra en Compras')
      return
    }
    if (!form.name?.trim()) return
    if (modal.module === 'BOM / Recetas' && parseIngredients(form.ingredients).length === 0) { notify('Agrega al menos un ingrediente con su cantidad'); return }
    const id = modal.item?.id ?? `${modal.module.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-5)}`
    const item: RecordItem = { id, name: form.name.trim(), code: form.code?.trim(), detail: form.description || Object.entries(form).filter(([key]) => key !== 'name' && key !== 'code').map(([key, value]) => `${key}: ${value}`).join(' · ') || 'Registro activo', status: 'Activo', data: form }
    setRecords((current) => ({ ...current, [modal.module]: modal.item ? current[modal.module].map((row) => row.id === id ? item : row) : [...(current[modal.module] ?? []), item] }))
    setModal(null)
    notify(`${modal.item ? 'Registro actualizado' : 'Registro creado'} en ${modal.module}`)
  }
  const remove = (module: string, id: string) => { setRecords((current) => ({ ...current, [module]: current[module].filter((row) => row.id !== id) })); notify('Registro eliminado del catálogo') }
  const updateRegistrationStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error?.message ?? 'No se pudo actualizar la solicitud.')
      const user = result.data
      setRecords((current) => ({
        ...current,
        'Usuarios y roles': (current['Usuarios y roles'] ?? []).map((item) => item.id === id
          ? {
            ...item,
            status: user.status,
            detail: `${user.username} · ${user.email} · ${user.phone || 'Sin teléfono'} · ${user.role}`,
            data: { ...(item.data ?? {}), status: user.status, role: user.role },
          }
          : item),
      }))
      notify(status === 'approved' ? 'Cuenta aprobada; ya puede iniciar sesión' : 'Solicitud rechazada')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo actualizar la solicitud.')
    }
  }
  const removeUser = async (id: string) => {
    if (!window.confirm('¿Eliminar este usuario? Ya no podrá iniciar sesión.')) return
    try {
      const response = await fetch(`/api/users/${id}`, { method: 'DELETE' })
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error?.message ?? 'No se pudo eliminar el usuario.')
      }
      setRecords((current) => ({ ...current, 'Usuarios y roles': (current['Usuarios y roles'] ?? []).filter((row) => row.id !== id) }))
      notify('Usuario eliminado')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo eliminar el usuario.')
    }
  }
  const saveProfile = async (updates: { fullName: string; username: string; email: string; phone: string; currentPassword: string; newPassword?: string }) => {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error?.message ?? 'No se pudo actualizar tu cuenta.')
      setCurrentUser((user) => ({ ...user, fullName: result.data.fullName, username: result.data.username, email: result.data.email, phone: result.data.phone }))
      notify('Tu cuenta se actualizó correctamente')
      return true
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo actualizar tu cuenta.')
      return false
    }
  }
  const removeMaterial = (id: string) => { setMaterials((current) => current.filter((m) => m.id !== id)); notify('Materia prima eliminada') }
  const updateOrder = (id: string, status: OrderStatus) => {
    const target = orders.find((o) => o.id === id)
    let warn = ''
    if (target && status === 'En proceso') { const { needs } = getNeeds(target, records, materials); if (needs.some((n) => !n.m || n.m.stock < n.need)) warn = ' · Atención: faltan insumos, revisa Disponibilidad de materiales' }
    setOrders((current) => current.map((order) => order.id === id ? { ...order, status, startedAt: status === 'En proceso' ? now() : order.startedAt } : order))
    notify(`Orden ${id}: ${status}${warn}`)
  }

  // Entradas de inventario: suman stock y recalculan el costo promedio ponderado (las usan Entradas directas y Recepcion de material)
  const applyEntries = (entries: { code: string; qty: number; cost: number; ref: string }[]) => {
    if (!entries.length) { notify('Indica al menos una cantidad a recibir'); return false }
    const next = materials.map((m) => ({ ...m }))
    const stamp = now()
    const moves: Movement[] = []
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]
      const m = next.find((x) => x.code === e.code)
      if (!m) { notify('Selecciona una materia prima'); return false }
      if (!(e.qty > 0)) { notify('La cantidad debe ser mayor que cero'); return false }
      if (!(e.cost >= 0)) { notify('El costo unitario no es válido'); return false }
      const newStock = m.stock + e.qty
      m.cost = m.stock <= 0 || m.cost <= 0 ? e.cost : (m.stock * m.cost + e.qty * e.cost) / newStock
      m.stock = newStock
      moves.push({ id: Date.now() + i, date: stamp, type: 'Entrada', code: m.code, material: m.name, qty: e.qty, unit: m.unit, total: e.qty * e.cost, ref: e.ref.trim() || 'Compra' })
    }
    setMaterials(next)
    setMovements((current) => [...[...moves].reverse(), ...current])
    return true
  }
  // Entrada directa (sin orden de compra)
  const addEntry = (code: string, qty: number, unitCost: number, ref: string) => {
    if (!applyEntries([{ code, qty, cost: unitCost, ref }])) return false
    const m = materials.find((x) => x.code === code)
    notify(`Entrada registrada: ${num(qty)} ${m?.unit ?? ''} de ${m?.name ?? code}`)
    return true
  }

  // 1) Orden de compra: solo registra el pedido al proveedor, no mueve inventario
  const createPurchase = (supplier: string, purchaseLines: { code: string; qty: number; cost: number }[], notes: string) => {
    if (!supplier) { notify('Selecciona un proveedor'); return false }
    const clean = purchaseLines.filter((l) => l.code && l.qty > 0 && l.cost > 0)
    if (!clean.length) { notify('Agrega al menos una materia prima con cantidad y costo'); return false }
    const po: Purchase = { id: nextDoc('OC', purchases.length), supplier, date: now(), status: 'Pendiente', lines: clean.map((l) => ({ ...l, received: 0 })), notes: notes.trim() || undefined }
    setPurchases((current) => [po, ...current])
    notify(`Orden de compra ${po.id} creada: cuando llegue el material, regístralo en Recepción de material`)
    return true
  }
  const cancelPurchase = (id: string) => {
    setPurchases((current) => current.map((p) => p.id === id && p.status === 'Pendiente' ? { ...p, status: 'Cancelada' as PurchaseStatus } : p))
    notify(`Orden de compra ${id} cancelada`)
  }

  // 2) Recepcion de material contra una orden de compra (admite recepciones parciales): aqui si entra stock
  const receivePurchase = (id: string, received: Record<number, number>) => {
    const po = purchases.find((p) => p.id === id)
    if (!po || po.status === 'Cancelada' || po.status === 'Recibida') { notify('Esta orden de compra no admite más recepciones'); return false }
    const got = po.lines.map((_, i) => { const q = Number(received[i]); return Number.isFinite(q) && q > 0 ? q : 0 })
    const entries: { code: string; qty: number; cost: number; ref: string }[] = []
    for (let i = 0; i < po.lines.length; i++) {
      if (!got[i]) continue
      const line = po.lines[i]
      const pending = line.qty - line.received
      if (got[i] > pending + 1e-9) { notify(`De ${line.code} solo quedan ${num(pending)} por recibir`); return false }
      entries.push({ code: line.code, qty: got[i], cost: line.cost, ref: po.id })
    }
    if (!applyEntries(entries)) return false
    const newLines = po.lines.map((l, i) => ({ ...l, received: l.received + got[i] }))
    const complete = newLines.every((l) => l.received >= l.qty - 1e-9)
    setPurchases((current) => current.map((p) => p.id === id ? { ...p, lines: newLines, status: (complete ? 'Recibida' : 'Recibida parcial') as PurchaseStatus } : p))
    notify(complete ? `Orden ${id} recibida completa: stock actualizado` : `Recepción parcial de ${id}: queda material pendiente`)
    return true
  }

  // 5) Despacho o venta de producto terminado: descuenta el stock de producto terminado y deja el movimiento
  const createSale = (kind: 'Venta' | 'Despacho', customer: string, saleLines: { product: string; qty: number; price: number }[]) => {
    if (!customer) { notify('Selecciona un cliente'); return false }
    const clean = saleLines.filter((l) => l.product && l.qty > 0)
    if (!clean.length) { notify('Agrega al menos un producto con cantidad'); return false }
    if (kind === 'Venta' && clean.some((l) => !(l.price > 0))) { notify('Indica el precio de cada producto'); return false }
    const totals: Record<string, number> = {}
    clean.forEach((l) => { totals[l.product] = (totals[l.product] ?? 0) + l.qty })
    const lacking = Object.keys(totals).find((name) => (productStock[name] ?? 0) < totals[name])
    if (lacking) { notify(`Stock insuficiente de ${lacking}: hay ${num(productStock[lacking] ?? 0, 0)} und y pides ${num(totals[lacking], 0)}. Finaliza una orden de producción.`); return false }
    const stamp = now()
    const id = nextDoc(kind === 'Venta' ? 'VT' : 'DS', sales.length)
    const finalLines = clean.map((l) => ({ ...l, price: kind === 'Venta' ? l.price : 0 }))
    const total = sum(finalLines.map((l) => l.qty * l.price))
    const moves: Movement[] = finalLines.map((l, i) => ({ id: Date.now() + i, date: stamp, type: kind, code: productInfo(records, l.product).code, material: l.product, qty: l.qty, unit: 'und', total: l.qty * l.price, ref: id }))
    setProductStock((current) => { const next = { ...current }; Object.keys(totals).forEach((name) => { next[name] = (next[name] ?? 0) - totals[name] }); return next })
    setMovements((current) => [...[...moves].reverse(), ...current])
    setSales((current) => [{ id, kind, customer, date: stamp, lines: finalLines, total }, ...current])
    notify(`${kind} ${id} registrado: stock de producto terminado actualizado`)
    return true
  }

  const applyBillingInventory = (lines: { product: string; qty: number; price: number }[], reference: string, direction: 'sale' | 'return') => {
    if (!lines.length || lines.some((line) => !line.product || !(line.qty > 0) || !Number.isFinite(line.price) || line.price < 0)) {
      notify('Las líneas del documento de facturación no son válidas')
      return false
    }
    const quantities: Record<string, number> = {}
    lines.forEach((line) => { quantities[line.product] = (quantities[line.product] ?? 0) + line.qty })
    if (direction === 'sale') {
      const lacking = Object.keys(quantities).find((name) => (productStock[name] ?? 0) < quantities[name])
      if (lacking) {
        notify(`Stock insuficiente de ${lacking}: hay ${num(productStock[lacking] ?? 0, 0)} und y la factura requiere ${num(quantities[lacking], 0)}.`)
        return false
      }
    }
    const stamp = now()
    const movementType = direction === 'sale' ? 'Venta' : 'Devolución'
    const movementsToAdd: Movement[] = lines.map((line, index) => ({
      id: Date.now() + index,
      date: stamp,
      type: movementType,
      code: productInfo(records, line.product).code,
      material: line.product,
      qty: line.qty,
      unit: 'und',
      total: line.qty * line.price,
      ref: reference,
    }))
    setProductStock((current) => {
      const next = { ...current }
      Object.entries(quantities).forEach(([name, qty]) => {
        next[name] = (next[name] ?? 0) + (direction === 'sale' ? -qty : qty)
      })
      return next
    })
    setMovements((current) => [...movementsToAdd.reverse(), ...current])
    return true
  }

  // Finalizar orden: descuenta insumos segun la receta, suma el producto terminado al inventario y registra los movimientos
  const finalizeOrder = (order: Order, produced: number, minutes: number) => {
    const { product, lines, needs } = getNeeds(order, records, materials)
    const missing = needs.find((n) => !n.m)
    if (missing) { notify(`La receta usa ${missing.line.code}, que no existe en Materias primas`); return false }
    const short = needs.find((n) => (n.m?.stock ?? 0) < n.need)
    if (short && short.m) { notify(`Stock insuficiente de ${short.m.name}: hay ${num(short.m.stock)} y se necesitan ${num(short.need)} ${short.m.unit}. Registra una compra y su recepcion.`); return false }
    const stamp = now()
    const moves: Movement[] = needs.map((n, i) => ({ id: Date.now() + i, date: stamp, type: 'Consumo' as const, code: n.line.code, material: n.m?.name ?? n.line.code, qty: n.need, unit: n.m?.unit ?? '', total: n.need * (n.m?.cost ?? 0), ref: order.id }))
    const cost = sum(moves.map((m) => m.total))
    const productName = product?.name ?? order.product
    if (produced > 0) moves.push({ id: Date.now() + moves.length, date: stamp, type: 'Producción', code: product?.code ?? productName, material: productName, qty: produced, unit: 'und', total: cost, ref: order.id })
    setMaterials((current) => current.map((m) => { const n = needs.find((x) => x.line.code === m.code); return n ? { ...m, stock: m.stock - n.need } : m }))
    if (produced > 0) {
      if (qcRequired[productName]) setQc((current) => ({ ...current, [productName]: { pending: (current[productName]?.pending ?? 0) + produced, rework: current[productName]?.rework ?? 0 } }))
      else setProductStock((current) => ({ ...current, [productName]: (current[productName] ?? 0) + produced }))
    }
    setMovements((current) => [...[...moves].reverse(), ...current])
    setOrders((current) => current.map((o) => o.id === order.id ? { ...o, status: 'Finalizada' as OrderStatus, produced, minutes, finishedAt: stamp, cost: lines.length ? cost : undefined } : o))
    notify(lines.length ? `Orden ${order.id} finalizada: insumos consumidos y ${num(produced, 0)} und agregadas ${qcRequired[productName] ? 'a Pendiente de liberación (Calidad y liberación)' : 'al inventario disponible'}` : `Orden ${order.id} finalizada (la receta no tiene ingredientes: no se descontó inventario)`)
    return true
  }

  // Calidad: liberacion, retrabajo, retorno de retrabajo y scrap de producto terminado
  const qcAction = (action: QcAction, product: string, qty: number, reason: string, source: 'pending' | 'rework' | 'available') => {
    if (!product) { notify('Selecciona un producto'); return false }
    if (!(qty > 0)) { notify('La cantidad debe ser mayor que cero'); return false }
    if ((action === 'Retrabajo' || action === 'Scrap') && !reason.trim()) { notify('Indica el motivo'); return false }
    const b = qc[product] ?? { pending: 0, rework: 0 }
    const avail = productStock[product] ?? 0
    const from = action === 'Liberación' || action === 'Retrabajo' ? 'pending' : action === 'Retorno retrabajo' ? 'rework' : source
    const have = from === 'pending' ? b.pending : from === 'rework' ? b.rework : avail
    if (qty > have + 1e-9) { notify(`Solo hay ${num(have, 0)} und de ${product} en "${qcLabel[from]}"`); return false }
    const next = { ...b }
    let nextAvail = avail
    if (from === 'pending') next.pending -= qty; else if (from === 'rework') next.rework -= qty; else nextAvail -= qty
    if (action === 'Liberación') nextAvail += qty
    else if (action === 'Retrabajo') next.rework += qty
    else if (action === 'Retorno retrabajo') next.pending += qty
    const value = action === 'Scrap' ? qty * unitCostOf(orders, product) : 0
    const id = nextDoc('QC', qcLog.length)
    const stamp = now()
    setQc((current) => ({ ...current, [product]: next }))
    setProductStock((current) => ({ ...current, [product]: nextAvail }))
    setMovements((current) => [{ id: Date.now(), date: stamp, type: action, code: productInfo(records, product).code, material: product, qty, unit: 'und', total: value, ref: id }, ...current])
    setQcLog((current) => [{ id, date: stamp, product, action, qty, from: qcLabel[from], reason: reason.trim(), value }, ...current])
    notify(`Calidad ${id}: ${action} de ${num(qty, 0)} und de ${product}`)
    return true
  }

  const nav = selectPage
  const page = () => {
    switch (active) {
      case 'Dashboard': return <Dashboard orders={orders} records={records} extra={materials.length} openPurchases={purchases.filter((p) => p.status === 'Pendiente' || p.status === 'Recibida parcial').length} salesCount={sales.length} onNew={() => selectPage('Órdenes de producción')} onReset={resetAll} onDemo={loadDemo} />
      case 'Órdenes de producción': return <OrdersPage orders={orders} onNew={() => openModal('Órdenes de producción')} updateOrder={updateOrder} onFinalize={setFinalizing} />
      case 'Disponibilidad de materiales': return <AvailabilityPage orders={orders} records={records} materials={materials} onBuy={(draft) => { setPurchaseDraft(draft); selectPage('Órdenes de compra') }} />
      case 'Órdenes de compra': return <PurchasesPage purchases={purchases} suppliers={(records.Proveedores ?? []).map((s) => s.name)} materials={materials} draft={purchaseDraft} clearDraft={() => setPurchaseDraft(null)} onCreate={createPurchase} onCancel={cancelPurchase} onGoReceive={() => nav('Recepción de material')} />
      case 'Recepción de material': return <ReceptionPage purchases={purchases} materials={materials} movements={movements} onReceive={receivePurchase} />
      case 'Salidas': return <SalesPage sales={sales} customers={(records.Clientes ?? []).map((c) => c.name)} products={productNames.map((name) => ({ name, price: productInfo(records, name).price }))} stock={productStock} onCreate={createSale} />
      case 'Cotizaciones':
      case 'Facturación':
      case 'Registro de pagos':
      case 'Devoluciones y notas de crédito':
        return <BillingModule section={active} customers={(records.Clientes ?? []).map((customer) => customer.name)} products={productNames.map((name) => ({ name, code: productInfo(records, name).code, price: productInfo(records, name).price }))} stock={productStock} data={billing} onDataChange={setBilling} onInventoryChange={applyBillingInventory} onNotice={notify} />
      case 'Calidad y liberación': return <QualityPage products={Array.from(new Set([...productNames, ...Object.keys(productStock), ...Object.keys(qc)]))} qc={qc} stock={productStock} required={qcRequired} log={qcLog} onToggle={(name) => setQcRequired((current) => ({ ...current, [name]: !current[name] }))} onAction={qcAction} />
      case 'Materias primas': return <><Head eyebrow="Módulo operativo" title="Materias primas" subtitle="Catálogo de insumos. El stock y el costo se actualizan con las Entradas."><button className="primary-button" onClick={() => openModal('Materias primas')}><Plus />Nuevo registro</button></Head><section className="panel module-panel">{materials.length ? <div className="table-scroll"><table><thead><tr><th>Código</th><th>Nombre</th><th>Unidad</th><th>Stock</th><th>Costo promedio</th><th>Acciones</th></tr></thead><tbody>{materials.map((m) => <tr key={m.id}><td>{m.code}</td><td>{m.name}</td><td>{m.unit}</td><td>{num(m.stock)}</td><td>{money(m.cost)}</td><td className="row-actions"><button className="icon-button" aria-label={`Editar ${m.name}`} onClick={() => editMaterial(m)}><Edit3 /></button><button className="icon-button danger" aria-label={`Eliminar ${m.name}`} onClick={() => removeMaterial(m.id)}><Trash2 /></button></td></tr>)}</tbody></table></div> : <div className="empty-state"><AlertTriangle />No hay registros para mostrar.</div>}</section></>
      case 'Existencias': return <><Head eyebrow="Inventario" title="Existencias" subtitle="Stock actual y valor del inventario de materias primas y de producto terminado." /><Table head={['Código', 'Materia prima', 'Stock', 'Costo promedio', 'Valor']} rows={[...materials.map((m) => [m.code, m.name, `${num(m.stock)} ${m.unit}`, money(m.cost), money(m.stock * m.cost)]), ...(materials.length ? [['', 'TOTAL', '', '', money(sum(materials.map((m) => m.stock * m.cost)))]] : [])]} /><section className="panel module-panel"><div className="panel-heading"><div><h2>Producto terminado</h2><p>Unidades disponibles para venta o despacho.</p></div></div></section><Table head={['Producto', 'Disponible (liberado)', 'Pendiente de liberación', 'En retrabajo']} rows={finishedRows} empty="Aún no hay producto terminado: finaliza una orden de producción." /></>
      case 'Entradas': return <EntryPage materials={materials} movements={movements} onAdd={addEntry} />
      case 'Movimientos': return <MovementsPage movements={movements} />
      case 'Consumo de materias primas': return <><Head eyebrow="Producción" title="Consumo de materias primas" subtitle="Insumos descontados al finalizar cada orden, según la receta." /><Table head={['Fecha', 'Orden', 'Materia prima', 'Cantidad consumida', 'Costo']} rows={movements.filter((m) => m.type === 'Consumo').map((m) => [m.date, m.ref, m.material, `${num(m.qty)} ${m.unit}`, money(m.total)])} empty="Aún no hay consumo: finaliza una orden con receta." /></>
      case 'Seguimiento de operaciones': return <><Head eyebrow="Producción" title="Seguimiento de operaciones" subtitle="Inicio, fin y tiempo real de cada orden." /><Table head={['Orden', 'Producto', 'Estado', 'Inicio', 'Fin', 'Tiempo real (min)']} rows={orders.map((o) => [o.id, o.product, o.status, o.startedAt ?? '—', o.finishedAt ?? '—', o.minutes ?? '—'])} /></>
      case 'Productos terminados': return <><Head eyebrow="Producción" title="Productos terminados" subtitle="Stock disponible y unidades producidas por orden finalizada." /><Table head={['Producto', 'Disponible (liberado)', 'Pendiente de liberación', 'En retrabajo']} rows={finishedRows} empty="Aún no hay producto terminado." /><Table head={['Orden', 'Producto', 'Planificado', 'Producido', 'Yield', 'Fecha de fin']} rows={orders.filter((o) => o.status === 'Finalizada').map((o) => [o.id, o.product, `${o.qty} und`, `${o.produced} und`, o.qty ? pct(o.produced / o.qty) : '—', o.finishedAt ?? '—'])} empty="Aún no hay órdenes finalizadas." /></>
      case 'Reportes de gestión': return <ReportsPage orders={orders} materials={materials} qcLog={qcLog} />
      case 'Usuarios y roles': return <UsersPage currentUserId={String(currentUser.id)} items={visible} search={search} setSearch={setSearch} onNew={() => openModal('Usuarios y roles')} onEdit={(item) => openModal('Usuarios y roles', item)} onDelete={removeUser} onSelect={setDetail} onUpdateStatus={updateRegistrationStatus} />
      case 'Mi cuenta': return <ProfilePage user={currentUser} onSave={saveProfile} />
      default: return <ModulePage title={active} items={visible} search={search} setSearch={setSearch} onNew={() => fields[active] ? openModal(active) : notify('Módulo informativo listo para operar')} onEdit={(item) => openModal(active, item)} onDelete={(id) => active === 'Usuarios y roles' ? removeUser(id) : remove(active, id)} onSelect={setDetail} />
    }
  }
  return <div className="erp-shell">
    <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`} id="erp-sidebar">
      <div className="brand"><div className="brand-mark"><span>H</span></div><div><strong>Repostería Heydi</strong><small>SISTEMA ERP DE PRODUCCIÓN</small></div><button type="button" className="icon-button mobile-close" aria-label="Cerrar menú" onClick={() => setSidebarOpen(false)}><X /></button></div>
      <nav aria-label="Navegación principal">
        {groups.map((group, index) => {
          const isExpanded = expandedGroup === group.label
          const itemsId = `nav-items-${index}`
          const visibleItems = group.items.filter(([label]) => (isAdmin || label !== 'Usuarios y roles') && (!isAdmin || label !== 'Mi cuenta'))
          if (!visibleItems.length) return null
          return <div className="nav-group" key={group.label}>
            <button type="button" className="nav-label" aria-expanded={isExpanded} aria-controls={itemsId} onClick={() => setExpandedGroup(isExpanded ? '' : group.label)}>
              <span>{group.label}</span>
              <ChevronDown className="nav-chevron" aria-hidden="true" />
            </button>
            <div className="nav-items" id={itemsId} hidden={!isExpanded}>
              {visibleItems.map(([label, Icon]) => <button className={`nav-item ${active === label ? 'active' : ''}`} key={label as string} onClick={() => nav(label as string)}><Icon /><span>{label as string}</span></button>)}
            </div>
          </div>
        })}
      </nav>
      <div className="sidebar-bottom"><div className="user-card"><div className="avatar">{userInitials(currentUser.fullName)}</div><div><strong>{currentUser.fullName}</strong><small>{currentUser.role === 'administrador' ? 'Administrador' : 'Usuario'} · {currentUser.username}</small></div></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><button type="button" className="icon-button menu-trigger" aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'} aria-controls="erp-sidebar" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((open) => !open)}><Menu /></button><div className="breadcrumbs"><span>Sistema ERP de Producción</span><b>/</b><strong>{active}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Buscar"><Search /></button><button className="icon-button" aria-label="Notificaciones" onClick={() => nav('Existencias')}><Bell /></button><div className="top-avatar" title={`${currentUser.fullName} · ${currentUser.role}`}>{userInitials(currentUser.fullName)}</div><span className="top-user-name">{currentUser.fullName}</span>{logoutButton}</div></header>
      <div className="content-wrap">
        {notice && <div className="toast-message"><CheckCircle2 />{notice}</div>}
        {!loaded
          ? <section className="panel module-panel"><p className="eyebrow">Conectando</p><h1>Cargando datos del ERP...</h1></section>
          : workspaceError
            ? <section className="panel module-panel" role="alert"><p className="eyebrow">Error de conexión</p><h1>No se pudieron sincronizar los datos</h1><p className="subtitle">{workspaceError}</p><button className="primary-button" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>Recargar datos del servidor</button></section>
            : page()}
      </div>
      <footer className="footer"><span>© 2024 Repostería Heydi</span><span>v1.0.0 · Managua, Nicaragua</span></footer>
    </main>
    {modal && <Modal module={modal.module} materials={materials} productNames={productNames} fields={moduleFields} form={form} setForm={setForm} onClose={() => setModal(null)} onSave={save} />}
    {detail && <DetailModal item={detail} onClose={() => setDetail(null)} />}
    {finalizing && <FinalizeModal order={finalizing} onClose={() => setFinalizing(null)} onConfirm={(produced, minutes) => finalizeOrder(finalizing, produced, minutes)} />}
  </div>
}

function Dashboard({ orders, records, extra, openPurchases, salesCount, onNew, onReset, onDemo }: { orders: Order[]; records: Record<string, RecordItem[]>; extra: number; openPurchases: number; salesCount: number; onNew: () => void; onReset: () => void; onDemo: () => void }) { const total = Object.values(records).reduce((sum, list) => sum + list.length, 0) + extra; return <><section className="page-heading"><div><p className="eyebrow">Panel principal</p><h1>Bienvenido!</h1><p className="subtitle">Resumen operativo de tu panadería para hoy.</p></div><button className="primary-button" onClick={onNew}><Plus />Nueva orden de producción</button></section><section className="metric-grid">{[['Registros maestros', total], ['Órdenes pendientes', orders.filter((o) => o.status === 'Pendiente').length], ['En proceso', orders.filter((o) => o.status === 'En proceso').length], ['Finalizadas', orders.filter((o) => o.status === 'Finalizada').length], ['Compras por recibir', openPurchases], ['Ventas y despachos', salesCount]].map(([label, value]) => <article className="metric-card" key={String(label)}><div className="metric-icon package"><Package /></div><div className="metric-copy"><p>{label}</p><strong>{value}</strong><small>Actualizado ahora</small></div></article>)}</section><section className="panel module-panel"><div className="panel-heading"><div><h2>Accesos rápidos</h2><p>Gestiona tus catálogos y operaciones.</p></div></div><div className="quick-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}><button className="primary-button" onClick={() => onNew()}><Plus />Crear orden</button><button className="outline-button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Ver actividad</button><button className="outline-button" onClick={onDemo}><Download />Cargar datos de ejemplo</button><button className="outline-button" onClick={onReset}><Trash2 />Restablecer datos</button></div></section></> }

function ModulePage({ title, items, search, setSearch, onNew, onEdit, onDelete, onSelect }: { title: string; items: RecordItem[]; search: string; setSearch: (value: string) => void; onNew: () => void; onEdit: (item: RecordItem) => void; onDelete: (id: string) => void; onSelect: (item: RecordItem) => void }) { const canCreate = Boolean(fields[title]); return <><section className="page-heading"><div><p className="eyebrow">Módulo operativo</p><h1>{title}</h1><p className="subtitle">Administra información y relaciones del módulo.</p></div>{canCreate && <button className="primary-button" onClick={onNew}><Plus />Nuevo {title === 'Productos' ? 'producto' : 'registro'}</button>}</section><section className="panel module-panel"><div className="module-toolbar"><div className="search-box"><Search /><input aria-label={`Buscar en ${title}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, código..." /></div><button className="outline-button" onClick={() => setSearch('')}>Limpiar</button></div><div className="record-list">{items.length ? items.map((item) => <div className="record-row" key={item.id}><button className="record-main record-link" onClick={() => onSelect(item)}><div className="record-icon"><Package /></div><span><strong>{item.name}</strong><small>{item.code ?? item.id} · {item.detail}</small></span></button><Badge status={item.status} /><button className="icon-button" aria-label={`Editar ${item.name}`} onClick={() => onEdit(item)}><Edit3 /></button><button className="icon-button danger" aria-label={`Eliminar ${item.name}`} onClick={() => onDelete(item.id)}><Trash2 /></button></div>) : <div className="empty-state"><AlertTriangle />No hay registros para mostrar.</div>}</div></section></> }

function UsersPage({ currentUserId, items, search, setSearch, onNew, onEdit, onDelete, onSelect, onUpdateStatus }: { currentUserId: string; items: RecordItem[]; search: string; setSearch: (value: string) => void; onNew: () => void; onEdit: (item: RecordItem) => void; onDelete: (id: string) => void; onSelect: (item: RecordItem) => void; onUpdateStatus: (id: string, status: 'approved' | 'rejected') => void }) {
  return <>
    <Head eyebrow="Administración" title="Usuarios" subtitle="Revisa solicitudes de registro y administra quién puede acceder al ERP.">
      <button className="primary-button" onClick={onNew}><Plus />Crear usuario</button>
    </Head>
    <section className="panel module-panel">
      <div className="module-toolbar">
        <div className="search-box"><Search /><input aria-label="Buscar usuarios" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, usuario o correo..." /></div>
        <button className="outline-button" onClick={() => setSearch('')}>Limpiar</button>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Nombre</th><th>Usuario</th><th>Correo</th><th>Teléfono</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {items.map((item) => {
              const status = item.data?.status ?? 'approved'
              const isProtected = item.id === currentUserId || item.data?.role === 'administrador'
              return <tr key={item.id}>
                <td><button className="text-button" onClick={() => onSelect(item)}>{item.name}</button></td>
                <td>{item.data?.username ?? '—'}</td>
                <td>{item.data?.email ?? '—'}</td>
                <td>{item.data?.phone || '—'}</td>
                <td>{item.data?.role ?? 'usuario'}</td>
                <td><Badge status={status} /></td>
                <td className="row-actions">
                  {!isProtected && status !== 'approved' && <button className="small-action" onClick={() => onUpdateStatus(item.id, 'approved')}>Aprobar</button>}
                  {!isProtected && status === 'pending' && <button className="small-action muted" onClick={() => onUpdateStatus(item.id, 'rejected')}>Rechazar</button>}
                  {!isProtected && <button className="icon-button" aria-label={`Editar ${item.name}`} onClick={() => onEdit(item)}><Edit3 /></button>}
                  {!isProtected && <button className="icon-button danger" aria-label={`Eliminar ${item.name}`} onClick={() => onDelete(item.id)}><Trash2 /></button>}
                  {isProtected && <span className="protected-user-label">{item.id === currentUserId ? 'Sesión actual' : 'Administrador protegido'}</span>}
                </td>
              </tr>
            })}
            {!items.length && <tr><td colSpan={7}><div className="empty-state"><AlertTriangle />No hay usuarios para mostrar.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </>
}

function ProfilePage({ user, onSave }: {
  user: { fullName: string; username: string; email: string; phone: string }
  onSave: (updates: { fullName: string; username: string; email: string; phone: string; currentPassword: string; newPassword?: string }) => Promise<boolean>
}) {
  const [form, setForm] = useState({ ...user, currentPassword: '', newPassword: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm((current) => ({ ...current, ...user, currentPassword: '', newPassword: '', confirmPassword: '' }))
  }, [user])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!form.currentPassword) {
      setError('Ingresa tu contraseña actual para guardar los cambios.')
      return
    }
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setError('La nueva contraseña y su confirmación no coinciden.')
      return
    }
    if (form.newPassword && form.newPassword.length < 12) {
      setError('La nueva contraseña debe tener al menos 12 caracteres.')
      return
    }

    setSaving(true)
    try {
      const saved = await onSave({
        fullName: form.fullName,
        username: form.username,
        email: form.email,
        phone: form.phone,
        currentPassword: form.currentPassword,
        ...(form.newPassword ? { newPassword: form.newPassword } : {}),
      })
      if (saved) setForm((current) => ({ ...current, currentPassword: '', newPassword: '', confirmPassword: '' }))
    } finally {
      setSaving(false)
    }
  }

  return <>
    <Head eyebrow="Cuenta personal" title="Mi cuenta" subtitle="Actualiza tus datos y contraseña. Se te pedirá la contraseña actual para confirmar los cambios." />
    <form className="panel module-panel profile-form" onSubmit={submit}>
      <div className="form-grid">
        <label>Nombre completo<input required minLength={2} maxLength={100} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
        <label>Nombre de usuario<input required minLength={3} maxLength={32} pattern="[a-zA-Z0-9._-]{3,32}" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
        <label>Correo electrónico<input required type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>Teléfono<input maxLength={40} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
      </div>
      <h2>Cambiar contraseña</h2>
      <p className="profile-hint">Deja estos campos vacíos si no deseas cambiarla. Debe tener al menos 12 caracteres.</p>
      <div className="form-grid">
        <label>Contraseña actual<input required type="password" autoComplete="current-password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} /></label>
        <label>Nueva contraseña<input type="password" autoComplete="new-password" minLength={12} value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} /></label>
        <label>Confirmar nueva contraseña<input type="password" autoComplete="new-password" minLength={12} value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label>
      </div>
      {error && <p className="login-error profile-error" role="alert">{error}</p>}
      <div className="modal-actions"><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button></div>
    </form>
  </>
}

function OrdersPage({ orders, onNew, updateOrder, onFinalize }: { orders: Order[]; onNew: () => void; updateOrder: (id: string, status: OrderStatus) => void; onFinalize: (order: Order) => void }) { return <><section className="page-heading"><div><p className="eyebrow">Producción</p><h1>Órdenes de producción</h1><p className="subtitle">Inicia, finaliza o cancela órdenes.</p></div><button className="primary-button" onClick={onNew}><Plus />Nueva orden</button></section><section className="order-cards">{(['Pendiente', 'En proceso', 'Finalizada', 'Cancelada'] as OrderStatus[]).map((status) => <div className="mini-stat" key={status}><span>{status}</span><strong>{orders.filter((o) => o.status === status).length}</strong></div>)}</section><section className="panel module-panel"><div className="table-scroll"><table><thead><tr><th>Orden</th><th>Producto</th><th>Planificado</th><th>Producido</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td>{order.id}</td><td>{order.product}</td><td>{order.qty} und</td><td>{order.produced} und</td><td><Badge status={order.status} /></td><td className="row-actions">{order.status === 'Pendiente' && <button className="small-action" onClick={() => updateOrder(order.id, 'En proceso')}>Iniciar</button>}{order.status === 'En proceso' && <button className="small-action" onClick={() => onFinalize(order)}>Finalizar</button>}{!['Finalizada', 'Cancelada'].includes(order.status) && <button className="small-action muted" onClick={() => updateOrder(order.id, 'Cancelada')}><Pause />Cancelar</button>}</td></tr>)}</tbody></table></div></section></> }


function EntryPage({ materials, movements, onAdd }: { materials: Material[]; movements: Movement[]; onAdd: (code: string, qty: number, unitCost: number, ref: string) => boolean }) {
  const [code, setCode] = useState(''); const [qty, setQty] = useState(''); const [cost, setCost] = useState(''); const [ref, setRef] = useState('')
  const submit = () => { if (onAdd(code, Number(qty), Number(cost), ref)) { setQty(''); setCost(''); setRef('') } }
  return <><Head eyebrow="Inventario" title="Entradas" subtitle="Entrada directa de materias primas, sin orden de compra. Para compras formales usa Órdenes de compra y Recepción de material." /><section className="panel module-panel"><div className="form-grid"><label>Materia prima<select value={code} onChange={(event) => setCode(event.target.value)}><option value="">Selecciona...</option>{materials.map((m) => <option key={m.code} value={m.code}>{m.name} ({m.unit})</option>)}</select></label><label>Cantidad recibida<input type="number" min="0" value={qty} onChange={(event) => setQty(event.target.value)} /></label><label>Costo unitario de compra (C$)<input type="number" min="0" value={cost} onChange={(event) => setCost(event.target.value)} /></label><label>Referencia (factura, proveedor)<input value={ref} onChange={(event) => setRef(event.target.value)} /></label></div><div className="modal-actions"><button className="primary-button" onClick={submit}><Plus />Registrar entrada</button></div></section><Table head={['Fecha', 'Materia prima', 'Cantidad', 'Valor', 'Referencia']} rows={movements.filter((m) => m.type === 'Entrada').map((m) => [m.date, m.material, `${num(m.qty)} ${m.unit}`, money(m.total), m.ref])} empty="Aún no hay entradas registradas." /></>
}

function ReportsPage({ orders, materials, qcLog }: { orders: Order[]; materials: Material[]; qcLog: QcRecord[] }) {
  const done = orders.filter((o) => o.status === 'Finalizada')
  const planned = sum(done.map((o) => o.qty)); const produced = sum(done.map((o) => o.produced))
  const yieldValue = planned ? produced / planned : 0
  const costed = done.filter((o) => (o.cost ?? 0) > 0)
  const costTotal = sum(costed.map((o) => o.cost ?? 0)); const costedUnits = sum(costed.map((o) => o.produced))
  const unitCost = costedUnits ? costTotal / costedUnits : 0
  const timed = done.filter((o) => (o.minutes ?? 0) > 0)
  const avgCycle = timed.length ? sum(timed.map((o) => o.minutes ?? 0)) / timed.length : 0
  const stockValue = sum(materials.map((m) => m.stock * m.cost))
  const cards = [['Yield (rendimiento)', pct(yieldValue), `${produced} producidas de ${planned} planificadas`], ['Costo unitario', money(unitCost), 'Costo de insumos ÷ unidades producidas'], ['Tiempo de ciclo', `${num(avgCycle, 1)} min`, 'Promedio por orden finalizada'], ['Merma', `${planned - produced} und`, 'Planificadas − producidas'], ['Consumo de insumos', money(costTotal), 'Costo total consumido en producción'], ['Valor del inventario', money(stockValue), 'Existencias × costo promedio'], ['Scrap', `${num(sum(qcLog.filter((r) => r.action === 'Scrap').map((r) => r.qty)), 0)} und`, `Pérdida: ${money(sum(qcLog.filter((r) => r.action === 'Scrap').map((r) => r.value)))}`], ['Retrabajo', `${num(sum(qcLog.filter((r) => r.action === 'Retrabajo').map((r) => r.qty)), 0)} und`, 'Unidades enviadas a retrabajo']]
  const rows = done.map((o) => [o.id, o.product, o.qty, o.produced, o.qty ? pct(o.produced / o.qty) : '—', money(o.cost ?? 0), o.produced && o.cost ? money(o.cost / o.produced) : '—', o.minutes ?? '—'])
  const exportCsv = () => {
    const lines = [['Orden', 'Producto', 'Planificado', 'Producido', 'Yield', 'Costo insumos (C$)', 'Costo unitario (C$)', 'Minutos'], ...done.map((o) => [o.id, o.product, o.qty, o.produced, o.qty ? (o.produced / o.qty).toFixed(4) : '', (o.cost ?? 0).toFixed(2), o.produced && o.cost ? (o.cost / o.produced).toFixed(2) : '', o.minutes ?? ''])]
    const blob = new Blob(['\ufeff' + lines.map((l) => l.join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'kpis-erp-heydi.csv'; a.click(); URL.revokeObjectURL(url)
  }
  return <><Head eyebrow="Reportes" title="Reportes de gestión" subtitle="Indicadores calculados con los datos del ERP: órdenes, consumo e inventario."><button className="outline-button" onClick={exportCsv}><Download />Exportar CSV</button></Head><section className="metric-grid">{cards.map(([label, value, hint]) => <article className="metric-card" key={label}><div className="metric-icon package"><Package /></div><div className="metric-copy"><p>{label}</p><strong>{value}</strong><small>{hint}</small></div></article>)}</section><Table head={['Orden', 'Producto', 'Planificado', 'Producido', 'Yield', 'Costo insumos', 'Costo unitario', 'Minutos']} rows={rows} empty="Finaliza al menos una orden para calcular los indicadores." /><section className="panel module-panel"><div className="panel-heading"><div><h2>Fórmulas</h2><p>Yield = producidas ÷ planificadas · Costo unitario = costo de insumos consumidos ÷ unidades producidas · Tiempo de ciclo = promedio de minutos reales por orden · Merma = planificadas − producidas.</p></div></div></section></>
}

function FinalizeModal({ order, onClose, onConfirm }: { order: Order; onClose: () => void; onConfirm: (produced: number, minutes: number) => boolean }) {
  const [produced, setProduced] = useState(String(order.qty)); const [minutes, setMinutes] = useState('')
  const valid = produced !== '' && Number(produced) >= 0 && Number(minutes) > 0
  return <div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true"><div className="modal-heading"><div><p className="eyebrow">Finalizar orden</p><h2>{order.id} · {order.product}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X /></button></div><div className="form-grid"><label>Unidades producidas reales (planificado: {order.qty})<input type="number" min="0" value={produced} onChange={(event) => setProduced(event.target.value)} /></label><label>Tiempo real de producción (minutos)<input type="number" min="1" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label></div><div className="modal-actions"><button className="outline-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!valid} onClick={() => { if (onConfirm(Number(produced), Number(minutes))) onClose() }}><CheckCircle2 />Confirmar y descontar insumos</button></div></section></div>
}

function IngredientsEditor({ label, units, value, materials, onChange }: { label: string; units?: string; value: string; materials: Material[]; onChange: (value: string) => void }) {
  const [rows, setRows] = useState<{ code: string; qty: string }[]>(() => { const initialRows = parseIngredients(value).map((i) => ({ code: i.code, qty: String(i.qty) })); return initialRows.length ? initialRows : [{ code: '', qty: '' }] })
  const update = (next: { code: string; qty: string }[]) => { setRows(next); onChange(next.filter((r) => r.code && Number(r.qty) > 0).map((r) => `${r.code}=${r.qty}`).join('\n')) }
  const box = { width: '100%', minHeight: 40, padding: '0 10px', borderRadius: 8, border: '1px solid #d9c9b8', background: '#fff', fontSize: 14 } as const
  return <div style={{ display: 'grid', gap: 8 }}><strong style={{ fontSize: 13 }}>{label}{units ? ` · lote de ${units} unidades` : ''}</strong>{rows.map((row, index) => { const material = materials.find((m) => m.code === row.code); return <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto auto', gap: 8, alignItems: 'center' }}><select style={box} value={row.code} onChange={(event) => update(rows.map((r, i) => i === index ? { ...r, code: event.target.value } : r))}><option value="">Selecciona el insumo...</option>{materials.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}{row.code && !material && <option value={row.code}>{row.code}</option>}</select><input style={box} type="number" min="0" step="any" placeholder="Cantidad" value={row.qty} onChange={(event) => update(rows.map((r, i) => i === index ? { ...r, qty: event.target.value } : r))} /><span style={{ fontSize: 13, minWidth: 48 }}>{material?.unit ?? ''}</span><button type="button" className="icon-button danger" aria-label="Quitar ingrediente" onClick={() => update(rows.length > 1 ? rows.filter((_, i) => i !== index) : [{ code: '', qty: '' }])}><Trash2 /></button></div> })}<div><button type="button" className="outline-button" onClick={() => update([...rows, { code: '', qty: '' }])}><Plus />Agregar ingrediente</button></div></div>
}

function Modal({ module, materials, productNames, fields: moduleFields, form, setForm, onClose, onSave }: { module: string; materials: Material[]; productNames: string[]; fields: Field[]; form: Record<string, string>; setForm: (form: Record<string, string>) => void; onClose: () => void; onSave: () => void }) { return <div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true"><div className="modal-heading"><div><p className="eyebrow">Formulario de {module}</p><h2>{form.name ? `Editar ${module}` : `Nuevo registro de ${module}`}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X /></button></div><div className="form-grid">{moduleFields.map((field) => field.type === 'ingredients' ? <div key={field.key} style={{ gridColumn: '1 / -1' }}><IngredientsEditor label={field.label} units={form.bomUnits} value={form[field.key] ?? ''} materials={materials} onChange={(value) => setForm({ ...form, [field.key]: value })} /></div> : <label key={field.key}>{field.label}{module === 'Usuarios y roles' && field.key === 'role' ? <select required value={form.role ?? ''} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="">Selecciona...</option><option value="usuario">usuario</option><option value="administrador">administrador</option></select> : field.type === 'product' ? <select required={field.required} value={form[field.key] ?? ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}><option value="">Selecciona...</option>{productNames.map((name) => <option key={name} value={name}>{name}</option>)}{form[field.key] && !productNames.includes(form[field.key]) && <option value={form[field.key]}>{form[field.key]}</option>}</select> : field.type === 'textarea' ? <textarea required={field.required} value={form[field.key] ?? ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} /> : <input required={field.required && !(module === 'Usuarios y roles' && field.key === 'password' && Boolean(form.username))} type={field.type ?? 'text'} minLength={field.type === 'password' ? 12 : undefined} value={form[field.key] ?? ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} />}</label>)}</div><div className="modal-actions"><button className="outline-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={onSave}><CheckCircle2 />Guardar registro</button></div></section></div> }
function DetailModal({ item, onClose }: { item: RecordItem; onClose: () => void }) { return <div className="modal-backdrop"><section className="modal-card" role="dialog" aria-modal="true"><div className="modal-heading"><div><p className="eyebrow">Detalle del registro</p><h2>{item.name}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X /></button></div><div className="detail-grid"><strong>Código</strong><span>{item.code ?? item.id}</span><strong>Estado</strong><Badge status={item.status} /><strong>Información</strong><span>{item.detail}</span>{item.data && Object.entries(item.data).filter(([key]) => !['name', 'code'].includes(key)).map(([key, value]) => <span key={key}><b>{key}:</b> {value}</span>)}</div></section></div> }

// ---------- Flujo: compra -> recepcion -> produccion -> inventario -> despacho/venta ----------
const inputBox = { width: '100%', minHeight: 40, padding: '0 10px', borderRadius: 8, border: '1px solid #d9c9b8', background: '#fff', fontSize: 14 } as const
const round2 = (value: number) => Math.round(value * 100) / 100

function AvailabilityPage({ orders, records, materials, onBuy }: { orders: Order[]; records: Record<string, RecordItem[]>; materials: Material[]; onBuy: (draft: { code: string; qty: number }[]) => void }) {
  const open = orders.filter((o) => o.status === 'Pendiente' || o.status === 'En proceso')
  const required: Record<string, number> = {}
  const perOrder = open.map((o) => {
    const { lines, needs } = getNeeds(o, records, materials)
    needs.forEach((n) => { required[n.line.code] = (required[n.line.code] ?? 0) + n.need })
    const short = needs.filter((n) => !n.m || n.m.stock < n.need)
    return [o.id, o.product, o.status, !lines.length ? 'Sin receta o sin ingredientes' : short.length ? `Falta: ${short.map((n) => n.m?.name ?? n.line.code).join(', ')}` : 'Se puede producir'] as (string | number)[]
  })
  const rows = Object.keys(required).map((code) => { const m = materials.find((x) => x.code === code); const stock = m?.stock ?? 0; return { code, name: m?.name ?? code, unit: m?.unit ?? '', exists: Boolean(m), need: required[code], stock, missing: Math.max(0, required[code] - stock) } })
  const shortages = rows.filter((r) => r.exists && r.missing > 1e-9)
  return <><Head eyebrow="Producción" title="Disponibilidad de materiales" subtitle="Insumos que requieren las órdenes pendientes y en proceso frente al stock actual."><button className="primary-button" disabled={!shortages.length} onClick={() => onBuy(shortages.map((r) => ({ code: r.code, qty: Math.ceil(r.missing * 100) / 100 })))}><Plus />Generar compra con faltantes</button></Head><Table head={['Código', 'Insumo', 'Requerido', 'Disponible', 'Faltante', 'Estado']} rows={rows.map((r) => [r.code, r.name, `${num(r.need)} ${r.unit}`, `${num(r.stock)} ${r.unit}`, r.missing > 1e-9 ? `${num(r.missing)} ${r.unit}` : '—', !r.exists ? 'No existe en Materias primas' : r.missing > 1e-9 ? 'Falta' : 'OK'])} empty="No hay órdenes abiertas con receta." /><Table head={['Orden', 'Producto', 'Estado', 'Disponibilidad']} rows={perOrder} empty="No hay órdenes pendientes ni en proceso." /></>
}

type PurchaseDraftRow = { code: string; qty: string; cost: string }
function PurchasesPage({ purchases, suppliers, materials, draft, clearDraft, onCreate, onCancel, onGoReceive }: { purchases: Purchase[]; suppliers: string[]; materials: Material[]; draft: { code: string; qty: number }[] | null; clearDraft: () => void; onCreate: (supplier: string, lines: { code: string; qty: number; cost: number }[], notes: string) => boolean; onCancel: (id: string) => void; onGoReceive: () => void }) {
  const [supplier, setSupplier] = useState(''); const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<PurchaseDraftRow[]>(() => draft && draft.length ? draft.map((d) => ({ code: d.code, qty: String(d.qty), cost: String(round2(materials.find((m) => m.code === d.code)?.cost ?? 0) || '') })) : [{ code: '', qty: '', cost: '' }])
  // El borrador viene de "Generar compra con faltantes": se usa una sola vez
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (draft) clearDraft() }, [])
  const setRow = (index: number, patch: Partial<PurchaseDraftRow>) => setRows((current) => current.map((r, i) => i === index ? { ...r, ...patch } : r))
  const total = sum(rows.map((r) => (Number(r.qty) * Number(r.cost)) || 0))
  const submit = () => { if (onCreate(supplier, rows.map((r) => ({ code: r.code, qty: Number(r.qty), cost: Number(r.cost) })), notes)) { setSupplier(''); setNotes(''); setRows([{ code: '', qty: '', cost: '' }]) } }
  return <><Head eyebrow="Compras" title="Órdenes de compra" subtitle="Pide materias primas a tus proveedores. El stock no cambia hasta registrar la recepción." />
    <section className="panel module-panel">
      <div className="form-grid">
        <label>Proveedor<select value={supplier} onChange={(event) => setSupplier(event.target.value)}><option value="">Selecciona...</option>{suppliers.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        <label>Notas (opcional)<input value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
        <strong style={{ fontSize: 13 }}>Materias primas a pedir</strong>
        {rows.map((row, index) => {
          const m = materials.find((x) => x.code === row.code); return <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto auto', gap: 8, alignItems: 'center' }}>
            <select style={inputBox} value={row.code} onChange={(event) => setRow(index, { code: event.target.value, cost: row.cost || String(round2(materials.find((x) => x.code === event.target.value)?.cost ?? 0) || '') })}><option value="">Selecciona la materia prima...</option>{materials.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}</select>
            <input style={inputBox} type="number" min="0" step="any" placeholder="Cantidad" value={row.qty} onChange={(event) => setRow(index, { qty: event.target.value })} />
            <input style={inputBox} type="number" min="0" step="any" placeholder="Costo unitario (C$)" value={row.cost} onChange={(event) => setRow(index, { cost: event.target.value })} />
            <span style={{ fontSize: 13, minWidth: 48 }}>{m?.unit ?? ''}</span>
            <button type="button" className="icon-button danger" aria-label="Quitar línea" onClick={() => setRows((current) => current.length > 1 ? current.filter((_, i) => i !== index) : [{ code: '', qty: '', cost: '' }])}><Trash2 /></button>
          </div>
        })}
        <div><button type="button" className="outline-button" onClick={() => setRows((current) => [...current, { code: '', qty: '', cost: '' }])}><Plus />Agregar materia prima</button></div>
      </div>
      <div className="modal-actions"><strong style={{ marginRight: 'auto' }}>Total estimado: {money(total)}</strong><button className="primary-button" onClick={submit}><Plus />Crear orden de compra</button></div>
      {!suppliers.length && <p className="subtitle">Primero registra un proveedor en Datos maestros → Proveedores.</p>}
    </section>
    <section className="panel module-panel">{purchases.length ? <div className="table-scroll"><table><thead><tr><th>Orden</th><th>Fecha</th><th>Proveedor</th><th>Detalle</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{purchases.map((p) => <tr key={p.id}><td>{p.id}</td><td>{p.date}</td><td>{p.supplier}</td><td>{p.lines.map((l) => { const m = materials.find((x) => x.code === l.code); return `${m?.name ?? l.code} ${num(l.qty)} ${m?.unit ?? ''}${l.received ? ` (recibido ${num(l.received)})` : ''}` }).join(' · ')}</td><td>{money(sum(p.lines.map((l) => l.qty * l.cost)))}</td><td><Badge status={p.status} /></td><td className="row-actions">{(p.status === 'Pendiente' || p.status === 'Recibida parcial') && <button className="small-action" onClick={onGoReceive}>Recibir</button>}{p.status === 'Pendiente' && <button className="small-action muted" onClick={() => onCancel(p.id)}>Cancelar</button>}</td></tr>)}</tbody></table></div> : <div className="empty-state"><AlertTriangle />Aún no hay órdenes de compra.</div>}</section></>
}

function ReceptionPage({ purchases, materials, movements, onReceive }: { purchases: Purchase[]; materials: Material[]; movements: Movement[]; onReceive: (id: string, received: Record<number, number>) => boolean }) {
  const open = purchases.filter((p) => p.status === 'Pendiente' || p.status === 'Recibida parcial')
  const [selected, setSelected] = useState(''); const [qtys, setQtys] = useState<Record<number, string>>({})
  const po = open.find((p) => p.id === selected)
  const choose = (id: string) => {
    setSelected(id)
    const next: Record<number, string> = {}
    const target = open.find((p) => p.id === id)
    if (target) target.lines.forEach((l, i) => { next[i] = String(Math.round((l.qty - l.received) * 1000) / 1000) })
    setQtys(next)
  }
  const submit = () => { if (!po) return; const parsed: Record<number, number> = {}; Object.keys(qtys).forEach((k) => { parsed[Number(k)] = Number(qtys[Number(k)]) }); if (onReceive(po.id, parsed)) { setSelected(''); setQtys({}) } }
  const history = movements.filter((m) => m.type === 'Entrada' && m.ref.startsWith('OC-'))
  return <><Head eyebrow="Compras" title="Recepción de material" subtitle="Registra lo que llegó contra una orden de compra. Puedes recibir por partes; el stock y el costo promedio se actualizan al confirmar." />
    <section className="panel module-panel">
      <div className="form-grid"><label>Orden de compra por recibir<select value={selected} onChange={(event) => choose(event.target.value)}><option value="">Selecciona...</option>{open.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.supplier} · {p.status}</option>)}</select></label></div>
      {!open.length && <p className="subtitle">No hay órdenes de compra pendientes. Crea una en Compras → Órdenes de compra.</p>}
      {po && <div className="table-scroll" style={{ marginTop: 16 }}><table><thead><tr><th>Materia prima</th><th>Ordenado</th><th>Recibido</th><th>Pendiente</th><th>Costo unitario</th><th>Recibir ahora</th></tr></thead><tbody>{po.lines.map((l, i) => { const m = materials.find((x) => x.code === l.code); const pending = l.qty - l.received; return <tr key={i}><td>{m?.name ?? l.code}</td><td>{num(l.qty)} {m?.unit}</td><td>{num(l.received)} {m?.unit}</td><td>{num(Math.max(0, pending))} {m?.unit}</td><td>{money(l.cost)}</td><td><input style={{ ...inputBox, maxWidth: 140 }} type="number" min="0" step="any" disabled={pending <= 1e-9} value={qtys[i] ?? ''} onChange={(event) => setQtys((current) => ({ ...current, [i]: event.target.value }))} /></td></tr> })}</tbody></table></div>}
      {po && <div className="modal-actions"><button className="primary-button" onClick={submit}><CheckCircle2 />Registrar recepción</button></div>}
    </section>
    <Table head={['Fecha', 'Orden', 'Materia prima', 'Cantidad', 'Valor']} rows={history.map((m) => [m.date, m.ref, m.material, `${num(m.qty)} ${m.unit}`, money(m.total)])} empty="Aún no hay recepciones registradas." /></>
}

type SaleDraftRow = { product: string; qty: string; price: string }
function SalesPage({ sales, customers, products, stock, onCreate }: { sales: Sale[]; customers: string[]; products: { name: string; price: number }[]; stock: Record<string, number>; onCreate: (kind: 'Venta' | 'Despacho', customer: string, lines: { product: string; qty: number; price: number }[]) => boolean }) {
  const [kind, setKind] = useState<'Venta' | 'Despacho'>('Venta'); const [customer, setCustomer] = useState('')
  const [rows, setRows] = useState<SaleDraftRow[]>([{ product: '', qty: '', price: '' }])
  const setRow = (index: number, patch: Partial<SaleDraftRow>) => setRows((current) => current.map((r, i) => i === index ? { ...r, ...patch } : r))
  const total = kind === 'Venta' ? sum(rows.map((r) => (Number(r.qty) * Number(r.price)) || 0)) : 0
  const submit = () => { if (onCreate(kind, customer, rows.map((r) => ({ product: r.product, qty: Number(r.qty), price: Number(r.price) })))) { setCustomer(''); setRows([{ product: '', qty: '', price: '' }]) } }
  return <><Head eyebrow="Inventario" title="Salidas" subtitle="Venta o despacho de producto terminado. Descuenta el stock disponible y deja el movimiento registrado." />
    <section className="panel module-panel">
      <div className="form-grid">
        <label>Tipo de salida<select value={kind} onChange={(event) => setKind(event.target.value as 'Venta' | 'Despacho')}><option value="Venta">Venta (se cobra)</option><option value="Despacho">Despacho (sin cobro)</option></select></label>
        <label>Cliente<select value={customer} onChange={(event) => setCustomer(event.target.value)}><option value="">Selecciona...</option>{customers.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
        <strong style={{ fontSize: 13 }}>Productos</strong>
        {rows.map((row, index) => <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
          <select style={inputBox} value={row.product} onChange={(event) => { const p = products.find((x) => x.name === event.target.value); setRow(index, { product: event.target.value, price: p?.price ? String(p.price) : '' }) }}><option value="">Selecciona el producto...</option>{products.map((p) => <option key={p.name} value={p.name}>{p.name} (stock: {num(stock[p.name] ?? 0, 0)} und)</option>)}</select>
          <input style={inputBox} type="number" min="0" step="any" placeholder="Cantidad (und)" value={row.qty} onChange={(event) => setRow(index, { qty: event.target.value })} />
          <input style={inputBox} type="number" min="0" step="any" placeholder="Precio unitario (C$)" disabled={kind === 'Despacho'} value={kind === 'Despacho' ? '' : row.price} onChange={(event) => setRow(index, { price: event.target.value })} />
          <button type="button" className="icon-button danger" aria-label="Quitar línea" onClick={() => setRows((current) => current.length > 1 ? current.filter((_, i) => i !== index) : [{ product: '', qty: '', price: '' }])}><Trash2 /></button>
        </div>)}
        <div><button type="button" className="outline-button" onClick={() => setRows((current) => [...current, { product: '', qty: '', price: '' }])}><Plus />Agregar producto</button></div>
      </div>
      <div className="modal-actions"><strong style={{ marginRight: 'auto' }}>Total: {money(total)}</strong><button className="primary-button" onClick={submit}><Plus />Registrar {kind === 'Venta' ? 'venta' : 'despacho'}</button></div>
    </section>
    <Table head={['Fecha', 'Documento', 'Tipo', 'Cliente', 'Detalle', 'Total']} rows={sales.map((s) => [s.date, s.id, s.kind, s.customer, s.lines.map((l) => `${l.product} × ${num(l.qty, 0)}`).join(' · '), money(s.total)])} empty="Aún no hay ventas ni despachos." /></>
}

function MovementsPage({ movements }: { movements: Movement[] }) {
  const [type, setType] = useState('Todos')
  const rows = movements.filter((m) => type === 'Todos' || m.type === type)
  return <><Head eyebrow="Inventario" title="Movimientos" subtitle="Kardex único: compras recibidas, consumo, producción, ventas, despachos y devoluciones."><select style={{ ...inputBox, width: 200 }} aria-label="Filtrar por tipo" value={type} onChange={(event) => setType(event.target.value)}>{['Todos', 'Entrada', 'Consumo', 'Producción', 'Liberación', 'Retrabajo', 'Retorno retrabajo', 'Scrap', 'Venta', 'Despacho', 'Devolución'].map((t) => <option key={t} value={t}>{t}</option>)}</select></Head><Table head={['Fecha', 'Tipo', 'Código', 'Ítem', 'Cantidad', 'Valor', 'Referencia']} rows={rows.map((m) => [m.date, m.type, m.code, m.material, `${num(m.qty)} ${m.unit}`, money(m.total), m.ref])} empty="No hay movimientos todavía." /></>
}

function QualityPage({ products, qc, stock, required, log, onToggle, onAction }: { products: string[]; qc: Record<string, QcBuckets>; stock: Record<string, number>; required: Record<string, boolean>; log: QcRecord[]; onToggle: (name: string) => void; onAction: (action: QcAction, product: string, qty: number, reason: string, source: 'pending' | 'rework' | 'available') => boolean }) {
  const [action, setAction] = useState<QcAction>('Liberación'); const [product, setProduct] = useState(''); const [qty, setQty] = useState(''); const [reason, setReason] = useState(''); const [source, setSource] = useState<'pending' | 'rework' | 'available'>('pending')
  const b = qc[product] ?? { pending: 0, rework: 0 }
  const from = action === 'Liberación' || action === 'Retrabajo' ? 'pending' : action === 'Retorno retrabajo' ? 'rework' : source
  const have = !product ? 0 : from === 'pending' ? b.pending : from === 'rework' ? b.rework : (stock[product] ?? 0)
  const submit = () => { if (onAction(action, product, Number(qty), reason, source)) { setQty(''); setReason('') } }
  const needsReason = action === 'Retrabajo' || action === 'Scrap'
  return <><Head eyebrow="Producción" title="Calidad y liberación" subtitle="Libera producto terminado, envíalo a retrabajo o descártalo como scrap. Solo el producto liberado se puede vender o despachar." />
    <section className="panel module-panel">
      <div className="panel-heading"><div><h2>Control de calidad por producto</h2><p>Con el control activo, lo que produce una orden entra como “Pendiente de liberación” y no se puede vender hasta liberarlo. Sin control, entra directo a disponible.</p></div></div>
      {products.length ? <div className="table-scroll"><table><thead><tr><th>Producto</th><th>Disponible (liberado)</th><th>Pendiente de liberación</th><th>En retrabajo</th><th>Control de calidad</th></tr></thead><tbody>{products.map((name) => <tr key={name}><td>{name}</td><td>{num(stock[name] ?? 0, 0)} und</td><td>{num(qc[name]?.pending ?? 0, 0)} und</td><td>{num(qc[name]?.rework ?? 0, 0)} und</td><td className="row-actions"><Badge status={required[name] ? 'Activo' : 'Inactivo'} /><button className="small-action" onClick={() => onToggle(name)}>{required[name] ? 'Desactivar' : 'Activar'}</button></td></tr>)}</tbody></table></div> : <div className="empty-state"><AlertTriangle />Aún no hay productos.</div>}
    </section>
    <section className="panel module-panel">
      <div className="form-grid">
        <label>Acción<select value={action} onChange={(event) => setAction(event.target.value as QcAction)}><option value="Liberación">Liberar producto (pendiente → disponible)</option><option value="Retrabajo">Enviar a retrabajo (pendiente → retrabajo)</option><option value="Retorno retrabajo">Retorno de retrabajo (retrabajo → pendiente de liberación)</option><option value="Scrap">Scrap (descartar unidades)</option></select></label>
        <label>Producto<select value={product} onChange={(event) => setProduct(event.target.value)}><option value="">Selecciona...</option>{products.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
        {action === 'Scrap' && <label>Descartar desde<select value={source} onChange={(event) => setSource(event.target.value as 'pending' | 'rework' | 'available')}><option value="pending">{qcLabel.pending}</option><option value="rework">{qcLabel.rework}</option><option value="available">{qcLabel.available}</option></select></label>}
        <label>Cantidad (und){product ? ` · hay ${num(have, 0)} en "${qcLabel[from]}"` : ''}<input type="number" min="0" step="1" value={qty} onChange={(event) => setQty(event.target.value)} /></label>
        <label>Motivo{needsReason ? ' (obligatorio)' : ' (opcional)'}<input value={reason} placeholder={action === 'Scrap' ? 'Ej. quemado, contaminado, vencido' : action === 'Retrabajo' ? 'Ej. forma incorrecta, falta de cocción' : ''} onChange={(event) => setReason(event.target.value)} /></label>
      </div>
      <div className="modal-actions"><button className="primary-button" onClick={submit}><CheckCircle2 />Registrar {action === 'Liberación' ? 'liberación' : action === 'Retrabajo' ? 'retrabajo' : action === 'Retorno retrabajo' ? 'retorno de retrabajo' : 'scrap'}</button></div>
    </section>
    <Table head={['Fecha', 'Documento', 'Acción', 'Producto', 'Cantidad', 'Origen', 'Motivo', 'Valor']} rows={log.map((r) => [r.date, r.id, r.action, r.product, `${num(r.qty, 0)} und`, r.from, r.reason || '—', r.action === 'Scrap' ? money(r.value) : '—'])} empty="Aún no hay registros de calidad." /></>
}