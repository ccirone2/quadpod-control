// BLE link to the robot: Nordic UART Service over Web Bluetooth.
// Events: 'state' {state, name}  state = 'off' | 'busy' | 'on'
//         'line'  {text}         one reply line from the robot
//         'tx'    {text}         a command we sent
//         'error' {text}

const NUS = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const RX  = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const TX  = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const CHUNK = 20;   // bytes per write, safe for the default MTU

export class Link extends EventTarget {
  constructor() {
    super();
    this.device = null;
    this.rx = null;
    this.state = 'off';
    this.rxText = '';
    this.queue = Promise.resolve();
  }

  get connected() { return this.state === 'on'; }
  get supported() { return !!navigator.bluetooth; }

  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  setState(state) { this.state = state; this.emit('state', { state, name: this.device?.name || 'quadpod' }); }

  async connect() {
    if (!this.supported) { this.emit('error', { text: 'Web Bluetooth is not available in this browser' }); return false; }
    try {
      this.setState('busy');
      this.device = await navigator.bluetooth.requestDevice({ filters: [{ services: [NUS] }] });
      this.device.addEventListener('gattserverdisconnected', () => { this.rx = null; this.setState('off'); });
      const server = await this.device.gatt.connect();
      const svc = await server.getPrimaryService(NUS);
      this.rx = await svc.getCharacteristic(RX);
      const tx = await svc.getCharacteristic(TX);
      await tx.startNotifications();
      tx.addEventListener('characteristicvaluechanged', e => this.onData(e.target.value));
      this.setState('on');
      return true;
    } catch (err) {
      this.rx = null;
      this.setState('off');
      this.emit('error', { text: 'connect failed: ' + err.message });
      return false;
    }
  }

  disconnect() {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    else { this.rx = null; this.setState('off'); }
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

  // Queue one command line. Writes are serialised because writeValueWithoutResponse rejects when busy.
  send(cmd, { quiet = false } = {}) {
    if (!this.rx) { this.emit('error', { text: 'not connected' }); return false; }
    if (!quiet) this.emit('tx', { text: cmd });
    const bytes = new TextEncoder().encode(cmd + '\n');
    this.queue = this.queue.then(async () => {
      for (let i = 0; i < bytes.length; i += CHUNK) await this.rx.writeValueWithoutResponse(bytes.slice(i, i + CHUNK));
    }).catch(err => this.emit('error', { text: 'send failed: ' + err.message }));
    return true;
  }
}
