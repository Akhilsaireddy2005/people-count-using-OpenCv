import { useState, useEffect, FormEvent } from 'react';
import { Camera, Plus, Trash2, Settings as SettingsIcon } from 'lucide-react';
import { firebaseService, type Camera as CameraType, type Setting } from '../lib/firebaseService';
import { useAuth } from '../hooks/useAuth';

export default function Settings() {
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [newCameraName, setNewCameraName] = useState('');
  const [newCameraLocation, setNewCameraLocation] = useState('');
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const camerasData = await firebaseService.getCameras();
      const settingsData = await firebaseService.getSettings();
      
      setCameras(camerasData);
      setSettings(settingsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const addCamera = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSaveMessage('');

    // Validation
    if (!newCameraName.trim()) {
      setErrorMessage('Camera name is required');
      return;
    }
    if (!newCameraLocation.trim()) {
      setErrorMessage('Location is required');
      return;
    }

    try {
      const newCamera = await firebaseService.addCamera({
        name: newCameraName.trim(),
        location: newCameraLocation.trim(),
        stream_url: null,
        is_active: true,
        created_by: user?.id || null,
      });

      // Create default settings
      await firebaseService.addSetting({
        camera_id: newCamera.id,
        threshold_limit: 50,
        alert_enabled: true,
        alert_email: null,
        alert_sound: true,
        updated_by: user?.id || null,
      });

      setNewCameraName('');
      setNewCameraLocation('');
      setShowAddCamera(false);
      setSaveMessage('Camera added successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred while adding camera');
    }
  };

  const deleteCamera = async (cameraId: string) => {
    try {
      await firebaseService.deleteCamera(cameraId);
      loadData();
    } catch (error) {
      console.error('Error deleting camera:', error);
    }
  };

  const updateSetting = async (cameraId: string, field: string, value: number | boolean | string) => {
    setErrorMessage('');
    try {
      const existingSetting = settings.find((s) => s.camera_id === cameraId);

      if (existingSetting) {
        await firebaseService.updateSetting(existingSetting.id, {
          [field]: value,
          updated_by: user?.id || null,
        });
        loadData();
      } else {
        // Create new setting
        await firebaseService.addSetting({
          camera_id: cameraId,
          threshold_limit: field === 'threshold_limit' ? (value as number) : 50,
          alert_enabled: field === 'alert_enabled' ? (value as boolean) : true,
          alert_email: field === 'alert_email' ? (value as string | null) : null,
          alert_sound: field === 'alert_sound' ? (value as boolean) : true,
          updated_by: user?.id || null,
        });
        loadData();
      }

      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error updating settings:', error);
      setErrorMessage('An error occurred while updating settings');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const getSetting = (cameraId: string) => {
    return settings.find((s) => s.camera_id === cameraId);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">System Settings</h2>
        <p className="text-slate-400">Manage cameras and configure alert thresholds</p>
      </div>

      {saveMessage && (
        <div className="mb-6 bg-green-500/10 border border-green-500/50 text-green-500 px-4 py-3 rounded-lg">
          {saveMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg">
          {errorMessage}
        </div>
      )}

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden mb-6">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Camera className="h-5 w-5 text-slate-400" />
            <h3 className="text-lg font-semibold text-white">Camera Management</h3>
          </div>
          <button
            onClick={() => setShowAddCamera(!showAddCamera)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            <Plus className="h-4 w-4" />
            Add Camera
          </button>
        </div>

        {showAddCamera && (
          <form onSubmit={addCamera} className="p-4 bg-slate-700/50 border-b border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Camera Name</label>
                <input
                  type="text"
                  value={newCameraName}
                  onChange={(e) => setNewCameraName(e.target.value)}
                  placeholder="Main Entrance"
                  required
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Location</label>
                <input
                  type="text"
                  value={newCameraLocation}
                  onChange={(e) => setNewCameraLocation(e.target.value)}
                  placeholder="Building A - Floor 1"
                  required
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                Add Camera
              </button>
              <button
                type="button"
                onClick={() => setShowAddCamera(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-slate-700">
          {cameras.length === 0 ? (
            <div className="p-8 text-center">
              <Camera className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No cameras configured</p>
            </div>
          ) : (
            cameras.map((camera) => {
              const setting = getSetting(camera.id);
              return (
                <div key={camera.id} className="p-4 hover:bg-slate-700/50 transition">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-white font-medium mb-1">{camera.name}</h4>
                      <p className="text-slate-400 text-sm">{camera.location}</p>
                      <span
                        className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${
                          camera.is_active
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {camera.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteCamera(camera.id)}
                      className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Threshold Limit
                      </label>
                      <input
                        type="number"
                        value={setting?.threshold_limit || 50}
                        onChange={(e) =>
                          updateSetting(camera.id, 'threshold_limit', parseInt(e.target.value))
                        }
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Alert Email
                      </label>
                      <input
                        type="email"
                        value={setting?.alert_email || ''}
                        onChange={(e) => updateSetting(camera.id, 'alert_email', e.target.value)}
                        placeholder="admin@example.com"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`alert-enabled-${camera.id}`}
                        checked={setting?.alert_enabled ?? true}
                        onChange={(e) => updateSetting(camera.id, 'alert_enabled', e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
                      />
                      <label htmlFor={`alert-enabled-${camera.id}`} className="text-sm text-slate-300">
                        Enable alerts
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`alert-sound-${camera.id}`}
                        checked={setting?.alert_sound ?? true}
                        onChange={(e) => updateSetting(camera.id, 'alert_sound', e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
                      />
                      <label htmlFor={`alert-sound-${camera.id}`} className="text-sm text-slate-300">
                        Sound alerts
                      </label>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <SettingsIcon className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-blue-400 font-medium mb-1">Configuration Tips</p>
            <ul className="text-blue-300/80 text-sm space-y-1">
              <li>Set threshold limits based on your venue capacity</li>
              <li>Configure alert emails to receive notifications instantly</li>
              <li>Monitor multiple camera feeds from different locations</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
