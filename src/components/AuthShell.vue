<script setup lang="ts">
/** Two-column frame for sign-in and registration. */
defineProps<{ title: string }>()
</script>

<template>
  <div class="auth">
    <aside class="intro">
      <p class="pitch">Your medical history, in your pocket, readable only by you.</p>
      <ul>
        <li>Keep KTP and BPJS cards, lab results and scan videos together.</li>
        <li>Open them at any clinic, on your phone.</li>
        <li>Share a record only when you approve, with a key only you can give.</li>
      </ul>
    </aside>
    <section class="sheet form-sheet">
      <h1>{{ title }}</h1>
      <slot />
    </section>
  </div>
</template>

<style scoped>
.auth {
  max-width: 980px;
  margin: 0 auto;
  padding: 3.5rem 1.5rem;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 440px);
  gap: 3.5rem;
  align-items: center;
}

.pitch {
  font-size: 2.1rem;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.015em;
  max-width: 16ch;
  margin-bottom: 1.5rem;
}

.intro ul {
  margin: 0;
  padding-left: 1.2rem;
  color: var(--ink-2);
  display: grid;
  gap: 0.5rem;
}

.form-sheet {
  padding: 2rem;
}

.form-sheet h1 {
  font-size: 1.6rem;
  margin-bottom: 1.25rem;
}

@media (max-width: 780px) {
  .auth {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    padding: 1.5rem 1rem;
  }

  .pitch {
    font-size: 1.5rem;
    margin-bottom: 0;
  }

  .intro ul {
    display: none;
  }

  .form-sheet {
    padding: 1.4rem;
  }
}
</style>
