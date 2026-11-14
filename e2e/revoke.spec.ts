import { expect, test, type Page } from '@playwright/test'

import { DOCTOR, PATIENT, signIn, signOut } from './helpers.js'

/** As the patient: approve the seeded request with the lab result; return its key and row. */
async function approveLabResult(page: Page) {
  await page.goto('/')
  await signIn(page, PATIENT)
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: /Requests/ })
    .click()
  const row = page.getByRole('listitem').filter({ hasText: `From ${DOCTOR.username}` })
  await row.getByRole('button', { name: 'Approve' }).click()
  const dialog = page.getByRole('dialog', { name: `Approve ${DOCTOR.username}'s request` })
  await dialog.getByRole('checkbox', { name: /lab-result-hba1c\.txt/ }).check()
  await dialog.getByRole('button', { name: 'Approve and make keys' }).click()
  const key = await dialog
    .getByRole('article', { name: 'Key for lab-result-hba1c.txt' })
    .getByRole('textbox')
    .inputValue()
  await dialog.getByRole('button', { name: 'Done' }).click()
  return { key, row }
}

test('the owner can show the same key again', async ({ page }) => {
  const { key, row } = await approveLabResult(page)
  const item = row.getByRole('listitem').filter({ hasText: 'Medical document' })
  await expect(item).toContainText('key not entered yet')
  await item.getByRole('button', { name: 'Show key again' }).click()
  await expect(item.getByRole('textbox')).toHaveValue(key)
  await item.getByRole('button', { name: 'Hide key' }).click()
  await expect(item.getByRole('textbox')).toHaveCount(0)
})

test('stopping access removes it for the requester', async ({ page }) => {
  const { row } = await approveLabResult(page)
  await row.getByRole('button', { name: 'Stop access' }).click()
  await expect(row.getByRole('alert')).toContainText('The keys you sent stop working')
  await row.getByRole('alert').getByRole('button', { name: 'Stop access' }).click()
  await expect(row).toContainText('Access stopped')
  await expect(row.getByRole('button')).toHaveCount(0)

  await signOut(page)
  await signIn(page, DOCTOR)
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Requests' })
    .click()
  await page.getByRole('tab', { name: /Outgoing/ }).click()
  const outgoing = page.getByRole('listitem').filter({ hasText: `To ${PATIENT.username}` })
  await expect(outgoing).toContainText('Access stopped')
  await expect(outgoing.getByRole('button', { name: 'Enter key' })).toHaveCount(0)
})

test('keeping access changes nothing', async ({ page }) => {
  const { row } = await approveLabResult(page)
  await row.getByRole('button', { name: 'Stop access' }).click()
  await row.getByRole('button', { name: 'Keep it' }).click()
  await expect(row).toContainText('Approved')
})
