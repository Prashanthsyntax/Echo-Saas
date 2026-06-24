"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
// ─── constants ────────────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV === "development";
const NEXT_URL = "http://localhost:3000";
const ICON_PATH = path_1.default.join(__dirname, "assets", "icon.png");
const TRAY_ICON_PATH = path_1.default.join(__dirname, "assets", "tray-icon.png"); // swap to tray-icon.png when you have one
let mainWindow = null;
let tray = null;
// ─── window creation ─────────────────────────────────────────────────────────
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        icon: ICON_PATH,
        titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
        backgroundColor: "#0a0a0f",
        webPreferences: {
            preload: path_1.default.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
        show: false,
    });
    if (isDev) {
        mainWindow.loadURL(NEXT_URL);
        mainWindow.webContents.openDevTools({ mode: "detach" });
    }
    else {
        mainWindow.loadURL(NEXT_URL);
    }
    mainWindow.once("ready-to-show", () => {
        mainWindow?.show();
    });
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith("http"))
            electron_1.shell.openExternal(url);
        return { action: "deny" };
    });
}
// ─── system tray ─────────────────────────────────────────────────────────────
function createTray() {
    const trayIcon = electron_1.nativeImage
        .createFromPath(TRAY_ICON_PATH)
        .resize({ width: 16, height: 16 });
    tray = new electron_1.Tray(trayIcon);
    const menu = electron_1.Menu.buildFromTemplate([
        {
            label: "Open Echo",
            click: () => {
                mainWindow?.show();
                mainWindow?.focus();
            },
        },
        {
            label: "New Recording",
            click: () => {
                mainWindow?.show();
                mainWindow?.focus();
                mainWindow?.webContents.send("navigate", "/record");
            },
        },
        { type: "separator" },
        {
            label: "Quit Echo",
            click: () => electron_1.app.quit(),
        },
    ]);
    tray.setToolTip("Echo — Async video messaging");
    tray.setContextMenu(menu);
    tray.on("double-click", () => {
        mainWindow?.show();
        mainWindow?.focus();
    });
}
// ─── app lifecycle ────────────────────────────────────────────────────────────
electron_1.app.whenReady().then(() => {
    createWindow();
    createTray();
    electron_1.app.on("activate", () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on("window-all-closed", () => {
    if (process.platform !== "darwin")
        electron_1.app.quit();
});
// ─── IPC handlers ─────────────────────────────────────────────────────────────
electron_1.ipcMain.handle("get-sources", async () => {
    const sources = await electron_1.desktopCapturer.getSources({
        types: ["window", "screen"],
        thumbnailSize: { width: 320, height: 180 },
    });
    return sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
    }));
});
electron_1.ipcMain.handle("request-screen-permission", async () => {
    if (process.platform !== "darwin")
        return true;
    const status = electron_1.systemPreferences.getMediaAccessStatus("screen");
    if (status === "granted")
        return true;
    await electron_1.shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
    return false;
});
electron_1.ipcMain.handle("request-camera-permission", async () => {
    if (process.platform !== "darwin")
        return true;
    const status = electron_1.systemPreferences.getMediaAccessStatus("camera");
    if (status === "granted")
        return true;
    const granted = await electron_1.systemPreferences.askForMediaAccess("camera");
    return granted;
});
electron_1.ipcMain.handle("request-mic-permission", async () => {
    if (process.platform !== "darwin")
        return true;
    const status = electron_1.systemPreferences.getMediaAccessStatus("microphone");
    if (status === "granted")
        return true;
    const granted = await electron_1.systemPreferences.askForMediaAccess("microphone");
    return granted;
});
// ─── device preset storage (in-memory, persists for session) ─────────────────
const Store = new Map();
electron_1.ipcMain.handle("store-get", (_event, key) => {
    return Store.get(key) ?? null;
});
electron_1.ipcMain.handle("store-set", (_event, key, value) => {
    Store.set(key, value);
    return true;
});
