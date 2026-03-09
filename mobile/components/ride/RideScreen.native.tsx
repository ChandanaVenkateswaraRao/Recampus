import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type LatLngPoint = { lat: number; lng: number; address?: string };

type DynamicQuote = {
  route: string;
  fare: number;
  etaMin: number;
  distanceKm: number;
  pickupLocation: LatLngPoint;
  dropLocation: LatLngPoint;
};

type ActiveRide = {
  _id: string;
  route?: string;
  status?: string;
  price?: number;
};

type RideRequest = ActiveRide & {
  passenger?: { email?: string; phone?: string };
  matchDistanceKm?: number;
  etaToPickupMin?: number;
};

const KARE_CENTER = { latitude: 9.5115, longitude: 77.6766, latitudeDelta: 0.08, longitudeDelta: 0.08 };

const decodePolyline = (encoded: string) => {
  if (!encoded) return [] as { latitude: number; longitude: number }[];

  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates: { latitude: number; longitude: number }[] = [];

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += deltaLng;

    coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return coordinates;
};

const toPoint = (point?: LatLngPoint | null) => {
  if (!point) return null;
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
};

const parseScheduleInput = (value: string) => {
  const trimmed = String(value || '').trim();
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export default function RideScreen() {
  const { user } = useAuth();
  const topInset = (Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0) + 10;
  const canCaptain = (user?.roles || []).includes('rider');

  const [panelRole, setPanelRole] = useState<'rider' | 'captain'>('rider');
  const [rideMode, setRideMode] = useState<'on-spot' | 'pre-booking'>('on-spot');
  const [mapPickMode, setMapPickMode] = useState<'pickup' | 'drop' | null>(null);

  const [pickupText, setPickupText] = useState('');
  const [dropText, setDropText] = useState('');
  const [manualPickupPoint, setManualPickupPoint] = useState<LatLngPoint | null>(null);
  const [manualDropPoint, setManualDropPoint] = useState<LatLngPoint | null>(null);
  const [scheduleAt, setScheduleAt] = useState('');

  const [dynamicQuote, setDynamicQuote] = useState<DynamicQuote | null>(null);
  const [previewPath, setPreviewPath] = useState<{ latitude: number; longitude: number }[]>([]);

  const [ridePath, setRidePath] = useState<{ latitude: number; longitude: number }[]>([]);
  const [captainPath, setCaptainPath] = useState<{ latitude: number; longitude: number }[]>([]);
  const [captainLocation, setCaptainLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [captainOnline, setCaptainOnline] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<RideRequest[]>([]);

  const [completionCode, setCompletionCode] = useState('');
  const [cancelReason, setCancelReason] = useState('Plans changed');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyAction, setBusyAction] = useState('');

  const roleForBackend = panelRole === 'rider' ? 'passenger' : 'captain';
  const actionStatus = String(activeRide?.status || '');

  const pickupPoint = useMemo(() => toPoint(dynamicQuote?.pickupLocation || manualPickupPoint), [dynamicQuote?.pickupLocation, manualPickupPoint]);
  const dropPoint = useMemo(() => toPoint(dynamicQuote?.dropLocation || manualDropPoint), [dynamicQuote?.dropLocation, manualDropPoint]);

  const loadData = useCallback(async () => {
    try {
      const activeRes = await api.get('/rides/my-active', { params: { role: roleForBackend } });

      setActiveRide(activeRes.data || null);

      if (panelRole === 'captain' && canCaptain) {
        try {
          const [availabilityRes, requestsRes] = await Promise.all([
            api.get('/rides/captain/availability'),
            api.get('/rides/requests', { params: { radiusKm: 8 } }),
          ]);
          setCaptainOnline(Boolean(availabilityRes.data?.isOnline));
          setIncomingRequests(Array.isArray(requestsRes.data) ? requestsRes.data : []);
        } catch {
          setCaptainOnline(false);
          setIncomingRequests([]);
        }
      } else {
        setIncomingRequests([]);
      }
    } catch {
      setActiveRide(null);
      setIncomingRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [panelRole, canCaptain, roleForBackend]);

  useEffect(() => {
    if (panelRole === 'captain' && !canCaptain) {
      setPanelRole('rider');
      return;
    }
    loadData();
  }, [panelRole, canCaptain, loadData]);

  const refresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  useEffect(() => {

  if (panelRole !== "captain") return;

  let subscription: any;

  (async () => {

    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") return;

    subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10,
      },
      (loc) => {

        const point = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };

        setCaptainLocation(point);

      }
    );

  })();

  return () => {
    subscription?.remove();
  };

}, [panelRole]);

  useEffect(() => {

  if (!captainLocation || !pickupPoint) return;

  fetchCaptainRoute(captainLocation, pickupPoint);

}, [captainLocation, pickupPoint]);

  useEffect(() => {

  if (!activeRide) return;

  if ((activeRide as any).polyline) {

    const decoded = decodePolyline((activeRide as any).polyline);

    setRidePath(decoded);

  }

}, [activeRide]);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await api.get('/rides/reverse-geocode', { params: { lat, lng } });
      return String(res.data?.address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } catch {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  const useCurrentLocationAsPickup = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission needed', 'Allow location permission to use current pickup.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      const address = await reverseGeocode(lat, lng);

      setPickupText(address);
      setManualPickupPoint({ lat, lng, address });
      Alert.alert('Pickup updated', 'Current location saved as pickup.');
    } catch {
      Alert.alert('Location Error', 'Unable to fetch current location right now.');
    }
  };

  const onMapPress = async (event: any) => {
    if (!mapPickMode) return;

    const lat = Number(event?.nativeEvent?.coordinate?.latitude);
    const lng = Number(event?.nativeEvent?.coordinate?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const address = await reverseGeocode(lat, lng);

    if (mapPickMode === 'pickup') {
      setPickupText(address);
      setManualPickupPoint({ lat, lng, address });
      Alert.alert('Pickup selected', 'Pickup selected from map.');
    } else {
      setDropText(address);
      setManualDropPoint({ lat, lng, address });
      Alert.alert('Destination selected', 'Destination selected from map.');
    }

    setMapPickMode(null);
  };

  const saveCurrentPlace = (type: 'pickup' | 'drop') => {
    if (type === 'pickup') {
      if (!pickupText.trim()) {
        Alert.alert('Pickup missing', 'Enter or select pickup first.');
        return;
      }
      Alert.alert('Saved', 'Pickup saved.');
      return;
    }

    if (!dropText.trim()) {
      Alert.alert('Destination missing', 'Enter or select destination first.');
      return;
    }
    Alert.alert('Saved', 'Destination saved.');
  };

  const fetchCaptainRoute = async (captain: any, pickup: any) => {

  try {

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${captain.longitude},${captain.latitude};${pickup.longitude},${pickup.latitude}` +
      `?overview=full&geometries=geojson`;

    const res = await fetch(url);
    const data = await res.json();

    const coords = data.routes[0].geometry.coordinates;

    const route = coords.map((c: any) => ({
      latitude: c[1],
      longitude: c[0],
    }));

    setCaptainPath(route);

  } catch (err) {
    console.log("Captain route error", err);
  }

};

  const estimateFare = async () => {
    const pickup = pickupText.trim();
    const destination = dropText.trim();

    if (!pickup || !destination) {
      Alert.alert('Missing details', 'Please enter both pickup and destination.');
      return null;
    }

    try {
      setQuoteLoading(true);
      const routeRes = await api.post('/rides/route-estimate', {
        pickup,
        destination,
        pickupCoords: manualPickupPoint,
        destinationCoords: manualDropPoint,
      });

      const distanceKm = Number(routeRes.data?.distanceKm || 0);
      if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
        Alert.alert('Estimate failed', 'Could not estimate route distance.');
        return null;
      }

      const fareRes = await api.post('/rides/estimate', { distanceKm });
      const fare = Number(fareRes.data?.fare || 0);
      const etaMin = Number(fareRes.data?.etaMin || routeRes.data?.etaMin || 0);

      const pickupLocation: LatLngPoint = {
        lat: Number(routeRes.data?.pickupLocation?.lat),
        lng: Number(routeRes.data?.pickupLocation?.lng),
        address: String(routeRes.data?.pickupLocation?.address || pickup),
      };
      const dropLocation: LatLngPoint = {
        lat: Number(routeRes.data?.dropLocation?.lat),
        lng: Number(routeRes.data?.dropLocation?.lng),
        address: String(routeRes.data?.dropLocation?.address || destination),
      };

      const quote: DynamicQuote = {
        route: String(routeRes.data?.route || `${pickup} -> ${destination}`),
        fare,
        etaMin,
        distanceKm,
        pickupLocation,
        dropLocation,
      };

      setDynamicQuote(quote);
      setManualPickupPoint(pickupLocation);
      setManualDropPoint(dropLocation);

      const decoded = decodePolyline(String(routeRes.data?.polyline || ''));
      if (decoded.length > 1) {
        setPreviewPath(decoded);
      } else {
        const start = toPoint(pickupLocation);
        const end = toPoint(dropLocation);
        setPreviewPath(start && end ? [start, end] : []);
      }

      return quote;
    } catch (error: any) {
      Alert.alert('Estimate failed', error?.response?.data?.message || 'Unable to estimate fare.');
      return null;
    } finally {
      setQuoteLoading(false);
    }
  };

  const bookRide = async () => {
    try {
      setSubmitting(true);

      let quote = dynamicQuote;
      if (!quote) {
        quote = await estimateFare();
      }
      if (!quote) return;

      const payload: any = {
        type: rideMode,
        route: quote.route,
        price: quote.fare,
        distanceKm: quote.distanceKm,
        pickupLocation: quote.pickupLocation,
        dropLocation: quote.dropLocation,
      };

      if (rideMode === 'pre-booking') {
        const parsedDate = parseScheduleInput(scheduleAt);
        if (!parsedDate) {
          Alert.alert('Invalid date', 'Enter schedule datetime as YYYY-MM-DD HH:mm or ISO format.');
          return;
        }
        if (parsedDate.getTime() <= Date.now()) {
          Alert.alert('Invalid date', 'Scheduled time must be in the future.');
          return;
        }
        payload.scheduledAt = parsedDate.toISOString();
      }

      const res = await api.post('/rides/request', payload);
      setActiveRide(res.data || null);
      Alert.alert('Ride booked', rideMode === 'pre-booking' ? 'Pre-book ride confirmed.' : 'On-spot ride requested.');
      await loadData();
    } catch (error: any) {
      Alert.alert('Booking failed', error?.response?.data?.message || 'Unable to book ride.');
    } finally {
      setSubmitting(false);
    }
  };

  const payRide = async () => {
    if (!activeRide?._id) return;
    try {
      setBusyAction('pay');
      const res = await api.post(`/rides/pay/${activeRide._id}`);
      Alert.alert('Payment success', `OTP: ${res.data?.code || '-'}`);
      await loadData();
    } catch (error: any) {
      Alert.alert('Payment failed', error?.response?.data?.message || 'Unable to pay now.');
    } finally {
      setBusyAction('');
    }
  };

  const cancelRide = async () => {
    if (!activeRide?._id) return;
    const reason = cancelReason.trim();
    if (reason.length < 3) {
      Alert.alert('Reason needed', 'Enter at least 3 characters for cancellation reason.');
      return;
    }

    try {
      setBusyAction('cancel');
      await api.patch(`/rides/cancel/${activeRide._id}`, { reason });
      Alert.alert('Cancelled', 'Ride cancelled successfully.');
      await loadData();
    } catch (error: any) {
      Alert.alert('Cancel failed', error?.response?.data?.message || 'Unable to cancel ride.');
    } finally {
      setBusyAction('');
    }
  };

  const toggleCaptainAvailability = async () => {
    try {
      setBusyAction('availability');
      const next = !captainOnline;
      await api.patch('/rides/captain/availability', { isOnline: next });
      setCaptainOnline(next);
      await loadData();
    } catch (error: any) {
      Alert.alert('Update failed', error?.response?.data?.message || 'Unable to update availability.');
    } finally {
      setBusyAction('');
    }
  };

  const acceptRide = async (rideId: string) => {
    try {
      setBusyAction(`accept-${rideId}`);
      await api.patch(`/rides/accept/${rideId}`);
      await loadData();
    } catch (error: any) {
      Alert.alert('Accept failed', error?.response?.data?.message || 'Unable to accept ride.');
    } finally {
      setBusyAction('');
    }
  };

  const markArrived = async () => {
    if (!activeRide?._id) return;
    try {
      setBusyAction('arrived');
      await api.patch(`/rides/captain/arrived/${activeRide._id}`);
      await loadData();
    } catch (error: any) {
      Alert.alert('Update failed', error?.response?.data?.message || 'Unable to mark arrived.');
    } finally {
      setBusyAction('');
    }
  };

  const startTrip = async () => {
    if (!activeRide?._id) return;
    try {
      setBusyAction('start');
      await api.patch(`/rides/captain/start-trip/${activeRide._id}`);
      await loadData();
    } catch (error: any) {
      Alert.alert('Start failed', error?.response?.data?.message || 'Unable to start trip.');
    } finally {
      setBusyAction('');
    }
  };

  const verifyCompletion = async () => {
    if (!activeRide?._id || !completionCode.trim()) {
      Alert.alert('Code required', 'Enter OTP to complete ride.');
      return;
    }

    try {
      setBusyAction('complete');
      const res = await api.post('/rides/verify-completion', {
        rideId: activeRide._id,
        code: completionCode.trim(),
      });
      Alert.alert('Completed', res.data?.message || 'Ride completed.');
      setCompletionCode('');
      await loadData();
    } catch (error: any) {
      Alert.alert('Verification failed', error?.response?.data?.message || 'Invalid OTP code.');
    } finally {
      setBusyAction('');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0f766e" />
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
            <Text style={styles.brandTag}>Ride</Text>
          </View>
        </View>
        <View style={styles.brandBadge}>
          <Text style={styles.brandBadgeText}>LIVE</Text>
        </View>
      </View>

      <View style={{ marginHorizontal: 12, marginBottom: 10 }}>
        <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={KARE_CENTER}
            onPress={onMapPress}
          >

            {pickupPoint && (
              <Marker coordinate={pickupPoint} title="Pickup" pinColor="#059669" />
            )}

            {dropPoint && (
              <Marker coordinate={dropPoint} title="Destination" pinColor="#dc2626" />
            )}

            {captainLocation && (
              <Marker coordinate={captainLocation} title="Captain" pinColor="#000" />
            )}

            {/* Captain → Pickup */}
            {captainPath.length > 1 && (
              <Polyline
                coordinates={captainPath}
                strokeColor="#111827"
                strokeWidth={4}
              />
            )}

            {/* Pickup → Drop */}
            {ridePath.length > 1 && (
              <Polyline
                coordinates={ridePath}
                strokeColor="#2563eb"
                strokeWidth={5}
              />
            )}

            {/* Preview route */}
            {previewPath.length > 1 && (
              <Polyline
                coordinates={previewPath}
                strokeColor="#1d4ed8"
                strokeWidth={4}
              />
            )}

          </MapView>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={styles.panel}>
          <View style={styles.segmentRow}>
            <Pressable
              style={[styles.segmentBtn, panelRole === 'rider' && styles.segmentBtnActive]}
              onPress={() => setPanelRole('rider')}
            >
              <Text style={[styles.segmentText, panelRole === 'rider' && styles.segmentTextActive]}>Rider</Text>
            </Pressable>
            <Pressable
              style={[styles.segmentBtn, panelRole === 'captain' && styles.segmentBtnActive, !canCaptain && styles.disabled]}
              onPress={() => {
                if (!canCaptain) {
                  Alert.alert('Captain access', 'Rider role not enabled for this account.');
                  return;
                }
                setPanelRole('captain');
              }}
            >
              <Text style={[styles.segmentText, panelRole === 'captain' && styles.segmentTextActive]}>Captain</Text>
            </Pressable>
          </View>

          {panelRole === 'rider' ? (
            <>
              <Text style={styles.heading}>Book a Ride</Text>
              <Text style={styles.subheading}>Fast campus rides with live captain tracking and KM-based pricing.</Text>

              <View style={styles.segmentRow}>
                <Pressable
                  style={[styles.segmentBtn, rideMode === 'on-spot' && styles.segmentBtnActive]}
                  onPress={() => setRideMode('on-spot')}
                >
                  <Text style={[styles.segmentText, rideMode === 'on-spot' && styles.segmentTextActive]}>On-Spot Ride</Text>
                </Pressable>
                <Pressable
                  style={[styles.segmentBtn, rideMode === 'pre-booking' && styles.segmentBtnActive]}
                  onPress={() => setRideMode('pre-booking')}
                >
                  <Text style={[styles.segmentText, rideMode === 'pre-booking' && styles.segmentTextActive]}>Pre-Book Ride</Text>
                </Pressable>
              </View>

              <Text style={styles.label}>PICKUP</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter pickup location"
                value={pickupText}
                onChangeText={setPickupText}
              />
              <View style={styles.row2}>
                <Pressable style={styles.actionBtn} onPress={useCurrentLocationAsPickup}>
                  <Text style={styles.actionBtnText}>Use Current</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => setMapPickMode('pickup')}>
                  <Text style={styles.actionBtnText}>Select on Map</Text>
                </Pressable>
              </View>
              <Pressable style={styles.fullBtn} onPress={() => saveCurrentPlace('pickup')}>
                <Text style={styles.fullBtnText}>Save Pickup</Text>
              </Pressable>

              <Text style={styles.label}>DESTINATION</Text>
              <TextInput
                style={styles.input}
                placeholder="Where do you want to go?"
                value={dropText}
                onChangeText={setDropText}
              />
              <Pressable style={styles.fullBtn} onPress={() => setMapPickMode('drop')}>
                <Text style={styles.fullBtnText}>Select Destination on Map</Text>
              </Pressable>
              <Pressable style={styles.fullBtn} onPress={() => saveCurrentPlace('drop')}>
                <Text style={styles.fullBtnText}>Save Destination</Text>
              </Pressable>

              {rideMode === 'pre-booking' && (
                <>
                  <Text style={styles.label}>SCHEDULE (for pre-book)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD HH:mm"
                    value={scheduleAt}
                    onChangeText={setScheduleAt}
                  />
                </>
              )}

              <Pressable style={[styles.mutedBtn, quoteLoading && styles.disabled]} onPress={estimateFare} disabled={quoteLoading}>
                <Text style={styles.mutedBtnText}>{quoteLoading ? 'Estimating...' : 'Estimate Fare by KM'}</Text>
              </Pressable>

              <Pressable style={[styles.mutedBtn, submitting && styles.disabled]} onPress={bookRide} disabled={submitting}>
                <Text style={styles.mutedBtnText}>
                  {submitting ? 'Booking...' : rideMode === 'pre-booking' ? 'Confirm Pre-Book Ride' : 'Book On-Spot Ride'}
                </Text>
              </Pressable>

              {dynamicQuote && (
                <View style={styles.quoteCard}>
                  <Text style={styles.quoteTitle}>{dynamicQuote.route}</Text>
                  <Text style={styles.quoteMeta}>Fare: Rs.{Number(dynamicQuote.fare || 0).toFixed(2)}</Text>
                  <Text style={styles.quoteMeta}>Distance: {Number(dynamicQuote.distanceKm || 0).toFixed(2)} km</Text>
                  <Text style={styles.quoteMeta}>ETA: {Number(dynamicQuote.etaMin || 0)} min</Text>
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={styles.heading}>Captain Console</Text>
              <Pressable style={styles.fullBtn} onPress={toggleCaptainAvailability}>
                <Text style={styles.fullBtnText}>{busyAction === 'availability' ? 'Updating...' : captainOnline ? 'Go Offline' : 'Go Online'}</Text>
              </Pressable>

              <Text style={styles.label}>NEARBY REQUESTS</Text>
              {incomingRequests.length === 0 ? (
                <Text style={styles.empty}>No nearby requests.</Text>
              ) : (
                incomingRequests.map((request) => (
                  <View key={request._id} style={styles.historyCard}>
                    <Text style={styles.quoteTitle}>{request.route || 'Ride Request'}</Text>
                    <Text style={styles.quoteMeta}>Passenger: {request.passenger?.email || '-'}</Text>
                    <Text style={styles.quoteMeta}>ETA to pickup: {Number(request.etaToPickupMin || 0)} min</Text>
                    <Text style={styles.quoteMeta}>Fare: Rs.{Number(request.price || 0).toFixed(2)}</Text>
                    <Pressable style={styles.actionBtn} onPress={() => acceptRide(request._id)}>
                      <Text style={styles.actionBtnText}>{busyAction === `accept-${request._id}` ? 'Accepting...' : 'Accept Ride'}</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.heading}>My Active Ride</Text>
          {activeRide ? (
            <>
              <Text style={styles.quoteTitle}>{activeRide.route || '-'}</Text>
              <Text style={styles.quoteMeta}>Status: {activeRide.status || '-'}</Text>
              <Text style={styles.quoteMeta}>Fare: Rs.{Number(activeRide.price || 0).toFixed(2)}</Text>

              {panelRole === 'rider' && ['accepted', 'arrived', 'in_progress'].includes(actionStatus) && (
                <Pressable style={styles.fullBtn} onPress={payRide}>
                  <Text style={styles.fullBtnText}>{busyAction === 'pay' ? 'Processing...' : 'Simulate Payment'}</Text>
                </Pressable>
              )}

              {panelRole === 'rider' && ['scheduled', 'searching', 'accepted', 'arrived'].includes(actionStatus) && (
                <>
                  <TextInput
                    style={styles.input}
                    value={cancelReason}
                    onChangeText={setCancelReason}
                    placeholder="Cancellation reason"
                  />
                  <Pressable style={styles.cancelBtn} onPress={cancelRide}>
                    <Text style={styles.cancelBtnText}>{busyAction === 'cancel' ? 'Cancelling...' : 'Cancel Ride'}</Text>
                  </Pressable>
                </>
              )}

              {panelRole === 'captain' && actionStatus === 'accepted' && (
                <Pressable style={styles.fullBtn} onPress={markArrived}>
                  <Text style={styles.fullBtnText}>{busyAction === 'arrived' ? 'Updating...' : 'Mark Arrived'}</Text>
                </Pressable>
              )}

              {panelRole === 'captain' && ['accepted', 'arrived'].includes(actionStatus) && (
                <Pressable style={styles.fullBtn} onPress={startTrip}>
                  <Text style={styles.fullBtnText}>{busyAction === 'start' ? 'Starting...' : 'Start Trip'}</Text>
                </Pressable>
              )}

              {panelRole === 'captain' && ['paid', 'in_progress'].includes(actionStatus) && (
                <>
                  <TextInput
                    style={styles.input}
                    value={completionCode}
                    onChangeText={setCompletionCode}
                    placeholder="Enter OTP"
                    keyboardType="number-pad"
                  />
                  <Pressable style={styles.fullBtn} onPress={verifyCompletion}>
                    <Text style={styles.fullBtnText}>{busyAction === 'complete' ? 'Verifying...' : 'Verify & Complete'}</Text>
                  </Pressable>
                </>
              )}
            </>
          ) : (
            <Text style={styles.empty}>No active ride.</Text>
          )}
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {mapPickMode && (
        <View style={styles.mapHint}>
          <Text style={styles.mapHintText}>Tap on map to select {mapPickMode === 'pickup' ? 'pickup' : 'destination'} point.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef2f7' },
  brandBar: {
    marginHorizontal: 12,
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { height: 340, width: '100%' },
  panel: {
    backgroundColor: '#ffffff',
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d9e2ec',
    padding: 12,
  },
  heading: { color: '#0f172a', fontWeight: '800', fontSize: 28 > 22 ? 22 : 22 },
  subheading: { color: '#64748b', marginTop: 4, marginBottom: 10 },
  segmentRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  segmentBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    paddingVertical: 10,
  },
  segmentBtnActive: { backgroundColor: '#0f766e', borderColor: '#0f766e' },
  segmentText: { color: '#334155', fontWeight: '700' },
  segmentTextActive: { color: '#ffffff' },
  label: { color: '#64748b', fontWeight: '700', marginTop: 6, marginBottom: 6, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    marginBottom: 8,
  },
  row2: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  actionBtn: {
    flex: 1,
    backgroundColor: '#0f766e',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
  },
  actionBtnText: { color: '#ffffff', fontWeight: '700' },
  fullBtn: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  fullBtnText: { color: '#ffffff', fontWeight: '700' },
  mutedBtn: {
    backgroundColor: '#77a9a8',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  mutedBtnText: { color: '#ffffff', fontWeight: '700' },
  quoteCard: {
    borderWidth: 1,
    borderColor: '#d1fae5',
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  quoteTitle: { color: '#0f172a', fontWeight: '700' },
  quoteMeta: { color: '#334155', marginTop: 2 },
  empty: { color: '#64748b' },
  historyCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    padding: 10,
    marginTop: 8,
  },
  cancelBtn: {
    backgroundColor: '#e11d48',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
    marginTop: 2,
  },
  cancelBtnText: { color: '#ffffff', fontWeight: '700' },
  mapHint: {
    position: 'absolute',
    bottom: 16,
    left: 12,
    right: 12,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  mapHintText: { color: '#ffffff', textAlign: 'center', fontWeight: '600' },
  bottomSpacing: { height: 26 },
  disabled: { opacity: 0.6 },
});
