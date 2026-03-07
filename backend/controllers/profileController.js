const Item = require('../models/Item');
const Ride = require('../models/Ride');
const House = require('../models/House');

exports.getModuleHistory = async (req, res) => {
  const { moduleName } = req.params;
  const userId = req.user.id;

  try {
    let data = {};

    if (moduleName === 'Items') {
      // 1. My Listings (Show who bought it, if sold)
      data.listings = await Item.find({ seller: userId })
        .populate('buyer', 'email'); // Populate buyer info for the seller

      // 2. My Purchases (Show who sold it) --> THIS WAS MISSING
      data.purchases = await Item.find({ buyer: userId })
        .populate('seller', 'email'); 
    } 
    
    else if (moduleName === 'Ride') {
      // Show Captain details to Passenger
      data.asPassenger = await Ride.find({ passenger: userId })
        .populate('captain', 'email');
        
      data.asCaptain = await Ride.find({ captain: userId })
        .populate('passenger', 'email');
    } 
    
    else if (moduleName === 'Home Renting') {
      // Return only houses where this user has a successful unlock payment.
      const paidHouses = await House.find({
        unlockPayments: {
          $elemMatch: {
            user: userId,
            status: 'success'
          }
        }
      }).sort({ createdAt: -1 });

      data.bookings = paidHouses.map((house) => {
        const payments = Array.isArray(house.unlockPayments) ? house.unlockPayments : [];
        const mySuccessfulPayments = payments
          .filter((payment) => String(payment?.user) === String(userId) && payment?.status === 'success')
          .sort((a, b) => new Date(b?.paidAt || 0).getTime() - new Date(a?.paidAt || 0).getTime());

        const latestPayment = mySuccessfulPayments[0] || null;

        return {
          _id: house._id,
          title: house.title,
          description: house.description,
          location: house.location,
          rent: house.rent,
          ownerName: house.ownerName,
          ownerPhone: house.ownerPhone,
          unlockFee: house.unlockFee,
          isAvailable: house.isAvailable,
          paidAmount: Number(latestPayment?.amount || house.unlockFee || 0),
          paymentMethod: latestPayment?.method || 'simulated',
          paymentStatus: latestPayment?.status || 'success',
          paymentRef: latestPayment?.paymentRef || '',
          paidAt: latestPayment?.paidAt || house.updatedAt || house.createdAt,
          myPaymentsCount: mySuccessfulPayments.length,
          createdAt: house.createdAt,
          updatedAt: house.updatedAt
        };
      });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};