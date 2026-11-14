import { expect, test, type Page } from '@playwright/test'

import { DOCTOR, PATIENT, signIn } from './helpers.js'

/** As the patient, open the approve dialog for the seeded request from the doctor. */
async function openApprove(page: Page) {
  await page.goto('/')
  await signIn(page, PATIENT)
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: /Requests/ })
    .click()
  const row = page.getByRole('listitem').filter({ hasText: `From ${DOCTOR.username}` })
  await row.getByRole('button', { name: 'Approve' }).click()
  const dialog = page.getByRole('dialog', { name: `Approve ${DOCTOR.username}'s request` })
  await expect(dialog).toBeVisible()
  return { dialog, row }
}

test('approving a record and the profile gives one key per item', async ({ page }) => {
  const { dialog, row } = await openApprove(page)
  const approve = dialog.getByRole('button', { name: 'Approve and make keys' })
  await expect(approve).toBeDisabled()

  await dialog.getByRole('checkbox', { name: /lab-result-hba1c\.txt/ }).check()
  await dialog.getByRole('checkbox', { name: /My profile/ }).check()
  await dialog.getByLabel('Open for').selectOption({ label: '3 days' })
  await approve.click()

  await expect(dialog.getByRole('status')).toContainText('Each item has its own key')
  for (const title of ['lab-result-hba1c.txt', 'Your profile']) {
    const card = dialog.getByRole('article', { name: `Key for ${title}` })
    await expect(card.getByRole('textbox')).toHaveValue(/^CSK1\.\d+\.\d+\.[A-Za-z0-9_-]{400,}$/)
    await expect(card).toContainText(`${DOCTOR.username}'s key fingerprint`)
  }

  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toBeHidden()
  await expect(row).toContainText('Approved')
  await expect(row).toContainText('access ends in')
})

test('closing the dialog without approving changes nothing', async ({ page }) => {
  const { dialog, row } = await openApprove(page)
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
  await expect(row).toContainText('Waiting')
})
