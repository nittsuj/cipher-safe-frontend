<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import AsyncButton from '@/components/AsyncButton.vue'
import RecordDrawer from '@/components/RecordDrawer.vue'
import { useFilesStore } from '@/stores/files'
import { FILE_CATEGORIES, isPdf } from '@/config/records'
import type { FileCategory, StoredFile } from '@/types/api'
import { categoryLabel, formatBytes, formatDay } from '@/utils/format'

const store = useFilesStore()

const filter = ref<FileCategory | 'ALL'>('ALL')
const visible = computed(() =>
  filter.value === 'ALL' ? store.items : store.items.filter((f) => f.category === filter.value),
)
const countFor = (value: FileCategory) => store.items.filter((f) => f.category === value).length

// Upload
const fileInput = ref<HTMLInputElement | null>(null)
const pending = ref<File | null>(null)
const category = ref<FileCategory>('DOCUMENT')
const dragging = ref(false)
const uploaded = ref('')
/** Sign the PDF with my private key before it's encrypted. Off by default. */
const sign = ref(false)
const canSign = computed(() => isPdf(pending.value))

function pick(file: File | null | undefined) {
  pending.value = file ?? null
  uploaded.value = ''
  sign.value = false // a new file starts unsigned
  if (file?.type.startsWith('video/')) category.value = 'VIDEO'
}

function onDrop(event: DragEvent) {
  dragging.value = false
  pick(event.dataTransfer?.files?.[0])
}

async function submitUpload() {
  if (!pending.value) return
  const created = await store.upload(pending.value, category.value, canSign.value && sign.value)
  if (created) {
    uploaded.value = created.signed
      ? `${created.original_name} is signed, saved and encrypted.`
      : `${created.original_name} is saved and encrypted.`
    pending.value = null
    sign.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

// Drawer
const openId = ref<number | null>(null)
const openFile = computed<StoredFile | null>(
  () => store.items.find((f) => f.id === openId.value) ?? null,
)

onMounted(store.load)
</script>

<template>
  <div class="page">
    <header class="page-head">
      <h1>Your records</h1>
      <p class="lede">
        Bring your history to the next appointment: ID and BPJS cards, lab results, referral letters
        and scan videos. Only you can open them, unless you share one with your doctor.
      </p>
    </header>

    <form
      class="upload sheet"
      :class="{ dragging }"
      @submit.prevent="submitUpload"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <div class="drop">
        <label for="file-input" class="drop-label">
          <span class="drop-title">{{ pending ? pending.name : 'Add a record' }}</span>
          <span class="hint">
            {{ pending ? formatBytes(pending.size) : 'Drop a file here, or choose one. Up to 128 MB.' }}
          </span>
        </label>
        <input
          id="file-input"
          ref="fileInput"
          type="file"
          class="file-input"
          @change="pick(($event.target as HTMLInputElement).files?.[0])"
        />
      </div>

      <fieldset class="kinds">
        <legend class="label">What is it?</legend>
        <label v-for="item in FILE_CATEGORIES" :key="item.value" class="kind" :data-cat="item.value">
          <input v-model="category" type="radio" name="category" :value="item.value" />
          <span>
            {{ item.label }}
            <span class="hint">{{ item.hint }}</span>
          </span>
        </label>
      </fieldset>

      <label v-if="canSign" class="sign-option">
        <input v-model="sign" type="checkbox" />
        <span>
          Digitally sign this PDF
          <span class="hint">
            Signed with your private key. Anyone can check it hasn't been changed.
          </span>
        </span>
      </label>

      <AsyncButton
        type="submit"
        :loading="store.uploading"
        :disabled="!pending"
        label="Save record"
        loading-label="Encrypting and saving…"
      />
    </form>

    <p v-if="store.error" class="notice error" role="alert">{{ store.error }}</p>
    <p v-if="uploaded" class="notice ok" role="status">{{ uploaded }}</p>

    <div v-if="store.items.length" class="filters" role="group" aria-label="Filter records">
      <button
        :class="filter === 'ALL' ? '' : 'secondary'"
        :aria-pressed="filter === 'ALL'"
        @click="filter = 'ALL'"
      >
        All <span class="count">{{ store.items.length }}</span>
      </button>
      <button
        v-for="item in FILE_CATEGORIES"
        :key="item.value"
        :class="filter === item.value ? '' : 'secondary'"
        :aria-pressed="filter === item.value"
        @click="filter = item.value"
      >
        {{ item.label }} <span class="count">{{ countFor(item.value) }}</span>
      </button>
    </div>

    <div v-if="store.loading && !store.items.length" class="grid" aria-busy="true">
      <div v-for="i in 3" :key="i" class="folder skeleton" />
    </div>

    <div v-else-if="!store.items.length" class="empty sheet">
      <h2>No records yet</h2>
      <p class="muted">
        Start with what clinics ask for most: a photo of your KTP and BPJS card, then your latest lab
        result.
      </p>
      <button @click="fileInput?.click()">Choose a file</button>
    </div>

    <ul v-else class="grid">
      <li v-for="file in visible" :key="file.id">
        <button class="folder" :data-cat="file.category" @click="openId = file.id">
          <span class="tab">{{ categoryLabel(file.category) }}</span>
          <span class="folder-body">
            <span class="name">{{ file.original_name }}</span>
            <span class="meta">
              <span>
                {{ formatBytes(file.plaintext_size) }}
                <span v-if="file.signed" class="signed-mark">Signed</span>
              </span>
              <span>{{ formatDay(file.created_at) }}</span>
            </span>
          </span>
        </button>
      </li>
    </ul>

    <RecordDrawer :file="openFile" @close="openId = null" />
  </div>
</template>

<style scoped>
.upload {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) auto;
  gap: 1.25rem;
  align-items: end;
  margin-bottom: 1.25rem;
}

.upload.dragging {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.drop {
  position: relative;
  align-self: stretch;
}

.drop-label {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  min-height: 6.5rem;
  margin: 0;
  padding: 1rem 1.25rem;
  border: 2px dashed var(--line-strong);
  border-radius: var(--radius-sheet);
  cursor: pointer;
}

.drop-label:hover {
  border-color: var(--accent);
}

.drop-title {
  font-size: 1.15rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}

.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  min-height: 0;
}

.drop:focus-within .drop-label {
  border-color: var(--accent);
  box-shadow: var(--focus);
}

.kinds {
  border: 0;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.4rem;
}

.kind {
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  margin: 0;
  padding: 0.4rem 0.6rem;
  border-radius: var(--radius-control);
  border-left: 4px solid var(--cat);
  background: var(--sheet-2);
  font-weight: 600;
  cursor: pointer;
}

.kind input {
  width: auto;
  min-height: 0;
  margin-top: 0.3rem;
  accent-color: var(--accent);
}

.kind .hint {
  display: inline;
  margin-left: 0.3rem;
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

.sign-option {
  grid-column: 1 / -1;
  display: flex;
  gap: 0.6rem;
  align-items: flex-start;
  margin: 0;
  font-weight: 600;
  cursor: pointer;
}

.sign-option input {
  width: auto;
  min-height: 0;
  margin-top: 0.3rem;
  accent-color: var(--accent);
}

.sign-option .hint {
  display: block;
  font-weight: 400;
}

.signed-mark {
  margin-left: 0.4rem;
  padding: 0 0.45rem;
  border: 1px solid var(--ok);
  border-radius: 99px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ok);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 1.75rem 0 1rem;
}

.filters button {
  min-height: 2.4rem;
  padding-block: 0.3rem;
}

.count {
  font-weight: 400;
  opacity: 0.75;
}

.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 1.75rem 1.25rem;
}

