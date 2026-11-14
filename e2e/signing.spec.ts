import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

import { PATIENT, signIn } from './helpers.js'

const SAMPLE_PDF = readFileSync(fileURLToPath(new URL('./sample.pdf', import.meta.url)))

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await signIn(page, PATIENT)
  await expect(page.getByRole('heading', { name: 'Your records' })).toBeVisible()
})

async function choosePdf(page: import('@playwright/test').Page, name = 'lab-result.pdf') {
  await page
    .locator('#file-input')
    .setInputFiles({ name, mimeType: 'application/pdf', buffer: SAMPLE_PDF })
}

test('a PDF uploaded with "Digitally sign" ticked shows as signed', async ({ page }) => {
  await choosePdf(page)
  const sign = page.getByRole('checkbox', { name: /Digitally sign this PDF/ })
  await expect(sign).not.toBeChecked()
  await sign.check()
  await page.getByRole('button', { name: 'Save record' }).click()

  await expect(page.getByRole('status')).toContainText(
    'lab-result.pdf is signed, saved and encrypted.',
  )
  await expect(page.getByRole('button', { name: /lab-result\.pdf/ })).toContainText('Signed')
})

test('a PDF uploaded without ticking it is not signed', async ({ page }) => {
  await choosePdf(page)
  await page.getByRole('button', { name: 'Save record' }).click()
  await expect(page.getByRole('status')).toContainText('lab-result.pdf is saved and encrypted.')
  await expect(page.getByRole('button', { name: /lab-result\.pdf/ })).not.toContainText('Signed')
})

test('the option is only offered for PDFs', async ({ page }) => {
  await page
    .locator('#file-input')
    .setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
  await expect(page.getByRole('checkbox', { name: /Digitally sign this PDF/ })).toHaveCount(0)
  await choosePdf(page)
  await expect(page.getByRole('checkbox', { name: /Digitally sign this PDF/ })).toBeVisible()
})
