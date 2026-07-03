import {createActor} from 'xstate';

import {universeNavigationMachine} from './universe-navigation.machine.ts';

describe('universe navigation machine', () => {
  it('starts idle with no selection or travel target', () => {
    const actor = createActor(universeNavigationMachine).start();

    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context).toEqual({selectedNodeId: null, travelNodeId: null});
  });

  it('focuses a node and returns to idle on arrival', () => {
    const actor = createActor(universeNavigationMachine).start();

    actor.send({type: 'SELECT', nodeId: 'neuron-1'});
    actor.send({type: 'FOCUS', nodeId: 'neuron-1'});
    expect(actor.getSnapshot().value).toBe('focusing');
    expect(actor.getSnapshot().context.travelNodeId).toBe('neuron-1');

    actor.send({type: 'ARRIVED'});
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.travelNodeId).toBeNull();
    expect(actor.getSnapshot().context.selectedNodeId).toBe('neuron-1');
  });

  it('flies, retargets mid-glide, and cancels back to idle', () => {
    const actor = createActor(universeNavigationMachine).start();

    actor.send({type: 'FLY', nodeId: 'memory-1'});
    actor.send({type: 'FLY', nodeId: 'memory-2'});
    expect(actor.getSnapshot().value).toBe('flying');
    expect(actor.getSnapshot().context.travelNodeId).toBe('memory-2');

    actor.send({type: 'CANCEL'});
    expect(actor.getSnapshot().value).toBe('idle');
    expect(actor.getSnapshot().context.travelNodeId).toBeNull();
  });

  it('holds ids only in context — no collections, coords, or snapshots (§3.2)', () => {
    const actor = createActor(universeNavigationMachine).start();
    actor.send({type: 'SELECT', nodeId: 'neuron-1'});
    actor.send({type: 'FLY', nodeId: 'memory-1'});

    for (const value of Object.values(actor.getSnapshot().context)) {
      expect(value === null || typeof value === 'string').toBe(true);
    }
  });
});
