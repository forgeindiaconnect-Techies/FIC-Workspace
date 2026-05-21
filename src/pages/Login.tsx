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
import { Mail, Lock, LogIn, Github, Chrome, Settings, Server } from 'lucide-react-native';
import { api, setCustomServerUrl, getCustomServerUrl } from '../lib/api';

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
  const [email, setEmail] = React.useState(isDev ? 'admin@antigraviity.com' : '');
  const [password, setPassword] = React.useState(isDev ? 'password123' : '');
  const [error, setError] = React.useState<string | null>(null);
  const [showSettings, setShowSettings] = React.useState(false);
  const [customUrl, setCustomUrl] = React.useState('');

  React.useEffect(() => {
    setCustomUrl(getCustomServerUrl());
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
      await setCustomServerUrl('');
      setCustomUrl(getCustomServerUrl());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to reset server URL');
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) {
      setError('Please enter your email and password');
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
      setLoading(false);
      navigate('/home');
    } catch (err: any) {
      setLoading(false);
      const message = err.message || 'Invalid credentials';
      const hint =
        message.toLowerCase().includes('invalid') || message.includes('401')
          ? ' Check Server Settings and point the app to your PC IP (e.g. http://192.168.1.72:3001) with the backend running.'
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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to your Nexus workspace</Text>
        </View>

        <View style={styles.form}>
          {error && <Text style={styles.errorText}>{error}</Text>}

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
                placeholder="••••••••"
                placeholderTextColor="#475569"
                style={styles.input}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.formFooter}>
            <TouchableOpacity style={styles.checkboxRow}>
              <View style={styles.checkbox} />
              <Text style={styles.checkboxLabel}>Remember me</Text>
            </TouchableOpacity>
            <TouchableOpacity>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.signInBtn, loading && styles.btnDisabled]} 
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnContent}>
                <LogIn size={18} color="#fff" />
                <Text style={styles.btnText}>Sign In</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

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

        <TouchableOpacity style={styles.signUpRow}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Text style={styles.signUpText}>Start free trial</Text>
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
                  placeholder="http://YOUR_PC_IP:3001"
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

