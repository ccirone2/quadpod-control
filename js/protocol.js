// Command builders for the quadpod text protocol (see quadpod/command.cpp).
// Every builder returns one command line as a string (no newline).

const r = v => Math.round(v);

export const GAIT = { STOP: 0, CREEP: 1, TROT: 2 };
export const GAITS = [{ id: GAIT.CREEP, label: 'creep' }, { id: GAIT.TROT, label: 'trot' }];

// Full-scale velocities at 100 % speed.
export const SPEED = { MAX_MM_S: 40, MAX_DEG_S: 30 };
// Stride length (mm) for the step-size slider; the firmware adapts the cadence (U command).
export const STRIDE = { MIN: 10, MAX: 50, DEFAULT: 30 };

export const ANIMS = ['stand', 'sit', 'rest', 'wave', 'bow', 'pushup', 'stretch', 'lie', 'highfive',
  'wiggle', 'leglift', 'look', 'sway', 'bounce', 'twist', 'ball', 'splay',
  'breathe', 'circle', 'peek', 'scratch', 'point', 'kick', 'scrape', 'splash'].map((label, id) => ({ id, label }));

export const help  = () => '?';
export const halt  = () => '!';   // stop and hold, servos stay powered (walking: feet planted at home)
export const home  = () => 'H';
export const rest  = () => 'R';
export const off   = () => 'X';   // servos unpowered: the robot drops
export const demo  = () => 'Y';
export const listCal = () => 'L';
export const query = () => 'Q';
export const anim  = id => `A ${r(id)}`;
// Idle fidgets: the robot plays these by itself; not shown on the page (they are meant as a surprise).
export const HIDDEN = ['breathe', 'look', 'scratch', 'sway', 'stretch', 'scrape'];
// Whole-body postures: shown on the Pose tab, not in the animation grid. Standing is home() (H).
export const POSTURES = ['stand', 'sit', 'lie', 'ball', 'splay'];
const byName = name => anim(ANIMS.find(a => a.label === name).id);
export const sit   = () => byName('sit');
export const lie   = () => byName('lie');
export const ball  = () => byName('ball');
export const splay = () => byName('splay');
export const gait  = (type, vx = 0, vy = 0, wz = 0) => `G ${r(type)} ${r(vx)} ${r(vy)} ${r(wz)}`;
export const stopGait = (type = GAIT.STOP) => gait(type, 0, 0, 0);
export const pose  = ({ x = 0, y = 0, z = 0, roll = 0, pitch = 0, yaw = 0 } = {}) =>
  `P ${r(x)} ${r(y)} ${r(z)} ${r(roll)} ${r(pitch)} ${r(yaw)}`;
export const stride = mm => `U ${r(mm)}`;
