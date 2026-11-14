<script setup lang="ts">
import { computed } from 'vue'

import AsyncButton from '@/components/AsyncButton.vue'
import { keysApi } from '@/api/cipherSafe'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { signatureDisplay } from '@/config/signatures'
import type { SignatureCheck } from '@/types/api'
import { downloadBlob, formatDate, formatFingerprint } from '@/utils/format'

/**
 * What a signature check found, with the signer's certificate to download.
 * `owner` is whose certificate to offer: omit it for my own records.
 */
const props = defineProps<{ check: SignatureCheck; owner?: string }>()

const display = computed(() =>
  signatureDisplay(props.check.status, props.check.signer?.common_name),
)
const yesNo = (value: boolean) => (value ? 'Yes' : 'No')

const certificate = useAsyncAction(async () => {
  const result = props.owner
    ? await keysApi.userCertificate(props.owner)
    : await keysApi.certificate()
  downloadBlob(result.blob, result.filename ?? 'cipher-safe.cer')
}, 'Could not download the certificate.')
</script>

<template>
  <div class="details">
    <p v-if="display.explanation" class="small">{{ display.explanation }}</p>

    <details v-if="check.signed">
      <summary class="small">Signature details</summary>
      <dl class="small">
        <dt>Signer</dt>
        <dd>{{ check.signer?.common_name ?? 'Unknown' }}</dd>
        <template v-if="check.signer?.fingerprint">
          <dt>Certificate fingerprint (SHA-256)</dt>
          <dd class="mono">{{ formatFingerprint(check.signer.fingerprint) }}</dd>
        </template>
        <template v-if="check.signed_at">
          <dt>Signed</dt>
          <dd>{{ formatDate(check.signed_at) }}</dd>
        </template>
        <dt>Covers</dt>
        <dd>
          {{ check.coverage === 'ENTIRE_FILE' ? 'The whole file' : (check.coverage ?? 'Unknown') }}
        </dd>
        <dt>Content unchanged</dt>
        <dd>{{ yesNo(check.intact && !check.modified_after_signing) }}</dd>
        <dt>Signature valid</dt>
        <dd>{{ yesNo(check.valid) }}</dd>
        <dt>Owner's certificate</dt>
        <dd>{{ yesNo(check.signer_matches_owner) }}</dd>
        <dt>Checked in</dt>
        <dd>{{ check.verify_ms.toFixed(1) }} ms</dd>
      </dl>

      <AsyncButton
        variant="secondary"
        :loading="certificate.loading.value"
        label="Download certificate (.cer)"
        loading-label="Downloading…"
        @click="certificate.run()"
      />
      <p v-if="certificate.error.value" class="notice error small" role="alert">
        {{ certificate.error.value }}
      </p>
      <p class="muted small">
        To check it in Adobe Acrobat Reader too: open Preferences → Signatures → Identities &amp;
        Trusted Certificates, import this .cer and trust it for signed documents, then open the PDF.
      </p>
    </details>
  </div>
</template>

<style scoped>
.details {
  margin-top: 0.5rem;
}

summary {
  cursor: pointer;
  margin-bottom: 0.5rem;
}

dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.25rem 1rem;
  margin: 0 0 0.75rem;
}

dt {
  font-weight: 600;
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
}

.mono {
  font-family: ui-monospace, monospace;
}
</style>
