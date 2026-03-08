require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http'); // For Socket.io
const { Server } = require('socket.io'); // For Socket.io
const connectDB = require('./config/db');
const Ride = require('./models/Ride');
const { runRideMaintenance } = require('./utils/rideMatcher');

const toRadians = (value) => (value * Math.PI) / 180;
const haversineKm = (from, to) => {
  if (!from?.lat || !from?.lng || !to?.lat || !to?.lng) return null;

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

// --- Import Routes ---
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const rideRoutes = require('./routes/rideRoutes');
const houseRoutes = require('./routes/houseRoutes');
const profileRoutes = require('./routes/profileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const app = express();
const server = http.createServer(app);
const parseEnvOrigins = () => {
  const raw = process.env.CORS_ORIGINS || '';
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};

const isLocalDevOrigin = (origin) => {
  // Accept localhost / 127.0.0.1 and private LAN IPs used by Expo web dev servers.
  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/i.test(origin);
};

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  "https://vermillion-pithivier-2f7870.netlify.app",
  ...parseEnvOrigins(),
]);

const corsOriginValidator = (origin, callback) => {
  if (!origin) return callback(null, true);

  if (allowedOrigins.has(origin) || isLocalDevOrigin(origin)) {
    return callback(null, true);
  }

  return callback(new Error(`Not allowed by CORS: ${origin}`));
};

// 1. Database Connection
connectDB();

// 2. CRITICAL: CORS Configuration for Express API
app.use(cors({
  origin: corsOriginValidator,
  credentials: true
}));
app.options(/.*/, cors({ origin: corsOriginValidator, credentials: true }));

// 3. Body Parsers (Must be before routes)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 4. Socket.io Setup
const io = new Server(server, {
  cors: { 
    origin: corsOriginValidator,
    credentials: true,
    methods:["GET", "POST", "PATCH", "DELETE"] 
  }
});

// Keep track of connected users (UserId -> SocketId)
const activeUsers = new Map();

io.engine.on('connection_error', (err) => {
  console.error('⚠️ Socket connection error:', {
    code: err.code,
    message: err.message,
    context: err.context
  });
});

io.on('connection', (socket) => {
  console.log('🔗 A user connected:', socket.id);

  socket.on('error', (err) => {
    console.error(`⚠️ Socket error on ${socket.id}:`, err?.message || err);
  });

  // When frontend tells us who logged in
  socket.on('register', (userId) => {
    activeUsers.set(userId, socket.id);
    console.log(`👤 User Registered for Notifications: ${userId}`);
  });

  // Relay live location from Captain to Passenger
  socket.on('update_location', async (data) => {
    const { lat, lng, passengerId, rideId } = data;
    const passengerSocketId = activeUsers.get(passengerId);

    if (passengerSocketId) {
      let etaMin = null;

      if (rideId) {
        const ride = await Ride.findById(rideId).select('status pickupLocation dropLocation');
        if (ride) {
          const target = ['accepted', 'arrived'].includes(ride.status) ? ride.pickupLocation : ride.dropLocation;
          const remainingDistanceKm = haversineKm({ lat, lng }, target);
          etaMin = remainingDistanceKm !== null ? etaFromDistance(remainingDistanceKm) : null;
        }
      }

      io.to(passengerSocketId).emit('captain_location_update', { lat, lng, etaMin });
    }
  });

  // --- NEW: MISSING RIDE STATUS UPDATE RELAY ---
  socket.on('notify_ride_update', (rideData) => {
    console.log(`🔄 Ride Status Updated: ${rideData._id} -> ${rideData.status}`);
    
    // 1. Tell passenger their ride updated
    const passengerId = rideData.passenger?._id || rideData.passenger;
    const passengerSocket = activeUsers.get(passengerId);
    if (passengerSocket) io.to(passengerSocket).emit('ride_updated', rideData);
    
    // 2. Tell captain their ride updated
    const captainId = rideData.captain?._id || rideData.captain;
    if (captainId) {
      const captainSocket = activeUsers.get(captainId);
      if (captainSocket) io.to(captainSocket).emit('ride_updated', rideData);
    }
  });
  // ----------------------------------------------

  socket.on('disconnect', (reason) => {
    console.log(`❌ User disconnected: ${socket.id} | reason: ${reason}`);
    activeUsers.forEach((value, key) => {
      if (value === socket.id) activeUsers.delete(key);
    });
  });
});

// Make io and activeUsers accessible inside our API routes!
app.set('io', io);
app.set('activeUsers', activeUsers);

setInterval(async () => {
  try {
    await runRideMaintenance({ io, activeUsers });
  } catch (err) {
    console.error('Ride maintenance error:', err.message);
  }
}, 45 * 1000);

// 5. Register API Routes
app.get('/', (req, res) => res.send('Recampus API & Socket Server is running...'));
app.use('/api/auth', authRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/houses', houseRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);

// 6. Start the Server
const PORT = process.env.PORT || 5000;

// VERY IMPORTANT: Use server.listen, NOT app.listen
server.listen(PORT, () => {
  console.log(`🚀 Server & Socket.io started on port ${PORT}`);
});