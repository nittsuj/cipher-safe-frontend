import { expect, type Download, type Page } from '@playwright/test'

/**
 * Helpers for the end-to-end tests. They run against the MSW mock API
 * (`pnpm dev:mock`), so no backend is needed. The mock keeps its data in
 * memory and resets on every page load, so each test starts from the seed in
 * `src/mocks/db.ts`: the accounts below plus two lab documents and two signed PDFs
 * (one edited after signing) for `patient`.
 * Navigate with clicks after the first `goto`; a reload wipes the data.
 */
export const PATIENT = { username: 'patient', password: 'patient-password' }
export const DOCTOR = { username: 'doctor', password: 'doctor-password' }

export async function signIn(page: Page, user: { username: string; password: string }) {
  await page.getByLabel('Username').fill(user.username)
  await page.getByLabel('Password').fill(user.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
}

/** Upload a text record from the Files page and wait until it is listed. */
export async function uploadText(page: Page, name: string, content: string) {
  await page.locator('#file-input').setInputFiles({
    name,
    mimeType: 'text/plain',
    buffer: Buffer.from(content),
  })
  await page.getByRole('button', { name: 'Save record' }).click()
  await expect(page.getByRole('status')).toContainText(`${name} is saved and encrypted.`)
}

/** Open a record's drawer from the Files page. */
export async function openRecord(page: Page, name: string) {
  await page.getByRole('button', { name: new RegExp(name) }).click()
  const drawer = page.getByRole('dialog', { name: `Record: ${name}` })
  await expect(drawer).toBeVisible()
  return drawer
}

export async function readDownload(download: Download): Promise<Buffer> {
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}
