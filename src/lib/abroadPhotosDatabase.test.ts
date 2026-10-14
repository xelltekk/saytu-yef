import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

it('adds an optional photo without changing existing purchases and can be reapplied', async () => {
  const db = new PGlite()
  try {
    await db.exec("CREATE TABLE public.abroad_products(id text PRIMARY KEY, name text); INSERT INTO public.abroad_products VALUES('old','Telephone');")
    const sql = readFileSync('supabase/migrations/20261014152621_abroad_product_photos.sql', 'utf8')
    await db.exec(sql)
    await db.exec(sql)
    expect((await db.query('SELECT * FROM public.abroad_products')).rows).toEqual([{ id: 'old', name: 'Telephone', image_url: null }])
    await db.query('UPDATE public.abroad_products SET image_url=$1 WHERE id=$2', ['https://example.invalid/photo.jpg', 'old'])
    expect((await db.query<{ image_url: string }>('SELECT image_url FROM public.abroad_products')).rows[0].image_url).toBe('https://example.invalid/photo.jpg')
  } finally {
    await db.close()
  }
}, 20000)
