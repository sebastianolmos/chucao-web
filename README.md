# Chucao Web

Aplicación web para organizar conceptos en listas y practicar su explicación
oral mediante selecciones aleatorias sin repetición por ronda.

Evoluciona a partir de [Chucao Desktop](https://github.com/sebastianolmos/chucao),
incorporando cuentas de usuario, almacenamiento remoto y nuevas herramientas
de práctica. Se podrá utilizar desde navegadores de PC y teléfonos.

## Estado

Proyecto en desarrollo. En el entorno local están implementados el acceso con
Google, listas y conceptos privados, rondas, temporizador, preferencias, guardado
explícito de prácticas y notas, y consulta del historial. La implementación y la
evidencia local de VS-05 están en
[`specs/005-notes-and-history/tasks.md`](specs/005-notes-and-history/tasks.md).
VS-05 está cerrado para el alcance local validado: el usuario confirmó la revisión integrada MV-01. La inspección de Storage/URL/caché y diagnósticos del navegador (MV-02) fue excluida de este cierre y sigue sin verificarse; tampoco se afirma despliegue ni preparación para publicación. Los requisitos de publicación y el próximo slice permanecen en el plan global.

## Funcionalidades implementadas localmente

- Acceso con Google y listas/conceptos privados.
- Sorteo sin repetición, progreso persistente, edición/eliminación de conceptos e
  historial de rondas.
- Temporizador asociado e independiente con preferencias de duración, audio y
  movimiento.
- Guardado explícito de prácticas completadas con nota y rating opcionales;
  historial privado de prácticas/rondas y mantenimiento de notas.
- Interfaz localizada en español e inglés y adaptable a móvil/escritorio.

El archivado, duplicación y organización avanzada de listas pertenecen a slices
posteriores. La validación de publicación, derechos, retención de backups y
configuración de proveedores también siguen pendientes.

## Tecnologías

- React, TypeScript y Vite.
- Mantine, CSS Modules y variables CSS.
- React Hook Form y TanStack Query.
- Supabase: PostgreSQL, Auth, API y políticas RLS.
- i18next y react-i18next.
- Supabase CLI y Docker para desarrollo local.
- Cloudflare Pages para alojar el frontend.

## Desarrollo

Para instalar dependencias, configurar el entorno Vite y ejecutar la app, usa
los comandos del repositorio descritos en [`AGENTS.md`](AGENTS.md). El runner de
Supabase descrito abajo cubre solo el entorno local con Docker y datos sintéticos.

### Verificación de la base de datos local

Con las dependencias instaladas (`npm install`) y el proyecto Supabase local
iniciado con Docker (`npx supabase start`), ejecutar desde la raíz:

```sh
node supabase/tests/run-local.mjs
```

La ejecucion obtiene la configuracion local mediante la CLI de Supabase instalada;
solo acepta endpoints HTTP de loopback y nunca imprime credenciales. Aplica primero
las migraciones locales con `npx supabase migration up --local`; el runner no migra
ni reinicia la base. Requiere el esquema VS-05 actual. Crea dos usuarios sinteticos
y fixtures de listas, conceptos, preferencias, rondas y apariciones, incluido un
titulo eliminado antiguo, además de prácticas asociadas e independientes. Comprueba
lecturas del propietario, aislamiento entre cuentas y acceso anónimo, restricciones,
RPC de guardado y mantenimiento de notas (CAS, reintentos, concurrencia y recibos
sin texto), filtros/paginación del historial, apariciones de rondas y borrados
sintéticos. Incluye una carga local sintética de 1.000 prácticas para los límites y
el plan de consultas. Ejecuta aserciones en cada corrida, informa el total y limpia
los datos creados por el runner.

La preparación y limpieza usan privilegios administrativos; las comprobaciones
reciben solo clientes anónimos o con rol `authenticated`. Estos últimos usan tokens
locales firmados de diez minutos para las identidades sintéticas: no activan el
proveedor email ni prueban OAuth/Google. Las claves y tokens permanecen en memoria.

Para comprobar que un fallo de aserción se propaga al proceso:

```sh
node supabase/tests/run-local.mjs --prove-failure
```

Esta variante ejecuta las mismas comprobaciones y luego falla intencionalmente:
debe terminar con código **1**, después de confirmar la limpieza. Sin esa opción,
el resultado esperado es código **0**, comprobaciones ejecutadas y limpieza verificadas.
Los errores de preparación, comprobación o limpieza también producen código 1;
un fallo previo a las aserciones no demuestra la prueba de propagación.

La limpieza en `finally` elimina únicamente los UUID creados por la ejecución:
primero la ronda para no dejar totales anónimos, luego las cuentas y sus datos por
cascada; finalmente comprueba su ausencia. También se ejecuta ante fallos de
aserción o preparación. Una terminación forzada del proceso o pérdida de conexión
puede impedirla: no hay garantía de limpieza ante esos eventos. Ante un fallo de
limpieza, inspeccionar los usuarios sintéticos locales identificados por su
`app_metadata.fixture_run` antes de reintentar; no borrar datos por prefijos de
nombres ni reiniciar una base compartida. No usar datos reales ni producción.

Las migraciones se aplican hacia delante desde `supabase/migrations/`. Después de
aplicar una migración, corregirla mediante una nueva migración versionada; no editar
una migración ya aplicada como mecanismo de rollback. Para recuperar una base local
desechable, `npx supabase db reset --local` elimina su estado local y vuelve a
aplicar toda la cadena. No ejecutar el reset sobre datos locales que se deban
conservar, ni usarlo como procedimiento de recuperación de staging/producción. No
hay una estrategia de rollback/restauración de producción demostrada en este repo;
requiere un procedimiento operativo revisado antes de publicar.

La CLI puede necesitar permiso para escribir sus archivos de estado/telemetría
en el perfil del usuario. En PowerShell con scripts deshabilitados se puede usar
`npm.cmd`/`npx.cmd`; el comando `node` anterior no depende de scripts PowerShell.
Los módulos reutilizables están en `supabase/tests/`; no se agregó un framework
ni una suite separada por requisito.

## Licencia y créditos

El proyecto fue creado y desarrollado por **Sebastian Olmos**. El código se distribuye bajo la licencia MIT, con las excepciones indicadas a continuación.

**Tipografía:** Comfortaa © 2011 The Comfortaa Project Authors, bajo la [SIL Open Font License 1.1](https://openfontlicense.org/open-font-license-official-text/).

**Sonido del chucao:** Gabriel Morales — [XC870902, xeno-canto](https://xeno-canto.org/870902), bajo [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

**Modificaciones del audio:** reducción de ruido y recorte de fragmentos.

El audio editado y la secuencia audiovisual del temporizador se distribuyen bajo CC BY-NC-SA 4.0 y quedan excluidos de la licencia MIT.
