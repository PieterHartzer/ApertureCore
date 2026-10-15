// Nitro serves the installed, self-contained ESM runtime as a static asset.
// Vite's dev transforms can overflow on its large embedded WASM strings.
const runtimeUrl = '/vendor/web-llm/index.js'
export const loadWebLlm = () => import(/* @vite-ignore */ runtimeUrl) as Promise<typeof import('@mlc-ai/web-llm')>
