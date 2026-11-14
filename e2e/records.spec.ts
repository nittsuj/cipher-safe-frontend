import { expect, test } from '@playwright/test'

import { PATIENT, openRecord, readDownload, signIn, uploadText } from './helpers.js'

const NAME = 'notes.txt'
const CONTENT = 'Blood pressure 120/80, next visit in 3 months.\n'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await signIn(page, PATIENT)
  await expect(page.getByRole('heading', { name: 'Your records' })).toBeVisible()
})

test('uploads a record and lists it', async ({ page }) => {
  await uploadText(page, NAME, CONTENT)
  await expect(page.getByRole('button', { name: new RegExp(NAME) })).toBeVisible()
})

test('opens a record in the preview', async ({ page }) => {
  await uploadText(page, NAME, CONTENT)
  const drawer = await openRecord(page, NAME)
  await drawer.getByRole('button', { name: 'Open', exact: true }).click()

  const preview = page.getByRole('dialog', { name: `Preview of ${NAME}` })
  await expect(preview.locator('pre')).toHaveText(CONTENT)
})

test('downloads the decrypted record unchanged', async ({ page }) => {
  await uploadText(page, NAME, CONTENT)
  const drawer = await openRecord(page, NAME)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    drawer.getByRole('button', { name: 'Download', exact: true }).click(),
  ])
  expect(download.suggestedFilename()).toBe(NAME)
  expect((await readDownload(download)).toString()).toBe(CONTENT)
})

for (const algorithm of ['AES', 'DES', 'RC4']) {
  test(`downloads the ${algorithm} encrypted copy with its extension`, async ({ page }) => {
    await uploadText(page, NAME, CONTENT)
    const drawer = await openRecord(page, NAME)
    await drawer.getByText("How it's protected").click()

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      drawer.getByRole('button', { name: `Download the ${algorithm} encrypted copy` }).click(),
    ])
    expect(download.suggestedFilename()).toBe(`notes.${algorithm}-encrypted.txt`)
    expect((await readDownload(download)).toString()).not.toBe(CONTENT)
  })
}

test('deletes a record', async ({ page }) => {
  await uploadText(page, NAME, CONTENT)
  const drawer = await openRecord(page, NAME)
  await drawer.getByRole('button', { name: 'Delete record' }).click()
  await drawer.getByRole('button', { name: 'Delete for good' }).click()

  await expect(page.getByRole('button', { name: new RegExp(NAME) })).toHaveCount(0)
})

test('the record drawer points to the Requests page for sharing', async ({ page }) => {
  await uploadText(page, NAME, CONTENT)
  const drawer = await openRecord(page, NAME)
  await drawer.getByRole('link', { name: 'Requests page' }).click()
  await expect(page).toHaveURL(/\/requests$/)
})
