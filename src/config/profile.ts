/** How the patient profile form is laid out. */

/**
 * The patient profile. `health` marks UU PDP Art. 4(2) / GDPR Art. 9 health
 * data; everything is encrypted either way.
 */
export interface ProfileField {
  name: string
  label: string
  kind?: 'text' | 'date' | 'textarea' | 'blood' | 'digits' | 'tel'
  digits?: number
  placeholder?: string
  health?: boolean
}

export const PROFILE_GROUPS: { title: string; health?: boolean; fields: ProfileField[] }[] = [
  {
    title: 'Identity',
    fields: [
      { name: 'full_name', label: 'Full name' },
      { name: 'date_of_birth', label: 'Date of birth', kind: 'date' },
      { name: 'national_id', label: 'NIK', kind: 'digits', digits: 16 },
      { name: 'bpjs_number', label: 'BPJS Kesehatan number', kind: 'digits', digits: 13 },
    ],
  },
  {
    title: 'Contact',
    fields: [
      { name: 'phone', label: 'Phone', kind: 'tel', placeholder: '08xx' },
      { name: 'emergency_contact', label: 'Emergency contact', placeholder: 'Name and phone' },
      { name: 'address', label: 'Address', kind: 'textarea' },
    ],
  },
  {
    title: 'Medical',
    health: true,
    fields: [
      { name: 'blood_type', label: 'Blood type', kind: 'blood', health: true },
      {
        name: 'allergies',
        label: 'Allergies',
        kind: 'textarea',
        placeholder: 'e.g. penicillin',
        health: true,
      },
      { name: 'chronic_conditions', label: 'Chronic conditions', kind: 'textarea', health: true },
      { name: 'current_medications', label: 'Current medications', kind: 'textarea', health: true },
    ],
  },
]

export const PII_FIELDS: ProfileField[] = PROFILE_GROUPS.flatMap((group) => group.fields)

export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const
