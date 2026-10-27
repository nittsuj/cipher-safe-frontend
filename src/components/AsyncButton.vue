<script setup lang="ts">
/** Button that shows a loading label while an async action runs. */
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
