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
}, 'Could not load personal data.')

const save = useAsyncAction(async () => {
  const fields: Record<string, string> = {}
  for (const [name, value] of Object.entries(form)) {
    if (value !== '') fields[name] = value
  }
  await personalDataApi.update(fields)
  hasStoredData.value = true
  message.value = 'Saved (encrypted with AES, DES and RC4).'
}, 'Could not save personal data.')

const error = computed(() => load.error.value || save.error.value)

onMounted(() => {
  load.run()
})
</script>

<template>
  <div class="container">
    <h1>Personal data</h1>
    <p class="muted">
      These fields are GDPR / UU PDP personal data. Every save stores three separate ciphertexts
      (AES, DES and RC4); nothing is kept in plaintext.
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
          <label :for="field.name">{{ field.label }}</label>
          <input :id="field.name" v-model="form[field.name]" :type="field.type ?? 'text'" />
        </div>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <p v-if="message" class="success">{{ message }}</p>
      <p v-if="!hasStoredData" class="muted">No personal data stored yet.</p>
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

.grid {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  margin-bottom: 1rem;
}
</style>
