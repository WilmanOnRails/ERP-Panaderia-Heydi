'use client'

import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react'

type BillingSection = 'Cotizaciones' | 'Facturación' | 'Registro de pagos' | 'Devoluciones y notas de crédito'
type BillingLine = { id: string; product: string; code: string; quantity: number; unitPrice: number }
type BillingDocument = {
  id: string
  customer: string
  date: string
  lines: BillingLine[]
  subtotal: number
  discountPercent: number
  discountAmount: number
  taxPercent: number
  taxAmount: number
  total: number
  quoteId?: string
}
type Quote = BillingDocument & { status: 'Pendiente' | 'Facturada' }
type Invoice = BillingDocument
type Payment = { id: string; invoiceId: string; date: string; amount: number; method: string; reference: string }
type CreditNoteLine = { lineId: string; product: string; quantity: number; unitPrice: number }
type CreditNote = { id: string; invoiceId: string; date: string; lines: CreditNoteLine[]; total: number }
export type BillingData = { quotes: Quote[]; invoices: Invoice[]; payments: Payment[]; creditNotes: CreditNote[] }
type ProductOption = { name: string; code: string; price: number }
type DraftLine = { product: string; quantity: string; unitPrice: string }

const money = (value: number) => `C$ ${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const number = (value: number) => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 })
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const documentNumber = (prefix: string, count: number) => `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`
const timestamp = () => new Date().toLocaleString('es-NI')
const lineId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const inputStyle = { width: '100%', minHeight: 40, padding: '0 10px', borderRadius: 8, border: '1px solid #d9c9b8', background: '#fff', fontSize: 14 } as const

function totals(lines: BillingLine[], discountPercent: number, taxPercent: number) {
  const subtotal = round2(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0))
  const discountAmount = round2(subtotal * discountPercent / 100)
  const taxable = subtotal - discountAmount
  const taxAmount = round2(taxable * taxPercent / 100)
  return { subtotal, discountAmount, taxAmount, total: round2(taxable + taxAmount) }
}

function invoicePaid(invoiceId: string, payments: Payment[]) {
  return round2(payments.filter((payment) => payment.invoiceId === invoiceId).reduce((sum, payment) => sum + payment.amount, 0))
}

function invoiceCredits(invoiceId: string, notes: CreditNote[]) {
  return round2(notes.filter((note) => note.invoiceId === invoiceId).reduce((sum, note) => sum + note.total, 0))
}

function invoiceBalance(invoice: Invoice, payments: Payment[], notes: CreditNote[]) {
  return Math.max(0, round2(invoice.total - invoicePaid(invoice.id, payments) - invoiceCredits(invoice.id, notes)))
}

function invoiceStatus(invoice: Invoice, payments: Payment[], notes: CreditNote[]) {
  const balance = invoiceBalance(invoice, payments, notes)
  const paid = invoicePaid(invoice.id, payments)
  const credited = invoiceCredits(invoice.id, notes)
  if (round2(paid + credited - invoice.total) > 0) return 'Saldo a favor'
  if (balance <= 0 && credited >= invoice.total && paid === 0) return 'Acreditada'
  if (balance <= 0) return 'Pagada'
  if (paid > 0) return 'Abono parcial'
  if (credited > 0) return 'Con nota de crédito'
  return 'Pendiente'
}

function invoiceRefundable(invoice: Invoice, payments: Payment[], notes: CreditNote[]) {
  return Math.max(0, round2(invoicePaid(invoice.id, payments) + invoiceCredits(invoice.id, notes) - invoice.total))
}

function PageHeading({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return <section className="page-heading"><div><p className="eyebrow">Módulo de facturación</p><h1>{title}</h1><p className="subtitle">{subtitle}</p></div>{children}</section>
}

function BillingTable({ headers, rows, empty }: { headers: string[]; rows: ReactNode[][]; empty: string }) {
  return <section className="panel module-panel">{rows.length ? <div className="table-scroll"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div> : <div className="empty-state"><AlertTriangle />{empty}</div>}</section>
}

export function BillingModule({
  section,
  customers,
  products,
  stock,
  data,
  onDataChange,
  onInventoryChange,
  onNotice,
}: {
  section: BillingSection
  customers: string[]
  products: ProductOption[]
  stock: Record<string, number>
  data: BillingData
  onDataChange: (data: BillingData | ((current: BillingData) => BillingData)) => void
  onInventoryChange: (lines: { product: string; qty: number; price: number }[], reference: string, direction: 'sale' | 'return') => boolean
  onNotice: (message: string) => void
}) {
  const notifyError = (message: string) => onNotice(message)
  const saveDocument = (kind: 'quote' | 'invoice', customer: string, lines: BillingLine[], discountPercent: number, taxPercent: number) => {
    if (!customer) { notifyError('Selecciona un cliente.'); return false }
    if (!lines.length || lines.some((line) => !line.product || !(line.quantity > 0) || !(line.unitPrice > 0))) {
      notifyError('Agrega productos con cantidades y precios mayores que cero.')
      return false
    }
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100 || !Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) {
      notifyError('Los descuentos e impuestos deben estar entre 0% y 100%.')
      return false
    }
    const prefix = kind === 'quote' ? 'COT' : 'FAC'
    const id = documentNumber(prefix, kind === 'quote' ? data.quotes.length : data.invoices.length)
    const amounts = totals(lines, discountPercent, taxPercent)
    const document: BillingDocument = {
      id,
      customer,
      date: timestamp(),
      lines,
      subtotal: amounts.subtotal,
      discountPercent,
      discountAmount: amounts.discountAmount,
      taxPercent,
      taxAmount: amounts.taxAmount,
      total: amounts.total,
    }
    if (kind === 'quote') {
      onDataChange((current) => ({ ...current, quotes: [{ ...document, status: 'Pendiente' }, ...current.quotes] }))
    } else {
      if (!onInventoryChange(lines.map(({ product, quantity, unitPrice }) => ({ product, qty: quantity, price: unitPrice })), id, 'sale')) return false
      onDataChange((current) => ({ ...current, invoices: [document, ...current.invoices] }))
    }
    return true
  }

  const convertQuote = (quote: Quote) => {
    if (quote.status !== 'Pendiente') return
    const invoiceId = documentNumber('FAC', data.invoices.length)
    const invoice = { ...quote, id: invoiceId, quoteId: quote.id, date: timestamp() }
    if (!onInventoryChange(quote.lines.map(({ product, quantity, unitPrice }) => ({ product, qty: quantity, price: unitPrice })), invoiceId, 'sale')) return
    onDataChange((current) => ({
      ...current,
      quotes: current.quotes.map((item) => item.id === quote.id ? { ...item, status: 'Facturada' } : item),
      invoices: [invoice, ...current.invoices],
    }))
  }

  const recordPayment = (invoiceId: string, amount: number, method: string, reference: string) => {
    const invoice = data.invoices.find((item) => item.id === invoiceId)
    if (!invoice) { notifyError('Selecciona una factura.'); return false }
    if (!Number.isFinite(amount) || amount <= 0) { notifyError('El monto debe ser mayor que cero.'); return false }
    if (!method) { notifyError('Selecciona el método de pago.'); return false }
    const balance = invoiceBalance(invoice, data.payments, data.creditNotes)
    if (amount > balance + 0.001) { notifyError(`El pago supera el saldo pendiente de ${money(balance)}.`); return false }
    const payment: Payment = { id: documentNumber('PAG', data.payments.length), invoiceId, date: timestamp(), amount: round2(amount), method, reference: reference.trim() }
    onDataChange((current) => ({ ...current, payments: [payment, ...current.payments] }))
    return true
  }

  const createCreditNote = (invoice: Invoice, quantities: Record<string, number>) => {
    const returnedSoFar = new Map<string, number>()
    data.creditNotes.filter((note) => note.invoiceId === invoice.id).forEach((note) => note.lines.forEach((line) => {
      returnedSoFar.set(line.lineId, (returnedSoFar.get(line.lineId) ?? 0) + line.quantity)
    }))
    const returnedLines: CreditNoteLine[] = []
    for (const line of invoice.lines) {
      const quantity = quantities[line.id] ?? 0
      const remaining = line.quantity - (returnedSoFar.get(line.id) ?? 0)
      if (!Number.isFinite(quantity) || quantity < 0 || quantity > remaining) {
        notifyError(`La cantidad de devolución de ${line.product} supera las unidades disponibles para devolver (${number(Math.max(0, remaining))}).`)
        return false
      }
      if (quantity > 0) returnedLines.push({ lineId: line.id, product: line.product, quantity, unitPrice: line.unitPrice })
    }
    if (!returnedLines.length) { notifyError('Indica al menos una cantidad para devolver.'); return false }

    const creditTotal = Math.min(
      round2(returnedLines.reduce((sum, line) => sum + line.quantity * line.unitPrice * (1 - invoice.discountPercent / 100) * (1 + invoice.taxPercent / 100), 0)),
      Math.max(0, round2(invoice.total - invoiceCredits(invoice.id, data.creditNotes))),
    )
    const id = documentNumber('NC', data.creditNotes.length)
    if (!onInventoryChange(returnedLines.map(({ product, quantity, unitPrice }) => ({ product, qty: quantity, price: unitPrice })), id, 'return')) return false
    const note: CreditNote = { id, invoiceId: invoice.id, date: timestamp(), lines: returnedLines, total: creditTotal }
    onDataChange((current) => ({ ...current, creditNotes: [note, ...current.creditNotes] }))
    return true
  }

  return <div className="billing-module">
    {section === 'Cotizaciones' && <QuotePage quotes={data.quotes} customers={customers} products={products} stock={stock} onCreate={(customer, lines, discount, tax) => saveDocument('quote', customer, lines, discount, tax)} onConvert={convertQuote} onNotice={onNotice} />}
    {section === 'Facturación' && <InvoicePage invoices={data.invoices} payments={data.payments} creditNotes={data.creditNotes} customers={customers} products={products} stock={stock} onCreate={(customer, lines, discount, tax) => saveDocument('invoice', customer, lines, discount, tax)} onNotice={onNotice} />}
    {section === 'Registro de pagos' && <PaymentsPage invoices={data.invoices} payments={data.payments} creditNotes={data.creditNotes} onCreate={recordPayment} />}
    {section === 'Devoluciones y notas de crédito' && <CreditNotesPage invoices={data.invoices} payments={data.payments} creditNotes={data.creditNotes} onCreate={createCreditNote} />}
  </div>
}

function DocumentEditor({ kind, customers, products, stock, onSubmit, onNotice }: {
  kind: 'quote' | 'invoice'
  customers: string[]
  products: ProductOption[]
  stock: Record<string, number>
  onSubmit: (customer: string, lines: BillingLine[], discount: number, tax: number) => boolean
  onNotice: (message: string) => void
}) {
  const [customer, setCustomer] = useState('')
  const [rows, setRows] = useState<DraftLine[]>([{ product: '', quantity: '', unitPrice: '' }])
  const [discount, setDiscount] = useState('0')
  const [tax, setTax] = useState('0')
  const setRow = (index: number, patch: Partial<DraftLine>) => setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row))
  const lines = rows.map((row) => {
    const product = products.find((item) => item.name === row.product)
    return { id: lineId(), product: row.product, code: product?.code ?? '', quantity: Number(row.quantity), unitPrice: Number(row.unitPrice) }
  }).filter((line) => line.product && line.quantity > 0 && line.unitPrice > 0)
  const amount = totals(lines, Number(discount), Number(tax))
  const submit = () => {
    if (rows.some((row) => !row.product || !Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0 || !Number.isFinite(Number(row.unitPrice)) || Number(row.unitPrice) <= 0)) {
      onNotice('Completa el producto, la cantidad y el precio de cada línea.')
      return
    }
    if (onSubmit(customer, lines, Number(discount), Number(tax))) {
      setCustomer('')
      setRows([{ product: '', quantity: '', unitPrice: '' }])
      setDiscount('0')
      setTax('0')
    }
  }
  return <section className="panel module-panel">
    <div className="form-grid">
      <label>Cliente<select value={customer} onChange={(event) => setCustomer(event.target.value)}><option value="">Selecciona un cliente...</option>{customers.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      <label>Descuento (%)<input type="number" min="0" max="100" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label>
      <label>Impuesto (%)<input type="number" min="0" max="100" step="0.01" value={tax} onChange={(event) => setTax(event.target.value)} /></label>
    </div>
    <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
      <strong style={{ fontSize: 13 }}>Productos</strong>
      {rows.map((row, index) => <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
        <select style={inputStyle} value={row.product} onChange={(event) => { const selected = products.find((item) => item.name === event.target.value); setRow(index, { product: event.target.value, unitPrice: selected ? String(selected.price) : '' }) }}><option value="">Selecciona un producto...</option>{products.map((item) => <option key={item.code} value={item.name}>{item.name} (stock: {number(stock[item.name] ?? 0)} und)</option>)}</select>
        <input style={inputStyle} type="number" min="0" step="any" placeholder="Cantidad" value={row.quantity} onChange={(event) => setRow(index, { quantity: event.target.value })} />
        <input style={inputStyle} type="number" min="0" step="0.01" placeholder="Precio unitario (C$)" value={row.unitPrice} onChange={(event) => setRow(index, { unitPrice: event.target.value })} />
        <button type="button" className="icon-button danger" aria-label="Quitar producto" onClick={() => setRows((current) => current.length > 1 ? current.filter((_, rowIndex) => rowIndex !== index) : [{ product: '', quantity: '', unitPrice: '' }])}><Trash2 /></button>
      </div>)}
      <div><button type="button" className="outline-button" onClick={() => setRows((current) => [...current, { product: '', quantity: '', unitPrice: '' }])}><Plus />Agregar producto</button></div>
    </div>
    <div className="billing-totals">
      <span>Subtotal <strong>{money(amount.subtotal)}</strong></span>
      <span>Descuento ({Number(discount) || 0}%) <strong>− {money(amount.discountAmount)}</strong></span>
      <span>Impuesto ({Number(tax) || 0}%) <strong>{money(amount.taxAmount)}</strong></span>
      <span className="billing-grand-total">Total <strong>{money(amount.total)}</strong></span>
    </div>
    <div className="modal-actions"><button className="primary-button" onClick={submit}><Plus />{kind === 'quote' ? 'Crear cotización' : 'Emitir factura'}</button></div>
  </section>
}

function QuotePage({ quotes, customers, products, stock, onCreate, onConvert, onNotice }: {
  quotes: Quote[]
  customers: string[]
  products: ProductOption[]
  stock: Record<string, number>
  onCreate: (customer: string, lines: BillingLine[], discount: number, tax: number) => boolean
  onConvert: (quote: Quote) => void
  onNotice: (message: string) => void
}) {
  return <>
    <PageHeading title="Cotizaciones" subtitle="Prepara ofertas con precios, descuentos e impuestos. Al aceptar, conviértelas en factura." />
    <DocumentEditor kind="quote" customers={customers} products={products} stock={stock} onSubmit={onCreate} onNotice={onNotice} />
    <BillingTable headers={['Fecha', 'Cotización', 'Cliente', 'Detalle', 'Total', 'Estado', 'Acción']} rows={quotes.map((quote) => [
      quote.date,
      quote.id,
      quote.customer,
      quote.lines.map((line) => `${line.product} × ${number(line.quantity)}`).join(' · '),
      money(quote.total),
      quote.status,
      quote.status === 'Pendiente' ? <button className="small-action" onClick={() => onConvert(quote)}>Convertir en factura</button> : '—',
    ])} empty="Aún no hay cotizaciones." />
  </>
}

function InvoicePage({ invoices, payments, creditNotes, customers, products, stock, onCreate, onNotice }: {
  invoices: Invoice[]
  payments: Payment[]
  creditNotes: CreditNote[]
  customers: string[]
  products: ProductOption[]
  stock: Record<string, number>
  onCreate: (customer: string, lines: BillingLine[], discount: number, tax: number) => boolean
  onNotice: (message: string) => void
}) {
  return <>
    <PageHeading title="Facturación" subtitle="Emite documentos internos numerados; el impuesto se configura en cada documento. No son comprobantes fiscales ni se transmiten a la DGI. La emisión descuenta el inventario disponible." />
    <DocumentEditor kind="invoice" customers={customers} products={products} stock={stock} onSubmit={onCreate} onNotice={onNotice} />
    <BillingTable headers={['Fecha', 'Factura', 'Cliente', 'Subtotal', 'Descuento', 'Impuesto', 'Total', 'Pagado', 'Crédito emitido', 'Saldo', 'Saldo a favor', 'Estado']} rows={invoices.map((invoice) => [
      invoice.date,
      <span title={invoice.quoteId ? `Origen: ${invoice.quoteId}` : undefined}>{invoice.id}</span>,
      invoice.customer,
      money(invoice.subtotal),
      `${invoice.discountPercent}% · ${money(invoice.discountAmount)}`,
      `${invoice.taxPercent}% · ${money(invoice.taxAmount)}`,
      money(invoice.total),
      money(invoicePaid(invoice.id, payments)),
      money(invoiceCredits(invoice.id, creditNotes)),
      money(invoiceBalance(invoice, payments, creditNotes)),
      money(invoiceRefundable(invoice, payments, creditNotes)),
      invoiceStatus(invoice, payments, creditNotes),
    ])} empty="Aún no hay facturas." />
  </>
}

function PaymentsPage({ invoices, payments, creditNotes, onCreate }: {
  invoices: Invoice[]
  payments: Payment[]
  creditNotes: CreditNote[]
  onCreate: (invoiceId: string, amount: number, method: string, reference: string) => boolean
}) {
  const [invoiceId, setInvoiceId] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('Efectivo')
  const [reference, setReference] = useState('')
  const openInvoices = invoices.filter((invoice) => invoiceBalance(invoice, payments, creditNotes) > 0)
  const selected = invoices.find((invoice) => invoice.id === invoiceId)
  const balance = selected ? invoiceBalance(selected, payments, creditNotes) : 0
  const submit = () => {
    if (onCreate(invoiceId, Number(amount), method, reference)) {
      setAmount('')
      setReference('')
    }
  }
  return <>
    <PageHeading title="Registro de pagos" subtitle="Registra pagos totales o abonos; el saldo de cada factura se actualiza automáticamente." />
    <section className="panel module-panel">
      <div className="form-grid">
        <label>Factura pendiente<select value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)}><option value="">Selecciona una factura...</option>{openInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.id} · {invoice.customer} · saldo {money(invoiceBalance(invoice, payments, creditNotes))}</option>)}</select></label>
        <label>Monto (C$){selected ? ` · saldo ${money(balance)}` : ''}<input type="number" min="0.01" max={balance} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label>Método de pago<select value={method} onChange={(event) => setMethod(event.target.value)}><option>Efectivo</option><option>Transferencia</option><option>Tarjeta</option><option>Otro</option></select></label>
        <label>Referencia (opcional)<input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="N.º de recibo o referencia bancaria" /></label>
      </div>
      <div className="modal-actions"><button className="primary-button" disabled={!invoiceId || Number(amount) <= 0} onClick={submit}><CheckCircle2 />Registrar pago</button></div>
      {!openInvoices.length && <p className="subtitle">No hay facturas pendientes de pago.</p>}
    </section>
    <BillingTable headers={['Fecha', 'Pago', 'Factura', 'Cliente', 'Método', 'Referencia', 'Monto']} rows={payments.map((payment) => [
      payment.date,
      payment.id,
      payment.invoiceId,
      invoices.find((invoice) => invoice.id === payment.invoiceId)?.customer ?? '—',
      payment.method,
      payment.reference || '—',
      money(payment.amount),
    ])} empty="Aún no hay pagos registrados." />
  </>
}

function CreditNotesPage({ invoices, payments, creditNotes, onCreate }: {
  invoices: Invoice[]
  payments: Payment[]
  creditNotes: CreditNote[]
  onCreate: (invoice: Invoice, quantities: Record<string, number>) => boolean
}) {
  const [invoiceId, setInvoiceId] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const invoice = invoices.find((item) => item.id === invoiceId)
  const returnedQuantities = useMemo(() => {
    const returned = new Map<string, number>()
    creditNotes.filter((note) => note.invoiceId === invoiceId).forEach((note) => note.lines.forEach((line) => {
      returned.set(line.lineId, (returned.get(line.lineId) ?? 0) + line.quantity)
    }))
    return returned
  }, [creditNotes, invoiceId])
  const availableInvoices = invoices.filter((item) => item.lines.some((line) => line.quantity > (creditNotes.filter((note) => note.invoiceId === item.id).flatMap((note) => note.lines).filter((entry) => entry.lineId === line.id).reduce((sum, entry) => sum + entry.quantity, 0))))
  const submit = () => {
    if (!invoice) return
    if (onCreate(invoice, Object.fromEntries(Object.entries(quantities).map(([id, value]) => [id, Number(value)])))) {
      setQuantities({})
      setInvoiceId('')
    }
  }
  return <>
    <PageHeading title="Devoluciones y notas de crédito" subtitle="Registra devoluciones contra una factura. Las unidades vuelven al inventario y el crédito reduce el saldo o genera un saldo a favor si la factura ya fue pagada." />
    <section className="panel module-panel">
      <div className="form-grid"><label>Factura<select value={invoiceId} onChange={(event) => { setInvoiceId(event.target.value); setQuantities({}) }}><option value="">Selecciona una factura...</option>{availableInvoices.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.customer} · {invoiceStatus(item, payments, creditNotes)}</option>)}</select></label></div>
      {invoice && <>
        <div className="table-scroll" style={{ marginTop: 16 }}><table><thead><tr><th>Producto</th><th>Facturado</th><th>Devuelto</th><th>Disponible para devolver</th><th>Cantidad a devolver</th></tr></thead><tbody>{invoice.lines.map((line) => {
          const alreadyReturned = returnedQuantities.get(line.id) ?? 0
          const remaining = Math.max(0, line.quantity - alreadyReturned)
          return <tr key={line.id}><td>{line.product}</td><td>{number(line.quantity)} und</td><td>{number(alreadyReturned)} und</td><td>{number(remaining)} und</td><td><input style={{ ...inputStyle, maxWidth: 140 }} type="number" min="0" max={remaining} step="any" disabled={remaining <= 0} value={quantities[line.id] ?? ''} onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: event.target.value }))} /></td></tr>
        })}</tbody></table></div>
        <div className="modal-actions"><button className="primary-button" onClick={submit}><Plus />Registrar devolución y nota de crédito</button></div>
      </>}
    </section>
    <BillingTable headers={['Fecha', 'Nota de crédito', 'Factura', 'Cliente', 'Detalle devuelto', 'Crédito']} rows={creditNotes.map((note) => [
      note.date,
      note.id,
      note.invoiceId,
      invoices.find((item) => item.id === note.invoiceId)?.customer ?? '—',
      note.lines.map((line) => `${line.product} × ${number(line.quantity)}`).join(' · '),
      money(note.total),
    ])} empty="Aún no hay devoluciones ni notas de crédito." />
  </>
}
