import React from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, useWindowDimensions } from 'react-native';
import { ChevronLeft, Building, Users, Globe, Shield, CreditCard } from 'lucide-react-native';
import { useNavigate } from '../lib/router';
import { api } from '../lib/api';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const [tenants, setTenants] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadTenants();
  }, []);

  const loadTenants = async () => {
    try {
      setLoading(true);
      const data = await api.superadmin.getTenants();
      setTenants(data);
    } catch (error) {
      console.error('Failed to load tenants', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigate('/home')} style={styles.backBtn}>
            <ChevronLeft size={24} color="#0f172a" />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>Super Admin Dashboard</Text>
            <Text style={styles.subtitle}>Manage Subscription Users</Text>
          </View>
        </View>
        <View style={styles.badge}>
          <Shield size={16} color="#fff" />
          <Text style={styles.badgeText}>Super Admin Access</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : (
          <View style={styles.grid}>
            {tenants.map(tenant => (
              <View key={tenant._id || tenant.workspaceId} style={[styles.card, isMobile && styles.cardMobile]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardAvatar}>
                    <Building size={24} color="#2563eb" />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.orgName} numberOfLines={1}>{tenant.organisationName || tenant.name}</Text>
                    <Text style={styles.domainText}><Globe size={12} color="#64748b" /> {tenant.domain}</Text>
                  </View>
                </View>
                
                <View style={styles.detailsRow}>
                  <Text style={styles.label}>Admin Email:</Text>
                  <Text style={styles.value} numberOfLines={1}>{tenant.adminEmail}</Text>
                </View>
                <View style={styles.detailsRow}>
                  <Text style={styles.label}>Workspace ID:</Text>
                  <Text style={styles.value}>{tenant.workspaceId}</Text>
                </View>
                {tenant.subscriptionExpiryDate && (
                  <View style={styles.detailsRow}>
                    <Text style={styles.label}>Expires On:</Text>
                    <Text style={styles.value}>{new Date(tenant.subscriptionExpiryDate).toLocaleDateString()}</Text>
                  </View>
                )}
                {tenant.subscriptionTier && (
                  <View style={styles.detailsRow}>
                    <Text style={styles.label}>Tier:</Text>
                    <Text style={[styles.value, { textTransform: 'capitalize' }]}>{tenant.subscriptionTier}</Text>
                  </View>
                )}
                {tenant.maxUsers && (
                  <View style={styles.detailsRow}>
                    <Text style={styles.label}>User Limit:</Text>
                    <Text style={styles.value}>{tenant.maxUsers === 99999 ? 'Unlimited' : tenant.maxUsers}</Text>
                  </View>
                )}

                <View style={styles.footer}>
                  <View style={styles.statusBox}>
                    <CreditCard size={14} color="#059669" />
                    <Text style={styles.statusText}>
                      {tenant.paymentStatus === 'active' ? 'Active Subscription' : (tenant.paymentStatus || 'Legacy / Free')}
                    </Text>
                  </View>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateText}>
                      Joined {new Date(tenant.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
            
            {tenants.length === 0 && (
              <View style={styles.centerBox}>
                <Users size={48} color="#94a3b8" />
                <Text style={styles.emptyText}>No subscribed users found.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: '32%',
    minWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardMobile: {
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  cardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  orgName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  domainText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  value: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
  },
  dateBox: {
  },
  dateText: {
    fontSize: 12,
    color: '#94a3b8',
  },
});
