<script setup lang="ts">
import { reactive, ref } from 'vue'

import FilePreview from '@/components/FilePreview.vue'
import ProfileSnapshot from '@/components/ProfileSnapshot.vue'
import RedeemForm from '@/components/RedeemForm.vue'
import SignatureBadge from '@/components/SignatureBadge.vue'
import SignatureDetails from '@/components/SignatureDetails.vue'
import { requestsApi } from '@/api/cipherSafe'
import { getErrorMessage } from '@/api/client'
import type { AccessRequest, GrantedItemSummary, SignatureCheck } from '@/types/api'
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
      if (result.blob.type === 'application/pdf') void checkSignature(item)
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

// Signature checks for shared PDFs, against the owner's certificates. Checking
// doesn't count as opening. The requester can't see a record's type before
// opening it, so a PDF is checked when opened, or with "Check signature".
const signatures = reactive<Record<number, SignatureCheck>>({})
const checking = ref<number | null>(null)

async function checkSignature(item: GrantedItemSummary) {
  errors[item.item_id] = ''
  checking.value = item.item_id
  try {
    signatures[item.item_id] = await requestsApi.itemSignature(props.request.id, item.item_id)
  } catch (err) {
    errors[item.item_id] = getErrorMessage(err, 'Could not check the signature.')
  } finally {
    checking.value = null
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
          <span v-if="item.redeemed" class="actions">
            <button
              v-if="item.kind === 'FILE'"
              class="secondary"
              :disabled="checking === item.item_id"
              @click="checkSignature(item)"
            >
              {{ checking === item.item_id ? 'Checking…' : 'Check signature' }}
            </button>
            <button @click="open(item)">Open</button>
          </span>
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
        <div v-if="signatures[item.item_id]" class="signature">
          <SignatureBadge
            :status="signatures[item.item_id]!.status"
            :signer="signatures[item.item_id]!.signer?.common_name"
          />
          <SignatureDetails :check="signatures[item.item_id]!" :owner="request.owner" />
        </div>
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
.actions {
  display: flex;
  gap: 0.5rem;
}

.signature {
  margin-top: 0.4rem;
}
</style>
