export default defineAppConfig({
  ui: {
    alert: {
      slots: {
        root: 'relative overflow-hidden w-full rounded-xl p-4 shadow-sm flex gap-2.5',
        title: 'text-sm font-semibold',
        description: 'text-sm leading-6 opacity-90'
      }
    }
  }
})
