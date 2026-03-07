import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

type ProfileHistory = {
  listings?: { _id: string; title?: string; status?: string; price?: number; isPaid?: boolean; buyer?: { email?: string }; createdAt?: string }[];
  purchases?: { _id: string; title?: string; status?: string; price?: number; seller?: { email?: string }; createdAt?: string }[];
  asPassenger?: { _id: string; route?: string; status?: string; price?: number; captain?: { email?: string }; createdAt?: string }[];
  asCaptain?: { _id: string; route?: string; status?: string; price?: number; passenger?: { email?: string }; createdAt?: string }[];
  bookings?: {
    _id: string;
    title?: string;
    description?: string;
    location?: string;
    ownerName?: string;
    ownerPhone?: string;
    rent?: number;
    unlockFee?: number;
    paidAmount?: number;
    paymentMethod?: string;
    paymentStatus?: string;
    paymentRef?: string;
    paidAt?: string;
    isAvailable?: boolean;
    myPaymentsCount?: number;
  }[];
};

type HistoryRowItem = {
  key: string;
  title: string;
  meta: string;
  extra: string;
  billData?: {
    id: string;
    title: string;
    amount: number;
    date: string;
    seller: string;
    buyer: string;
    status: string;
  };
};

export default function ProfileScreen() {
  const { user, logout, refreshProfile } = useAuth();
  const topInset = (Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0) + 10;
  const [phone, setPhone] = useState(user?.phone || '');
  const [busy, setBusy] = useState(false);
  const [activeHistory, setActiveHistory] = useState<'Items' | 'Ride' | 'Home Renting'>('Items');
  const [itemsView, setItemsView] = useState<'my-listings' | 'my-purchases' | 'my-sale'>('my-listings');
  const [rideView, setRideView] = useState<'as-passenger' | 'as-captain'>('as-passenger');
  const [homeRentingView, setHomeRentingView] = useState<'my-bookings'>('my-bookings');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<ProfileHistory>({});

  useEffect(() => {
    setPhone(user?.phone || '');
  }, [user?.phone]);

  const loadHistory = useCallback(async (moduleName: 'Items' | 'Ride' | 'Home Renting') => {
    try {
      setHistoryLoading(true);
      const res = await api.get(`/profile/${moduleName}`);
      setHistory(res.data || {});
    } catch {
      setHistory({});
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(activeHistory);
  }, [activeHistory, loadHistory]);

  useEffect(() => {
    if (activeHistory === 'Items') setItemsView('my-listings');
    if (activeHistory === 'Ride') setRideView('as-passenger');
    if (activeHistory === 'Home Renting') setHomeRentingView('my-bookings');
  }, [activeHistory]);

  const showPurchaseBill = (billData?: HistoryRowItem['billData']) => {
    if (!billData) return;
    Alert.alert(
      `Purchase Bill #${billData.id.slice(-6).toUpperCase()}`,
      [
        `Item: ${billData.title}`,
        `Amount: Rs.${billData.amount.toFixed(2)}`,
        `Seller: ${billData.seller}`,
        `Buyer: ${billData.buyer}`,
        `Status: ${billData.status}`,
        `Date: ${billData.date}`,
      ].join('\n')
    );
  };

  const downloadPurchaseBillPdf = async (billData?: HistoryRowItem['billData']) => {
    if (!billData) return;

    try {
      const invoiceNo = billData.id.slice(-8).toUpperCase();
      const html = `
        <html>
          <head><meta charset="utf-8" /></head>
          <body style="font-family: Arial, sans-serif; color: #0f172a; padding: 20px;">
            <div style="border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden;">
              <div style="background: #0f766e; color: #ffffff; padding: 14px 16px;">
                <div style="font-size: 22px; font-weight: 700;">Recampus Invoice</div>
                <div style="font-size: 12px; opacity: 0.95; margin-top: 2px;">Purchase Bill</div>
              </div>

              <div style="padding: 14px 16px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
                <div style="font-size: 13px; margin-bottom: 4px;"><strong>Invoice No:</strong> INV-${invoiceNo}</div>
                <div style="font-size: 13px; margin-bottom: 4px;"><strong>Bill ID:</strong> ${billData.id}</div>
                <div style="font-size: 13px;"><strong>Date:</strong> ${billData.date}</div>
              </div>

              <div style="padding: 14px 16px;">
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px;">
                  <thead>
                    <tr style="background: #eff6ff;">
                      <th style="text-align: left; border: 1px solid #dbeafe; padding: 8px;">Item</th>
                      <th style="text-align: left; border: 1px solid #dbeafe; padding: 8px;">Status</th>
                      <th style="text-align: right; border: 1px solid #dbeafe; padding: 8px;">Amount (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style="border: 1px solid #e2e8f0; padding: 8px;">${billData.title}</td>
                      <td style="border: 1px solid #e2e8f0; padding: 8px;">${billData.status}</td>
                      <td style="border: 1px solid #e2e8f0; padding: 8px; text-align: right;">${billData.amount.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>

                <div style="font-size: 13px; margin-bottom: 4px;"><strong>Seller:</strong> ${billData.seller}</div>
                <div style="font-size: 13px; margin-bottom: 12px;"><strong>Buyer:</strong> ${billData.buyer}</div>

                <div style="text-align: right; font-size: 16px; font-weight: 700; color: #166534;">
                  Total: Rs.${billData.amount.toFixed(2)}
                </div>
              </div>

              <div style="padding: 10px 16px; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; background: #f8fafc;">
                Generated from Recampus mobile app.
              </div>
            </div>
          </body>
        </html>
      `;

      const file = await Print.printToFileAsync({ html, base64: false });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Bill generated', `PDF saved at: ${file.uri}`);
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share purchase bill PDF',
        UTI: '.pdf',
      });
    } catch (error: any) {
      Alert.alert('Bill download failed', error?.message || 'Unable to generate PDF bill right now.');
    }
  };

  const buildHistoryRows = (): HistoryRowItem[] => {
    if (activeHistory === 'Items') {
      if (itemsView === 'my-listings') {
        return (history.listings || []).map((entry) => ({
          key: `listing-${entry._id}`,
          title: entry.title || 'Listing',
          meta: `Status: ${entry.status || '-'} | Price: Rs.${Number(entry.price || 0).toFixed(2)}`,
          extra: `Buyer: ${entry?.buyer?.email || '-'}`,
        }));
      }

      if (itemsView === 'my-purchases') {
        return (history.purchases || []).map((entry) => ({
          key: `purchase-${entry._id}`,
          title: entry.title || 'Purchase',
          meta: `Status: ${entry.status || '-'} | Price: Rs.${Number(entry.price || 0).toFixed(2)}`,
          extra: `Seller: ${entry?.seller?.email || '-'}`,
          billData: {
            id: entry._id,
            title: entry.title || 'Purchase',
            amount: Number(entry.price || 0),
            date: entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '-',
            seller: entry?.seller?.email || '-',
            buyer: user?.email || '-',
            status: entry.status || '-',
          },
        }));
      }

      return (history.listings || [])
        .filter((entry) => Boolean(entry.buyer?.email) || ['sold', 'pending_handover'].includes(String(entry.status || '')) || Boolean(entry.isPaid))
        .map((entry) => ({
          key: `sale-${entry._id}`,
          title: entry.title || 'Sale',
          meta: `Status: ${entry.status || '-'} | Sold for: Rs.${Number(entry.price || 0).toFixed(2)}`,
          extra: `Buyer: ${entry?.buyer?.email || '-'}`,
        }));
    }

    if (activeHistory === 'Ride') {
      if (rideView === 'as-passenger') {
        return (history.asPassenger || []).map((entry) => ({
          key: `passenger-${entry._id}`,
          title: entry.route || 'Ride',
          meta: `As Passenger | ${entry.status || '-'} | Rs.${Number(entry.price || 0).toFixed(2)}`,
          extra: `Captain: ${entry?.captain?.email || '-'}`,
        }));
      }

      return (history.asCaptain || []).map((entry) => ({
        key: `captain-${entry._id}`,
        title: entry.route || 'Ride',
        meta: `As Captain | ${entry.status || '-'} | Rs.${Number(entry.price || 0).toFixed(2)}`,
        extra: `Passenger: ${entry?.passenger?.email || '-'}`,
      }));
    }

    if (homeRentingView !== 'my-bookings') return [];

    return (history.bookings || []).map((entry) => ({
      key: `booking-${entry._id}`,
      title: entry.title || 'House Booking',
      meta: [
        `${entry.location || '-'}`,
        `Rent: Rs.${Number(entry.rent || 0).toFixed(2)}`,
        `Paid: Rs.${Number(entry.paidAmount || entry.unlockFee || 0).toFixed(2)}`,
        `Status: ${entry.paymentStatus || 'success'}`,
      ].join(' | '),
      extra: [
        `Owner: ${entry.ownerName || '-'} (${entry.ownerPhone || '-'})`,
        `Method: ${(entry.paymentMethod || 'simulated').toUpperCase()}`,
        `Paid At: ${entry.paidAt ? new Date(entry.paidAt).toLocaleString() : '-'}`,
        `Ref: ${entry.paymentRef || '-'}`,
        `Availability: ${entry.isAvailable ? 'Available' : 'Not Available'}`,
      ].join('\n'),
    }));
  };

  const updatePhone = async () => {
    try {
      setBusy(true);
      const res = await api.patch('/auth/update-phone', { phone });
      Alert.alert('Success', res.data?.message || 'Phone updated.');
      await refreshProfile();
    } catch (error: any) {
      Alert.alert('Update Failed', error?.response?.data?.message || 'Unable to update phone.');
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.brandBar}>
        <View style={styles.brandLeft}>
          <Image source={require('@/assets/images/icon.png')} style={styles.brandLogo} />
          <View>
            <Text style={styles.brandName}>RECAMPUS</Text>
            <Text style={styles.brandTag}>My Profile</Text>
          </View>
        </View>
        <View style={styles.brandBadge}>
          <Text style={styles.brandBadgeText}>LIVE</Text>
        </View>
      </View>

      <FlatList
        data={buildHistoryRows()}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={historyLoading} onRefresh={() => loadHistory(activeHistory)} />}
        ListHeaderComponent={
          <>
            <View style={styles.profileCard}>
              <Text style={styles.title}>My Profile</Text>

              <View style={styles.valueRow}>
                <Ionicons name="mail-outline" size={14} color="#475569" />
                <Text style={styles.valueLabel}>Email</Text>
              </View>
              <Text style={styles.value}>{user.email || '-'}</Text>

              <View style={styles.valueRow}>
                <Ionicons name="wallet-outline" size={14} color="#475569" />
                <Text style={styles.valueLabel}>Wallet</Text>
              </View>
              <Text style={styles.value}>Rs.{Number(user.walletBalance || 0).toFixed(2)}</Text>

              <View style={styles.valueRow}>
                <Ionicons name="call-outline" size={14} color="#475569" />
                <Text style={styles.valueLabel}>Phone</Text>
              </View>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Update phone" />

              <Pressable style={[styles.button, busy && styles.disabled]} onPress={updatePhone} disabled={busy}>
                <Text style={styles.buttonText}>{busy ? 'Saving...' : 'Update Phone'}</Text>
              </Pressable>

              <Pressable style={styles.logoutBtn} onPress={logout}>
                <Text style={styles.logoutText}>Logout</Text>
              </Pressable>
            </View>

            <View style={styles.historyCard}>
              <Text style={styles.historyTitle}>My History</Text>
              <View style={styles.segmentRow}>
                {(['Items', 'Ride', 'Home Renting'] as const).map((moduleName) => (
                  <Pressable
                    key={moduleName}
                    style={[styles.segmentBtn, activeHistory === moduleName && styles.segmentBtnActive]}
                    onPress={() => setActiveHistory(moduleName)}
                  >
                    <Text style={[styles.segmentText, activeHistory === moduleName && styles.segmentTextActive]}>{moduleName}</Text>
                  </Pressable>
                ))}
              </View>

              {activeHistory === 'Items' && (
                <View style={styles.segmentRow}>
                  <Pressable style={[styles.segmentBtn, itemsView === 'my-listings' && styles.segmentBtnActive]} onPress={() => setItemsView('my-listings')}>
                    <Text style={[styles.segmentText, itemsView === 'my-listings' && styles.segmentTextActive]}>My Listings</Text>
                  </Pressable>
                  <Pressable style={[styles.segmentBtn, itemsView === 'my-purchases' && styles.segmentBtnActive]} onPress={() => setItemsView('my-purchases')}>
                    <Text style={[styles.segmentText, itemsView === 'my-purchases' && styles.segmentTextActive]}>My Purchases</Text>
                  </Pressable>
                  <Pressable style={[styles.segmentBtn, itemsView === 'my-sale' && styles.segmentBtnActive]} onPress={() => setItemsView('my-sale')}>
                    <Text style={[styles.segmentText, itemsView === 'my-sale' && styles.segmentTextActive]}>My Sale</Text>
                  </Pressable>
                </View>
              )}

              {activeHistory === 'Ride' && (
                <View style={styles.segmentRow}>
                  <Pressable style={[styles.segmentBtn, rideView === 'as-passenger' && styles.segmentBtnActive]} onPress={() => setRideView('as-passenger')}>
                    <Text style={[styles.segmentText, rideView === 'as-passenger' && styles.segmentTextActive]}>As Passenger</Text>
                  </Pressable>
                  <Pressable style={[styles.segmentBtn, rideView === 'as-captain' && styles.segmentBtnActive]} onPress={() => setRideView('as-captain')}>
                    <Text style={[styles.segmentText, rideView === 'as-captain' && styles.segmentTextActive]}>As Captain</Text>
                  </Pressable>
                </View>
              )}

              {activeHistory === 'Home Renting' && (
                <View style={styles.segmentRow}>
                  <Pressable style={[styles.segmentBtn, homeRentingView === 'my-bookings' && styles.segmentBtnActive]} onPress={() => setHomeRentingView('my-bookings')}>
                    <Text style={[styles.segmentText, homeRentingView === 'my-bookings' && styles.segmentTextActive]}>My Bookings</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.historyRow}>
            <Text style={styles.historyRowTitle}>{item.title}</Text>
            <Text style={styles.historyRowMeta}>{item.meta}</Text>
            <Text style={styles.historyRowExtra}>{item.extra}</Text>
            {item.billData ? (
              <View style={styles.billActionsRow}>
                <Pressable style={styles.billBtn} onPress={() => showPurchaseBill(item.billData)}>
                  <Text style={styles.billBtnText}>View Bill</Text>
                </Pressable>
                <Pressable style={[styles.billBtn, styles.billDownloadBtn]} onPress={() => downloadPurchaseBillPdf(item.billData)}>
                  <Text style={styles.billBtnText}>Download PDF</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyHistory}>No history found in this section.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', paddingHorizontal: 14 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  brandBar: {
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#fff',
  },
  brandName: { color: '#e2e8f0', fontWeight: '900', letterSpacing: 0.6, fontSize: 13 },
  brandTag: { color: '#94a3b8', fontSize: 11, marginTop: 1 },
  brandBadge: {
    borderRadius: 999,
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  brandBadgeText: { color: '#166534', fontWeight: '800', fontSize: 11 },
  listContent: { paddingBottom: 22 },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
  profileCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  valueLabel: { color: '#64748b', fontSize: 12, fontWeight: '700' },
  value: { color: '#0f172a', fontWeight: '700', marginTop: 2 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, padding: 10, marginTop: 8, backgroundColor: '#f8fafc' },
  button: { marginTop: 10, backgroundColor: '#1d4ed8', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  logoutBtn: { marginTop: 12, borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fff1f2', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  logoutText: { color: '#be123c', fontWeight: '700' },
  disabled: { opacity: 0.7 },
  historyCard: { backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  historyTitle: { color: '#0f172a', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  segmentBtn: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#fff' },
  segmentBtnActive: { borderColor: '#93c5fd', backgroundColor: '#eff6ff' },
  segmentText: { color: '#334155', fontWeight: '600', fontSize: 12 },
  segmentTextActive: { color: '#1d4ed8' },
  historyRow: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 10, marginBottom: 8, backgroundColor: '#f8fafc' },
  historyRowTitle: { color: '#0f172a', fontWeight: '700' },
  historyRowMeta: { color: '#334155', marginTop: 2, fontSize: 12 },
  historyRowExtra: { color: '#64748b', marginTop: 2, fontSize: 12 },
  billActionsRow: { marginTop: 8, flexDirection: 'row', gap: 8 },
  billBtn: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#dbeafe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  billDownloadBtn: { backgroundColor: '#dcfce7' },
  billBtnText: { color: '#1d4ed8', fontWeight: '700', fontSize: 12 },
  emptyHistory: { color: '#64748b', textAlign: 'center', marginTop: 20 },
});
