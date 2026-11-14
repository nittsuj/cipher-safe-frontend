import { expect, test, type Page } from '@playwright/test'

import { DOCTOR, PATIENT, signIn, signOut } from './helpers.js'

/**
 * As the patient: approve the seeded request with the lab result and the
 * profile, read both keys, then switch to the doctor's Outgoing tab.
 */
async function approveThenSwitchToDoctor(page: Page) {
  await page.goto('/')
  await signIn(page, PATIENT)
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
  await dialog.getByRole('checkbox', { name: /My profile/ }).check()
  await dialog.getByRole('button', { name: 'Approve and make keys' }).click()
  const keyFor = (title: string) =>
    dialog
      .getByRole('article', { name: `Key for ${title}` })
      .getByRole('textbox')
      .inputValue()
  const keys = {
    record: await keyFor('lab-result-hba1c.txt'),
    profile: await keyFor('Your profile'),
  }
  await dialog.getByRole('button', { name: 'Done' }).click()

  await signOut(page)
  await signIn(page, DOCTOR)
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Requests' })
    .click()
  await page.getByRole('tab', { name: /Outgoing/ }).click()
  const row = page.getByRole('listitem').filter({ hasText: `To ${PATIENT.username}` })
  await expect(row).toContainText('Approved')
  return { keys, row }
}

test('the doctor enters both keys and opens the record and the profile', async ({ page }) => {
  const { keys, row } = await approveThenSwitchToDoctor(page)
  const record = row.getByRole('listitem').filter({ hasText: 'Medical document' })
  const profile = row.getByRole('listitem').filter({ hasText: 'Profile' })

  await record.getByRole('button', { name: 'Enter key' }).click()
  // Chat apps often break long text over lines; that must still work.
  await record.getByLabel('Key for Medical document').fill(keys.record.replace(/(.{120})/g, '$1\n'))
  await record.getByRole('button', { name: 'Use key' }).click()
  await record.getByRole('button', { name: 'Open' }).click()
  const preview = page.getByRole('dialog', { name: /^Preview of/ })
  await expect(preview.locator('pre')).toContainText('HbA1c: 7.1 %')
  await preview.getByRole('button', { name: 'Close' }).click()
  await expect(record).toContainText('opened 1×')

  await profile.getByRole('button', { name: 'Enter key' }).click()
  await profile.getByLabel('Key for Profile').fill(keys.profile)
  await profile.getByRole('button', { name: 'Use key' }).click()
  await profile.getByRole('button', { name: 'Open' }).click()
  const snapshot = page.getByRole('dialog', { name: `${PATIENT.username}'s profile` })
  await expect(snapshot).toContainText('Siti Rahmawati')
  await expect(snapshot).toContainText('Penicillin')
})

test('a key for another item or a garbled key is refused', async ({ page }) => {
  const { keys, row } = await approveThenSwitchToDoctor(page)
  const record = row.getByRole('listitem').filter({ hasText: 'Medical document' })
  await record.getByRole('button', { name: 'Enter key' }).click()
  const field = record.getByLabel('Key for Medical document')

  await field.fill(keys.profile)
  await record.getByRole('button', { name: 'Use key' }).click()
  await expect(record.getByRole('alert')).toContainText('This key is for another item')

  await field.fill('hello')
  await record.getByRole('button', { name: 'Use key' }).click()
  await expect(record.getByRole('alert')).toContainText("doesn't look like a Cipher Safe key")

  // Right ids, wrong key: the server refuses it.
  await field.fill(keys.record.slice(0, -10) + 'AAAAAAAAAA')
  await record.getByRole('button', { name: 'Use key' }).click()
  await expect(record.getByRole('alert')).toContainText('This key is not for this item')
  await expect(record.getByRole('button', { name: 'Open' })).toHaveCount(0)
})
