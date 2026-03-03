require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http'); // For Socket.io
const { Server } = require('socket.io'); // For Socket.io
const connectDB = require('./config/db');

// --- Import Routes ---
const authRoutes = require('./routes/authRoutes');
const itemRoutes = require('./routes/itemRoutes');
const rideRoutes = require('./routes/rideRoutes');
const houseRoutes = require('./routes/houseRoutes');
const profileRoutes = require('./routes/profileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const app = express();
const server = http.createServer(app);

// 1. Database Connection
connectDB();

// 2. CRITICAL: CORS Configuration for Express API
app.use(cors({
  origin:['http://localhost:5173', 'http://localhost:5174'], // Student & Admin ports
  credentials: true
}));

// 3. Body Parsers (Must be before routes)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 4. Socket.io Setup
const io = new Server(server, {
  cors: { 
    origin:['http://localhost:5173', 'http://localhost:5174'], 
    credentials: true,
    methods:["GET", "POST", "PATCH", "DELETE"] 
  }
});

// Keep track of connected users (UserId -> SocketId)
const activeUsers = new Map();

io.on('connection', (socket) => {
  console.log('🔗 A user connected:', socket.id);

  // When frontend tells us who logged in
  socket.on('register', (userId) => {
    activeUsers.set(userId, socket.id);
    console.log(`👤 User Registered for Notifications: ${userId}`);
  });

  // Relay live location from Captain to Passenger
  socket.on('update_location', (data) => {
    const { lat, lng, passengerId } = data;
    const passengerSocketId = activeUsers.get(passengerId);

    if (passengerSocketId) {
      io.to(passengerSocketId).emit('captain_location_update', { lat, lng });
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

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    activeUsers.forEach((value, key) => {
      if (value === socket.id) activeUsers.delete(key);
    });
  });
});

// Make io and activeUsers accessible inside our API routes!
app.set('io', io);
app.set('activeUsers', activeUsers);

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