export const resources = {
  es: {
    translation: {
      app: {
        title: 'Chucao',
        authenticatedTitle: 'Chucao - Mis listas',
        listTitle: 'Chucao - Lista',
      },
      access: {
        title: 'Chucao Web',
        subtitle: 'Práctica de conceptos',
        continueWithGoogle: 'Continuar con Google',
        connecting: 'Cargando…',
        language: 'Idioma',
        spanish: 'Español',
        english: 'English',
        privacy: 'Privacidad',
      },
      auth: {
        checkingSession: 'Comprobando sesión…',
        preparingPrivateSpace: 'Preparando tu espacio privado…',
        signedInAs: 'Sesión iniciada como {{email}}',
        oauthError: 'No se completó el acceso con Google. Intenta de nuevo.',
        signInError: 'No se pudo iniciar el acceso con Google. Intenta de nuevo.',
        signOutError: 'No se pudo cerrar la sesión. Intenta de nuevo.',
        sessionError: 'No se pudo comprobar la sesión. Intenta de nuevo.',
        profileError: 'No se pudo preparar tu espacio privado. Intenta de nuevo.',
        retry: 'Reintentar',
        signOut: 'Cerrar sesión',
      },
      lists: {
        title: 'Mis listas',
        loading: 'Cargando tus listas…',
        empty: 'Todavía no tienes listas.',
        create: 'Crear lista',
        created: 'Lista creada correctamente.',
        count: '{{count}} lista(s)',
        emptyDetail: 'Lista privada vacía.',
        privateContext: 'Tus listas son privadas y solo pertenecen a tu cuenta.',
        name: 'Nombre de la lista',
        retry: 'Reintentar',
        submit: 'Guardar lista',
        duplicate: 'Ya tienes una lista con ese nombre.',
        limit: 'Alcanzaste el límite de 100 listas.',
        unresolved: 'No se pudo confirmar el resultado. Revisa tus listas antes de reintentar.',
        unavailable: 'No se pudo cargar o guardar la lista. Intenta de nuevo.',
        unauthorized: 'Tu sesión ya no puede acceder a esta lista.',
        sessionExpired: 'Tu sesión expiró. Vuelve a iniciar sesión para continuar.',
      },
      detail: {
        title: 'Detalle de la lista',
        empty: 'Los conceptos todavía no están disponibles en esta versión.',
        back: 'Volver a Mis listas',
      },
      validation: {
        required: 'Escribe un nombre para la lista.',
        tooLong: 'El nombre no puede superar los 80 caracteres.',
      },
      preference: {
        reading: 'Sincronizando idioma…',
        saving: 'Guardando idioma…',
        readError: 'No se pudo leer tu preferencia de idioma.',
        writeError: 'No se pudo guardar tu preferencia de idioma.',
        retry: 'Reintentar sincronización',
      },
      privacy: {
        title: 'Privacidad',
        version: 'Versión local VS-01 · 17 de noviembre de 2026',
        intro:
          'Este aviso describe el procesamiento activado por el primer slice de Chucao Web. Es contenido local de revisión y no reemplaza la publicación legal final.',
        dataTitle: 'Datos que se utilizan',
        data:
          'Google y Supabase Auth gestionan la identidad y la sesión. Chucao utiliza el identificador estable de la cuenta, el correo mostrado por Auth para el contexto de sesión, la preferencia de idioma y los nombres de tus listas privadas.',
        purposesTitle: 'Para qué se utilizan',
        purposes:
          'Estos datos permiten iniciar sesión, preparar tu perfil, recordar el idioma elegido, guardar tus listas y aplicar la separación de datos entre cuentas. No se activan analítica, publicidad ni contenido público en este slice.',
        providersTitle: 'Proveedores y transferencias',
        providers:
          'Google participa en la autenticación delegada. Supabase proporciona Auth, la base de datos y las políticas de acceso. La revisión de roles, ubicaciones, transferencias y condiciones de proveedores para publicación queda pendiente.',
        retentionTitle: 'Conservación y eliminación',
        retention:
          'Las listas y preferencias permanecen asociadas a tu cuenta mientras el servicio las necesite. El slice no incluye todavía una automatización de eliminación de cuenta o datos; la política de conservación y borrado para producción debe publicarse antes de activar usuarios reales.',
        rightsTitle: 'Derechos y contacto',
        rights:
          'La información sobre acceso, rectificación, eliminación, oposición y otros derechos dependerá de la ley aplicable. La identificación final del responsable y el canal de contacto deben confirmarse y publicarse antes del lanzamiento.',
        securityTitle: 'Seguridad',
        security:
          'La autenticación usa Google/Supabase con PKCE. La base de datos aplica RLS y deriva la propiedad desde el UUID autenticado; no se almacenan contraseñas de Google ni claves privilegiadas en el navegador.',
        pending:
          'Pendiente: revisión del responsable, contacto, proveedores, transferencias, conservación, derechos y publicación legal definitiva.',
        back: 'Volver',
      },
    },
  },
  en: {
    translation: {
      app: {
        title: 'Chucao',
        authenticatedTitle: 'Chucao - My Lists',
        listTitle: 'Chucao - List',
      },
      access: {
        title: 'Chucao Web',
        subtitle: 'Concept practice',
        continueWithGoogle: 'Continue with Google',
        connecting: 'Loading…',
        language: 'Language',
        spanish: 'Español',
        english: 'English',
        privacy: 'Privacy',
      },
      auth: {
        checkingSession: 'Checking session…',
        preparingPrivateSpace: 'Preparing your private space…',
        signedInAs: 'Signed in as {{email}}',
        oauthError: 'Google access was not completed. Try again.',
        signInError: 'Google sign-in could not be started. Try again.',
        signOutError: 'Sign-out could not be completed. Try again.',
        sessionError: 'The session could not be checked. Try again.',
        profileError: 'Your private space could not be prepared. Try again.',
        retry: 'Retry',
        signOut: 'Sign out',
      },
      lists: {
        title: 'My Lists',
        loading: 'Loading your lists…',
        empty: 'You do not have any lists yet.',
        create: 'Create list',
        created: 'List created successfully.',
        count: '{{count}} list(s)',
        emptyDetail: 'Private empty list.',
        privateContext: 'Your lists are private and belong only to your account.',
        name: 'List name',
        retry: 'Retry',
        submit: 'Save list',
        duplicate: 'You already have a list with that name.',
        limit: 'You reached the limit of 100 lists.',
        unresolved: 'The result could not be confirmed. Check your lists before retrying.',
        unavailable: 'The list could not be loaded or saved. Try again.',
        unauthorized: 'Your session cannot access this list anymore.',
        sessionExpired: 'Your session expired. Sign in again to continue.',
      },
      detail: {
        title: 'List detail',
        empty: 'Concepts are not available in this version yet.',
        back: 'Back to My Lists',
      },
      validation: {
        required: 'Enter a list name.',
        tooLong: 'The name cannot exceed 80 characters.',
      },
      preference: {
        reading: 'Synchronizing language…',
        saving: 'Saving language…',
        readError: 'Your language preference could not be read.',
        writeError: 'Your language preference could not be saved.',
        retry: 'Retry synchronization',
      },
      privacy: {
        title: 'Privacy',
        version: 'Local VS-01 version · 17 November 2026',
        intro:
          'This notice describes the processing activated by the first Chucao Web slice. It is local review content and does not replace the final legal publication.',
        dataTitle: 'Data used',
        data:
          'Google and Supabase Auth manage identity and session data. Chucao uses the stable account identifier, the email displayed by Auth for session context, the language preference, and the names of your private lists.',
        purposesTitle: 'Purposes',
        purposes:
          'These data support sign-in, profile initialization, language preference, list persistence, and account-level data isolation. Analytics, advertising, and public content are not activated in this slice.',
        providersTitle: 'Providers and transfers',
        providers:
          'Google participates in delegated authentication. Supabase provides Auth, the database, and access policies. Review of provider roles, locations, transfers, and terms for publication remains pending.',
        retentionTitle: 'Retention and deletion',
        retention:
          'Lists and preferences remain associated with your account while the service needs them. This slice does not yet include automated account or data deletion; the production retention and deletion policy must be published before real users are activated.',
        rightsTitle: 'Rights and contact',
        rights:
          'Information about access, correction, deletion, objection, and other rights depends on applicable law. The final controller identification and contact channel must be confirmed and published before launch.',
        securityTitle: 'Security',
        security:
          'Authentication uses Google/Supabase with PKCE. The database applies RLS and derives ownership from the authenticated UUID; Google passwords and privileged keys are not stored in the browser.',
        pending:
          'Pending: controller, contact, provider, transfer, retention, rights, and final legal publication review.',
        back: 'Back',
      },
    },
  },
} as const;
