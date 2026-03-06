const express = require('express');
const router = express.Router();
const Ride = require('../models/Ride');
const User = require('../models/User');
const { auth, checkRole } = require('../middleware/authMiddleware');
const {
  haversineKm,
  etaFromDistance,
  emitRideUpdate
} = require('../utils/rideMatcher');

const KARE_COORDS = { lat: 9.5115, lng: 77.6766 };
const GOOGLE_ROUTES_API = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const OFFICIAL_ROUTES = [
  {
    id: 'kare-krishnankovil',
    from: 'KARE Campus',
    to: 'Krishnankovil',
    price: 30,
    distanceKm: 4.5,
    etaMin: 12,
    pickup: { ...KARE_COORDS, address: 'KARE Campus' },
    drop: { lat: 9.5052, lng: 77.7412, address: 'Krishnankovil' }
  },
  {
    id: 'kare-srivi-railway-station',
    from: 'KARE Campus',
    to: 'Srivi Railway Station',
    price: 70,
    distanceKm: 13.5,
    etaMin: 28,
    pickup: { ...KARE_COORDS, address: 'KARE Campus' },
    drop: { lat: 9.5119, lng: 77.6331, address: 'Srivi Railway Station' }
  }
];

const findOfficialRoute = (routeId) => OFFICIAL_ROUTES.find((route) => route.id === routeId);

const parseLatLngText = (value) => {
  const text = String(value || '').trim();
  const match = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const normalizeLatLngObject = (value) => {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const buildRouteWaypoint = (input, coords) => {
  const normalized = normalizeLatLngObject(coords);
  if (normalized) {
    return {
      location: {
        latLng: {
          latitude: normalized.lat,
          longitude: normalized.lng
        }
      }
    };
  }

  const parsed = parseLatLngText(input);
  if (parsed) {
    return {
      location: {
        latLng: {
          latitude: parsed.lat,
          longitude: parsed.lng
        }
      }
    };
  }

  return { address: String(input || '').trim() };
};

const parseDurationToMinutes = (durationString) => {
  const seconds = Number(String(durationString || '').replace('s', ''));
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.max(1, Math.round(seconds / 60));
};

const geocodeWithNominatim = async (query) => {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'RecampusRideEstimator/1.0'
    }
  });

  if (!response.ok) {
    throw new Error('Nominatim geocoding failed.');
  }

  const data = await response.json();
  const hit = data?.[0];
  if (!hit) {
    throw new Error(`Could not locate: ${query}`);
  }

  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(`Invalid geocode result for: ${query}`);
  }

  return {
    lat,
    lng,
    address: hit.display_name || query
  };
};

const suggestWithNominatim = async (query) => {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'RecampusRideEstimator/1.0'
    }
  });

  if (!response.ok) {
    throw new Error('Nominatim suggestion lookup failed.');
  }

  const data = await response.json();
  if (!Array.isArray(data)) return [];

  return data
    .map((entry) => ({
      id: String(entry.place_id || `${entry.lat},${entry.lon}`),
      description: entry.display_name,
      lat: Number(entry.lat),
      lng: Number(entry.lon)
    }))
    .filter((entry) => entry.description && Number.isFinite(entry.lat) && Number.isFinite(entry.lng));
};

