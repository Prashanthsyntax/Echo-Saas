import { contextBridge, ipcRenderer } from "electron";

// expose a safe, typed API to the renderer (your Next.js app)
// this is the ONLY way renderer code can call Electron APIs
contextBridge.exposeInMainWorld("electron", {
  // screen sources for native capture
  getSources: () => ipcRenderer.invoke("get-sources"),

  // permissions
  requestScreenPermission: () =>
    ipcRenderer.invoke("request-screen-permission"),
  requestCameraPermission: () =>
    ipcRenderer.invoke("request-camera-permission"),
  requestMicPermission: () => ipcRenderer.invoke("request-mic-permission"),

  // navigation from tray menu
  onNavigate: (callback: (path: string) => void) => {
    ipcRenderer.on("navigate", (_event, path) => callback(path));
    return () => ipcRenderer.removeAllListeners("navigate");
  },

  // device presets (saved camera/mic combos)
  storeGet: (key: string) => ipcRenderer.invoke("store-get", key),
  storeSet: (key: string, value: string) =>
    ipcRenderer.invoke("store-set", key, value),

  // environment detection
  isElectron: true,
  platform: process.platform,
});