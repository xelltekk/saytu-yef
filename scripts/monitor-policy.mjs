const HOUR = 3600000

export function classifyHealth(status, body) {
  if (body?.app !== 'saytu-yef') return 'unreachable'
  const database = body.dependencies?.database
  const auth = body.dependencies?.auth
  if (body.status === 'ok' && status === 200 && database === 'ok' && auth === 'ok') return 'ok'
  if ((status === 200 || status === 503) && (database === 'unavailable' || auth === 'unavailable')) return 'dependency'
  return 'unreachable'
}

export function selectRuntime(apps, rows, name) {
  const matches = apps.filter((item) => item.name === name)
  if (matches.length !== 1) return { status: matches.length ? 'ambiguous' : 'missing', pid: null, direct: false, rssBytes: null, cpuPercent: null }
  const app = matches[0]
  const direct = /[/\\]next[/\\]dist[/\\]bin[/\\]next$/.test(app.pm2_env?.pm_exec_path ?? '')
  const descendants = new Set([app.pid])
  for (let pass = 0; pass < rows.length; pass++) {
    const before = descendants.size
    for (const row of rows) if (descendants.has(row.ppid)) descendants.add(row.pid)
    if (descendants.size === before) break
  }
  const candidates = direct ? rows.filter((row) => row.pid === app.pid)
    : rows.filter((row) => descendants.has(row.pid) && row.comm.startsWith('next-server'))
  const runtime = candidates.length === 1 ? candidates[0] : null
  return { status: app.pm2_env?.status ?? 'unknown', pid: runtime?.pid ?? null, direct,
    rssBytes: runtime ? runtime.rssKiB * 1024 : null,
    cpuPercent: direct && Number.isFinite(app.monit?.cpu) ? app.monit.cpu : null }
}

export function healthStatistics(samples, now) {
  const recent = samples.filter((sample) => sample.at > now - HOUR && sample.at <= now)
  const times = recent.filter((sample) => sample.public.state === 'ok').map((sample) => sample.public.durationMs).sort((a, b) => a - b)
  return { samples: recent.length, failed: recent.filter((sample) => sample.public.state !== 'ok').length,
    healthP95Ms: times.length ? times[Math.ceil(times.length * 0.95) - 1] : null, healthySamples: times.length }
}

export function planMonitor(previous, sample, limits) {
  const samples = [...(previous.samples ?? []), sample].filter((item) => item.at > sample.at - 24 * HOUR && item.at <= sample.at).slice(-720)
  const flags = []
  const bothDown = sample.local.state === 'unreachable' && sample.public.state === 'unreachable'
  const failures = bothDown ? (previous.failures ?? 0) + 1 : 0
  const registered = ['online', 'errored'].includes(sample.runtime.status)
  const cooldownEnded = !previous.lastRestartAt || sample.at - previous.lastRestartAt >= limits.cooldownMs
  const restart = bothDown && failures >= limits.failures && registered && cooldownEnded
  if (sample.local.state === 'dependency' || sample.public.state === 'dependency') flags.push('dependency')
  if (sample.public.state === 'unreachable' && sample.local.state !== 'unreachable') flags.push('public_access')
  if (sample.local.state === 'unreachable' && sample.public.state === 'ok') flags.push('local_probe')
  if (bothDown) flags.push('application_down')
  if (!registered) flags.push(`pm2_${sample.runtime.status}`)
  if (!sample.runtime.direct) flags.push('legacy_supervisor')
  if (sample.runtime.pid === null) flags.push('runtime_unknown')
  if (sample.runtime.rssBytes !== null && sample.runtime.rssBytes >= limits.memoryBytes) flags.push('memory_high')
  if (sample.diskFreeBytes !== null && sample.diskFreeBytes < limits.diskBytes) flags.push('disk_low')
  if (sample.diskFreeBytes === null) flags.push('disk_unknown')
  const stats = healthStatistics(samples, sample.at)
  if (stats.healthySamples >= 10 && stats.healthP95Ms > limits.slowMs) flags.push('health_slow')
  const signature = flags.sort().join(',')
  return { restart, stats, changed: signature !== (previous.signature ?? ''),
    state: { version: 1, samples, failures, signature, lastRestartAt: previous.lastRestartAt ?? null } }
}
