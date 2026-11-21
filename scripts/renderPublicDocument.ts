import { resources } from '../src/i18n/resources.ts'

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

type PublicDocument = 'privacy' | 'terms'
type Locale = keyof typeof resources

export function renderPublicDocument(document: PublicDocument, locale: Locale) {
  const copy = resources[locale].translation
  const titleId = `${document}-title`
  const alternate = locale === 'es'
    ? `<a href="/${document}/en" lang="en" hreflang="en">English</a>`
    : `<a href="/${document}" lang="es" hreflang="es">Español</a>`
  const body = document === 'privacy' ? renderPrivacy(locale) : renderTerms(locale)

  return `
    <main class="privacy-page">
      <article class="privacy-panel" aria-labelledby="${titleId}">
        <div class="privacy-links">
          <a href="/">${escapeHtml(copy.privacy.home)}</a>
          ${alternate}
        </div>
        <h1 id="${titleId}">${escapeHtml(copy[document].title)}</h1>
        ${body}
      </article>
    </main>`
}

function renderPrivacy(locale: Locale) {
  const copy = resources[locale].translation.privacy

  return `
        <p>${escapeHtml(copy.version)}</p>
        <p>${escapeHtml(copy.intro)}</p>
        <h2>${escapeHtml(copy.dataTitle)}</h2>
        <p>${escapeHtml(copy.data)}</p>
        <p>${escapeHtml(copy.session)}</p>
        <h2>${escapeHtml(copy.providersTitle)}</h2>
        <p>${escapeHtml(copy.providers)}</p>
        <p>${escapeHtml(copy.analytics)}</p>
        <h2>${escapeHtml(copy.retentionTitle)}</h2>
        <p>${escapeHtml(copy.retention)}</p>
        <p>${escapeHtml(copy.deletionDetails)}</p>
        <p>${escapeHtml(copy.backups)}</p>
        <h2>${escapeHtml(copy.rightsTitle)}</h2>
        <p>${escapeHtml(copy.rightsIntro)} <a href="mailto:${escapeHtml(copy.contactEmail)}">${escapeHtml(copy.contactEmail)}</a>${escapeHtml(copy.rightsOutro)}</p>`
}

function renderTerms(locale: Locale) {
  const { terms, privacy } = resources[locale].translation
  const privacyUrl = locale === 'en' ? '/privacy/en' : '/privacy'
  const contactEmail = escapeHtml(privacy.contactEmail)

  return `
        <p>${escapeHtml(terms.intro)}</p>
        <h2>${escapeHtml(terms.useTitle)}</h2>
        <p>${escapeHtml(terms.use)}</p>
        <p>${escapeHtml(terms.content)}</p>
        <h2>${escapeHtml(terms.accountTitle)}</h2>
        <p>${escapeHtml(terms.account)}</p>
        <p><a href="${privacyUrl}">${escapeHtml(terms.privacyLink)}</a>.</p>
        <p>${escapeHtml(terms.contact)} <a href="mailto:${contactEmail}">${contactEmail}</a>.</p>`
}
