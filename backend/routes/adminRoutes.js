const express = require('express');
const router = express.Router();
const { auth, checkRole } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Item = require('../models/Item');
const Ride = require('../models/Ride');
const House = require('../models/House');
const { emitRideUpdate } = require('../utils/rideMatcher');

// GET /api/admin/stats
router.get('/stats', auth, checkRole(['admin']), async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const pendingItems = await Item.countDocuments({ status: 'pending' });
    const activeRides = await Ride.countDocuments({ status: { $ne: 'completed' } });
    
    // Calculate total commission (5% of sold items + 10% of completed rides)
    const soldItems = await Item.find({ status: 'sold' });
    const completedRides = await Ride.find({ status: 'completed' });
    
    const itemCommission = soldItems.reduce((acc, item) => acc + (item.price * 0.05), 0);
    const rideCommission = completedRides.reduce((acc, ride) => acc + (ride.price * 0.10), 0);

    res.json({
      totalUsers,
      pendingItems,
      activeRides,
      totalCommission: itemCommission + rideCommission
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error calculating stats" });
  }
});

// GET /api/admin/houses/unlock-summary
router.get('/houses/unlock-summary', auth, checkRole(['admin']), async (req, res) => {
  try {
    const daysRaw = Number(req.query.days);
    const windowDays = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, daysRaw)) : 30;
    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    const houses = await House.find({
      unlockPayments: {
        $elemMatch: {
          status: 'success',
          paidAt: { $gte: cutoff }
        }
      }
    })
      .select('title ownerName location unlockFee unlockPayments likedBy unlockedBy createdAt')
      .lean();

    let totalUnlocks = 0;
    let totalRevenue = 0;
    const methodCounts = { upi: 0, card: 0, netbanking: 0, simulated: 0 };
    const listingSummary = [];
    const recentPayments = [];

    houses.forEach((house) => {
      const successfulPayments = (Array.isArray(house.unlockPayments) ? house.unlockPayments : []).filter((payment) => {
        const paidAt = payment?.paidAt ? new Date(payment.paidAt) : null;
        return payment?.status === 'success' && paidAt && !Number.isNaN(paidAt.getTime()) && paidAt >= cutoff;
      });

      if (!successfulPayments.length) return;

      const listingUnlocks = successfulPayments.length;
      const listingRevenue = successfulPayments.reduce((acc, payment) => acc + (Number(payment?.amount) || 0), 0);

      totalUnlocks += listingUnlocks;
      totalRevenue += listingRevenue;

      successfulPayments.forEach((payment) => {
        const method = String(payment?.method || 'simulated');
        if (Object.prototype.hasOwnProperty.call(methodCounts, method)) {
          methodCounts[method] += 1;
        } else {
          methodCounts.simulated += 1;
        }

        recentPayments.push({
          houseId: String(house?._id || ''),
          title: house?.title || 'House Listing',
          amount: Number(payment?.amount || 0),
          method,
          paymentRef: payment?.paymentRef || '-',
          paidAt: payment?.paidAt || null
        });
      });

      listingSummary.push({
        houseId: String(house?._id || ''),
        title: house?.title || 'House Listing',
        ownerName: house?.ownerName || '-',
        location: house?.location || '-',
        unlockFee: Number(house?.unlockFee || 50),
        likesCount: Array.isArray(house?.likedBy) ? house.likedBy.length : 0,
        unlockedUsers: Array.isArray(house?.unlockedBy) ? house.unlockedBy.length : 0,
        unlocksInWindow: listingUnlocks,
        revenueInWindow: Number(listingRevenue.toFixed(2))
      });
    });

    listingSummary.sort((a, b) => b.revenueInWindow - a.revenueInWindow);
    recentPayments.sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());

    return res.json({
      windowDays,
      totalUnlocks,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      avgRevenuePerUnlock: totalUnlocks > 0 ? Number((totalRevenue / totalUnlocks).toFixed(2)) : 0,
      methodCounts,
      listings: listingSummary.slice(0, 20),
      recentPayments: recentPayments.slice(0, 25)
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch house unlock summary.' });
  }
});

