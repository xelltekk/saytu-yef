import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

export function validatePrivateBackupRequest(request) {
  if (request?.bucket !== 'expense-receipts' || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(request?.name ?? '')
    || !Number.isSafeInteger(request.size) || request.size < 1 || request.size > 5242880
    || (request.etag !== null && request.etag !== undefined && (typeof request.etag !== 'string' || request.etag.length > 150))) throw new Error('Objet de sauvegarde prive invalide.')
  return request
}
export async function fetchPrivateBackup(request, key, fetcher = fetch) {
  validatePrivateBackupRequest(request)
  if (!key || /[\r\n]/.test(key)) throw new Error('Cle de sauvegarde privee absente ou invalide.')
  const url = `https://lptxzfjdluupngqqqfrz.supabase.co/storage/v1/object/authenticated/expense-receipts/${request.name}`
  const response = await fetcher(url,{ headers:{ apikey:key,Authorization:`Bearer ${key}` },redirect:'error',signal:AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error(`Lecture du justificatif impossible (HTTP ${response.status}).`)
  if (request.etag && response.headers.get('etag') !== request.etag) throw new Error('La version du justificatif a change.')
  const announced = response.headers.get('content-length')
  if (announced && Number(announced) !== request.size) throw new Error('Taille du justificatif incoherente.')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Justificatif vide.')
  const chunks = []
  let size = 0
  try {
    for (;;) {
      const {done,value} = await reader.read()
      if (done) break
      size += value.length
      if (size > request.size || size > 5242880) throw new Error('Justificatif trop volumineux.')
      chunks.push(Buffer.from(value))
    }
  } finally { await reader.cancel().catch(() => {}) }
  if (size !== request.size) throw new Error('Justificatif incomplet.')
  return Buffer.concat(chunks)
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const request = validatePrivateBackupRequest(JSON.parse(Buffer.from(process.argv[2] ?? '', 'base64').toString('utf8')))
    const key = (await readFile('/etc/saytu-yef-storage.key','utf8')).trim()
    process.stdout.write(await fetchPrivateBackup(request,key))
  } catch {
    console.error('Sauvegarde du justificatif prive impossible. Verifier la cle serveur et la disponibilite de Storage.')
    process.exitCode = 1
  }
}
