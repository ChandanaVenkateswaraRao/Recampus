import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { GoogleMap, InfoWindowF, MarkerF, PolylineF, useJsApiLoader } from '@react-google-maps/api';
import {
  AlertTriangle,
  Bell,
  Bike,
  CheckCircle,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  Share2,
  User,
  X,
  XCircle
} from 'lucide-react';
import PaymentGateway from '../components/items/PaymentGateway';
import { useModule } from '../context/ModuleContext.jsx';
import './Ride.css';

const KARE_CENTER = { lat: 9.5115, lng: 77.6766 };
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const GOOGLE_MAP_ID = (import.meta.env.VITE_GOOGLE_MAP_ID || '').trim();
const MAP_LIBRARIES = ['marker'];
const API_RIDE = 'http://localhost:5000/api/rides';
const API_AUTH = 'http://localhost:5000/api/auth';
const RIDE_REBOOK_DRAFT_KEY = 'recampus_ride_rebook_draft';
const RIDE_SOS_PHONE = import.meta.env.VITE_RIDE_SOS_PHONE || '112';

const displayContact = (person) => {
  if (!person) return 'Contact unavailable';
  if (person.phone) return person.phone;
  if (person.email) return person.email;
  return 'Contact unavailable';
};

const getDialPhone = (person) => {
  const phone = String(person?.phone || '').trim();
  if (!phone || !/^\+?[0-9]{10,15}$/.test(phone)) return null;
  return phone;
};

const toLatLng = (point) => {
  const lat = Number(point?.lat);
  const lng = Number(point?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const haversineKm = (from, to) => {
  if (!from || !to) return null;
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRad(to.lat - from.lat);
  const deltaLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const parseLatLngText = (value) => {
  const text = String(value || '').trim();
  const match = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const decodePolyline = (encoded) => {
  if (!encoded || typeof encoded !== 'string') return [];

  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

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

    coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return coordinates;
};

const markerFallbackIcon = (color) => {
  if (!window.google?.maps?.SymbolPath) return undefined;
  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 10
  };
};

const RideMapView = React.memo(function RideMapView({
  isMapLoaded,
  hasGoogleKey,
  mapId,
  onMapClick,
  mapCenter,
  pickupPoint,
  dropPoint,
  previewPath,
  hasPassengerRide,
  role,
  mapCaptainPoint,
  targetPoint,
  trackingText
}) {
  const mapRef = useRef(null);
  const lastFitBoundsKeyRef = useRef('');
  const captainAnimationFrameRef = useRef(null);
  const animatedCaptainPointRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [animatedCaptainPoint, setAnimatedCaptainPoint] = useState(null);
  const useAdvancedMarkers = Boolean(mapId);
  const mapOptions = useMemo(
    () => ({
      disableDefaultUI: true,
      zoomControl: true,
      clickableIcons: false,
      gestureHandling: 'greedy'
    }),
    []
  );
  const mapContainerStyle = useMemo(() => ({ height: '100%', width: '100%' }), []);

  const AdvancedMapMarker = ({ position, title, glyph, variant = 'dark' }) => {
    const markerRef = useRef(null);

    useEffect(() => {
      if (!useAdvancedMarkers || !mapInstance || !position || !window.google?.maps?.marker?.AdvancedMarkerElement) {
        return undefined;
      }

      const content = document.createElement('div');
      content.className = `advanced-marker ${variant}`;
      content.textContent = glyph;

      const marker = new window.google.maps.marker.AdvancedMarkerElement({
        map: mapInstance,
        position,
        title,
        content
      });

      markerRef.current = marker;

      return () => {
        if (markerRef.current) {
          markerRef.current.map = null;
          markerRef.current = null;
        }
      };
    }, [useAdvancedMarkers, mapInstance, position?.lat, position?.lng, title, glyph, variant]);

    return null;
  };

  useEffect(() => {
    if (!isMapLoaded || !mapRef.current || !window.google?.maps?.LatLngBounds) return;

    const points = [pickupPoint, dropPoint].filter(Boolean);
    if (points.length < 2) return;

    const fitKey = points.map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join('|');
    if (lastFitBoundsKeyRef.current === fitKey) return;
    lastFitBoundsKeyRef.current = fitKey;

    const bounds = new window.google.maps.LatLngBounds();
    points.forEach((point) => bounds.extend(point));
    mapRef.current.fitBounds(bounds, 70);
  }, [isMapLoaded, pickupPoint?.lat, pickupPoint?.lng, dropPoint?.lat, dropPoint?.lng, previewPath.length]);

  useEffect(() => {
    animatedCaptainPointRef.current = animatedCaptainPoint || null;
  }, [animatedCaptainPoint?.lat, animatedCaptainPoint?.lng]);

  useEffect(() => {
    if (captainAnimationFrameRef.current) {
      window.cancelAnimationFrame(captainAnimationFrameRef.current);
      captainAnimationFrameRef.current = null;
    }

    if (!mapCaptainPoint) {
      animatedCaptainPointRef.current = null;
      setAnimatedCaptainPoint(null);
      return undefined;
    }

    const startPoint = animatedCaptainPointRef.current || mapCaptainPoint;
    if (pointSignature(startPoint) === pointSignature(mapCaptainPoint)) {
      animatedCaptainPointRef.current = mapCaptainPoint;
      setAnimatedCaptainPoint(mapCaptainPoint);
      return undefined;
    }

    const startedAt = performance.now();
    const durationMs = 650;

    const animate = (now) => {
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - (1 - progress) * (1 - progress);

      const nextPoint = {
        lat: startPoint.lat + (mapCaptainPoint.lat - startPoint.lat) * eased,
        lng: startPoint.lng + (mapCaptainPoint.lng - startPoint.lng) * eased
      };

      animatedCaptainPointRef.current = nextPoint;
      setAnimatedCaptainPoint(nextPoint);

      if (progress < 1) {
        captainAnimationFrameRef.current = window.requestAnimationFrame(animate);
      } else {
        captainAnimationFrameRef.current = null;
      }
    };

    captainAnimationFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (captainAnimationFrameRef.current) {
        window.cancelAnimationFrame(captainAnimationFrameRef.current);
        captainAnimationFrameRef.current = null;
      }
    };
  }, [mapCaptainPoint?.lat, mapCaptainPoint?.lng]);

  const displayCaptainPoint = animatedCaptainPoint || mapCaptainPoint;

  if (!(hasGoogleKey && isMapLoaded)) {
    return (
      <div className="ride-map-fallback">
        {hasGoogleKey ? 'Loading map…' : 'Google Maps key missing. Set VITE_GOOGLE_MAPS_API_KEY in frontend/.env'}
      </div>
    );
  }

  return (
    <GoogleMap
      onLoad={(map) => {
        mapRef.current = map;
        setMapInstance(map);
      }}
      onClick={onMapClick}
      mapId={mapId || undefined}
      center={mapCenter}
      zoom={15}
      mapContainerStyle={mapContainerStyle}
      options={mapOptions}
    >
      {pickupPoint && (
        useAdvancedMarkers
          ? <AdvancedMapMarker position={pickupPoint} title="Pickup" glyph="P" variant="pickup" />
          : <MarkerF position={pickupPoint} label={{ text: 'P', color: '#ffffff', fontWeight: '700' }} icon={markerFallbackIcon('#16a34a')} title="Pickup" />
      )}

      {dropPoint && (
        useAdvancedMarkers
          ? <AdvancedMapMarker position={dropPoint} title="Drop" glyph="D" variant="drop" />
          : <MarkerF position={dropPoint} label={{ text: 'D', color: '#ffffff', fontWeight: '700' }} icon={markerFallbackIcon('#dc2626')} title="Drop" />
      )}

      {pickupPoint && dropPoint && previewPath.length < 2 && (
        <PolylineF
          path={[pickupPoint, dropPoint]}
          options={{
            strokeColor: '#64748b',
            strokeOpacity: 0.55,
            strokeWeight: 3,
            geodesic: true
          }}
        />
      )}

      {!hasPassengerRide && role === 'passenger' && previewPath.length > 1 && (
        <PolylineF
          path={previewPath}
          options={{
            strokeColor: '#2563eb',
            strokeOpacity: 0.95,
            strokeWeight: 5
          }}
        />
      )}

      {displayCaptainPoint && targetPoint && (
        <PolylineF
          path={[displayCaptainPoint, targetPoint]}
          options={{
            strokeColor: '#111827',
            strokeOpacity: 0.85,
            strokeWeight: 3,
            icons: [
              {
                icon: {
                  path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  scale: 2,
                  strokeColor: '#111827'
                },
                repeat: '80px'
              }
            ]
          }}
        />
      )}

      {displayCaptainPoint && (
        <>
          {useAdvancedMarkers ? (
            <AdvancedMapMarker
              position={displayCaptainPoint}
              glyph={role === 'captain' ? 'C' : 'R'}
              title={role === 'captain' ? 'Your location' : 'Captain live location'}
              variant="captain"
            />
          ) : (
            <MarkerF
              position={displayCaptainPoint}
              label={{ text: role === 'captain' ? 'C' : 'R', color: '#ffffff', fontWeight: '700' }}
              icon={markerFallbackIcon('#111827')}
              title={role === 'captain' ? 'Your location' : 'Captain live location'}
            />
          )}
          {role === 'passenger' && (
            <InfoWindowF position={displayCaptainPoint}>
              <div>{trackingText}</div>
            </InfoWindowF>
          )}
        </>
      )}
    </GoogleMap>
  );
});

const toRounded = (value, digits = 5) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Number(numeric.toFixed(digits));
};

const pointSignature = (point) => {
  const latLng = toLatLng(point);
  if (!latLng) return '';
  return `${toRounded(latLng.lat)},${toRounded(latLng.lng)}`;
};

const personSignature = (person) => {
  if (!person) return '';
  return JSON.stringify({
    id: person._id || person.id || person,
    phone: person.phone || '',
    email: person.email || ''
  });
};

const activeRideSignature = (ride) => {
  if (!ride?._id) return '';
  return JSON.stringify({
    id: ride._id,
    status: ride.status || '',
    route: ride.route || '',
    price: Number(ride.price) || 0,
    distanceKm: toRounded(ride.distanceKm, 2),
    etaMin: Number(ride.etaMin) || 0,
    scheduledAt: ride.scheduledAt || '',
    completionCode: ride.completionCode || '',
    pickup: pointSignature(ride.pickupLocation),
    drop: pointSignature(ride.dropLocation),
    captain: personSignature(ride.captain),
    passenger: personSignature(ride.passenger)
  });
};

const captainLiveSignature = (live) => {
  if (!live) return '';
  return JSON.stringify({
    status: live.status || '',
    etaMin: Number(live.etaMin) || 0,
    remainingDistanceKm: toRounded(live.remainingDistanceKm, 2),
    pickup: pointSignature(live.pickupLocation),
    drop: pointSignature(live.dropLocation),
    captain: pointSignature(live.captainLocation)
  });
};

const radarSignature = (requests) =>
  JSON.stringify(
    (Array.isArray(requests) ? requests : []).map((request) => ({
      id: request?._id || '',
      status: request?.status || '',
      route: request?.route || '',
      price: Number(request?.price) || 0,
      scheduledAt: request?.scheduledAt || '',
      matchDistanceKm: toRounded(request?.matchDistanceKm, 2),
      etaToPickupMin: Number(request?.etaToPickupMin) || 0,
      pickup: pointSignature(request?.pickupLocation),
      drop: pointSignature(request?.dropLocation)
    }))
  );

const rideFlowSteps = [
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'searching', label: 'Searching' },
  { key: 'accepted', label: 'Captain Assigned' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'in_progress', label: 'On Trip' },
  { key: 'paid', label: 'Paid' }
];

