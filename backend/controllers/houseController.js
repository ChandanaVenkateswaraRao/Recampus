const House = require('../models/House');
const User = require('../models/User');

const PHONE_REGEX = /^\+?[0-9]{10,15}$/;

const normalizeText = (value) => String(value || '').trim();

const validateCreatePayload = (payload) => {
  const title = normalizeText(payload?.title);
  const description = normalizeText(payload?.description);
  const location = normalizeText(payload?.location);
  const ownerName = normalizeText(payload?.ownerName);
  const ownerPhone = normalizeText(payload?.ownerPhone);
  const rent = Number(payload?.rent);

  if (!title || title.length < 3) return 'Title must be at least 3 characters.';
  if (!description || description.length < 10) return 'Description must be at least 10 characters.';
  if (!location || location.length < 2) return 'Location is required.';
  if (!ownerName || ownerName.length < 2) return 'Owner name is required.';
  if (!PHONE_REGEX.test(ownerPhone)) return 'Owner phone must be 10-15 digits.';
  if (!Number.isFinite(rent) || rent <= 0) return 'Rent must be a positive number.';
  return '';
};

const validateUpdatePayload = (payload) => {
  if (typeof payload?.title === 'string') {
    const title = normalizeText(payload.title);
    if (!title || title.length < 3) return 'Title must be at least 3 characters.';
  }

  if (typeof payload?.description === 'string') {
    const description = normalizeText(payload.description);
    if (!description || description.length < 10) return 'Description must be at least 10 characters.';
  }

  if (typeof payload?.location === 'string') {
    const location = normalizeText(payload.location);
    if (!location || location.length < 2) return 'Location is required.';
  }

  if (typeof payload?.ownerName === 'string') {
    const ownerName = normalizeText(payload.ownerName);
    if (!ownerName || ownerName.length < 2) return 'Owner name is required.';
  }

  if (typeof payload?.ownerPhone === 'string') {
    const ownerPhone = normalizeText(payload.ownerPhone);
    if (!PHONE_REGEX.test(ownerPhone)) return 'Owner phone must be 10-15 digits.';
  }

  if (payload?.rent !== undefined) {
    const rent = Number(payload.rent);
    if (!Number.isFinite(rent) || rent <= 0) return 'Rent must be a positive number.';
  }

  return '';
};

