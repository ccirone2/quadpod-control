// Command builders for the quadpod text protocol (see quadpod/command.cpp).
// Tables first, then one builder per command in the firmware's group order (general, motion, anim, gait,
// debug). Every builder returns one command line as a string (no newline).

// ---- tables ----
export const GAIT = { STOP: 0, CREEP: 1, TROT: 2 };
export const GAITS = [{ id: GAIT.CREEP, label: 'Creep' }, { id: GAIT.TROT, label: 'Trot' }];

// Full-scale velocities at 100 % speed.
export const SPEED = { MAX_MM_S: 40, MAX_DEG_S: 30 };
// Stride length (mm) for the step-size slider; the firmware adapts the cadence (U command).
export const STRIDE = { MIN: 10, MAX: 50, DEFAULT: 30 };
// Continuous controls (drive, pose sliders) send at most once per RESEND_MS. The firmware's gait
// watchdog zeroes the velocity after 1.5 s of silence, so a held stick resends well inside that.
export const RESEND_MS = 100;

// Animation ids = position in this list (mirror of Anim::Id in quadpod/animation.h).
export const ANIMS = ['stand', 'sit', 'rest', 'wave', 'bow', 'pushup', 'stretch', 'lie', 'highfive',
  'wiggle', 'leglift', 'look', 'sway', 'bounce', 'twist', 'ball', 'splay',
  'breathe', 'circle', 'peek', 'scratch', 'point', 'kick', 'scrape', 'splash', 'crack'].map((label, id) => ({ id, label }));
// Whole-body postures: shown on the Pose tab, not in the animation grid. Stand is home() (H), rest is rest() (R).
export const POSTURES = ['stand', 'sit', 'rest', 'lie', 'ball', 'splay'];
// Idle fidgets (IDLE_SET in animation.cpp): the robot plays these by itself; not shown on the page (a surprise).
export const HIDDEN = ['breathe', 'look', 'scratch', 'sway', 'stretch', 'scrape', 'crack'];

const r = v => Math.round(v);
const byName = name => anim(ANIMS.find(a => a.label === name).id);

// ---- general ----
export const help  = () => '?';
export const halt  = () => '!';   // stop and hold, servos stay powered (walking: feet planted at home)
export const off   = () => 'X';   // servos unpowered: the robot drops

// ---- cal ----
export const listCal = () => 'L';

// ---- motion ----
export const home  = () => 'H';
export const rest  = () => 'R';
export const pose  = ({ x = 0, y = 0, z = 0, roll = 0, pitch = 0, yaw = 0 } = {}) =>
  `P ${r(x)} ${r(y)} ${r(z)} ${r(roll)} ${r(pitch)} ${r(yaw)}`;

// ---- anim ----
export const anim  = id => `A ${r(id)}`;
export const sit   = () => byName('sit');
export const lie   = () => byName('lie');
export const ball  = () => byName('ball');
export const splay = () => byName('splay');
export const demo  = () => 'Y';

// ---- gait ----
export const gait  = (type, vx = 0, vy = 0, wz = 0) => `G ${r(type)} ${r(vx)} ${r(vy)} ${r(wz)}`;
export const stopGait = (type = GAIT.STOP) => gait(type, 0, 0, 0);
export const stride = mm => `U ${r(mm)}`;

// ---- debug ----
export const query = () => 'Q';
