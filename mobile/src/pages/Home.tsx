import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity
} from 'react-native';
import tw from 'twrnc';
import {
  Users,
  ShieldCheck,
  Home as HomeIcon
} from 'lucide-react-native';
import { useNavigate } from '../lib/router';
import { getSession } from '../lib/api';
import { Image, ImageSourcePropType } from 'react-native';

type AppItem = {
  id: string;
  label: string;
  image?: ImageSourcePropType;
  icon?: any;
  color?: string;
};

const apps: AppItem[] = [
  { id: 'mail', image: require('../../assets/Mail.png'), label: 'Mail' },
  { id: 'meetings', image: require('../../assets/Meet.png'), label: 'Meet' },
  { id: 'chat', image: require('../../assets/Chat.png'), label: 'Kural' },
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = getSession();

  const displayedApps = React.useMemo(() => {
    const list: AppItem[] = [...apps];
    if (user?.email === 'admin@fic.com' || user?.role === 'company-admin') {
      list.push({ id: 'team', icon: Users, label: 'Team', color: '#7c3aed' });
    }
    if (user?.role === 'super-admin') {
      list.push({ id: 'superadmin', icon: ShieldCheck, label: 'Subscriptions', color: '#dc2626' });
    }
    return list;
  }, [user]);

  return (
    <ScrollView style={tw`flex-1 bg-[#FFFFFF]`}>
      <View style={tw`px-6 pt-4 pb-12`}>

        {/* Welcome Section */}
        <View style={tw`mt-8`}>
          <Text style={[tw`text-[#000000] text-[36px] -tracking-[0.01em]`, { fontFamily: 'AbhayaLibre_600SemiBold', lineHeight: 54 }]}>
            Welcome Back,
          </Text>
          <Text style={[tw`text-[#000000] text-[36px] -tracking-[0.01em]`, { fontFamily: 'AbhayaLibre_600SemiBold', lineHeight: 54 }]}>
            {user?.name?.split(' ')[0] || 'Dhanush'}
          </Text>
        </View>

        {/* Subtitle */}
        <Text style={[tw`text-[#000000] text-[20px] -tracking-[0.01em] mt-2 mb-8`, { fontFamily: 'AbhayaLibre_600SemiBold', lineHeight: 30 }]}>
          Select an Application to begin
        </Text>

        {/* App Icons Grid */}
        <View style={tw`flex-row flex-wrap justify-between w-full`}>
          {displayedApps.map((app) => (
            <View key={app.id} style={tw`items-center w-[80px] mb-6`}>
              <TouchableOpacity
                onPress={() => navigate(`/${app.id}`)}
                style={[tw`w-[80px] h-[80px] rounded-[18px] items-center justify-center shadow-lg`, { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5, backgroundColor: app.color || '#FFFFFF' }]}
                activeOpacity={0.7}
              >
                {app.image ? (
                  <Image source={app.image} style={tw`w-[80px] h-[80px] rounded-[18px]`} resizeMode="cover" />
                ) : app.icon ? (
                  <app.icon size={32} color="#FFFFFF" />
                ) : null}
              </TouchableOpacity>
              <Text style={tw`mt-3 text-[#1E1E1E] text-[14px] font-semibold tracking-wide text-center`}>
                {app.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Quick Notifications */}
        <Text style={[tw`text-[#000000] text-[36px] -tracking-[0.01em] mt-10 mb-4`, { fontFamily: 'AbhayaLibre_600SemiBold', lineHeight: 54 }]}>
          Quick Notifications
        </Text>

        <View style={[tw`bg-white rounded-2xl p-5 border border-gray-100 flex-row items-center`, { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }]}>
          <View style={tw`w-12 h-12 rounded-full bg-blue-50 items-center justify-center mr-4`}>
            <ShieldCheck size={24} color="#1806DA" />
          </View>
          <View style={tw`flex-1`}>
            <Text style={tw`text-gray-900 font-bold text-[16px] mb-1`}>All caught up!</Text>
            <Text style={tw`text-gray-500 text-[14px] leading-5`}>You have no new notifications right now.</Text>
          </View>
        </View>

      </View>
    </ScrollView>
  );
}
