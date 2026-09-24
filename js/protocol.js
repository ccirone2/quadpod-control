// Command builders for the quadpod text protocol (see quadpod/command.cpp).
// Tables first, then one builder per command in the firmware's group order (general, cal, motion, anim,
// gait, debug). Every builder returns one command line as a string (no newline).

// ---- tables ----
// The animations and gaits themselves come from the robot (# catalog, js/catalog.js); only player words live here.
export const GAIT = { STOP: 0 };

// Full-scale velocities at 100 % speed.
export const SPEED = { MAX_MM_S: 40, MAX_DEG_S: 30 };
// Stride length (mm) for the step-size slider; the firmware adapts the cadence (U command).
export const STRIDE = { MIN: 10, MAX: 50, DEFAULT: 30 };
// Continuous controls (drive, pose sliders) send at most once per RESEND_MS. The firmware's gait
// watchdog zeroes the velocity after 1.5 s of silence, so a held stick resends well inside that.
export const RESEND_MS = 100;

// Player labels by firmware name (animations and gaits). Anything missing shows its name capitalised, so a new
// animation appears on the page with no change here; add a label only when that reads badly.
export const LABELS = {
  pushup: 'Push-ups', lie: 'Lie down', highfive: 'High five', look: 'Look around',
};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export const label = name => LABELS[name] ?? cap(name);
// Animations the page leaves out on purpose besides the idle fidgets (tagged idle by the robot, a surprise):
// the sit animation, because the Pose tab's Sit is a body-pose preset instead.
export const OFF_PAGE = ['sit'];

const r = v => Math.round(v);

// ---- general ----
export const help  = () => '?';
export const halt  = () => '!';   // stop and hold, servos stay powered (walking: feet planted at home)
export const off   = () => 'X';   // servos unpowered: the robot drops
export const catalog = () => '#'; // the robot lists its animations and gaits (js/catalog.js reads the reply)

// ---- cal ----
export const listCal = () => 'L';

// ---- motion ----
export const home  = () => 'H';
export const rest  = () => 'R';
export const pose  = ({ x = 0, y = 0, z = 0, roll = 0, pitch = 0, yaw = 0 } = {}) =>
  `P ${r(x)} ${r(y)} ${r(z)} ${r(roll)} ${r(pitch)} ${r(yaw)}`;

// ---- anim ----
export const anim  = id => `A ${r(id)}`;
export const demo  = () => 'Y';

// ---- gait ----
export const gait  = (type, vx = 0, vy = 0, wz = 0) => `G ${r(type)} ${r(vx)} ${r(vy)} ${r(wz)}`;
export const stopGait = (type = GAIT.STOP) => gait(type, 0, 0, 0);
export const stride = mm => `U ${r(mm)}`;

// ---- debug ----
export const query = () => 'Q';
