import { expect, it } from 'vitest'
import type { Product } from '@/types'
import { buildProductGroups } from './productGroups'
import { getGroupQuantityLabel, getProductStockStatus, isProductAvailable, tracksStock } from './productStock'

const product = { id:'dish',name:'Yassa',status:'active',quantity:0,min_quantity:5,buying_price:1000,selling_price:2000,created_at:'2026-01-01',updated_at:'2026-01-01' } as Product
it('keeps legacy products tracked and unavailable at zero while a dish can be sold', () => {
  expect(tracksStock(product)).toBe(true)
  expect(isProductAvailable(product)).toBe(false)
  expect(isProductAvailable({...product,track_stock:false})).toBe(true)
  expect(isProductAvailable({...product,track_stock:false,is_available:false})).toBe(false)
  expect(isProductAvailable({...product,track_stock:false,status:'inactive'})).toBe(false)
})
it('never calls an untracked dish a stock shortage or counts its dormant stock', () => {
  const dish = {...product,track_stock:false,quantity:50}
  expect(getProductStockStatus(dish).label).toBe('Disponible')
  const group = buildProductGroups([dish])[0]
  expect(group).toMatchObject({quantity:0,low_variant_count:0,out_variant_count:0})
  expect(getGroupQuantityLabel(group)).toBe('Sans suivi de stock')
  expect(getProductStockStatus({...dish,is_available:false}).label).toBe('Indisponible')
})
