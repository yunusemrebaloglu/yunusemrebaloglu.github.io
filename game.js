import { CARS, createRun, stepRun, clamp } from './game-core.mjs';
import { Renderer } from './renderer.js';

const $ = id => document.getElementById(id);
const number = value => Math.floor(value).toLocaleString('tr-TR');
let mode = 'garage', selected = CARS[0].id, run = createRun(), countdown = 0;
let best = 0, storageAvailable = true, renderer, contextReady = false;
let lastTime = 0, messageTime = 0, noticeTimeout;
const keys = new Set(), touches = new Set();
const input = {};
const ui = Object.fromEntries(['score','distance','speed','speed-bar','nitro-bar','nitro-label','race-message'].map(id => [id,$(id)]));

function notify(message) {
  $('notice').textContent = message; $('notice').hidden = false;
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => { $('notice').hidden = true; }, 6500);
}
function storageError(error) {
  storageAvailable = false;
  console.warn('Midnight Run: yerel kayıt kullanılamıyor.', error);
  notify('Tarayıcı yerel kaydı engelliyor. Rekorun yalnızca bu oturumda korunacak.');
}
try {
  const stored = localStorage.getItem('midnight-run-best');
  if (stored !== null) {
    const parsed = Number(stored);
    if (Number.isSafeInteger(parsed) && parsed >= 0) best = parsed;
    else { localStorage.removeItem('midnight-run-best'); console.warn('Midnight Run: geçersiz rekor kaydı.', stored); notify('Geçersiz rekor kaydı sıfırlandı. Yeni bir rekorla başlayabilirsin.'); }
  }
} catch (error) { storageError(error); }
function updateBest() { $('garage-best').innerHTML = `${number(best)} <small>PUAN</small>`; $('hud-best').textContent = number(best); }
updateBest();

