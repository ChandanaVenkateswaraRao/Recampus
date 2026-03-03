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
      // Properties where I paid the viewing fee
      data.bookings = await House.find({ unlockedBy: userId });
      // Note: House model stores ownerPhone directly, so no populate needed here
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};