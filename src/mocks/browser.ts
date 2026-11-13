import { setupWorker } from 'msw/browser'

import { DEMO_DOCTOR, DEMO_PATIENT } from './db'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

/** Start intercepting `/api` calls. Non-API requests (Vite, assets) pass through. */
export async function startMockApi(): Promise<void> {
  await worker.start({ onUnhandledFrame: 'bypass', quiet: true })
  console.info(
    '%c[mock API]%c No backend needed. Demo accounts: %s / %s (patient), %s / %s (doctor). Data resets on reload.',
    'color:#b45309;font-weight:bold',
    '',
    DEMO_PATIENT.username,
    DEMO_PATIENT.password,
    DEMO_DOCTOR.username,
    DEMO_DOCTOR.password,
  )
}
