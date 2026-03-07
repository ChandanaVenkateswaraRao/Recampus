import { useEffect, useState } from 'react';
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
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';

type House = {
  _id: string;
  title?: string;
  location?: string;
  rent?: number;
  ownerName?: string;
  ownerPhone?: string;
  images?: string[];
  isUnlocked?: boolean;
  isLiked?: boolean;
  likesCount?: number;
  unlockFee?: number;
};

export default function HousesScreen() {
  const topInset = (Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0) + 10;
  const [houses, setHouses] = useState<House[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHouses = async () => {
    try {
      const res = await api.get('/houses/browse');
      setHouses(Array.isArray(res.data) ? res.data : []);
    } catch {
      setHouses([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHouses();
  }, []);

  const toggleLike = async (houseId: string) => {
    try {
      const res = await api.post(`/houses/like/${houseId}`);
      setHouses((prev) =>
        prev.map((house) =>
          house._id === houseId
            ? { ...house, isLiked: res.data?.isLiked, likesCount: res.data?.likesCount }
            : house
        )
      );
    } catch {
      Alert.alert('Error', 'Unable to update like right now.');
    }
  };

  const unlockContact = async (house: House) => {
    try {
      const fee = Number(house.unlockFee || 50);
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          'Unlock Contact',
          `Pay Rs.${fee} to unlock owner phone?`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Pay', onPress: () => resolve(true) },
          ]
        );
      });

      if (!proceed) return;
      const res = await api.post(`/houses/pay/${house._id}`, { method: 'simulated' });
      setHouses((prev) =>
        prev.map((entry) =>
          entry._id === house._id
            ? { ...entry, isUnlocked: true, ownerPhone: res.data?.ownerPhone || entry.ownerPhone }
            : entry
        )
      );
      Alert.alert('Unlocked', res.data?.message || 'Contact unlocked.');
    } catch (error: any) {
      Alert.alert('Unlock Failed', error?.response?.data?.message || 'Unable to unlock contact.');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHouses();
  };

  if (loading) {
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
            <Text style={styles.brandTag}>Home Renting</Text>
          </View>
        </View>
        <View style={styles.brandBadge}>
          <Text style={styles.brandBadgeText}>LIVE</Text>
        </View>
      </View>

      <FlatList
        data={houses}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.headerCard}>
            <Text style={styles.title}>Home Renting</Text>
            <Text style={styles.headerSub}>Find verified listings and unlock owner contact instantly.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            {Array.isArray(item.images) && item.images.length > 0 ? (
              <Image source={{ uri: item.images[0] }} style={styles.previewImage} />
            ) : null}

            <View style={styles.cardTopRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title || 'House'}</Text>
              <View style={styles.rentPill}>
                <Text style={styles.rentPillText}>Rs.{Number(item.rent || 0).toFixed(0)}</Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color="#475569" />
              <Text style={styles.meta}>Location: {item.location || '-'}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="heart-outline" size={14} color="#475569" />
              <Text style={styles.meta}>Likes: {Number(item.likesCount || 0)}</Text>
            </View>

            {item.isUnlocked ? (
              <View style={styles.unlockBox}>
                <Text style={styles.owner}>Owner: {item.ownerName || '-'}</Text>
                <Text style={styles.phone}>Phone: {item.ownerPhone || '-'}</Text>
              </View>
            ) : (
              <Pressable style={styles.unlockBtn} onPress={() => unlockContact(item)}>
                <Ionicons name="lock-open-outline" size={14} color="#fff" />
                <Text style={styles.unlockBtnText}>Pay Rs.{Number(item.unlockFee || 50)} to Unlock</Text>
              </Pressable>
            )}

            <Pressable style={[styles.likeBtn, item.isLiked && styles.likeActive]} onPress={() => toggleLike(item._id)}>
              <Ionicons name={item.isLiked ? 'heart' : 'heart-outline'} size={14} color={item.isLiked ? '#9f1239' : '#be123c'} />
              <Text style={[styles.likeText, item.isLiked && styles.likeTextActive]}>
                {item.isLiked ? 'Unlike' : 'Like'} Listing
              </Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No houses available right now.</Text>}
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
  listContent: { paddingBottom: 20 },
  headerCard: {
    marginBottom: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
  headerSub: { color: '#334155', marginTop: 3 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  previewImage: {
    width: '100%',
    height: 168,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#e2e8f0',
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { flex: 1, fontWeight: '800', color: '#0f172a', fontSize: 16 },
  rentPill: { backgroundColor: '#dcfce7', borderColor: '#86efac', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  rentPillText: { color: '#166534', fontWeight: '800', fontSize: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  meta: { color: '#475569', fontSize: 13 },
  unlockBtn: { marginTop: 10, backgroundColor: '#0284c7', borderRadius: 10, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  unlockBtnText: { color: '#fff', fontWeight: '700' },
  unlockBox: { marginTop: 10, borderWidth: 1, borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', borderRadius: 10, padding: 10 },
  owner: { color: '#166534', fontWeight: '700' },
  phone: { color: '#166534', marginTop: 2 },
  likeBtn: { marginTop: 8, borderRadius: 10, borderWidth: 1, borderColor: '#fecdd3', backgroundColor: '#fff1f2', paddingVertical: 9, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  likeActive: { borderColor: '#f43f5e', backgroundColor: '#ffe4e6' },
  likeText: { color: '#be123c', fontWeight: '700' },
  likeTextActive: { color: '#9f1239' },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 30 },
});
