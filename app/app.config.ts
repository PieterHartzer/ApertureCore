export default defineAppConfig({
  // The name shown in the interface and messages. A layer can override it.
  brand: { name: 'ApertureCore' },
  ui: {
    colors: { primary: 'blue', neutral: 'neutral' },
    card: {
      slots: {
        root: 'rounded-[10px] bg-[var(--surface)] backdrop-blur-md ring ring-default shadow-none',
        header: 'p-4 sm:px-4',
        body: 'p-4 sm:p-4',
        footer: 'p-4 sm:px-4'
      }
    },
    button: {
      compoundVariants: [{
        color: 'primary',
        variant: 'solid',
        // Colours come from --button-* in main.css, so a layer can restyle buttons without replacing this.
        class: 'bg-linear-to-r from-(--button-from) to-(--button-to) text-(--button-text) hover:from-(--button-hover-from) hover:to-(--button-hover-to) active:from-(--button-hover-from) active:to-(--button-hover-to) disabled:from-(--button-from) disabled:to-(--button-to) aria-disabled:from-(--button-from) aria-disabled:to-(--button-to)'
      }]
    },
    pageHeader: {
      slots: {
        root: 'border-none py-0 pb-5',
        container: 'flex flex-col gap-0',
        wrapper: 'flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between',
        headline: 'hidden',
        title: 'text-xl font-semibold tracking-tight sm:text-xl',
        description: 'mt-0.5 text-sm text-muted'
      }
    },
    pageCard: {
      slots: {
        container: 'p-4 sm:p-4 lg:p-4',
        title: 'text-sm font-medium',
        description: 'text-sm'
      }
    },
    pageBody: {
      base: 'mt-0 space-y-4 pb-12'
    },
    table: {
      slots: {
        th: 'px-4 py-2.5 text-xs font-medium text-muted',
        td: 'px-4 py-3 text-sm text-default'
      }
    },
    alert: {
      defaultVariants: { variant: 'subtle' },
      slots: {
        root: 'relative overflow-hidden w-full rounded-lg p-4 flex gap-2.5',
        title: 'text-sm font-semibold',
        description: 'text-sm leading-6 opacity-90'
      }
    }
  }
})
