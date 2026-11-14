import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

import FilesView from '../views/FilesView.vue'
import { jsonResponse } from './helpers'

/** Choose a file in the upload form, as the file input's change event does. */
async function choose(wrapper: VueWrapper, name: string, type: string) {
  const input = wrapper.get<HTMLInputElement>('#file-input')
  Object.defineProperty(input.element, 'files', {
    value: [new File(['%PDF-1.7'], name, { type })],
    configurable: true,
  })
  await input.trigger('change')
}

const signBox = (wrapper: VueWrapper) => wrapper.find<HTMLInputElement>('.sign-option input')

describe('upload form: signing option', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([])),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  async function mountView() {
    const wrapper = mount(FilesView, { global: { stubs: { RecordDrawer: true } } })
    await flushPromises()
    return wrapper
  }

  it('offers signing only for PDFs, unticked', async () => {
    const wrapper = await mountView()
    expect(signBox(wrapper).exists()).toBe(false)

    await choose(wrapper, 'scan.png', 'image/png')
    expect(signBox(wrapper).exists()).toBe(false)

    await choose(wrapper, 'lab.pdf', 'application/pdf')
    expect(signBox(wrapper).exists()).toBe(true)
    expect(signBox(wrapper).element.checked).toBe(false)
  })

  it('unticks signing when another file is chosen', async () => {
    const wrapper = await mountView()
    await choose(wrapper, 'lab.pdf', 'application/pdf')
    await signBox(wrapper).setValue(true)
    expect(signBox(wrapper).element.checked).toBe(true)

    await choose(wrapper, 'referral.pdf', 'application/pdf')
    expect(signBox(wrapper).element.checked).toBe(false)
  })
})
