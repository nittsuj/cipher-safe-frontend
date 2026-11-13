<script setup lang="ts">
import { computed, ref } from 'vue'

import { ALGORITHMS, type Algorithm, type BenchmarkResult } from '@/types/api'
import { formatMs } from '@/utils/format'

/**
 * Cipher + integrity time per run for each algorithm on one file (key setup is
 * left out: it costs the same for all three and would flatten the lines). A
 * line per algorithm,
 * a crosshair that snaps to the nearest run, and a tooltip listing every
 * algorithm at that run. Lines are direct-labelled at their right end.
 */
const props = defineProps<{ results: Partial<Record<Algorithm, BenchmarkResult>> }>()

const W = 640
const H = 240
const PAD = { top: 12, right: 64, bottom: 30, left: 60 }
const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom

const series = computed(() =>
  ALGORITHMS.filter((a) => props.results[a]).map((algorithm) => ({
    algorithm,
    result: props.results[algorithm]!,
    samples: props.results[algorithm]!.cipher_samples_ms,
    color: `var(--series-${algorithm.toLowerCase()})`,
  })),
)

const runs = computed(() => Math.max(...series.value.map((s) => s.samples.length), 1))

const yMax = computed(() => {
  const top = Math.max(...series.value.flatMap((s) => s.samples), 0.01)
  // Round the axis up to a readable step.
  const step = 10 ** Math.floor(Math.log10(top))
  return Math.ceil(top / step) * step
})

const yTicks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax.value))

function x(index: number) {
  return PAD.left + (runs.value === 1 ? plotW / 2 : (index / (runs.value - 1)) * plotW)
}

function y(value: number) {
  return PAD.top + plotH - (value / yMax.value) * plotH
}

function path(samples: number[]) {
  return samples.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
}

/** End-of-line labels, pushed apart so they never overlap (min 15px). */
const endLabels = computed(() => {
  const labels = series.value
    .map((s) => ({
      algorithm: s.algorithm,
      x: x(s.samples.length - 1) + 8,
      y: y(s.samples[s.samples.length - 1] ?? 0),
    }))
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < labels.length; i++) {
    labels[i]!.y = Math.max(labels[i]!.y, labels[i - 1]!.y + 15)
  }
  return labels
})

const hoverIndex = ref<number | null>(null)
const svg = ref<SVGSVGElement | null>(null)

function onMove(event: PointerEvent) {
  const box = svg.value?.getBoundingClientRect()
  if (!box) return
  const px = ((event.clientX - box.left) / box.width) * W
  const ratio = (px - PAD.left) / plotW
  hoverIndex.value = Math.min(runs.value - 1, Math.max(0, Math.round(ratio * (runs.value - 1))))
}

function onKey(event: KeyboardEvent) {
  const current = hoverIndex.value ?? -1
  if (event.key === 'ArrowRight') hoverIndex.value = Math.min(runs.value - 1, current + 1)
  else if (event.key === 'ArrowLeft') hoverIndex.value = Math.max(0, current - 1)
  else return
  event.preventDefault()
}

const showTable = ref(false)
</script>

