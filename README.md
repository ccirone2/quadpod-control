# Quadpod control page

Bluetooth control page for the quadpod robot. Open it in Chrome on Android, press **Connect** and pick
the device named "quadpod". Uses Web Bluetooth with the Nordic UART Service, so it must be served over
https (GitHub Pages) or from an origin allowed by the Chrome flag below.

Live: https://ccirone2.github.io/quadpod-control/

## Layout

Sticky header (status, Connect, STOP) + one tab of content + bottom tab bar. STOP halts walking and
powers the servos off from any tab.

| Tab     | What it does |
|---------|--------------|
| Drive   | Proportional joystick (forward/back, strafe), hold-to-turn buttons, speed limiter, creep/trot |
| Pose    | Poses card: postures (Stand, Rest, Sit, Lie, Ball, Splay) plus standing presets (tall, crouch, peek, lean); body height / roll / pitch / yaw sliders, x/y shift under "more" |
| Actions | All animations, demo |
| Console | Reply log, raw command line with history, quick commands |

## Files

```
index.html         shell only
style.css          tokens (light + dark), layout, shared components
js/app.js          tab registry, header wiring, shared log buffer
js/ble.js          Link: Web Bluetooth NUS transport (events: state, line, tx, error)
js/protocol.js     command builders (gait, pose, anim, ...) and the ANIMS / GAITS tables
js/ui.js           DOM helpers: h(), holdButton(), throttle(), slider(), segmented(), card()
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
};
```

`ctx` gives you `send(cmd, {quiet})`, `log(text, cls)`, `link`, and the log buffer helpers. Add the module
to `TABS` in `js/app.js`. Mark controls that need a connection with class `needs-link` and they dim until
connected. New commands go in `js/protocol.js`; new postures in `POSES` and new standing presets in `PRESETS`, both in `js/tabs/pose.js`.

## Testing locally

```
python -m http.server 8000      # in this folder
```

On the phone, open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add `http://<pc-ip>:8000`,
relaunch Chrome and open that URL. Or just push: Pages rebuilds in about a minute.