const getFlowIndex = (status) => rideFlowSteps.findIndex((step) => step.key === status);

const buildSavedPlaceName = (address) => {
  const text = String(address || '').trim();
  if (!text) return 'Saved Place';
  return text.split(',')[0]?.trim()?.slice(0, 28) || 'Saved Place';
};

const RideModule = ({ user }) => {
  const { rideRole, setRideRole } = useModule();
  const { isLoaded: isMapLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_KEY,
    libraries: MAP_LIBRARIES
  });
  const activeRideSignatureRef = useRef('');
  const captainLiveSignatureRef = useRef('');
  const radarSignatureRef = useRef('');

  const [role, setRole] = useState(rideRole || 'passenger');
  const [canCaptain, setCanCaptain] = useState(Boolean(user?.roles?.includes('rider')));

  const [activeRide, setActiveRide] = useState(null);
  const [captainOnline, setCaptainOnline] = useState(false);
  const [captainLive, setCaptainLive] = useState(null);
  const [captainSelfLocation, setCaptainSelfLocation] = useState(null);
  const [radarRequests, setRadarRequests] = useState([]);

  const [customRoute, setCustomRoute] = useState({ start: '', end: '' });
  const [mapPickMode, setMapPickMode] = useState(null);
  const [manualPickupPoint, setManualPickupPoint] = useState(null);
  const [manualDropPoint, setManualDropPoint] = useState(null);
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropSuggestions, setDropSuggestions] = useState([]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropSuggestions, setShowDropSuggestions] = useState(false);
  const [dynamicQuote, setDynamicQuote] = useState(null);
  const [previewPath, setPreviewPath] = useState([]);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [rideMode, setRideMode] = useState('on-spot');
  const [radius, setRadius] = useState(8);
  const [otpInput, setOtpInput] = useState('');
  const [showGateway, setShowGateway] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [rideAlerts, setRideAlerts] = useState([]);
  const [lastCaptainSignalAt, setLastCaptainSignalAt] = useState(null);
  const [isLiveStale, setIsLiveStale] = useState(false);
  const [visualCaptainPoint, setVisualCaptainPoint] = useState(null);
  const latestCaptainPointRef = useRef(null);
  const previousRideStatusRef = useRef('');
  const rideAlertTimersRef = useRef({});

  const token = localStorage.getItem('token');
  const headers = { headers: { Authorization: `Bearer ${token}` } };
  const savedPlacesStorageKey = `recampus_saved_places_${user?._id || 'guest'}`;

  const captainRideId = activeRide?.captain?._id || activeRide?.captain;
  const passengerRideId = activeRide?.passenger?._id || activeRide?.passenger;

  const hasCaptainRide = Boolean(
    activeRide &&
      String(captainRideId || '') === String(user?._id || '') &&
      ['accepted', 'arrived', 'in_progress', 'paid'].includes(activeRide.status)
  );

  const hasPassengerRide = Boolean(
    activeRide &&
      String(passengerRideId || '') === String(user?._id || '') &&
      ['scheduled', 'searching', 'accepted', 'arrived', 'in_progress', 'paid'].includes(activeRide.status)
  );

  const updateRole = useCallback(
    (nextRole) => {
      if (!nextRole) return;
      setRole(nextRole);
      if (setRideRole) setRideRole(nextRole);
    },
    [setRideRole]
  );

  useEffect(() => {
    if (!rideRole || rideRole === role) return;
    setRole(rideRole);
  }, [rideRole, role]);

  const dismissRideAlert = useCallback((alertId) => {
    setRideAlerts((prev) => prev.filter((item) => item.id !== alertId));
    if (rideAlertTimersRef.current[alertId]) {
      window.clearTimeout(rideAlertTimersRef.current[alertId]);
      delete rideAlertTimersRef.current[alertId];
    }
  }, []);

  const pushRideAlert = useCallback((text, type = 'info') => {
    if (!text) return;

    const alertId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setRideAlerts((prev) => [{ id: alertId, text, type }, ...prev].slice(0, 4));

    rideAlertTimersRef.current[alertId] = window.setTimeout(() => {
      setRideAlerts((prev) => prev.filter((item) => item.id !== alertId));
      delete rideAlertTimersRef.current[alertId];
    }, 5000);
  }, []);

  const applyActiveRide = (nextRide) => {
    const normalized = nextRide || null;
    const signature = activeRideSignature(normalized);
    if (signature === activeRideSignatureRef.current) return;
    activeRideSignatureRef.current = signature;
    setActiveRide(normalized);
  };

  const applyCaptainLive = (nextLive) => {
    const normalized = nextLive || null;
    const signature = captainLiveSignature(normalized);
    if (signature === captainLiveSignatureRef.current) return;
    captainLiveSignatureRef.current = signature;
    setCaptainLive(normalized);
  };

  const applyRadarRequests = (nextRequests) => {
    const normalized = Array.isArray(nextRequests) ? nextRequests : [];
    const signature = radarSignature(normalized);
    if (signature === radarSignatureRef.current) return;
    radarSignatureRef.current = signature;
    setRadarRequests(normalized);
  };

  const fetchActiveRide = async (targetRole = role) => {
    try {
      const res = await axios.get(`${API_RIDE}/my-active?role=${targetRole}`, headers);
      applyActiveRide(res.data || null);
    } catch (_) {}
  };

  const fetchCaptainAvailability = async () => {
    if (!canCaptain) return;
    try {
      const res = await axios.get(`${API_RIDE}/captain/availability`, headers);
      setCaptainOnline(Boolean(res.data?.isOnline));
    } catch (_) {}
  };

  const fetchRadar = async () => {
    if (!(role === 'captain' && canCaptain && captainOnline && !hasCaptainRide)) {
      applyRadarRequests([]);
      return;
    }

    try {
      const res = await axios.get(
        `${API_RIDE}/requests?radiusKm=${radius}`,
        headers
      );
      applyRadarRequests(Array.isArray(res.data) ? res.data : []);
    } catch (_) {
      applyRadarRequests([]);
    }
  };

  const fetchLive = async () => {
    if (!((hasPassengerRide || hasCaptainRide) && activeRide?._id)) {
      applyCaptainLive(null);
      return;
    }

    try {
      const res = await axios.get(`${API_RIDE}/live/${activeRide._id}`, headers);
      applyCaptainLive(res.data || null);
    } catch (_) {
      applyCaptainLive(null);
    }
  };

  const requestPlacePredictions = async (inputText, setSuggestions) => {
    const query = String(inputText || '').trim();
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await axios.get(`${API_RIDE}/place-suggest?q=${encodeURIComponent(query)}`, headers);
      setSuggestions(Array.isArray(res.data) ? res.data.slice(0, 5) : []);
    } catch (_) {
      setSuggestions([]);
    }
  };

  const estimateDynamicRide = async () => {
    const pickupText = customRoute.start?.trim();
    const dropText = customRoute.end?.trim();

    if (!pickupText || !dropText) {
      alert('Enter pickup and destination');
      return null;
    }

    if (!isMapLoaded || !GOOGLE_MAPS_KEY) {
      alert('Map is not ready yet. Try again in a moment.');
      return null;
    }

    setQuoteLoading(true);
    try {
      const routeRes = await axios.post(
        `${API_RIDE}/route-estimate`,
        {
          pickup: pickupText,
          destination: dropText,
          pickupCoords: manualPickupPoint,
          destinationCoords: manualDropPoint
        },
        headers
      );

      const distanceKm = Number(routeRes.data?.distanceKm);
      if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
        throw new Error('Could not estimate route distance.');
      }

      const fareRes = await axios.post(`${API_RIDE}/estimate`, { distanceKm }, headers);
      const fare = Number(fareRes.data?.fare) || Math.max(25, Math.round(12 + distanceKm * 10));
      const etaMin = Number(fareRes.data?.etaMin) || Number(routeRes.data?.etaMin) || Math.max(1, Math.round(distanceKm * 2.2));

      const resolvedStartLat = Number(routeRes.data?.pickupLocation?.lat);
      const resolvedStartLng = Number(routeRes.data?.pickupLocation?.lng);
      const resolvedEndLat = Number(routeRes.data?.dropLocation?.lat);
      const resolvedEndLng = Number(routeRes.data?.dropLocation?.lng);

      const quote = {
        route: routeRes.data?.route || `${pickupText} ➔ ${dropText}`,
        fare,
        etaMin,
        distanceKm,
        pickupLocation: {
          lat: resolvedStartLat,
          lng: resolvedStartLng,
          address: routeRes.data?.pickupLocation?.address || pickupText
        },
        dropLocation: {
          lat: resolvedEndLat,
          lng: resolvedEndLng,
          address: routeRes.data?.dropLocation?.address || dropText
        }
      };

      const path = decodePolyline(routeRes.data?.polyline);

      setDynamicQuote(quote);
      setPreviewPath(path);
      return quote;
    } catch (err) {
      const pickupLatLng = parseLatLngText(pickupText);
      const dropLatLng = parseLatLngText(dropText);
      const fallbackDistance = haversineKm(pickupLatLng, dropLatLng);

      if (Number.isFinite(fallbackDistance) && fallbackDistance > 0) {
        const distanceKm = Number(fallbackDistance.toFixed(2));
        const fareRes = await axios.post(`${API_RIDE}/estimate`, { distanceKm }, headers);
        const fare = Number(fareRes.data?.fare) || Math.max(25, Math.round(12 + distanceKm * 10));
        const etaMin = Number(fareRes.data?.etaMin) || Math.max(1, Math.round(distanceKm * 2.2));

        const quote = {
          route: `${pickupText} ➔ ${dropText}`,
          fare,
          etaMin,
          distanceKm,
          pickupLocation: {
            lat: pickupLatLng.lat,
            lng: pickupLatLng.lng,
            address: pickupText
          },
          dropLocation: {
            lat: dropLatLng.lat,
            lng: dropLatLng.lng,
            address: dropText
          }
        };

        setDynamicQuote(quote);
        setPreviewPath([pickupLatLng, dropLatLng]);
        alert('Routes API is blocked right now. Used coordinate fallback estimate; enable Routes API for road-accurate routes.');
        return quote;
      }

      const rawMessage = err?.response?.data?.message || err?.message || 'Unable to estimate fare right now';
      const isRoutesPermissionIssue =
        Number(err?.response?.status) === 502 ||
        Number(err?.httpStatus) === 403 ||
        String(err?.apiStatus || '').includes('PERMISSION') ||
        /REQUEST_DENIED|LegacyApiNotActivated|not enabled|forbidden|api project/i.test(String(rawMessage));

      if (isRoutesPermissionIssue) {
        alert('Routes API is not enabled/allowed for this key. Enable Routes API in Google Cloud and allow referrer http://localhost:5173/*, or enter pickup & destination as "lat,lng" to use temporary fallback.');
      } else {
        alert(rawMessage);
      }
      return null;
    } finally {
      setQuoteLoading(false);
    }
  };

  const useCurrentLocationAsPickup = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation not supported in this browser.');
      return;
    }

    try {
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0
        });
      });

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

      setCustomRoute((prev) => ({ ...prev, start: address }));
      setManualPickupPoint({ lat, lng });
    } catch (_) {
      alert('Unable to fetch current location. Please allow location access.');
    }
  };

  const handleMapPickClick = useCallback(async (event) => {
    if (!mapPickMode) return;

    const lat = Number(event?.latLng?.lat?.());
    const lng = Number(event?.latLng?.lng?.());
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const coordinateText = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    let selectedAddress = coordinateText;
    const requestHeaders = { headers: { Authorization: `Bearer ${token}` } };

    try {
      const reverseRes = await axios.get(
        `${API_RIDE}/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
        requestHeaders
      );
      if (reverseRes.data?.address) {
        selectedAddress = reverseRes.data.address;
      }
    } catch (_) {}

    if (mapPickMode === 'pickup') {
      setCustomRoute((prev) => ({ ...prev, start: selectedAddress }));
      setManualPickupPoint({ lat, lng });
    }

    if (mapPickMode === 'drop') {
      setCustomRoute((prev) => ({ ...prev, end: selectedAddress }));
      setManualDropPoint({ lat, lng });
    }

    setMapPickMode(null);
  }, [mapPickMode, token]);

  useEffect(() => {
    setCanCaptain(Boolean(user?.roles?.includes('rider')));
  }, [user]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(savedPlacesStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      setSavedPlaces(Array.isArray(parsed) ? parsed : []);
    } catch (_) {
      setSavedPlaces([]);
    }
  }, [savedPlacesStorageKey]);

  useEffect(() => {
    if (!user?._id) return;
    fetchActiveRide(role);
    if (role === 'captain') fetchCaptainAvailability();
  }, [role, user?._id]);

  useEffect(() => {
    const nextStatus = String(activeRide?.status || '');

    if (!nextStatus) {
      previousRideStatusRef.current = '';
      return;
    }

    if (!previousRideStatusRef.current) {
      previousRideStatusRef.current = nextStatus;
      return;
    }

    if (previousRideStatusRef.current === nextStatus) return;

    const passengerMessages = {
      accepted: 'Captain accepted your ride.',
      arrived: 'Captain arrived at pickup.',
      in_progress: 'Your trip has started.',
      paid: 'Payment confirmed. Share OTP with captain to complete trip.',
      completed: 'Trip completed successfully.',
      cancelled: 'Ride was cancelled.'
    };

    const captainMessages = {
      accepted: 'Ride accepted. Navigate to pickup location.',
      arrived: 'You marked arrival. Waiting for passenger to board.',
      in_progress: 'Trip started. Drive safely.',
      paid: 'Passenger payment done. Verify OTP to complete ride.',
      completed: 'Trip completed and payout released.',
      cancelled: 'Ride was cancelled.'
    };

    const statusMessage = role === 'captain' ? captainMessages[nextStatus] : passengerMessages[nextStatus];

    if (statusMessage) {
      const type = ['cancelled'].includes(nextStatus) ? 'warning' : 'info';
      pushRideAlert(statusMessage, type);
    }

    previousRideStatusRef.current = nextStatus;
  }, [activeRide?.status, role, pushRideAlert]);

  useEffect(() => {
    return () => {
      Object.values(rideAlertTimersRef.current).forEach((timerId) => window.clearTimeout(timerId));
      rideAlertTimersRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!(role === 'passenger' && !hasPassengerRide)) return;

    try {
      const raw = localStorage.getItem(RIDE_REBOOK_DRAFT_KEY);
      if (!raw) return;

      const draft = JSON.parse(raw);
      const pickupAddress = String(draft?.pickupLocation?.address || '').trim();
      const dropAddress = String(draft?.dropLocation?.address || '').trim();

      if (!pickupAddress || !dropAddress) {
        localStorage.removeItem(RIDE_REBOOK_DRAFT_KEY);
        return;
      }

      setCustomRoute({ start: pickupAddress, end: dropAddress });
      setManualPickupPoint(toLatLng(draft?.pickupLocation));
      setManualDropPoint(toLatLng(draft?.dropLocation));
      setRideMode(draft?.type === 'pre-booking' ? 'pre-booking' : 'on-spot');
      setScheduleAt('');
      setDynamicQuote(null);
      localStorage.removeItem(RIDE_REBOOK_DRAFT_KEY);
    } catch (_) {
      localStorage.removeItem(RIDE_REBOOK_DRAFT_KEY);
    }
  }, [role, hasPassengerRide]);

  useEffect(() => {
    if (!user?._id) return;
    const ridePollMs = hasPassengerRide || hasCaptainRide ? 2200 : 4500;
    const interval = setInterval(() => fetchActiveRide(role), ridePollMs);
    return () => clearInterval(interval);
  }, [role, user?._id, hasPassengerRide, hasCaptainRide]);

  useEffect(() => {
    const radarPollMs = role === 'captain' && canCaptain && captainOnline && !hasCaptainRide ? 2600 : 5000;
    fetchRadar();
    const interval = setInterval(fetchRadar, radarPollMs);
    return () => clearInterval(interval);
  }, [role, canCaptain, captainOnline, hasCaptainRide, radius]);

  useEffect(() => {
    const livePollMs = hasPassengerRide || hasCaptainRide ? 2000 : 4500;
    fetchLive();
    const interval = setInterval(fetchLive, livePollMs);
    return () => clearInterval(interval);
  }, [activeRide?._id, hasPassengerRide, hasCaptainRide]);

  useEffect(() => {
    if (!(role === 'captain' && canCaptain && captainOnline)) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        setCaptainSelfLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        try {
          await axios.patch(
            `${API_RIDE}/captain/location`,
            { lat: pos.coords.latitude, lng: pos.coords.longitude },
            headers
          );
        } catch (_) {}
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [role, canCaptain, captainOnline]);

  useEffect(() => {
    setDynamicQuote(null);
    setPreviewPath([]);
  }, [customRoute.start, customRoute.end]);

  useEffect(() => {
    const timer = setTimeout(() => {
      requestPlacePredictions(customRoute.start, setPickupSuggestions);
    }, 220);
    return () => clearTimeout(timer);
  }, [customRoute.start, isMapLoaded]);

  useEffect(() => {
    const timer = setTimeout(() => {
      requestPlacePredictions(customRoute.end, setDropSuggestions);
    }, 220);
    return () => clearTimeout(timer);
  }, [customRoute.end, isMapLoaded]);

  const previewPickupPoint = useMemo(
    () => toLatLng(dynamicQuote?.pickupLocation) || manualPickupPoint,
    [dynamicQuote?.pickupLocation?.lat, dynamicQuote?.pickupLocation?.lng, manualPickupPoint?.lat, manualPickupPoint?.lng]
  );
  const previewDropPoint = useMemo(
    () => toLatLng(dynamicQuote?.dropLocation) || manualDropPoint,
    [dynamicQuote?.dropLocation?.lat, dynamicQuote?.dropLocation?.lng, manualDropPoint?.lat, manualDropPoint?.lng]
  );
  const pickupPoint = useMemo(
    () => toLatLng(captainLive?.pickupLocation || activeRide?.pickupLocation) || previewPickupPoint,
    [captainLive?.pickupLocation?.lat, captainLive?.pickupLocation?.lng, activeRide?.pickupLocation?.lat, activeRide?.pickupLocation?.lng, previewPickupPoint?.lat, previewPickupPoint?.lng]
  );
  const dropPoint = useMemo(
    () => toLatLng(captainLive?.dropLocation || activeRide?.dropLocation) || previewDropPoint,
    [captainLive?.dropLocation?.lat, captainLive?.dropLocation?.lng, activeRide?.dropLocation?.lat, activeRide?.dropLocation?.lng, previewDropPoint?.lat, previewDropPoint?.lng]
  );
  const liveCaptainPoint = useMemo(
    () => toLatLng(captainLive?.captainLocation),
    [captainLive?.captainLocation?.lat, captainLive?.captainLocation?.lng]
  );
  const selfCaptainPoint = useMemo(
    () => toLatLng(captainSelfLocation),
    [captainSelfLocation?.lat, captainSelfLocation?.lng]
  );
  const mapCaptainPoint = role === 'captain' ? selfCaptainPoint || liveCaptainPoint : liveCaptainPoint;
  useEffect(() => {
    latestCaptainPointRef.current = mapCaptainPoint || null;
  }, [mapCaptainPoint?.lat, mapCaptainPoint?.lng]);

  useEffect(() => {
    const applyVisualCaptainPoint = () => {
      const nextPoint = latestCaptainPointRef.current || null;
      setVisualCaptainPoint((previousPoint) => {
        if (pointSignature(previousPoint) === pointSignature(nextPoint)) return previousPoint;
        return nextPoint;
      });
    };

    applyVisualCaptainPoint();
    const timer = setInterval(applyVisualCaptainPoint, 1000);
    return () => clearInterval(timer);
  }, []);

  const mapCenter = useMemo(
    () => pickupPoint || dropPoint || visualCaptainPoint || KARE_CENTER,
    [pickupPoint, dropPoint, visualCaptainPoint]
  );
  const targetPoint =
    captainLive?.status && ['accepted', 'arrived'].includes(captainLive.status)
      ? pickupPoint
      : dropPoint;
  const trackingText = captainLive?.etaMin
    ? `ETA ${captainLive.etaMin} min • ${captainLive?.remainingDistanceKm ?? '-'} km`
    : captainLive?.captainLocation
      ? 'Captain location updating...'
      : 'Waiting for live captain location';

  const shouldTrackLiveReliability =
    hasPassengerRide && ['accepted', 'arrived', 'in_progress', 'paid'].includes(String(activeRide?.status || ''));

  useEffect(() => {
    if (!shouldTrackLiveReliability) {
      setIsLiveStale(false);
      setLastCaptainSignalAt(null);
      return;
    }

    if (captainLive?.captainLocation || captainLive?.updatedAt) {
      setLastCaptainSignalAt(Date.now());
    }
  }, [captainLive?.captainLocation?.lat, captainLive?.captainLocation?.lng, captainLive?.updatedAt, shouldTrackLiveReliability]);

  useEffect(() => {
    if (!shouldTrackLiveReliability || !lastCaptainSignalAt) {
      setIsLiveStale(false);
      return;
    }

    const evaluateStale = () => {
      setIsLiveStale(Date.now() - lastCaptainSignalAt > 15000);
    };

    evaluateStale();
    const timer = setInterval(evaluateStale, 4000);
    return () => clearInterval(timer);
  }, [lastCaptainSignalAt, shouldTrackLiveReliability]);

  const etaReliability = useMemo(() => {
    if (!shouldTrackLiveReliability) return null;

    const eta = Number(captainLive?.etaMin);
    if (isLiveStale) {
      return { label: 'Delayed', tone: 'delayed' };
    }
    if (!Number.isFinite(eta)) {
      return { label: 'Updating', tone: 'updating' };
    }
    if (eta <= 6) {
      return { label: 'On Time', tone: 'on_time' };
    }
    if (eta <= 12) {
      return { label: 'Slight Delay', tone: 'slight_delay' };
    }
    return { label: 'Delayed', tone: 'delayed' };
  }, [captainLive?.etaMin, isLiveStale, shouldTrackLiveReliability]);

  const fareBreakup = useMemo(() => {
    if (!dynamicQuote) return null;

    const distanceKm = Number(dynamicQuote.distanceKm) || 0;
    const totalFare = Number(dynamicQuote.fare) || 0;
    if (totalFare <= 0) return null;

    const baseFare = Math.max(12, Math.round(totalFare * 0.22));
    const distanceFare = Math.max(0, totalFare - baseFare);
    const platformFee = 0;

    return {
      baseFare,
      distanceFare,
      platformFee,
      distanceKm,
      totalFare
    };
  }, [dynamicQuote]);

  const requestRide = async (payload) => {
    setSubmitting(true);
    try {
      let pickupLocation = payload?.pickupLocation;
      try {
        if (!pickupLocation) {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
          });
          pickupLocation = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            address: 'Current Location'
          };
        }
      } catch (_) {}

      const res = await axios.post(`${API_RIDE}/request`, { ...payload, pickupLocation }, headers);
      applyActiveRide(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Unable to request ride');
    } finally {
      setSubmitting(false);
    }
  };

  const acceptRide = async (rideId) => {
    try {
      const res = await axios.patch(`${API_RIDE}/accept/${rideId}`, {}, headers);
      applyActiveRide(res.data);
      applyRadarRequests([]);
    } catch (err) {
      alert(err.response?.data?.message || 'Ride not available');
    }
  };

  const markArrived = async () => {
    try {
      const res = await axios.patch(`${API_RIDE}/captain/arrived/${activeRide._id}`, {}, headers);
      applyActiveRide(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Unable to mark arrived');
    }
  };

  const startTrip = async () => {
    try {
      const res = await axios.patch(`${API_RIDE}/captain/start-trip/${activeRide._id}`, {}, headers);
      applyActiveRide(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Unable to start trip');
    }
  };

  const payForRide = async () => {
    setShowGateway(false);
    try {
      const res = await axios.post(`${API_RIDE}/pay/${activeRide._id}`, {}, headers);
      applyActiveRide(res.data.ride);
    } catch (err) {
      alert(err.response?.data?.message || 'Payment failed');
    }
  };

  const completeRide = async () => {
    try {
      const res = await axios.post(
        `${API_RIDE}/verify-completion`,
        { rideId: activeRide._id, code: otpInput },
        headers
      );
      alert(res.data?.message || 'Ride completed');
      setOtpInput('');
      applyActiveRide(null);
      fetchActiveRide(role);
    } catch (err) {
      alert(err.response?.data?.message || 'Invalid OTP');
    }
  };

  const cancelRide = async () => {
    const cancellationReason = window.prompt('Please tell us why you are cancelling this ride:');
    if (cancellationReason === null) return;

    const reason = String(cancellationReason || '').trim();
    if (reason.length < 3) {
      alert('Please provide at least 3 characters as reason.');
      return;
    }

    if (!window.confirm('Confirm cancellation?')) return;
    try {
      await axios.patch(`${API_RIDE}/cancel/${activeRide._id}`, { reason }, headers);
      applyActiveRide(null);
      applyCaptainLive(null);
      fetchActiveRide(role);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not cancel ride');
    }
  };

  const handleSos = () => {
    const confirmed = window.confirm(`Call emergency support (${RIDE_SOS_PHONE}) now?`);
    if (!confirmed) return;
    window.location.href = `tel:${RIDE_SOS_PHONE}`;
  };

  const handleShareTrip = async () => {
    if (!activeRide) return;

    const status = String(activeRide?.status || '').replace('_', ' ');
    const route = activeRide?.route || 'Campus Ride';
    const shareUrl = `${window.location.origin}${window.location.pathname}?module=ride&rideId=${encodeURIComponent(activeRide._id || '')}`;
    const shareText = `Recampus ride update\nRoute: ${route}\nStatus: ${status}\nTrack: ${shareUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Recampus Ride Status',
          text: shareText,
          url: shareUrl
        });
        pushRideAlert('Trip status shared successfully.', 'info');
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        pushRideAlert('Trip status copied to clipboard.', 'info');
        return;
      }

      window.prompt('Copy trip details:', shareText);
    } catch (_) {
      pushRideAlert('Unable to share trip right now.', 'warning');
    }
  };

  const persistSavedPlaces = (places) => {
    try {
      localStorage.setItem(savedPlacesStorageKey, JSON.stringify(places));
    } catch (_) {}
    setSavedPlaces(places);
  };

  const saveCurrentPlace = (target) => {
    const address = target === 'pickup' ? customRoute.start : customRoute.end;
    const point = target === 'pickup' ? manualPickupPoint : manualDropPoint;
    const parsed = point || parseLatLngText(address);
    const normalizedAddress = String(address || '').trim();

    if (!normalizedAddress) {
      alert(`Enter ${target === 'pickup' ? 'pickup' : 'destination'} first.`);
      return;
    }

    const saved = {
      id: `${target}-${Date.now()}`,
      target,
      name: buildSavedPlaceName(normalizedAddress),
      address: normalizedAddress,
      lat: Number(parsed?.lat),
      lng: Number(parsed?.lng)
    };

    const nextPlaces = [saved, ...savedPlaces].slice(0, 8);
    persistSavedPlaces(nextPlaces);
  };

  const applySavedPlace = (place) => {
    const lat = Number(place?.lat);
    const lng = Number(place?.lng);
    const coords = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

    if (place?.target === 'pickup') {
      setCustomRoute((prev) => ({ ...prev, start: place.address || '' }));
      setManualPickupPoint(coords);
      return;
    }

    setCustomRoute((prev) => ({ ...prev, end: place.address || '' }));
    setManualDropPoint(coords);
  };

  const removeSavedPlace = (placeId) => {
    const nextPlaces = savedPlaces.filter((place) => String(place.id) !== String(placeId));
    persistSavedPlaces(nextPlaces);
  };

  const becomeCaptain = async () => {
    try {
      const res = await axios.post(`${API_AUTH}/become-rider`, {}, headers);
      if (res.data?.token) localStorage.setItem('token', res.data.token);
      setCanCaptain(true);
      updateRole('captain');
      fetchCaptainAvailability();
    } catch (err) {
      alert(err.response?.data?.message || 'Registration failed');
    }
  };

  const toggleCaptainOnline = async () => {
    try {
      const res = await axios.patch(`${API_RIDE}/captain/availability`, { isOnline: !captainOnline }, headers);
      setCaptainOnline(Boolean(res.data?.isOnline));
    } catch (err) {
      alert(err.response?.data?.message || 'Could not change availability');
    }
  };

  const renderRideProgress = (status) => {
    const activeIndex = getFlowIndex(status);
    if (activeIndex < 0) return null;

    return (
      <div className="ride-progress-strip" aria-label="Ride progress">
        {rideFlowSteps.map((step, index) => {
          const stateClass =
            index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'todo';

          return (
            <div key={step.key} className={`ride-progress-step ${stateClass}`}>
              <span className="dot" />
              <small>{step.label}</small>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPassenger = () => {
    const renderPassengerSafetyActions = () => (
      <div className="ride-safety-actions">
        <button type="button" className="rapido-btn share compact" onClick={handleShareTrip}>
          <Share2 size={14} /> Share Trip
        </button>
        <button type="button" className="rapido-btn sos compact" onClick={handleSos}>
          <AlertTriangle size={14} /> SOS
        </button>
      </div>
    );

    const renderLiveReliabilityWarning = () => {
      if (!isLiveStale || !shouldTrackLiveReliability) return null;
      return (
        <div className="ride-live-warning" role="status" aria-live="polite">
          <AlertTriangle size={14} />
          <span>Live captain location is delayed. We are trying to reconnect updates.</span>
        </div>
      );
    };

    if (!hasPassengerRide) {
      return (
        <div className="ride-panel-body fade-in">
          <div className="booking-header-card">
            <h2>Book a Ride</h2>
            <p className="ride-subtitle">Fast campus rides with live captain tracking and KM-based pricing.</p>
          </div>

          <div className="ride-mode-toggle">
            <button
              className={rideMode === 'on-spot' ? 'active' : ''}
              onClick={() => setRideMode('on-spot')}
              type="button"
            >
              On-Spot Ride
            </button>
            <button
              className={rideMode === 'pre-booking' ? 'active' : ''}
              onClick={() => setRideMode('pre-booking')}
              type="button"
            >
              Pre-Book Ride
            </button>
          </div>

          <div className="rapido-booking-card">
            {savedPlaces.length > 0 && (
              <div className="saved-places-wrap">
                <div className="booking-label">Saved Places</div>
                <div className="saved-places-list">
                  {savedPlaces.map((place) => (
                    <div key={place.id} className="saved-place-chip">
                      <button type="button" onClick={() => applySavedPlace(place)}>
                        {place.name}
                        <small>{place.target === 'pickup' ? 'Pickup' : 'Drop'}</small>
                      </button>
                      <span onClick={() => removeSavedPlace(place.id)} role="button" tabIndex={0}>×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="booking-label">Pickup</div>
            <div className="location-input-stack">
              <input
                className="location-input"
                placeholder="Enter pickup location"
                value={customRoute.start}
                onFocus={() => setShowPickupSuggestions(true)}
                onBlur={() => setTimeout(() => setShowPickupSuggestions(false), 150)}
                onChange={(e) => {
                  setCustomRoute((prev) => ({ ...prev, start: e.target.value }));
                  setManualPickupPoint(null);
                  setShowPickupSuggestions(true);
                }}
              />
              {showPickupSuggestions && pickupSuggestions.length > 0 && (
                <div className="place-suggestions">
                  {pickupSuggestions.map((prediction) => (
                    <button
                      key={prediction.id}
                      className="place-suggestion-item"
                      onClick={() => {
                        setCustomRoute((prev) => ({ ...prev, start: prediction.description || '' }));
                        setManualPickupPoint(null);
                        setPickupSuggestions([]);
                        setShowPickupSuggestions(false);
                      }}
                    >
                      {prediction.description}
                    </button>
                  ))}
                </div>
              )}
              <div className="booking-inline-actions">
                <button className="rapido-btn dark compact" onClick={useCurrentLocationAsPickup}>Use Current</button>
                <button className="rapido-btn dark compact" onClick={() => setMapPickMode('pickup')}>Select on Map</button>
              </div>
              <button className="rapido-btn dark compact" onClick={() => saveCurrentPlace('pickup')}>Save Pickup</button>
            </div>

            <div className="booking-label">Destination</div>
            <input
              className="location-input"
              placeholder="Where do you want to go?"
              value={customRoute.end}
              onFocus={() => setShowDropSuggestions(true)}
              onBlur={() => setTimeout(() => setShowDropSuggestions(false), 150)}
              onChange={(e) => {
                setCustomRoute((prev) => ({ ...prev, end: e.target.value }));
                setManualDropPoint(null);
                setShowDropSuggestions(true);
              }}
            />
            <div className="booking-inline-actions single">
              <button className="rapido-btn dark compact" onClick={() => setMapPickMode('drop')}>Select Destination on Map</button>
            </div>
            <button className="rapido-btn dark compact" onClick={() => saveCurrentPlace('drop')}>Save Destination</button>
            {showDropSuggestions && dropSuggestions.length > 0 && (
              <div className="place-suggestions">
                {dropSuggestions.map((prediction) => (
                  <button
                    key={prediction.id}
                    className="place-suggestion-item"
                    onClick={() => {
                      setCustomRoute((prev) => ({ ...prev, end: prediction.description || '' }));
                      setManualDropPoint(null);
                      setDropSuggestions([]);
                      setShowDropSuggestions(false);
                    }}
                  >
                    {prediction.description}
                  </button>
                ))}
              </div>
            )}

            <button
              className="rapido-btn dark booking-estimate-btn"
              disabled={quoteLoading || !customRoute.start || !customRoute.end}
              onClick={estimateDynamicRide}
            >
              {quoteLoading ? <Loader2 className="spin" size={16} /> : 'Estimate Fare by KM'}
            </button>

            {mapPickMode && (
              <div className="trip-status-box">
                <p><strong>Map Selection Active:</strong> Click on map to set {mapPickMode === 'pickup' ? 'pickup' : 'destination'}.</p>
              </div>
            )}

            {rideMode === 'pre-booking' && (
              <>
                <div className="booking-label">Schedule Time</div>
                <input
                  className="location-input"
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                />
                <p className="booking-mode-note">Captain matching starts before your selected time.</p>
              </>
            )}

            {dynamicQuote && (
              <>
                <div className="booking-quote-grid">
                  <div className="booking-quote-item">
                    <span>Distance</span>
                    <strong>{dynamicQuote.distanceKm} km</strong>
                  </div>
                  <div className="booking-quote-item">
                    <span>ETA</span>
                    <strong>{dynamicQuote.etaMin} min</strong>
                  </div>
                  <div className="booking-quote-item">
                    <span>Fare</span>
                    <strong>₹{dynamicQuote.fare}</strong>
                  </div>
                </div>
                {fareBreakup && (
                  <div className="fare-breakup-card" aria-label="Fare breakup">
                    <div className="fare-breakup-title">Fare Breakup</div>
                    <div className="fare-breakup-row">
                      <span>Base Fare</span>
                      <strong>₹{fareBreakup.baseFare}</strong>
                    </div>
                    <div className="fare-breakup-row">
                      <span>Distance ({fareBreakup.distanceKm} km)</span>
                      <strong>₹{fareBreakup.distanceFare}</strong>
                    </div>
                    <div className="fare-breakup-row muted">
                      <span>Platform Fee</span>
                      <strong>₹{fareBreakup.platformFee}</strong>
                    </div>
                    <div className="fare-breakup-total">
                      <span>Total</span>
                      <strong>₹{fareBreakup.totalFare}</strong>
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              className="rapido-btn dark booking-confirm-btn"
              disabled={
                submitting ||
                quoteLoading ||
                !customRoute.start ||
                !customRoute.end ||
                (rideMode === 'pre-booking' && !scheduleAt)
              }
              onClick={async () => {
                const quote = dynamicQuote || (await estimateDynamicRide());
                if (!quote) return;
                requestRide({
                  type: rideMode,
                  route: quote.route,
                  price: quote.fare,
                  distanceKm: quote.distanceKm,
                  pickupLocation: quote.pickupLocation,
                  dropLocation: quote.dropLocation,
                  ...(rideMode === 'pre-booking' ? { scheduledAt: scheduleAt } : {})
                });
              }}
            >
              {submitting ? <Loader2 className="spin" size={16} /> : rideMode === 'pre-booking' ? 'Confirm Pre-Book Ride' : 'Book On-Spot Ride'}
            </button>
          </div>
        </div>
      );
    }

    if (activeRide.status === 'scheduled') {
      return (
        <div className="ride-panel-body fade-in">
          {renderRideProgress(activeRide.status)}
          <div className="ride-state-shell center">
            <Clock size={40} />
            <h3>Ride Scheduled</h3>
            <p className="state-route-text">{activeRide.route}</p>
            <p className="state-meta-text">{new Date(activeRide.scheduledAt).toLocaleString()}</p>
          </div>
          {renderPassengerSafetyActions()}
          <button className="rapido-btn danger full" onClick={cancelRide}><XCircle size={16} />Cancel</button>
        </div>
      );
    }

    if (activeRide.status === 'searching') {
      return (
        <div className="ride-panel-body fade-in">
          {renderRideProgress(activeRide.status)}
          <div className="ride-state-shell center">
            <div className="radar-pulse" />
            <h3>Finding Captain</h3>
            <p className="state-route-text">{activeRide.route}</p>
          </div>
          {renderPassengerSafetyActions()}
          <button className="rapido-btn danger full" onClick={cancelRide}><XCircle size={16} />Cancel</button>
        </div>
      );
    }

    if (activeRide.status === 'accepted') {
      const captainPhone = getDialPhone(activeRide.captain);
      return (
        <div className="ride-panel-body fade-in">
          {renderRideProgress(activeRide.status)}
          {renderLiveReliabilityWarning()}
          <div className="ride-state-shell center">
            <CheckCircle size={42} />
            <h3>Captain Assigned</h3>
            <p>{captainLive?.etaMin ? `ETA: ${captainLive.etaMin} min` : 'Tracking captain location...'}</p>
          </div>
          <div className="captain-profile">
            <div className="cap-avatar"><User size={18} /></div>
            <div>
              <strong>{activeRide.captain?.email?.split('@')[0]}</strong>
              <span>On the way • {displayContact(activeRide.captain)}</span>
            </div>
          </div>
          {captainPhone && (
            <a className="rapido-btn call" href={`tel:${captainPhone}`}>
              <Phone size={16} /> Call Captain
            </a>
          )}
          {renderPassengerSafetyActions()}
          <button className="rapido-btn danger full" onClick={cancelRide}><XCircle size={16} />Cancel</button>
        </div>
      );
    }

    if (activeRide.status === 'arrived') {
      const captainPhone = getDialPhone(activeRide.captain);
      return (
        <div className="ride-panel-body fade-in">
          {renderRideProgress(activeRide.status)}
          {renderLiveReliabilityWarning()}
          <div className="ride-state-shell center">
            <MapPin size={42} />
            <h3>Captain Arrived</h3>
            <p>Please board and start the trip.</p>
          </div>
          <div className="captain-profile">
            <div className="cap-avatar"><User size={18} /></div>
            <div>
              <strong>{activeRide.captain?.email?.split('@')[0]}</strong>
              <span>Waiting at pickup • {displayContact(activeRide.captain)}</span>
            </div>
          </div>
          {captainPhone && (
            <a className="rapido-btn call" href={`tel:${captainPhone}`}>
              <Phone size={16} /> Call Captain
            </a>
          )}
          {renderPassengerSafetyActions()}
        </div>
      );
    }

    if (activeRide.status === 'in_progress') {
      return (
        <div className="ride-panel-body fade-in">
          {renderRideProgress(activeRide.status)}
          {renderLiveReliabilityWarning()}
          <div className="ride-state-shell center">
            <ShieldCheck size={40} />
            <h3>Trip In Progress</h3>
            <p>{captainLive?.etaMin ? `Destination ETA: ${captainLive.etaMin} min` : 'Ride in motion'}</p>
          </div>
          {renderPassengerSafetyActions()}
          <button className="rapido-btn dark" onClick={() => setShowGateway(true)}>Pay ₹{activeRide.price}</button>
        </div>
      );
    }

    if (activeRide.status === 'paid') {
      return (
        <div className="ride-panel-body fade-in">
          {renderRideProgress(activeRide.status)}
          {renderLiveReliabilityWarning()}
          <div className="ride-state-shell center">
            <ShieldCheck size={40} />
            <h3>Payment Success</h3>
          </div>
          <div className="otp-card">
            <span>OTP FOR CAPTAIN</span>
            <h1>{activeRide.completionCode}</h1>
          </div>
          {renderPassengerSafetyActions()}
        </div>
      );
    }

    return null;
  };

  const renderCaptain = () => {
    if (!canCaptain) {
      return (
        <div className="ride-panel-body center fade-in">
          <Bike size={52} />
          <h3>Become a Captain</h3>
          <p>Join Rapido-style captain network inside campus.</p>
          <button className="rapido-btn dark" onClick={becomeCaptain}>Register as Captain</button>
        </div>
      );
    }

    if (!hasCaptainRide) {
      return (
        <div className="ride-panel-body fade-in">
          <div className="booking-header-card captain-header-card">
            <h2>Captain Radar</h2>
            <p className="ride-subtitle">Stay online to receive nearby passenger requests.</p>
          </div>

          <div className={`captain-live-badge ${captainOnline ? 'online' : 'offline'} full-width`}>
            <span className="dot" />
            {captainOnline ? 'You are Online • Receiving requests' : 'You are Offline • Turn on to receive requests'}
          </div>

          <div className="radar-summary-strip">
            <div className="radar-summary-item">
              <span>Search Radius</span>
              <strong>{radius} km</strong>
            </div>
            <div className="radar-summary-item">
              <span>Live Requests</span>
              <strong>{captainOnline ? radarRequests.length : 0}</strong>
            </div>
          </div>

          <div className="captain-toolbar">
            <button className="rapido-btn dark compact captain-toggle-btn" onClick={toggleCaptainOnline}>
              {captainOnline ? 'Go Offline' : 'Go Online'}
            </button>
            <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
              <option value={5}>5 km</option>
              <option value={8}>8 km</option>
              <option value={12}>12 km</option>
              <option value={20}>20 km</option>
            </select>
          </div>

          {!captainOnline && <p className="empty-note">Set online to view requests.</p>}

          <div className="radar-list-box">
            {captainOnline && radarRequests.length === 0 ? (
              <p className="empty-note">No ride requests nearby.</p>
            ) : (
              radarRequests.map((request) => (
                <div key={request._id} className="radar-item">
                  <div className="radar-item-main">
                    <div className="radar-item-top">
                      <strong>{request.route}</strong>
                      <span className="radar-price">₹{request.price}</span>
                    </div>
                    <div className="radar-meta-row">
                      <small>
                        {request.matchDistanceKm !== null && request.matchDistanceKm !== undefined
                          ? `${request.matchDistanceKm} km away`
                          : 'Distance unavailable'}
                      </small>
                      <small>
                        ~{request.etaToPickupMin || '-'} min to pickup
                      </small>
                    </div>
                    {request.matchDistanceKm !== null && request.matchDistanceKm !== undefined && (
                      <div className="radar-pill">Nearby Match</div>
                    )}
                    {request.status === 'scheduled' && request.scheduledAt && (
                      <small className="radar-schedule">Scheduled: {new Date(request.scheduledAt).toLocaleString()}</small>
                    )}
                  </div>
                  <button className="radar-accept-btn" onClick={() => acceptRide(request._id)}>Accept Ride</button>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="ride-panel-body fade-in">
        {renderRideProgress(activeRide.status)}
        {(() => {
          const passengerPhone = getDialPhone(activeRide.passenger);
          return passengerPhone ? (
            <a className="rapido-btn call full" href={`tel:${passengerPhone}`}>
              <Phone size={16} /> Call Passenger
            </a>
          ) : null;
        })()}
        <div className="booking-header-card captain-header-card">
          <h2>Active Trip</h2>
          <p className="ride-subtitle">Follow trip steps and complete with OTP verification.</p>
        </div>
        <div className="trip-route-card"><strong>Route:</strong> {activeRide.route}</div>
        <div className="trip-route-card">
          <strong><Phone size={14} /> Passenger Contact:</strong>{' '}
          {displayContact(activeRide.passenger)}
        </div>
        <div className="trip-state-chip">Status: {activeRide.status.replace('_', ' ')}</div>

        {activeRide.status === 'accepted' ? (
          <div className="trip-status-box">
            <p>Navigate to pickup point.</p>
            <button className="rapido-btn dark" onClick={markArrived}>Mark Arrived</button>
          </div>
        ) : activeRide.status === 'arrived' ? (
          <div className="trip-status-box">
            <p>Passenger boarded?</p>
            <button className="rapido-btn dark" onClick={startTrip}>Start Trip</button>
          </div>
        ) : (
          <div className="trip-status-box">
            <p>{activeRide.status === 'paid' ? 'Payment done. Enter OTP:' : 'Enter OTP after payment:'}</p>
            <input
              type="text"
              value={otpInput}
              maxLength={4}
              placeholder="0000"
              onChange={(e) => setOtpInput(e.target.value)}
            />
            <button className="rapido-btn dark" onClick={completeRide}>Complete Trip</button>
          </div>
        )}
      </div>
    );
  };

  if (!user) return <div className="ride-loader">Loading...</div>;

  return (
    <div className="rapido-ride-module">
      {rideAlerts.length > 0 && (
        <div className="ride-alert-stack" role="status" aria-live="polite">
          {rideAlerts.map((alertItem) => (
            <div key={alertItem.id} className={`ride-alert-item ${alertItem.type}`}>
              <Bell size={14} />
              <span>{alertItem.text}</span>
              <button
                type="button"
                className="ride-alert-close"
                onClick={() => dismissRideAlert(alertItem.id)}
                aria-label="Dismiss notification"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rapido-map-layer">
        <RideMapView
          isMapLoaded={isMapLoaded}
          hasGoogleKey={Boolean(GOOGLE_MAPS_KEY)}
          mapId={GOOGLE_MAP_ID}
          onMapClick={handleMapPickClick}
          mapCenter={mapCenter}
          pickupPoint={pickupPoint}
          dropPoint={dropPoint}
          previewPath={previewPath}
          hasPassengerRide={hasPassengerRide}
          role={role}
          mapCaptainPoint={visualCaptainPoint}
          targetPoint={targetPoint}
          trackingText={trackingText}
        />

        {(hasPassengerRide || hasCaptainRide) && (
          <div className="ride-live-chip">
            <Navigation size={14} />
            <span>{trackingText}</span>
          </div>
        )}

        {etaReliability && (
          <div className={`ride-live-chip ride-eta-chip ${etaReliability.tone}`}>
            <Clock size={14} />
            <span>ETA Confidence: {etaReliability.label}</span>
          </div>
        )}

      </div>

      <div className="rapido-panel">
        {!hasCaptainRide && !hasPassengerRide && (
          <div className="rapido-role-toggle">
            <button className={role === 'passenger' ? 'active' : ''} onClick={() => updateRole('passenger')}>Rider</button>
            <button className={role === 'captain' ? 'active' : ''} onClick={() => updateRole('captain')}>Captain</button>
          </div>
        )}

        {role === 'passenger' ? renderPassenger() : renderCaptain()}
      </div>

      {showGateway && activeRide && (
        <PaymentGateway item={{ price: activeRide.price }} onClose={() => setShowGateway(false)} onSuccess={payForRide} />
      )}
    </div>
  );
};

export default RideModule;