<template>
  <figure class="chart">
    <figcaption class="head">
      <div>
        <h3>Decryption time per run</h3>
        <p class="muted small sub">Cipher and integrity check only. Key setup is about the same for all three.</p>
      </div>
      <ul class="legend" aria-label="Legend">
        <li v-for="s in series" :key="s.algorithm">
          <span class="key" :style="{ background: s.color }" />{{ s.algorithm }}
          <span class="muted">mean {{ formatMs(s.result.cipher_mean_ms) }}</span>
        </li>
      </ul>
    </figcaption>

    <div v-if="!showTable" class="plot">
      <svg
        ref="svg"
        :viewBox="`0 0 ${W} ${H}`"
        role="img"
        aria-label="Decrypt time per benchmark run for each algorithm. Use left and right arrow keys to step through runs."
        tabindex="0"
        @pointermove="onMove"
        @pointerleave="hoverIndex = null"
        @keydown="onKey"
        @blur="hoverIndex = null"
      >
        <g class="grid">
          <g v-for="tick in yTicks" :key="tick">
            <line :x1="PAD.left" :x2="W - PAD.right" :y1="y(tick)" :y2="y(tick)" />
            <text :x="PAD.left - 8" :y="y(tick)" class="tick y">{{ formatMs(tick) }}</text>
          </g>
          <text
            v-for="i in runs"
            :key="i"
            :x="x(i - 1)"
            :y="H - 8"
            class="tick x"
          >
            {{ i }}
          </text>
        </g>

        <line
          v-if="hoverIndex !== null"
          class="crosshair"
          :x1="x(hoverIndex)"
          :x2="x(hoverIndex)"
          :y1="PAD.top"
          :y2="PAD.top + plotH"
        />

        <g v-for="s in series" :key="s.algorithm">
          <path :d="path(s.samples)" class="line" :style="{ stroke: s.color }" />
          <circle
            v-if="hoverIndex !== null && s.samples[hoverIndex] !== undefined"
            :cx="x(hoverIndex)"
            :cy="y(s.samples[hoverIndex]!)"
            r="5"
            class="dot"
            :style="{ fill: s.color }"
          />
        </g>
        <text v-for="label in endLabels" :key="label.algorithm" class="end-label" :x="label.x" :y="label.y">
          {{ label.algorithm }}
        </text>
      </svg>

      <div
        v-if="hoverIndex !== null"
        class="tooltip"
        :style="{ left: `${(x(hoverIndex) / W) * 100}%` }"
        role="status"
      >
        <span class="muted small">Run {{ hoverIndex + 1 }}</span>
        <span v-for="s in series" :key="s.algorithm" class="tip-row">
          <span class="tip-key" :style="{ background: s.color }" />
          <strong>{{ formatMs(s.samples[hoverIndex] ?? 0) }}</strong>
          <span class="muted">{{ s.algorithm }}</span>
        </span>
      </div>
    </div>

    <div v-else class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Run</th>
            <th v-for="s in series" :key="s.algorithm" class="num">{{ s.algorithm }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in runs" :key="i">
            <td>{{ i }}</td>
            <td v-for="s in series" :key="s.algorithm" class="num">
              {{ s.samples[i - 1] !== undefined ? formatMs(s.samples[i - 1]!) : '–' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <button class="quiet small toggle" @click="showTable = !showTable">
      {{ showTable ? 'Show chart' : 'Show as table' }}
    </button>
  </figure>
</template>

<style scoped>
.chart {
  margin: 0;
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 1.5rem;
  margin-bottom: 0.5rem;
}

.head h3 {
  margin: 0;
}

.sub {
  margin: 0;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.1rem;
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.9rem;
  font-weight: 600;
}

.legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.legend .muted {
  font-weight: 400;
}

.key {
  width: 14px;
  height: 3px;
  border-radius: 2px;
}

.plot {
  position: relative;
}

svg {
  width: 100%;
  height: auto;
  display: block;
  overflow: visible;
  outline: none;
}

svg:focus-visible {
  box-shadow: var(--focus);
  border-radius: 6px;
}

.grid line {
  stroke: var(--line);
  stroke-width: 1;
}

.tick {
  font-size: 12px;
  fill: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.tick.y {
  text-anchor: end;
  dominant-baseline: middle;
}

.tick.x {
  text-anchor: middle;
}

.line {
  fill: none;
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.dot {
  stroke: var(--sheet);
  stroke-width: 2;
}

.crosshair {
  stroke: var(--ink-2);
  stroke-width: 1;
}

.end-label {
  font-size: 13px;
  font-weight: 600;
  fill: var(--ink);
  dominant-baseline: middle;
}

.tooltip {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.5rem 0.75rem;
  background: var(--sheet);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-control);
  box-shadow: 0 4px 14px rgb(23 48 42 / 12%);
  pointer-events: none;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.tip-row {
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.tip-key {
  width: 12px;
  height: 2px;
}

.toggle {
  margin-top: 0.25rem;
  min-height: 2rem;
}
</style>
