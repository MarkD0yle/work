/**
 * @ledgerline/test-utils
 * Fixtures and render helpers shared by package tests.
 */
import type { ActorRef, User } from '@ledgerline/contracts';

export const fixtureUser: User = {
  id: 'u-ada',
  name: 'Ada',
  team: 'Transaction Operations',
  role: 'Super user',
  segment: 'superUser',
  defaultDensity: 'compact',
};

export const fixtureActor: ActorRef = { type: 'user', id: fixtureUser.id, name: fixtureUser.name };
