import { useState, useEffect } from 'react';
import { AlertTriangle, Check, X, Bell } from 'lucide-react';
import { firebaseService, type Alert } from '../lib/firebaseService';
import { useAuth } from '../hooks/useAuth';

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<'all' | 'unacknowledged'>('all');
  const { user } = useAuth();

  useEffect(() => {
    loadAlerts();
    
    // Set up real-time listener
    const unsubscribe = firebaseService.onAlertsChange((updatedAlerts) => {
      const filtered = filter === 'unacknowledged' 
        ? updatedAlerts.filter(alert => !alert.acknowledged)
        : updatedAlerts;
      setAlerts(filtered);
    });

    return () => {
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const loadAlerts = async () => {
    try {
      let allAlerts = await firebaseService.getAlerts();
      
      if (filter === 'unacknowledged') {
        allAlerts = allAlerts.filter(alert => !alert.acknowledged);
      }
      
      setAlerts(allAlerts);
    } catch (error) {
      console.error('Error loading alerts:', error);
      setAlerts([]);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    const updated = await firebaseService.updateAlert(alertId, {
      acknowledged: true,
      acknowledged_by: user?.id || null,
      acknowledged_at: new Date().toISOString(),
    });
    
    if (updated) {
      loadAlerts();
    }
  };

  const deleteAlert = async (alertId: string) => {
    await firebaseService.deleteAlert(alertId);
    loadAlerts();
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Alert History</h2>
        <p className="text-slate-400">Monitor and manage threshold violation alerts</p>
      </div>

      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              All Alerts
            </button>
            <button
              onClick={() => setFilter('unacknowledged')}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                filter === 'unacknowledged'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              Unacknowledged
            </button>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <Bell className="h-5 w-5" />
            <span className="text-sm">{alerts.length} total alerts</span>
          </div>
        </div>

        <div className="divide-y divide-slate-700">
          {alerts.length === 0 ? (
            <div className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No alerts found</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 hover:bg-slate-700/50 transition ${
                  !alert.acknowledged ? 'bg-red-500/5' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div
                      className={`p-2 rounded-lg ${
                        alert.acknowledged ? 'bg-slate-700' : 'bg-red-500/20'
                      }`}
                    >
                      <AlertTriangle
                        className={`h-5 w-5 ${
                          alert.acknowledged ? 'text-slate-400' : 'text-red-500'
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="text-white font-medium mb-1">
                        Threshold Exceeded
                        {!alert.acknowledged && (
                          <span className="ml-2 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                            New
                          </span>
                        )}
                      </h3>
                      <p className="text-slate-400 text-sm mb-2">
                        Count of <span className="text-red-400 font-semibold">{alert.count_value}</span>{' '}
                        exceeded threshold of{' '}
                        <span className="text-orange-400 font-semibold">{alert.threshold_value}</span>
                      </p>
                      <p className="text-slate-500 text-xs">{formatDateTime(alert.triggered_at)}</p>
                      {alert.acknowledged && alert.acknowledged_at && (
                        <p className="text-green-500 text-xs mt-1">
                          Acknowledged {formatDateTime(alert.acknowledged_at)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {!alert.acknowledged && (
                      <button
                        onClick={() => acknowledgeAlert(alert.id)}
                        className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
                        title="Acknowledge"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteAlert(alert.id)}
                      className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white rounded-lg transition"
                      title="Delete"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
