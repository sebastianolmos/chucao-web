# Chucao Web

**[Abre Chucao Web en producción](https://chucao.solmos.dev/)**

Chucao Web organiza conceptos en listas privadas y ayuda a practicar su explicación oral con un temporizador y sorteos sin repetición dentro de cada ronda. Evoluciona de [Chucao Desktop](https://github.com/sebastianolmos/chucao) y funciona en navegadores de escritorio y móvil, en español e inglés.

- Inicia sesión con Google y organiza listas y conceptos. Puedes buscar, archivar, restaurar y duplicar listas.
- Practica con conceptos de una lista o usa el temporizador independiente. El temporizador de visita se puede probar sin cuenta.
- Guarda prácticas completadas, añade notas o valoraciones y revisa tu historial privado.
- Administra tus preferencias y elimina tu cuenta de Chucao desde la aplicación.

[Privacidad](https://chucao.solmos.dev/privacy) · [Términos de uso](https://chucao.solmos.dev/terms)

## Stack

React, TypeScript y Vite para el frontend, Mantine y CSS Modules para la interfaz, TanStack Query para las consultas e i18next para la localización. Supabase aloja PostgreSQL, Auth y la Edge Function `delete-account`. Las políticas RLS y las funciones de base de datos protegen los datos según la cuenta autenticada. GitHub Actions verifica el código y publica el frontend en Cloudflare Pages.

## Desarrollo local

Necesitas Git, **Node.js 24 (mínimo 24.15.0)**, npm y Docker Desktop en ejecución. GitHub Actions también usa Node.js 24. `npm ci` instala la CLI de Supabase y las demás dependencias fijadas en `package-lock.json`. Los ejemplos usan PowerShell en Windows. En macOS o Linux, usa `npm` y `npx` en lugar de `npm.cmd` y `npx.cmd`.

```powershell
git clone --branch dev https://github.com/sebastianolmos/chucao-web.git
cd chucao-web
npm.cmd ci
```

### Configura Google OAuth para desarrollo

En tu proyecto de Google Cloud de **desarrollo**, abre **Google Auth Platform → Clients** y usa un cliente de tipo **Web application**. Configura `http://localhost:5173` como origen JavaScript y `http://127.0.0.1:54321/auth/v1/callback` como URI de redirección. En **Data Access**, configura los scopes básicos de identidad `openid`, `userinfo.email` y `userinfo.profile`. Usa las credenciales de ese cliente en un archivo `.env` en la raíz del repo. [Guía de Google OAuth en Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)

```dotenv
GOOGLE_OAUTH_CLIENT_ID=<client-id-de-desarrollo>
GOOGLE_OAUTH_CLIENT_SECRET=<client-secret-de-desarrollo>
```

### Inicia Supabase y Vite

Con Docker Desktop abierto, inicia Supabase desde la raíz y consulta su estado.

```powershell
npx.cmd --no-install supabase start
npx.cmd --no-install supabase status
```

La primera ejecución descarga las imágenes de Docker y aplica las migraciones al crear la base local. Si ves un aviso sobre `supabase/seed.sql` y el arranque termina correctamente, puedes continuar. Los runners de pruebas generan sus propios datos.

Crea `.env.local` en la raíz y usa la **Project URL** y la clave **Publishable** que muestra `supabase status`.

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key-local>
```

`.env` y `.env.local` están excluidos de Git. Las variables `VITE_*` se incorporan al frontend al compilar. Usa ahí únicamente la URL y la clave pública del entorno local.

```powershell
npm.cmd run dev -- --host localhost --port 5173 --strictPort
```

Abre [la app local](http://localhost:5173/) para que el origen coincida con la configuración OAuth. Puedes explorar la base en [Supabase Studio](http://127.0.0.1:54323/). Si cambias las credenciales de Google en `.env`, reinicia Supabase con `npx.cmd --no-install supabase stop` y `npx.cmd --no-install supabase start`. Si cambias `.env.local`, reinicia Vite.

### Verificaciones y migraciones locales

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Con Supabase local en ejecución, aplica las migraciones pendientes antes de probar la base de datos y la función de borrado.

```powershell
npx.cmd --no-install supabase migration up
node supabase/tests/run-local.mjs
node supabase/tests/run-delete-account-local.mjs
```

La CLI fijada en el repo usa la base local cuando omites `--remote`. Los runners crean y limpian datos sintéticos, y comprueban migraciones, aislamiento entre cuentas, RLS y borrado. Para comprobar que el runner de base propaga un fallo intencional, `node supabase/tests/run-local.mjs --prove-failure` debe terminar con código `1` después de verificar la limpieza. Si la ejecución se interrumpe durante la limpieza, identifica sus cuentas sintéticas por `app_metadata.fixture_run` antes de reintentar.

Cuando cambies el esquema, agrega una migración versionada en `supabase/migrations/`. Para reconstruir **una base local desechable**, `npx.cmd --no-install supabase db reset --no-seed` elimina sus datos y vuelve a aplicar las migraciones. Para conservar los datos durante el desarrollo, usa `migration up`.

## Actualizar producción

El código se desarrolla en `dev`. La rama `main` es la fuente del deploy productivo. El workflow conecta GitHub Actions con Supabase `chucao-production` y Cloudflare Pages `chucao-web`. **Verify Chucao** ejecuta lint, tests, build y las pruebas de migraciones, RLS y borrado sobre un Supabase temporal del runner. [Workflow Chucao CI/CD](.github/workflows/release.yml)

1. En `dev`, haz tus cambios, ejecuta las comprobaciones pertinentes, crea un commit y sube la rama con `git push origin dev`.
2. En GitHub, abre un pull request con **base `main`** y **compare `dev`**. Revisa el diff y espera que **Verify Chucao** quede en verde antes de hacer el merge.
3. Con `AUTO_DEPLOY_PRODUCTION=true`, el merge dispara una nueva verificación de `main`. Si pasa, Actions compila `dist/` con la configuración pública de producción, aplica las migraciones pendientes por el **Session pooler** de Supabase, despliega `delete-account` y publica el frontend en Pages.
4. En **Actions → Chucao CI/CD**, verifica que **Deploy production** termine en verde. En Cloudflare Pages, comprueba que el despliegue aparece como **Production** y que el SHA coincide con la ejecución de GitHub. Abre [Chucao](https://chucao.solmos.dev/) y comprueba los flujos que cambiaste, incluidos los enlaces públicos de privacidad y términos cuando corresponda.

Para una publicación manual, ve a **Actions → Chucao CI/CD → Run workflow**, selecciona **`main`** y confirma. Con `AUTO_DEPLOY_PRODUCTION=false`, los merges siguen ejecutando los checks y la publicación se inicia con ese botón. Si el arreglo requiere otro commit, llévalo a `main` y usa una ejecución del nuevo commit. [Ejecución manual de workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)

### Configuración del pipeline

`AUTO_DEPLOY_PRODUCTION` es una variable del repositorio en **Settings → Secrets and variables → Actions → Variables**. Las demás entradas se configuran en **Settings → Environments → production**.

| Tipo | Nombres |
| --- | --- |
| Variables de Supabase | `SUPABASE_PROJECT_REF`, `SUPABASE_DB_POOLER_HOST`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |
| Variables de Cloudflare | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_PAGES_PROJECT` |
| Secretos | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `CLOUDFLARE_API_TOKEN` |

`SUPABASE_DB_POOLER_HOST` contiene solo el hostname de **Connect → Session pooler** en Supabase. `VITE_SUPABASE_URL` contiene la URL pública de la API del mismo proyecto. `CLOUDFLARE_PAGES_PROJECT` identifica el proyecto Pages y el token de Cloudflare necesita el permiso **Pages → Edit** de esa cuenta. Las credenciales OAuth de producción se administran en el proveedor Google de Supabase Auth. [Conexiones de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres#shared-pooler-session-mode) · [Cloudflare Pages desde CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)

Si falla el deploy después de aplicar las migraciones, la base conserva las migraciones aplicadas. Revisa el paso fallido y corrige hacia delante. Una reversión de Pages solo recupera una versión del frontend y requiere compatibilidad con el esquema actual.

## Documentación del proyecto

- [Plan global](docs/global-plan.md) para el alcance, las decisiones de producto y las entregas.
- [Arquitectura](docs/architecture.md) para los límites técnicos y la propiedad de los datos.
- [Especificaciones](specs/) para los requisitos y la evidencia de cada entrega.

## Licencia y créditos

El proyecto fue creado y desarrollado por **Sebastian Olmos**. El código se distribuye bajo la [licencia MIT](LICENSE), con las excepciones indicadas a continuación.

La tipografía **Comfortaa** © 2011 The Comfortaa Project Authors se distribuye bajo la [SIL Open Font License 1.1](https://openfontlicense.org/open-font-license-official-text/).

El **sonido del chucao** fue grabado por Gabriel Morales y se distribuye bajo [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). [Grabación XC870902 en xeno-canto](https://xeno-canto.org/870902)

La edición del audio incluye reducción de ruido y recorte de fragmentos.

El audio editado y la secuencia audiovisual del temporizador se distribuyen bajo CC BY-NC-SA 4.0 y quedan excluidos de la licencia MIT.
