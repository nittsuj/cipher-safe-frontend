import { expect, test, type Page } from '@playwright/test'

import { DOCTOR, PATIENT, openRecord, signIn, signOut, uploadText } from './helpers.js'

const NAME = 'notes.txt'
const CONTENT = 'HbA1c 6.8 %, keep metformin.\n'

/** As the patient: upload a record, share it with the demo doctor, return the key. */
async function shareWithDoctor(page: Page): Promise<string> {
  await uploadText(page, NAME, CONTENT)
  const drawer = await openRecord(page, NAME)
  await drawer.getByLabel("Doctor's username").fill(DOCTOR.username)
  await drawer.getByRole('button', { name: 'Create key' }).click()

  const key = drawer.locator('.share-key')
  await expect(key).not.toBeEmpty()
  return (await key.textContent())!.trim()
}

async function closeDrawer(page: Page) {
  await page.getByRole('button', { name: 'Close' }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await signIn(page, PATIENT)
  await expect(page.getByRole('heading', { name: 'Your records' })).toBeVisible()
})

test('the doctor opens a shared record with the key', async ({ page }) => {
  const key = await shareWithDoctor(page)
  await closeDrawer(page)
  await signOut(page)

  await signIn(page, DOCTOR)
  await expect(page.getByRole('heading', { name: `From ${PATIENT.username}` })).toBeVisible()
  await page.getByLabel('Share key').fill(key)
  await page.getByRole('button', { name: 'Open', exact: true }).click()

  const preview = page.getByRole('dialog', { name: /^Preview of/ })
  await expect(preview.locator('pre')).toHaveText(CONTENT)
})

test('a wrong key is rejected', async ({ page }) => {
  await shareWithDoctor(page)
  await closeDrawer(page)
  await signOut(page)

  await signIn(page, DOCTOR)
  await page.getByLabel('Share key').fill('WRNG-WRNG-WRNG-WRNG-WRNG')
  await page.getByRole('button', { name: 'Open', exact: true }).click()

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('dialog', { name: /^Preview of/ })).toBeHidden()
})

test('the share is listed for the patient and can be stopped', async ({ page }) => {
  await shareWithDoctor(page)
  const drawer = page.getByRole('dialog', { name: `Record: ${NAME}` })
  await expect(drawer.getByText(DOCTOR.username, { exact: true })).toBeVisible()

  await drawer.getByRole('button', { name: 'Stop sharing' }).click()
  await expect(drawer.getByRole('button', { name: 'Stop sharing' })).toHaveCount(0)

  await closeDrawer(page)
  await signOut(page)
  await signIn(page, DOCTOR)
  await expect(page.getByRole('heading', { name: 'Nothing shared yet' })).toBeVisible()
})

test('sharing with an unknown doctor fails', async ({ page }) => {
  await uploadText(page, NAME, CONTENT)
  const drawer = await openRecord(page, NAME)
  await drawer.getByLabel("Doctor's username").fill('nobody')
  await drawer.getByRole('button', { name: 'Create key' }).click()

  await expect(drawer.locator('.notice.error')).toBeVisible()
  await expect(drawer.locator('.share-key')).toHaveCount(0)
})
