// BLE link to the robot: Nordic UART Service over Web Bluetooth.
// Events: 'state' {state, name, reconnecting, waiting}  state = 'off' | 'busy' | 'on'
//         'line'  {text}         one reply line from the robot
//         'tx'    {text}         a command we sent
//         'error' {text}
//         'info'  {text}         something the user should know that is not a failure (reconnecting, ...)
//
// Connecting reuses the device picked last time when the browser allows it (navigator.bluetooth.getDevices),
// so the chooser only opens on the first connect or after the remembered device could not be reached.
// A dropped link (not one the user closed) is retried a few times, then the page listens for the robot.
// Listening (listen(), also run on page load) needs no tap: it waits for the remembered device to advertise
// (watchAdvertisements, or a quiet connect attempt every POLL_MS where that is missing) and connects.

const NUS = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const RX  = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const TX  = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const CHUNK = 20;                             // bytes per write: the page cannot see the MTU, and 20 always fits
const CONNECT_MS = 8000;                      // give up on one GATT connect after this long
const RETRY_MS = [1000, 2000, 3000, 5000, 8000];   // reconnect delays after an unexpected drop
const POLL_MS = 5000;                         // listening without watchAdvertisements: try a connect this often

const timeout = (promise, ms, what) => Promise.race([promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(what + ' timed out')), ms))]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export class Link extends EventTarget {
  constructor() {
    super();
    this.device = null;
    this.rx = null;
    this.state = 'off';
    this.rxText = '';
    this.pending = [];          // [{cmd, key}] not yet written
    this.pumping = false;
    this.userClosed = false;    // true after disconnect(): do not reconnect
    this.useChooser = false;    // the remembered device failed: next connect opens the chooser
    this.listening = false;     // waiting for the remembered device to come into range (listen())
    this.watch = null;          // AbortController of the current advertisement wait
    this.attempt = null;        // a listener's connect in flight
    this.onValue = e => this.onData(e.target.value);
    this.onDrop = () => this.dropped();
  }

  get connected() { return this.state === 'on'; }
  get supported() { return !!navigator.bluetooth; }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  setState(state, reconnecting = false) {
    this.state = state;
    this.emit('state', { state, reconnecting, waiting: this.listening && state === 'off',
                         name: this.device?.name || 'quadpod' });
  }

  // A device the user already granted, if the browser supports getDevices.
  async remembered() {
    if (this.useChooser || !navigator.bluetooth.getDevices) return null;
    try {
      const devices = await navigator.bluetooth.getDevices();
      return devices.find(d => d.name === 'quadpod') || devices[0] || null;
    } catch { return null; }
  }

  // Connect to the remembered robot without a tap, whenever it is in range. Stops on connect, on
  // disconnect() and when Connect is tapped. Does nothing if the browser cannot remember devices.
  async listen() {
    if (!this.supported || this.userClosed || this.listening || this.state !== 'off') return;
    const device = await this.remembered();
    if (!device || this.userClosed || this.listening || this.state !== 'off') return;
    this.device = device;
    this.listening = true;
    this.setState('off');
    while (this.listening) {
      this.watch = new AbortController();
      const heard = await this.waitFor(device, this.watch.signal);
      this.watch.abort();                               // stop watching before connecting
      if (!heard || !this.listening) break;
      this.attempt = this.open(device);
      try { await this.attempt; break; }
      catch { try { device.gatt.disconnect(); } catch {} this.rx = null; }   // cancel a connect still pending
      finally { this.attempt = null; }
    }
    this.listening = false;
    if (this.userClosed && this.device?.gatt?.connected) this.device.gatt.disconnect();
  }

  stopListening() {
    if (!this.listening) return;
    this.listening = false;
    this.watch?.abort();
  }

  // Resolves true when the device is worth a connect attempt: it advertised or, where the browser cannot
  // watch advertisements, POLL_MS passed. Resolves false if the wait is aborted.
  waitFor(device, signal) {
    return new Promise(resolve => {
      signal.addEventListener('abort', () => resolve(false), { once: true });
      const poll = () => setTimeout(() => resolve(true), POLL_MS);
      if (!device.watchAdvertisements) { poll(); return; }
      device.addEventListener('advertisementreceived', () => resolve(true), { once: true, signal });
      try { device.watchAdvertisements({ signal }).catch(poll); } catch { poll(); }
    });
  }

  async connect() {
    if (!this.supported) { this.emit('error', { text: 'Web Bluetooth is not available in this browser' }); return false; }
    this.userClosed = false;
    this.stopListening();
    this.setState('busy');
    if (this.attempt) {                                 // the listener is already connecting: let it finish
      try { await this.attempt; return true; } catch {}
    }
    try {
      let device = await this.remembered();
      const known = !!device;
      if (!device) device = await navigator.bluetooth.requestDevice({ filters: [{ services: [NUS] }] });
      try {
        await this.open(device);
      } catch (err) {
        if (known) this.useChooser = true;   // out of range or forgotten: let the user pick next time
        throw err;
      }
      this.useChooser = false;
      return true;
    } catch (err) {
      this.rx = null;
      this.setState('off');
      const hint = this.useChooser ? ' (tap Connect again to choose it from the list)' : '';
      this.emit('error', { text: 'connect failed: ' + err.message + hint });
      return false;
    }
  }

  // GATT connect, find the UART characteristics, start notifications. Throws on failure.
  async open(device) {
    this.device = device;
    device.addEventListener('gattserverdisconnected', this.onDrop);   // same function: never added twice
    const server = await timeout(device.gatt.connect(), CONNECT_MS, 'connect');
    const svc = await server.getPrimaryService(NUS);
    this.rx = await svc.getCharacteristic(RX);
    const tx = await svc.getCharacteristic(TX);
    await tx.startNotifications();
    tx.addEventListener('characteristicvaluechanged', this.onValue);
    this.rxText = '';
    this.setState('on');
    this.pump();
  }

  disconnect() {
    this.userClosed = true;
    this.stopListening();
    this.pending = [];
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    else { this.rx = null; this.setState('off'); }
  }

  // The link went down. If the user did not close it, try to get it back. Drops while a connect or a
  // reconnect is still in progress (state 'busy') belong to that attempt, which handles its own failure.
  async dropped() {
    if (this.state !== 'on') return;
    this.rx = null;
    this.pending = [];
    if (this.userClosed || !this.device) { this.setState('off'); return; }
    this.setState('busy', true);
    this.emit('info', { text: 'link lost, reconnecting…' });
    for (const ms of RETRY_MS) {
      await sleep(ms);
      if (this.userClosed) { this.setState('off'); return; }
      try { await this.open(this.device); this.emit('info', { text: 'reconnected' }); return; }
      catch {}
    }
    this.setState('off');
    this.emit('info', { text: 'link lost; will connect when quadpod is back' });
    this.listen();
  }

  onData(value) {
    this.rxText += new TextDecoder().decode(value);
    let i;
    while ((i = this.rxText.indexOf('\n')) >= 0) {
      const line = this.rxText.slice(0, i).trim();
      this.rxText = this.rxText.slice(i + 1);
      if (line) this.emit('line', { text: line });
    }
  }

  // Queue one command line.
  //   key:    continuous controls (drive, pose, stride) name their stream; a newer line replaces an unsent
  //           older one with the same key, so a slow link never plays back a backlog of stale positions.
  //   urgent: STOP and power off go to the front and drop every unsent keyed line, which must not land after them.
  send(cmd, { quiet = false, key = null, urgent = false } = {}) {
    if (!this.rx) { this.emit('error', { text: 'not connected' }); return false; }
    if (!quiet) this.emit('tx', { text: cmd });
    const item = { cmd, key };
    const i = key ? this.pending.findIndex(p => p.key === key) : -1;
    if (urgent) { this.pending = this.pending.filter(p => !p.key); this.pending.unshift(item); }
    else if (i >= 0) this.pending[i] = item;
    else this.pending.push(item);
    this.pump();
    return true;
  }

  // Write queued lines one at a time (writeValueWithoutResponse rejects while a write is in flight).
  async pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.pending.length && this.rx) {
        const bytes = new TextEncoder().encode(this.pending.shift().cmd + '\n');
        for (let i = 0; i < bytes.length; i += CHUNK) await this.rx.writeValueWithoutResponse(bytes.slice(i, i + CHUNK));
      }
    } catch (err) {
      this.emit('error', { text: 'send failed: ' + err.message });
    } finally {
      this.pumping = false;
    }
  }
}
