import { createMockServices, seedFromSearch, type MockServices } from '@harbor/mock-data'

let services: MockServices | null = null

/**
 * The services for this JavaScript realm, built once from `?seed=`.
 *
 * An iframe app is its own realm, so it gets its own instance: nothing is
 * shared with other apps except what travels through the agent. In-process
 * widgets and tiles live in the shell's realm and share one instance, the way
 * they would share one connection to a real backend.
 */
export function realmServices(): MockServices {
  services ??= createMockServices({ seed: seedFromSearch(window.location.search) })
  return services
}
