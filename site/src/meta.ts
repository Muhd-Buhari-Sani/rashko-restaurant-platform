import { useEffect } from 'react'

// Matches <title> in index.html, so the first paint and every later page agree.
export const BASE_TITLE = 'Rashko Restaurant | Yemeni & Arabian Cuisine in Kano'

/**
 * Sets the browser tab title for a page. The site is a single-page app, so without this
 * every route — checkout, an order, a policy — would keep the home page's title. `null`
 * restores the home title.
 */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · Rashko Restaurant` : BASE_TITLE
  }, [title])
}
