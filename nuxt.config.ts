export default defineNuxtConfig({
  compatibilityDate: '2026-10-25',
  devtools: { enabled: false },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: 'Anti-Habit',
      meta: [
        { name: 'description', content: '一个按天记录目标的极简工具。' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
  ui: {
    colorMode: false,
  },
  typescript: {
    strict: true,
  },
})
