/**
 * How each signature status is shown. Never colour alone: every status has an
 * icon and text, and the badge carries the text as its accessible name.
 */
import type { SignatureStatus } from '@/types/api'

export type SignatureTone = 'ok' | 'warn' | 'bad' | 'neutral'

export interface SignatureDisplay {
  icon: string
  text: string
  tone: SignatureTone
  /** A sentence under the badge, when the short text needs explaining. */
  explanation?: string
}

/** Badge icon, text and tone for a status; `signer` is the certificate's name. */
export function signatureDisplay(
  status: SignatureStatus,
  signer?: string | null,
): SignatureDisplay {
  switch (status) {
    case 'valid':
      return { icon: '✓', text: `Signed by ${signer || 'the owner'}, unchanged`, tone: 'ok' }
    case 'modified':
      return {
        icon: '⚠',
        text: 'Changed after signing',
        tone: 'warn',
        explanation:
          'The PDF was edited or added to after it was signed, so the signature no longer covers all of it.',
      }
    case 'unknown_signer':
      return {
        icon: '?',
        text: 'Signed by someone else',
        tone: 'warn',
        explanation: "The signature is intact, but it wasn't made with this owner's certificate.",
      }
    case 'invalid':
      return {
        icon: '✕',
        text: 'Signature invalid',
        tone: 'bad',
        explanation:
          "The signature can't be read or doesn't match the document. Don't trust this copy.",
      }
    case 'unsigned':
      return { icon: '–', text: 'Not signed', tone: 'neutral' }
  }
}
