const Ride = require('../models/Ride');
const User = require('../models/User');

const DEFAULT_RADIUS_STEPS = [5, 8, 12, 20];

const toRadians = (value) => (value * Math.PI) / 180;

const haversineKm = (from, to) => {
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return Number.POSITIVE_INFINITY;

  const earthRadiusKm = 6371;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const etaFromDistance = (distanceKm) => {
  const avgSpeedKmPerHour = 22;
  return Math.max(1, Math.round((distanceKm / avgSpeedKmPerHour) * 60));
};

const emitRideUpdate = (io, activeUsers, rideData) => {
  if (!io || !activeUsers || !rideData) return;

  const passengerId = String(rideData.passenger?._id || rideData.passenger || '');
  if (passengerId) {
    const passengerSocket = activeUsers.get(passengerId);
    if (passengerSocket) io.to(passengerSocket).emit('ride_updated', rideData);
  }

  const captainId = String(rideData.captain?._id || rideData.captain || '');
  if (captainId) {
    const captainSocket = activeUsers.get(captainId);
    if (captainSocket) io.to(captainSocket).emit('ride_updated', rideData);
  }
};

const attemptAutoAssignRide = async ({
  rideId,
  io,
  activeUsers,
  radiusSteps = DEFAULT_RADIUS_STEPS
}) => {
  const ride = await Ride.findById(rideId);
  if (!ride) return null;

  if (ride.captain || !['searching', 'scheduled'].includes(ride.status)) {
    return null;
  }

  if (ride.status === 'scheduled' && ride.scheduledAt) {
    const scheduledAt = new Date(ride.scheduledAt);
    const now = new Date();
    const minutesToPickup = (scheduledAt.getTime() - now.getTime()) / (60 * 1000);
    if (minutesToPickup > 30) {
      return null;
    }
  }

  const pickup = ride.pickupLocation;
  if (!pickup?.lat || !pickup?.lng) {
    return null;
  }

  const busyCaptainIds = await Ride.distinct('captain', {
    captain: { $ne: null },
    status: { $in: ['accepted', 'arrived', 'in_progress', 'paid'] }
  });

  const captains = await User.find({
    roles: 'rider',
    'riderStatus.isOnline': true,
    _id: { $ne: ride.passenger, $nin: busyCaptainIds },
    'riderStatus.lastLocation.lat': { $exists: true },
    'riderStatus.lastLocation.lng': { $exists: true }
  }).select('_id riderStatus.lastLocation');

  const rankedCaptains = captains
    .map((captain) => {
      const captainLocation = captain.riderStatus?.lastLocation;
      const distance = haversineKm(captainLocation, pickup);
      return { captainId: captain._id, distance };
    })
    .filter((entry) => Number.isFinite(entry.distance))
    .sort((a, b) => a.distance - b.distance);

  if (rankedCaptains.length === 0) {
    return null;
  }

  for (const radius of radiusSteps) {
    const candidate = rankedCaptains.find((entry) => entry.distance <= radius);
    if (!candidate) continue;

    const acceptedAt = new Date();

    const assigned = await Ride.findOneAndUpdate(
      { _id: ride._id, captain: null, status: { $in: ['searching', 'scheduled'] } },
      {
        status: 'accepted',
        captain: candidate.captainId,
        acceptedAt,
        arrivedAt: null,
        startedAt: null,
        searchExpiresAt: null,
        autoAssigned: true,
        matchedRadiusKm: radius
      },
      { returnDocument: 'after' }
    ).populate('passenger', 'email phone').populate('captain', 'email phone');

    if (assigned) {
      emitRideUpdate(io, activeUsers, assigned);
      return assigned;
    }
  }

  return null;
};

const runRideMaintenance = async ({ io, activeUsers }) => {
  const now = new Date();

  const dueScheduled = await Ride.find({
    status: 'scheduled',
    captain: null,
    scheduledAt: { $lte: new Date(now.getTime() + 30 * 60 * 1000) }
  }).select('_id scheduledAt');

  for (const ride of dueScheduled) {
    const searchExpiresAt = new Date(new Date(ride.scheduledAt).getTime() + 20 * 60 * 1000);
    await Ride.findOneAndUpdate(
      { _id: ride._id, status: 'scheduled', captain: null },
      { status: 'searching', searchExpiresAt }
    );
  }

  const expiredSearching = await Ride.find({
    status: 'searching',
    captain: null,
    searchExpiresAt: { $lte: now }
  }).populate('passenger', 'email phone').populate('captain', 'email phone');

  for (const ride of expiredSearching) {
    ride.status = 'cancelled';
    await ride.save();
    emitRideUpdate(io, activeUsers, ride);
  }
};

module.exports = {
  DEFAULT_RADIUS_STEPS,
  haversineKm,
  etaFromDistance,
  emitRideUpdate,
  attemptAutoAssignRide,
  runRideMaintenance
};
