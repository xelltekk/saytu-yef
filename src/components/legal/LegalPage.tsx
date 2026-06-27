import Link from 'next/link'
import { ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react'

export type LegalSection = {
  title: string
  paragraphs?: string[]
  items?: string[]
}

interface LegalPageProps {
  badge: string
  title: string
  description: string
  updatedAt: string
  sections: LegalSection[]
  disclaimer?: string
}

export function LegalPage({ badge, title, description, updatedAt, sections, disclaimer }: LegalPageProps) {
  return (
    <main className="min-h-screen gradient-bg px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#2D7D7D] transition-colors hover:text-[#1A3636]">
          <ArrowLeft size={16} /> Retour à l’accueil
        </Link>

        <section className="rounded-3xl border border-[#2D7D7D]/[0.08] bg-white p-5 shadow-[0_18px_50px_rgba(26,54,54,0.08)] sm:p-8">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#6C5CE7]/20 bg-[#6C5CE7]/10 px-3 py-1.5 text-xs font-semibold text-[#6C5CE7]">
            <ShieldCheck size={14} /> {badge}
          </div>

          <h1 className="text-3xl font-bold leading-tight text-[#1A3636] sm:text-4xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#5C6B73]">{description}</p>
          <p className="mt-4 text-xs font-medium text-[#6B7682]">Dernière mise à jour : {updatedAt}</p>

          {disclaimer && (
            <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-relaxed text-amber-800">
              {disclaimer}
            </div>
          )}

          <div className="mt-8 space-y-6">
            {sections.map((section) => (
              <article key={section.title} className="rounded-2xl border border-[#2D7D7D]/[0.07] bg-[#F4F7FB] p-4 sm:p-5">
                <h2 className="text-base font-semibold text-[#1A3636]">{section.title}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-3 text-sm leading-relaxed text-[#5C6B73]">
                    {paragraph}
                  </p>
                ))}
                {section.items && (
                  <ul className="mt-3 space-y-2">
                    {section.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm leading-relaxed text-[#5C6B73]">
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
