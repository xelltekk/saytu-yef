export const dynamic = 'force-dynamic'

const html = String.raw`<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reinitialisation PWA - Saytu Yef</title>
    <style>
      :root {
        color-scheme: light;
      }

      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: linear-gradient(180deg, #f7f9ff 0%, #eef3ff 100%);
        font-family: Arial, sans-serif;
        color: #1a3636;
      }

      main {
        width: min(92vw, 440px);
        border: 1px solid rgba(45, 125, 125, 0.12);
        border-radius: 24px;
        background: #ffffff;
        padding: 24px;
        box-shadow: 0 18px 56px rgba(26, 54, 54, 0.12);
        text-align: center;
      }

      h1 {
        margin: 0 0 12px;
        font-size: 24px;
      }

      p {
        margin: 0;
        line-height: 1.6;
        color: #5c6b73;
      }

      #status {
        margin-top: 16px;
        font-weight: 700;
        color: #2d7d7d;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Nettoyage de l'application</h1>
      <p>Suppression de l'ancien mode hors ligne, puis retour vers Saytu Yef.</p>
      <p id="status">Nettoyage en cours...</p>
    </main>

    <script>
      (async () => {
        const status = document.getElementById('status')

        try {
          if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations()
            await Promise.all(registrations.map((registration) => registration.unregister()))
          }

          if ('caches' in window) {
            const cacheKeys = await caches.keys()
            await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)))
          }

          status.textContent = 'Nettoyage termine. Redirection...'
          window.setTimeout(() => {
            window.location.replace('/?fresh=' + Date.now())
          }, 600)
        } catch (error) {
          console.error(error)
          status.textContent = 'Le nettoyage automatique a echoue. Rafraichissez la page.'
        }
      })()
    </script>
  </body>
</html>
`

export function GET() {
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
