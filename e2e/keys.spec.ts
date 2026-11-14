import { expect, test } from '@playwright/test'

import { DOCTOR, PATIENT, signIn, signOut } from './helpers.js'

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

test('a doctor sees their encryption key fingerprint on the Requests page', async ({ page }) => {
  await signOut(page)
  await signIn(page, DOCTOR)
  const card = page.getByRole('article', { name: 'Encryption key' })
  await expect(card.getByTestId('fingerprint')).toHaveText(/^([0-9A-F]{4} ){15}[0-9A-F]{4}$/)
  // Doctors don't sign records, so no signing key card.
  await expect(page.getByRole('article', { name: 'Signing key' })).toHaveCount(0)
})

test("the fingerprint the owner sees when approving matches the doctor's own", async ({ page }) => {
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: /Requests/ })
    .click()
  await page
    .getByRole('listitem')
    .filter({ hasText: `From ${DOCTOR.username}` })
    .getByRole('button', { name: 'Approve' })
    .click()
  const dialog = page.getByRole('dialog', { name: `Approve ${DOCTOR.username}'s request` })
  await dialog.getByRole('checkbox', { name: /lab-result-hba1c\.txt/ }).check()
  await dialog.getByRole('button', { name: 'Approve and make keys' }).click()
  const shown = (await dialog.locator('.fp').first().textContent())!.replace(/\s+/g, ' ').trim()
  await dialog.getByRole('button', { name: 'Done' }).click()

  await signOut(page)
  await signIn(page, DOCTOR)
  const own = page.getByRole('article', { name: 'Encryption key' }).getByTestId('fingerprint')
  await expect(own).toHaveText(shown)
})
