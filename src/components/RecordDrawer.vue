<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AsyncButton from '@/components/AsyncButton.vue'
import FilePreview from '@/components/FilePreview.vue'
import { filesApi } from '@/api/cipherSafe'
import { getErrorMessage } from '@/api/client'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useFilesStore } from '@/stores/files'
import type { Algorithm, StoredFile } from '@/types/api'
import { categoryLabel, downloadBlob, formatBytes, formatDate, formatMs } from '@/utils/format'

const props = defineProps<{ file: StoredFile | null }>()
const emit = defineEmits<{ close: [] }>()

const store = useFilesStore()
const dialog = ref<HTMLDialogElement | null>(null)

// Keyed on the id: the list reloads after an upload, which replaces the
// object but should not reset an open drawer.
watch(
  () => props.file?.id,
  (id) => {
    if (id !== undefined) {
      reset()
      if (!dialog.value?.open) dialog.value?.showModal()
    } else dialog.value?.close()
  },
)

function reset() {
  confirmingDelete.value = false
}

// Preview
const preview = ref({ open: false, blob: null as Blob | null, filename: null as string | null, error: '' })
const previewing = ref(false)

async function openPreview() {
  if (!props.file) return
  preview.value = { open: true, blob: null, filename: null, error: '' }
  previewing.value = true
  try {
    const result = await filesApi.preview(props.file.id)
    preview.value.blob = result.blob
    preview.value.filename = result.filename ?? props.file.original_name
  } catch (err) {
    preview.value.error = getErrorMessage(err, 'Could not open this record.')
  } finally {
    previewing.value = false
  }
}

const download = useAsyncAction(async (algorithm: Algorithm = 'AES') => {
  if (!props.file) return
  const result = await filesApi.download(props.file.id, algorithm)
  downloadBlob(result.blob, result.filename ?? props.file.original_name)
}, 'Download failed.')

const downloadEncrypted = useAsyncAction(async (algorithm: Algorithm) => {
  if (!props.file) return
  const result = await filesApi.downloadCiphertext(props.file.id, algorithm)
  downloadBlob(result.blob, result.filename ?? `${props.file.original_name}.${algorithm}-encrypted`)
}, 'Download failed.')

// Delete
const confirmingDelete = ref(false)
async function remove() {
  if (!props.file) return
  if (await store.remove(props.file.id)) emit('close')
}

const benchmark = computed(() => (props.file ? store.benchmarks[props.file.id] : undefined))
const busy = computed(() => props.file !== null && store.busyFileId === props.file.id)
</script>

<template>
  <dialog
    ref="dialog"
    class="drawer"
    :aria-label="file ? `Record: ${file.original_name}` : 'Record'"
    @close="emit('close')"
  >
    <template v-if="file">
      <header class="drawer-head" :data-cat="file.category">
        <span class="cat">{{ categoryLabel(file.category) }}</span>
        <h2>{{ file.original_name }}</h2>
        <p class="muted small">{{ formatBytes(file.plaintext_size) }}, added {{ formatDate(file.created_at) }}</p>
        <button class="close secondary" aria-label="Close" @click="emit('close')">✕</button>
      </header>

      <div class="drawer-body">
        <div class="primary-actions">
          <button @click="openPreview">Open</button>
          <AsyncButton
            variant="secondary"
            :loading="download.loading.value"
            label="Download"
            loading-label="Decrypting…"
            @click="download.run()"
          />
        </div>
        <p v-if="download.error.value" class="notice error">{{ download.error.value }}</p>

        <details class="block">
          <summary>How it's protected</summary>
          <p class="muted small">
            Each record is stored three times, once per cipher, each with its own key from your
            password. AES uses GCM, which detects any change by itself; DES and RC4 add an HMAC check.
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
              label="Benchmark AES decryption (10 runs)"
              loading-label="Running…"
              @click="store.benchmark(file.id, 'AES')"
            />
            <p v-if="benchmark" class="muted small">
              {{ benchmark.algorithm }} over {{ benchmark.runs }} runs: min {{ formatMs(benchmark.min_ms) }},
              mean {{ formatMs(benchmark.mean_ms) }}, max {{ formatMs(benchmark.max_ms) }}
            </p>
          </div>
        </details>

        <section class="block delete">
          <template v-if="!confirmingDelete">
            <button class="danger" @click="confirmingDelete = true">Delete record</button>
          </template>
          <div v-else class="confirm" role="alert">
            <p>Delete <strong>{{ file.original_name }}</strong>? This can't be undone.</p>
            <div class="row">
              <button class="danger" @click="remove">Delete for good</button>
              <button class="secondary" @click="confirmingDelete = false">Keep it</button>
            </div>
          </div>
        </section>
      </div>
    </template>
  </dialog>

  <FilePreview
    :open="preview.open"
    :title="file?.original_name ?? 'Record'"
    :blob="preview.blob"
    :filename="preview.filename"
    :loading="previewing"
    :error="preview.error"
    @close="preview.open = false"
  />
</template>

<style scoped>
.drawer {
  margin: 0 0 0 auto;
  height: 100dvh;
  max-height: 100dvh;
  width: min(620px, 100vw);
  max-width: 100vw;
  padding: 0;
  border: none;
  border-left: 1px solid var(--line);
  background: var(--sheet);
  color: var(--ink);
}

.drawer[open] {
  animation: slide 0.18s ease-out;
}

@keyframes slide {
  from {
    transform: translateX(24px);
    opacity: 0;
  }
}

.drawer::backdrop {
  background: rgb(23 48 42 / 40%);
}

.drawer-head {
  position: relative;
  padding: 1.5rem 4rem 1.1rem 1.5rem;
  border-top: 6px solid var(--cat);
  border-bottom: 1px solid var(--line);
}

[data-cat='ID_CARD'] {
  --cat: var(--tab-id);
}

[data-cat='DOCUMENT'] {
  --cat: var(--tab-doc);
}

[data-cat='VIDEO'] {
  --cat: var(--tab-video);
}

.cat {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--cat);
}

.drawer-head h2 {
  margin: 0.15rem 0 0.25rem;
  overflow-wrap: anywhere;
}

.drawer-head p {
  margin: 0;
}

.close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 2.75rem;
  padding: 0;
}

.drawer-body {
  padding: 1.25rem 1.5rem 2rem;
}

.primary-actions {
  display: flex;
  gap: 0.6rem;
  margin-bottom: 1rem;
}

.primary-actions > * {
  flex: 1;
}

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

.confirm p {
  margin-bottom: 0.75rem;
}

.row {
  display: flex;
  gap: 0.6rem;
}

button.small {
  min-height: 2.2rem;
  font-size: 0.9rem;
}
</style>
