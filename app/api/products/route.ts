import { NextResponse } from 'next/server'
import { createProduct, listProducts } from '@/app/actions/erp'

export async function GET() {
  try {
    return NextResponse.json(await listProducts())
  } catch (error) {
    console.error('[v0] Error loading products', error)
    return NextResponse.json({ error: 'No se pudieron cargar los productos' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const product = await createProduct(body)
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('[v0] Error creating product', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo crear el producto' }, { status: 400 })
  }
}
