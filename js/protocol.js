// Command builders for the quadpod text protocol (see quadpod/command.cpp).
// Tables first, then one builder per command the page sends, in the firmware's group order (general, raw, cal,
// motion, anim, gait, debug; the page sends nothing from raw). Every builder returns one command line (no newline).

// ---- tables ----
// The animations and gaits themselves come from the robot (# catalog, js/catalog.js); only player words live here.
export const GAIT = { STOP: 0 };

// Full-scale velocities at 100 % speed.
export const SPEED = { MAX_MM_S: 40, MAX_DEG_S: 30 };
// Stride length (mm) for the step-size slider; the firmware adapts the cadence (U command).
export const STRIDE = { MIN: 10, MAX: 50, DEFAULT: 30 };
// Foot lift (step height, mm) for the lift slider, per gait (B command; the firmware allows 0..40).
export const LIFT = { MIN: 5, MAX: 40 };
// Continuous controls (drive, pose sliders) send at most once per RESEND_MS. The firmware's gait
// watchdog zeroes the velocity after 1.5 s of silence, so a held stick resends well inside that.
export const RESEND_MS = 100;

// Player labels by firmware name (animations and gaits). Anything missing shows its name capitalised, so a new
// animation appears on the page with no change here; add a label only when that reads badly.
export const LABELS = {
  pushup: 'Push-ups', lie: 'Lie down', highfive: 'High five', look: 'Look around',
};
// Actions icons by firmware name: stroke paths on a 24x24 grid. A name missing here gets PLAY, so a new
// animation still shows; draw it one when there is time.
const HAND = '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V11M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-12 0v-1.5a1.5 1.5 0 0 1 3 0"/>';
const PLAY = '<path d="M7 5l12 7-12 7z"/>';
export const ICONS = {
  wave: HAND + '<path d="M19.5 3.5c1 .8 1.6 1.8 1.8 3M2.7 6.5c.2-1.2.8-2.2 1.8-3"/>',
  highfive: HAND + '<path d="M12 1v1.5M5 3l1 1.2M19 3l-1 1.2"/>',
  bow: '<path d="M3 17l18-8"/><path d="M6 15.7V21M18 10.3V21"/><path d="M3 21h18"/>',
  pushup: '<path d="M3 21h18"/><path d="M5 15h14"/><path d="M7 15v6M17 15v6"/><path d="M12 11V3M9 6l3-3 3 3"/>',
  wiggle: '<path d="M2 12l3-4 3 8 3-8 3 8 3-8 3 8 2-4"/>',
  bounce: '<circle cx="12" cy="5" r="3"/><path d="M12 10v7M9 14l3 3 3-3M4 21h16"/>',
  twist: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M18 2v4.5h-4.5"/>',
  circle: '<circle cx="12" cy="12" r="8" stroke-dasharray="2.5 3"/><circle cx="12" cy="4" r="2"/>',
  peek: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  point: '<path d="M3 12h13M12 7l5 5-5 5"/><circle cx="20.5" cy="12" r="1.5"/>',
  kick: '<path d="M4 21l5-9 7-3"/><circle cx="19.5" cy="5.5" r="2.5"/><path d="M3 21h6"/>',
  splash: '<path d="M12 4s5 5.5 5 9.5a5 5 0 0 1-10 0C7 9.5 12 4 12 4z"/><path d="M3.5 8l1.5 1M20.5 8L19 9M4 15h1.5M18.5 15H20"/>',
};
export const iconOf = name => ICONS[name] ?? PLAY;
// The page rests the robot (R) after this long with no touch on the page, to spare the servos.
export const IDLE_REST_MIN = 5;
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
// Raise one leg (0 FL, 1 FR, 2 RL, 3 RR) to these joint angles (deg, body-relative); P keeps it raised.
export const limb  = (leg, { coxa = 0, femur = 0, tibia = 0 }) => `^ ${r(leg)} ${r(coxa)} ${r(femur)} ${r(tibia)}`;
export const plant = leg => `^ ${r(leg)}`;   // put a raised leg down again

// ---- anim ----
export const anim  = id => `A ${r(id)}`;
export const demo  = () => 'Y';

// ---- gait ----
export const gait  = (type, vx = 0, vy = 0, wz = 0) => `G ${r(type)} ${r(vx)} ${r(vy)} ${r(wz)}`;
export const stopGait = (type = GAIT.STOP) => gait(type, 0, 0, 0);
export const stride = mm => `U ${r(mm)}`;
// Gait tuning: step height (mm) and cycle (ms) for one gait; the page keeps the robot's cycle and sets the height.
export const tune = (type, stepMm, cycleMs) => `B ${r(stepMm)} ${r(cycleMs)} ${r(type)}`;

// ---- debug ----
export const query = () => 'Q';
