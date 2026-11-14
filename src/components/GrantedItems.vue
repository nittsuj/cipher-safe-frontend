<script setup lang="ts">
import { reactive, ref } from 'vue'

import FilePreview from '@/components/FilePreview.vue'
import ProfileSnapshot from '@/components/ProfileSnapshot.vue'
import RedeemForm from '@/components/RedeemForm.vue'
import { requestsApi } from '@/api/cipherSafe'
import { getErrorMessage } from '@/api/client'
import type { AccessRequest, GrantedItemSummary } from '@/types/api'
import { categoryLabel } from '@/utils/format'

/** As the requester: what an owner granted, with Enter key and Open per item. */
const props = defineProps<{ request: AccessRequest }>()
const emit = defineEmits<{ changed: [] }>()

const entering = ref<number | null>(null)
const errors = reactive<Record<number, string>>({})
const preview = reactive({
  open: false,
  title: '',
  blob: null as Blob | null,
  filename: null as string | null,
  loading: false,
  error: '',
})
const profile = ref<Record<string, string> | null>(null)

function itemLabel(item: GrantedItemSummary) {
  return item.kind === 'PROFILE' ? 'Profile' : categoryLabel(item.category ?? '')
}

async function open(item: GrantedItemSummary) {
  errors[item.item_id] = ''
  try {
    if (item.kind === 'PROFILE') {
      profile.value = await requestsApi.openProfile(props.request.id, item.item_id)
    } else {
      Object.assign(preview, {
        open: true,
        title: itemLabel(item),
        blob: null,
        loading: true,
        error: '',
      })
      const result = await requestsApi.openFile(props.request.id, item.item_id)
      Object.assign(preview, {
        blob: result.blob,
        filename: result.filename,
        title: result.filename ?? itemLabel(item),
      })
    }
    emit('changed') // the access count went up
  } catch (err) {
    const message = getErrorMessage(err, 'Could not open it.')
    if (preview.open) preview.error = message
    else errors[item.item_id] = message
  } finally {
    preview.loading = false
  }
}

function redeemed() {
  entering.value = null
  emit('changed')
}
</script>

<template>
  <div class="granted">
    <p class="small"><strong>Shared with you</strong></p>
    <ul>
      <li v-for="item in request.items" :key="item.item_id">
        <div class="item">
          <span>
            {{ itemLabel(item) }}
            <span class="muted small">
              {{ item.redeemed ? `opened ${item.access_count}×` : 'key not entered yet' }}
            </span>
          </span>
          <button v-if="item.redeemed" @click="open(item)">Open</button>
          <button
            v-else-if="entering !== item.item_id"
            class="secondary"
            @click="entering = item.item_id"
          >
            Enter key
          </button>
        </div>
        <RedeemForm
          v-if="entering === item.item_id && !item.redeemed"
          :request-id="request.id"
          :item-id="item.item_id"
          :label="itemLabel(item)"
          @redeemed="redeemed"
        />
        <p v-if="errors[item.item_id]" class="notice error small" role="alert">
          {{ errors[item.item_id] }}
        </p>
      </li>
    </ul>

    <FilePreview
      :open="preview.open"
      :title="preview.title"
      :blob="preview.blob"
      :filename="preview.filename"
      :loading="preview.loading"
      :error="preview.error"
      @close="preview.open = false"
    />
    <ProfileSnapshot :owner="request.owner" :fields="profile" @close="profile = null" />
  </div>
</template>

<style scoped>
.granted {
  flex-basis: 100%;
  border-top: 1px solid var(--line);
  padding-top: 0.5rem;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 0.4rem 0;
}

.item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}
</style>
