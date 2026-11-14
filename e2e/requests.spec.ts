import { expect, test } from '@playwright/test'

import { DOCTOR, PATIENT, signIn } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('the patient sees the waiting request from the doctor', async ({ page }) => {
  await signIn(page, PATIENT)
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav.getByRole('link', { name: /Requests/ })).toContainText('1')
  await nav.getByRole('link', { name: /Requests/ }).click()

  const row = page.getByRole('listitem').filter({ hasText: `From ${DOCTOR.username}` })
  await expect(row).toContainText('Waiting')
  await expect(row).toContainText('for the check-up on Monday')
  await expect(row).toContainText('Asks for: Medical document')
})

test('the doctor sees the same request under Outgoing', async ({ page }) => {
  await signIn(page, DOCTOR)
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Requests' })
    .click()
  await expect(page.getByRole('heading', { name: 'No requests for your data' })).toBeVisible()

  await page.getByRole('tab', { name: /Outgoing/ }).click()
  await expect(page.getByRole('tab', { name: /Outgoing/ })).toHaveAttribute('aria-selected', 'true')
  await expect(
    page.getByRole('listitem').filter({ hasText: `To ${PATIENT.username}` }),
  ).toContainText('Waiting')
})
