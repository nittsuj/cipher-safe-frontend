import { ref, type Ref } from 'vue'

import { getErrorMessage } from '@/api/client'

export interface AsyncAction<TArgs extends unknown[], TResult> {
  loading: Ref<boolean>
  error: Ref<string>
  run: (...args: TArgs) => Promise<TResult | undefined>
}

/**
 * Wrap an async action with `loading`/`error` state and consistent error
 * messages, removing the repeated try/catch/finally boilerplate from views.
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  fallback = 'Something went wrong.',
): AsyncAction<TArgs, TResult> {
  const loading = ref(false)
  const error = ref('')

  async function run(...args: TArgs): Promise<TResult | undefined> {
    loading.value = true
    error.value = ''
    try {
      return await action(...args)
    } catch (err) {
      error.value = getErrorMessage(err, fallback)
      return undefined
    } finally {
      loading.value = false
    }
  }

  return { loading, error, run }
}
