import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { renderPublicDocument } from './scripts/renderPublicDocument.ts'

const publicDocuments = {
  'privacy.html': ['privacy', 'es'],
  'privacy/en.html': ['privacy', 'en'],
  'terms.html': ['terms', 'es'],
  'terms/en.html': ['terms', 'en'],
} as const

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'chucao-public-documents',
      transformIndexHtml(html, { path }) {
        const page = path.slice(1)
        if (!Object.hasOwn(publicDocuments, page)) return html
        const [document, locale] = publicDocuments[page as keyof typeof publicDocuments]
        return html.replace('<!-- public document -->', () => renderPublicDocument(document, locale))
      },
    },
  ],
  build: {
    rolldownOptions: {
      input: ['index.html', ...Object.keys(publicDocuments)],
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
  },
})
