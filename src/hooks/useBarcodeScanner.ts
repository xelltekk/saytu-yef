'use client'

import { useEffect, useRef } from 'react'

type UseBarcodeScannerOptions = {
  enabled?: boolean
  minLength?: number
  maxInterKeyDelayMs?: number
  idleTimeoutMs?: number
  onScan: (value: string) => void
}

function isEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true

  const tagName = target.tagName
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT'
}

export function useBarcodeScanner({
  enabled = true,
  minLength = 4,
  maxInterKeyDelayMs = 85,
  idleTimeoutMs = 180,
  onScan,
}: UseBarcodeScannerOptions) {
  const onScanRef = useRef(onScan)

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    let buffer = ''
    let lastKeyAt = 0
    let flushTimer: number | null = null

    const reset = () => {
      buffer = ''
      lastKeyAt = 0
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer)
        flushTimer = null
      }
    }

    const flush = () => {
      const scannedValue = buffer.trim()
      reset()

      if (document.querySelector('[role="dialog"][aria-modal="true"]') || isEditableElement(document.activeElement)) return

      if (scannedValue.length >= minLength) {
        onScanRef.current(scannedValue)
      }
    }

    const scheduleFlush = () => {
      if (flushTimer !== null) {
        window.clearTimeout(flushTimer)
      }

      flushTimer = window.setTimeout(() => {
        flush()
      }, idleTimeoutMs)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) {
        reset()
        return
      }

      if (isEditableElement(event.target) || document.querySelector('[role="dialog"][aria-modal="true"]')) {
        reset()
        return
      }

      const now = event.timeStamp || (typeof performance !== 'undefined' ? performance.now() : Date.now())

      if (event.key === 'Enter' || event.key === 'Tab') {
        if (buffer.length >= minLength) {
          event.preventDefault()
          flush()
        } else {
          reset()
        }
        return
      }

      if (event.key.length !== 1) return

      // A cold renderer can delay the first pair; repeated slow keys still reset.
      if (lastKeyAt && now - lastKeyAt > maxInterKeyDelayMs && buffer.length > 1) {
        buffer = ''
      }

      buffer += event.key
      lastKeyAt = now
      scheduleFlush()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', reset)
      reset()
    }
  }, [enabled, idleTimeoutMs, maxInterKeyDelayMs, minLength])
}
