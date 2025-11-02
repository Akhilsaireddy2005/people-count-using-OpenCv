import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, Calendar, Download } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CountLog } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const STORAGE_KEY_COUNT_LOGS = 'people_counter_count_logs';

type ChartData = {
  time: string;
  total: number;
  in: number;
  out: number;
};

export default function Analytics() {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [timeRange, setTimeRange] = useState<'hour' | 'day' | 'week'>('hour');
  const [totalToday, setTotalToday] = useState(0);
  const [peakCount, setPeakCount] = useState(0);
  const [avgCount, setAvgCount] = useState(0);
  const { isDemoMode } = useAuth();

  useEffect(() => {
    console.log('📊 Analytics: Component mounted, starting auto-refresh');
    loadAnalytics();
    
    // Set up real-time subscription
    const subscription = supabase
      .channel('count_logs_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'count_logs' }, () => {
        console.log('📊 Analytics: New data received from Supabase, refreshing...');
        loadAnalytics();
      })
      .subscribe();

    // ALWAYS refresh from localStorage every 3 seconds (not just in demo mode)
    const refreshInterval = setInterval(() => {
      console.log('⏰ Analytics: Auto-refresh triggered (3-second interval)');
      loadAnalytics();
    }, 3000); // Refresh every 3 seconds

    return () => {
      console.log('📊 Analytics: Component unmounting, cleaning up');
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const loadAnalytics = async () => {
    console.log('🔍 Analytics: Loading data...');
    try {
      const now = new Date();
      let startTime: Date;

      switch (timeRange) {
        case 'hour':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'day':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
      }

      // ALWAYS check localStorage first (works in demo mode)
      const stored = localStorage.getItem(STORAGE_KEY_COUNT_LOGS);
      console.log('📦 Checking localStorage:', stored ? `Found ${JSON.parse(stored).length} logs` : 'No data');
      
      if (stored) {
        const allLogs: CountLog[] = JSON.parse(stored);
        const filteredLogs = allLogs.filter((log) => new Date(log.timestamp) >= startTime);
        console.log(`✅ Using ${filteredLogs.length} logs from localStorage for time range: ${timeRange}`);
        if (filteredLogs.length > 0) {
          processData(filteredLogs);
          return;
        }
      }

      // Check for table errors
      const isTableError = (err: unknown): boolean => {
        if (err && typeof err === 'object') {
          const error = err as { message?: string; code?: string };
          const message = error.message?.toLowerCase() || '';
          return (
            message.includes('could not find the table') ||
            message.includes('schema cache') ||
            message.includes('relation') && message.includes('does not exist') ||
            error.code === 'PGRST116'
          );
        }
        return false;
      };

      // Try Supabase if not in demo mode
      console.log('🌐 Trying Supabase database...');
      const { data, error } = await supabase
        .from('count_logs')
        .select('*')
        .gte('timestamp', startTime.toISOString())
        .order('timestamp', { ascending: true });

      if (error && isTableError(error)) {
        console.log('⚠️ Table not found, already checked localStorage');
        processData([]);
        return;
      }

      if (data && data.length > 0) {
        console.log(`✅ Loaded ${data.length} logs from Supabase`);
        processData(data);
      } else {
        console.log('📭 No data in time range');
        processData([]);
      }
    } catch (error) {
      console.error('❌ Analytics error:', error);
      processData([]);
    }
  };

  const processData = (logs: CountLog[]) => {
    console.log(`📊 Processing ${logs.length} log entries for analytics`);
    
    if (logs.length === 0) {
      setChartData([]);
      setTotalToday(0);
      setPeakCount(0);
      setAvgCount(0);
      return;
    }

    const groupedData: { [key: string]: { total: number; in: number; out: number; count: number } } = {};

    logs.forEach((log) => {
      const date = new Date(log.timestamp);
      let timeKey: string;

      if (timeRange === 'hour') {
        timeKey = `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
      } else if (timeRange === 'day') {
        timeKey = `${date.getHours()}:00`;
      } else {
        timeKey = date.toLocaleDateString('en-US', { weekday: 'short' });
      }

      if (!groupedData[timeKey]) {
        groupedData[timeKey] = { total: 0, in: 0, out: 0, count: 0 };
      }

      groupedData[timeKey].total += log.total_count;
      groupedData[timeKey].in += log.count_in;
      groupedData[timeKey].out += log.count_out;
      groupedData[timeKey].count += 1;
    });

    const chartData = Object.entries(groupedData).map(([time, data]) => ({
      time,
      total: Math.round(data.total / data.count),
      in: Math.round(data.in / data.count),
      out: Math.round(data.out / data.count),
    }));

    console.log(`📈 Chart updated with ${chartData.length} data points`);
    setChartData(chartData);

    const totals = chartData.map((d) => d.total);
    const latestTotal = logs[logs.length - 1]?.total_count || 0;
    setTotalToday(latestTotal);
    setPeakCount(Math.max(...totals, 0));
    setAvgCount(Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) || 0);
    
    console.log(`📊 Stats: Current=${latestTotal}, Peak=${Math.max(...totals, 0)}, Avg=${Math.round(totals.reduce((a, b) => a + b, 0) / totals.length) || 0}`);
  };

  const exportData = () => {
    const csv = [
      ['Time', 'Total', 'In', 'Out'],
      ...chartData.map((d) => [d.time, d.total, d.in, d.out]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `people-count-${timeRange}-${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Analytics Dashboard</h2>
          <p className="text-slate-400">Track people counting trends and patterns</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              console.log('🔄 Manual refresh triggered');
              loadAnalytics();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
          >
            🔄 Refresh
          </button>
          <button
            onClick={exportData}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400">Current Total</span>
            <Users className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-white">{totalToday}</p>
          <p className="text-sm text-slate-500 mt-2">People currently in area</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400">Peak Count</span>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-white">{peakCount}</p>
          <p className="text-sm text-slate-500 mt-2">Maximum in time range</p>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400">Average Count</span>
            <Calendar className="h-5 w-5 text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-white">{avgCount}</p>
          <p className="text-sm text-slate-500 mt-2">Average in time range</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">People Count Over Time</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setTimeRange('hour')}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                timeRange === 'hour'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              Last Hour
            </button>
            <button
              onClick={() => setTimeRange('day')}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                timeRange === 'day'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              Last 24h
            </button>
            <button
              onClick={() => setTimeRange('week')}
              className={`px-4 py-2 rounded-lg text-sm transition ${
                timeRange === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              Last Week
            </button>
          </div>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} name="Total" />
              <Line type="monotone" dataKey="in" stroke="#10b981" strokeWidth={2} name="In" />
              <Line type="monotone" dataKey="out" stroke="#ef4444" strokeWidth={2} name="Out" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-slate-500">
            No data available for selected time range
          </div>
        )}
      </div>

      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-6">Entry vs Exit Comparison</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                }}
              />
              <Legend />
              <Bar dataKey="in" fill="#10b981" name="People In" />
              <Bar dataKey="out" fill="#ef4444" name="People Out" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-slate-500">
            No data available for selected time range
          </div>
        )}
      </div>
    </div>
  );
}
