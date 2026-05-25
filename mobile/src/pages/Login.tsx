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
import { Mail, Lock, LogIn, User, UserPlus, Github, Chrome, Settings, Server } from 'lucide-react-native';
import { api, setCustomServerUrl, getCustomServerUrl, useCloudServer, checkBackendHealth, PRODUCTION_API_URL } from '../lib/api';

type AuthMode = 'login' | 'signup';

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = React.useState<AuthMode>('login');
  const [loading, setLoading] = React.useState(false);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const [customUrl, setCustomUrl] = React.useState('');
  const [serverStatus, setServerStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      // Always use cloud server unless explicitly set to local via env var
      // This ensures Expo Go on physical devices connects to production, not LAN
      await useCloudServer();
      setCustomUrl(getCustomServerUrl());
      const health = await checkBackendHealth();
      if (!health.ok) {
        setServerStatus(health.message || 'Server unavailable');
      } else {
        setServerStatus(null);
      }
    })();
  }, []);

  const handleSaveServer = async () => {
    try {
      await setCustomServerUrl(customUrl);
      setError(null);
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
      if (!name.trim()) {
        setError('Please enter your full name');
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
    }

    setLoading(true);
    setError(null);
    try {
      if (mode === 'signup') {
        await api.auth.signup(name.trim(), email.trim(), password);
      } else {
        const result = await api.auth.login(email, password);
        if (result.mfaRequired) {
          setLoading(false);
          setError('MFA is required for this account. Complete MFA verification in the web app first.');
          return;
        }
      }
      setLoading(false);
      navigate('/home');
    } catch (err: any) {
      setLoading(false);
      const message = err.message || (mode === 'signup' ? 'Sign up failed' : 'Invalid credentials');
      const hint = message.includes('503') || message.toLowerCase().includes('database')
        ? ' Fix MONGO_URI on Render  encode @ in password as %40.'
        : message.toLowerCase().includes('invalid') || message.includes('401')
          ? ` Use cloud server: ${PRODUCTION_API_URL}`
          : '';
      setError(message + hint);
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
          <Text style={styles.serverUrlText}>Server: {getCustomServerUrl()}</Text>
          {serverStatus && <Text style={styles.warnText}>{serverStatus}</Text>}
          {error && <Text style={styles.errorText}>{error}</Text>}

          {mode === 'signup' && (
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
                  <UserPlus size={18} color="#fff" />
                ) : (
                  <LogIn size={18} color="#fff" />
                )}
                <Text style={styles.btnText}>{mode === 'signup' ? 'Sign Up' : 'Sign In'}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {mode === 'login' && (
          <>
            <View style={styles.dividerRow}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.line} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialBtn}>
                <Chrome size={18} color="#fff" />
                <Text style={styles.socialBtnText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialBtn}>
                <Github size={18} color="#fff" />
                <Text style={styles.socialBtnText}>GitHub</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <TouchableOpacity style={styles.signUpRow} onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
          <Text style={styles.footerText}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          </Text>
          <Text style={styles.signUpText}>{mode === 'login' ? 'Sign up' : 'Sign in'}</Text>
        </TouchableOpacity>

        {/* Server Settings Expandable Panel */}
        <View style={styles.settingsSection}>
          <TouchableOpacity 
            style={styles.settingsHeader} 
            onPress={() => setShowSettings(!showSettings)}
          >
            <Settings size={16} color="#94a3b8" />
            <Text style={styles.settingsTitle}>Server Settings</Text>
          </TouchableOpacity>

          {showSettings && (
            <View style={styles.settingsContent}>
              <Text style={styles.settingsLabel}>Backend API Endpoint</Text>
              <View style={styles.settingsInputWrapper}>
                <Server size={16} color="#64748b" style={styles.inputIcon} />
                <TextInput 
                  placeholder="https://workspace-backend-r9f8.onrender.com"
                  placeholderTextColor="#475569"
                  style={styles.settingsInput}
                  value={customUrl}
                  onChangeText={setCustomUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View style={styles.settingsActions}>
                <TouchableOpacity style={styles.settingsResetBtn} onPress={handleResetServer}>
                  <Text style={styles.settingsResetText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.settingsSaveBtn} onPress={handleSaveServer}>
                  <Text style={styles.settingsSaveText}>Save Endpoint</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
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
});

