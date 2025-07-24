// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
  ],

  css: ['~/assets/css/main.css'],

  ui: {
    colorMode: false,
  },

  future: {
    compatibilityVersion: 4
  },

  compatibilityDate: '2024-11-27'
})