<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import AsyncButton from '@/components/AsyncButton.vue'
import { personalDataApi } from '@/api/cipherSafe'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { BLOOD_TYPES, PII_FIELDS, PROFILE_GROUPS, type ProfileField } from '@/config/profile'
import { formatDate } from '@/utils/format'

const form = reactive<Record<string, string>>(
  Object.fromEntries(PII_FIELDS.map((field) => [field.name, ''])),
)
const updatedAt = ref<string | null>(null)
const saved = ref(false)

const load = useAsyncAction(async () => {
  const data = await personalDataApi.get('AES')
  for (const field of PII_FIELDS) form[field.name] = data.fields[field.name] ?? ''
  updatedAt.value = Object.keys(data.fields).length ? data.updated_at : null
}, 'Could not open your profile.')

const save = useAsyncAction(async () => {
  saved.value = false
  const fields: Record<string, string> = {}
  for (const [name, value] of Object.entries(form)) {
    if (value.trim() !== '') fields[name] = value.trim()
  }
  const data = await personalDataApi.update(fields)
  updatedAt.value = data.updated_at
  saved.value = true
}, 'Could not save your profile.')

/** Digits-only fields: strip anything else as the user types. */
function onDigits(field: ProfileField, event: Event) {
  const input = event.target as HTMLInputElement
  form[field.name] = input.value.replace(/\D/g, '').slice(0, field.digits)
  input.value = form[field.name]!
}

function digitsInvalid(field: ProfileField) {
  const value = form[field.name] ?? ''
  return field.kind === 'digits' && value !== '' && value.length !== field.digits
}

const hasInvalid = computed(() => PII_FIELDS.some(digitsInvalid))
const error = computed(() => load.error.value || save.error.value)

onMounted(() => load.run())
</script>

<template>
  <div class="page narrow-page">
    <header class="page-head">
      <h1>Your profile</h1>
      <p class="lede">What a new clinic asks for at registration, kept in one place.</p>
      <p v-if="updatedAt" class="muted small">Last saved {{ formatDate(updatedAt) }}</p>
    </header>

    <p v-if="load.loading.value" class="muted">Opening your profile…</p>

    <form v-else class="profile" novalidate @submit.prevent="save.run()">
      <fieldset
        v-for="group in PROFILE_GROUPS"
        :key="group.title"
        class="sheet group"
        :class="{ health: group.health }"
      >
        <legend>
          <h2>{{ group.title }}</h2>
        </legend>
        <p v-if="group.health" class="health-note small">
          <span class="health-mark">Health data</span>
          Protected as sensitive data under UU PDP and GDPR. Leave anything blank you'd rather not
          keep here.
        </p>

        <div class="fields">
          <div
            v-for="field in group.fields"
            :key="field.name"
            class="field"
            :class="{ wide: field.kind === 'textarea' }"
          >
            <label :for="field.name">
              {{ field.label }}
              <span v-if="field.kind === 'digits'" class="hint">{{ field.digits }} digits</span>
            </label>

            <select v-if="field.kind === 'blood'" :id="field.name" v-model="form[field.name]">
              <option value="">Not sure</option>
              <option v-for="type in BLOOD_TYPES" :key="type" :value="type">{{ type }}</option>
            </select>

            <textarea
              v-else-if="field.kind === 'textarea'"
              :id="field.name"
              v-model="form[field.name]"
              :placeholder="field.placeholder"
              rows="3"
            />

            <input
              v-else-if="field.kind === 'digits'"
              :id="field.name"
              :value="form[field.name]"
              inputmode="numeric"
              autocomplete="off"
              :maxlength="field.digits"
              :aria-invalid="digitsInvalid(field)"
              :aria-describedby="`${field.name}-err`"
              class="key"
              @input="onDigits(field, $event)"
            />

            <input
              v-else
              :id="field.name"
              v-model="form[field.name]"
              :type="field.kind === 'date' ? 'date' : field.kind === 'tel' ? 'tel' : 'text'"
              :placeholder="field.placeholder"
            />

            <p v-if="digitsInvalid(field)" :id="`${field.name}-err`" class="field-err small">
              {{ form[field.name]!.length }} of {{ field.digits }} digits
            </p>
          </div>
        </div>
      </fieldset>

      <div class="save-bar">
        <p v-if="error" class="notice error" role="alert">{{ error }}</p>
        <p v-else-if="saved" class="notice ok" role="status">Profile saved.</p>
        <AsyncButton
          type="submit"
          :loading="save.loading.value"
          :disabled="hasInvalid"
          label="Save profile"
          loading-label="Encrypting and saving…"
        />
      </div>
    </form>
  </div>
</template>

<style scoped>
.narrow-page {
  max-width: 820px;
}

.profile {
  display: grid;
  gap: 1.25rem;
}

.group {
  margin: 0;
  min-width: 0;
}

.group legend {
  float: left;
  width: 100%;
  padding: 0;
}

.group legend + * {
  clear: both;
}

.group.health {
  border-left: 5px solid var(--health);
}

.health-note {
  color: var(--ink-2);
}

.health-note .health-mark {
  margin-right: 0.4rem;
}

.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 1.25rem;
}

.field.wide {
  grid-column: 1 / -1;
}

.field label .hint {
  display: inline;
  margin-left: 0.35rem;
}

.field-err {
  color: var(--danger);
  margin: 0.3rem 0 0;
}

.save-bar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  padding: 1rem 0;
  background: linear-gradient(to top, var(--bg) 70%, transparent);
}

.save-bar .notice {
  margin: 0;
  flex: 1;
}

@media (max-width: 600px) {
  .fields {
    grid-template-columns: 1fr;
  }
}
</style>
