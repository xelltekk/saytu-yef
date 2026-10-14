'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildProductGroups } from '@/lib/productGroups'
import { getCataloguePage, type CatalogueOptions, type CataloguePage } from '@/lib/supabase/catalogue'
import { useUser } from './useUser'

export function useCataloguePage(options: CatalogueOptions, refreshKey?: number) {
  const { user, accountOwnerId: ownerId } = useUser()
  const key = JSON.stringify(options)
  const [debouncedKey, setDebouncedKey] = useState(key)
  const [position, setPosition] = useState({ key, offset: 0 })
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ key: string; actor: string; offset: number; page: CataloguePage } | null>(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const offset = position.key === key ? position.offset : 0
  const reload = useCallback(() => setRevision((value) => value + 1), [])
  const setOffset = (value: number) => setPosition({ key, offset: Math.max(value, 0) })

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKey(key), 200)
    return () => clearTimeout(timer)
  }, [key])

  useEffect(() => {
    if (!user?.id || debouncedKey !== key) return
    const abort = new AbortController()
    setBusy(true)
    setError('')
    void getCataloguePage({ ...JSON.parse(key), offset, limit: 24 }, abort.signal).then((page) => {
      if (abort.signal.aborted) return
      if (offset > 0 && offset >= page.totalGroups) {
        setPosition({ key, offset: Math.max(0, Math.ceil(page.totalGroups / 24) - 1) * 24 })
        return
      }
      setResult({ key, actor: user.id, offset, page })
    }).catch((cause: unknown) => {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Impossible de charger le catalogue.')
    }).finally(() => { if (!abort.signal.aborted) setBusy(false) })
    return () => abort.abort()
  }, [key, debouncedKey, offset, refreshKey, revision, user?.id, ownerId])

  const page = result?.key === key && result.actor === user?.id && result.offset === offset
    && result.page.ownerId === ownerId ? result.page : null
  const groups = useMemo(() => {
    if (!page) return []
    const grouped = new Map(buildProductGroups(page.products).map((group) => [group.id, group]))
    return page.groupIds.flatMap((id) => grouped.has(id) ? [grouped.get(id)!] : [])
  }, [page])
  return { page, groups, loading: busy || debouncedKey !== key, error, offset, setOffset, reload }
}
