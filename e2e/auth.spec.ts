import { expect, test } from '@playwright/test'

import { PATIENT, signIn, signOut } from './helpers.js'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('registers a patient and lands on their empty vault', async ({ page }) => {
  await page.getByRole('link', { name: 'Create an account' }).click()
  await page.getByRole('radio', { name: /Patient/ }).check()
  await page.getByLabel('Username').fill('ani')
  await page.locator('#password').fill('ani-password-1')
  await page.getByLabel('Type it again').fill('ani-password-1')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByRole('heading', { name: 'Your records' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No records yet' })).toBeVisible()
})

test('registers a doctor and lands on the Requests page', async ({ page }) => {
  await page.getByRole('link', { name: 'Create an account' }).click()
  await page.getByRole('radio', { name: /Doctor/ }).check()
  await page.getByLabel('Username').fill('dr-ana')
  await page.locator('#password').fill('ana-password-1')
  await page.getByLabel('Type it again').fill('ana-password-1')
  await page.getByRole('button', { name: 'Create account' }).click()

  await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible()
})

test('rejects a wrong password', async ({ page }) => {
  await signIn(page, { username: PATIENT.username, password: 'wrong-password' })
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})

test('signs in and out', async ({ page }) => {
  await signIn(page, PATIENT)
  await expect(page.getByRole('heading', { name: 'Your records' })).toBeVisible()
  await signOut(page)
})

test('a doctor lands on the Requests page, and the old share page redirects there', async ({
  page,
}) => {
  await signIn(page, { username: 'doctor', password: 'doctor-password' })
  await expect(page).toHaveURL(/\/requests$/)
  await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Shared with me' }),
  ).toHaveCount(0)

  await page.getByRole('link', { name: 'Cipher Safe' }).click()
  await expect(page).toHaveURL(/\/requests$/)
})
