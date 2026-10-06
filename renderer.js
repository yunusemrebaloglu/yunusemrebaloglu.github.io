import { PLAYER_Z } from './game-core.mjs';

const vertexSource = `
attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uModel;
uniform mat4 uViewProjection;
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(uModel) * aNormal);
  gl_Position = uViewProjection * world;
}`;
const fragmentSource = `
precision mediump float;
uniform vec3 uColor;
uniform float uGlow;
uniform vec3 uCamera;
varying vec3 vNormal;
varying vec3 vWorld;
void main() {
  float light = 0.38 + max(dot(normalize(vNormal), normalize(vec3(-0.5, 0.9, 0.3))), 0.0) * 0.62;
  vec3 color = uColor * mix(light, 1.3, uGlow);
  float fog = 1.0 - exp(-length(vWorld - uCamera) * 0.008);
  gl_FragColor = vec4(mix(color, vec3(0.043, 0.047, 0.086), fog), 1.0);
}`;

function multiply(a, b) {
  const result = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      result[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1] + a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
    }
  }
  return result;
}
function normalize(v) { const length = Math.hypot(...v); return v.map(value => value / length); }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function lookAt(eye, target) {
  const z = normalize(eye.map((value, i) => value - target[i]));
  const x = normalize(cross([0, 1, 0], z));
  const y = cross(z, x);
  const dot = v => -v.reduce((sum, value, i) => sum + value * eye[i], 0);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, dot(x), dot(y), dot(z), 1]);
}
function perspective(fov, aspect) {
  const f = 1 / Math.tan(fov / 2), near = 0.1, far = 700;
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
}
function color(hex) { return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255); }
const palette = ['#ec7199', '#73a3c5', '#ddd5bd', '#e6a44a'];
const colorCache = new Map();
function rgb(hex) { if (!colorCache.has(hex)) colorCache.set(hex, color(hex)); return colorCache.get(hex); }

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('Bu tarayıcı WebGL 3D desteklemiyor. Donanım hızlandırmasını açıp güncel Chrome, Firefox veya Safari ile tekrar dene.');
    this.gl = gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`3D shader oluşturulamadı: ${message}`);
      }
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, vertexSource);
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`3D sahne başlatılamadı: ${gl.getProgramInfoLog(program)}`);
    gl.useProgram(program);
    this.uniforms = Object.fromEntries(['uModel', 'uViewProjection', 'uColor', 'uGlow', 'uCamera'].map(name => [name, gl.getUniformLocation(program, name)]));
    const vertices = [], normals = [];
    const faces = [
      [[-0.5,-0.5,0.5],[0.5,-0.5,0.5],[0.5,0.5,0.5],[-0.5,0.5,0.5],[0,0,1]],
      [[0.5,-0.5,-0.5],[-0.5,-0.5,-0.5],[-0.5,0.5,-0.5],[0.5,0.5,-0.5],[0,0,-1]],
      [[-0.5,-0.5,-0.5],[-0.5,-0.5,0.5],[-0.5,0.5,0.5],[-0.5,0.5,-0.5],[-1,0,0]],
      [[0.5,-0.5,0.5],[0.5,-0.5,-0.5],[0.5,0.5,-0.5],[0.5,0.5,0.5],[1,0,0]],
      [[-0.5,0.5,0.5],[0.5,0.5,0.5],[0.5,0.5,-0.5],[-0.5,0.5,-0.5],[0,1,0]],
      [[-0.5,-0.5,-0.5],[0.5,-0.5,-0.5],[0.5,-0.5,0.5],[-0.5,-0.5,0.5],[0,-1,0]],
    ];
    for (const face of faces) for (const i of [0,1,2,0,2,3]) { vertices.push(...face[i]); normals.push(...face[4]); }
    const attribute = (name, data) => {
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 0, 0);
    };
    attribute('aPosition', vertices); attribute('aNormal', normals);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.043, 0.047, 0.086, 1);
    this.model = new Float32Array(16);
    this.buildings = Array.from({ length: 56 }, (_, i) => ({
      x: (i % 2 ? 1 : -1) * (19 + ((i * 37) % 65)),
      z: -((i * 31) % 340),
      width: 5 + (i * 7) % 11, height: 6 + (i * 13) % 43,
      depth: 6 + (i * 3) % 10,
    }));
  }
  box(x, y, z, w, h, d, hex, glow = 0, rotation = 0) {
    const { gl, uniforms, model } = this;
    const c = Math.cos(rotation), s = Math.sin(rotation);
    model.set([c*w,0,-s*w,0,0,h,0,0,s*d,0,c*d,0,x,y,z,1]);
    gl.uniformMatrix4fv(uniforms.uModel, false, model);
    gl.uniform3fv(uniforms.uColor, rgb(hex)); gl.uniform1f(uniforms.uGlow, glow);
    gl.drawArrays(gl.TRIANGLES, 0, 36);
  }
  car(x, z, hex, modelId, steering = 0, boost = false) {
    const angle = -steering * 0.11;
    const part = (px, y, pz, w, h, d, shade, glow = 0) => {
      this.box(x + px * Math.cos(angle) + pz * Math.sin(angle), y, z - px * Math.sin(angle) + pz * Math.cos(angle), w, h, d, shade, glow, angle);
    };
    const sporty = modelId === 'phantom', compact = modelId === 'vortex';
    const length = compact ? 3.8 : 4.3;
    part(0,.43,0,1.82,.48,length,'#151724');
    part(0,.72,0,1.95,.46,length,hex);
    part(0,.94,-1.18,1.8,.12,1.65,hex);
    part(0,1.14,.15,1.52,.58,1.9,'#20293c');
    part(0,1.47,.3,1.54,.12,1.2,hex);
    part(0,1.18,1.12,1.48,.42,.06,'#10192d');
    part(0,1.18,-.82,1.48,.4,.06,'#303958');
    part(0,1.1,.22,.13,.75,1.9,hex);
    for (const side of [-1,1]) {
      for (const axle of [-1.35,1.35]) {
        part(side*.98,.41,axle,.28,.65,.72,'#080b13');
        part(side*1.13,.41,axle,.025,.35,.4,'#758097');
      }
      part(side*.59,.8,-length/2-.02,.49,.13,.05,'#c2faff',1);
      part(side*.59,.8,length/2+.02,.62,.13,.05,'#ff3667',1);
      part(side*.97,.42,0,.025,.055,2.65,hex,1);
      part(side*.95,1.12,-.45,.28,.15,.3,hex);
    }
    part(0,.62,length/2+.03,.64,.12,.08,'#11111d');
    part(0,.47,0,1.5,.035,length+.3,hex,.8);
    if (sporty || modelId === 'apex') {
      for (const side of [-1,1]) part(side*.65,1.11,1.67,.1,.38,.14,'#171925');
      part(0,1.32,1.67,2.1,.12,.38,sporty ? '#242333' : hex);
    }
    if (boost) {
      for (const side of [-1,1]) {
        part(side*.55,.44,length/2+.5,.22,.2,.8,'#a78bfa',1);
        part(side*.55,.44,length/2+.9,.13,.13,.7,'#67e8f9',1);
      }
    }
  }
  render(run, time, mode, steering) {
    const { gl, canvas, uniforms } = this;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    const width = Math.round(canvas.clientWidth * ratio), height = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height); }
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const garage = mode === 'garage';
    const camera = garage ? [11,6.5,18] : [run.x*.32,4.7,17.7];
    const target = garage ? [0,1,-15] : [run.x*.22,1,-42];
    const fov = (garage ? 58 : run.boosting ? 69 : 60) * Math.PI / 180;
    gl.uniformMatrix4fv(uniforms.uViewProjection, false, multiply(perspective(fov, width/height), lookAt(camera,target)));
    gl.uniform3fv(uniforms.uCamera, camera);
    const distance = garage ? time*14 : run.distance;
    this.box(0,-.35,-130,700,.5,700,'#0c101d');
    this.box(0,-.05,-130,11.4,.1,360,'#262637');
    for (const side of [-1,1]) {
      this.box(side*5.5,.025,-130,.08,.04,360,'#b1a9d4',.3);
      this.box(side*6.1,.06,-130,.55,.15,360,'#282332');
      this.box(side*6.1,.15,-130,.07,.05,360,side<0?'#a78bfa':'#67e8f9',1);
      this.box(side*7,.6,-130,.12,.14,360,'#50526b');
    }
    for (let i=0;i<42;i++) {
      const z = -310+i*9+(distance%9);
      for (const x of [-1.73,1.73]) this.box(x,.025,z,.1,.025,3.6,'#c4bfd8',.2);
    }
    for (let i=0;i<13;i++) {
      const z = -305+i*28+(distance%28);
      for (const side of [-1,1]) {
        this.box(side*7.4,3.5,z,.16,7,.16,'#33344a');
        this.box(side*6.2,7,z,2.6,.12,.15,'#42425b');
        this.box(side*5.3,6.9,z,1.1,.08,.42,side<0?'#c4a8ff':'#b7edff',1);
        this.box(side*7,.36,z,.16,.55,.14,'#a78bfa',1);
      }
    }
    for (let i=0;i<this.buildings.length;i++) {
      const building = this.buildings[i];
      const z = ((building.z + distance*.55 + 350)%380)-340;
      const { x, width:w, height:h, depth:d } = building;
      this.box(x,h/2,z,w,h,d,i%3===0?'#1e2035':'#151a2a');
      this.box(x,h,z,w+.1,.09,d+.1,i%2?'#393054':'#263b4e',.4);
      for (let row=0;row<3;row++) {
        this.box(x,h*.2+row*h*.25,z+d/2+.02,w*.66,.14,.05,i%3?'#706196':'#50768c',.7);
      }
      if (i%7===0) this.box(x+w/2+.02,h*.55,z,.06,h*.75,.2,'#ad77e9',1);
    }
    // The distant gate is stationary; nearby road furniture scrolls with the car.
    this.box(-10,7,-185,.5,14,.5,'#45405e');
    this.box(10,7,-185,.5,14,.5,'#45405e');
    this.box(0,14,-185,20,.4,.4,'#9b7fdf',1);
    this.box(0,12,-185,9,2,.25,'#28233f');
    for (let i=0;i<7;i++) this.box(-3+i,12,-184.8,.3,.85,.1,'#d7ff63',1);
    this.box(-68,76,-320,14,14,2,'#c9b6ef',.9,Math.PI/4);
    if (garage) {
      this.car(-3.45,-50+(distance*.7%100),palette[0],'vortex');
      this.car(3.45,-120+(distance*.5%130),palette[1],'apex');
    } else for (const car of run.traffic) this.car(car.x,car.z,palette[car.color],'vortex');
    if (garage && width / height > 1.15) {
      this.box(13,.02,6,6,.18,7,'#161b2e');
      this.box(13,.13,9.4,6,.035,.045,run.car.color,1);
      this.box(15.9,.13,6,.045,.035,7,run.car.color,1);
      this.car(13,6,run.car.color,run.car.id,-4,false);
    } else this.car(run.x,PLAYER_Z,run.car.color,run.car.id,garage ? -.5 : steering,run.boosting);
    if (run.boosting) for (let i=0;i<10;i++) {
      const z = -80+(i*19+distance*3)%100;
      this.box((i%2?-1:1)*(8+i*.12),1+i%3,z,.035,.035,5,i%2?'#a78bfa':'#67e8f9',1);
    }
  }
}