function carIllustration(car) {
  const compact = car.id === 'vortex';
  return `<svg viewBox="0 0 230 95" aria-hidden="true"><defs><linearGradient id="paint-${car.id}" x2=".3" y2="1"><stop stop-color="${car.color}"/><stop offset="1" stop-color="${car.color}" stop-opacity=".55"/></linearGradient></defs><ellipse cx="119" cy="79" rx="87" ry="7" fill="${car.color}" opacity=".1"/><path d="M25 58 42 45 91 35 144 36 178 50 206 54 213 69 183 78 45 76 24 69Z" fill="url(#paint-${car.id})"/><path d="m75 44 22-21 45 2 31 25-46 9Z" fill="${car.color}"/><path d="m84 44 16-16 15 1-6 22Z" fill="#232d42"/><path d="m120 29 20 1 23 20-45 5Z" fill="#303951"/><path d="m26 59 64 9 121-9-1 13-118 12-65-13Z" fill="${car.color}" opacity=".7"/><path d="m91 68 120-9" stroke="#fff" opacity=".4"/><path d="m31 59 30 4-2 6-29-4Z" fill="#e9ffff"/><path d="m180 62 25-4 3 5-26 5Z" fill="#ff4c82"/><ellipse cx="63" cy="72" rx="14" ry="16" fill="#0b0d15"/><ellipse cx="63" cy="72" rx="8" ry="10" fill="#687086"/><ellipse cx="177" cy="72" rx="14" ry="16" fill="#0b0d15"/><ellipse cx="177" cy="72" rx="8" ry="10" fill="#687086"/><path d="m97 60 61-6" stroke="#121726" stroke-width="2"/>${compact?'':'<path d="m175 46 29-5 5 4-30 6Z" fill="#363449"/><path d="m188 47 1 8" stroke="#363449" stroke-width="3"/>'}</svg>`;
}
$('car-options').innerHTML = CARS.map(car => `<button class="car-option" data-car="${car.id}" aria-pressed="false" aria-label="${car.name}, ${car.className}">${carIllustration(car)}<strong>${car.name}</strong><small>${car.tagline}</small></button>`).join('');
function selectCar(id) {
  selected = id; run = createRun(id);
  const car = run.car;
  document.querySelectorAll('[data-car]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.car === id)));
  $('car-name').textContent = car.name; $('car-description').textContent = car.description; $('car-class').textContent = car.className;
  const specs = [['SON HIZ',`${car.maxSpeed} km/h`,car.maxSpeed/3.3],['0–100 KM/H',`${(100/car.acceleration).toFixed(1)} sn`,car.acceleration/0.65],['YOL TUTUŞ',car.handling>=3?'KESKİN':car.handling>=2.8?'DENGELİ':'SPORTİF',car.handling/0.04]];
  $('car-specs').innerHTML = specs.map(([label,value,percent]) => `<div><div class="spec-label"><span>${label}</span><strong>${value}</strong></div><div class="spec-track"><i style="width:${percent}%"></i></div></div>`).join('');
}
document.querySelectorAll('[data-car]').forEach(button => button.addEventListener('click', () => selectCar(button.dataset.car)));
selectCar(selected);

let audioContext, engine, engineGain, soundEnabled = false;
function initAudio() {
  if (audioContext) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) { notify('Bu tarayıcı oyun sesini desteklemiyor. Sessiz oynamaya devam edebilirsin.'); return; }
  audioContext = new AudioContextClass();
  engine = audioContext.createOscillator(); engine.type = 'sawtooth';
  const filter = audioContext.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 420;
  engineGain = audioContext.createGain(); engineGain.gain.value = 0;
  engine.connect(filter); filter.connect(engineGain); engineGain.connect(audioContext.destination); engine.start();
}
$('sound').addEventListener('click', async () => {
  try {
    initAudio();
    if (!audioContext) return;
    await audioContext.resume();
    soundEnabled = !soundEnabled;
    $('sound').setAttribute('aria-pressed', String(soundEnabled));
    $('sound').setAttribute('aria-label', soundEnabled ? 'Sesi kapat' : 'Sesi aç');
    $('sound-state').textContent = soundEnabled ? 'AÇIK' : 'KAPALI';
  } catch (error) { console.error('Midnight Run: ses başlatılamadı.', error); notify('Ses başlatılamadı. Tarayıcı ses izinlerini kontrol et.'); }
});
function updateAudio() {
  if (!audioContext || !engineGain) return;
  const active = soundEnabled && mode === 'racing' && countdown <= 0;
  engine.frequency.setTargetAtTime(35+run.speed*.55+(run.boosting?35:0),audioContext.currentTime,.08);
  engineGain.gain.setTargetAtTime(active ? .035 : 0,audioContext.currentTime,.12);
}
function clearInput() {
  keys.clear(); touches.clear();
  document.querySelectorAll('[data-control]').forEach(button => button.classList.remove('pressed'));
}
function message(text, duration=1.4) { ui['race-message'].textContent=text; messageTime=duration; }
function closeRaceDialogs() { for (const id of ['pause-dialog','result-dialog']) if ($(id).open) $(id).close(); }
function startRace() {
  if (!contextReady) { notify('3D sahne henüz hazır değil. Tarayıcının WebGL desteğini kontrol et.'); return; }
  closeRaceDialogs(); clearInput();
  run = createRun(selected); mode = 'racing'; countdown = 3;
  $('garage').hidden = true; $('hud').hidden = false;
  document.body.classList.add('racing'); document.body.classList.remove('boosting');
  lastTime = performance.now(); message('3',3);
  updateHud();
}
function garage() {
  closeRaceDialogs(); clearInput(); mode = 'garage'; run = createRun(selected);
  $('garage').hidden = false; $('hud').hidden = true;
  document.body.classList.remove('racing','boosting');
  updateBest(); updateAudio(); $('start').focus();
}
function pauseRace() {
  if (mode !== 'racing') return;
  mode = 'paused'; clearInput(); updateAudio(); document.body.classList.remove('boosting');
  $('pause-dialog').showModal();
}
function resumeRace() {
  if (mode !== 'paused') return;
  if (!contextReady) { notify('3D sahnenin yeniden bağlanmasını bekle.'); return; }
  $('pause-dialog').close(); clearInput(); mode = 'racing'; lastTime = performance.now();
}
function finishRace() {
  mode='finished'; clearInput(); updateAudio(); document.body.classList.remove('boosting');
  const record = run.score > best;
  if (record) {
    best=run.score; updateBest();
    if (storageAvailable) try { localStorage.setItem('midnight-run-best',String(best)); } catch (error) { storageError(error); }
  }
  $('result-eyebrow').textContent=record?'YENİ KİŞİSEL REKOR!':'SÜRÜŞ TAMAMLANDI';
  $('result-score').textContent=number(run.score); $('result-distance').textContent=`${number(run.distance)} m`;
  $('result-dialog').showModal();
}
$('start').addEventListener('click',startRace); $('retry').addEventListener('click',startRace);
$('pause').addEventListener('click',pauseRace); $('resume').addEventListener('click',resumeRace);
$('pause-garage').addEventListener('click',garage); $('result-garage').addEventListener('click',garage);
$('help-open').addEventListener('click',()=>$('help-dialog').showModal());
$('help-close').addEventListener('click',()=>$('help-dialog').close());
$('pause-dialog').addEventListener('cancel',event=>{event.preventDefault();resumeRace();});
$('result-dialog').addEventListener('cancel',event=>{event.preventDefault();garage();});
const controlKeys = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','Space'];
document.addEventListener('keydown',event=>{
  if ((event.code==='Escape'||event.code==='KeyP') && (mode==='racing'||mode==='paused')) {
    event.preventDefault();
    if (!event.repeat) { if (mode==='racing') pauseRace(); else resumeRace(); }
    return;
  }
  if (mode!=='racing'||!controlKeys.includes(event.code)) return;
  event.preventDefault(); keys.add(event.code);
});
document.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{clearInput();pauseRace();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();pauseRace();}});
document.querySelectorAll('[data-control]').forEach(button=>{
  const release=()=>{touches.delete(button.dataset.control);button.classList.remove('pressed');};
  button.addEventListener('pointerdown',event=>{
    if(mode!=='racing')return;
    event.preventDefault();button.setPointerCapture(event.pointerId);
    touches.add(button.dataset.control);button.classList.add('pressed');
  });
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
});
function readInput() {
  input.left=keys.has('ArrowLeft')||keys.has('KeyA')||touches.has('left');
  input.right=keys.has('ArrowRight')||keys.has('KeyD')||touches.has('right');
  input.accelerate=keys.has('ArrowUp')||keys.has('KeyW')||touches.has('accelerate');
  input.brake=keys.has('ArrowDown')||keys.has('KeyS')||touches.has('brake');
  input.nitro=keys.has('ShiftLeft')||keys.has('ShiftRight')||keys.has('Space')||touches.has('nitro');
}
function updateHud() {
  ui.score.textContent=String(run.score).padStart(6,'0');
  ui.distance.textContent=number(run.distance);ui.speed.textContent=Math.round(run.speed);
  ui['speed-bar'].style.width=`${clamp(run.speed/(run.car.maxSpeed+run.car.nitroPower)*100,0,100)}%`;
  ui['nitro-bar'].style.width=`${run.nitro}%`;
  ui['nitro-label'].textContent=run.boosting?'BOOST AKTİF':run.nitro<25?'DOLUM YAPILIYOR':'SHIFT / BOOST';
  document.body.classList.toggle('boosting',mode==='racing'&&run.boosting);
}
let animationId;
function frame(time) {
  const dt=lastTime?clamp((time-lastTime)/1000,0,.05):0;lastTime=time;
  readInput();
  if(mode==='racing'){
    if(countdown>0){
      countdown=Math.max(0,countdown-dt);
      ui['race-message'].textContent=countdown>0?String(Math.ceil(countdown)):'YOLA ÇIK!';
      if(countdown===0) message('YOLA ÇIK!',1);
    }else{
      for(const event of stepRun(run,input,dt)) {
        if(event==='near-miss') message('YAKIN GEÇİŞ +150');
        if(event==='crash') finishRace();
      }
      if(Math.abs(run.x)>5.2 && messageTime<=0)message('YOLA DÖN',.3);
      messageTime-=dt;
      if(messageTime<=0)ui['race-message'].textContent='';
    }
    updateHud();
  }
  updateAudio();
  renderer.render(run,time/1000,mode,Number(input.right)-Number(input.left));
  animationId=requestAnimationFrame(frame);
}
function fatal(error) {
  console.error('Midnight Run: 3D hatası.',error);
  $('start').disabled=true;
  $('retry').disabled=true;
  $('resume').disabled=true;
  const panel=document.createElement('div');panel.className='fatal-message';panel.setAttribute('role','alert');
  panel.textContent=error.message;document.body.append(panel);
}
try { renderer=new Renderer($('world'));contextReady=true;animationId=requestAnimationFrame(frame); } catch(error) { fatal(error); }
$('world').addEventListener('webglcontextlost',event=>{
  event.preventDefault();contextReady=false;cancelAnimationFrame(animationId);pauseRace();
  $('start').disabled=true;$('retry').disabled=true;$('resume').disabled=true;
  notify('3D bağlantısı kesildi. Sahne kurtarıldığında sürüşüne devam edebilirsin.');
});
$('world').addEventListener('webglcontextrestored',()=>{
  try {renderer=new Renderer($('world'));contextReady=true;$('start').disabled=false;$('retry').disabled=false;$('resume').disabled=false;lastTime=performance.now();animationId=requestAnimationFrame(frame);notify('3D sahne yeniden hazır.');}
  catch(error){fatal(error);}
});
