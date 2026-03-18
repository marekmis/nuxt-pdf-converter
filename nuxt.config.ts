// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-10-14',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  nitro: {
    experimental: {
      wasm: true
    }
  },
  runtimeConfig: {
    maxFileSize: '50MB',
    public: {
      maxFileSize: '50MB'
    }
  }
})