// GET /api/admin/rides/settlement-summary
router.get('/rides/settlement-summary', auth, checkRole(['admin']), async (req, res) => {
  try {
    const daysRaw = Number(req.query.days);
    const windowDays = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, daysRaw)) : 30;
    const now = Date.now();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const fromDate = new Date(now - windowMs);
    const previousFromDate = new Date(now - windowMs * 2);

    const rides = await Ride.find({
      $or: [
        { isPaid: true },
        { status: { $in: ['paid', 'completed'] } },
        { 'settlement.adminEscrowCreditedAt': { $ne: null } },
        { 'settlement.captainPaidAt': { $ne: null } }
      ]
    }).select('status isPaid price settlement createdAt updatedAt');

    const emptySummary = {
      totalEscrowCredited: 0,
      totalCaptainPayoutReleased: 0,
      totalPlatformFeeRetained: 0,
      pendingPayoutLiability: 0,
      adminEscrowOnHand: 0,
      paidRidesCount: 0,
      payoutReleasedRidesCount: 0,
      pendingPayoutRidesCount: 0
    };

    const summarize = (sourceRides) => sourceRides.reduce((acc, ride) => {
      const fareAmountRaw = Number(ride?.settlement?.adminEscrowAmount);
      const fareAmount = Number.isFinite(fareAmountRaw) ? fareAmountRaw : (Number(ride?.price) || 0);
      if (fareAmount <= 0) return acc;

      const feeAmountRaw = Number(ride?.settlement?.platformFeeAmount);
      const fallbackFee = Number((fareAmount * 0.10).toFixed(2));
      const feeAmount = Number.isFinite(feeAmountRaw) ? feeAmountRaw : fallbackFee;

      const payoutAmountRaw = Number(ride?.settlement?.captainPayoutAmount);
      const fallbackPayout = Number((fareAmount - feeAmount).toFixed(2));
      const payoutAmount = Number.isFinite(payoutAmountRaw) ? payoutAmountRaw : fallbackPayout;

      const hasEscrowCredit = Boolean(ride?.settlement?.adminEscrowCreditedAt || ride?.isPaid || ['paid', 'completed'].includes(String(ride?.status || '')));
      const hasPayoutRelease = Boolean(ride?.settlement?.captainPaidAt);

      if (hasEscrowCredit) {
        acc.totalEscrowCredited += fareAmount;
        acc.paidRidesCount += 1;
      }

      if (hasPayoutRelease) {
        acc.totalCaptainPayoutReleased += payoutAmount;
        acc.payoutReleasedRidesCount += 1;
      } else if (hasEscrowCredit) {
        acc.pendingPayoutLiability += payoutAmount;
        acc.pendingPayoutRidesCount += 1;
      }

      return acc;
    }, { ...emptySummary });

    const finalizeSummary = (summary) => {
      const finalized = { ...summary };
      finalized.totalPlatformFeeRetained = Number((finalized.totalEscrowCredited - finalized.totalCaptainPayoutReleased).toFixed(2));
      finalized.adminEscrowOnHand = Number((finalized.totalEscrowCredited - finalized.totalCaptainPayoutReleased).toFixed(2));
      finalized.totalEscrowCredited = Number(finalized.totalEscrowCredited.toFixed(2));
      finalized.totalCaptainPayoutReleased = Number(finalized.totalCaptainPayoutReleased.toFixed(2));
      finalized.pendingPayoutLiability = Number(finalized.pendingPayoutLiability.toFixed(2));
      return finalized;
    };

    const buildTrend = (currentValue, previousValue) => {
      const current = Number(currentValue) || 0;
      const previous = Number(previousValue) || 0;
      const delta = Number((current - previous).toFixed(2));
      const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
      const percent = previous > 0
        ? Number((((Math.abs(delta)) / previous) * 100).toFixed(1))
        : null;

      return {
        current,
        previous,
        delta,
        direction,
        percent
      };
    };

    const lifetime = finalizeSummary(summarize(rides));

    const windowRides = rides.filter((ride) => {
      const referenceDate =
        ride?.settlement?.adminEscrowCreditedAt ||
        ride?.settlement?.captainPaidAt ||
        ride?.updatedAt ||
        ride?.createdAt;
      if (!referenceDate) return false;
      const parsed = new Date(referenceDate);
      if (Number.isNaN(parsed.getTime())) return false;
      return parsed >= fromDate;
    });

    const windowSummary = finalizeSummary(summarize(windowRides));

    const previousWindowRides = rides.filter((ride) => {
      const referenceDate =
        ride?.settlement?.adminEscrowCreditedAt ||
        ride?.settlement?.captainPaidAt ||
        ride?.updatedAt ||
        ride?.createdAt;
      if (!referenceDate) return false;
      const parsed = new Date(referenceDate);
      if (Number.isNaN(parsed.getTime())) return false;
      return parsed >= previousFromDate && parsed < fromDate;
    });
    const previousWindowSummary = finalizeSummary(summarize(previousWindowRides));

    const trends = {
      escrowCredited: buildTrend(windowSummary.totalEscrowCredited, previousWindowSummary.totalEscrowCredited),
      payoutReleased: buildTrend(windowSummary.totalCaptainPayoutReleased, previousWindowSummary.totalCaptainPayoutReleased),
      platformFeeRetained: buildTrend(windowSummary.totalPlatformFeeRetained, previousWindowSummary.totalPlatformFeeRetained),
      pendingPayoutLiability: buildTrend(windowSummary.pendingPayoutLiability, previousWindowSummary.pendingPayoutLiability)
    };

    return res.json({
      windowDays,
      asOf: new Date().toISOString(),
      lifetime,
      window: windowSummary,
      previousWindow: previousWindowSummary,
      trends
    });
  } catch (_) {
    return res.status(500).json({ message: 'Failed to fetch ride settlement summary.' });
  }
});

