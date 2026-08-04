// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-10-14',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  runtimeConfig: {
    // Server-only. Set APP_PASSWORD (or NUXT_APP_PASSWORD) in the environment.
    appPassword: process.env.APP_PASSWORD || '',
    public: {
      // Vercel serverless functions reject request bodies above 4.5MB.
      maxFileSize: 4 * 1024 * 1024
    }
  },
  nitro: {
    experimental: {
      wasm: true
    },
    vercel: {
      functions: {
        // Rasterizing a multi-page PDF at high resolution needs time and headroom.
        maxDuration: 60,
        memory: 3009
      }
    }
  }
})
