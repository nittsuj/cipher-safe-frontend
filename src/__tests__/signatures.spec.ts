import { describe, expect, it } from 'vitest'

import { signatureDisplay } from '@/config/signatures'
import type { SignatureStatus } from '@/types/api'

describe('signatureDisplay', () => {
  it.each<[SignatureStatus, string, string, string]>([
    ['valid', '✓', 'Signed by alice, unchanged', 'ok'],
    ['modified', '⚠', 'Changed after signing', 'warn'],
    ['unknown_signer', '?', 'Signed by someone else', 'warn'],
    ['invalid', '✕', 'Signature invalid', 'bad'],
    ['unsigned', '–', 'Not signed', 'neutral'],
  ])('%s shows %s "%s"', (status, icon, text, tone) => {
    expect(signatureDisplay(status, 'alice')).toMatchObject({ icon, text, tone })
  })

  it('names the owner when the certificate has no name', () => {
    expect(signatureDisplay('valid', null).text).toBe('Signed by the owner, unchanged')
  })

  it("explains an unknown signer as not the owner's certificate", () => {
    expect(signatureDisplay('unknown_signer').explanation).toMatch(
      /wasn't made with this owner's certificate/,
    )
  })
})
