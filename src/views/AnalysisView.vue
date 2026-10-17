<script setup lang="ts">
import { onMounted, ref } from 'vue'

import AsyncButton from '@/components/AsyncButton.vue'
import { analysisApi } from '@/api/cipherSafe'
import { useAsyncAction } from '@/composables/useAsyncAction'
import type { DownloadEvent, TimingAnalysis } from '@/types/api'
import { formatBytes, formatDate, formatMs } from '@/utils/format'

const timings = ref<TimingAnalysis | null>(null)
const downloads = ref<DownloadEvent[]>([])

const load = useAsyncAction(async () => {
  const [timingData, history] = await Promise.all([analysisApi.timings(), analysisApi.downloads()])
  timings.value = timingData
  downloads.value = history
}, 'Could not load analysis.')

onMounted(() => {
  load.run()
})
</script>

<template>
  <div class="container">
    <h1>Analysis</h1>
    <p class="muted">
      Running-time comparison per algorithm. Key derivation (PBKDF2, 600k rounds) dominates, which
      is why the cipher column is separated out.
    </p>

    <div class="row">
      <AsyncButton
        variant="secondary"
        :loading="load.loading.value"
        label="Refresh"
        loading-label="Refreshing..."
        @click="load.run()"
      />
    </div>

    <p v-if="load.error.value" class="error">{{ load.error.value }}</p>

    <template v-if="timings">
      <div class="card">
        <h3>Encryption (per stored ciphertext)</h3>
        <table>
          <thead>
            <tr>
              <th>Algorithm</th>
              <th>Files</th>
              <th>Mean total</th>
              <th>Min</th>
              <th>Max</th>
              <th>Mean ciphertext</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in timings.encryptions" :key="row.algorithm">
              <td>{{ row.algorithm }}</td>
              <td>{{ row.files }}</td>
              <td>{{ formatMs(row.mean_ms) }}</td>
              <td>{{ formatMs(row.min_ms) }}</td>
              <td>{{ formatMs(row.max_ms) }}</td>
              <td>{{ row.mean_ciphertext_size ? formatBytes(row.mean_ciphertext_size) : '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card">
        <h3>Downloads</h3>
        <table>
          <thead>
            <tr>
              <th>Algorithm</th>
              <th>Runs</th>
              <th>Mean total</th>
              <th>Min</th>
              <th>Max</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in timings.downloads" :key="row.algorithm">
              <td>{{ row.algorithm }}</td>
              <td>{{ row.runs }}</td>
              <td>{{ formatMs(row.mean_ms) }}</td>
              <td>{{ formatMs(row.min_ms) }}</td>
              <td>{{ formatMs(row.max_ms) }}</td>
            </tr>
            <tr v-if="timings.downloads.length === 0">
              <td colspan="5" class="muted">No downloads recorded yet.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div class="card">
      <h3>Download history</h3>
      <table>
        <thead>
          <tr>
            <th>File</th>
            <th>Algorithm</th>
            <th>Bytes</th>
            <th>Total</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="event in downloads" :key="event.id">
            <td>{{ event.original_name }}</td>
            <td>{{ event.algorithm }}</td>
            <td>{{ formatBytes(event.bytes_out) }}</td>
            <td>{{ formatMs(event.total_ms) }}</td>
            <td class="muted">{{ formatDate(event.created_at) }}</td>
          </tr>
          <tr v-if="downloads.length === 0">
            <td colspan="5" class="muted">No downloads yet.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
