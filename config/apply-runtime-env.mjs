// Load before the built server: node --import ./apply-runtime-env.mjs .output/server/index.mjs
// It turns the app's own environment variables into the NUXT_* ones Nitro reads at start-up.
import { readRuntimeEnv, toNuxtEnv } from './runtime-env.mjs'

Object.assign(process.env, toNuxtEnv(readRuntimeEnv(process.env)))
