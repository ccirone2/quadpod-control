# Quadpod control page

Bluetooth control page for the quadpod robot. Open it in Chrome on Android, press **Connect** and pick
the device named "quadpod". After that the page connects on its own whenever it is open and the robot is
in range (on load, and again after a lost link), with no tap; the header shows "waiting for quadpod…"
meanwhile. Errors show as a toast, and the screen stays awake while connected.

Remembering the robot needs `navigator.bluetooth.getDevices`, which Chrome on Android may keep behind
`chrome://flags/#enable-web-bluetooth-new-permissions-backend` (set it to Enabled, relaunch). Without it
every page load needs a Connect tap and the chooser. Uses Web Bluetooth with the Nordic UART Service, so it must be served over
https (GitHub Pages) or from an origin allowed by the Chrome flag below.

Live: https://ccirone2.github.io/quadpod-control/

## Layout

Sticky header (status, Connect, STOP) + one tab of content + bottom tab bar. STOP works from any tab:
a tap sends `!` (stop and hold, servos stay powered; a walk plants its feet), holding it for 1 s sends `X`
(servos off, the robot drops). A BLE disconnect halts the robot the same way as a tap.

| Tab     | What it does |
|---------|--------------|
| Drive   | Proportional joystick (up/down forward/back, left/right rotate, diagonals arc; release to stop), Strafe slider that recentres on release, Step slider (stride mm; the firmware adapts the cadence), Creep/Trot |
| Pose    | Postures card (whole-body positions): Stand, Rest, Lie, Ball, Splay; Poses card (feet planted): presets Sit, Tall, Crouch, Peek, Lean, then Height / Lean (roll) / Tilt (pitch) / Turn (yaw) sliders, Sideways / Forward shift under More, Snap back toggle (default on) returns a slider to centre on release and centres everything when switched on |
| Actions | Every animation except the postures (on the Pose tab) and the idle fidgets (hidden on purpose), plus Play all (demo); highlights what the robot reports playing |
| Console | Developer mode only (long-press the "Quadpod" title for 1 s). Reply log, raw command line with history, quick commands |

## Files

```
index.html         shell only
style.css          tokens (light + dark), layout, shared components
js/app.js          tab registry, header wiring, shared log buffer
js/ble.js          Link: Web Bluetooth NUS transport, remembered device, auto-connect, send queue
                   (events: state, line, tx, error, info)
js/protocol.js     tables (GAITS, SPEED, STRIDE, RESEND_MS, ANIMS, POSTURES, HIDDEN), then one builder per command in protocol group order
js/ui.js           DOM helpers: h(), store, throttle(), slider(), segmented(), card()
js/tabs/*.js       one module per tab
```

No build step. ES modules, so it must be served over http(s), not opened as a file.

## Adding a feature

Create `js/tabs/<name>.js` exporting

```js
export default {
  id: 'name', label: 'Name', icon: '<svg paths>',
  mount(root, ctx) { /* append cards to root */ },
  onLeave() {},   // optional: tab switched away
  onHidden() {},  // optional: page hidden, disconnected, or STOP pressed - stop anything continuous
  dev: true,      // optional: only shown in developer mode
};
```

`ctx` gives you `send(cmd, {quiet, key, urgent})`, `log(text, cls)`, `link`, `dev` (developer mode),
`playing()` / `onPlaying(fn)` (the animation the robot reports, or null), and the log buffer helpers.
Give continuous controls a `key` (one per stream, e.g. `'drive'`): a newer line replaces an unsent older
one instead of queueing behind it. `urgent` is for STOP-like lines only. Add the module
to `TABS` in `js/app.js`. Mark controls that need a connection with class `needs-link` and they dim until
connected. New commands go in `js/protocol.js` under their protocol group; new postures in `POSTURES` and new
body-pose presets in `PRESETS`, both in `js/tabs/pose.js`. Conventions: sentence-case player words for labels (developer details only when `ctx.dev`), `store.get/set`
for anything remembered, `P.RESEND_MS` for continuous controls, the `mt` class instead of inline margins.

## Testing locally

```
python -m http.server 8000      # in this folder
```

On the phone, open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add `http://<pc-ip>:8000`,
relaunch Chrome and open that URL. Or just push: Pages rebuilds in about a minute.
