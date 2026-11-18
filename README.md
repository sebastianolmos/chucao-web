# Chucao Web

Aplicación web para organizar conceptos en listas y practicar su explicación
oral mediante selecciones aleatorias sin repetición por ronda.

Evoluciona a partir de [Chucao Desktop](https://github.com/sebastianolmos/chucao),
incorporando cuentas de usuario, almacenamiento remoto y nuevas herramientas
de práctica. Se podrá utilizar desde navegadores de PC y teléfonos.

## Estado

Proyecto en planificación y desarrollo inicial.
Las funcionalidades descritas a continuación forman parte del alcance previsto.

## Funcionalidades previstas

- Cuentas de usuario y listas privadas.
- Creación, edición, duplicación y archivo de listas.
- Conceptos con título y descripción, editables individualmente o por conjuntos.
- Sorteo sin repetición, progreso persistente y consulta de pendientes y vistos.
- Temporizador configurable con animación del chucao y sonido al finalizar.
- Notas de práctica e historial de sesiones y rondas.
- Interfaz adaptable a móvil y escritorio, en español e inglés.

## Tecnologías

- React, TypeScript y Vite.
- Mantine, CSS Modules y variables CSS.
- React Hook Form y TanStack Query.
- Supabase: PostgreSQL, Auth, API y políticas RLS.
- i18next y react-i18next.
- Supabase CLI y Docker para desarrollo local.
- Cloudflare Pages para alojar el frontend.

## Desarrollo

Las instrucciones de instalación, configuración y ejecución se añadirán
cuando esté preparada la base del proyecto.

## Licencia y créditos

El proyecto fue creado y desarrollado por **Sebastian Olmos**. El código se distribuye bajo la licencia MIT, con las excepciones indicadas a continuación.

**Tipografía:** Comfortaa © 2011 The Comfortaa Project Authors, bajo la [SIL Open Font License 1.1](https://openfontlicense.org/open-font-license-official-text/).

**Sonido del chucao:** Gabriel Morales — [XC870902, xeno-canto](https://xeno-canto.org/870902), bajo [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

**Modificaciones del audio:** reducción de ruido y recorte de fragmentos.

El audio editado y la secuencia audiovisual del temporizador se distribuyen bajo CC BY-NC-SA 4.0 y quedan excluidos de la licencia MIT.
