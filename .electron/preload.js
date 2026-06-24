"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// expose a safe, typed API to the renderer (your Next.js app)
// this is the ONLY way renderer code can call Electron APIs
electron_1.contextBridge.exposeInMainWorld("electron", {
    // screen sources for native capture
    getSources: () => electron_1.ipcRenderer.invoke("get-sources"),
    // permissions
    requestScreenPermission: () => electron_1.ipcRenderer.invoke("request-screen-permission"),
    requestCameraPermission: () => electron_1.ipcRenderer.invoke("request-camera-permission"),
    requestMicPermission: () => electron_1.ipcRenderer.invoke("request-mic-permission"),
    // navigation from tray menu
    onNavigate: (callback) => {
        electron_1.ipcRenderer.on("navigate", (_event, path) => callback(path));
        return () => electron_1.ipcRenderer.removeAllListeners("navigate");
    },
    // device presets (saved camera/mic combos)
    storeGet: (key) => electron_1.ipcRenderer.invoke("store-get", key),
    storeSet: (key, value) => electron_1.ipcRenderer.invoke("store-set", key, value),
    // environment detection
    isElectron: true,
    platform: process.platform,
});
