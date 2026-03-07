import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type ItemQuestion = {
  _id?: string;
  userId?: string;
  username?: string;
  question?: string;
  answer?: string;
};

type Item = {
  _id: string;
  title?: string;
  category?: string;
  description?: string;
  condition?: string;
  price?: number;
  sellerPhone?: string;
  images?: string[];
  views?: number;
  seller?: { _id?: string; email?: string };
  questions?: ItemQuestion[];
};

type SellForm = {
  title: string;
  category: string;
  condition: string;
  description: string;
  price: string;
  sellerPhone: string;
  images: string[];
};

const categories = ['Books', 'Electronics', 'Lab Gear', 'Furniture', 'Clothing', 'Other'];
const conditions = ['New', 'Good', 'Fair', 'Used'];
const sortOptions = ['newest', 'price-low', 'price-high'] as const;
type SortOption = (typeof sortOptions)[number];

const imageFromItem = (item?: Item | null) => {
  const candidate = String(item?.images?.[0] || '').trim();
  if (!candidate) return '';
  return candidate;
};

export default function ItemsScreen() {
  const { user } = useAuth();
  const topInset = (Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0) + 10;

  const [view, setView] = useState<'browse' | 'sell'>('browse');
  const [isCategoryView, setIsCategoryView] = useState(false);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buyingItemId, setBuyingItemId] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<SellForm>({
    title: '',
    category: 'Books',
    condition: 'Good',
    description: '',
    price: '',
    sellerPhone: '',
    images: [],
  });

  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [activeImage, setActiveImage] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});

  const [paymentItem, setPaymentItem] = useState<Item | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const res = await api.get('/items/browse');
      const list = Array.isArray(res.data) ? res.data : [];
      setItems(list);

      if (selectedItem?._id) {
        const latest = list.find((entry: Item) => entry._id === selectedItem._id);
        if (latest) {
          setSelectedItem(latest);
          setActiveImage(imageFromItem(latest));
        }
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedItem?._id]);

  useEffect(() => {
    if (view === 'browse') loadItems();
  }, [view, loadItems]);

  const refresh = async () => {
    setRefreshing(true);
    await loadItems();
  };

  const filteredItems = useMemo(() => {
    let list = [...items];

    if (filterCategory !== 'All') list = list.filter((item) => item.category === filterCategory);

    if (searchTerm.trim()) {
      const needle = searchTerm.trim().toLowerCase();
      list = list.filter((item) => {
        const haystack = [item.title, item.category, item.condition, item.description, item?.seller?.email]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(needle);
      });
    }

    if (sortBy === 'price-low') list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (sortBy === 'price-high') list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    if (sortBy === 'newest') list = list.reverse();

    return list;
  }, [items, filterCategory, searchTerm, sortBy]);

  const shownItems = filteredItems.slice(0, visibleCount);

  const openItemDetail = async (item: Item) => {
    setSelectedItem(item);
    setActiveImage(imageFromItem(item));
    setQuestionText('');

    try {
      await api.patch(`/items/view/${item._id}`);
    } catch {
      // Silent, same as web behavior.
    }

    await loadItems();
  };

  const startPaymentSimulation = (item: Item) => {
    setPaymentItem(item);
  };

  const confirmPaymentSimulation = async () => {
    if (!paymentItem?._id) return;
    try {
      setPaymentBusy(true);
      setBuyingItemId(paymentItem._id);
      const res = await api.post(`/items/buy/${paymentItem._id}`);
      Alert.alert('Payment Successful', `Verification code: ${res.data?.code || '-'}`);
      setPaymentItem(null);
      await loadItems();
    } catch (error: any) {
      Alert.alert('Payment Failed', error?.response?.data?.message || 'Unable to complete payment.');
    } finally {
      setPaymentBusy(false);
      setBuyingItemId('');
    }
  };

  const addImageFromLibrary = async () => {
    if (form.images.length >= 3) {
      Alert.alert('Limit reached', 'Maximum 3 images allowed.');
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow gallery permission.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;
    const asset = result.assets[0];
    const mime = asset.mimeType || 'image/jpeg';
    const dataUrl = `data:${mime};base64,${asset.base64}`;

    setForm((prev) => ({ ...prev, images: [...prev.images, dataUrl].slice(0, 3) }));
  };

  const addImageFromCamera = async () => {
    if (form.images.length >= 3) {
      Alert.alert('Limit reached', 'Maximum 3 images allowed.');
      return;
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera permission.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]?.base64) return;
    const asset = result.assets[0];
    const mime = asset.mimeType || 'image/jpeg';
    const dataUrl = `data:${mime};base64,${asset.base64}`;

    setForm((prev) => ({ ...prev, images: [...prev.images, dataUrl].slice(0, 3) }));
  };

  const removeImage = (index: number) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));
  };

  const submitSellForm = async () => {
    if (!form.title.trim() || !form.description.trim() || !form.price.trim() || !form.sellerPhone.trim()) {
      Alert.alert('Missing fields', 'Please fill title, description, price and contact number.');
      return;
    }

    const priceNum = Number(form.price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      Alert.alert('Invalid price', 'Please enter a valid price.');
      return;
    }

    if (form.images.length === 0) {
      Alert.alert('Image needed', 'Please add at least one image from gallery/camera.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/items/list', {
        title: form.title.trim(),
        category: form.category,
        condition: form.condition,
        description: form.description.trim(),
        price: priceNum,
        sellerPhone: form.sellerPhone.trim(),
        images: form.images,
      });

      Alert.alert('Submitted', 'Your item has been sent for admin approval.');
      setForm({
        title: '',
        category: 'Books',
        condition: 'Good',
        description: '',
        price: '',
        sellerPhone: '',
        images: [],
      });
      setView('browse');
      await loadItems();
    } catch (error: any) {
      Alert.alert('Submit failed', error?.response?.data?.message || 'Unable to list item right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitQuestion = async () => {
    if (!selectedItem?._id || !questionText.trim()) return;
    try {
      await api.post(`/items/question/${selectedItem._id}`, { question: questionText.trim() });
      setQuestionText('');
      await loadItems();
    } catch (error: any) {
      Alert.alert('Question failed', error?.response?.data?.message || 'Unable to post question.');
    }
  };

  const submitAnswer = async (questionId: string) => {
    if (!selectedItem?._id || !questionId) return;
    const answer = String(answerDrafts[questionId] || '').trim();
    if (!answer) return;

    try {
      await api.post(`/items/answer/${selectedItem._id}/${questionId}`, { answer });
      setAnswerDrafts((prev) => ({ ...prev, [questionId]: '' }));
      await loadItems();
    } catch (error: any) {
      Alert.alert('Answer failed', error?.response?.data?.message || 'Unable to post answer.');
    }
  };

  const isSellerOfSelected =
    Boolean(selectedItem?.seller?._id) &&
    String(selectedItem?.seller?._id) === String(user?._id || user?.id || '');

  if (loading && view === 'browse') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (isCategoryView && view === 'browse') {
    return (
      <SafeAreaView style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.brandBar}>
          <View style={styles.brandLeft}>
            <Image source={require('@/assets/images/icon.png')} style={styles.brandLogo} />
            <View>
              <Text style={styles.brandName}>RECAMPUS</Text>
              <Text style={styles.brandTag}>Student Marketplace</Text>
            </View>
          </View>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>LIVE</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.categoryScreenContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Browse Categories</Text>
            <Text style={styles.headerSub}>Select a category to filter resources</Text>
          </View>

          <View style={styles.categoryGrid}>
            {categories.map((cat) => (
              <Pressable
                key={cat}
                style={styles.categoryCard}
                onPress={() => {
                  setFilterCategory(cat);
                  setIsCategoryView(false);
                }}
              >
                <Text style={styles.categoryCardText}>{cat}</Text>
              </Pressable>
            ))}

            <Pressable
              style={[styles.categoryCard, styles.categoryCardAll]}
              onPress={() => {
                setFilterCategory('All');
                setIsCategoryView(false);
              }}
            >
              <Text style={styles.categoryCardText}>View All</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.brandBar}>
        <View style={styles.brandLeft}>
          <Image source={require('@/assets/images/icon.png')} style={styles.brandLogo} />
          <View>
            <Text style={styles.brandName}>RECAMPUS</Text>
            <Text style={styles.brandTag}>Student Marketplace</Text>
          </View>
        </View>
        <View style={styles.brandBadge}>
          <Text style={styles.brandBadgeText}>LIVE</Text>
        </View>
      </View>

      {view === 'browse' ? (
        <FlatList
          data={shownItems}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListHeaderComponent={
            <>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Buy and Sell with Confidence</Text>
                <Text style={styles.headerSub}>Verified campus listings with quick in-app checkout</Text>
              </View>

              <View style={styles.toggleRow}>
                <Pressable style={[styles.toggleBtn, styles.toggleBtnActive]} onPress={() => setView('browse')}>
                  <Text style={[styles.toggleText, styles.toggleTextActive]}>Browse</Text>
                </Pressable>
                <Pressable style={styles.toggleBtn} onPress={() => setView('sell')}>
                  <Text style={styles.toggleText}>Sell Item</Text>
                </Pressable>
              </View>

              <View style={styles.controlsCard}>
                <View style={styles.searchWrap}>
                  <Ionicons name="search-outline" size={16} color="#475569" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder={`Search in ${filterCategory === 'All' ? 'all items' : filterCategory}...`}
                    value={searchTerm}
                    onChangeText={(val) => {
                      setSearchTerm(val);
                      setVisibleCount(12);
                    }}
                  />
                </View>

                <View style={styles.filterRow}>
                  <Pressable style={styles.filterBtn} onPress={() => setIsCategoryView(true)}>
                    <Ionicons name="apps-outline" size={14} color="#334155" />
                    <Text style={styles.filterBtnText}>Category: {filterCategory}</Text>
                  </Pressable>

                  <Pressable
                    style={styles.filterBtn}
                    onPress={() => {
                      const current = sortOptions.indexOf(sortBy);
                      const next = sortOptions[(current + 1) % sortOptions.length];
                      setSortBy(next);
                    }}
                  >
                    <Ionicons name="funnel-outline" size={14} color="#334155" />
                    <Text style={styles.filterBtnText}>Sort: {sortBy}</Text>
                  </Pressable>
                </View>

                {filterCategory !== 'All' && (
                  <Pressable style={styles.resetChip} onPress={() => setFilterCategory('All')}>
                    <Text style={styles.resetChipText}>Clear category filter</Text>
                  </Pressable>
                )}
              </View>
            </>
          }
          renderItem={({ item }) => {
            const firstImage = imageFromItem(item);
            return (
              <Pressable style={styles.card} onPress={() => openItemDetail(item)}>
                {firstImage ? <Image source={{ uri: firstImage }} style={styles.cardImage} /> : null}

                <View style={styles.cardTopRow}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title || 'Untitled Item'}</Text>
                  <View style={styles.pricePill}>
                    <Text style={styles.pricePillText}>Rs.{Number(item.price || 0).toFixed(0)}</Text>
                  </View>
                </View>

                <View style={styles.badgeRow}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.category || 'Other'}</Text>
                  </View>
                  <View style={[styles.badge, styles.badgeMuted]}>
                    <Text style={[styles.badgeText, styles.badgeTextMuted]}>{item.condition || '-'}</Text>
                  </View>
                </View>

                <Text style={styles.meta}>Seller: {item?.seller?.email || '-'}</Text>
                <Text style={styles.meta}>Contact: {item?.sellerPhone || '-'}</Text>
                <Text style={styles.viewsText}>Views: {Number(item.views || 0)}</Text>

                <View style={styles.cardDivider} />

                <Pressable
                  style={[styles.buyBtn, buyingItemId === item._id && styles.disabled]}
                  onPress={() => startPaymentSimulation(item)}
                  disabled={buyingItemId === item._id}
                >
                  <Ionicons name="cart-outline" size={15} color="#fff" />
                  <Text style={styles.buyBtnText}>Buy Now</Text>
                </Pressable>
              </Pressable>
            );
          }}
          ListFooterComponent={
            shownItems.length < filteredItems.length ? (
              <Pressable style={styles.loadMoreBtn} onPress={() => setVisibleCount((prev) => prev + 12)}>
                <Text style={styles.loadMoreText}>Load More</Text>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={<Text style={styles.empty}>No items found. Try clearing filters.</Text>}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.sellWrap}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Buy and Sell with Confidence</Text>
            <Text style={styles.headerSub}>Verified campus listings with quick in-app checkout</Text>
          </View>

          <View style={styles.toggleRow}>
            <Pressable style={styles.toggleBtn} onPress={() => setView('browse')}>
              <Text style={styles.toggleText}>Browse</Text>
            </Pressable>
            <Pressable style={[styles.toggleBtn, styles.toggleBtnActive]} onPress={() => setView('sell')}>
              <Text style={[styles.toggleText, styles.toggleTextActive]}>Sell Item</Text>
            </Pressable>
          </View>

          <Text style={styles.sellTitle}>List a New Resource</Text>
          <Text style={styles.sellSub}>Your listing will be published once approved by admin.</Text>

          <TextInput
            style={styles.input}
            placeholder="Product title"
            value={form.title}
            onChangeText={(value) => setForm((prev) => ({ ...prev, title: value }))}
          />

          <Text style={styles.inputLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {categories.map((cat) => (
                <Pressable
                  key={cat}
                  style={[styles.chip, form.category === cat && styles.chipActive]}
                  onPress={() => setForm((prev) => ({ ...prev, category: cat }))}
                >
                  <Text style={[styles.chipText, form.category === cat && styles.chipTextActive]}>{cat}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <Text style={styles.inputLabel}>Condition</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {conditions.map((cond) => (
                <Pressable
                  key={cond}
                  style={[styles.chip, form.condition === cond && styles.chipActive]}
                  onPress={() => setForm((prev) => ({ ...prev, condition: cond }))}
                >
                  <Text style={[styles.chipText, form.condition === cond && styles.chipTextActive]}>{cond}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description"
            multiline
            numberOfLines={4}
            value={form.description}
            onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))}
          />

          <TextInput
            style={styles.input}
            placeholder="Expected price (Rs.)"
            keyboardType="numeric"
            value={form.price}
            onChangeText={(value) => setForm((prev) => ({ ...prev, price: value }))}
          />

          <TextInput
            style={styles.input}
            placeholder="Contact number"
            keyboardType="phone-pad"
            value={form.sellerPhone}
            onChangeText={(value) => setForm((prev) => ({ ...prev, sellerPhone: value }))}
          />

          <Text style={styles.inputLabel}>Upload Images (max 3)</Text>
          <View style={styles.imagePickerRow}>
            <Pressable style={styles.imagePickBtn} onPress={addImageFromLibrary}>
              <Text style={styles.imagePickBtnText}>From Gallery</Text>
            </Pressable>
            <Pressable style={styles.imagePickBtn} onPress={addImageFromCamera}>
              <Text style={styles.imagePickBtnText}>Take Photo</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewStrip}>
            <View style={styles.previewRow}>
              {form.images.map((img, idx) => (
                <View key={`${idx}-${img.slice(0, 20)}`} style={styles.previewThumbWrap}>
                  <Image source={{ uri: img }} style={styles.previewThumb} />
                  <Pressable style={styles.removeThumbBtn} onPress={() => removeImage(idx)}>
                    <Text style={styles.removeThumbBtnText}>X</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>

          <Pressable style={[styles.submitBtn, submitting && styles.disabled]} onPress={submitSellForm} disabled={submitting}>
            <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : 'Submit for Approval'}</Text>
          </Pressable>
        </ScrollView>
      )}

      <Modal visible={Boolean(selectedItem)} animationType="slide" onRequestClose={() => setSelectedItem(null)}>
        <SafeAreaView style={styles.modalContainer}>
          {selectedItem && (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Item Details</Text>
                <Pressable onPress={() => setSelectedItem(null)}>
                  <Text style={styles.modalClose}>Close</Text>
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.modalScroll}>
                {activeImage ? <Image source={{ uri: activeImage }} style={styles.detailMainImage} /> : null}

                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.detailThumbRow}>
                    {(selectedItem.images || []).map((img, idx) => (
                      <Pressable key={`${idx}-${img.slice(0, 18)}`} onPress={() => setActiveImage(img)}>
                        <Image source={{ uri: img }} style={[styles.detailThumb, activeImage === img && styles.detailThumbActive]} />
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                <Text style={styles.detailTitle}>{selectedItem.title || '-'}</Text>
                <Text style={styles.detailPrice}>Rs.{Number(selectedItem.price || 0).toFixed(2)}</Text>
                <Text style={styles.detailMeta}>Category: {selectedItem.category || '-'}</Text>
                <Text style={styles.detailMeta}>Condition: {selectedItem.condition || '-'}</Text>
                <Text style={styles.detailMeta}>Views: {Number(selectedItem.views || 0)}</Text>
                <Text style={styles.detailMeta}>Seller: {selectedItem?.seller?.email || '-'}</Text>
                <Text style={styles.detailMeta}>Phone: {selectedItem?.sellerPhone || '-'}</Text>
                <Text style={styles.detailDesc}>{selectedItem.description || '-'}</Text>

                <Pressable style={styles.buyBtnLarge} onPress={() => startPaymentSimulation(selectedItem)}>
                  <Text style={styles.buyBtnText}>Buy Now - Rs.{Number(selectedItem.price || 0).toFixed(2)}</Text>
                </Pressable>

                <View style={styles.qaWrap}>
                  <Text style={styles.qaTitle}>Questions & Answers</Text>

                  <View style={styles.askRow}>
                    <TextInput
                      style={[styles.input, styles.askInput]}
                      placeholder="Ask a question about this item"
                      value={questionText}
                      onChangeText={setQuestionText}
                    />
                    <Pressable style={styles.askBtn} onPress={submitQuestion}>
                      <Text style={styles.askBtnText}>Ask</Text>
                    </Pressable>
                  </View>

                  {(selectedItem.questions || []).length === 0 ? (
                    <Text style={styles.empty}>No questions yet.</Text>
                  ) : (
                    (selectedItem.questions || []).map((q, idx) => {
                      const qId = String(q._id || idx);
                      return (
                        <View key={qId} style={styles.questionCard}>
                          <Text style={styles.questionUser}>{q.username || 'Student'}</Text>
                          <Text style={styles.questionText}>Q: {q.question || '-'}</Text>
                          {q.answer ? (
                            <Text style={styles.answerText}>A: {q.answer}</Text>
                          ) : isSellerOfSelected ? (
                            <>
                              <TextInput
                                style={styles.input}
                                placeholder="Write answer"
                                value={answerDrafts[qId] || ''}
                                onChangeText={(value) => setAnswerDrafts((prev) => ({ ...prev, [qId]: value }))}
                              />
                              <Pressable style={styles.answerBtn} onPress={() => submitAnswer(qId)}>
                                <Text style={styles.answerBtnText}>Reply</Text>
                              </Pressable>
                            </>
                          ) : (
                            <Text style={styles.pendingText}>Awaiting seller reply</Text>
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            </>
          )}
        </SafeAreaView>
      </Modal>

      <Modal visible={Boolean(paymentItem)} transparent animationType="fade" onRequestClose={() => setPaymentItem(null)}>
        <View style={styles.overlay}>
          <View style={styles.paymentCard}>
            <Text style={styles.paymentTitle}>Payment Gateway (Simulated)</Text>
            <Text style={styles.paymentMeta}>Item: {paymentItem?.title || '-'}</Text>
            <Text style={styles.paymentMeta}>Amount: Rs.{Number(paymentItem?.price || 0).toFixed(2)}</Text>
            <Text style={styles.paymentMeta}>Method: UPI / Card / Wallet (Simulation)</Text>

            <View style={styles.paymentBtnRow}>
              <Pressable style={styles.cancelPayBtn} onPress={() => setPaymentItem(null)} disabled={paymentBusy}>
                <Text style={styles.cancelPayBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.confirmPayBtn, paymentBusy && styles.disabled]} onPress={confirmPaymentSimulation} disabled={paymentBusy}>
                <Text style={styles.confirmPayBtnText}>{paymentBusy ? 'Processing...' : 'Pay Now'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  header: {
    marginBottom: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  headerTitle: { fontSize: 21, fontWeight: '800', color: '#0f172a' },
  headerSub: { color: '#334155', marginTop: 3 },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  toggleBtn: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  toggleBtnActive: { borderColor: '#0f766e', backgroundColor: '#0f766e' },
  toggleText: { fontWeight: '700', color: '#334155' },
  toggleTextActive: { color: '#fff' },
  controlsCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, padding: 10, marginBottom: 10 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 10, backgroundColor: '#f8fafc', marginBottom: 10 },
  searchInput: { flex: 1, paddingVertical: 11, color: '#0f172a' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterBtn: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingVertical: 9, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  filterBtnText: { color: '#334155', fontWeight: '700', fontSize: 12 },
  resetChip: { alignSelf: 'flex-start', marginBottom: 10, backgroundColor: '#fff7ed', borderColor: '#fdba74', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  resetChipText: { color: '#c2410c', fontWeight: '700', fontSize: 12 },
  listContent: { paddingBottom: 20 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardImage: { width: '100%', height: 158, borderRadius: 12, marginBottom: 10, backgroundColor: '#e2e8f0' },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#0f172a' },
  pricePill: { backgroundColor: '#dcfce7', borderColor: '#86efac', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pricePillText: { color: '#166534', fontWeight: '800', fontSize: 12 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  badge: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeMuted: { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' },
  badgeText: { color: '#1d4ed8', fontWeight: '700', fontSize: 11 },
  badgeTextMuted: { color: '#334155' },
  meta: { color: '#475569', fontSize: 13, marginBottom: 2 },
  viewsText: { color: '#64748b', fontSize: 12, marginTop: 2 },
  cardDivider: { marginTop: 10, marginBottom: 10, height: 1, backgroundColor: '#e2e8f0' },
  buyBtn: { marginTop: 2, backgroundColor: '#1d4ed8', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, flexDirection: 'row', gap: 6 },
  buyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  loadMoreBtn: { marginVertical: 10, backgroundColor: '#0f766e', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  loadMoreText: { color: '#fff', fontWeight: '700' },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 8 },
  sellWrap: { paddingBottom: 24 },
  sellTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
  sellSub: { color: '#64748b', marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', marginBottom: 10 },
  textArea: { textAlignVertical: 'top', minHeight: 90 },
  inputLabel: { color: '#475569', fontWeight: '700', marginBottom: 6, marginTop: 4 },
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff' },
  chipActive: { borderColor: '#14b8a6', backgroundColor: '#ecfeff' },
  chipText: { color: '#334155', fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: '#0f766e' },
  imagePickerRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  imagePickBtn: { flex: 1, backgroundColor: '#0f766e', borderRadius: 8, alignItems: 'center', paddingVertical: 10 },
  imagePickBtnText: { color: '#fff', fontWeight: '700' },
  previewStrip: { marginBottom: 8 },
  previewRow: { flexDirection: 'row', gap: 8 },
  previewThumbWrap: { position: 'relative' },
  previewThumb: { width: 88, height: 88, borderRadius: 8, backgroundColor: '#e2e8f0' },
  removeThumbBtn: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#be123c', alignItems: 'center', justifyContent: 'center' },
  removeThumbBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  submitBtn: { marginTop: 10, backgroundColor: '#0f766e', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: '700' },
  categoryScreenContent: { paddingBottom: 20 },
  categoryGrid: {},
  categoryCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#dbeafe', paddingVertical: 18, paddingHorizontal: 14, marginBottom: 10 },
  categoryCardAll: { borderStyle: 'dashed', borderColor: '#94a3b8' },
  categoryCardText: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
  modalContainer: { flex: 1, backgroundColor: '#f8fafc' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  modalClose: { color: '#1d4ed8', fontWeight: '700' },
  modalScroll: { padding: 14, paddingBottom: 30 },
  detailMainImage: { width: '100%', height: 240, borderRadius: 12, backgroundColor: '#e2e8f0' },
  detailThumbRow: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 10 },
  detailThumb: { width: 68, height: 68, borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' },
  detailThumbActive: { borderColor: '#0f766e', borderWidth: 2 },
  detailTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginTop: 4 },
  detailPrice: { fontSize: 22, fontWeight: '800', color: '#166534', marginTop: 6 },
  detailMeta: { color: '#475569', marginTop: 4 },
  detailDesc: { color: '#334155', marginTop: 8, lineHeight: 20 },
  buyBtnLarge: { marginTop: 12, backgroundColor: '#1d4ed8', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  qaWrap: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 12 },
  qaTitle: { fontWeight: '800', color: '#0f172a', fontSize: 16, marginBottom: 8 },
  askRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  askInput: { flex: 1 },
  askBtn: { backgroundColor: '#0f766e', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 11 },
  askBtnText: { color: '#fff', fontWeight: '700' },
  questionCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, padding: 10, marginTop: 8 },
  questionUser: { color: '#1d4ed8', fontWeight: '700' },
  questionText: { color: '#0f172a', marginTop: 4 },
  answerText: { color: '#166534', marginTop: 6, fontWeight: '600' },
  pendingText: { color: '#64748b', marginTop: 6, fontStyle: 'italic' },
  answerBtn: { marginTop: 4, backgroundColor: '#1d4ed8', borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  answerBtnText: { color: '#fff', fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.45)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  paymentCard: { width: '100%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  paymentTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  paymentMeta: { color: '#334155', marginBottom: 4 },
  paymentBtnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  cancelPayBtn: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, alignItems: 'center', paddingVertical: 10, backgroundColor: '#fff' },
  cancelPayBtnText: { color: '#334155', fontWeight: '700' },
  confirmPayBtn: { flex: 1, backgroundColor: '#0f766e', borderRadius: 8, alignItems: 'center', paddingVertical: 10 },
  confirmPayBtnText: { color: '#fff', fontWeight: '700' },
  disabled: { opacity: 0.7 },
});
