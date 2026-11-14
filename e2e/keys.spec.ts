import { expect, test } from '@playwright/test'

import { PATIENT, signIn } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await signIn(page, PATIENT)
  await page.getByRole('link', { name: 'Profile' }).click()
})

test('a signed-in user has an encryption key with a fingerprint', async ({ page }) => {
  const card = page.getByRole('article', { name: 'Encryption key' })
  await expect(card.getByTestId('fingerprint')).toHaveText(/^([0-9A-F]{4} ){15}[0-9A-F]{4}$/)
  // The demo patient's signed PDFs come with a signing key.
  await expect(
    page.getByRole('article', { name: 'Signing key' }).getByTestId('fingerprint'),
  ).toHaveText(/^([0-9A-F]{4} ){15}[0-9A-F]{4}$/)
})

test('making a new key changes the fingerprint after confirming', async ({ page }) => {
  const card = page.getByRole('article', { name: 'Encryption key' })
  const fingerprint = card.getByTestId('fingerprint')
  await expect(fingerprint).toHaveText(/[0-9A-F]{4}/)
  const before = await fingerprint.textContent()

  await card.getByRole('button', { name: 'Make a new key' }).click()
  await expect(card.getByRole('alert')).toContainText('Keys already sent to you')
  await card.getByRole('alert').getByRole('button', { name: 'Make a new key' }).click()

  await expect(fingerprint).not.toHaveText(before!)
})

test('keeping the key changes nothing', async ({ page }) => {
  const card = page.getByRole('article', { name: 'Encryption key' })
  const fingerprint = card.getByTestId('fingerprint')
  await expect(fingerprint).toHaveText(/[0-9A-F]{4}/)
  const before = await fingerprint.textContent()

  await card.getByRole('button', { name: 'Make a new key' }).click()
  await card.getByRole('button', { name: 'Keep this one' }).click()
  await expect(fingerprint).toHaveText(before!)
})
