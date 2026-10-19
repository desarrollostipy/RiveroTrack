# Rivero Track & Field — Instalar esta versión

Son 5 pasos. Hacelos en este orden.

## 1. Supabase: actualizar la base de datos
1. Supabase → tu proyecto → **SQL Editor** → **New query**.
2. Abrí `supabase/instalar-o-actualizar.sql` (o `rivero-instalar-o-actualizar.sql` de Descargas) con el Bloc de notas, copiá **todo** y pegalo.
3. Tocá **Run** → tiene que decir **Success**.

> Se puede correr aunque ya hayas corrido algunos SQL anteriores: lo que existe no se toca y lo que falta se crea. No hace falta correr los archivos sueltos de antes.

## 2. Netlify: claves de las notificaciones
En Netlify → **Project configuration → Environment variables → Add a variable**, cargá las 3 del archivo `rivero-claves-notificaciones.txt` (está en Descargas):

| Key | Valor |
|---|---|
| `VITE_VAPID_PUBLIC_KEY` | la clave pública |
| `VAPID_PRIVATE_KEY` | la clave privada — marcá **Contains secret values** |
| `VAPID_CONTACTO` | `mailto:` + tu correo |

Las variables que ya tenías (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `CODIGO_INSTALACION`) quedan igual.

## 3. GitHub: subir el código
1. Descomprimí `rivero-completo-final.zip`.
2. En la **página principal** del repositorio → **Add file → Upload files**.
3. Abrí la carpeta descomprimida, seleccioná todo (**Ctrl+A**) y arrastralo. Se reemplazan los archivos existentes.
4. **Commit changes**.

## 4. Netlify: publicar
1. **Project configuration → Build & deploy → Build settings**: el **Base directory** tiene que estar **vacío**.
2. **Deploys → Trigger deploy → Deploy project** y esperá **Published**.
3. En el registro tiene que decir: `5 new function(s)` y, en *Scheduled functions*, `recordatorio-diario`.

## 5. En los celulares
- **Ícono nuevo:** borrá la app de la pantalla de inicio y volvé a agregarla (Android: menú ⋮ → *Agregar a pantalla principal*; iPhone: Compartir → *Agregar a inicio*).
- **Notificaciones:** cada uno entra a **Mi perfil** (tocando su foto) → **🔔 Activar notificaciones**. Llega una de prueba.
  - En **iPhone** primero hay que agregar la app a la pantalla de inicio y abrirla desde ese ícono (iOS 16.4 o más nuevo).
- **Modo noche:** Mi perfil → Pantalla → ☀️ Día / 🌙 Noche / 📱 Automático.

---

## Prueba rápida (5 minutos)
1. Entrenador: tocá **☰** (arriba, al lado del **+**) → **Grupos** → creá "Grupo 21K". Asigná alumnos desde **Editar** en cada ficha.
2. **☰ → Anuncios** → publicá uno. Con un alumno, mirá **Hoy**: tiene que aparecer arriba.
3. **Planes** → un alumno → abrí un día → **🧩 Guardar como plantilla**. Abrí otro día → **🧩 Usar una plantilla**.
4. En el mismo editor → **👥 Copiar a otros** → **Todo Grupo 21K**.
5. **Chat**: mandá un mensaje y verificá que al alumno le llega la notificación.
6. **Cuentas** → en un alumno con cuota vencida → **📲 Recordar** abre WhatsApp con el mensaje armado. (Cargá el celular del alumno en su ficha → Editar.)
7. **☰ → Asistencia → + Nuevo** → marcá quién vino.
8. Alumno: **Progreso** (logros y 📊 Calculadora) y **Semana → 📅 Agregar al calendario del celular**.

## Qué incluye esta versión
- Logo nuevo, versión clara para modo noche, íconos del navegador y del celular.
- Modo día / noche / automático.
- Mi perfil: foto, estado de 24 h (emoji, mensaje, canción), cambiar PIN.
- Chat alumno ↔ entrenador con emojis y "leído".
- Notificaciones push: plan publicado, mensajes, anuncios, evaluaciones, competencias, sesión registrada y recordatorio la noche anterior (20:00).
- Rachas y logros · Calculadora de ritmos · Agregar entrenamientos al calendario.
- Anuncios · Plantillas de sesión · Grupos y copiar plan a varios · Recordatorio de cuota por WhatsApp · Asistencia a entrenamientos grupales.
- Todo lo anterior: registro de alumnos con aprobación, CI única, pulso objetivo, competencias, link de Garmin, resumen completo de cada sesión, carga más rápida.