// GET /api/admin/rides/monitor
router.get('/rides/monitor', auth, checkRole(['admin']), async (req, res) => {
  try {
    const statusFilter = String(req.query.status || 'active').trim();
    const search = String(req.query.search || '').trim();
    const criticalOnly = String(req.query.criticalOnly || 'false').trim().toLowerCase() === 'true';
    const pageRaw = Number(req.query.page);
    const limitRaw = Number(req.query.limit);
    const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
    const limit = Number.isFinite(limitRaw) ? Math.max(5, Math.min(100, limitRaw)) : 20;
    const skip = (page - 1) * limit;

    const activeStatuses = ['scheduled', 'searching', 'accepted', 'arrived', 'in_progress', 'paid'];
    const now = Date.now();
    const staleAcceptCutoff = new Date(now - 20 * 60 * 1000);
    const longTripCutoff = new Date(now - 45 * 60 * 1000);
    const delayedCompleteCutoff = new Date(now - 15 * 60 * 1000);

    const query = {};
    if (statusFilter === 'active') {
      query.status = { $in: activeStatuses };
    } else if (statusFilter !== 'all') {
      query.status = statusFilter;
    }

    const rides = await Ride.find(query)
      .populate('passenger', 'email phone')
      .populate('captain', 'email phone')
      .sort({ updatedAt: -1 })
      .lean();

    const filteredRides = rides.filter((ride) => {
      if (!search) return true;
      const searchable = [
        ride.route,
        ride.status,
        ride.passenger?.email,
        ride.passenger?.phone,
        ride.captain?.email,
        ride.captain?.phone,
        ride.pickupLocation?.address,
        ride.dropLocation?.address
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(search.toLowerCase());
    });

    const withFlags = filteredRides.map((ride) => {
      const flags = [];
      if (['accepted', 'arrived'].includes(ride.status) && ride.acceptedAt && ride.acceptedAt < staleAcceptCutoff) {
        flags.push('Delayed Pickup');
      }
      if (ride.status === 'in_progress' && ride.startedAt && ride.startedAt < longTripCutoff) {
        flags.push('Long Trip');
      }
      if (ride.status === 'paid' && ride.updatedAt && ride.updatedAt < delayedCompleteCutoff) {
        flags.push('Completion Delayed');
      }
      if (ride.status === 'searching' && ride.searchExpiresAt && ride.searchExpiresAt < new Date()) {
        flags.push('Search Expired');
      }

      return { ...ride, healthFlags: flags };
    });

    const criticalFiltered = criticalOnly
      ? withFlags.filter((ride) => Array.isArray(ride.healthFlags) && ride.healthFlags.length > 0)
      : withFlags;

    const total = criticalFiltered.length;
    const pagedRides = criticalFiltered.slice(skip, skip + limit);

    const statusCounts = criticalFiltered.reduce((acc, ride) => {
      acc[ride.status] = (acc[ride.status] || 0) + 1;
      return acc;
    }, {});

    const summary = {
      total,
      active: criticalFiltered.filter((ride) => activeStatuses.includes(ride.status)).length,
      delayedPickup: criticalFiltered.filter((ride) => ride.healthFlags.includes('Delayed Pickup')).length,
      longTrips: criticalFiltered.filter((ride) => ride.healthFlags.includes('Long Trip')).length,
      delayedCompletion: criticalFiltered.filter((ride) => ride.healthFlags.includes('Completion Delayed')).length,
      statusCounts
    };

    return res.json({
      summary,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      rides: pagedRides
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch ride monitor data.' });
  }
});

// GET /api/admin/rides/disputes
router.get('/rides/disputes', auth, checkRole(['admin']), async (req, res) => {
  try {
    const statusFilter = String(req.query.status || 'open').trim();
    const search = String(req.query.search || '').trim().toLowerCase();
    const pageRaw = Number(req.query.page);
    const limitRaw = Number(req.query.limit);
    const page = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
    const limit = Number.isFinite(limitRaw) ? Math.max(5, Math.min(100, limitRaw)) : 20;
    const skip = (page - 1) * limit;

    const query = { 'dispute.status': { $ne: 'none' } };
    if (statusFilter === 'open') {
      query['dispute.status'] = { $in: ['open', 'in_review'] };
    } else if (statusFilter !== 'all') {
      query['dispute.status'] = statusFilter;
    }

    const rides = await Ride.find(query)
      .populate('passenger', 'email phone')
      .populate('captain', 'email phone')
      .populate('dispute.openedByUserId', 'email')
      .sort({ 'dispute.openedAt': -1, updatedAt: -1 })
      .lean();

    const filtered = rides.filter((ride) => {
      if (!search) return true;
      const haystack = [
        ride?.route,
        ride?.status,
        ride?.passenger?.email,
        ride?.captain?.email,
        ride?.dispute?.reason,
        ride?.dispute?.status,
        ride?.dispute?.openedByRole,
        ride?.dispute?.openedByUserId?.email
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });

    const total = filtered.length;
    const pagedDisputes = filtered.slice(skip, skip + limit);

    return res.json({
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      status: statusFilter,
      disputes: pagedDisputes
    });
  } catch (_) {
    return res.status(500).json({ message: 'Failed to fetch ride disputes.' });
  }
});

router.patch('/rides/:id/dispute/resolve', auth, checkRole(['admin']), async (req, res) => {
  try {
    const resolutionType = String(req.body?.resolutionType || '').trim();
    const note = String(req.body?.note || '').trim();
    const amountRaw = Number(req.body?.amount);

    const allowedResolutionTypes = [
      'refund_passenger_full',
      'refund_passenger_partial',
      'release_captain_full',
      'release_captain_partial',
      'reject_dispute'
    ];

    if (!allowedResolutionTypes.includes(resolutionType)) {
      return res.status(400).json({ message: 'Invalid resolutionType.' });
    }

    const ride = await Ride.findById(req.params.id);
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    const disputeStatus = String(ride?.dispute?.status || 'none');
    if (!['open', 'in_review'].includes(disputeStatus)) {
      return res.status(400).json({ message: 'Only open disputes can be resolved.' });
    }

    const adminUser = await User.findById(req.user.id).select('email');
    const rideFare = Number(ride?.settlement?.adminEscrowAmount || ride?.price || 0);
    if (rideFare <= 0) {
      return res.status(400).json({ message: 'Ride fare unavailable for dispute settlement.' });
    }

    let adjustmentAmount = 0;
    if (resolutionType === 'refund_passenger_full' || resolutionType === 'release_captain_full') {
      adjustmentAmount = rideFare;
    } else if (resolutionType === 'refund_passenger_partial' || resolutionType === 'release_captain_partial') {
      if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
        return res.status(400).json({ message: 'A valid positive amount is required for partial settlement.' });
      }
      adjustmentAmount = Number(Math.min(rideFare, amountRaw).toFixed(2));
    }

    if (resolutionType.startsWith('refund_passenger')) {
      if (!ride.passenger) {
        return res.status(400).json({ message: 'Passenger not available for refund.' });
      }
      await User.findByIdAndUpdate(ride.passenger, { $inc: { walletBalance: adjustmentAmount } });
      const adminUserId = ride?.settlement?.adminUser;
      if (adminUserId) {
        await User.findByIdAndUpdate(adminUserId, { $inc: { walletBalance: -adjustmentAmount } });
      }
    }

    if (resolutionType.startsWith('release_captain')) {
      if (!ride.captain) {
        return res.status(400).json({ message: 'Captain not available for payout release.' });
      }
      await User.findByIdAndUpdate(ride.captain, { $inc: { walletBalance: adjustmentAmount } });
      const adminUserId = ride?.settlement?.adminUser;
      if (adminUserId) {
        await User.findByIdAndUpdate(adminUserId, { $inc: { walletBalance: -adjustmentAmount } });
      }
    }

    ride.dispute = {
      ...(ride.dispute || {}),
      status: resolutionType === 'reject_dispute' ? 'rejected' : 'resolved',
      resolution: {
        type: resolutionType,
        amount: adjustmentAmount,
        note: note.slice(0, 240),
        resolvedByUserId: req.user.id,
        resolvedByEmail: adminUser?.email || 'admin',
        resolvedAt: new Date()
      }
    };

    if (resolutionType !== 'reject_dispute') {
      ride.settlementAdjustments = [
        ...(Array.isArray(ride.settlementAdjustments) ? ride.settlementAdjustments : []),
        {
          type: resolutionType,
          amount: adjustmentAmount,
          note: note.slice(0, 240),
          byUserId: req.user.id,
          byEmail: adminUser?.email || 'admin',
          at: new Date()
        }
      ];
    }

    ride.adminActions = [
      ...(Array.isArray(ride.adminActions) ? ride.adminActions : []),
      {
        action: 'dispute_resolve',
        note: `${resolutionType}${adjustmentAmount > 0 ? ` (${adjustmentAmount})` : ''}${note ? `: ${note}` : ''}`.slice(0, 220),
        byUserId: req.user.id,
        byEmail: adminUser?.email || 'admin',
        at: new Date()
      }
    ];

    await ride.save();

    const updatedRide = await Ride.findById(ride._id)
      .populate('passenger', 'email phone')
      .populate('captain', 'email phone')
      .populate('dispute.openedByUserId', 'email');

    emitRideUpdate(req.app.get('io'), req.app.get('activeUsers'), updatedRide);
    return res.json({
      message: 'Dispute resolution applied successfully.',
      ride: updatedRide
    });
  } catch (_) {
    return res.status(500).json({ message: 'Failed to resolve dispute.' });
  }
});

router.patch('/rides/:id/force-cancel', auth, checkRole(['admin']), async (req, res) => {
  try {
    const reasonText = String(req.body?.reason || 'Cancelled by admin').trim();
    const ride = await Ride.findById(req.params.id);
    const adminUser = await User.findById(req.user.id).select('email');

    if (!ride) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    if (['completed', 'cancelled'].includes(ride.status)) {
      return res.status(400).json({ message: 'Only active rides can be force-cancelled.' });
    }

    ride.status = 'cancelled';
    ride.cancelledAt = new Date();
    ride.cancelledBy = 'system';
    ride.cancellationReason = reasonText.slice(0, 180);
    ride.searchExpiresAt = null;
    ride.adminActions = [
      ...(Array.isArray(ride.adminActions) ? ride.adminActions : []),
      {
        action: 'force_cancel',
        note: reasonText.slice(0, 220),
        byUserId: req.user.id,
        byEmail: adminUser?.email || 'admin',
        at: new Date()
      }
    ];
    await ride.save();

    const updatedRide = await Ride.findById(ride._id)
      .populate('passenger', 'email phone')
      .populate('captain', 'email phone');

    emitRideUpdate(req.app.get('io'), req.app.get('activeUsers'), updatedRide);
    return res.json({ message: 'Ride force-cancelled successfully.', ride: updatedRide });
  } catch (_) {
    return res.status(500).json({ message: 'Failed to force-cancel ride.' });
  }
});

router.patch('/rides/:id/requeue', auth, checkRole(['admin']), async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.id);
    const adminUser = await User.findById(req.user.id).select('email');
    if (!ride) {
      return res.status(404).json({ message: 'Ride not found.' });
    }

    if (!['accepted', 'arrived'].includes(ride.status)) {
      return res.status(400).json({ message: 'Only accepted/arrived rides can be requeued.' });
    }

    ride.status = 'searching';
    ride.captain = null;
    ride.acceptedAt = null;
    ride.arrivedAt = null;
    ride.startedAt = null;
    ride.paymentDueAt = null;
    ride.autoAssigned = false;
    ride.matchedRadiusKm = null;
    ride.searchExpiresAt = new Date(Date.now() + 6 * 60 * 1000);
    ride.adminActions = [
      ...(Array.isArray(ride.adminActions) ? ride.adminActions : []),
      {
        action: 'requeue',
        note: 'Ride moved back to searching queue by admin.',
        byUserId: req.user.id,
        byEmail: adminUser?.email || 'admin',
        at: new Date()
      }
    ];
    await ride.save();

    const updatedRide = await Ride.findById(ride._id)
      .populate('passenger', 'email phone')
      .populate('captain', 'email phone');

    emitRideUpdate(req.app.get('io'), req.app.get('activeUsers'), updatedRide);
    return res.json({ message: 'Ride moved back to searching queue.', ride: updatedRide });
  } catch (_) {
    return res.status(500).json({ message: 'Failed to requeue ride.' });
  }
});

