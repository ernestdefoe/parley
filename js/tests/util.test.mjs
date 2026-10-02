import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initials, linkParts, runPosition, needsDivider, tally, placeFromPath, windowsThatFit } from '../src/forum/util.js';

const at = (min) => new Date(Date.UTC(2026, 9, 2, 12, min)).toISOString();

test('initials take the first letter of up to two words', () => {
  assert.equal(initials('Coach Okafor'), 'CO');
  assert.equal(initials('RollTide_Rae'), 'RR');
  assert.equal(initials('gatorgrad09'), 'G');
});

test('links are split out and trailing punctuation stays text', () => {
  assert.deepEqual(linkParts('see https://fbsfb.com/d/12. ok'), ['see ', { url: 'https://fbsfb.com/d/12' }, '. ok']);
  assert.deepEqual(linkParts('no links'), ['no links']);
});

test('a run of three from one sender is first, mid, last', () => {
  const msgs = [
    { userId: 1, createdAt: at(0) },
    { userId: 1, createdAt: at(1) },
    { userId: 1, createdAt: at(2) },
    { userId: 2, createdAt: at(3) },
  ];
  assert.deepEqual(msgs.map((_, i) => runPosition(msgs, i)), ['first', 'mid', 'last', 'single']);
});

test('a long gap breaks a run and draws a divider', () => {
  const msgs = [
    { userId: 1, createdAt: at(0) },
    { userId: 1, createdAt: at(45) },
  ];
  assert.deepEqual(msgs.map((_, i) => runPosition(msgs, i)), ['single', 'single']);
  assert.equal(needsDivider(msgs, 1), true);
});

test('a call row never joins a run', () => {
  const msgs = [
    { userId: 1, createdAt: at(0) },
    { userId: 1, type: 'call', createdAt: at(1) },
    { userId: 1, createdAt: at(2) },
  ];
  assert.deepEqual(msgs.map((_, i) => runPosition(msgs, i)), ['single', 'single', 'single']);
});

test('reactions are counted per emoji in first-seen order', () => {
  assert.deepEqual(tally([{ emoji: '🔥' }, { emoji: '👍' }, { emoji: '🔥' }]), [['🔥', 2], ['👍', 1]]);
});

test('the place is read from the path', () => {
  assert.deepEqual(placeFromPath('/d/42-ohio-state-game-thread/310'), { place: 'discussion', discussionId: 42, near: 310 });
  assert.deepEqual(placeFromPath('/d/42'), { place: 'discussion', discussionId: 42, near: null });
  assert.deepEqual(placeFromPath('/t/sec'), { place: 'tag', tagSlug: 'sec' });
  assert.deepEqual(placeFromPath('/'), { place: 'index' });
  assert.deepEqual(placeFromPath('/parley/3'), { place: 'messages' });
});

test('windows that fit beside the rail', () => {
  assert.equal(windowsThatFit(1920, 300), 3);
  assert.equal(windowsThatFit(1280, 300), 2);
  assert.equal(windowsThatFit(600, 0), 1);
});
