const copFmt = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

const numFmt = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })

export function cop(valor) {
  return copFmt.format(Number(valor) || 0)
}

export function millones(valor) {
  return numFmt.format((Number(valor) || 0) / 1_000_000)
}

export function pct(valor) {
  return `${numFmt.format(Number(valor) || 0)} %`
}

export function nit(valor) {
  const digitos = String(valor || '').replace(/\D/g, '')
  if (digitos.length >= 9) {
    const base = digitos.slice(0, 9).replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3')
    return digitos.length > 9 ? `${base}-${digitos.slice(9)}` : base
  }
  return valor || '—'
}

export function iniciales(nombre) {
  const partes = String(nombre || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!partes.length) return 'VI'
  const segunda = partes.length > 1 ? partes[1][0] : ''
  return `${partes[0][0] || ''}${segunda}`.toUpperCase()
}
