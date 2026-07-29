// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-10-14',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  nitro: {
    experimental: {
      wasm: true
    },
    // sharp and pdf-poppler ship native binaries — they must stay external
    // requires resolved at runtime, never inlined into the server bundle.
    externals: {
      external: ['sharp']
    }
  },
  runtimeConfig: {
    maxFileSize: '50MB',
    public: {
      maxFileSize: '50MB'
    }
  }
})