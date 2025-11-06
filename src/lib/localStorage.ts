// Local storage keys
const STORAGE_KEYS = {
  CAMERAS: 'people_counter_cameras',
  SETTINGS: 'people_counter_settings',
  COUNT_LOGS: 'people_counter_count_logs',
  ALERTS: 'people_counter_alerts',
  CURRENT_USER: 'people_counter_current_user',
};

// Type definitions
export type Camera = {
  id: string;
  name: string;
  location: string;
  stream_url: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CountLog = {
  id: string;
  camera_id: string;
  timestamp: string;
  count_in: number;
  count_out: number;
  total_count: number;
  detection_data: Record<string, unknown> | null;
  created_at: string;
};

export type Setting = {
  id: string;
  camera_id: string;
  threshold_limit: number;
  alert_enabled: boolean;
  alert_email: string | null;
  alert_sound: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type Alert = {
  id: string;
  camera_id: string;
  triggered_at: string;
  count_value: number;
  threshold_value: number;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
};

export type User = {
  id: string;
  email: string;
};

// Helper functions to interact with localStorage
class LocalStorageService {
  // Generic get function
  private get<T>(key: string): T[] {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error(`Error reading ${key} from localStorage:`, error);
      return [];
    }
  }

  // Generic set function
  private set<T>(key: string, data: T[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error(`Error writing ${key} to localStorage:`, error);
    }
  }

  // Camera operations
  getCameras(): Camera[] {
    return this.get<Camera>(STORAGE_KEYS.CAMERAS);
  }

  addCamera(camera: Omit<Camera, 'id' | 'created_at' | 'updated_at'>): Camera {
    const cameras = this.getCameras();
    const newCamera: Camera = {
      ...camera,
      id: `camera-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    cameras.push(newCamera);
    this.set(STORAGE_KEYS.CAMERAS, cameras);
    return newCamera;
  }

  deleteCamera(id: string): void {
    const cameras = this.getCameras();
    this.set(STORAGE_KEYS.CAMERAS, cameras.filter(c => c.id !== id));
    
    // Also delete related settings
    const settings = this.getSettings();
    this.set(STORAGE_KEYS.SETTINGS, settings.filter(s => s.camera_id !== id));
  }

  // Settings operations
  getSettings(): Setting[] {
    return this.get<Setting>(STORAGE_KEYS.SETTINGS);
  }

  getSettingByCameraId(cameraId: string): Setting | null {
    const settings = this.getSettings();
    return settings.find(s => s.camera_id === cameraId) || null;
  }

  addSetting(setting: Omit<Setting, 'id' | 'updated_at'>): Setting {
    const settings = this.getSettings();
    const newSetting: Setting = {
      ...setting,
      id: `setting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      updated_at: new Date().toISOString(),
    };
    settings.push(newSetting);
    this.set(STORAGE_KEYS.SETTINGS, settings);
    return newSetting;
  }

  updateSetting(id: string, updates: Partial<Setting>): Setting | null {
    const settings = this.getSettings();
    const index = settings.findIndex(s => s.id === id);
    if (index === -1) return null;
    
    settings[index] = {
      ...settings[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.set(STORAGE_KEYS.SETTINGS, settings);
    return settings[index];
  }

  // Count logs operations
  getCountLogs(): CountLog[] {
    return this.get<CountLog>(STORAGE_KEYS.COUNT_LOGS);
  }

  addCountLog(log: Omit<CountLog, 'id' | 'created_at'>): CountLog {
    const logs = this.getCountLogs();
    const newLog: CountLog = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
    };
    logs.push(newLog);
    // Keep only last 1000 logs to prevent localStorage from getting too large
    const trimmedLogs = logs.slice(-1000);
    this.set(STORAGE_KEYS.COUNT_LOGS, trimmedLogs);
    return newLog;
  }

  // Alert operations
  getAlerts(): Alert[] {
    return this.get<Alert>(STORAGE_KEYS.ALERTS);
  }

  addAlert(alert: Omit<Alert, 'id'>): Alert {
    const alerts = this.getAlerts();
    const newAlert: Alert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    alerts.push(newAlert);
    this.set(STORAGE_KEYS.ALERTS, alerts);
    return newAlert;
  }

  updateAlert(id: string, updates: Partial<Alert>): Alert | null {
    const alerts = this.getAlerts();
    const index = alerts.findIndex(a => a.id === id);
    if (index === -1) return null;
    
    alerts[index] = {
      ...alerts[index],
      ...updates,
    };
    this.set(STORAGE_KEYS.ALERTS, alerts);
    return alerts[index];
  }

  deleteAlert(id: string): void {
    const alerts = this.getAlerts();
    this.set(STORAGE_KEYS.ALERTS, alerts.filter(a => a.id !== id));
  }

  // User operations
  getCurrentUser(): User | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error reading current user from localStorage:', error);
      return null;
    }
  }

  setCurrentUser(user: User | null): void {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    } catch (error) {
      console.error('Error writing current user to localStorage:', error);
    }
  }
}

export const localStorageService = new LocalStorageService();
