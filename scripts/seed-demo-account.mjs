import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_FULL_NAME = 'Equipe demo XELLTEKK'
const DEFAULT_BUSINESS_NAME = 'XELLTEKK Mobile & Accessoires'
const DEFAULT_PHONE = '+221 77 123 45 67'
const DEFAULT_ADDRESS = 'Parcelles Assainies, Dakar'

function printHelp() {
  console.log(`
Usage:
  npm run demo:seed -- --email "kha2006dim+demo@gmail.com" --password "motdepasse"

Options:
  --email <value>             Email du compte demo
  --password <value>          Mot de passe du compte demo
  --full-name <value>         Nom affiche du profil
  --business-name <value>     Nom commercial demo
  --phone <value>             Telephone de la boutique
  --address <value>           Adresse de la boutique
  --create-if-missing         Cree le compte si aucun compte n'existe encore
  --force-reset               Reinitialise aussi les comptes deja remplis
  --help                      Affiche cette aide

Variables d'environnement acceptees:
  DEMO_EMAIL
  DEMO_PASSWORD
  DEMO_FULL_NAME
  DEMO_BUSINESS_NAME
  DEMO_PHONE
  DEMO_ADDRESS

Exemple:
  npm run demo:seed -- --email "kha2006dim+demo@gmail.com" --password "Khagueye@@161184" --create-if-missing
`)
}

function parseEnvFile(filePath, protectedKeys) {
  if (!existsSync(filePath)) return

  const content = readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex < 0) continue

    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (protectedKeys.has(key)) continue
    process.env[key] = value
  }
}

function loadLocalEnv() {
  const protectedKeys = new Set(Object.keys(process.env))
  parseEnvFile(path.resolve('.env'), protectedKeys)
  parseEnvFile(path.resolve('.env.local'), protectedKeys)
}

function parseArgs(argv) {
  const args = {
    email: process.env.DEMO_EMAIL ?? '',
    password: process.env.DEMO_PASSWORD ?? '',
    fullName: process.env.DEMO_FULL_NAME ?? DEFAULT_FULL_NAME,
    businessName: process.env.DEMO_BUSINESS_NAME ?? DEFAULT_BUSINESS_NAME,
    phone: process.env.DEMO_PHONE ?? DEFAULT_PHONE,
    address: process.env.DEMO_ADDRESS ?? DEFAULT_ADDRESS,
    createIfMissing: false,
    forceReset: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    const nextValue = argv[index + 1]

    if (token === '--help' || token === '-h') {
      args.help = true
      continue
    }

    if (token === '--create-if-missing') {
      args.createIfMissing = true
      continue
    }

    if (token === '--force-reset') {
      args.forceReset = true
      continue
    }

    if (token === '--email' && nextValue) {
      args.email = nextValue
      index += 1
      continue
    }

    if (token === '--password' && nextValue) {
      args.password = nextValue
      index += 1
      continue
    }

    if (token === '--full-name' && nextValue) {
      args.fullName = nextValue
      index += 1
      continue
    }

    if (token === '--business-name' && nextValue) {
      args.businessName = nextValue
      index += 1
      continue
    }

    if (token === '--phone' && nextValue) {
      args.phone = nextValue
      index += 1
      continue
    }

    if (token === '--address' && nextValue) {
      args.address = nextValue
      index += 1
      continue
    }
  }

  return args
}

function daysAgo(days, hour, minute) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  date.setUTCHours(hour, minute, 0, 0)
  return date.toISOString()
}

