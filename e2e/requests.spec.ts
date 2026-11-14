import { expect, test } from '@playwright/test'

import { DOCTOR, PATIENT, signIn, signOut } from './helpers.js'

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

test('a second pending request to the same person is refused', async ({ page }) => {
  await signIn(page, DOCTOR)
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Requests' })
    .click()
  await page.getByLabel('Their username').fill(PATIENT.username)
  await page.getByRole('button', { name: 'Send request' }).click()
  // The seeded request is still pending, so the server refuses a second one.
  await expect(page.getByRole('alert')).toContainText('already have a pending request')
})

test('a patient asks the doctor for access', async ({ page }) => {
  await signIn(page, PATIENT)
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: /Requests/ })
    .click()
  await page.getByLabel('Their username').fill(DOCTOR.username)
  await page.getByLabel(/What do you need/).selectOption('PROFILE')
  await page.getByLabel(/Message/).fill('Your referral letter, please.')
  await expect(page.getByText('471 characters left')).toBeVisible()
  await page.getByRole('button', { name: 'Send request' }).click()

  await expect(page.getByRole('status')).toContainText(`Request sent to ${DOCTOR.username}`)
  await expect(page.getByRole('tab', { name: /Outgoing/ })).toHaveAttribute('aria-selected', 'true')
  const row = page.getByRole('listitem').filter({ hasText: `To ${DOCTOR.username}` })
  await expect(row).toContainText('Waiting')
  await expect(row).toContainText('Asks for: Profile')
})

test('asking an unknown user shows the server error', async ({ page }) => {
  await signIn(page, PATIENT)
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: /Requests/ })
    .click()
  await page.getByLabel('Their username').fill('nobody')
  await page.getByRole('button', { name: 'Send request' }).click()
  await expect(page.getByRole('alert')).toContainText('No user with that username')
})

test('the patient denies the request and the doctor sees it was denied', async ({ page }) => {
  await signIn(page, PATIENT)
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: /Requests/ })
    .click()
  const row = page.getByRole('listitem').filter({ hasText: `From ${DOCTOR.username}` })
  await expect(row.getByRole('button', { name: 'Approve' })).toBeEnabled()

  await row.getByRole('button', { name: 'Deny' }).click()
  await expect(row.getByRole('alert')).toContainText('They can ask again later')
  await row.getByRole('alert').getByRole('button', { name: 'Deny' }).click()
  await expect(row).toContainText('Denied')
  await expect(row.getByRole('button')).toHaveCount(0)
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Requests' }),
  ).toHaveText('Requests')

  await signOut(page)
  await signIn(page, DOCTOR)
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Requests' })
    .click()
  await page.getByRole('tab', { name: /Outgoing/ }).click()
  await expect(
    page.getByRole('listitem').filter({ hasText: `To ${PATIENT.username}` }),
  ).toContainText('Denied')
})

test('keeping a request leaves it waiting', async ({ page }) => {
  await signIn(page, PATIENT)
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: /Requests/ })
    .click()
  const row = page.getByRole('listitem').filter({ hasText: `From ${DOCTOR.username}` })
  await row.getByRole('button', { name: 'Deny' }).click()
  await row.getByRole('button', { name: 'Keep it' }).click()
  await expect(row).toContainText('Waiting')
})

test('the doctor cancels the request and can ask again', async ({ page }) => {
  await signIn(page, DOCTOR)
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Requests' })
    .click()
  await page.getByRole('tab', { name: /Outgoing/ }).click()
  const row = page.getByRole('listitem').filter({ hasText: `To ${PATIENT.username}` })
  await row.getByRole('button', { name: 'Cancel request' }).click()
  await row.getByRole('alert').getByRole('button', { name: 'Cancel request' }).click()
  await expect(row).toContainText('Cancelled')

  await page.getByLabel('Their username').fill(PATIENT.username)
  await page.getByRole('button', { name: 'Send request' }).click()
  await expect(page.getByRole('status')).toContainText(`Request sent to ${PATIENT.username}`)
})