router.patch('/rides/bulk/force-cancel', auth, checkRole(['admin']), async (req, res) => {
  try {
    const inputRideIds = Array.isArray(req.body?.rideIds)
      ? req.body.rideIds.map((id) => String(id)).filter(Boolean)
      : [];
    const reasonText = String(req.body?.reason || 'Bulk cancelled by admin').trim();
    const rideIds = [...new Set(inputRideIds)];

    if (rideIds.length === 0) {
      return res.status(400).json({ message: 'rideIds must be a non-empty array.' });
    }

    const adminUser = await User.findById(req.user.id).select('email');
    const activeStatuses = ['scheduled', 'searching', 'accepted', 'arrived', 'in_progress', 'paid'];
    const validObjectIdRegex = /^[a-fA-F0-9]{24}$/;

    const skipped = [];
    const validRideIds = [];
    for (const rideId of rideIds) {
      if (!validObjectIdRegex.test(rideId)) {
        skipped.push({ rideId, reason: 'invalid_id' });
      } else {
        validRideIds.push(rideId);
      }
    }

    const existingRides = validRideIds.length > 0
      ? await Ride.find({ _id: { $in: validRideIds } }).select('_id status')
      : [];
    const rideStatusById = new Map(existingRides.map((ride) => [String(ride._id), ride.status]));

    const eligibleIds = [];
    for (const rideId of validRideIds) {
      const currentStatus = rideStatusById.get(rideId);
      if (!currentStatus) {
        skipped.push({ rideId, reason: 'not_found' });
      } else if (!activeStatuses.includes(currentStatus)) {
        skipped.push({ rideId, reason: `ineligible_status:${currentStatus}` });
      } else {
        eligibleIds.push(rideId);
      }
    }

    const rides = await Ride.find({ _id: { $in: eligibleIds }, status: { $in: activeStatuses } });
    let cancelledCount = 0;
    const processedRideIds = [];

    for (const ride of rides) {
      ride.status = 'cancelled';
      ride.cancelledAt = new Date();
      ride.cancelledBy = 'system';
      ride.cancellationReason = reasonText.slice(0, 180);
      ride.searchExpiresAt = null;
      ride.adminActions = [
        ...(Array.isArray(ride.adminActions) ? ride.adminActions : []),
        {
          action: 'force_cancel',
          note: `Bulk action: ${reasonText}`.slice(0, 220),
          byUserId: req.user.id,
          byEmail: adminUser?.email || 'admin',
          at: new Date()
        }
      ];
      await ride.save();

      const populatedRide = await Ride.findById(ride._id)
        .populate('passenger', 'email phone')
        .populate('captain', 'email phone');
      emitRideUpdate(req.app.get('io'), req.app.get('activeUsers'), populatedRide);
      cancelledCount += 1;
      processedRideIds.push(String(ride._id));
    }

    return res.json({
      message: `Bulk force-cancel completed for ${cancelledCount} ride(s).`,
      cancelledCount,
      requestedCount: rideIds.length,
      skippedCount: skipped.length,
      processedRideIds,
      skipped
    });
  } catch (_) {
    return res.status(500).json({ message: 'Failed to run bulk force-cancel.' });
  }
});

