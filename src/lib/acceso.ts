// Ingreso con CI + PIN. Supabase Auth necesita un email, así que se arma
// uno técnico a partir de la CI. El usuario nunca lo ve.
// Lo usan el navegador, la función gestionar-acceso y el seed.

export const DOMINIO_TECNICO = 'usuarios.rivero.app'

export const limpiarCi = (ci: string) => ci.replace(/\D/g, '')

export const esCiValida = (ci: string) => /^\d{4,10}$/.test(limpiarCi(ci))

export const emailDesdeCi = (ci: string) => `${limpiarCi(ci)}@${DOMINIO_TECNICO}`

export const esPinValido = (pin: string) => /^\d{6}$/.test(pin)
