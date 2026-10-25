export default defineNuxtConfig({
 compatibilityDate: '2026-10-25',
 devtools: { enabled: false },
 css: ['~/assets/main.css'],
 app: { head: { title: 'SwingLab — Swing Research', meta: [{ name: 'description', content: 'Riset swing saham Indonesia dengan rencana risiko yang terukur.' }] } },
 typescript: { strict: true },
 nitro: { externals: { external: ['@libsql/client'] } }
})

