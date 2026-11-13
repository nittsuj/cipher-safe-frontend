<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import AlgorithmBars from '@/components/AlgorithmBars.vue'
import AsyncButton from '@/components/AsyncButton.vue'
import { analysisApi } from '@/api/cipherSafe'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { ALGORITHMS, type BarRow, type DownloadEvent, type TimingAnalysis, type TimingRow } from '@/types/api'
import { formatBytes, formatDate, formatMs } from '@/utils/format'

const timings = ref<TimingAnalysis | null>(null)
const downloads = ref<DownloadEvent[]>([])

const load = useAsyncAction(async () => {
  const [timingData, history] = await Promise.all([analysisApi.timings(), analysisApi.downloads()])
  timings.value = timingData
  downloads.value = history
}, 'Could not load the analysis.')

onMounted(() => load.run())

/** Keep AES, DES, RC4 order regardless of what the server returns. */
function ordered(rows: TimingRow[]): TimingRow[] {
  return ALGORITHMS.flatMap((a) => rows.filter((r) => r.algorithm === a))
}

function bars(rows: TimingRow[], countLabel: string, count: (r: TimingRow) => number): BarRow[] {
  return ordered(rows).map((row) => ({
    algorithm: row.algorithm,
    value: row.mean_ms,
    details: [
      { label: 'Min', value: formatMs(row.min_ms) },
      { label: 'Max', value: formatMs(row.max_ms) },
      { label: countLabel, value: String(count(row)) },
    ],
  }))
}

const encryptBars = computed(() =>
  bars(timings.value?.encryptions ?? [], 'Files', (r) => r.files ?? 0),
)
const downloadBars = computed(() =>
  bars(timings.value?.downloads ?? [], 'Runs', (r) => r.runs ?? 0),
)

/**
 * The cipher step alone, from the download log. Key setup (PBKDF2) costs the
 * same for every algorithm and hides the difference between the ciphers, so
 * this is where AES, DES and RC4 actually differ.
 */
const cipherOnlyBars = computed<BarRow[]>(() =>
  ALGORITHMS.flatMap((algorithm) => {
    const events = downloads.value.filter((e) => e.algorithm === algorithm && e.success)
    if (!events.length) return []
    const values = events.map((e) => e.cipher_ms)
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    return [
      {
        algorithm,
        value: mean,
        details: [
          { label: 'Min', value: formatMs(Math.min(...values)) },
          { label: 'Max', value: formatMs(Math.max(...values)) },
          { label: 'Runs', value: String(values.length) },
        ],
      },
    ]
  }),
)
</script>

<template>
  <div class="page">
    <header class="page-head head-row">
      <div>
        <h1>Cipher analysis</h1>
        <p class="lede">
          How long AES-GCM, DES-CTR and RC4 take on your own records. Every record is stored with all
          three, so the numbers compare like with like.
        </p>
      </div>
      <AsyncButton
        variant="secondary"
        :loading="load.loading.value"
        label="Refresh"
        loading-label="Refreshing…"
        @click="load.run()"
      />
    </header>

    <p v-if="load.error.value" class="notice error" role="alert">{{ load.error.value }}</p>

    <div v-if="timings" class="charts">
      <section class="sheet wide">
        <AlgorithmBars
          title="Cipher step on download (mean)"
          caption="Decryption alone, without key setup: where the three ciphers actually differ."
          :rows="cipherOnlyBars"
        />
      </section>
      <section class="sheet">
        <AlgorithmBars
          title="Download, end to end (mean)"
          caption="Key setup + integrity check + decryption."
          :rows="downloadBars"
        />
      </section>
      <section class="sheet">
        <AlgorithmBars
          title="Upload encryption (mean)"
          caption="Per stored copy, including key setup."
          :rows="encryptBars"
        />
      </section>
    </div>

    <section class="sheet history">
      <h2>Download history</h2>
      <p v-if="!downloads.length" class="muted">
        Nothing yet. Open or download a record and its timing appears here.
      </p>
      <div v-else class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Record</th>
              <th>Cipher</th>
              <th class="num">Size</th>
              <th class="num">Key setup</th>
              <th class="num">Cipher</th>
              <th class="num">Total</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in downloads" :key="event.id" :class="{ failed: !event.success }">
              <td>{{ event.original_name }}</td>
              <td>{{ event.algorithm }}</td>
              <td class="num">{{ event.success ? formatBytes(event.bytes_out) : 'failed check' }}</td>
              <td class="num">{{ formatMs(event.key_derivation_ms) }}</td>
              <td class="num">{{ formatMs(event.cipher_ms) }}</td>
              <td class="num">{{ formatMs(event.total_ms) }}</td>
              <td class="muted">{{ formatDate(event.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.head-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
}

.charts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}

.wide {
  grid-column: 1 / -1;
}

.failed td {
  color: var(--danger);
}

@media (max-width: 820px) {
  .charts {
    grid-template-columns: 1fr;
  }

  .head-row {
    flex-direction: column;
  }
}
</style>
