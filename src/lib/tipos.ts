// Filas de la base de datos, tal como las devuelve Supabase.

export type Nivel = 'principiante' | 'intermedio' | 'avanzado'
export type Resultado = 'cumplio' | 'parcial' | 'no_cumplio'
export type Medio = 'transferencia' | 'efectivo'
export type Molestia = 'ninguna' | 'leves' | 'fuertes'

export type Alumno = {
  id: string
  profile_id: string | null
  ci: string | null
  nombre: string
  fecha_nacimiento: string | null
  objetivo: string | null
  nivel: Nivel
  fc_max: number | null
  altura_cm: number | null
  sexo: 'F' | 'M'
  comparte_ciclo: boolean
  cuota_mensual: number
  dia_vencimiento: number
  activo: boolean
  created_at: string
}

export type TipoSesion = { codigo: string; nombre: string; color: string; orden: number }

export type Plan = {
  id: string
  alumno_id: string
  semana_inicio: string
  estado: 'borrador' | 'publicado'
  nota_semana: string | null
  copiado_de: string | null
  publicado_at: string | null
}

export type SesionPlan = {
  id: string
  plan_id: string
  fecha: string
  turno: 1 | 2
  tipo: string
  resumen: string | null
  distancia_km: number | null
  duracion_min: number | null
  ritmo_min_seg: number | null
  ritmo_max_seg: number | null
  fc_obj_min: number | null
  fc_obj_max: number | null
  estructura: string | null
  notas: string | null
}

export type Split = { km: number; tiempo_seg: number; ritmo_seg: number; fc?: number | null }

export type SesionReg = {
  id: string
  alumno_id: string
  sesion_planificada_id: string
  fecha: string
  origen: 'garmin' | 'manual'
  garmin_url: string | null
  distancia_km: number | null
  duracion_seg: number | null
  ritmo_prom_seg: number | null
  fc_prom: number | null
  fc_max: number | null
  splits: Split[]
  sensacion: number | null
  comentario_alumno: string | null
  datos_crudos?: { titulo?: string | null; desnivel_m?: number | null } | null
  created_at: string
}

export type Evaluacion = {
  id: string
  sesion_planificada_id: string
  resultado: Resultado
  comentario: string | null
  created_at: string
  leida_at: string | null
}

export type Cuota = {
  id: string
  alumno_id: string
  periodo: string
  monto: number
  vencimiento: string
  estado: 'pendiente' | 'pagada'
  pago_id: string | null
}

export type Pago = {
  id: string
  alumno_id: string
  fecha: string
  monto: number
  medio: Medio
  referencia: string | null
  created_at: string
}

export type Medicion = { id: string; alumno_id: string; fecha: string; peso_kg: number; cargado_por: string }

export type Marca = {
  id: string
  alumno_id: string
  distancia: '5K' | '10K' | '21K' | '42K' | 'otra'
  tiempo_seg: number
  fecha: string | null
  carrera: string | null
}

export type Competencia = {
  id: string
  alumno_id: string
  nombre: string
  fecha: string
  distancia_km: number | null
  tiempo_objetivo_seg: number | null
  prioridad: 'A' | 'B' | 'C'
  estado: 'propuesta' | 'aprobada' | 'rechazada'
  propuesta_por: 'alumno' | 'entrenador'
  lugar: string | null
  comentario_alumno: string | null
  comentario_entrenador: string | null
  respondida_at: string | null
  resultado_tiempo_seg: number | null
  resultado_posicion: string | null
  resultado_comentario: string | null
  resultado_link: string | null
  created_at: string
}

export type Ciclo = { id: string; alumno_id: string; fecha_inicio: string; fecha_fin: string | null }

// Sesión planificada con lo que hizo el alumno y la evaluación.
export type SesionCompleta = SesionPlan & { registro: SesionReg | null; evaluacion: Evaluacion | null }
export type SemanaCompleta = Plan & { sesiones: SesionCompleta[] }
