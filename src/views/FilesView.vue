<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import AsyncButton from '@/components/AsyncButton.vue'
import { useFilesStore } from '@/stores/files'
import {
  ALGORITHMS,
  FILE_CATEGORIES,
  MODES,
  type Algorithm,
  type CipherMode,
  type FileCategory,
  type StoredFile,
} from '@/types/api'
import { downloadBlob, formatBytes, formatDate, formatMs } from '@/utils/format'

const store = useFilesStore()
const message = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const upload = reactive<{ file: File | null; category: FileCategory; mode: CipherMode }>({
  file: null,
  category: 'DOCUMENT',
  mode: 'CBC',
})
const selectedAlgorithm = reactive<Record<number, Algorithm>>({})

function algorithmFor(id: number): Algorithm {
  return (selectedAlgorithm[id] ??= 'AES')
}

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  upload.file = target.files?.[0] ?? null
}

async function submitUpload() {
  if (!upload.file) return
  message.value = ''
  const created = await store.upload(upload.file, upload.category, upload.mode)
  if (created) {
    message.value = `Uploaded "${created.original_name}" (encrypted with AES, DES and RC4).`
    upload.file = null
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function handleDownload(file: StoredFile) {
  const result = await store.download(file.id, algorithmFor(file.id))
  if (result) downloadBlob(result.blob, result.filename ?? file.original_name)
}

async function handleRemove(file: StoredFile) {
  if (confirm(`Delete "${file.original_name}"?`)) await store.remove(file.id)
}

onMounted(store.load)
</script>

<template>
  <div class="container">
    <h1>Files</h1>
    <p class="muted">
      ID card images, PDF/DOC/XLS documents and videos. Each upload is encrypted with AES, DES and
      RC4 and can be downloaded back with any of them.
    </p>

    <form class="card" @submit.prevent="submitUpload">
      <h3>Upload</h3>
      <div class="grid upload-grid">
        <div>
          <label for="file-input">File</label>
          <input id="file-input" ref="fileInput" type="file" @change="onFileChange" />
        </div>
        <div>
          <label for="category">Category</label>
          <select id="category" v-model="upload.category">
            <option v-for="item in FILE_CATEGORIES" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </div>
        <div>
          <label for="mode">Block mode (AES/DES)</label>
          <select id="mode" v-model="upload.mode">
            <option v-for="mode in MODES" :key="mode" :value="mode">{{ mode }}</option>
          </select>
        </div>
      </div>
      <AsyncButton
        type="submit"
        :loading="store.uploading"
        :disabled="!upload.file"
        label="Encrypt & upload"
        loading-label="Encrypting..."
      />
    </form>

    <p v-if="store.error" class="error">{{ store.error }}</p>
    <p v-if="message" class="success">{{ message }}</p>

    <div v-if="store.loading" class="muted">Loading files...</div>
    <div v-else-if="store.items.length === 0" class="card muted">No files yet.</div>

    <div v-for="file in store.items" :key="file.id" class="card">
      <div class="file-head">
        <div>
          <strong>{{ file.original_name }}</strong>
          <div class="muted small">
            {{ file.category }} | {{ formatBytes(file.plaintext_size) }} | {{ formatDate(file.created_at) }}
          </div>
        </div>
        <div class="file-actions">
          <select v-model="selectedAlgorithm[file.id]" @focus="algorithmFor(file.id)">
            <option v-for="algorithm in ALGORITHMS" :key="algorithm" :value="algorithm">
              {{ algorithm }}
            </option>
          </select>
          <button :disabled="store.busyFileId === file.id" @click="handleDownload(file)">Download</button>
          <button
            class="secondary"
            :disabled="store.busyFileId === file.id"
            @click="store.benchmark(file.id, algorithmFor(file.id))"
          >
            Benchmark
          </button>
          <button class="danger" @click="handleRemove(file)">Delete</button>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Algorithm</th>
            <th>Mode</th>
            <th>Ciphertext</th>
            <th>Key derivation</th>
            <th>Cipher</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="ciphertext in file.ciphertexts" :key="ciphertext.algorithm">
            <td>{{ ciphertext.algorithm }}</td>
            <td>{{ ciphertext.mode || '-' }}</td>
            <td>{{ formatBytes(ciphertext.ciphertext_size) }}</td>
            <td>{{ formatMs(ciphertext.key_derivation_ms) }}</td>
            <td>{{ formatMs(ciphertext.cipher_ms) }}</td>
          </tr>
        </tbody>
      </table>

      <div v-if="store.benchmarks[file.id]" class="benchmark">
        <strong>{{ store.benchmarks[file.id]!.algorithm }}</strong> benchmark over
        {{ store.benchmarks[file.id]!.runs }} runs: min
        {{ formatMs(store.benchmarks[file.id]!.min_ms) }}, mean
        {{ formatMs(store.benchmarks[file.id]!.mean_ms) }}, max
        {{ formatMs(store.benchmarks[file.id]!.max_ms) }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.upload-grid {
  grid-template-columns: 2fr 1fr 1fr;
  margin-bottom: 1rem;
}

.file-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.file-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.file-actions select {
  width: auto;
}

.small {
  font-size: 0.85rem;
}

.benchmark {
  margin-top: 0.75rem;
  padding: 0.6rem 0.75rem;
  background: var(--surface-2);
  border-radius: 8px;
  font-size: 0.9rem;
}
</style>
