# Rivero Track & Field

App web (PWA) para el grupo de running Rivero Track & Field: planes semanales, sesiones, feedback del entrenador y cuotas.

- **Frontend:** React + Vite + TypeScript + Tailwind CSS (carpeta `src/`)
- **Base de datos y login:** Supabase (carpeta `supabase/migrations/`)
- **Hosting y funciones de servidor:** Netlify (carpeta `netlify/functions/`)
- **Datos de prueba:** `scripts/seed.ts`

---

## Puesta en marcha (primera vez)

Se hace una sola vez, en este orden. Los comandos se escriben en una terminal abierta **en la carpeta del proyecto**. En Windows, podés abrir la carpeta en el Explorador, hacer clic en la barra de dirección, escribir `powershell` y presionar Enter.

### 1. Instalar las dependencias

Necesitás **Node.js 22 o más nuevo** ([nodejs.org](https://nodejs.org), versión LTS). Para comprobar que lo tenés: `node -v`.

```bash
npm install
```

### 2. Crear el proyecto en Supabase

1. Entrá a [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. **Name:** `rivero-track-field`. **Region:** *South America (São Paulo)*, la más cercana a Paraguay.
3. **Database password:** generá una y **guardala** (te la pide el paso 3).
4. Esperá unos minutos a que termine de crearse.

**Configurar el login (importante):**

5. Menú izquierdo → **Authentication** → **Sign In / Providers**:
   - **Allow new users to sign up:** **desactivado**. Así nadie puede crearse una cuenta solo; los accesos los crea únicamente la app.
   - En **Email**: dejalo habilitado y **desactivá "Confirm email"**. Los emails son técnicos (`CI@usuarios.rivero.app`) y no existen.
   - Guardá.

**Anotar las claves** (menú izquierdo → **Project Settings**):

6. **Data API** (o **API**): copiá la **Project URL** (`https://xxxx.supabase.co`).
7. **API Keys**:
   - **Publishable key** (`sb_publishable_…`): es pública y va en el navegador.
   - **Secret key** (`sb_secret_…`): es **secreta**. Da acceso total a la base: no la compartas, no la pegues en chats y no la subas a GitHub.
   - Si tu proyecto muestra las claves viejas, **anon** equivale a la publishable y **service_role** a la secret.
8. En la URL del panel vas a ver `supabase.com/dashboard/project/`**`abcdefghijkl`**. Esas letras son el **project ref**: anotalo.

### 3. Crear las tablas (migraciones)

```bash
npx supabase login
```
Se abre el navegador para autorizar. Después:

```bash
npx supabase link --project-ref TU_PROJECT_REF
```
Te pide la *database password* del paso 2.3. Por último:

```bash
npx supabase db push
```
Muestra la lista de migraciones y pregunta si aplicarlas: respondé `Y`. Al terminar, en **Table Editor** vas a ver las tablas (`alumnos`, `planes_semanales`, `cuotas`…).

> Cada cambio futuro de la base se agrega como un archivo nuevo en `supabase/migrations/` y se aplica con este mismo `npx supabase db push`. Nunca se crean tablas a mano en el panel.

### 4. Archivo `.env` (variables para tu computadora)

Copiá `.env.example` con el nombre `.env` y completalo:

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | Project URL (paso 2.6) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (paso 2.7) |
| `SUPABASE_SECRET_KEY` | Secret key (paso 2.7) |
| `CODIGO_INSTALACION` | Un código que inventás, por ejemplo `rivero-2026-Kx7pQ`. Se pide una sola vez, para crear el acceso del entrenador |

`.env` está en `.gitignore`: nunca se sube a GitHub.

### 5. Subir el código a GitHub

1. En [github.com/new](https://github.com/new) creá un repositorio **privado** llamado `rivero-track-field`, **sin** README ni .gitignore.
2. En la terminal, cambiando `TU_USUARIO`:

```bash
git remote add origin https://github.com/TU_USUARIO/rivero-track-field.git
git push -u origin main
```

### 6. Publicar en Netlify

1. [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project** → **GitHub** → autorizá y elegí `rivero-track-field`.
2. La configuración de build se toma sola de `netlify.toml`: no cambies nada.
3. Antes de publicar (o después, en **Site configuration → Environment variables**), cargá las **4 variables** del paso 4 con los mismos valores. En `SUPABASE_SECRET_KEY` y `CODIGO_INSTALACION`, marcá **"Contains secret values"**.
4. **Deploy**. A partir de ahora, cada `git push` publica solo la versión nueva.
5. Si cargaste o cambiaste variables después del primer deploy: **Deploys → Trigger deploy → Deploy site**.

### 7. Crear el acceso del entrenador

1. Abrí la dirección de Netlify (`https://….netlify.app`) en el celular.
2. Debajo del botón *Ingresar* aparece **"Primer uso: crear el acceso del entrenador"**.
3. Completá el código de instalación, el nombre, la CI y un PIN de 6 números.
4. Entrás directo al panel. Desde ese momento, el enlace de primer uso desaparece y la función rechaza cualquier nuevo intento.

### 8. Cargar datos de prueba (opcional)

Con el entrenador ya creado, en la app: pestaña **Alumnos** → al final, **Datos de prueba** → **Cargar datos de prueba**. (Desde la terminal también se puede con `npm run seed`.)

Crea 8 alumnos con 9 semanas de planes, sesiones, evaluaciones, pesos, ciclos, cuotas y pagos:

- Alumnos con acceso: **CI 9000001 a 9000007**, **PIN 123456**.
- Rodrigo Cáceres queda **sin acceso**, para probar el alta.
- Sofía debe 2 cuotas; Marcos debe la del mes; Javier no registra hace días; Ana y Carmen comparten el ciclo.

**Antes de empezar a usar la app en serio**, borrá los datos de prueba con el botón **Borrar datos de prueba** (o `npm run seed:limpiar`). Solo borra a esos 8 alumnos.

### 9. Instalar la app en el celular

- **Android (Chrome):** menú ⋮ → **Agregar a la pantalla principal** (o **Instalar app**).
- **iPhone (Safari):** botón **Compartir** → **Agregar a inicio**.

---

## Uso diario para desarrollar

```bash
npm run dev
```
Abre la app en `http://localhost:5173`, conectada al mismo Supabase.

> Las funciones de Netlify (primer uso, alta de accesos, reseteo de PIN) no corren con `npm run dev`. Esas pantallas se prueban en la dirección de Netlify.

## Estructura

```
public/                 logo e íconos de la PWA
src/lib/                conexión a Supabase, formatos (Gs., dd/mm, ritmos), fechas, sesión
src/components/         piezas de interfaz reutilizables
src/pages/              pantallas (entrenador/ y alumno/)
netlify/functions/      gestionar-acceso (alta y reseteo de PIN), leer-garmin (Etapa 3)
supabase/migrations/    esquema de la base de datos, versionado
scripts/seed.ts         datos de prueba
```

## Seguridad en pocas palabras

- La **secret key** de Supabase solo vive en `.env` (tu PC) y en Netlify. El navegador nunca la ve.
- Qué puede ver y cambiar cada rol lo decide **la base de datos (RLS)**, no las pantallas. Un alumno no puede leer planes en borrador, notas privadas ni datos de otros alumnos, aunque consulte la API directamente.
- El ciclo menstrual solo lo ve el entrenador si la alumna activa "Compartir con mi entrenador".
