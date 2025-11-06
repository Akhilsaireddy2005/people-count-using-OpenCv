import { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Activity } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (isForgotPassword) {
        await sendPasswordResetEmail(auth, email);
        setSuccessMessage('Password reset email sent! Check your inbox.');
        setEmail('');
        setTimeout(() => {
          setIsForgotPassword(false);
          setSuccessMessage('');
        }, 3000);
      } else if (isSignUp) {
        try {
          await signUp(email, password);
        } catch (err: any) {
          // If it's the verification message, show it as success
          if (err.message && err.message.includes('check your email')) {
            setSuccessMessage(err.message);
            setEmail('');
            setPassword('');
            setTimeout(() => {
              setIsSignUp(false);
              setSuccessMessage('');
            }, 5000);
          } else {
            throw err;
          }
        }
      } else {
        await signIn(email, password);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 p-3 rounded-2xl">
              <Activity className="h-10 w-10 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white">People Counter AI</h2>
          <p className="mt-2 text-slate-400">
            {isForgotPassword ? 'Reset your password' : isSignUp ? 'Create your admin account' : 'Sign in to your account'}
          </p>
        </div>

        <div className="bg-slate-800 py-8 px-6 shadow-xl rounded-2xl border border-slate-700">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="bg-green-500/10 border border-green-500/50 text-green-500 px-4 py-3 rounded-lg text-sm">
                {successMessage}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none block w-full px-4 py-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="admin@example.com"
              />
            </div>

            {!isForgotPassword && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-4 py-3 border border-slate-600 rounded-lg bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? 'Processing...' : isForgotPassword ? 'Send Reset Email' : isSignUp ? 'Sign up' : 'Sign in'}
            </button>

            <div className="text-center space-y-2">
              {!isForgotPassword && !isSignUp && (
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setError('');
                    setSuccessMessage('');
                  }}
                  className="text-sm text-slate-400 hover:text-blue-400 transition block w-full"
                >
                  Forgot password?
                </button>
              )}
              
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setIsForgotPassword(false);
                  setError('');
                  setSuccessMessage('');
                }}
                className="text-sm text-blue-400 hover:text-blue-300 transition block w-full"
              >
                {isForgotPassword ? 'Back to sign in' : isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
