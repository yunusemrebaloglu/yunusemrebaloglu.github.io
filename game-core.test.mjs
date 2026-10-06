import test from 'node:test';
import assert from 'node:assert/strict';
import { CARS, createRun, stepRun, PLAYER_Z } from './game-core.mjs';

const simulate = (run, seconds, input = {}) => {
  for (let i = 0; i < seconds * 60 && !run.crashed; i++) {
    stepRun(run, input, 1 / 60, () => 0);
    run.traffic = [];
  }
};
test('all three cars reach their distinct top speeds', () => {
  for (const car of CARS) {
    const run = createRun(car.id);
    simulate(run, 20, { accelerate: true });
    assert.equal(run.speed, car.maxSpeed);
    assert.ok(run.score > 0);
  }
});
test('nitro increases speed, consumes charge and regenerates', () => {
  const run = createRun();
  simulate(run, 12, { accelerate: true });
  simulate(run, 2, { nitro: true });
  assert.ok(run.speed > run.car.maxSpeed);
  assert.ok(run.nitro < 50);
  simulate(run, 7);
  assert.equal(run.nitro, 100);
  assert.equal(run.speed, run.car.maxSpeed);
});
test('braking wins over accelerator and nitro', () => {
  const run = createRun(); run.speed = 100;
  stepRun(run, { brake: true, accelerate: true, nitro: true }, .05);
  assert.ok(run.speed < 100); assert.equal(run.boosting, false);
});
test('empty nitro does not stutter while held and unlocks on release', () => {
  const run = createRun(); run.speed = 200; run.nitro = 1;
  stepRun(run, { nitro: true }, .05);
  assert.equal(run.nitroLocked, true); assert.equal(run.boosting, false);
  simulate(run, 2, { nitro: true });
  assert.equal(run.boosting, false); assert.ok(run.nitro > 10);
  stepRun(run, {}, .05);
  stepRun(run, { nitro: true }, .05);
  assert.equal(run.boosting, true);
});
test('collision ends a run and further updates cannot change score', () => {
  const run = createRun(); run.speed = 200;
  run.traffic = [{ x: 0, z: PLAYER_Z - 3.8, speed: 70, passed: false }];
  assert.deepEqual(stepRun(run, {}, .05), ['crash']);
  const score = run.score;
  assert.deepEqual(stepRun(run, {}, .05), []);
  assert.equal(run.score, score);
});
test('near misses award exactly 150 bonus once', () => {
  const run = createRun(); run.speed = 240; run.x = 2;
  run.traffic = [{ x: 0, z: PLAYER_Z + 3.9, speed: 70, passed: false }];
  assert.deepEqual(stepRun(run, {}, .05), ['near-miss']);
  assert.equal(run.bonus, 150);
  stepRun(run, {}, .05); assert.equal(run.bonus, 150);
});
test('safe overtakes award 50 and distant traffic is removed', () => {
  const run = createRun(); run.speed = 240; run.x = -3.45;
  run.traffic = [{ x: 3.45, z: PLAYER_Z + 3.9, speed: 70, passed: false }, { x: 0, z: 40, speed: 70, passed: true }];
  stepRun(run, {}, .05);
  assert.equal(run.bonus, 50); assert.equal(run.traffic.length, 1);
});
test('road shoulders slow the car and steering stays bounded', () => {
  const run = createRun(); run.speed = 240;
  simulate(run, 5, { right: true });
  assert.equal(run.x, 6.5); assert.equal(run.speed, 85);
});
test('physics are independent of 30 / 60 Hz frame rate', () => {
  const first = createRun(), second = createRun();
  for (let i = 0; i < 300; i++) stepRun(first, {}, 1 / 30, () => 0);
  for (let i = 0; i < 600; i++) stepRun(second, {}, 1 / 60, () => 0);
  assert.ok(Math.abs(first.speed - second.speed) < .001);
  assert.ok(Math.abs(first.distance - second.distance) < 1);
});
test('large frame deltas are capped to prevent collision tunneling', () => {
  const run = createRun(); run.speed = 250;
  stepRun(run, {}, 10);
  assert.ok(run.distance < 4);
});
test('invalid car identifiers fail explicitly', () => {
  assert.throws(() => createRun('missing'), /Unknown car/);
});
