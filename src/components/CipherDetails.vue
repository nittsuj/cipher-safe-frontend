<script setup lang="ts">
import { computed } from 'vue'

import AsyncButton from '@/components/AsyncButton.vue'
import BenchmarkChart from '@/components/BenchmarkChart.vue'
import { filesApi } from '@/api/cipherSafe'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useFilesStore } from '@/stores/files'
import type { Algorithm, StoredFile } from '@/types/api'
import { downloadBlob, formatMs } from '@/utils/format'

/** "How it's protected": per-cipher timings, encrypted copies, benchmark. */
const props = defineProps<{ file: StoredFile }>()

const store = useFilesStore()

const downloadEncrypted = useAsyncAction(async (algorithm: Algorithm) => {
  const result = await filesApi.downloadCiphertext(props.file.id, algorithm)
  // Same shape as the server's name: keep the extension (notes.AES-encrypted.txt).
  const name = props.file.original_name
  const dot = name.lastIndexOf('.')
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, '']
  downloadBlob(result.blob, result.filename ?? `${stem}.${algorithm}-encrypted${ext}`)
}, 'Download failed.')

const benchmark = computed(() => store.benchmarks[props.file.id])
const busy = computed(() => store.busyFileId === props.file.id)
</script>

<template>
  <details class="block">
    <summary>How it's protected</summary>
    <p class="muted small">
      Each record is stored three times, once per cipher, each with its own key from your password.
      AES uses GCM, which detects any change by itself; DES and RC4 add an HMAC check.
    </p>
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Cipher</th>
            <th class="num">Key setup</th>
            <th class="num">Cipher</th>
            <th class="num">Integrity</th>
            <th><span class="visually-hidden">Encrypted copy</span></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in file.ciphertexts" :key="c.algorithm">
            <td>
              <strong>{{ c.algorithm }}</strong>
              <span class="muted small">{{ c.mode ? `-${c.mode}` : '' }}</span>
            </td>
            <td class="num">{{ formatMs(c.key_derivation_ms) }}</td>
            <td class="num">{{ formatMs(c.cipher_ms) }}</td>
            <td class="num">{{ c.mode === 'GCM' ? 'in GCM' : formatMs(c.mac_ms) }}</td>
            <td>
              <button
                class="quiet small"
                :disabled="downloadEncrypted.loading.value"
                :aria-label="`Download the ${c.algorithm} encrypted copy`"
                @click="downloadEncrypted.run(c.algorithm)"
              >
                Encrypted copy
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="downloadEncrypted.error.value" class="notice error">
      {{ downloadEncrypted.error.value }}
    </p>

    <div class="bench">
      <AsyncButton
        variant="secondary"
        :loading="busy"
        label="Benchmark decryption (10 runs each)"
        loading-label="Running AES, DES, RC4…"
        @click="store.benchmark(file.id)"
      />
      <BenchmarkChart v-if="benchmark" :results="benchmark" />
    </div>
  </details>
</template>

<style scoped>
.block {
  padding: 1.25rem 0;
  border-top: 1px solid var(--line);
}

.bench {
  margin-top: 1rem;
  display: grid;
  gap: 1rem;
}

.bench > button {
  justify-self: start;
}

button.small {
  min-height: 2.2rem;
  font-size: 0.9rem;
}
</style>
