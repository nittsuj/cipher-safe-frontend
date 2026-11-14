<script setup lang="ts">
import { computed, ref } from 'vue'

import { envelopeMessage, envelopeShareLinks } from '@/config/requests'
import { formatFingerprint } from '@/utils/format'

/**
 * The key for one granted item, for the owner to send out of band. The text is
 * the item's key encrypted with the requester's public key: only their private
 * key opens it, so it can travel over WhatsApp or email.
 */
const props = defineProps<{
  title: string
  envelope: string
  recipient: string
  fingerprint: string
}>()

const copied = ref(false)

const groups = computed(() => formatFingerprint(props.fingerprint).split(' '))
const links = computed(() => envelopeShareLinks(props.title, props.envelope))

/** The phone's share sheet when the browser has one; otherwise the links below. */
const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

async function share() {
  try {
    await navigator.share({
      title: `Cipher Safe key: ${props.title}`,
      text: envelopeMessage(props.title, props.envelope),
    })
  } catch {
    // Closing the share sheet throws AbortError; nothing to do.
  }
}

async function copy() {
  await navigator.clipboard.writeText(props.envelope)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <article class="envelope-card" :aria-label="`Key for ${title}`">
    <h3>{{ title }}</h3>
    <label class="small" :for="`envelope-${title}`">Key to send to {{ recipient }}</label>
    <textarea
      :id="`envelope-${title}`"
      class="key envelope"
      :value="envelope"
      readonly
      rows="4"
      spellcheck="false"
      @focus="($event.target as HTMLTextAreaElement).select()"
    />
    <div class="row">
      <button @click="copy">{{ copied ? 'Copied' : 'Copy key' }}</button>
      <button v-if="canShare" class="secondary" @click="share">Share via…</button>
      <template v-else>
        <a class="button secondary" :href="links.whatsapp" target="_blank" rel="noopener noreferrer"
          >WhatsApp</a
        >
        <a class="button secondary" :href="links.email">Email</a>
      </template>
      <slot name="actions" />
    </div>
    <p class="small muted">
      Send this through WhatsApp, email or in person, not through Cipher Safe. Only
      {{ recipient }} can open it.
    </p>
    <p class="small">
      {{ recipient }}'s key fingerprint:
      <span class="key fp">
        <template v-for="(group, index) in groups" :key="index">
          <strong v-if="index === 0 || index === groups.length - 1">{{ group }}</strong>
          <span v-else>{{ group }}</span
          >{{ ' ' }}
        </template>
      </span>
      <br />
      Ask them to check that the first and last groups match what they see under My keys.
    </p>
  </article>
</template>

<style scoped>
.envelope-card {
  padding: 1rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-sheet);
  background: var(--accent-soft);
}

h3 {
  margin: 0 0 0.5rem;
  overflow-wrap: anywhere;
}

.envelope {
  width: 100%;
  font-size: 0.85rem;
  word-break: break-all;
  resize: vertical;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.fp {
  word-spacing: 0.15em;
}
</style>
