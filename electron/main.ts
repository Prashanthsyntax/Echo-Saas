import {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  systemPreferences,
  Menu,
  Tray,
  nativeImage,
  shell,
} from "electron";
import path from "path";

// ─── constants ────────────────────────────────────────────────────────────────
const isDev = process.env.NODE_ENV === "development";
const NEXT_URL = "http://localhost:3000";
const ICON_PATH = path.join(__dirname, "assets", "icon.png");
const TRAY_ICON_PATH = path.join(__dirname, "assets", "tray-icon.png"); // swap to tray-icon.png when you have one

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// ─── window creation ─────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: ICON_PATH,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#0a0a0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL(NEXT_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadURL(NEXT_URL);
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });
}

// ─── system tray ─────────────────────────────────────────────────────────────
function createTray() {
  const trayIcon = nativeImage
    .createFromPath(TRAY_ICON_PATH)
    .resize({ width: 16, height: 16 });

  tray = new Tray(trayIcon);

  const menu = Menu.buildFromTemplate([
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
      click: () => app.quit(),
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
app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ─── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle("get-sources", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    thumbnailSize: { width: 320, height: 180 },
  });

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    thumbnail: source.thumbnail.toDataURL(),
  }));
});

ipcMain.handle("request-screen-permission", async () => {
  if (process.platform !== "darwin") return true;

  const status = systemPreferences.getMediaAccessStatus("screen");
  if (status === "granted") return true;

  await shell.openExternal(
    "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
  );
  return false;
});

ipcMain.handle("request-camera-permission", async () => {
  if (process.platform !== "darwin") return true;

  const status = systemPreferences.getMediaAccessStatus("camera");
  if (status === "granted") return true;

  const granted = await systemPreferences.askForMediaAccess("camera");
  return granted;
});

ipcMain.handle("request-mic-permission", async () => {
  if (process.platform !== "darwin") return true;

  const status = systemPreferences.getMediaAccessStatus("microphone");
  if (status === "granted") return true;

  const granted = await systemPreferences.askForMediaAccess("microphone");
  return granted;
});

// ─── device preset storage (in-memory, persists for session) ─────────────────
const Store = new Map<string, string>();

ipcMain.handle("store-get", (_event, key: string) => {
  return Store.get(key) ?? null;
});

ipcMain.handle("store-set", (_event, key: string, value: string) => {
  Store.set(key, value);
  return true;
});