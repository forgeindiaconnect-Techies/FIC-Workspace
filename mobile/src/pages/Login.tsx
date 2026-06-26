import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import tw from 'twrnc';
import { useNavigate } from '../lib/router';
import { Mail, Lock, LogIn, User, Building, CreditCard, X } from 'lucide-react-native';
import { api, setCustomServerUrl, getCustomServerUrl, useCloudServer, checkBackendHealth, getSession, getSocketUrl } from '../lib/api';
import { callManager } from '../lib/callManager';
import { useFonts, AbhayaLibre_600SemiBold } from '@expo-google-fonts/abhaya-libre';
import { registerForPushNotificationsAsync } from '../lib/pushHelper';

type AuthMode = 'login' | 'signup';

export default function Login() {
  const navigate = useNavigate();
  const [fontsLoaded] = useFonts({ AbhayaLibre_600SemiBold });
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
  const [customUrl, setCustomUrl] = React.useState('');
  const [serverStatus, setServerStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      setCustomUrl(getCustomServerUrl());
      const health = await checkBackendHealth();
      if (!health.ok) {
        setServerStatus(health.message || 'Server unavailable');
      } else {
        setServerStatus(null);
      }

      const { token, user } = getSession();
      if (token && user?.email) {
        callManager.init(getSocketUrl(), token, user.email);
        navigate('/home');
      }
    })();
  }, []);

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
      
      setLoading(true);
      setError(null);
      try {
        await api.auth.signupSubscription(name.trim(), organisationName.trim(), email.trim(), password, 'starter');
        const { token, user } = getSession();
        if (token && user?.email) {
          callManager.init(getSocketUrl(), token, user.email);
          registerForPushNotificationsAsync();
        }
        setLoading(false);
        navigate('/home');
      } catch (err: any) {
        setLoading(false);
        setError(err.message || 'Subscription failed');
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await api.auth.login(email, password);
      if (result.mfaRequired) {
        setLoading(false);
        setError('MFA is required. Complete verification in the web app first.');
        return;
      }
      const { token, user } = getSession();
      if (token && user?.email) {
        callManager.init(getSocketUrl(), token, user.email);
        registerForPushNotificationsAsync();
      }
      setLoading(false);
      navigate('/home');
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Invalid credentials');
    }
  };

  const handlePaymentComplete = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.auth.signupSubscription(name.trim(), organisationName.trim(), email.trim(), password, subscriptionTier);
      const { token, user } = getSession();
      if (token && user?.email) {
        callManager.init(getSocketUrl(), token, user.email);
        registerForPushNotificationsAsync();
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
      const { token, user } = getSession();
      if (token && user?.email) {
        callManager.init(getSocketUrl(), token, user.email);
        registerForPushNotificationsAsync();
      }
      setLoading(false);
      navigate('/home');
    } catch (err: any) {
      setLoading(false);
      setError('Demo login failed. Make sure the backend is seeded.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={tw`flex-1 bg-[#FFFFFF]`}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={tw`flex-grow items-center justify-center p-6`}>

        {/* Branding Section */}
        <View style={tw`items-center mb-4 mt-8`}>
          {/* Logo */}
          <View style={tw`w-[200px] h-[200px] rounded-xl items-center justify-center overflow-hidden`}>
            <Image source={require('../../assets/logo.png')} style={tw`w-full h-full`} resizeMode="contain" />
          </View>
        </View>

        {/* Content Form Section */}
        <View style={tw`w-full max-w-[327px] flex flex-col gap-4`}>

          {serverStatus && <Text style={tw`text-[#f59e0b] text-xs font-medium text-center bg-[#f59e0b]/10 p-2 rounded-lg`}>{serverStatus}</Text>}
          {error && <Text style={tw`text-[#ef4444] text-xs font-medium text-center bg-[#ef4444]/10 p-2 rounded-lg`}>{error}</Text>}

          {mode === 'signup' && (
            <>
              {/* Full Name */}
              <View style={tw`flex-row items-center bg-[#FFFFFF] border border-[rgba(0,0,0,0.9)] rounded-[8px] h-[40px] px-4`}>
                <User size={18} color="#828282" style={tw`mr-4`} />
                <TextInput
                  placeholder="Full Name"
                  placeholderTextColor="#828282"
                  style={tw`flex-1 text-[#828282] text-[14px]`}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>

              {/* Organisation Name */}
              <View style={tw`flex-row items-center bg-[#FFFFFF] border border-[rgba(0,0,0,0.9)] rounded-[8px] h-[40px] px-4`}>
                <Building size={18} color="#828282" style={tw`mr-4`} />
                <TextInput
                  placeholder="Organisation"
                  placeholderTextColor="#828282"
                  style={tw`flex-1 text-[#828282] text-[14px]`}
                  value={organisationName}
                  onChangeText={setOrganisationName}
                  autoCapitalize="words"
                />
              </View>
            </>
          )}

          {/* Email */}
          <View style={tw`flex-row items-center bg-[#FFFFFF] border border-[rgba(0,0,0,0.9)] rounded-[8px] h-[40px] px-4`}>
            <Mail size={18} color="#828282" style={tw`mr-4`} />
            <TextInput
              placeholder="username"
              placeholderTextColor="#828282"
              style={tw`flex-1 text-[#828282] text-[14px]`}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
            />
          </View>

          {/* Password */}
          <View style={tw`flex-row items-center bg-[#FFFFFF] border border-[rgba(0,0,0,0.9)] rounded-[8px] h-[40px] px-4`}>
            <Lock size={18} color="#828282" style={tw`mr-4`} />
            <TextInput
              placeholder="password"
              placeholderTextColor="#828282"
              secureTextEntry
              style={tw`flex-1 text-[#828282] text-[14px]`}
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
            />
          </View>
          {mode === 'signup' && (
            <View style={tw`flex-row items-center bg-[#FFFFFF] border border-[rgba(0,0,0,0.9)] rounded-[8px] h-[40px] px-4`}>
              <Lock size={18} color="#828282" style={tw`mr-4`} />
              <TextInput
                placeholder="confirm password"
                placeholderTextColor="#828282"
                style={tw`flex-1 text-[#828282] text-[14px]`}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
              />
            </View>
          )}

          {/* Login/Signup Button */}
          <TouchableOpacity
            style={tw`bg-[#2D6EFF] rounded-[8px] h-[40px] flex items-center justify-center mt-2`}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={tw`text-white font-medium text-[14px]`}>
                {mode === 'signup' ? 'Continue' : 'Login'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={tw`flex-row items-center justify-center my-3`}>
            <View style={tw`flex-1 h-[1px] bg-[#E6E6E6]`} />
            <Text style={tw`px-3 text-[#828282] text-[14px]`}>or</Text>
            <View style={tw`flex-1 h-[1px] bg-[#E6E6E6]`} />
          </View>

          {/* Bottom Links */}
          <View style={tw`items-center gap-4 mb-8`}>
            <TouchableOpacity onPress={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
              <Text style={tw`text-[#000000] text-[15px] font-normal`}>
                {mode === 'login' ? "Don't have an account? Signup" : 'Already have an account? Login'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleViewDemo}>
              <Text style={tw`text-[#2D6EFF] text-[15px] font-normal`}>
                View Demo
              </Text>
            </TouchableOpacity>
          </View>

        </View>

        {/* Payment Modal removed */}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
