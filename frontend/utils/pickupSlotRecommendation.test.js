import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRecommendedPickupSlot } from './pickupSlotRecommendation.js';

test('recommended pickup slot is the soonest valid slot with capacity, without mutating the list', () => {
  const later = { startsAt: '2026-11-22T07:00:00.000Z', availableCount: 2 };
  const sooner = { startsAt: '2026-11-22T06:30:00.000Z', availableCount: 1 };
  const slots = [later, { startsAt: 'invalid', availableCount: 3 }, { startsAt: '2026-11-22T06:00:00.000Z', availableCount: 0 }, sooner];
  assert.equal(getRecommendedPickupSlot(slots), sooner);
  assert.equal(slots[0], later);
});

test('pickup recommendation has no selection when there is no available valid slot', () => {
  assert.equal(getRecommendedPickupSlot(null), null);
  assert.equal(getRecommendedPickupSlot([{ startsAt: '2026-11-22T06:00:00.000Z', availableCount: 0 }]), null);
});
