interface ElectronSource {
  id: string;
  name: string;
  thumbnail: string;
}

interface ElectronAPI {
  getSources: () => Promise<ElectronSource[]>;
  requestScreenPermission: () => Promise<boolean>;
  requestCameraPermission: () => Promise<boolean>;
  requestMicPermission: () => Promise<boolean>;
  onNavigate: (callback: (path: string) => void) => () => void;
  storeGet: (key: string) => Promise<string | null>;
  storeSet: (key: string, value: string) => Promise<boolean>;
  isElectron: boolean;
  platform: "darwin" | "win32" | "linux";
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};