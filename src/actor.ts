import { randomUUID } from 'node:crypto';

export type ActorType = 'owner' | 'agent' | 'worker' | 'telegram' | 'system';

export type ActorContext = {
  actorType: ActorType;
  actorId: string;
  credentialScope: string;
  originPlatform: string;
  correlationId: string;
  authenticatedOwner: boolean;
};

export function actorContext(input: Omit<ActorContext, 'correlationId' | 'authenticatedOwner'> & {
  correlationId?: string;
  authenticatedOwner?: boolean;
}): ActorContext {
  if (!input.actorId.trim() || !input.credentialScope.trim() || !input.originPlatform.trim()) {
    throw new Error('invalid_actor_context');
  }
  return {
    ...input,
    correlationId: input.correlationId ?? randomUUID(),
    authenticatedOwner: input.authenticatedOwner ?? input.actorType === 'owner',
  };
}

export function hasScope(actor: ActorContext, required: string) {
  const scopes = new Set(actor.credentialScope.split(/\s+/).filter(Boolean));
  return scopes.has('*') || scopes.has(required);
}
