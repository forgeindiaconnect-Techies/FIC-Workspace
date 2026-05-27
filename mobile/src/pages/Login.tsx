import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator 
} from 'react-native';
import { useNavigate } from '../lib/router';
import { Mail, Lock, LogIn, User, UserPlus, Github, Chrome, Settings, Server, CreditCard, Building, Globe } from 'lucide-react-native';
import { api, setCustomServerUrl, getCustomServerUrl, useCloudServer, checkBackendHealth, PRODUCTION_API_URL, getSession, getSocketUrl } from '../lib/api';
import { callManager } from '../lib/callManager';

type AuthMode = 'login' | 'signup';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = React.useState<AuthMode>('login');
  const [loading, setLoading] = React.useState(false);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [organisationName, setOrganisationName] = React.useState('');
  const [subscriptionTier, setSubscriptionTier] = React.useState('starter');
  const [showPayment, setShowPayment] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const [customUrl, setCustomUrl] = React.useState('');
  const [serverStatus, setServerStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      // Always use cloud server unless explicitly set to local via env var
      // This ensures Expo Go on physical devices connects to production, not LAN
      // await useCloudServer();
      setCustomUrl(getCustomServerUrl());
      const health = await checkBackendHealth();
      if (!health.ok) {
        setServerStatus(health.message || 'Server unavailable');
      } else {
        setServerStatus(null);
      }

      // If a session token already exists, keep call signaling in sync.
      const { token } = getSession();
      if (token) {
        callManager.init(getSocketUrl(), token);
      }
    })();
  }, []);

  const handleSaveServer = async () => {
    try {
      await setCustomServerUrl(customUrl);
      setError(null);
      const { token } = getSession();
      if (token) {
        callManager.init(getSocketUrl(), token);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update server URL');
    }
  };

  const handleResetServer = async () => {
    try {
      await useCloudServer();
      setCustomUrl(getCustomServerUrl());
      setError(null);
      const health = await checkBackendHealth();
      setServerStatus(health.ok ? null : (health.message || 'Server unavailable'));
      const { token } = getSession();
      if (token) {
        callManager.init(getSocketUrl(), token);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset server URL');
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
    setConfirmPassword('');
  };

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }

    if (mode === 'signup') {
      if (!name.trim() || !organisationName.trim()) {
        setError('Please enter all required fields');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      setShowPayment(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await api.auth.login(email, password);
      if (result.mfaRequired) {
        setLoading(false);
        setError('MFA is required for this account. Complete MFA verification in the web app first.');
        return;
      }
      const { token } = getSession();
      if (token) {
        callManager.init(getSocketUrl(), token);
      }
      setLoading(false);
      navigate('/home');
    } catch (err: any) {
      setLoading(false);
      const message = err.message || 'Invalid credentials';
      setError(message);
    }
  };

  const handlePaymentComplete = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.auth.signupSubscription(name.trim(), organisationName.trim(), email.trim(), password, subscriptionTier);
      const { token } = getSession();
      if (token) {
        callManager.init(getSocketUrl(), token);
      }
      setLoading(false);
      setShowPayment(false);
      navigate('/home');
    } catch (err: any) {
      setLoading(false);
      setShowPayment(false);
      setError(err.message || 'Subscription failed');
    }
  };

  const handleViewDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.auth.login('demo@fic.com', 'password123');
      const { token } = getSession();
      if (token) {
        callManager.init(getSocketUrl(), token);
      }
      setLoading(false);
      navigate('/home');
    } catch (err: any) {
      setLoading(false);
      setError('Demo login failed. Make sure the backend is seeded.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>N</Text>
          </View>
          <Text style={styles.title}>{mode === 'login' ? 'Welcome back' : 'Create account'}</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'Sign in to your Nexus workspace' : 'Sign up to save your account in the cloud'}
          </Text>
        </View>

        <View style={styles.form}>

          {serverStatus && <Text style={styles.warnText}>{serverStatus}</Text>}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {mode === 'signup' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <View style={styles.inputWrapper}>
                  <User size={18} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Your name"
                    placeholderTextColor="#475569"
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Organisation Name</Text>
                <View style={styles.inputWrapper}>
                  <Building size={18} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Company Inc."
                    placeholderTextColor="#475569"
                    style={styles.input}
                    value={organisationName}
                    onChangeText={setOrganisationName}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            </>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Work Email</Text>
            <View style={styles.inputWrapper}>
              <Mail size={18} color="#64748b" style={styles.inputIcon} />
              <TextInput 
                placeholder="name@company.com"
                placeholderTextColor="#475569"
                style={styles.input}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <Lock size={18} color="#64748b" style={styles.inputIcon} />
              <TextInput 
                placeholder=""
                placeholderTextColor="#475569"
                style={styles.input}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />
            </View>
          </View>

          {mode === 'signup' && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.inputWrapper}>
                <Lock size={18} color="#64748b" style={styles.inputIcon} />
                <TextInput
                  placeholder=""
                  placeholderTextColor="#475569"
                  style={styles.input}
                  secureTextEntry
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                />
              </View>
            </View>
          )}

          {mode === 'login' && (
            <View style={styles.formFooter}>
              <TouchableOpacity style={styles.checkboxRow}>
                <View style={styles.checkbox} />
                <Text style={styles.checkboxLabel}>Remember me</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity 
            style={[styles.signInBtn, loading && styles.btnDisabled]} 
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnContent}>
                {mode === 'signup' ? (
                  <CreditCard size={18} color="#fff" />
                ) : (
                  <LogIn size={18} color="#fff" />
                )}
                <Text style={styles.btnText}>{mode === 'signup' ? 'Continue to Payment' : 'Sign In'}</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.signUpRow}>
            <Text style={styles.footerText}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            </Text>
            <TouchableOpacity onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
              <Text style={styles.signUpText}>
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity onPress={handleViewDemo} style={{alignItems: 'center', marginTop: 10}}>
            <Text style={styles.signUpText}>View Demo</Text>
          </TouchableOpacity>
        </View>

        {showPayment && (
          <View style={styles.paymentModalOverlay}>
            <View style={styles.paymentModal}>
              <CreditCard size={48} color="#2563eb" style={{ marginBottom: 16 }} />
              <Text style={styles.paymentTitle}>Complete Subscription</Text>
              
              <View style={{ width: '100%', marginVertical: 16, gap: 8 }}>
                <TouchableOpacity 
                  style={[styles.tierOption, subscriptionTier === 'starter' && styles.tierActive]} 
                  onPress={() => setSubscriptionTier('starter')}>
                  <Text style={[styles.tierName, subscriptionTier === 'starter' && styles.tierTextActive]}>Starter (1-20 users)</Text>
                  <Text style={[styles.tierPrice, subscriptionTier === 'starter' && styles.tierTextActive]}>Rs.99 / mo</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.tierOption, subscriptionTier === 'pro' && styles.tierActive]} 
                  onPress={() => setSubscriptionTier('pro')}>
                  <Text style={[styles.tierName, subscriptionTier === 'pro' && styles.tierTextActive]}>Pro (21-40 users)</Text>
                  <Text style={[styles.tierPrice, subscriptionTier === 'pro' && styles.tierTextActive]}>Rs.199 / mo</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.tierOption, subscriptionTier === 'enterprise' && styles.tierActive]} 
                  onPress={() => setSubscriptionTier('enterprise')}>
                  <Text style={[styles.tierName, subscriptionTier === 'enterprise' && styles.tierTextActive]}>Enterprise (41+ users)</Text>
                  <Text style={[styles.tierPrice, subscriptionTier === 'enterprise' && styles.tierTextActive]}>Rs.299 / mo</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.payBtn} onPress={handlePaymentComplete} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>Pay Rs.{subscriptionTier === 'starter' ? '99' : subscriptionTier === 'pro' ? '199' : '299'} & Subscribe</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelPayBtn} onPress={() => setShowPayment(false)} disabled={loading}>
                <Text style={styles.cancelPayText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}


      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0f172a',
    borderRadius: 32,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 32,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  logoBox: {
    width: 64,
    height: 64,
    backgroundColor: '#2563eb',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '600',
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#cbd5e1',
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  formFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#334155',
  },
  checkboxLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
  },
  forgotText: {
    fontSize: 13,
    color: '#3b82f6',
    fontWeight: '700',
  },
  signInBtn: {
    backgroundColor: '#2563eb',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dividerText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 52,
    borderRadius: 16,
  },
  socialBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  signUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  signUpText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '700',
  },
  serverUrlText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
  },
  warnText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    padding: 8,
    borderRadius: 8,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 10,
    borderRadius: 8,
  },
  settingsSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: 16,
    marginTop: -8,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  settingsTitle: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '700',
  },
  settingsContent: {
    marginTop: 16,
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  settingsLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    marginLeft: 4,
  },
  settingsInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  settingsInput: {
    flex: 1,
    height: 44,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  tierOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  tierActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  tierName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  tierPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  tierTextActive: {
    color: '#2563eb',
  },
  settingsActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  settingsSaveBtn: {
    flex: 2,
    backgroundColor: '#2563eb',
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsSaveText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  settingsResetBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsResetText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  paymentModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  paymentModal: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  paymentTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
  },
  paymentDesc: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
  },
  payBtn: {
    backgroundColor: '#22c55e',
    width: '100%',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  payBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  cancelPayBtn: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelPayText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '700',
  },
});