/* The folder: a coloured tab on top of a white sheet. */
.folder {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  width: 100%;
  min-height: 9rem;
  padding: 0;
  margin-top: 1.4rem;
  text-align: left;
  color: var(--ink);
  background: var(--sheet);
  border: 1px solid var(--line);
  border-top: 5px solid var(--cat);
  border-radius: 0 var(--radius-sheet) var(--radius-sheet) var(--radius-sheet);
  font-weight: 400;
}

.folder:hover:not(:disabled) {
  background: var(--sheet);
  border-color: var(--line-strong);
  border-top-color: var(--cat);
}

.folder:focus-visible {
  border-radius: 0 var(--radius-sheet) var(--radius-sheet) var(--radius-sheet);
}

.tab {
  position: absolute;
  bottom: 100%;
  left: -1px;
  max-width: 85%;
  padding: 0.15rem 0.85rem 0.1rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: #fff;
  background: var(--cat);
  border-radius: 8px 8px 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.folder-body {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
  gap: 1rem;
  padding: 1rem 1.1rem;
}

.name {
  font-weight: 600;
  font-size: 1.05rem;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta {
  display: flex;
  justify-content: space-between;
  color: var(--ink-2);
  font-size: 0.9rem;
}

.skeleton {
  --cat: var(--line);
  background: var(--sheet-2);
}

.empty {
  margin-top: 1.5rem;
}

@media (max-width: 860px) {
  .upload {
    grid-template-columns: 1fr;
  }
}
</style>