router.patch('/rides/bulk/requeue', auth, checkRole(['admin']), async (req, res) => {
  try {
    const inputRideIds = Array.isArray(req.body?.rideIds)
      ? req.body.rideIds.map((id) => String(id)).filter(Boolean)
      : [];
    const noteText = String(req.body?.note || 'Bulk requeue by admin').trim();
    const rideIds = [...new Set(inputRideIds)];

    if (rideIds.length === 0) {
      return res.status(400).json({ message: 'rideIds must be a non-empty array.' });
    }

    const adminUser = await User.findById(req.user.id).select('email');
    const requeueStatuses = ['accepted', 'arrived'];
    const validObjectIdRegex = /^[a-fA-F0-9]{24}$/;

    const skipped = [];
    const validRideIds = [];
    for (const rideId of rideIds) {
      if (!validObjectIdRegex.test(rideId)) {
        skipped.push({ rideId, reason: 'invalid_id' });
      } else {
        validRideIds.push(rideId);
      }
    }

    const existingRides = validRideIds.length > 0
      ? await Ride.find({ _id: { $in: validRideIds } }).select('_id status')
      : [];
    const rideStatusById = new Map(existingRides.map((ride) => [String(ride._id), ride.status]));

    const eligibleIds = [];
    for (const rideId of validRideIds) {
      const currentStatus = rideStatusById.get(rideId);
      if (!currentStatus) {
        skipped.push({ rideId, reason: 'not_found' });
      } else if (!requeueStatuses.includes(currentStatus)) {
        skipped.push({ rideId, reason: `ineligible_status:${currentStatus}` });
      } else {
        eligibleIds.push(rideId);
      }
    }

    const rides = await Ride.find({ _id: { $in: eligibleIds }, status: { $in: requeueStatuses } });
    let requeuedCount = 0;
    const processedRideIds = [];

    for (const ride of rides) {
      ride.status = 'searching';
      ride.captain = null;
      ride.acceptedAt = null;
      ride.arrivedAt = null;
      ride.startedAt = null;
      ride.paymentDueAt = null;
      ride.autoAssigned = false;
      ride.matchedRadiusKm = null;
      ride.searchExpiresAt = new Date(Date.now() + 6 * 60 * 1000);
      ride.adminActions = [
        ...(Array.isArray(ride.adminActions) ? ride.adminActions : []),
        {
          action: 'requeue',
          note: `Bulk action: ${noteText}`.slice(0, 220),
          byUserId: req.user.id,
          byEmail: adminUser?.email || 'admin',
          at: new Date()
        }
      ];
      await ride.save();

      const populatedRide = await Ride.findById(ride._id)
        .populate('passenger', 'email phone')
        .populate('captain', 'email phone');
      emitRideUpdate(req.app.get('io'), req.app.get('activeUsers'), populatedRide);
      requeuedCount += 1;
      processedRideIds.push(String(ride._id));
    }

    return res.json({
      message: `Bulk requeue completed for ${requeuedCount} ride(s).`,
      requeuedCount,
      requestedCount: rideIds.length,
      skippedCount: skipped.length,
      processedRideIds,
      skipped
    });
  } catch (_) {
    return res.status(500).json({ message: 'Failed to run bulk requeue.' });
  }
});

module.exports = router;