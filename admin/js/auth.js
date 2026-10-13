/**
 * Notes about browsers that have opened the office on this computer.
 * The server decides who is signed in. Nothing in this file is a password.
 */
(function (global) {
  const DEVICE_KEY = 'bld-allowed-devices-v1';
  const DEVICE_ID_KEY = 'bld-this-device-id-v1';

  function randomId() {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    let raw = '';
    bytes.forEach((b) => { raw += String.fromCharCode(b); });
    return btoa(raw).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  }

  function getOrCreateDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = 'dev_' + randomId();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  }

  function loadDevices() {
    try {
      const raw = localStorage.getItem(DEVICE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  function saveDevices(list) {
    localStorage.setItem(DEVICE_KEY, JSON.stringify(list));
  }

  function registerThisDevice(label) {
    const id = getOrCreateDeviceId();
    const list = loadDevices().filter((d) => d.id !== id);
    const ua = navigator.userAgent || '';
    let guessed = 'Browser';
    if (/iPhone|iPad/i.test(ua)) guessed = 'iPhone / iPad';
    else if (/Android/i.test(ua)) guessed = 'Android phone';
    else if (/Windows/i.test(ua)) guessed = 'Windows computer';
    else if (/Mac/i.test(ua)) guessed = 'Mac';
    list.unshift({
      id,
      label: label || guessed,
      allowed: true,
      lastSeen: new Date().toISOString(),
      createdAt: new Date().toISOString()
    });
    saveDevices(list.slice(0, 12));
    return id;
  }

  function touchThisDevice() {
    const id = getOrCreateDeviceId();
    const list = loadDevices();
    const row = list.find((item) => item.id === id);
    if (row) {
      row.lastSeen = new Date().toISOString();
      saveDevices(list);
    }
  }

  function revokeDevice(id) {
    saveDevices(loadDevices().filter((item) => item.id !== id));
  }

  global.BLDAuth = {
    getOrCreateDeviceId,
    loadDevices,
    registerThisDevice,
    touchThisDevice,
    revokeDevice
  };
})(window);
