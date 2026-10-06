export const CARS = [
  { id: 'apex', name: 'APEX GT', className: 'DENGELİ', tagline: 'HER YOLA HAZIR', description: 'Güç ve kontrol. Gecenin kusursuz dengesi.', color: '#d7ff63', maxSpeed: 245, acceleration: 48, handling: 2.9, nitroPower: 65 },
  { id: 'phantom', name: 'PHANTOM R', className: 'HIZ CANAVARI', tagline: 'SINIR TANIMAZ', description: 'Daha yüksek son hız. Cesur sürücüler için.', color: '#a78bfa', maxSpeed: 290, acceleration: 40, handling: 2.35, nitroPower: 75 },
  { id: 'vortex', name: 'VORTEX S', className: 'ÇEVİK', tagline: 'VİRAJLARIN USTASI', description: 'Keskin direksiyon, hızlı ivmelenme. Tam kontrol.', color: '#67e8f9', maxSpeed: 220, acceleration: 60, handling: 3.6, nitroPower: 60 },
];
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const ROAD_LIMIT = 5.2;
export const PLAYER_Z = 6;
export const LANES = [-3.45, 0, 3.45];

export function createRun(carId = 'apex') {
  const car = CARS.find(item => item.id === carId);
  if (!car) throw new Error(`Unknown car: ${carId}`);
  return { car, speed: 0, x: 0, distance: 0, score: 0, bonus: 0, nitro: 100, boosting: false, nitroLocked: false, traffic: [], spawnTimer: 1.8, elapsed: 0, crashed: false, overtakes: 0 };
}

export function stepRun(run, input, delta, random = Math.random) {
  if (run.crashed) return [];
  const dt = clamp(delta, 0, 0.05);
  const events = [];
  run.elapsed += dt;
  if (!input.nitro) run.nitroLocked = false;
  run.boosting = Boolean(input.nitro && !run.nitroLocked && run.nitro > 0.5 && run.speed > 40 && !input.brake);
  run.nitro = clamp(run.nitro + (run.boosting ? -27 : 9) * dt, 0, 100);
  if (run.boosting && run.nitro <= 0.5) { run.boosting = false; run.nitroLocked = true; }
  const offroad = Math.abs(run.x) > ROAD_LIMIT;
  const targetSpeed = offroad ? 85 : run.car.maxSpeed + (run.boosting ? run.car.nitroPower : 0);
  if (input.brake) run.speed = Math.max(0, run.speed - 115 * dt);
  else if (run.speed < targetSpeed) run.speed = Math.min(targetSpeed, run.speed + run.car.acceleration * (input.accelerate ? 1 : 0.62) * (run.boosting ? 1.65 : 1) * dt);
  else run.speed = Math.max(targetSpeed, run.speed - 85 * dt);
  const steer = Number(Boolean(input.right)) - Number(Boolean(input.left));
  run.x = clamp(run.x + steer * run.car.handling * (0.35 + Math.min(run.speed / 150, 1)) * dt, -6.5, 6.5);
  const movement = run.speed / 3.6 * dt;
  run.distance += movement;
  run.spawnTimer -= dt;
  if (run.spawnTimer <= 0) {
    const lane = Math.floor(random() * LANES.length);
    run.traffic.push({ x: LANES[lane], z: -220, speed: 65 + random() * 45, color: Math.floor(random() * 4), passed: false });
    run.spawnTimer = Math.max(0.85, 2.3 - run.distance / 8000) + random() * 0.55;
  }
  for (const car of run.traffic) {
    const previousZ = car.z;
    car.z += (run.speed - car.speed) / 3.6 * dt;
    const dx = Math.abs(run.x - car.x);
    const crossedPlayer = Math.min(previousZ, car.z) < PLAYER_Z + 3.7 && Math.max(previousZ, car.z) > PLAYER_Z - 3.7;
    if (crossedPlayer && dx < 1.65) {
      run.crashed = true;
      run.boosting = false;
      events.push('crash');
      break;
    }
    if (!car.passed && previousZ <= PLAYER_Z + 4 && car.z > PLAYER_Z + 4) {
      car.passed = true;
      run.overtakes++;
      if (dx < 2.5) { run.bonus += 150; events.push('near-miss'); }
      else run.bonus += 50;
    }
  }
  run.traffic = run.traffic.filter(car => car.z < 35 && car.z > -350);
  run.score = Math.floor(run.distance * 2) + run.bonus;
  return events;
}
