<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Algorithm, BarRow } from '@/types/api'
import { formatMs } from '@/utils/format'

/**
 * Horizontal bars comparing one measure across AES / DES / RC4.
 *
 * Each bar is labelled with its algorithm and value, so identity never rests
 * on colour alone; the table view carries the same numbers.
 */
const props = defineProps<{ title: string; caption?: string; rows: BarRow[] }>()

const showTable = ref(false)
const hovered = ref<Algorithm | null>(null)

const max = computed(() => Math.max(...props.rows.map((r) => r.value), 0) || 1)

/** Bar length as a share of the track; at least a sliver so zero stays visible. */
function width(value: number) {
  return `${Math.max((value / max.value) * 100, 0.5)}%`
}

const active = computed(() => props.rows.find((r) => r.algorithm === hovered.value) ?? null)
</script>

<template>
  <figure class="chart">
    <figcaption>
      <h3>{{ title }}</h3>
      <p v-if="caption" class="muted small">{{ caption }}</p>
    </figcaption>

    <p v-if="rows.length === 0" class="muted">No data yet.</p>

    <div v-else-if="!showTable" class="plot" role="img" :aria-label="title">
      <div
        v-for="row in rows"
        :key="row.algorithm"
        class="bar-row"
        :class="{ dim: hovered && hovered !== row.algorithm }"
        tabindex="0"
        :aria-label="`${row.algorithm}: ${formatMs(row.value)}`"
        @pointerenter="hovered = row.algorithm"
        @pointerleave="hovered = null"
        @focus="hovered = row.algorithm"
        @blur="hovered = null"
      >
        <span class="name">{{ row.algorithm }}</span>
        <span class="track">
          <span
            class="bar"
            :style="{ width: width(row.value), background: `var(--series-${row.algorithm.toLowerCase()})` }"
          />
          <span class="value">{{ formatMs(row.value) }}</span>
        </span>

        <span v-if="active?.algorithm === row.algorithm" class="tooltip" role="status">
          <strong>{{ formatMs(row.value) }}</strong>
          <span class="muted">{{ row.algorithm }}</span>
          <span v-for="detail in row.details ?? []" :key="detail.label" class="small">
            {{ detail.label }} <strong>{{ detail.value }}</strong>
          </span>
        </span>
      </div>
    </div>

    <div v-else class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Algorithm</th>
            <th class="num">Value</th>
            <th v-for="detail in rows[0]?.details ?? []" :key="detail.label" class="num">
              {{ detail.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.algorithm">
            <td>{{ row.algorithm }}</td>
            <td class="num">{{ formatMs(row.value) }}</td>
            <td v-for="detail in row.details ?? []" :key="detail.label" class="num">
              {{ detail.value }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <button v-if="rows.length" class="quiet small toggle" @click="showTable = !showTable">
      {{ showTable ? 'Show chart' : 'Show as table' }}
    </button>
  </figure>
</template>

<style scoped>
.chart {
  margin: 0;
}

figcaption h3 {
  margin-bottom: 0.15rem;
}

figcaption p {
  margin-bottom: 0.75rem;
}

.plot {
  display: grid;
  gap: 0.35rem;
}

.bar-row {
  position: relative;
  display: grid;
  grid-template-columns: 3rem 1fr;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.25rem;
  border-radius: 6px;
  outline: none;
}

.bar-row:focus-visible {
  box-shadow: var(--focus);
}

.bar-row:hover,
.bar-row:focus-visible {
  background: var(--sheet-2);
}

.bar-row.dim .bar {
  opacity: 0.4;
}

.name {
  font-weight: 600;
}

/* The value sits after the bar; the bar's max length leaves room for it. */
.track {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-left: 1px solid var(--line-strong);
  padding-right: 5.5rem;
}

.bar {
  height: 20px;
  border-radius: 0 4px 4px 0;
  flex-shrink: 0;
}

.value {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  margin-right: -5.5rem;
}

.tooltip {
  position: absolute;
  right: 0;
  bottom: calc(100% + 4px);
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 9rem;
  padding: 0.5rem 0.75rem;
  background: var(--sheet);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  box-shadow: 0 4px 14px rgb(23 48 42 / 12%);
  pointer-events: none;
  font-variant-numeric: tabular-nums;
}

.toggle {
  margin-top: 0.25rem;
  min-height: 2rem;
}
</style>
