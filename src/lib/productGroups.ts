import { formatCurrency } from '@/lib/utils'
import type { Product, ProductGroup } from '@/types'

function compareVariantValues(left?: string, right?: string) {
  return (left ?? '').localeCompare(right ?? '', 'fr', { sensitivity: 'base' })
}

export function getProductGroupKey(product: Product): string {
  return product.product_group_id || product.id
}

export function buildProductGroups(products: Product[]): ProductGroup[] {
  const groups = new Map<string, ProductGroup>()

  products.forEach((product) => {
    const key = getProductGroupKey(product)
    const current = groups.get(key)

    if (current) {
      current.variants.push(product)
      current.quantity += product.quantity
      current.variant_count += 1
      if (product.quantity === 0) current.out_variant_count += 1
      if (product.quantity > 0 && product.quantity <= product.min_quantity) current.low_variant_count += 1
      current.price_min = Math.min(current.price_min, product.selling_price)
      current.price_max = Math.max(current.price_max, product.selling_price)
      if (product.size && !current.sizes.includes(product.size)) current.sizes.push(product.size)
      if (product.color && !current.colors.includes(product.color)) current.colors.push(product.color)
      if (new Date(product.updated_at).getTime() > new Date(current.updated_at).getTime()) {
        current.updated_at = product.updated_at
      }
      return
    }

    groups.set(key, {
      id: key,
      user_id: product.user_id,
      product_group_id: product.product_group_id ?? null,
      name: product.name,
      description: product.description,
      category_id: product.category_id,
      supplier_id: product.supplier_id,
      image_url: product.image_url,
      currency: product.currency,
      status: product.status,
      created_at: product.created_at,
      updated_at: product.updated_at,
      category: product.category,
      supplier: product.supplier,
      variants: [product],
      quantity: product.quantity,
      variant_count: 1,
      low_variant_count: product.quantity > 0 && product.quantity <= product.min_quantity ? 1 : 0,
      out_variant_count: product.quantity === 0 ? 1 : 0,
      price_min: product.selling_price,
      price_max: product.selling_price,
      sizes: product.size ? [product.size] : [],
      colors: product.color ? [product.color] : [],
    })
  })

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      sizes: [...group.sizes].sort((left, right) => compareVariantValues(left, right)),
      colors: [...group.colors].sort((left, right) => compareVariantValues(left, right)),
      variants: [...group.variants].sort((left, right) => (
        compareVariantValues(left.size, right.size)
        || compareVariantValues(left.color, right.color)
        || compareVariantValues(left.sku, right.sku)
        || left.created_at.localeCompare(right.created_at)
      )),
    }))
    .sort((left, right) => (
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
      || left.name.localeCompare(right.name, 'fr', { sensitivity: 'base' })
    ))
}

export function getProductGroupPriceLabel(group: ProductGroup): string {
  if (group.price_min === group.price_max) {
    return formatCurrency(group.price_min, group.currency)
  }

  return `${formatCurrency(group.price_min, group.currency)} - ${formatCurrency(group.price_max, group.currency)}`
}