function buildDemoData() {
  const categories = [
    { key: 'phones', name: 'Smartphones', color: '#6C5CE7' },
    { key: 'accessories', name: 'Accessoires', color: '#2D7D7D' },
    { key: 'computers', name: 'Informatique', color: '#F59E0B' },
    { key: 'audio', name: 'Audio', color: '#EF4444' },
  ]

  const suppliers = [
    {
      key: 'dakar-mobile',
      name: 'Dakar Mobile Pro',
      contact_name: 'Mamadou Kane',
      phone: '+221774001010',
      email: 'contact@dakarmobilepro.sn',
      address: 'HLM Grand Yoff, Dakar',
      country: 'SN',
    },
    {
      key: 'sen-access',
      name: 'Sen Access Tech',
      contact_name: 'Aminata Sow',
      phone: '+221762203030',
      email: 'sales@senaccesstech.sn',
      address: 'Colobane, Dakar',
      country: 'SN',
    },
    {
      key: 'ngor-info',
      name: 'Ngor Info Distribution',
      contact_name: 'Cheikh Ba',
      phone: '+221785551212',
      email: 'pro@ngorinfo.sn',
      address: 'Ngor, Dakar',
      country: 'SN',
    },
  ]

  const products = [
    {
      sku: 'IPH15-128-BLK',
      name: 'iPhone 15 128 Go',
      description: 'Modele vedette pour la boutique demo.',
      categoryKey: 'phones',
      supplierKey: 'dakar-mobile',
      buying_price: 480000,
      selling_price: 520000,
      quantity: 6,
      min_quantity: 2,
    },
    {
      sku: 'IPH17-256-WHT',
      name: 'iPhone 17 256 Go',
      description: 'Produit premium pour vente rapide.',
      categoryKey: 'phones',
      supplierKey: 'dakar-mobile',
      buying_price: 780000,
      selling_price: 850000,
      quantity: 4,
      min_quantity: 5,
    },
    {
      sku: 'AW-S5-45',
      name: 'Montre Apple Watch Serie 5',
      description: 'Montre connectee tres demandee.',
      categoryKey: 'accessories',
      supplierKey: 'sen-access',
      buying_price: 540000,
      selling_price: 650000,
      quantity: 4,
      min_quantity: 2,
    },
    {
      sku: 'HP450-I3-500',
      name: 'HP ProBook 450 i3 500 Go',
      description: 'PC portable polyvalent pour etudiants et bureaux.',
      categoryKey: 'computers',
      supplierKey: 'ngor-info',
      buying_price: 235000,
      selling_price: 275000,
      quantity: 9,
      min_quantity: 3,
    },
    {
      sku: 'SSD-512-SATA',
      name: 'Disque SSD 512 Go',
      description: 'Upgrade rapide pour PC et portables.',
      categoryKey: 'computers',
      supplierKey: 'ngor-info',
      buying_price: 65000,
      selling_price: 100000,
      quantity: 11,
      min_quantity: 4,
    },
    {
      sku: 'KB-WIRELESS',
      name: 'Clavier sans fil',
      description: 'Clavier compact pour bureautique.',
      categoryKey: 'computers',
      supplierKey: 'ngor-info',
      buying_price: 12000,
      selling_price: 19000,
      quantity: 8,
      min_quantity: 3,
    },
    {
      sku: 'MOUSE-WIRED',
      name: 'Souris filaire',
      description: 'Accessoire entree de gamme a forte rotation.',
      categoryKey: 'computers',
      supplierKey: 'ngor-info',
      buying_price: 5000,
      selling_price: 8000,
      quantity: 15,
      min_quantity: 5,
    },
    {
      sku: 'EAR-BT-01',
      name: 'Ecouteurs Bluetooth',
      description: 'Ecouteurs sans fil pour smartphone.',
      categoryKey: 'audio',
      supplierKey: 'sen-access',
      buying_price: 9500,
      selling_price: 15000,
      quantity: 17,
      min_quantity: 6,
    },
    {
      sku: 'USB-C-FAST',
      name: 'Chargeur rapide USB-C',
      description: 'Chargeur rapide compatible Android et iPhone.',
      categoryKey: 'accessories',
      supplierKey: 'sen-access',
      buying_price: 3500,
      selling_price: 6000,
      quantity: 21,
      min_quantity: 8,
    },
    {
      sku: 'CASE-IPH15',
      name: 'Coque iPhone 15',
      description: 'Coque de protection transparente.',
      categoryKey: 'accessories',
      supplierKey: 'sen-access',
      buying_price: 1500,
      selling_price: 3500,
      quantity: 3,
      min_quantity: 4,
    },
  ]

  const sales = [
    {
      customer_name: 'Boutique Comptoir',
      customer_phone: '+221781112233',
      created_at: daysAgo(0, 18, 20),
      discount: 0,
      tax: 0,
      notes: 'Vente rapide fin de journee.',
      items: [
        { sku: 'MOUSE-WIRED', quantity: 2 },
        { sku: 'USB-C-FAST', quantity: 1 },
      ],
      payments: [
        { amount: 22000, payment_method: 'cash', note: 'Regle comptant', created_at: daysAgo(0, 18, 22) },
      ],
    },
    {
      customer_name: 'Mamadou Diop',
      customer_phone: '+221770000111',
      created_at: daysAgo(1, 14, 30),
      discount: 0,
      tax: 0,
      notes: 'Client fidelise par recommandation.',
      items: [
        { sku: 'IPH15-128-BLK', quantity: 1 },
        { sku: 'CASE-IPH15', quantity: 1 },
      ],
      payments: [
        { amount: 523500, payment_method: 'cash', note: 'Reglement complet', created_at: daysAgo(1, 14, 33) },
      ],
    },
    {
      customer_name: 'Awa Ndiaye',
      customer_phone: '+221776665544',
      created_at: daysAgo(3, 11, 15),
      discount: 0,
      tax: 0,
      notes: 'Solde attendu vendredi prochain.',
      items: [
        { sku: 'HP450-I3-500', quantity: 1 },
        { sku: 'MOUSE-WIRED', quantity: 1 },
      ],
      payments: [
        { amount: 150000, payment_method: 'wave', note: 'Acompte initial', created_at: daysAgo(3, 11, 20) },
        { amount: 50000, payment_method: 'wave', note: 'Complement recu', created_at: daysAgo(1, 9, 10) },
      ],
    },
    {
      customer_name: 'Cheikh Ba',
      customer_phone: '+221782223344',
      created_at: daysAgo(9, 16, 0),
      discount: 0,
      tax: 0,
      notes: 'Client entreprise, relance prevue.',
      items: [
        { sku: 'SSD-512-SATA', quantity: 1 },
        { sku: 'KB-WIRELESS', quantity: 1 },
      ],
      payments: [
        { amount: 50000, payment_method: 'orange_money', note: 'Acompte OM', created_at: daysAgo(9, 16, 5) },
      ],
    },
    {
      customer_name: 'Fatou Sarr',
      customer_phone: '+221775554433',
      created_at: daysAgo(22, 13, 10),
      discount: 0,
      tax: 0,
      notes: 'Remise promo pack accessoires.',
      items: [
        { sku: 'EAR-BT-01', quantity: 2 },
        { sku: 'USB-C-FAST', quantity: 1 },
      ],
      payments: [
        { amount: 36000, payment_method: 'card', note: 'Paiement TPE', created_at: daysAgo(22, 13, 12) },
      ],
    },
    {
      customer_name: 'Ibrahima Fall',
      customer_phone: '+221779991122',
      created_at: daysAgo(39, 9, 40),
      discount: 0,
      tax: 0,
      notes: 'Dette ouverte sur article premium.',
      items: [
        { sku: 'AW-S5-45', quantity: 1 },
      ],
      payments: [
        { amount: 300000, payment_method: 'wave', note: 'Acompte initial', created_at: daysAgo(39, 9, 45) },
        { amount: 100000, payment_method: 'cash', note: 'Versement complementaire', created_at: daysAgo(32, 17, 5) },
      ],
    },
  ]

  return { categories, suppliers, products, sales }
}

function getEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Variable d'environnement manquante: ${name}`)
  }
  return value
}

function getConfiguredPublicOrigin() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.APP_URL?.trim()
  if (!raw) {
    throw new Error("NEXT_PUBLIC_SITE_URL ou APP_URL doit pointer vers le domaine public.")
  }

  try {
    return new URL(raw).origin
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL ou APP_URL n'est pas une URL valide.")
  }
}

async function countRows(supabase, table) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })

  if (error) throw error
  return count ?? 0
}

async function getTableIds(supabase, table) {
  const { data, error } = await supabase.from(table).select('id')
  if (error) throw error
  return (data ?? []).map((row) => row.id)
}

async function deleteByIds(supabase, table, ids) {
  if (ids.length === 0) return

  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100)
    const { error } = await supabase.from(table).delete().in('id', chunk)
    if (error) throw error
  }
}

async function wipeAccountData(supabase) {
  const salesIds = await getTableIds(supabase, 'sales')
  await deleteByIds(supabase, 'sales', salesIds)

  const abroadIds = await getTableIds(supabase, 'abroad_products')
  await deleteByIds(supabase, 'abroad_products', abroadIds)

  const productIds = await getTableIds(supabase, 'products')
  await deleteByIds(supabase, 'products', productIds)

  const supplierIds = await getTableIds(supabase, 'suppliers')
  await deleteByIds(supabase, 'suppliers', supplierIds)

  const categoryIds = await getTableIds(supabase, 'categories')
  await deleteByIds(supabase, 'categories', categoryIds)
}

