<template>
  <div class="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <UIcon name="i-heroicons-lock-closed" class="h-10 w-10 text-primary-500 mx-auto mb-4" />
        <h1 class="text-2xl font-bold text-gray-100">PDF to JPG Converter</h1>
        <p class="text-sm text-gray-400 mt-2">Enter the password to continue</p>
      </div>

      <UCard class="p-6">
        <form class="space-y-4" @submit.prevent="submit">
          <div>
            <label for="password" class="block text-sm font-medium text-gray-200 mb-1">Password</label>
            <input
              id="password"
              ref="passwordInput"
              v-model="password"
              type="password"
              autocomplete="current-password"
              :disabled="isSubmitting"
              class="w-full rounded-md bg-gray-700 border border-gray-600 text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
            />
          </div>

          <UAlert v-if="error" color="red" variant="solid" :title="error" />

          <UButton type="submit" size="lg" block :loading="isSubmitting" :disabled="!password || isSubmitting">
            Unlock
          </UButton>
        </form>
      </UCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

useHead({ title: 'Sign in — PDF to JPG Converter' })

const route = useRoute()
const password = ref('')
const error = ref('')
const isSubmitting = ref(false)
const passwordInput = ref<HTMLInputElement>()

const submit = async () => {
  if (!password.value || isSubmitting.value) return

  isSubmitting.value = true
  error.value = ''

  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { password: password.value } })

    // Full reload so the server middleware sees the new session cookie.
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    window.location.href = redirect.startsWith('/') ? redirect : '/'
  } catch (err: any) {
    error.value = err.statusMessage || err.data?.statusMessage || 'Sign in failed'
    password.value = ''
    isSubmitting.value = false
    passwordInput.value?.focus()
  }
}

onMounted(() => passwordInput.value?.focus())
</script>
