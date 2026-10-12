export async function readAllPages<T>(readPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, size = 500) {
  if (!Number.isInteger(size) || size <= 0) throw new Error('Taille de page invalide')
  const rows: T[] = []
  for (let offset = 0; ; offset += size) {
    const { data, error } = await readPage(offset, offset + size - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < size) return { data: rows, error: null }
  }
}
