<script setup lang="ts">
/**
 * Button that swaps its label while an async action is running.
 * Removes the repeated `loading ? 'X...' : 'Y'` ternaries in the views.
 */
withDefaults(
  defineProps<{
    label: string
    loadingLabel?: string
    loading?: boolean
    disabled?: boolean
    variant?: 'secondary' | 'danger'
    type?: 'button' | 'submit'
  }>(),
  {
    loadingLabel: undefined,
    loading: false,
    disabled: false,
    variant: undefined,
    type: 'button',
  },
)
</script>

<template>
  <button :type="type" :class="variant" :disabled="loading || disabled">
    {{ loading ? (loadingLabel ?? `${label}...`) : label }}
  </button>
</template>