const estimateViaOsmOsrm = async ({ pickup, destination, pickupCoords, destinationCoords }) => {
  const pickupParsed = parseLatLngText(pickup);
  const destinationParsed = parseLatLngText(destination);

  const pickupPoint =
    normalizeLatLngObject(pickupCoords) ||
    pickupParsed ||
    (await geocodeWithNominatim(pickup));
  const destinationPoint =
    normalizeLatLngObject(destinationCoords) ||
    destinationParsed ||
    (await geocodeWithNominatim(destination));

  const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pickupPoint.lng},${pickupPoint.lat};${destinationPoint.lng},${destinationPoint.lat}?overview=full&geometries=polyline`;
  const routeResponse = await fetch(osrmUrl, {
    headers: {
      'User-Agent': 'RecampusRideEstimator/1.0'
    }
  });

  if (!routeResponse.ok) {
    throw new Error('OSRM routing failed.');
  }

  const routeData = await routeResponse.json();
  const route = routeData?.routes?.[0];
  const distanceMeters = Number(route?.distance);
  const durationSeconds = Number(route?.duration);

  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    throw new Error('OSRM route distance unavailable.');
  }

  return {
    route: `${pickup} ➔ ${destination}`,
    distanceKm: Number((distanceMeters / 1000).toFixed(2)),
    etaMin: Math.max(1, Math.round((Number.isFinite(durationSeconds) ? durationSeconds : distanceMeters / 9) / 60)),
    pickupLocation: {
      lat: pickupPoint.lat,
      lng: pickupPoint.lng,
      address: pickupPoint.address || pickup
    },
    dropLocation: {
      lat: destinationPoint.lat,
      lng: destinationPoint.lng,
      address: destinationPoint.address || destination
    },
    polyline: route?.geometry || '',
    provider: 'osm-osrm'
  };
};

router.get('/catalog', auth, async (req, res) => {
  res.json(OFFICIAL_ROUTES);
});

router.get('/place-suggest', auth, async (req, res) => {
  try {
    const query = String(req.query?.q || '').trim();
    if (query.length < 3) {
      return res.json([]);
    }

    const suggestions = await suggestWithNominatim(query);
    return res.json(suggestions);
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Failed to fetch suggestions.' });
  }
});

router.get('/reverse-geocode', auth, async (req, res) => {
  try {
    const lat = Number(req.query?.lat);
    const lng = Number(req.query?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: 'Valid lat and lng are required.' });
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RecampusRideEstimator/1.0'
      }
    });

    if (!response.ok) {
      return res.status(502).json({ message: 'Reverse geocoding lookup failed.' });
    }

    const data = await response.json();
    return res.json({ address: data?.display_name || `${lat}, ${lng}` });
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Reverse geocoding failed.' });
  }
});

router.get('/captain/availability', auth, checkRole(['rider']), async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('riderStatus');
    if (!user) return res.status(404).json({ message: 'Captain not found.' });
    return res.json({
      isOnline: Boolean(user.riderStatus?.isOnline),
      lastLocation: user.riderStatus?.lastLocation || null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/captain/availability', auth, checkRole(['rider']), async (req, res) => {
  try {
    const isOnline = Boolean(req.body?.isOnline);
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { 'riderStatus.isOnline': isOnline } },
      { returnDocument: 'after' }
    ).select('riderStatus');

    if (!user) return res.status(404).json({ message: 'Captain not found.' });
    return res.json({ isOnline: Boolean(user.riderStatus?.isOnline) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/captain/location', auth, checkRole(['rider']), async (req, res) => {
  try {
    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: 'Valid lat/lng are required.' });
    }

    await User.findByIdAndUpdate(req.user.id, {
      $set: {
        'riderStatus.lastLocation': { lat, lng, updatedAt: new Date() }
      }
    });

    return res.json({ message: 'Location updated.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/estimate', auth, async (req, res) => {
  const { routeId, distanceKm } = req.body;

  if (routeId) {
    const route = findOfficialRoute(routeId);
    if (!route) return res.status(404).json({ message: 'Route not found.' });
    return res.json({ fare: route.price, etaMin: route.etaMin, distanceKm: route.distanceKm });
  }

  const numericDistance = Number(distanceKm);
  if (!numericDistance || numericDistance <= 0) {
    return res.status(400).json({ message: 'Provide routeId or valid distanceKm.' });
  }

  const fare = Math.max(25, Math.round(12 + numericDistance * 10));
  const etaMin = Math.max(8, Math.round(numericDistance * 2.2));
  return res.json({ fare, etaMin, distanceKm: numericDistance });
});

router.post('/route-estimate', auth, async (req, res) => {
  try {
    const pickup = String(req.body?.pickup || '').trim();
    const destination = String(req.body?.destination || '').trim();
    const pickupCoords = normalizeLatLngObject(req.body?.pickupCoords || req.body?.pickupLocation);
    const destinationCoords = normalizeLatLngObject(req.body?.destinationCoords || req.body?.dropLocation);

    if (!pickup || !destination) {
      return res.status(400).json({ message: 'pickup and destination are required.' });
    }

    const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_KEY;

    if (serverKey) {
      const routeRes = await fetch(GOOGLE_ROUTES_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': serverKey,
          'X-Goog-FieldMask': [
            'routes.distanceMeters',
            'routes.duration',
            'routes.polyline.encodedPolyline',
            'routes.legs.distanceMeters',
            'routes.legs.duration',
            'routes.legs.startLocation',
            'routes.legs.endLocation'
          ].join(',')
        },
        body: JSON.stringify({
          origin: buildRouteWaypoint(pickup, pickupCoords),
          destination: buildRouteWaypoint(destination, destinationCoords),
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          computeAlternativeRoutes: false,
          units: 'METRIC',
          languageCode: 'en-US'
        })
      });

      const routeData = await routeRes.json();
      if (routeRes.ok) {
        const route = routeData?.routes?.[0];
        const leg = route?.legs?.[0];
        const distanceMeters = Number(route?.distanceMeters || leg?.distanceMeters);
        if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) {
          return res.status(400).json({ message: 'Could not estimate route distance.' });
        }

        const distanceKm = Number((distanceMeters / 1000).toFixed(2));
        const etaMin =
          parseDurationToMinutes(route?.duration) ||
          parseDurationToMinutes(leg?.duration) ||
          Math.max(1, Math.round(distanceKm * 2.2));

        const startLat = Number(leg?.startLocation?.latLng?.latitude);
        const startLng = Number(leg?.startLocation?.latLng?.longitude);
        const endLat = Number(leg?.endLocation?.latLng?.latitude);
        const endLng = Number(leg?.endLocation?.latLng?.longitude);

        if (!Number.isFinite(startLat) || !Number.isFinite(startLng) || !Number.isFinite(endLat) || !Number.isFinite(endLng)) {
          return res.status(400).json({ message: 'Route coordinates unavailable for selected points.' });
        }

        return res.json({
          route: `${pickup} ➔ ${destination}`,
          distanceKm,
          etaMin,
          pickupLocation: { lat: startLat, lng: startLng, address: pickup },
          dropLocation: { lat: endLat, lng: endLng, address: destination },
          polyline: route?.polyline?.encodedPolyline || '',
          provider: 'google-routes'
        });
      }

      try {
        const fallback = await estimateViaOsmOsrm({ pickup, destination, pickupCoords, destinationCoords });
        return res.json(fallback);
      } catch (fallbackErr) {
        return res.status(502).json({
          message: routeData?.error?.message || 'Routes API request failed.',
          status: routeData?.error?.status || null,
          httpStatus: routeRes.status,
          fallbackError: fallbackErr.message
        });
      }
    }

    const fallback = await estimateViaOsmOsrm({ pickup, destination, pickupCoords, destinationCoords });
    return res.json(fallback);
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Route estimation failed.' });
  }
});

// 1. Passenger requests a ride
router.post('/request', auth, async (req, res) => {
  try {
    const { type, routeId, route, price, scheduledAt, pickupLocation, dropLocation, distanceKm } = req.body;
    if (!['on-spot', 'pre-booking'].includes(type)) {
      return res.status(400).json({ message: "Invalid ride request payload." });
    }

    const existing = await Ride.findOne({ passenger: req.user.id, status: { $in: ['scheduled', 'searching', 'accepted', 'arrived', 'in_progress', 'paid'] } });
    if (existing) return res.status(400).json({ message: "You already have an active ride." });

    const officialRoute = routeId ? findOfficialRoute(routeId) : null;
    if (routeId && !officialRoute) {
      return res.status(400).json({ message: "Invalid official route." });
    }

    const resolvedRoute = officialRoute ? `${officialRoute.from} ➔ ${officialRoute.to}` : route;
    const resolvedDistanceKm = officialRoute ? officialRoute.distanceKm : Number(distanceKm) || 4;
    const resolvedPrice = officialRoute
      ? officialRoute.price
      : Math.max(25, Math.round(12 + resolvedDistanceKm * 10));
    const resolvedEtaMin = officialRoute ? officialRoute.etaMin : etaFromDistance(resolvedDistanceKm);
    const resolvedPickup = officialRoute
      ? officialRoute.pickup
      : {
          lat: Number(pickupLocation?.lat) || KARE_COORDS.lat,
          lng: Number(pickupLocation?.lng) || KARE_COORDS.lng,
          address: pickupLocation?.address || 'Custom Pickup'
        };
    const resolvedDrop = officialRoute
      ? officialRoute.drop
      : {
          lat: Number(dropLocation?.lat) || undefined,
          lng: Number(dropLocation?.lng) || undefined,
          address: dropLocation?.address || 'Custom Drop'
        };

    if (!resolvedRoute || typeof resolvedPrice !== 'number' || resolvedPrice <= 0) {
      return res.status(400).json({ message: "Route and valid price are required." });
    }

    let scheduleDate = undefined;
    const status = type === 'pre-booking' ? 'scheduled' : 'searching';
    if (type === 'pre-booking') {
      if (!scheduledAt) {
        return res.status(400).json({ message: 'scheduledAt is required for pre-booking.' });
      }
      scheduleDate = new Date(scheduledAt);
      if (Number.isNaN(scheduleDate.getTime()) || scheduleDate <= new Date()) {
        return res.status(400).json({ message: 'scheduledAt must be a future datetime.' });
      }
    }

    const ride = new Ride({
      passenger: req.user.id,
      type,
      status,
      officialRouteId: officialRoute?.id,
      route: resolvedRoute,
      price: resolvedPrice,
      distanceKm: resolvedDistanceKm,
      etaMin: resolvedEtaMin,
      pickupLocation: resolvedPickup,
      dropLocation: resolvedDrop,
      scheduledAt: scheduleDate,
      searchExpiresAt: type === 'on-spot' ? new Date(Date.now() + 6 * 60 * 1000) : undefined
    });
    await ride.save();

    
    // Return populated so UI has email instantly
    const populatedRide = await Ride.findById(ride._id).populate('passenger', 'email phone').populate('captain', 'email phone');
    res.status(201).json(populatedRide);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 2. Fetch my active ride (Works for both Passenger and Captain)
router.get('/my-active', auth, async (req, res) => {
  try {
    const requestedRole = req.query.role;
    let roleFilter;

    if (requestedRole === 'captain') {
      roleFilter = { captain: req.user.id };
    } else if (requestedRole === 'passenger') {
      roleFilter = { passenger: req.user.id };
    } else {
      roleFilter = { $or: [{ passenger: req.user.id }, { captain: req.user.id }] };
    }

    const ride = await Ride.findOne({ 
      ...roleFilter,
      status: { $in: ['scheduled', 'searching', 'accepted', 'arrived', 'in_progress', 'paid'] } 
    }).populate('passenger', 'email phone').populate('captain', 'email phone');
    res.json(ride);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/live/:id', auth, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id).select('passenger captain status pickupLocation dropLocation');
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    const isPassenger = String(ride.passenger) === String(req.user.id);
    const isCaptain = String(ride.captain) === String(req.user.id);
    if (!isPassenger && !isCaptain) {
      return res.status(403).json({ message: 'Not allowed to view this ride.' });
    }

    if (!ride.captain) {
      return res.json({
        status: ride.status,
        pickupLocation: ride.pickupLocation || null,
        dropLocation: ride.dropLocation || null,
        targetLocation: null,
        captainLocation: null,
        etaMin: null,
        remainingDistanceKm: null
      });
    }

    const captain = await User.findById(ride.captain).select('riderStatus.lastLocation');
    const captainLocation = captain?.riderStatus?.lastLocation || null;
    if (!captainLocation?.lat || !captainLocation?.lng) {
      return res.json({
        status: ride.status,
        pickupLocation: ride.pickupLocation || null,
        dropLocation: ride.dropLocation || null,
        targetLocation: null,
        captainLocation: null,
        etaMin: null,
        remainingDistanceKm: null
      });
    }

    const target = ['accepted', 'arrived'].includes(ride.status) ? ride.pickupLocation : ride.dropLocation;
    const distance = haversineKm(captainLocation, target);
    const etaMin = Number.isFinite(distance) ? etaFromDistance(distance) : null;

    return res.json({
      captainLocation: {
        lat: captainLocation.lat,
        lng: captainLocation.lng,
        updatedAt: captainLocation.updatedAt || null
      },
      status: ride.status,
      pickupLocation: ride.pickupLocation || null,
      dropLocation: ride.dropLocation || null,
      targetLocation: target || null,
      etaMin,
      remainingDistanceKm: Number.isFinite(distance) ? Number(distance.toFixed(2)) : null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Captain views Radar
router.get('/requests', auth, checkRole(['rider']), async (req, res) => {
  try {
    const radiusKm = Number(req.query.radiusKm) || 8;
    const includeSelf = req.query.includeSelf === 'true';
    const captain = await User.findById(req.user.id).select('riderStatus');
    const captainLocation = captain?.riderStatus?.lastLocation;
    const isOnline = Boolean(captain?.riderStatus?.isOnline);
    if (!isOnline) {
      return res.status(400).json({ message: 'Set yourself online to view nearby requests.' });
    }

    const captainActiveRide = await Ride.findOne({
      captain: req.user.id,
      status: { $in: ['accepted', 'arrived', 'in_progress', 'paid'] }
    }).select('_id status');

    if (captainActiveRide) {
      return res.json([]);
    }

    const now = new Date();
    const windowEnd = new Date(now.getTime() + 45 * 60 * 1000);

    const rideQuery = {
      captain: null,
      $or: [
        { status: 'searching' },
        { status: 'scheduled', scheduledAt: { $lte: windowEnd } }
      ]
    };

    if (!includeSelf) {
      rideQuery.passenger = { $ne: req.user.id };
    }

    const rides = await Ride.find(rideQuery).sort({ scheduledAt: 1, createdAt: -1 }).populate('passenger', 'email phone');

    const withDistance = rides
      .map((ride) => {
        const rideObj = ride.toObject();
        const targetPickup = rideObj.pickupLocation?.lat && rideObj.pickupLocation?.lng ? rideObj.pickupLocation : KARE_COORDS;
        const distance = captainLocation ? haversineKm(captainLocation, targetPickup) : Number.POSITIVE_INFINITY;
        return {
          ...rideObj,
          matchDistanceKm: Number.isFinite(distance) ? Number(distance.toFixed(2)) : null,
          etaToPickupMin: Number.isFinite(distance) ? etaFromDistance(distance) : null
        };
      })
      .filter((ride) => ride.matchDistanceKm === null || ride.matchDistanceKm <= radiusKm)
      .sort((a, b) => {
        if (a.matchDistanceKm === null && b.matchDistanceKm === null) return 0;
        if (a.matchDistanceKm === null) return 1;
        if (b.matchDistanceKm === null) return -1;
        return a.matchDistanceKm - b.matchDistanceKm;
      });

    res.json(withDistance);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. Captain accepts ride
router.patch('/accept/:id', auth, checkRole(['rider']), async (req, res) => {
  try {
    const captainHasActiveRide = await Ride.findOne({
      captain: req.user.id,
      status: { $in: ['accepted', 'arrived', 'in_progress', 'paid'] }
    });
    if (captainHasActiveRide) {
      return res.status(400).json({ message: "Finish your current ride before accepting a new one." });
    }

    const ride = await Ride.findOneAndUpdate(
      {
        _id: req.params.id,
        captain: null,
        passenger: { $ne: req.user.id },
        status: { $in: ['searching', 'scheduled'] }
      },
      {
        status: 'accepted',
        captain: req.user.id,
        acceptedAt: new Date(),
        arrivedAt: null,
        startedAt: null,
        paymentDueAt: null,
        searchExpiresAt: null,
        autoAssigned: false
      },
      { returnDocument: 'after' }
    ).populate('passenger', 'email phone').populate('captain', 'email phone');

    if (!ride) {
      return res.status(400).json({ message: "Ride already taken/unavailable, or you cannot accept your own request." });
    }

    emitRideUpdate(req.app.get('io'), req.app.get('activeUsers'), ride);
    res.json(ride);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/captain/arrived/:id', auth, checkRole(['rider']), async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });
    if (String(ride.captain) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Only assigned captain can mark arrival.' });
    }
    if (ride.status !== 'accepted') {
      return res.status(400).json({ message: 'Ride must be accepted before marking arrived.' });
    }

    ride.status = 'arrived';
    ride.arrivedAt = new Date();
    await ride.save();

    const populatedRide = await Ride.findById(ride._id).populate('passenger', 'email phone').populate('captain', 'email phone');
    emitRideUpdate(req.app.get('io'), req.app.get('activeUsers'), populatedRide);
    res.json(populatedRide);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/captain/start-trip/:id', auth, checkRole(['rider']), async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    if (!ride) return res.status(404).json({ message: 'Ride not found.' });
    if (String(ride.captain) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Only assigned captain can start this trip.' });
    }
    if (!['accepted', 'arrived'].includes(ride.status)) {
      return res.status(400).json({ message: 'Trip can only start after captain acceptance/arrival.' });
    }

    ride.status = 'in_progress';
    ride.startedAt = new Date();
    await ride.save();

    const populatedRide = await Ride.findById(ride._id).populate('passenger', 'email phone').populate('captain', 'email phone');
    emitRideUpdate(req.app.get('io'), req.app.get('activeUsers'), populatedRide);
    res.json(populatedRide);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Passenger pays (Generates OTP)
router.post('/pay/:id', auth, async (req, res) => {
  try {
    const rideDoc = await Ride.findById(req.params.id);
    if (!rideDoc) {
      return res.status(404).json({ message: "Ride not found." });
    }
    if (String(rideDoc.passenger) !== String(req.user.id)) {
      return res.status(403).json({ message: "Only the passenger can pay for this ride." });
    }
    if (!['accepted', 'arrived', 'in_progress'].includes(rideDoc.status) || !rideDoc.captain) {
      return res.status(400).json({ message: "Ride is not ready for payment." });
    }

    if (rideDoc.isPaid || rideDoc.status === 'paid') {
      return res.status(400).json({ message: 'Ride is already paid.' });
    }

    const adminUser = await User.findOne({ roles: 'admin' }).sort({ createdAt: 1 }).select('_id walletBalance');
    if (!adminUser) {
      return res.status(500).json({ message: 'No admin account found for escrow settlement.' });
    }

    const fareAmount = Number(rideDoc.price) || 0;
    const platformFeeAmount = Number((fareAmount * 0.10).toFixed(2));
    const captainPayoutAmount = Number((fareAmount - platformFeeAmount).toFixed(2));

    await User.findByIdAndUpdate(adminUser._id, { $inc: { walletBalance: fareAmount } });

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const ride = await Ride.findByIdAndUpdate(
      req.params.id, 
      {
        status: 'paid',
        isPaid: true,
        completionCode: otp,
        paymentDueAt: null,
        settlement: {
          adminUser: adminUser._id,
          adminEscrowAmount: fareAmount,
          platformFeeAmount,
          captainPayoutAmount,
          adminEscrowCreditedAt: new Date(),
          captainPaidAt: null
        }
      },
      { returnDocument: 'after' }
    ).populate('passenger', 'email phone').populate('captain', 'email phone');
    emitRideUpdate(req.app.get('io'), req.app.get('activeUsers'), ride);
    res.json({ message: "Paid successfully", code: otp, ride });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 6. Captain enters OTP to finish
router.post('/verify-completion', auth, checkRole(['rider']), async (req, res) => {
  try {
    const { rideId, code } = req.body;
    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ message: "Ride not found." });
    }
    if (String(ride.captain) !== String(req.user.id)) {
      return res.status(403).json({ message: "Only assigned captain can complete this ride." });
    }
    if (!['in_progress', 'paid'].includes(ride.status)) {
      return res.status(400).json({ message: "Ride must be in progress to complete." });
    }

    if (ride.completionCode === String(code)) {
      const fallbackPayout = Number(((Number(ride.price) || 0) * 0.90).toFixed(2));
      const captainPayout = Number(ride.settlement?.captainPayoutAmount || fallbackPayout);
      const adminUserId = ride.settlement?.adminUser;

      if (ride.settlement?.captainPaidAt) {
        return res.status(400).json({ message: 'Captain payout already released for this ride.' });
      }

      if (adminUserId) {
        await User.findByIdAndUpdate(adminUserId, { $inc: { walletBalance: -captainPayout } });
      }

      await User.findByIdAndUpdate(req.user.id, { $inc: { walletBalance: captainPayout } });
      
      ride.status = 'completed';
      if (!ride.settlement) {
        ride.settlement = {};
      }
      ride.settlement.captainPayoutAmount = captainPayout;
      ride.settlement.captainPaidAt = new Date();
      await ride.save();
      emitRideUpdate(req.app.get('io'), req.app.get('activeUsers'), ride);
      res.json({
        message: 'Ride Completed! Funds released to captain after platform deduction.',
        settlement: {
          adminUser: ride.settlement?.adminUser || null,
          adminEscrowAmount: ride.settlement?.adminEscrowAmount || Number(ride.price) || 0,
          platformFeeAmount: ride.settlement?.platformFeeAmount || Number(((Number(ride.price) || 0) * 0.10).toFixed(2)),
          captainPayoutAmount: captainPayout,
          captainPaidAt: ride.settlement?.captainPaidAt
        }
      });
    } else {
      res.status(400).json({ message: "Invalid Handover Code." });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. Cancel Ride
router.patch('/cancel/:id', auth, async (req, res) => {
  try {
    const cancellationReason = String(req.body?.reason || '').trim();

    if (!cancellationReason || cancellationReason.length < 3) {
      return res.status(400).json({ message: 'Please provide a cancellation reason (min 3 characters).' });
    }

    const ride = await Ride.findById(req.params.id);
    if (!ride) {
      return res.status(404).json({ message: "Ride not found." });
    }
    if (String(ride.passenger) !== String(req.user.id)) {
      return res.status(403).json({ message: "Only passenger can cancel this ride." });
    }
    if (!['scheduled', 'searching', 'accepted', 'arrived'].includes(ride.status)) {
      return res.status(400).json({ message: "Only scheduled/searching/accepted/arrived rides can be cancelled." });
    }

    ride.status = 'cancelled';
    ride.cancelledAt = new Date();
    ride.cancelledBy = 'passenger';
    ride.cancellationReason = cancellationReason.slice(0, 180);
    await ride.save();
    emitRideUpdate(req.app.get('io'), req.app.get('activeUsers'), ride);
    res.json({ message: "Ride cancelled", ride });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/dispute', auth, async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    const evidenceText = String(req.body?.evidenceText || '').trim();

    if (reason.length < 5) {
      return res.status(400).json({ message: 'Please provide a dispute reason (min 5 characters).' });
    }

    const ride = await Ride.findById(req.params.id);
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    const isPassenger = String(ride.passenger) === String(req.user.id);
    const isCaptain = ride.captain && String(ride.captain) === String(req.user.id);
    if (!isPassenger && !isCaptain) {
      return res.status(403).json({ message: 'Only assigned passenger/captain can raise a dispute.' });
    }

    if (!['paid', 'completed', 'cancelled'].includes(String(ride.status || ''))) {
      return res.status(400).json({ message: 'Dispute can only be raised after payment/completion/cancellation.' });
    }

    if (['open', 'in_review'].includes(String(ride?.dispute?.status || 'none'))) {
      return res.status(400).json({ message: 'An active dispute is already open for this ride.' });
    }

    ride.dispute = {
      status: 'open',
      reason: reason.slice(0, 240),
      evidenceText: evidenceText.slice(0, 500),
      openedByRole: isPassenger ? 'passenger' : 'captain',
      openedByUserId: req.user.id,
      openedAt: new Date(),
      resolution: {
        type: '',
        amount: 0,
        note: '',
        resolvedByUserId: null,
        resolvedByEmail: '',
        resolvedAt: null
      }
    };

    await ride.save();

    const populatedRide = await Ride.findById(ride._id)
      .populate('passenger', 'email phone')
      .populate('captain', 'email phone');

    emitRideUpdate(req.app.get('io'), req.app.get('activeUsers'), populatedRide);
    return res.json({ message: 'Dispute raised successfully.', ride: populatedRide });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/history', auth, async (req, res) => {
  try {
    const role = req.query.role === 'captain' ? 'captain' : 'passenger';
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(20, limitRaw)) : 8;

    const query = {
      [role]: req.user.id,
      status: { $in: ['completed', 'cancelled'] }
    };

    const rides = await Ride.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('passenger', 'email phone')
      .populate('captain', 'email phone');

    return res.json(rides);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/cancellation-analytics', auth, async (req, res) => {
  try {
    const role = req.query.role === 'captain' ? 'captain' : 'passenger';
    const daysRaw = Number(req.query.days);
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, daysRaw)) : 30;

    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const query = {
      [role]: req.user.id,
      status: 'cancelled',
      cancelledAt: { $gte: fromDate }
    };

    const cancelledRides = await Ride.find(query).select('cancellationReason cancelledAt');

    const reasonCountMap = cancelledRides.reduce((acc, ride) => {
      const key = String(ride?.cancellationReason || 'Unspecified').trim() || 'Unspecified';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const reasons = Object.entries(reasonCountMap)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);

    return res.json({
      totalCancelled: cancelledRides.length,
      windowDays: days,
      reasons
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/cancellation-analytics/admin', auth, checkRole(['admin']), async (req, res) => {
  try {
    const daysRaw = Number(req.query.days);
    const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, daysRaw)) : 30;
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const cancelledRides = await Ride.find({
      status: 'cancelled',
      cancelledAt: { $gte: fromDate }
    }).select('cancellationReason cancelledAt cancelledBy');

    const reasonCountMap = cancelledRides.reduce((acc, ride) => {
      const key = String(ride?.cancellationReason || 'Unspecified').trim() || 'Unspecified';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const cancelledByMap = cancelledRides.reduce((acc, ride) => {
      const key = String(ride?.cancelledBy || 'unspecified').trim() || 'unspecified';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const reasons = Object.entries(reasonCountMap)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return res.json({
      totalCancelled: cancelledRides.length,
      windowDays: days,
      reasons,
      cancelledBy: cancelledByMap
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/rate/:id', auth, async (req, res) => {
  try {
    const score = Number(req.body?.score);
    const review = String(req.body?.review || '').trim();

    if (!Number.isFinite(score) || score < 1 || score > 5) {
      return res.status(400).json({ message: 'Rating score must be between 1 and 5.' });
    }

    const ride = await Ride.findById(req.params.id);
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    if (ride.status !== 'completed') {
      return res.status(400).json({ message: 'Only completed rides can be rated.' });
    }

    const isPassenger = String(ride.passenger) === String(req.user.id);
    const isCaptain = String(ride.captain) === String(req.user.id);

    if (!isPassenger && !isCaptain) {
      return res.status(403).json({ message: 'You are not allowed to rate this ride.' });
    }

    const ratingPayload = {
      score,
      review: review.slice(0, 280),
      ratedAt: new Date()
    };

    if (isPassenger) {
      ride.passengerRating = ratingPayload;
    }

    if (isCaptain) {
      ride.captainRating = ratingPayload;
    }

    await ride.save();

    const populated = await Ride.findById(ride._id)
      .populate('passenger', 'email phone')
      .populate('captain', 'email phone');

    return res.json({ message: 'Ride rated successfully.', ride: populated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;