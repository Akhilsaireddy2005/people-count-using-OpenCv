import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';

// Type definitions (matching your existing types)
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

// Helper to convert Firebase timestamp to ISO string
const toISOString = (timestamp: any): string => {
  if (timestamp?.toDate) {
    return timestamp.toDate().toISOString();
  }
  return timestamp || new Date().toISOString();
};

// Firebase Service Class
class FirebaseService {
  // Camera operations
  async getCameras(): Promise<Camera[]> {
    try {
      const camerasRef = collection(db, 'cameras');
      const querySnapshot = await getDocs(query(camerasRef, orderBy('created_at', 'desc')));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: toISOString(doc.data().created_at),
        updated_at: toISOString(doc.data().updated_at),
      })) as Camera[];
    } catch (error) {
      console.error('Error getting cameras:', error);
      return [];
    }
  }

  async addCamera(camera: Omit<Camera, 'id' | 'created_at' | 'updated_at'>): Promise<Camera> {
    const camerasRef = collection(db, 'cameras');
    const now = Timestamp.now();
    const docRef = await addDoc(camerasRef, {
      ...camera,
      created_at: now,
      updated_at: now,
    });
    
    return {
      id: docRef.id,
      ...camera,
      created_at: now.toDate().toISOString(),
      updated_at: now.toDate().toISOString(),
    };
  }

  async deleteCamera(id: string): Promise<void> {
    const cameraRef = doc(db, 'cameras', id);
    await deleteDoc(cameraRef);
    
    // Also delete related settings
    const settingsRef = collection(db, 'settings');
    const q = query(settingsRef, where('camera_id', '==', id));
    const querySnapshot = await getDocs(q);
    querySnapshot.docs.forEach(async (document) => {
      await deleteDoc(doc(db, 'settings', document.id));
    });
  }

  // Settings operations
  async getSettings(): Promise<Setting[]> {
    try {
      const settingsRef = collection(db, 'settings');
      const querySnapshot = await getDocs(settingsRef);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        updated_at: toISOString(doc.data().updated_at),
      })) as Setting[];
    } catch (error) {
      console.error('Error getting settings:', error);
      return [];
    }
  }

  async getSettingByCameraId(cameraId: string): Promise<Setting | null> {
    try {
      const settingsRef = collection(db, 'settings');
      const q = query(settingsRef, where('camera_id', '==', cameraId), limit(1));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) return null;
      
      const doc = querySnapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        updated_at: toISOString(doc.data().updated_at),
      } as Setting;
    } catch (error) {
      console.error('Error getting setting:', error);
      return null;
    }
  }

  async addSetting(setting: Omit<Setting, 'id' | 'updated_at'>): Promise<Setting> {
    const settingsRef = collection(db, 'settings');
    const now = Timestamp.now();
    const docRef = await addDoc(settingsRef, {
      ...setting,
      updated_at: now,
    });
    
    return {
      id: docRef.id,
      ...setting,
      updated_at: now.toDate().toISOString(),
    };
  }

  async updateSetting(id: string, updates: Partial<Setting>): Promise<Setting | null> {
    try {
      const settingRef = doc(db, 'settings', id);
      const now = Timestamp.now();
      await updateDoc(settingRef, {
        ...updates,
        updated_at: now,
      });
      
      // Return updated setting (you might want to fetch it)
      return {
        id,
        ...updates,
        updated_at: now.toDate().toISOString(),
      } as Setting;
    } catch (error) {
      console.error('Error updating setting:', error);
      return null;
    }
  }

  // Count logs operations
  async getCountLogs(): Promise<CountLog[]> {
    try {
      const logsRef = collection(db, 'count_logs');
      const q = query(logsRef, orderBy('timestamp', 'desc'), limit(1000));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: toISOString(doc.data().timestamp),
        created_at: toISOString(doc.data().created_at),
      })) as CountLog[];
    } catch (error) {
      console.error('Error getting count logs:', error);
      return [];
    }
  }

  async addCountLog(log: Omit<CountLog, 'id' | 'created_at'>): Promise<CountLog> {
    const logsRef = collection(db, 'count_logs');
    const now = Timestamp.now();
    const docRef = await addDoc(logsRef, {
      ...log,
      timestamp: log.timestamp ? Timestamp.fromDate(new Date(log.timestamp)) : now,
      created_at: now,
    });
    
    return {
      id: docRef.id,
      ...log,
      created_at: now.toDate().toISOString(),
    };
  }

  // Alert operations
  async getAlerts(): Promise<Alert[]> {
    try {
      const alertsRef = collection(db, 'alerts');
      const q = query(alertsRef, orderBy('triggered_at', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        triggered_at: toISOString(doc.data().triggered_at),
        acknowledged_at: doc.data().acknowledged_at ? toISOString(doc.data().acknowledged_at) : null,
      })) as Alert[];
    } catch (error) {
      console.error('Error getting alerts:', error);
      return [];
    }
  }

  async addAlert(alert: Omit<Alert, 'id'>): Promise<Alert> {
    const alertsRef = collection(db, 'alerts');
    const docRef = await addDoc(alertsRef, {
      ...alert,
      triggered_at: alert.triggered_at ? Timestamp.fromDate(new Date(alert.triggered_at)) : Timestamp.now(),
      acknowledged_at: alert.acknowledged_at ? Timestamp.fromDate(new Date(alert.acknowledged_at)) : null,
    });
    
    return {
      id: docRef.id,
      ...alert,
    };
  }

  async updateAlert(id: string, updates: Partial<Alert>): Promise<Alert | null> {
    try {
      const alertRef = doc(db, 'alerts', id);
      const updateData: any = { ...updates };
      
      if (updates.acknowledged_at) {
        updateData.acknowledged_at = Timestamp.fromDate(new Date(updates.acknowledged_at));
      }
      
      await updateDoc(alertRef, updateData);
      
      return {
        id,
        ...updates,
      } as Alert;
    } catch (error) {
      console.error('Error updating alert:', error);
      return null;
    }
  }

  async deleteAlert(id: string): Promise<void> {
    const alertRef = doc(db, 'alerts', id);
    await deleteDoc(alertRef);
  }

  // Real-time listeners
  onCamerasChange(callback: (cameras: Camera[]) => void): () => void {
    const camerasRef = collection(db, 'cameras');
    const q = query(camerasRef, orderBy('created_at', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const cameras = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: toISOString(doc.data().created_at),
        updated_at: toISOString(doc.data().updated_at),
      })) as Camera[];
      callback(cameras);
    });
  }

  onCountLogsChange(callback: (logs: CountLog[]) => void): () => void {
    const logsRef = collection(db, 'count_logs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(1000));
    
    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: toISOString(doc.data().timestamp),
        created_at: toISOString(doc.data().created_at),
      })) as CountLog[];
      callback(logs);
    });
  }

  onAlertsChange(callback: (alerts: Alert[]) => void): () => void {
    const alertsRef = collection(db, 'alerts');
    const q = query(alertsRef, orderBy('triggered_at', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const alerts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        triggered_at: toISOString(doc.data().triggered_at),
        acknowledged_at: doc.data().acknowledged_at ? toISOString(doc.data().acknowledged_at) : null,
      })) as Alert[];
      callback(alerts);
    });
  }
}

export const firebaseService = new FirebaseService();
