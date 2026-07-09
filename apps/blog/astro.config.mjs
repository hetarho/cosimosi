import { defineConfig } from 'astro/config'

export default defineConfig({
  output: 'static',
  site: process.env.BLOG_SITE_URL ?? 'https://cosimosi.haeram.me',
})
