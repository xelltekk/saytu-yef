'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Banknote, CheckCircle2, History, RefreshCw, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { CashSession } from '@/types'

interface CashSessionPanelProps {
  activeSession: CashSession | null
  history: CashSession[]
  loading: boolean
  error: string
  isCashier: boolean
  mode?: 'compact' | 'detailed'
  onRefresh: () => void
  onOpenSession: (openingAmount: number, note?: string) => Promise<void>
  onCloseSession: (closingAmount: number, note?: string) => Promise<void>
}

function formatSessionDate(value?: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('fr-SN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function CashSessionPanel({
  activeSession,
  history,
  loading,
  error,
  isCashier,
  mode = 'detailed',
  onRefresh,
  onOpenSession,
  onCloseSession,
}: CashSessionPanelProps) {
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [showCloseModal, setShowCloseModal] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('')
  const [openingNote, setOpeningNote] = useState('')
  const [closingAmount, setClosingAmount] = useState('')
  const [closingNote, setClosingNote] = useState('')
  const [pendingAction, setPendingAction] = useState<'open' | 'close' | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const liveSummary = activeSession?.live_summary ?? null
  const expectedCash = liveSummary?.expected_cash_amount ?? Number(activeSession?.expected_cash_amount ?? 0)
  const isCompact = mode === 'compact'
  const cashGapPreview = useMemo(() => {
    const parsed = Number(closingAmount)
    if (Number.isNaN(parsed)) return null
    return parsed - expectedCash
  }, [closingAmount, expectedCash])
  const closeNoteRequired = (cashGapPreview ?? 0) !== 0

  useEffect(() => {
    if (!feedback) return
    const timeout = window.setTimeout(() => setFeedback(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [feedback])

  useEffect(() => {
    if (!showOpenModal) {
      setOpeningAmount('')
      setOpeningNote('')
    }
  }, [showOpenModal])

  useEffect(() => {
    if (showCloseModal && activeSession) {
      setClosingAmount(String(Math.round(expectedCash)))
      setClosingNote('')
      return
    }

    if (!showCloseModal) {
      setClosingAmount('')
      setClosingNote('')
    }
  }, [activeSession, expectedCash, showCloseModal])

  const handleOpenSession = async () => {
    const parsed = Number(openingAmount)
    if (!openingAmount.trim() || Number.isNaN(parsed) || parsed < 0) {
      setFeedback({ type: 'error', message: 'Saisissez un fond initial valide pour ouvrir la caisse.' })
      return
    }

    try {
      setPendingAction('open')
      await onOpenSession(parsed, openingNote)
      setShowOpenModal(false)
      setFeedback({ type: 'success', message: 'La session de caisse a bien ete ouverte.' })
    } catch (actionError) {
      setFeedback({
        type: 'error',
        message: actionError instanceof Error ? actionError.message : "Impossible d'ouvrir la caisse.",
      })
    } finally {
      setPendingAction(null)
    }
  }

  const handleCloseSession = async () => {
    if (!activeSession) return
    const parsed = Number(closingAmount)
    if (!closingAmount.trim() || Number.isNaN(parsed) || parsed < 0) {
      setFeedback({ type: 'error', message: 'Saisissez un montant compte valide pour cloturer la caisse.' })
      return
    }

    if (Math.abs((cashGapPreview ?? 0)) > 0.009 && !closingNote.trim()) {
      setFeedback({ type: 'error', message: "Ajoutez une note pour expliquer l'ecart de caisse avant validation." })
      return
    }

    try {
      setPendingAction('close')
      await onCloseSession(parsed, closingNote)
      setShowCloseModal(false)
      setFeedback({ type: 'success', message: 'La cloture de caisse a ete validee.' })
    } catch (actionError) {
      setFeedback({
        type: 'error',
        message: actionError instanceof Error ? actionError.message : 'Impossible de cloturer la caisse.',
      })
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <>
      <section className={`rounded-[28px] border border-[#2D7D7D]/[0.08] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,247,251,0.98))] shadow-[0_16px_40px_rgba(26,54,54,0.06)] ${isCompact ? 'p-3 sm:p-4' : 'p-4 sm:p-5'}`}>
        <div className={`flex flex-col lg:flex-row lg:justify-between ${isCompact ? 'gap-2 lg:items-center' : 'gap-3 lg:items-start'}`}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2D7D7D]">
              {isCashier ? 'Session personnelle' : 'Gestion de caisse'}
            </p>
            <h3 className={`mt-1 font-semibold text-[#1A3636] ${isCompact ? 'text-base' : 'text-lg'}`}>Ouverture / fermeture de caisse</h3>
            <p className={`text-[#6B7682] ${isCompact ? 'mt-0.5 text-[11px]' : 'mt-1 text-xs'}`}>
              {isCompact
                ? 'Ouvrez votre session avant de vendre, puis cloturez-la a la fin du service.'
                : 'Un fond initial par utilisateur, une session ouverte a la fois, puis une cloture avec verification.'}
            </p>
          </div>

          <div className={`flex flex-wrap gap-2 ${isCompact ? 'lg:justify-end' : ''}`}>
            <Button variant="outline" size="md" onClick={onRefresh} leftIcon={<RefreshCw size={14} />}>
              Actualiser
            </Button>
            {activeSession ? (
              <Button variant="teal" size="md" onClick={() => setShowCloseModal(true)} leftIcon={<Wallet size={14} />}>
                Cloturer ma caisse
              </Button>
            ) : (
              <Button variant="primary" size="md" onClick={() => setShowOpenModal(true)} leftIcon={<Banknote size={14} />}>
                Ouvrir ma caisse
              </Button>
            )}
          </div>
        </div>

        {feedback && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${
              feedback.type === 'success'
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
                : 'border-red-500/20 bg-red-500/10 text-red-700'
            }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={18} className="mt-0.5 shrink-0" /> : <AlertCircle size={18} className="mt-0.5 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className={`mt-4 grid gap-3 ${isCompact ? 'sm:grid-cols-2 xl:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
            {[1, 2, 3, 4].slice(0, isCompact ? 2 : 4).map((card) => (
              <div key={card} className="animate-pulse rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-4 py-4">
                <div className="h-3 w-24 rounded bg-[#2D7D7D]/[0.08]" />
                <div className="mt-3 h-7 w-28 rounded bg-[#2D7D7D]/[0.08]" />
                <div className="mt-2 h-3 w-20 rounded bg-[#F4F7FB]" />
              </div>
            ))}
          </div>
        ) : activeSession ? (
          <>
            <div className={`flex flex-wrap items-center gap-2 ${isCompact ? 'mt-3' : 'mt-4'}`}>
              <Badge variant="success">Session ouverte</Badge>
              <Badge variant="primary">{formatSessionDate(activeSession.opened_at)}</Badge>
              <Badge variant="default">
                Fond initial {formatCurrency(Number(activeSession.opening_amount ?? 0))}
              </Badge>
            </div>

            {isCompact ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Fond de caisse</p>
                  <p className="mt-0.5 text-base font-bold text-[#1A3636]">{formatCurrency(Number(activeSession.opening_amount ?? 0))}</p>
                  <p className="text-[11px] text-[#6B7682]">Detail complet disponible dans Rapports.</p>
                </div>
                <div className="rounded-2xl border border-[#6C5CE7]/20 bg-[#6C5CE7]/10 px-3 py-2.5 text-sm text-[#1A3636]">
                  <span className="font-semibold text-[#6C5CE7]">Cloture</span> en fin de service
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Fond initial</p>
                    <p className="mt-1 text-xl font-bold text-[#1A3636]">{formatCurrency(Number(activeSession.opening_amount ?? 0))}</p>
                    <p className="text-[11px] text-[#6B7682]">au demarrage</p>
                  </div>
                  <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Especes encaissees</p>
                    <p className="mt-1 text-xl font-bold text-[#2D7D7D]">{formatCurrency(liveSummary?.cash_collected ?? 0)}</p>
                    <p className="text-[11px] text-[#6B7682]">paiements cash</p>
                  </div>
                  <div className="rounded-2xl border border-[#6C5CE7]/20 bg-[#6C5CE7]/10 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#6C5CE7]">Especes attendues</p>
                    <p className="mt-1 text-xl font-bold text-[#6C5CE7]">{formatCurrency(expectedCash)}</p>
                    <p className="text-[11px] text-[#6B7682]">fond + cash</p>
                  </div>
                  <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Ventes</p>
                    <p className="mt-1 text-xl font-bold text-[#1A3636]">{liveSummary?.sales_count ?? 0}</p>
                    <p className="text-[11px] text-[#6B7682]">{formatCurrency(liveSummary?.total_invoiced ?? 0)} factures</p>
                  </div>
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-700">Reste a encaisser</p>
                    <p className="mt-1 text-xl font-bold text-amber-700">{formatCurrency(liveSummary?.total_due ?? 0)}</p>
                    <p className="text-[11px] text-amber-700/80">{liveSummary?.payments_count ?? 0} versement(s)</p>
                  </div>
                </div>

                {(activeSession.opening_note ?? '').trim() && (
                  <div className="mt-4 rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6B73]">Note d&apos;ouverture</p>
                    <p className="mt-1 text-sm text-[#1A3636]">{activeSession.opening_note}</p>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          isCompact ? (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-dashed border-[#2D7D7D]/[0.16] bg-white/85 px-3 py-2.5 text-sm text-[#5C6B73]">
              <Wallet size={16} className="shrink-0 text-[#2D7D7D]" />
              <p className="min-w-0">
                <span className="font-semibold text-[#1A3636]">Aucune caisse ouverte.</span>{' '}
                <span className="text-[#6B7682]">Ouvrez une session pour commencer les ventes.</span>
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-[#2D7D7D]/[0.18] bg-white/80 px-4 py-5 text-sm text-[#5C6B73]">
              <div className="flex items-start gap-3">
                <Wallet size={20} className="mt-0.5 shrink-0 text-[#2D7D7D]" />
                <div>
                  <p className="font-semibold text-[#1A3636]">Aucune caisse ouverte pour le moment</p>
                  <p className="mt-1">
                    Ouvrez une session avec votre fond initial avant de vendre ou d&apos;encaisser un versement client.
                  </p>
                </div>
              </div>
            </div>
          )
        )}

        {!isCompact && (
          <div className="mt-5 rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-4 py-4">
          <div className="flex items-center gap-2">
            <History size={16} className="text-[#6B7682]" />
            <h4 className="text-sm font-semibold text-[#1A3636]">Historique des sessions</h4>
            <Badge variant="default">{history.length}</Badge>
          </div>

          {history.length === 0 ? (
            <p className="mt-3 text-sm text-[#6B7682]">Aucune session cloturee pour cet utilisateur.</p>
          ) : (
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {history.slice(0, 6).map((session) => {
                const gap = Number(session.cash_gap ?? 0)
                const gapLabel = gap === 0
                  ? 'Aucun ecart'
                  : gap > 0
                    ? `Surplus ${formatCurrency(gap)}`
                    : `Manque ${formatCurrency(Math.abs(gap))}`

                return (
                  <div key={session.id} className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#FDFEFE] px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="primary">{formatDate(session.opened_at)}</Badge>
                      <Badge variant={gap === 0 ? 'success' : 'warning'}>{gapLabel}</Badge>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.06em] text-[#6B7682]">Ouverture</p>
                        <p className="mt-1 font-semibold text-[#1A3636]">{formatCurrency(Number(session.opening_amount ?? 0))}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.06em] text-[#6B7682]">Cloture</p>
                        <p className="mt-1 font-semibold text-[#1A3636]">{formatCurrency(Number(session.closing_amount ?? 0))}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.06em] text-[#6B7682]">Attendu</p>
                        <p className="mt-1 font-semibold text-[#1A3636]">{formatCurrency(Number(session.expected_cash_amount ?? 0))}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.06em] text-[#6B7682]">Ventes</p>
                        <p className="mt-1 font-semibold text-[#1A3636]">{session.sales_count ?? 0}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[#6B7682]">
                      <span>{formatSessionDate(session.closed_at ?? session.opened_at)}</span>
                      <span>{formatCurrency(Number(session.total_collected ?? 0))} encaisses</span>
                      <span>{formatCurrency(Number(session.total_due ?? 0))} restent dus</span>
                    </div>

                    {(session.closing_note ?? '').trim() && (
                      <div className="mt-3 rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-3 py-3 text-sm text-[#1A3636]">
                        {session.closing_note}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          </div>
        )}
      </section>

      <Modal
        isOpen={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        title="Ouvrir ma caisse"
        footer={
          <>
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setShowOpenModal(false)}>
              Annuler
            </Button>
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              onClick={handleOpenSession}
              isLoading={pendingAction === 'open'}
            >
              Valider l&apos;ouverture
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Fond initial"
            type="number"
            min="0"
            step="1"
            value={openingAmount}
            onChange={(event) => setOpeningAmount(event.target.value)}
            placeholder="ex: 25000"
            leftAddon={<Banknote size={14} />}
            hint="Montant disponible en debut de service."
          />
          <Textarea
            label="Note d'ouverture (optionnelle)"
            rows={3}
            value={openingNote}
            onChange={(event) => setOpeningNote(event.target.value)}
            placeholder="ex: fond remis par le gerant, petite monnaie preparee..."
          />
        </div>
      </Modal>

      <Modal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        title="Cloturer ma caisse"
        footer={
          <>
            <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setShowCloseModal(false)}>
              Retour
            </Button>
            <Button
              variant="teal"
              className="w-full sm:w-auto"
              onClick={handleCloseSession}
              isLoading={pendingAction === 'close'}
            >
              Valider la cloture
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-[#F4F7FB] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-[#6B7682]">Ouverte le</p>
              <p className="mt-1 text-sm font-semibold text-[#1A3636]">{formatSessionDate(activeSession?.opened_at)}</p>
            </div>
            <div className="rounded-2xl border border-[#6C5CE7]/15 bg-[#6C5CE7]/[0.05] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-[#6C5CE7]">Especes attendues</p>
              <p className="mt-1 text-sm font-semibold text-[#1A3636]">{formatCurrency(expectedCash)}</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-[#6B7682]">Ventes</p>
              <p className="mt-1 text-sm font-semibold text-[#1A3636]">{liveSummary?.sales_count ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-[#6B7682]">Encaisse</p>
              <p className="mt-1 text-sm font-semibold text-[#1A3636]">{formatCurrency(liveSummary?.total_collected ?? 0)}</p>
            </div>
            <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-[#6B7682]">Dettes ouvertes</p>
              <p className="mt-1 text-sm font-semibold text-[#1A3636]">{formatCurrency(liveSummary?.total_due ?? 0)}</p>
            </div>
          </div>

          <Input
            label="Montant compte en caisse"
            type="number"
            min="0"
            step="1"
            value={closingAmount}
            onChange={(event) => setClosingAmount(event.target.value)}
            placeholder="ex: 73500"
            leftAddon={<Wallet size={14} />}
            hint="Le systeme comparera ce montant aux especes attendues."
          />

          {cashGapPreview !== null && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                Math.abs(cashGapPreview) <= 0.009
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700'
                  : 'border-amber-500/20 bg-amber-500/10 text-amber-700'
              }`}
            >
              {Math.abs(cashGapPreview) <= 0.009
                ? 'Le montant compte correspond aux especes attendues.'
                : cashGapPreview > 0
                  ? `Surplus constate: ${formatCurrency(cashGapPreview)}`
                  : `Manque constate: ${formatCurrency(Math.abs(cashGapPreview))}`}
            </div>
          )}

          <Textarea
            label={closeNoteRequired ? 'Note de cloture (requise s&apos;il y a un ecart)' : 'Note de cloture (optionnelle)'}
            rows={3}
            value={closingNote}
            onChange={(event) => setClosingNote(event.target.value)}
            placeholder="ex: monnaie rendue hors systeme, erreur de rendu, depot effectue..."
            hint="Cette note sera enregistree dans l&apos;historique de session."
          />
        </div>
      </Modal>
    </>
  )
}
