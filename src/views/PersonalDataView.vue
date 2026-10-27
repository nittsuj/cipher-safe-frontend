<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import AsyncButton from '@/components/AsyncButton.vue'
import { personalDataApi } from '@/api/cipherSafe'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { ALGORITHMS, PII_FIELDS, type Algorithm } from '@/types/api'

const algorithm = ref<Algorithm>('AES')
const form = reactive<Record<string, string>>(
  Object.fromEntries(PII_FIELDS.map((field) => [field.name, ''])),
)
const hasStoredData = ref(false)
const message = ref('')

const load = useAsyncAction(async () => {
  const data = await personalDataApi.get(algorithm.value)
  for (const field of PII_FIELDS) form[field.name] = data.fields[field.name] ?? ''
  hasStoredData.value = Object.keys(data.fields).length > 0
}, 'Could not load the patient profile.')

const save = useAsyncAction(async () => {
  const fields: Record<string, string> = {}
  for (const [name, value] of Object.entries(form)) {
    if (value !== '') fields[name] = value
  }
  await personalDataApi.update(fields)
  hasStoredData.value = true
  message.value = 'Profile saved (encrypted with AES, DES and RC4).'
}, 'Could not save the patient profile.')

const error = computed(() => load.error.value || save.error.value)

onMounted(() => {
  load.run()
})
</script>

<template>
  <div class="container">
    <h1>Patient profile</h1>
    <p class="muted">
      Identity and medical details a new clinic usually asks for. Fields marked
      <span class="tag">health</span> are specific personal data under UU PDP Art. 4(2) and special-
      category data under GDPR Art. 9. The whole profile is stored as three separate ciphertexts (AES,
      DES and RC4) with an integrity tag; nothing is kept in plaintext. Saving replaces the profile.
    </p>

    <div class="card">
      <div class="row">
        <div>
          <label for="algorithm">Decrypt / read using</label>
          <select id="algorithm" v-model="algorithm" @change="load.run()">
            <option v-for="option in ALGORITHMS" :key="option" :value="option">{{ option }}</option>
          </select>
        </div>
        <div class="action">
          <AsyncButton
            variant="secondary"
            :loading="load.loading.value"
            label="Load"
            loading-label="Loading..."
            @click="load.run()"
          />
        </div>
      </div>
    </div>

    <form class="card" @submit.prevent="save.run()">
      <div class="grid">
        <div v-for="field in PII_FIELDS" :key="field.name">
          <label :for="field.name"
            >{{ field.label }} <span v-if="field.health" class="tag">health</span></label
          >
          <input :id="field.name" v-model="form[field.name]" :type="field.type ?? 'text'" />
        </div>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="message" class="success">{{ message }}</p>
      <p v-if="!hasStoredData" class="muted">No profile stored yet.</p>
      <AsyncButton
        type="submit"
        :loading="save.loading.value"
        label="Save (encrypt with all three)"
        loading-label="Saving..."
      />
    </form>
  </div>
</template>

<style scoped>
.card {
  margin-bottom: 1rem;
}

.action {
  display: flex;
  align-items: flex-end;
}

.tag {
  font-size: 0.75em;
  padding: 0 0.35em;
  border-radius: 4px;
  background: var(--border);
}

.grid {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  margin-bottom: 1rem;
}
</style>