async function signInOrCreateAccount(supabase, options) {
  const signInResult = await supabase.auth.signInWithPassword({
    email: options.email,
    password: options.password,
  })

  if (!signInResult.error && signInResult.data.user) {
    return {
      status: 'signed-in',
      user: signInResult.data.user,
      session: signInResult.data.session,
    }
  }

  if (!options.createIfMissing) {
    throw signInResult.error ?? new Error('Connexion impossible.')
  }

  const signUpResult = await supabase.auth.signUp({
    email: options.email,
    password: options.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      data: {
        full_name: options.fullName,
      },
    },
  })

  if (signUpResult.error) {
    throw signUpResult.error
  }

  if (!signUpResult.data.user) {
    throw new Error('Le compte demo n a pas pu etre cree.')
  }

  if (!signUpResult.data.session) {
    return {
      status: 'confirmation-required',
      user: signUpResult.data.user,
      session: null,
    }
  }

  return {
    status: 'created-and-signed-in',
    user: signUpResult.data.user,
    session: signUpResult.data.session,
  }
}

async function seedDemoData(supabase, userId, options) {
  const profilePayload = {
    full_name: options.fullName,
    business_name: options.businessName,
    phone: options.phone,
    business_address: options.address,
    tax_enabled: false,
    tax_rate: 0,
    updated_at: new Date().toISOString(),
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update(profilePayload)
    .eq('id', userId)
  if (profileError) throw profileError

  const countsBefore = {
    categories: await countRows(supabase, 'categories'),
    suppliers: await countRows(supabase, 'suppliers'),
    products: await countRows(supabase, 'products'),
    sales: await countRows(supabase, 'sales'),
    abroad_products: await countRows(supabase, 'abroad_products'),
  }

  const alreadyFilled = Object.values(countsBefore).some((count) => count > 0)
  if (alreadyFilled && !options.forceReset) {
    throw new Error(
      `Ce compte contient deja des donnees (${JSON.stringify(countsBefore)}). ` +
      'Relance avec --force-reset uniquement si tu veux le transformer en compte demo.'
    )
  }

  await wipeAccountData(supabase)

  const { categories, suppliers, products, sales } = buildDemoData()

  const { data: createdCategories, error: categoriesError } = await supabase
    .from('categories')
    .insert(categories.map((category) => ({
      user_id: userId,
      name: category.name,
      color: category.color,
    })))
    .select()
  if (categoriesError) throw categoriesError

  const categoryByKey = new Map(
    categories.map((category) => [
      category.key,
      createdCategories?.find((row) => row.name === category.name),
    ])
  )

  const { data: createdSuppliers, error: suppliersError } = await supabase
    .from('suppliers')
    .insert(suppliers.map((supplier) => ({
      user_id: userId,
      name: supplier.name,
      contact_name: supplier.contact_name,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      country: supplier.country,
    })))
    .select()
  if (suppliersError) throw suppliersError

  const supplierByKey = new Map(
    suppliers.map((supplier) => [
      supplier.key,
      createdSuppliers?.find((row) => row.name === supplier.name),
    ])
  )

  const initialStockCreatedAt = daysAgo(75, 10, 0)

  const productRows = products.map((product) => {
    const category = categoryByKey.get(product.categoryKey)
    const supplier = supplierByKey.get(product.supplierKey)

    if (!category?.id) throw new Error(`Categorie introuvable pour ${product.name}`)
    if (!supplier?.id) throw new Error(`Fournisseur introuvable pour ${product.name}`)

    return {
      user_id: userId,
      sku: product.sku,
      name: product.name,
      description: product.description,
      category_id: category.id,
      supplier_id: supplier.id,
      buying_price: product.buying_price,
      selling_price: product.selling_price,
      quantity: product.quantity,
      min_quantity: product.min_quantity,
      currency: 'XOF',
      status: 'active',
    }
  })

  const { data: createdProducts, error: productsError } = await supabase
    .from('products')
    .insert(productRows)
    .select()
  if (productsError) throw productsError

  const productBySku = new Map((createdProducts ?? []).map((product) => [product.sku, product]))

  const { error: stockSeedError } = await supabase
    .from('stock_movements')
    .insert((createdProducts ?? []).map((product) => ({
      user_id: userId,
      product_id: product.id,
      movement_type: 'in',
      quantity: product.quantity,
      previous_quantity: 0,
      new_quantity: product.quantity,
      reason: 'Stock initial demo',
      created_at: initialStockCreatedAt,
    })))
  if (stockSeedError) throw stockSeedError

  for (const saleTemplate of sales) {
    const preparedItems = saleTemplate.items.map((item) => {
      const product = productBySku.get(item.sku)
      if (!product?.id) throw new Error(`Produit introuvable pour la vente demo: ${item.sku}`)
      const unitPrice = Number(product.selling_price)
      return {
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        total: unitPrice * item.quantity,
      }
    })

    const subtotal = preparedItems.reduce((sum, item) => sum + item.total, 0)
    const discount = saleTemplate.discount ?? 0
    const tax = saleTemplate.tax ?? 0
    const total = subtotal - discount + tax
    const amountPaid = saleTemplate.payments.reduce((sum, payment) => sum + payment.amount, 0)
    const amountDue = Math.max(total - amountPaid, 0)
    const paymentStatus = amountDue > 0 ? (amountPaid > 0 ? 'partial' : 'pending') : 'completed'
    const finalPaymentMethod = saleTemplate.payments.at(-1)?.payment_method ?? 'cash'

    const { data: createdSale, error: saleError } = await supabase
      .from('sales')
      .insert({
        user_id: userId,
        customer_name: saleTemplate.customer_name,
        customer_phone: saleTemplate.customer_phone,
        subtotal,
        discount,
        tax,
        total,
        amount_paid: amountPaid,
        amount_due: amountDue,
        payment_method: finalPaymentMethod,
        payment_status: paymentStatus,
        notes: saleTemplate.notes,
        created_at: saleTemplate.created_at,
      })
      .select()
      .single()
    if (saleError) throw saleError

    const { error: saleItemsError } = await supabase
      .from('sale_items')
      .insert(preparedItems.map((item) => ({
        sale_id: createdSale.id,
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        created_at: saleTemplate.created_at,
      })))
    if (saleItemsError) throw saleItemsError

    const { error: saleStockDatesError } = await supabase
      .from('stock_movements')
      .update({ created_at: saleTemplate.created_at })
      .eq('reason', `Vente ${createdSale.id}`)
    if (saleStockDatesError) throw saleStockDatesError

    const { error: paymentsError } = await supabase
      .from('sale_payments')
      .insert(saleTemplate.payments.map((payment) => ({
        sale_id: createdSale.id,
        user_id: userId,
        amount: payment.amount,
        payment_method: payment.payment_method,
        note: payment.note,
        created_at: payment.created_at,
      })))
    if (paymentsError) throw paymentsError
  }

  const countsAfter = {
    categories: await countRows(supabase, 'categories'),
    suppliers: await countRows(supabase, 'suppliers'),
    products: await countRows(supabase, 'products'),
    sales: await countRows(supabase, 'sales'),
    abroad_products: await countRows(supabase, 'abroad_products'),
  }

  return countsAfter
}

async function main() {
  loadLocalEnv()

  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  if (!options.email || !options.password) {
    printHelp()
    throw new Error('Email et mot de passe requis pour preparer le compte demo.')
  }

  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const publicOrigin = getConfiguredPublicOrigin()

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  process.env.NEXT_PUBLIC_SITE_URL = publicOrigin
  const accountResult = await signInOrCreateAccount(supabase, options)

  if (accountResult.status === 'confirmation-required') {
    console.log(`Compte demo cree pour ${options.email}.`)
    console.log('Confirme le mail recu, puis relance exactement la meme commande pour injecter les donnees demo.')
    return
  }

  const user = accountResult.user
  if (!user?.id) throw new Error('Session demo introuvable.')

  const counts = await seedDemoData(supabase, user.id, options)

  console.log('Compte demo pret.')
  console.log(JSON.stringify({
    email: options.email,
    businessName: options.businessName,
    counts,
    nextStep: 'Connecte-toi avec ce compte pour verifier inventaire, ventes, dettes et rapports.',
  }, null, 2))

  await supabase.auth.signOut()
}

main().catch((error) => {
  if (error instanceof Error) {
    const enriched = {
      name: error.name,
      message: error.message,
      code: 'code' in error ? error.code : undefined,
      status: 'status' in error ? error.status : undefined,
      details: 'details' in error ? error.details : undefined,
      hint: 'hint' in error ? error.hint : undefined,
    }
    console.error(`Erreur demo: ${JSON.stringify(enriched)}`)
  } else if (error && typeof error === 'object') {
    console.error(`Erreur demo: ${JSON.stringify(error)}`)
  } else {
    console.error(`Erreur demo: ${String(error)}`)
  }
  process.exit(1)
})
