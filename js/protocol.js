// Command builders for the quadpod text protocol (see quadpod/command.cpp).
// Every builder returns a string (one line, no newline) or, for sequence(), an array of steps.

const r = v => Math.round(v);

export const GAIT = { STOP: 0, CREEP: 1, TROT: 2 };
export const GAITS = [{ id: GAIT.CREEP, label: 'creep' }, { id: GAIT.TROT, label: 'trot' }];

// Full-scale velocities at 100 % speed.
export const SPEED = { MAX_MM_S: 40, MAX_DEG_S: 30 };

export const ANIMS = ['stand', 'sit', 'rest', 'wave', 'bow', 'pushup', 'stretch', 'lie', 'highfive',
  'wiggle', 'leglift', 'look', 'sway', 'bounce', 'twist', 'ball', 'splay',
  'breathe', 'shiver', 'circle', 'peek', 'stomp', 'scratch', 'point', 'dig', 'kick'].map((label, id) => ({ id, label }));

export const help  = () => '?';
export const engine = () => 'E';
export const home  = () => 'H';
export const rest  = () => 'R';
export const off   = () => 'X';
export const demo  = () => 'Y';
export const listCal = () => 'L';
export const query = () => 'Q';
export const anim  = id => `A ${r(id)}`;
// Whole-body postures shown next to Home / Rest / Stand up rather than in the animation grid.
export const POSTURES = ['ball', 'splay'];
export const ball  = () => anim(ANIMS.find(a => a.label === 'ball').id);
export const splay = () => anim(ANIMS.find(a => a.label === 'splay').id);
export const gait  = (type, vx = 0, vy = 0, wz = 0) => `G ${r(type)} ${r(vx)} ${r(vy)} ${r(wz)}`;
export const stopGait = (type = GAIT.STOP) => gait(type, 0, 0, 0);
export const pose  = ({ x = 0, y = 0, z = 0, roll = 0, pitch = 0, yaw = 0 } = {}) =>
  `P ${r(x)} ${r(y)} ${r(z)} ${r(roll)} ${r(pitch)} ${r(yaw)}`;
export const tune  = (stepH, cycleMs) => `B ${r(stepH)} ${r(cycleMs)}`;
export const idle  = on => `D ${on ? 1 : 0}`;   // idle fidgets on/off

// Multi-step actions: [{cmd, delay}] where delay is the pause before the next step (ms).
export const standUp = () => [{ cmd: rest(), delay: 1500 }, { cmd: anim(0) }];
export const sleep   = () => [{ cmd: anim(2), delay: 2000 }, { cmd: off() }];
export const estop   = () => [{ cmd: stopGait(), delay: 0 }, { cmd: off() }];

// Run a sequence through a send() function. Returns a promise that resolves when all steps are sent.
export async function run(seq, send) {
  const steps = Array.isArray(seq) ? seq : [{ cmd: seq }];
  for (const step of steps) {
    send(step.cmd);
    if (step.delay) await new Promise(res => setTimeout(res, step.delay));
  }
}
