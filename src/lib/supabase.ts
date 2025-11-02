import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Create a mock client interface for when Supabase is not configured
const createMockClient = (): SupabaseClient => {
  const createMockQuery = () => {
    const query = Promise.resolve({ data: [], error: null });
    const chainable = {
      eq: () => chainable,
      gte: () => chainable,
      lte: () => chainable,
      lt: () => chainable,
      gt: () => chainable,
      neq: () => chainable,
      like: () => chainable,
      ilike: () => chainable,
      is: () => chainable,
      in: () => chainable,
      contains: () => chainable,
      order: () => chainable,
      limit: () => chainable,
      range: () => chainable,
      single: () => Promise.resolve({ data: null, error: null }),
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (onFulfilled?: (value: { data: never[]; error: null }) => unknown) => 
        query.then(onFulfilled),
      catch: (onRejected?: (reason: unknown) => unknown) => 
        query.catch(onRejected),
    };
    return Object.assign(query, chainable);
  };

  const createMockMutation = () => {
    const mutation = Promise.resolve({ data: null, error: null });
    const chainable = {
      eq: () => chainable,
      select: () => Promise.resolve({ data: null, error: null }),
      then: mutation.then.bind(mutation),
      catch: mutation.catch.bind(mutation),
    };
    return Object.assign(mutation, chainable);
  };

  const mockClient = {
    from: () => ({
      select: () => createMockQuery(),
      insert: () => createMockMutation(),
      update: () => createMockMutation(),
      delete: () => createMockMutation(),
    }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'Supabase not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file' } }),
      signUp: () => Promise.resolve({ data: { user: null, session: null }, error: { message: 'Supabase not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env file' } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    channel: () => ({
      on: () => ({
        subscribe: () => ({ unsubscribe: () => {} }),
      }),
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return mockClient;
};

// Helper to check if an error is due to invalid API key or missing table
const isInvalidKeyError = (error: unknown): boolean => {
  if (error && typeof error === 'object') {
    const err = error as { message?: string; status?: number; code?: string };
    const message = err.message?.toLowerCase() || '';
    return (
      message.includes('invalid api key') ||
      message.includes('invalid key') ||
      message.includes('api key') ||
      message.includes('could not find the table') ||
      message.includes('relation') && message.includes('does not exist') ||
      message.includes('schema cache') ||
      err.code === 'PGRST116' || // PostgREST table not found
      err.status === 401 ||
      err.status === 403 ||
      err.status === 404
    );
  }
  return false;
};

// Create a wrapper that falls back to mock on invalid key errors
const createSupabaseClient = (): SupabaseClient => {
  if (!supabaseUrl || !supabaseAnonKey) {
    return createMockClient();
  }

  try {
    const client = createClient(supabaseUrl, supabaseAnonKey);
    
    // Test the connection with a simple auth call to detect invalid keys
    if (typeof window !== 'undefined') {
      client.auth.getSession().catch((error) => {
        if (isInvalidKeyError(error)) {
          console.warn('Invalid Supabase API key detected. Falling back to demo mode.');
          // Store in localStorage that we should use mock client
          try {
            localStorage.setItem('supabase_invalid_key', 'true');
          } catch {
            // localStorage might not be available
          }
        }
      });
    }
    
    return client;
  } catch (error) {
    console.warn('Error creating Supabase client. Using demo mode.');
    return createMockClient();
  }
};

// Helper to check if we should use mock (safe for SSR)
const shouldUseMock = (): boolean => {
  if (!supabaseUrl || !supabaseAnonKey) return true;
  return false;
};

// Initialize Supabase client or mock if env vars are missing or invalid
export const supabase: SupabaseClient = shouldUseMock()
  ? createMockClient()
  : createSupabaseClient();

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
