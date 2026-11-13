<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { PREVIEWABLE_TYPES } from '@/types/api'
import { downloadBlob } from '@/utils/format'

/**
 * Modal preview of a decrypted file.
 *
 * Only allow-listed types are rendered; the blob is re-typed to the allowed
 * type, so an uploaded HTML or SVG file can never run script in this origin.
 * The object URL is revoked as soon as the dialog closes.
 */
const props = defineProps<{
  open: boolean
  title: string
  blob: Blob | null
  filename: string | null
  loading?: boolean
  error?: string
}>()

const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const url = ref<string | null>(null)
const text = ref('')

const type = computed(() => {
  const raw = (props.blob?.type ?? '').split(';')[0]!.trim().toLowerCase()
  return (PREVIEWABLE_TYPES as readonly string[]).includes(raw) ? raw : null
})

const kind = computed(() => {
  if (!type.value) return 'none'
  if (type.value === 'application/pdf') return 'pdf'
  if (type.value.startsWith('image/')) return 'image'
  if (type.value.startsWith('video/')) return 'video'
  return 'text'
})

function release() {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = null
  text.value = ''
}

watch(
  () => props.blob,
  async (blob) => {
    release()
    if (!blob || !type.value) return
    if (kind.value === 'text') {
      text.value = await blob.text()
      return
    }
    url.value = URL.createObjectURL(new Blob([blob], { type: type.value }))
  },
)

watch(
  () => props.open,
  (open) => {
    if (open) dialog.value?.showModal()
    else {
      dialog.value?.close()
      release()
    }
  },
)

onBeforeUnmount(release)

function save() {
  if (props.blob) downloadBlob(props.blob, props.filename ?? 'record')
}
</script>

<template>
  <dialog ref="dialog" class="preview" :aria-label="`Preview of ${title}`" @close="emit('close')">
    <header class="preview-head">
      <h2>{{ title }}</h2>
      <div class="actions">
        <button v-if="blob" class="secondary" @click="save">Download</button>
        <button class="secondary" @click="emit('close')">Close</button>
      </div>
    </header>

    <div class="preview-body">
      <p v-if="loading" class="state">Decrypting…</p>
      <p v-else-if="error" class="notice error">{{ error }}</p>
      <template v-else-if="blob">
        <iframe v-if="kind === 'pdf' && url" :src="url" :title="title" />
        <img v-else-if="kind === 'image' && url" :src="url" :alt="title" />
        <video v-else-if="kind === 'video' && url" :src="url" controls />
        <pre v-else-if="kind === 'text'">{{ text }}</pre>
        <div v-else class="state">
          <p>This file type can't be shown in the browser.</p>
          <button @click="save">Download it instead</button>
        </div>
      </template>
    </div>
  </dialog>
</template>

<style scoped>
.preview {
  width: min(960px, 96vw);
  height: min(88vh, 900px);
  padding: 0;
  border: none;
  border-radius: var(--radius-sheet);
  background: var(--sheet);
  color: var(--ink);
}

.preview[open] {
  display: flex;
  flex-direction: column;
}

.preview::backdrop {
  background: rgb(23 48 42 / 55%);
}

.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1.25rem;
  border-bottom: 1px solid var(--line);
}

.preview-head h2 {
  margin: 0;
  font-size: 1.1rem;
  overflow-wrap: anywhere;
}

.actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.preview-body {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sheet-2);
  overflow: auto;
}

iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

img,
video {
  max-width: 100%;
  max-height: 100%;
}

pre {
  align-self: stretch;
  width: 100%;
  margin: 0;
  padding: 1.25rem;
  white-space: pre-wrap;
  font-size: 0.95rem;
}

.state {
  text-align: center;
  padding: 2rem;
}
</style>
