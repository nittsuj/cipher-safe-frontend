import { test, expect } from '@playwright/test'

// Smoke test: the app should show the sign-in screen for anonymous visitors.
test('redirects to the sign-in screen', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  await expect(page.getByLabel('Username')).toBeVisible()
})
