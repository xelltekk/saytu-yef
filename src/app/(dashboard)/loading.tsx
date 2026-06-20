export default function DashboardLoading() {
  return (
    <main className="min-h-screen" aria-label="Chargement de la page" aria-busy="true">
      <div className="border-b border-[#2D7D7D]/[0.08] bg-white px-4 py-4 lg:px-6">
        <div className="skeleton h-5 w-40" />
        <div className="skeleton mt-2 h-3 w-56 max-w-full" />
      </div>

      <div className="space-y-5 p-3 sm:p-4 lg:p-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-4">
              <div className="skeleton h-3 w-24 max-w-full" />
              <div className="skeleton mt-4 h-7 w-28 max-w-full" />
              <div className="skeleton mt-3 h-3 w-20 max-w-full" />
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-4 lg:col-span-2">
            <div className="skeleton h-4 w-36" />
            <div className="skeleton mt-5 h-56 w-full" />
          </div>
          <div className="rounded-2xl border border-[#2D7D7D]/[0.08] bg-white p-4">
            <div className="skeleton h-4 w-32" />
            <div className="mt-5 space-y-3">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="skeleton h-12 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