// 1. Admin: Create a House Listing
exports.createHouse = async (req, res) => {
  try {
    const validationMessage = validateCreatePayload(req.body || {});
    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const rawImages = Array.isArray(req.body?.images) ? req.body.images : [];
    const images = rawImages
      .filter((value) => typeof value === 'string' && value.startsWith('data:image/'))
      .slice(0, 3);

    const payload = {
      ...req.body,
      title: normalizeText(req.body?.title),
      description: normalizeText(req.body?.description),
      location: normalizeText(req.body?.location),
      ownerName: normalizeText(req.body?.ownerName),
      ownerPhone: normalizeText(req.body?.ownerPhone),
      rent: Number(req.body?.rent),
      images,
      unlockFee: 50,
      isArchived: false,
      archivedAt: null,
      createdByAdmin: req.user.id
    };
    const newHouse = new House(payload);
    await newHouse.save();
    res.status(201).json({ message: "House listing published by Admin.", newHouse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. Student: Browse All Houses (Phone numbers are masked)
exports.getAllHouses = async (req, res) => {
  try {
    const userId = String(req.user.id);
    const houses = await House.find({ isAvailable: true, isArchived: { $ne: true } }).sort({ createdAt: -1 }).lean();

    const safeHouses = houses.map((house) => {
      const unlockedBy = Array.isArray(house.unlockedBy) ? house.unlockedBy : [];
      const likedBy = Array.isArray(house.likedBy) ? house.likedBy : [];
      const isUnlocked = unlockedBy.some((id) => String(id) === userId);
      const isLiked = likedBy.some((id) => String(id) === userId);

      const responseHouse = {
        ...house,
        isUnlocked,
        isLiked,
        likesCount: likedBy.length,
        unlockFee: Number(house.unlockFee) > 0 ? Number(house.unlockFee) : 50
      };

      if (!isUnlocked) {
        delete responseHouse.ownerPhone;
      }

      return responseHouse;
    });

    res.json(safeHouses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. Student: Simulate payment and unlock owner contact
exports.payForUnlock = async (req, res) => {
  try {
    const house = await House.findById(req.params.id);
    if (!house) return res.status(404).json({ message: "House not found" });

    const unlockFee = Number(house.unlockFee) > 0 ? Number(house.unlockFee) : 50;
    const user = await User.findById(req.user.id).select('walletBalance');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const alreadyUnlocked = house.unlockedBy.some((id) => String(id) === String(req.user.id));
    if (alreadyUnlocked) {
      return res.json({
        message: 'Contact already unlocked for this listing.',
        ownerPhone: house.ownerPhone,
        ownerName: house.ownerName,
        chargedAmount: 0,
        remainingBalance: Number(user.walletBalance || 0)
      });
    }

    if (Number(user.walletBalance || 0) < unlockFee) {
      return res.status(400).json({
        message: `Insufficient wallet balance. Rs.${unlockFee} required to unlock owner contact.`,
        requiredAmount: unlockFee,
        currentBalance: Number(user.walletBalance || 0)
      });
    }

    user.walletBalance = Number(user.walletBalance || 0) - unlockFee;
    house.unlockedBy.push(req.user.id);
    house.unlockPayments.push({
      user: req.user.id,
      amount: unlockFee,
      method: String(req.body?.method || 'simulated'),
      status: 'success',
      paymentRef: `HSE-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
      paidAt: new Date()
    });

    await Promise.all([user.save(), house.save()]);

    res.json({ 
      message: `Payment successful. Rs.${unlockFee} deducted and owner details unlocked.`, 
      ownerPhone: house.ownerPhone, 
      ownerName: house.ownerName,
      chargedAmount: unlockFee,
      remainingBalance: Number(user.walletBalance || 0),
      payment: house.unlockPayments[house.unlockPayments.length - 1] || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Backward compatible aliases for existing frontend call sites
exports.unlockOwnerContact = exports.payForUnlock;
exports.bookHouse = exports.payForUnlock;

// 4. Student: Like or unlike house listing
exports.toggleHouseLike = async (req, res) => {
  try {
    const house = await House.findById(req.params.id);
    if (!house) return res.status(404).json({ message: 'House not found' });

    const userId = String(req.user.id);
    const index = house.likedBy.findIndex((id) => String(id) === userId);
    let isLiked = false;

    if (index >= 0) {
      house.likedBy.splice(index, 1);
      isLiked = false;
    } else {
      house.likedBy.push(req.user.id);
      isLiked = true;
    }

    await house.save();
    return res.json({
      message: isLiked ? 'House liked.' : 'House unliked.',
      isLiked,
      likesCount: house.likedBy.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// 5. Admin: Mark as Rented/Unavailable
exports.toggleAvailability = async (req, res) => {
  try {
    const house = await House.findById(req.params.id);
    if (!house) return res.status(404).json({ message: 'House not found' });
    if (house.isArchived) {
      return res.status(400).json({ message: 'Archived listings cannot be toggled. Restore first.' });
    }
    house.isAvailable = !house.isAvailable;
    await house.save();
    res.json({ message: "Availability status updated.", isAvailable: house.isAvailable });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 6. Admin: List all houses with unlock revenue and owner details
exports.adminListHouses = async (req, res) => {
  try {
    const search = String(req.query.search || '').trim().toLowerCase();
    const statusFilter = String(req.query.status || 'all').trim().toLowerCase();
    const pageRaw = Number(req.query.page);
    const limitRaw = Number(req.query.limit);
    const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
    const limit = Number.isFinite(limitRaw) ? Math.max(5, Math.min(100, limitRaw)) : 10;

    const query = {};
    if (statusFilter === 'archived') {
      query.isArchived = true;
    } else if (statusFilter === 'live') {
      query.isArchived = { $ne: true };
      query.isAvailable = true;
    } else if (statusFilter === 'hidden') {
      query.isArchived = { $ne: true };
      query.isAvailable = false;
    } else {
      query.isArchived = { $in: [true, false] };
    }

    const houses = await House.find(query).sort({ createdAt: -1 }).lean();

    const mapped = houses.map((house) => {
      const successfulPayments = (Array.isArray(house.unlockPayments) ? house.unlockPayments : []).filter(
        (payment) => payment?.status === 'success'
      );

      const revenueGenerated = successfulPayments.reduce((acc, payment) => acc + (Number(payment?.amount) || 0), 0);

      return {
        _id: String(house?._id || ''),
        title: house?.title || '-',
        ownerName: house?.ownerName || '-',
        ownerPhone: house?.ownerPhone || '-',
        location: house?.location || '-',
        rent: Number(house?.rent || 0),
        isAvailable: Boolean(house?.isAvailable),
        isArchived: Boolean(house?.isArchived),
        archivedAt: house?.archivedAt || null,
        likesCount: Array.isArray(house?.likedBy) ? house.likedBy.length : 0,
        unlockCount: successfulPayments.length,
        revenueGenerated: Number(revenueGenerated.toFixed(2)),
        createdAt: house?.createdAt || null
      };
    });

    const filtered = mapped.filter((house) => {
      if (!search) return true;
      const haystack = [house.title, house.ownerName, house.ownerPhone, house.location]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;
    const paged = filtered.slice(skip, skip + limit);

    return res.json({
      total,
      page: safePage,
      limit,
      totalPages,
      houses: paged
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch houses.' });
  }
};

// 7. Admin: Archive house listing (soft delete)
exports.adminDeleteHouse = async (req, res) => {
  try {
    const house = await House.findById(req.params.id);
    if (!house) {
      return res.status(404).json({ message: 'House not found.' });
    }

    house.isArchived = true;
    house.isAvailable = false;
    house.archivedAt = new Date();
    await house.save();
    return res.json({ message: 'House listing archived and removed from website.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to archive house listing.' });
  }
};

// 8. Admin: Restore archived house listing
exports.adminRestoreHouse = async (req, res) => {
  try {
    const house = await House.findById(req.params.id);
    if (!house) {
      return res.status(404).json({ message: 'House not found.' });
    }

    house.isArchived = false;
    house.archivedAt = null;
    house.isAvailable = true;
    await house.save();

    return res.json({ message: 'House listing restored successfully.' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to restore house listing.' });
  }
};

// 9. Admin: Update listing details
exports.adminUpdateHouse = async (req, res) => {
  try {
    const house = await House.findById(req.params.id);
    if (!house) {
      return res.status(404).json({ message: 'House not found.' });
    }

    const validationMessage = validateUpdatePayload(req.body || {});
    if (validationMessage) {
      return res.status(400).json({ message: validationMessage });
    }

    const updates = {};
    const allowedFields = ['title', 'description', 'location', 'ownerName', 'ownerPhone'];
    allowedFields.forEach((field) => {
      if (typeof req.body?.[field] === 'string' && req.body[field].trim()) {
        updates[field] = String(req.body[field]).trim();
      }
    });

    const rent = Number(req.body?.rent);
    if (Number.isFinite(rent) && rent > 0) {
      updates.rent = rent;
    }

    const isAvailable = req.body?.isAvailable;
    if (typeof isAvailable === 'boolean' && !house.isArchived) {
      updates.isAvailable = isAvailable;
    }

    const rawImages = Array.isArray(req.body?.images) ? req.body.images : null;
    if (rawImages) {
      updates.images = rawImages
        .filter((value) => typeof value === 'string' && value.startsWith('data:image/'))
        .slice(0, 3);
    }

    const updated = await House.findByIdAndUpdate(req.params.id, { $set: updates }, { returnDocument: 'after' });
    return res.json({ message: 'House listing updated.', house: updated });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update house listing.' });
  }
};