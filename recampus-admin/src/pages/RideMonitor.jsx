import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bike, Clock3, RefreshCcw, Search } from 'lucide-react';
import { bulkForceCancelRides, bulkRequeueRides, fetchRideDisputes, fetchRideMonitorData, fetchRideSettlementSummary, forceCancelRide, requeueRide, resolveRideDispute } from '../api/adminApi';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'searching', label: 'Searching' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'arrived', label: 'Arrived' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'paid', label: 'Paid' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

const DISPUTE_STATUS_OPTIONS = [
  { value: 'open', label: 'Open/Review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' }
];

const COPY_FORMAT_STORAGE_KEY = 'recampus_admin_copy_ids_format';
const SKIP_SORT_STORAGE_KEY = 'recampus_admin_skip_sort_mode';
const SKIP_PAGE_SIZE_STORAGE_KEY = 'recampus_admin_skip_page_size';
const CRITICAL_ONLY_STORAGE_KEY = 'recampus_admin_critical_only';
const AUTO_REFRESH_SECONDS_STORAGE_KEY = 'recampus_admin_auto_refresh_seconds';
const AUTO_REFRESH_PAUSED_STORAGE_KEY = 'recampus_admin_auto_refresh_paused';
const FINANCE_WINDOW_DAYS_STORAGE_KEY = 'recampus_admin_finance_window_days';
const DISPUTE_PAGE_STORAGE_KEY = 'recampus_admin_dispute_page';
const STATUS_FILTER_STORAGE_KEY = 'recampus_admin_status_filter';
const SEARCH_QUERY_STORAGE_KEY = 'recampus_admin_search_query';
const MONITOR_PAGE_STORAGE_KEY = 'recampus_admin_monitor_page';
const ACTION_HISTORY_RIDE_ID_STORAGE_KEY = 'recampus_admin_action_history_ride_id';
const SKIPPED_REASON_FILTER_STORAGE_KEY = 'recampus_admin_skipped_reason_filter';
const SKIPPED_SEARCH_TEXT_STORAGE_KEY = 'recampus_admin_skipped_search_text';
const BULK_DETAILS_EXPANDED_STORAGE_KEY = 'recampus_admin_bulk_details_expanded';
const MONITOR_PREFERENCE_KEYS = [
  COPY_FORMAT_STORAGE_KEY,
  SKIP_SORT_STORAGE_KEY,
  SKIP_PAGE_SIZE_STORAGE_KEY,
  CRITICAL_ONLY_STORAGE_KEY,
  AUTO_REFRESH_SECONDS_STORAGE_KEY,
  AUTO_REFRESH_PAUSED_STORAGE_KEY,
  FINANCE_WINDOW_DAYS_STORAGE_KEY,
  DISPUTE_PAGE_STORAGE_KEY,
  STATUS_FILTER_STORAGE_KEY,
  SEARCH_QUERY_STORAGE_KEY,
  MONITOR_PAGE_STORAGE_KEY,
  ACTION_HISTORY_RIDE_ID_STORAGE_KEY,
  SKIPPED_REASON_FILTER_STORAGE_KEY,
  SKIPPED_SEARCH_TEXT_STORAGE_KEY,
  BULK_DETAILS_EXPANDED_STORAGE_KEY
];

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const formatCurrency = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '-';
  return `Rs.${value.toFixed(2)}`;
};

const formatTrendText = (trendValue) => {
  const trend = trendValue || {};
  const delta = Number(trend.delta || 0);
  const direction = trend.direction || (delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat');
  const sign = delta > 0 ? '+' : '';
  const percentText = Number.isFinite(Number(trend.percent)) ? `${trend.percent}%` : 'No baseline';
  return {
    direction,
    label: `${sign}${delta.toFixed(2)} (${percentText}) vs prev window`
  };
};

const getFinanceTrendView = (metricKey, trendValue) => {
  const baseTrend = formatTrendText(trendValue);
  const isPendingLiability = metricKey === 'pendingPayoutLiability';

  let visualDirection = baseTrend.direction;
  if (isPendingLiability) {
    if (baseTrend.direction === 'up') visualDirection = 'down';
    if (baseTrend.direction === 'down') visualDirection = 'up';
  }

  const label = isPendingLiability
    ? `${baseTrend.label} (lower is better)`
    : baseTrend.label;

  return {
    label,
    visualDirection
  };
};

const toActionLabel = (value) => {
  if (!value) return 'action';
  return String(value).replace('_', ' ');
};

const toSkippedReasonLabel = (reason) => {
  const text = String(reason || '').trim();
  if (!text) return 'unknown';
  if (text === 'invalid_id') return 'invalid id';
  if (text === 'not_found') return 'not found';
  if (text.startsWith('ineligible_status:')) {
    return `ineligible (${text.split(':')[1] || 'status'})`;
  }
  return text;
};

const toCsvCell = (value) => {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
};

const buildBulkFeedback = (actionLabel, payload) => {
  const processed = Number(payload?.processedRideIds?.length || payload?.cancelledCount || payload?.requeuedCount || 0);
  const requested = Number(payload?.requestedCount || 0);
  const skippedCount = Number(payload?.skippedCount || 0);
  const skippedSample = Array.isArray(payload?.skipped) ? payload.skipped.slice(0, 2) : [];
  const sampleText = skippedSample
    .map((item) => `${item.rideId} (${item.reason})`)
    .join(', ');

  const base = `${actionLabel}: processed ${processed}/${requested}`;
  if (!skippedCount) return base;
  if (!sampleText) return `${base}. Skipped ${skippedCount}.`;
  return `${base}. Skipped ${skippedCount} (${sampleText}${skippedCount > skippedSample.length ? ', ...' : ''}).`;
};

const isBulkEligible = (rideStatus) => !['completed', 'cancelled'].includes(String(rideStatus || ''));

const RideMonitor = () => {
  const [status, setStatus] = useState(() => {
    try {
      const saved = localStorage.getItem(STATUS_FILTER_STORAGE_KEY);
      const allowed = STATUS_OPTIONS.map((item) => item.value);
      return allowed.includes(saved || '') ? saved : 'active';
    } catch (_) {
      return 'active';
    }
  });
  const [search, setSearch] = useState(() => {
    try {
      return localStorage.getItem(SEARCH_QUERY_STORAGE_KEY) || '';
    } catch (_) {
      return '';
    }
  });
  const [page, setPage] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(MONITOR_PAGE_STORAGE_KEY));
      return Number.isFinite(saved) && saved >= 1 ? Math.floor(saved) : 1;
    } catch (_) {
      return 1;
    }
  });
  const [monitorData, setMonitorData] = useState({
    summary: {
      total: 0,
      active: 0,
      delayedPickup: 0,
      longTrips: 0,
      delayedCompletion: 0,
      statusCounts: {}
    },
    total: 0,
    totalPages: 1,
    rides: []
  });
  const [settlementSummary, setSettlementSummary] = useState({
    windowDays: 30,
    asOf: null,
    lifetime: {
      totalEscrowCredited: 0,
      totalCaptainPayoutReleased: 0,
      totalPlatformFeeRetained: 0,
      pendingPayoutLiability: 0,
      adminEscrowOnHand: 0,
      paidRidesCount: 0,
      payoutReleasedRidesCount: 0,
      pendingPayoutRidesCount: 0
    },
    window: {
      totalEscrowCredited: 0,
      totalCaptainPayoutReleased: 0,
      totalPlatformFeeRetained: 0,
      pendingPayoutLiability: 0,
      adminEscrowOnHand: 0,
      paidRidesCount: 0,
      payoutReleasedRidesCount: 0,
      pendingPayoutRidesCount: 0
    },
    previousWindow: {
      totalEscrowCredited: 0,
      totalCaptainPayoutReleased: 0,
      totalPlatformFeeRetained: 0,
      pendingPayoutLiability: 0,
      adminEscrowOnHand: 0,
      paidRidesCount: 0,
      payoutReleasedRidesCount: 0,
      pendingPayoutRidesCount: 0
    },
    trends: {
      escrowCredited: { delta: 0, direction: 'flat', percent: null },
      payoutReleased: { delta: 0, direction: 'flat', percent: null },
      platformFeeRetained: { delta: 0, direction: 'flat', percent: null },
      pendingPayoutLiability: { delta: 0, direction: 'flat', percent: null }
    }
  });
  const [loading, setLoading] = useState(false);
  const [actionBusyRideId, setActionBusyRideId] = useState('');
  const [selectedRideForHistory, setSelectedRideForHistory] = useState(null);
  const [selectedRideHistoryId, setSelectedRideHistoryId] = useState(() => {
    try {
      return localStorage.getItem(ACTION_HISTORY_RIDE_ID_STORAGE_KEY) || '';
    } catch (_) {
      return '';
    }
  });
  const [autoRefreshSeconds, setAutoRefreshSeconds] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(AUTO_REFRESH_SECONDS_STORAGE_KEY));
      return [0, 15, 30, 60].includes(saved) ? saved : 30;
    } catch (_) {
      return 30;
    }
  });
  const [autoRefreshPaused, setAutoRefreshPaused] = useState(() => {
    try {
      return localStorage.getItem(AUTO_REFRESH_PAUSED_STORAGE_KEY) === 'true';
    } catch (_) {
      return false;
    }
  });
  const [financeWindowDays, setFinanceWindowDays] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(FINANCE_WINDOW_DAYS_STORAGE_KEY));
      return [7, 30, 90, 365].includes(saved) ? saved : 30;
    } catch (_) {
      return 30;
    }
  });
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [criticalOnly, setCriticalOnly] = useState(() => {
    try {
      return localStorage.getItem(CRITICAL_ONLY_STORAGE_KEY) === 'true';
    } catch (_) {
      return false;
    }
  });
  const [newFlaggedAlert, setNewFlaggedAlert] = useState('');
  const [selectedRideIds, setSelectedRideIds] = useState([]);
  const [bulkCancelBusy, setBulkCancelBusy] = useState(false);
  const [bulkRequeueBusy, setBulkRequeueBusy] = useState(false);
  const [actionFeedback, setActionFeedback] = useState('');
  const [disputeStatusFilter, setDisputeStatusFilter] = useState('open');
  const [disputes, setDisputes] = useState([]);
  const [disputePage, setDisputePage] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(DISPUTE_PAGE_STORAGE_KEY));
      return Number.isFinite(saved) && saved >= 1 ? Math.floor(saved) : 1;
    } catch (_) {
      return 1;
    }
  });
  const [disputeTotalPages, setDisputeTotalPages] = useState(1);
  const [disputeTotal, setDisputeTotal] = useState(0);
  const [disputeBusyRideId, setDisputeBusyRideId] = useState('');
  const [selectedDisputeRideId, setSelectedDisputeRideId] = useState('');
  const [selectedDisputeRide, setSelectedDisputeRide] = useState(null);
  const [bulkResultDetails, setBulkResultDetails] = useState(null);
  const [bulkDetailsExpanded, setBulkDetailsExpanded] = useState(() => {
    try {
      return localStorage.getItem(BULK_DETAILS_EXPANDED_STORAGE_KEY) !== 'false';
    } catch (_) {
      return true;
    }
  });
  const [selectedSkippedReason, setSelectedSkippedReason] = useState(() => {
    try {
      return localStorage.getItem(SKIPPED_REASON_FILTER_STORAGE_KEY) || '';
    } catch (_) {
      return '';
    }
  });
  const [skippedSortBy, setSkippedSortBy] = useState(() => {
    try {
      const saved = localStorage.getItem(SKIP_SORT_STORAGE_KEY);
      const allowed = ['default', 'reason_asc', 'ride_id_asc', 'ride_id_desc'];
      return allowed.includes(saved || '') ? saved : 'default';
    } catch (_) {
      return 'default';
    }
  });
  const [skippedSearchText, setSkippedSearchText] = useState(() => {
    try {
      return localStorage.getItem(SKIPPED_SEARCH_TEXT_STORAGE_KEY) || '';
    } catch (_) {
      return '';
    }
  });
  const [skippedPage, setSkippedPage] = useState(1);
  const [skippedPageSize, setSkippedPageSize] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(SKIP_PAGE_SIZE_STORAGE_KEY));
      return [10, 20, 50].includes(saved) ? saved : 20;
    } catch (_) {
      return 20;
    }
  });
  const [copyIdsFormat, setCopyIdsFormat] = useState(() => {
    try {
      const saved = localStorage.getItem(COPY_FORMAT_STORAGE_KEY);
      return saved === 'comma' ? 'comma' : 'newline';
    } catch (_) {
      return 'newline';
    }
  });
  const previousFlaggedIdsRef = useRef(new Set());
  const hasLoadedOnceRef = useRef(false);
  const anyBulkBusy = bulkCancelBusy || bulkRequeueBusy;

  const loadRideMonitor = async () => {
    try {
      setLoading(true);
      const [monitorRes, settlementRes, disputesRes] = await Promise.all([
        fetchRideMonitorData({ status, search, page, limit: 12, criticalOnly }),
        fetchRideSettlementSummary(financeWindowDays),
        fetchRideDisputes({ status: disputeStatusFilter, search, page: disputePage, limit: 8 })
      ]);
      setMonitorData(monitorRes.data || { summary: {}, total: 0, totalPages: 1, rides: [] });
      if (settlementRes?.data) {
        setSettlementSummary(settlementRes.data);
      }
      setDisputes(Array.isArray(disputesRes?.data?.disputes) ? disputesRes.data.disputes : []);
      setDisputeTotal(Number(disputesRes?.data?.total || 0));
      setDisputeTotalPages(Number(disputesRes?.data?.totalPages || 1));
      setLastUpdatedAt(new Date().toISOString());

      const rides = Array.isArray(monitorRes?.data?.rides) ? monitorRes.data.rides : [];
      const currentFlaggedIds = new Set(
        rides
          .filter((ride) => Array.isArray(ride.healthFlags) && ride.healthFlags.length > 0)
          .map((ride) => String(ride._id))
      );

      if (hasLoadedOnceRef.current) {
        let newCount = 0;
        currentFlaggedIds.forEach((id) => {
          if (!previousFlaggedIdsRef.current.has(id)) newCount += 1;
        });
        if (newCount > 0) {
          setNewFlaggedAlert(`${newCount} new flagged ride${newCount > 1 ? 's' : ''} detected on this page.`);
        }
      } else {
        hasLoadedOnceRef.current = true;
      }

      previousFlaggedIdsRef.current = currentFlaggedIds;
    } catch (_) {
      setMonitorData({
        summary: {
          total: 0,
          active: 0,
          delayedPickup: 0,
          longTrips: 0,
          delayedCompletion: 0,
          statusCounts: {}
        },
        total: 0,
        totalPages: 1,
        rides: []
      });
      setSettlementSummary((prev) => ({ ...prev }));
      setDisputes([]);
      setDisputeTotal(0);
      setDisputeTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRideMonitor();
  }, [status, page, criticalOnly, financeWindowDays, disputeStatusFilter, disputePage]);

  useEffect(() => {
    if (!autoRefreshSeconds || autoRefreshPaused) return;

    const timer = setInterval(() => {
      loadRideMonitor();
    }, autoRefreshSeconds * 1000);

    return () => clearInterval(timer);
  }, [autoRefreshSeconds, autoRefreshPaused, status, search, page, criticalOnly, financeWindowDays, disputeStatusFilter, disputePage]);

  useEffect(() => {
    const maxPage = Number(disputeTotalPages || 1);
    if (disputePage > maxPage) {
      setDisputePage(maxPage);
    }
  }, [disputePage, disputeTotalPages]);

  useEffect(() => {
    const currentRideIds = new Set((monitorData.rides || []).map((ride) => String(ride._id)));
    setSelectedRideIds((prev) => prev.filter((id) => currentRideIds.has(String(id))));
  }, [monitorData.rides]);

  useEffect(() => {
    if (!selectedRideHistoryId) {
      setSelectedRideForHistory(null);
      return;
    }

    const matchedRide = (monitorData.rides || []).find((ride) => String(ride._id) === String(selectedRideHistoryId));
    if (matchedRide) {
      setSelectedRideForHistory(matchedRide);
    } else {
      setSelectedRideForHistory(null);
      setSelectedRideHistoryId('');
    }
  }, [monitorData.rides, selectedRideHistoryId]);

  useEffect(() => {
    const maxPage = Number(monitorData?.totalPages || 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [monitorData?.totalPages, page]);

  useEffect(() => {
    if (!selectedDisputeRideId) {
      setSelectedDisputeRide(null);
      return;
    }

    const matched = (disputes || []).find((ride) => String(ride?._id) === String(selectedDisputeRideId));
    if (matched) {
      setSelectedDisputeRide(matched);
      return;
    }

    setSelectedDisputeRide(null);
    setSelectedDisputeRideId('');
  }, [disputes, selectedDisputeRideId]);

  useEffect(() => {
    try {
      localStorage.setItem(COPY_FORMAT_STORAGE_KEY, copyIdsFormat);
    } catch (_) {
      // Ignore storage write issues (private mode or blocked storage).
    }
  }, [copyIdsFormat]);

  useEffect(() => {
    try {
      localStorage.setItem(SKIP_SORT_STORAGE_KEY, skippedSortBy);
    } catch (_) {
      // Ignore storage write issues (private mode or blocked storage).
    }
  }, [skippedSortBy]);

  useEffect(() => {
    try {
      localStorage.setItem(SKIP_PAGE_SIZE_STORAGE_KEY, String(skippedPageSize));
    } catch (_) {
      // Ignore storage write issues (private mode or blocked storage).
    }
  }, [skippedPageSize]);

  useEffect(() => {
    try {
      localStorage.setItem(CRITICAL_ONLY_STORAGE_KEY, String(criticalOnly));
    } catch (_) {
      // Ignore storage write issues (private mode or blocked storage).
    }
  }, [criticalOnly]);

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_REFRESH_SECONDS_STORAGE_KEY, String(autoRefreshSeconds));
    } catch (_) {
      // Ignore storage write issues (private mode or blocked storage).
    }
  }, [autoRefreshSeconds]);

  useEffect(() => {
    try {
      localStorage.setItem(AUTO_REFRESH_PAUSED_STORAGE_KEY, String(autoRefreshPaused));
    } catch (_) {
      // Ignore storage write issues (private mode or blocked storage).
    }
  }, [autoRefreshPaused]);

  useEffect(() => {
    try {
      localStorage.setItem(FINANCE_WINDOW_DAYS_STORAGE_KEY, String(financeWindowDays));
    } catch (_) {
      // Ignore storage write issues (private mode or blocked storage).
    }
  }, [financeWindowDays]);

  useEffect(() => {
    try {
      localStorage.setItem(DISPUTE_PAGE_STORAGE_KEY, String(disputePage));
    } catch (_) {
      // Ignore storage write issues.
    }
  }, [disputePage]);

  useEffect(() => {
    try {
      localStorage.setItem(STATUS_FILTER_STORAGE_KEY, status);
    } catch (_) {
      // Ignore storage write issues (private mode or blocked storage).
    }
  }, [status]);

  useEffect(() => {
    try {
      localStorage.setItem(SEARCH_QUERY_STORAGE_KEY, search);
    } catch (_) {
      // Ignore storage write issues (private mode or blocked storage).
    }
  }, [search]);

  useEffect(() => {
    try {
      localStorage.setItem(MONITOR_PAGE_STORAGE_KEY, String(page));
    } catch (_) {
      // Ignore storage write issues (private mode or blocked storage).
    }
  }, [page]);

  useEffect(() => {
    try {
      if (selectedRideHistoryId) {
        localStorage.setItem(ACTION_HISTORY_RIDE_ID_STORAGE_KEY, selectedRideHistoryId);
      } else {
        localStorage.removeItem(ACTION_HISTORY_RIDE_ID_STORAGE_KEY);
      }
    } catch (_) {
      // Ignore storage write issues (private mode or blocked storage).
    }
  }, [selectedRideHistoryId]);

  useEffect(() => {
    try {
      localStorage.setItem(SKIPPED_REASON_FILTER_STORAGE_KEY, selectedSkippedReason);
    } catch (_) {
      // Ignore storage write issues (private mode or blocked storage).
    }
  }, [selectedSkippedReason]);

  useEffect(() => {
    try {
      localStorage.setItem(SKIPPED_SEARCH_TEXT_STORAGE_KEY, skippedSearchText);
    } catch (_) {
      // Ignore storage write issues (private mode or blocked storage).
    }
  }, [skippedSearchText]);

  useEffect(() => {
    try {
      localStorage.setItem(BULK_DETAILS_EXPANDED_STORAGE_KEY, String(bulkDetailsExpanded));
    } catch (_) {
      // Ignore storage write issues (private mode or blocked storage).
    }
  }, [bulkDetailsExpanded]);

  const onSearchSubmit = (event) => {
    event.preventDefault();
    setPage(1);
    setDisputePage(1);
    loadRideMonitor();
  };

  const handleForceCancel = async (rideId) => {
    const reason = window.prompt('Enter force-cancel reason for this ride:', 'Operational intervention by admin');
    if (!reason) return;

    try {
      setActionBusyRideId(rideId);
      await forceCancelRide(rideId, reason);
      setActionFeedback('Ride force-cancelled successfully.');
      setBulkResultDetails(null);
      setSelectedSkippedReason('');
      setSkippedSortBy('default');
      setSkippedSearchText('');
      await loadRideMonitor();
    } catch (_) {
      setActionFeedback('Failed to force-cancel ride.');
      setBulkResultDetails(null);
      setSelectedSkippedReason('');
      setSkippedSortBy('default');
      setSkippedSearchText('');
    } finally {
      setActionBusyRideId('');
    }
  };

  const handleRequeue = async (rideId) => {
    const ok = window.confirm('Move this ride back to searching and remove assigned captain?');
    if (!ok) return;

    try {
      setActionBusyRideId(rideId);
      await requeueRide(rideId);
      setActionFeedback('Ride moved back to searching queue.');
      setBulkResultDetails(null);
      setSelectedSkippedReason('');
      setSkippedSortBy('default');
      setSkippedSearchText('');
      await loadRideMonitor();
    } catch (_) {
      setActionFeedback('Failed to requeue ride.');
      setBulkResultDetails(null);
      setSelectedSkippedReason('');
      setSkippedSortBy('default');
      setSkippedSearchText('');
    } finally {
      setActionBusyRideId('');
    }
  };

  const handleSelectRide = (rideId, checked) => {
    setSelectedRideIds((prev) => {
      if (checked) {
        if (prev.includes(rideId)) return prev;
        return [...prev, rideId];
      }
      return prev.filter((id) => id !== rideId);
    });
  };

  const handleSelectAll = (checked) => {
    if (!checked) {
      setSelectedRideIds([]);
      return;
    }

    const eligibleIds = (monitorData.rides || [])
      .filter((ride) => isBulkEligible(ride.status))
      .map((ride) => ride._id);
    setSelectedRideIds(eligibleIds);
  };

  const handleBulkForceCancel = async () => {
    if (selectedRideIds.length === 0) return;
    const reason = window.prompt('Enter bulk force-cancel reason for selected rides:', 'Operational intervention by admin (bulk)');
    if (!reason) return;

    try {
      setBulkCancelBusy(true);
      const res = await bulkForceCancelRides(selectedRideIds, reason);
      setSelectedRideIds([]);
      setActionFeedback(buildBulkFeedback('Bulk force-cancel', res?.data));
      setBulkResultDetails({ action: 'force_cancel', payload: res?.data || null, createdAt: new Date().toISOString() });
      setSelectedSkippedReason('');
      setSkippedSortBy('default');
      setSkippedSearchText('');
      await loadRideMonitor();
    } catch (_) {
      setActionFeedback('Bulk force-cancel failed.');
      setBulkResultDetails(null);
      setSelectedSkippedReason('');
      setSkippedSortBy('default');
      setSkippedSearchText('');
    } finally {
      setBulkCancelBusy(false);
    }
  };

  const handleBulkRequeue = async () => {
    const eligibleIds = (monitorData.rides || [])
      .filter((ride) => selectedRideIds.includes(ride._id) && ['accepted', 'arrived'].includes(ride.status))
      .map((ride) => ride._id);

    if (eligibleIds.length === 0) return;

    const note = window.prompt('Optional note for bulk requeue action:', 'Operational redistribution by admin');
    if (note === null) return;

    try {
      setBulkRequeueBusy(true);
      const res = await bulkRequeueRides(eligibleIds, note || 'Bulk requeue by admin');
      setSelectedRideIds([]);
      setActionFeedback(buildBulkFeedback('Bulk requeue', res?.data));
      setBulkResultDetails({ action: 'requeue', payload: res?.data || null, createdAt: new Date().toISOString() });
      setSelectedSkippedReason('');
      setSkippedSortBy('default');
      setSkippedSearchText('');
      await loadRideMonitor();
    } catch (_) {
      setActionFeedback('Bulk requeue failed.');
      setBulkResultDetails(null);
      setSelectedSkippedReason('');
      setSkippedSortBy('default');
      setSkippedSearchText('');
    } finally {
      setBulkRequeueBusy(false);
    }
  };

  const handleResolveDispute = async (rideId, resolutionType) => {
    const note = window.prompt('Add dispute resolution note (optional):', 'Resolved by admin review');
    if (note === null) return;

    let amount;
    if (resolutionType === 'refund_passenger_partial' || resolutionType === 'release_captain_partial') {
      const entered = window.prompt('Enter partial amount:', '0');
      if (entered === null) return;
      amount = Number(entered);
      if (!Number.isFinite(amount) || amount <= 0) {
        setActionFeedback('Please provide a valid partial amount greater than 0.');
        return;
      }
    }

    try {
      setDisputeBusyRideId(String(rideId));
      await resolveRideDispute(rideId, {
        resolutionType,
        note: String(note || '').trim(),
        amount
      });
      setActionFeedback('Dispute resolved successfully.');
      await loadRideMonitor();
    } catch (err) {
      setActionFeedback(err?.response?.data?.message || 'Failed to resolve dispute.');
    } finally {
      setDisputeBusyRideId('');
    }
  };

  const buildDisputeTimeline = (ride) => {
    const entries = [];

    if (ride?.dispute?.openedAt) {
      entries.push({
        type: 'opened',
        at: ride.dispute.openedAt,
        title: 'Dispute Opened',
        detail: `${ride?.dispute?.openedByRole || 'user'}: ${ride?.dispute?.reason || '-'}`,
        actor: ride?.dispute?.openedByUserId?.email || ride?.dispute?.openedByRole || 'user'
      });
    }

    const adjustments = Array.isArray(ride?.settlementAdjustments) ? ride.settlementAdjustments : [];
    adjustments.forEach((item) => {
      entries.push({
        type: 'adjustment',
        at: item?.at,
        title: `Settlement Adjustment: ${String(item?.type || '-').replaceAll('_', ' ')}`,
        detail: `${formatCurrency(item?.amount || 0)}${item?.note ? ` | ${item.note}` : ''}`,
        actor: item?.byEmail || 'admin'
      });
    });

    if (ride?.dispute?.resolution?.resolvedAt) {
      entries.push({
        type: 'resolved',
        at: ride.dispute.resolution.resolvedAt,
        title: `Dispute ${String(ride?.dispute?.status || '').toLowerCase() === 'rejected' ? 'Rejected' : 'Resolved'}`,
        detail: `${String(ride?.dispute?.resolution?.type || '-').replaceAll('_', ' ')}${ride?.dispute?.resolution?.amount ? ` | ${formatCurrency(ride.dispute.resolution.amount)}` : ''}${ride?.dispute?.resolution?.note ? ` | ${ride.dispute.resolution.note}` : ''}`,
        actor: ride?.dispute?.resolution?.resolvedByEmail || 'admin'
      });
    }

    const disputeAdminActions = (Array.isArray(ride?.adminActions) ? ride.adminActions : [])
      .filter((item) => String(item?.action || '') === 'dispute_resolve');

    disputeAdminActions.forEach((item) => {
      entries.push({
        type: 'admin_action',
        at: item?.at,
        title: 'Admin Action Logged',
        detail: item?.note || '-',
        actor: item?.byEmail || 'admin'
      });
    });

    return entries.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  };

  const copyDisputeTimeline = async (ride) => {
    const timeline = buildDisputeTimeline(ride).map((entry) => ({
      at: entry.at,
      title: entry.title,
      detail: entry.detail,
      actor: entry.actor
    }));

    const payload = {
      rideId: String(ride?._id || ''),
      route: ride?.route || '-',
      disputeStatus: ride?.dispute?.status || 'none',
      openedAt: ride?.dispute?.openedAt || null,
      timeline
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setActionFeedback('Dispute timeline copied to clipboard.');
    } catch (_) {
      setActionFeedback('Unable to copy dispute timeline. Check clipboard permission.');
    }
  };

  const allEligibleRides = (monitorData.rides || []).filter((ride) => isBulkEligible(ride.status));
  const isAllEligibleSelected = allEligibleRides.length > 0 && selectedRideIds.length === allEligibleRides.length;
  const selectedRequeueCount = (monitorData.rides || []).filter(
    (ride) => selectedRideIds.includes(ride._id) && ['accepted', 'arrived'].includes(ride.status)
  ).length;
  const monitorProfileLabel = [
    criticalOnly ? 'Critical ON' : 'Critical OFF',
    autoRefreshSeconds > 0
      ? `${autoRefreshPaused ? 'Paused' : 'Auto'} ${autoRefreshSeconds}s`
      : 'Auto Off',
    `Finance ${financeWindowDays}d`,
    `Page ${page}`,
    `Status ${status}`
  ].join(' • ');
  const escrowTrendView = getFinanceTrendView('escrowCredited', settlementSummary?.trends?.escrowCredited);
  const payoutTrendView = getFinanceTrendView('payoutReleased', settlementSummary?.trends?.payoutReleased);
  const feeTrendView = getFinanceTrendView('platformFeeRetained', settlementSummary?.trends?.platformFeeRetained);
  const pendingTrendView = getFinanceTrendView('pendingPayoutLiability', settlementSummary?.trends?.pendingPayoutLiability);

  const copyMonitorProfile = async () => {
    try {
      const capturedAt = new Date().toLocaleString();
      const statsSnapshot = [
        `Active ${monitorData.summary?.active || 0}`,
        `DelayedPickup ${monitorData.summary?.delayedPickup || 0}`,
        `LongTrips ${monitorData.summary?.longTrips || 0}`,
        `DelayedCompletion ${monitorData.summary?.delayedCompletion || 0}`
      ].join(' • ');
      const payload = `${monitorProfileLabel} | ${statsSnapshot} | Captured ${capturedAt}`;
      await navigator.clipboard.writeText(payload);
      setActionFeedback('Current monitor profile copied to clipboard.');
    } catch (_) {
      setActionFeedback('Unable to copy monitor profile. Check clipboard permission.');
    }
  };

  const copyMonitorSnapshotJson = async () => {
    try {
      const flaggedRides = (monitorData.rides || [])
        .filter((ride) => Array.isArray(ride.healthFlags) && ride.healthFlags.length > 0)
        .map((ride) => ({
          id: String(ride._id),
          status: String(ride.status || 'unknown'),
          flags: Array.isArray(ride.healthFlags) ? ride.healthFlags : []
        }));
      const flaggedRideIds = flaggedRides.map((ride) => ride.id);
      const flaggedReasonCounts = flaggedRides
        .flatMap((ride) => ride.flags)
        .reduce((acc, flag) => {
          const key = String(flag || '').trim() || 'Unknown';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
      const topFlaggedReasons = Object.entries(flaggedReasonCounts)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
      const severityComponents = {
        delayedPickup: Number(monitorData.summary?.delayedPickup || 0),
        longTrips: Number(monitorData.summary?.longTrips || 0),
        delayedCompletion: Number(monitorData.summary?.delayedCompletion || 0),
        flaggedOnPage: flaggedRides.length
      };
      const severityWeights = {
        delayedPickup: 2,
        longTrips: 3,
        delayedCompletion: 2,
        flaggedOnPage: 1
      };
      const severityScore =
        severityComponents.delayedPickup * severityWeights.delayedPickup +
        severityComponents.longTrips * severityWeights.longTrips +
        severityComponents.delayedCompletion * severityWeights.delayedCompletion +
        severityComponents.flaggedOnPage * severityWeights.flaggedOnPage;
      const severityLevel = severityScore >= 25
        ? 'critical'
        : severityScore >= 15
          ? 'high'
          : severityScore >= 7
            ? 'medium'
            : 'low';
      const severityRecommendation = severityLevel === 'critical'
        ? 'Immediate intervention recommended: review flagged rides now and apply bulk actions if needed.'
        : severityLevel === 'high'
          ? 'High attention recommended: prioritize delayed pickup and long trip rides.'
          : severityLevel === 'medium'
            ? 'Monitor closely: investigate recurring flags and prepare intervention.'
            : 'System stable: continue routine monitoring cadence.';

      const payload = {
        capturedAt: new Date().toISOString(),
        monitorProfile: {
          criticalOnly,
          autoRefreshSeconds,
          autoRefreshPaused,
          financeWindowDays,
          page,
          status,
          search
        },
        summary: {
          total: Number(monitorData.summary?.total || 0),
          active: Number(monitorData.summary?.active || 0),
          delayedPickup: Number(monitorData.summary?.delayedPickup || 0),
          longTrips: Number(monitorData.summary?.longTrips || 0),
          delayedCompletion: Number(monitorData.summary?.delayedCompletion || 0),
          statusCounts: monitorData.summary?.statusCounts || {}
        },
        finance: {
          windowDays: Number(settlementSummary?.windowDays || financeWindowDays),
          asOf: settlementSummary?.asOf || null,
          lifetime: settlementSummary?.lifetime || {},
          window: settlementSummary?.window || {},
          previousWindow: settlementSummary?.previousWindow || {},
          trends: settlementSummary?.trends || {}
        },
        view: {
          rideQueueTotal: Number(monitorData.total || 0),
          currentPage: page,
          totalPages: Number(monitorData.totalPages || 1),
          criticalOnly,
          search,
          selectedRideIds: selectedRideIds.map((id) => String(id)),
          selectedRideCount: selectedRideIds.length,
          flaggedCountOnPage: flaggedRideIds.length,
          flaggedRideIds,
          flaggedRides,
          topFlaggedReasons,
          severity: {
            score: severityScore,
            level: severityLevel,
            recommendation: severityRecommendation,
            weights: severityWeights,
            components: severityComponents
          },
          bulkReview: {
            selectedSkippedReason,
            skippedSearchText,
            skippedSortBy,
            skippedPage,
            skippedPageSize,
            copyIdsFormat,
            bulkDetailsExpanded,
            skippedVisibleCount: sortedSkippedRows.length
          }
        }
      };

      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setActionFeedback('JSON monitor snapshot copied to clipboard.');
    } catch (_) {
      setActionFeedback('Unable to copy JSON snapshot. Check clipboard permission.');
    }
  };
  const skippedReasonCounts = Array.isArray(bulkResultDetails?.payload?.skipped)
    ? bulkResultDetails.payload.skipped.reduce((acc, item) => {
      const key = toSkippedReasonLabel(item?.reason);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
    : {};

  useEffect(() => {
    if (!selectedSkippedReason) return;
    if (!Object.prototype.hasOwnProperty.call(skippedReasonCounts, selectedSkippedReason)) {
      setSelectedSkippedReason('');
    }
  }, [selectedSkippedReason, skippedReasonCounts]);

  const skippedRows = Array.isArray(bulkResultDetails?.payload?.skipped) ? bulkResultDetails.payload.skipped : [];
  const reasonFilteredSkippedRows = selectedSkippedReason
    ? skippedRows.filter((item) => toSkippedReasonLabel(item?.reason) === selectedSkippedReason)
    : skippedRows;
  const searchedSkippedRows = skippedSearchText
    ? reasonFilteredSkippedRows.filter((item) => {
      const haystack = `${item?.rideId || ''} ${toSkippedReasonLabel(item?.reason)}`.toLowerCase();
      return haystack.includes(skippedSearchText.toLowerCase());
    })
    : reasonFilteredSkippedRows;
  const sortedSkippedRows = [...searchedSkippedRows].sort((a, b) => {
    const reasonA = toSkippedReasonLabel(a?.reason);
    const reasonB = toSkippedReasonLabel(b?.reason);
    const idA = String(a?.rideId || '');
    const idB = String(b?.rideId || '');

    if (skippedSortBy === 'reason_asc') return reasonA.localeCompare(reasonB);
    if (skippedSortBy === 'ride_id_asc') return idA.localeCompare(idB);
    if (skippedSortBy === 'ride_id_desc') return idB.localeCompare(idA);
    return 0;
  });
  const skippedTotalPages = Math.max(1, Math.ceil(sortedSkippedRows.length / skippedPageSize));
  const normalizedSkippedPage = Math.min(skippedPage, skippedTotalPages);
  const pagedSkippedRows = sortedSkippedRows.slice(
    (normalizedSkippedPage - 1) * skippedPageSize,
    normalizedSkippedPage * skippedPageSize
  );

  useEffect(() => {
    setSkippedPage(1);
  }, [selectedSkippedReason, skippedSearchText, skippedSortBy, skippedPageSize, bulkResultDetails?.createdAt]);

  const exportSkippedAsCsv = () => {
    const skipped = sortedSkippedRows;
    if (skipped.length === 0) return;

    const createdAt = bulkResultDetails?.createdAt || new Date().toISOString();
    const action = toActionLabel(bulkResultDetails?.action || 'bulk_action');
    const rows = [
      ['action', 'generatedAt', 'rideId', 'reason'],
      ...skipped.map((item) => [
        action,
        createdAt,
        item?.rideId || '',
        toSkippedReasonLabel(item?.reason)
      ])
    ];

    const csv = rows.map((row) => row.map(toCsvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ride-bulk-skipped-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const copySkippedIds = async () => {
    const ids = sortedSkippedRows
      .map((item) => String(item?.rideId || '').trim())
      .filter(Boolean);

    if (ids.length === 0) return;

    try {
      const separator = copyIdsFormat === 'comma' ? ', ' : '\n';
      await navigator.clipboard.writeText(ids.join(separator));
      setActionFeedback(
        `Copied ${ids.length} skipped ride ID(s) as ${copyIdsFormat === 'comma' ? 'comma-separated' : 'newline'} format.`
      );
    } catch (_) {
      setActionFeedback('Copy failed. Please allow clipboard permission and try again.');
    }
  };

  const handleResetPreferences = () => {
    const ok = window.confirm('Reset all Ride Monitor saved preferences and filters?');
    if (!ok) return;

    try {
      MONITOR_PREFERENCE_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch (_) {
      // Ignore storage removal issues.
    }

    setStatus('active');
    setSearch('');
    setPage(1);
    setCriticalOnly(false);
    setAutoRefreshSeconds(30);
    setAutoRefreshPaused(false);
    setFinanceWindowDays(30);
    setDisputePage(1);
    setSelectedRideHistoryId('');
    setSelectedRideForHistory(null);
    setSelectedSkippedReason('');
    setSkippedSearchText('');
    setSkippedSortBy('default');
    setSkippedPageSize(20);
    setSkippedPage(1);
    setCopyIdsFormat('newline');
    setBulkDetailsExpanded(true);
    setActionFeedback('Ride Monitor preferences reset to defaults.');
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>Ride Monitor</h1>
        <p>Track live ride health, bottlenecks, and operational delays.</p>
      </header>

      <div className="ride-monitor-toolbar">
        <button
          type="button"
          className="monitor-profile-pill"
          title="Current monitoring profile (click to copy)"
          onClick={copyMonitorProfile}
        >
          {monitorProfileLabel}
        </button>

        <button
          type="button"
          className="ride-action-btn"
          title="Copy structured monitor snapshot"
          onClick={copyMonitorSnapshotJson}
        >
          Copy JSON Snapshot
        </button>

        <form className="ride-monitor-search" onSubmit={onSearchSubmit}>
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search route, passenger, captain, pickup"
          />
          <button type="submit">Apply</button>
        </form>

        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button className="ride-refresh-btn" onClick={loadRideMonitor} type="button" disabled={loading}>
          <RefreshCcw size={15} /> {loading ? 'Refreshing...' : 'Refresh'}
        </button>

        <button
          type="button"
          className={`ride-action-btn ${criticalOnly ? 'active' : ''}`}
          onClick={() => {
            setPage(1);
            setCriticalOnly((prev) => !prev);
          }}
        >
          {criticalOnly ? 'Critical Only: ON' : 'Critical Only: OFF'}
        </button>

        <button
          type="button"
          className="ride-action-btn danger"
          onClick={handleBulkForceCancel}
          disabled={selectedRideIds.length === 0 || anyBulkBusy}
        >
          {bulkCancelBusy ? 'Cancelling...' : `Bulk Force Cancel (${selectedRideIds.length})`}
        </button>

        <button
          type="button"
          className="ride-action-btn"
          onClick={handleBulkRequeue}
          disabled={selectedRequeueCount === 0 || anyBulkBusy}
        >
          {bulkRequeueBusy ? 'Requeueing...' : `Bulk Requeue (${selectedRequeueCount})`}
        </button>

        <button
          type="button"
          className="ride-action-btn"
          onClick={() => setSelectedRideIds([])}
          disabled={selectedRideIds.length === 0 || anyBulkBusy}
        >
          Clear Selection
        </button>

        <button type="button" className="ride-action-btn" onClick={handleResetPreferences}>
          Reset Preferences
        </button>

        <div className="ride-auto-refresh-control">
          <label htmlFor="ride-auto-refresh-select">Auto Refresh</label>
          <select
            id="ride-auto-refresh-select"
            value={autoRefreshSeconds}
            onChange={(e) => setAutoRefreshSeconds(Number(e.target.value))}
          >
            <option value={0}>Off</option>
            <option value={15}>15s</option>
            <option value={30}>30s</option>
            <option value={60}>60s</option>
          </select>
        </div>

        <div className="ride-auto-refresh-control">
          <label htmlFor="ride-finance-window-select">Finance Window</label>
          <select
            id="ride-finance-window-select"
            value={financeWindowDays}
            onChange={(e) => setFinanceWindowDays(Number(e.target.value))}
          >
            <option value={7}>7d</option>
            <option value={30}>30d</option>
            <option value={90}>90d</option>
            <option value={365}>365d</option>
          </select>
        </div>

        {autoRefreshSeconds > 0 && (
          <button
            type="button"
            className="ride-action-btn"
            onClick={() => setAutoRefreshPaused((prev) => !prev)}
          >
            {autoRefreshPaused ? 'Resume Auto' : 'Pause Auto'}
          </button>
        )}

        <div className="ride-last-updated">
          Last Updated: {lastUpdatedAt ? formatDateTime(lastUpdatedAt) : '-'}
        </div>
      </div>

      {newFlaggedAlert && (
        <div className="ride-flag-alert">
          <span>{newFlaggedAlert}</span>
          <button type="button" onClick={() => setNewFlaggedAlert('')}>Dismiss</button>
        </div>
      )}

      {actionFeedback && (
        <div className="ride-flag-alert info">
          <span>{actionFeedback}</span>
          <button
            type="button"
            onClick={() => {
              setActionFeedback('');
              setBulkResultDetails(null);
              setSelectedSkippedReason('');
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {bulkResultDetails?.payload && (
        <div className="bulk-result-card">
          <div className="bulk-result-head">
            <div className="bulk-result-title-wrap">
              <strong>Bulk Result Details</strong>
              <small>
                {toActionLabel(bulkResultDetails.action)} at {formatDateTime(bulkResultDetails.createdAt)}
              </small>
            </div>
            {Array.isArray(bulkResultDetails.payload?.skipped) && bulkResultDetails.payload.skipped.length > 0 && (
              <div className="bulk-result-actions">
                <select
                  value={copyIdsFormat}
                  onChange={(e) => setCopyIdsFormat(e.target.value)}
                  aria-label="Copy format"
                >
                  <option value="newline">Copy: New Line</option>
                  <option value="comma">Copy: Comma</option>
                </select>
                <button type="button" className="ride-action-btn" onClick={copySkippedIds}>
                  Copy Skipped IDs
                </button>
                <button type="button" className="ride-action-btn" onClick={exportSkippedAsCsv}>
                  Export Skipped CSV
                </button>
              </div>
            )}
          </div>

          {Object.keys(skippedReasonCounts).length > 0 && (
            <div className="bulk-reason-summary">
              {Object.entries(skippedReasonCounts).map(([reason, count]) => (
                <button
                  type="button"
                  key={reason}
                  className={`bulk-reason-chip ${selectedSkippedReason === reason ? 'active' : ''}`}
                  onClick={() => setSelectedSkippedReason((prev) => (prev === reason ? '' : reason))}
                >
                  {reason}: {count}
                </button>
              ))}
              {selectedSkippedReason && (
                <button type="button" className="bulk-reason-clear" onClick={() => setSelectedSkippedReason('')}>
                  Clear Filter
                </button>
              )}
            </div>
          )}

          {skippedRows.length > 0 && (
            <div className="bulk-search-row">
              <label htmlFor="bulk-skip-search">Search:</label>
              <input
                id="bulk-skip-search"
                type="text"
                value={skippedSearchText}
                onChange={(e) => setSkippedSearchText(e.target.value)}
                placeholder="Filter by ride ID or reason"
              />
              {skippedSearchText && (
                <button type="button" className="bulk-reason-clear" onClick={() => setSkippedSearchText('')}>
                  Clear Search
                </button>
              )}
            </div>
          )}

          {searchedSkippedRows.length > 1 && (
            <div className="bulk-sort-row">
              <label htmlFor="bulk-skip-sort">Sort:</label>
              <select id="bulk-skip-sort" value={skippedSortBy} onChange={(e) => setSkippedSortBy(e.target.value)}>
                <option value="default">Default</option>
                <option value="reason_asc">Reason A-Z</option>
                <option value="ride_id_asc">Ride ID A-Z</option>
                <option value="ride_id_desc">Ride ID Z-A</option>
              </select>

              <label htmlFor="bulk-skip-size">Rows:</label>
              <select
                id="bulk-skip-size"
                value={skippedPageSize}
                onChange={(e) => setSkippedPageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          )}

          <details
            open={bulkDetailsExpanded}
            onToggle={(event) => setBulkDetailsExpanded(Boolean(event.currentTarget?.open))}
          >
            <summary>
              Processed {Number(bulkResultDetails.payload?.processedRideIds?.length || 0)} / Requested {Number(bulkResultDetails.payload?.requestedCount || 0)}
              {Number(bulkResultDetails.payload?.skippedCount || 0) > 0
                ? ` | Skipped ${(selectedSkippedReason || skippedSearchText)
                  ? `${sortedSkippedRows.length} of ${Number(bulkResultDetails.payload?.skippedCount || 0)}`
                  : Number(bulkResultDetails.payload?.skippedCount || 0)}`
                : ''}
            </summary>
            {sortedSkippedRows.length > 0 ? (
              <div className="bulk-result-list">
                {pagedSkippedRows.map((item, index) => (
                  <div key={`${item.rideId || 'unknown'}-${index}`} className="bulk-result-row">
                    <code>{item.rideId || 'unknown'}</code>
                    <span>{toSkippedReasonLabel(item.reason)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="bulk-result-empty">
                {(selectedSkippedReason || skippedSearchText)
                  ? 'No skipped rides match the current filters.'
                  : 'No skipped rides in this operation.'}
              </p>
            )}

            {sortedSkippedRows.length > 0 && skippedTotalPages > 1 && (
              <div className="bulk-skip-pagination">
                <span>
                  Page {normalizedSkippedPage} of {skippedTotalPages}
                </span>
                <div>
                  <button
                    type="button"
                    className="ride-action-btn"
                    onClick={() => setSkippedPage((prev) => Math.max(1, prev - 1))}
                    disabled={normalizedSkippedPage <= 1}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="ride-action-btn"
                    onClick={() => setSkippedPage((prev) => Math.min(skippedTotalPages, prev + 1))}
                    disabled={normalizedSkippedPage >= skippedTotalPages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </details>
        </div>
      )}

      <div className="stats-grid ride-monitor-grid">
        <div className="stat-card blue">
          <div className="stat-icon"><Bike /></div>
          <div className="stat-data">
            <h3>{monitorData.summary?.active || 0}</h3>
            <p>Active Rides</p>
          </div>
        </div>

        <div className="stat-card orange">
          <div className="stat-icon"><Clock3 /></div>
          <div className="stat-data">
            <h3>{monitorData.summary?.delayedPickup || 0}</h3>
            <p>Delayed Pickup Risk</p>
          </div>
        </div>

        <div className="stat-card green">
          <div className="stat-icon"><AlertTriangle /></div>
          <div className="stat-data">
            <h3>{monitorData.summary?.longTrips || 0}</h3>
            <p>Long Running Trips</p>
          </div>
        </div>

        <div className="stat-card slate">
          <div className="stat-icon"><AlertTriangle /></div>
          <div className="stat-data">
            <h3>{monitorData.summary?.delayedCompletion || 0}</h3>
            <p>Completion Delayed</p>
          </div>
        </div>
      </div>

      <div className="stats-grid ride-monitor-grid finance-grid">
        <div className="stat-card blue">
          <div className="stat-icon"><Bike /></div>
          <div className="stat-data">
            <h3>{formatCurrency(settlementSummary?.lifetime?.totalEscrowCredited || 0)}</h3>
            <p>Escrow Credited (Lifetime)</p>
            <small className={`finance-trend ${escrowTrendView.visualDirection}`}>
              {escrowTrendView.label}
            </small>
          </div>
        </div>

        <div className="stat-card green">
          <div className="stat-icon"><RefreshCcw /></div>
          <div className="stat-data">
            <h3>{formatCurrency(settlementSummary?.lifetime?.totalCaptainPayoutReleased || 0)}</h3>
            <p>Payout Released (Lifetime)</p>
            <small className={`finance-trend ${payoutTrendView.visualDirection}`}>
              {payoutTrendView.label}
            </small>
          </div>
        </div>

        <div className="stat-card orange">
          <div className="stat-icon"><AlertTriangle /></div>
          <div className="stat-data">
            <h3>{formatCurrency(settlementSummary?.lifetime?.totalPlatformFeeRetained || 0)}</h3>
            <p>Platform Fee Retained</p>
            <small className={`finance-trend ${feeTrendView.visualDirection}`}>
              {feeTrendView.label}
            </small>
          </div>
        </div>

        <div className="stat-card slate">
          <div className="stat-icon"><Clock3 /></div>
          <div className="stat-data">
            <h3>{formatCurrency(settlementSummary?.lifetime?.pendingPayoutLiability || 0)}</h3>
            <p>Pending Payout Liability</p>
            <small className={`finance-trend ${pendingTrendView.visualDirection}`}>
              {pendingTrendView.label}
            </small>
          </div>
        </div>
      </div>

      <div className="finance-window-note">
        Last {Number(settlementSummary?.windowDays || 30)} days: Escrow {formatCurrency(settlementSummary?.window?.totalEscrowCredited || 0)} | Payout {formatCurrency(settlementSummary?.window?.totalCaptainPayoutReleased || 0)} | Fee {formatCurrency(settlementSummary?.window?.totalPlatformFeeRetained || 0)} | Pending {formatCurrency(settlementSummary?.window?.pendingPayoutLiability || 0)}
        {settlementSummary?.asOf ? ` | As of ${formatDateTime(settlementSummary.asOf)}` : ''}
      </div>

      <div className="admin-card ride-dispute-card">
        <div className="ride-monitor-header-row">
          <h2>Ride Disputes ({disputeTotal})</h2>
          <select
            value={disputeStatusFilter}
            onChange={(e) => {
              setDisputeStatusFilter(e.target.value);
              setDisputePage(1);
            }}
            aria-label="Filter disputes by status"
          >
            {DISPUTE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <table className="admin-table ride-dispute-table">
          <thead>
            <tr>
              <th>Ride</th>
              <th>Dispute</th>
              <th>Opened By</th>
              <th>Status</th>
              <th>Opened</th>
              <th>Resolve</th>
              <th>Timeline</th>
            </tr>
          </thead>
          <tbody>
            {disputes.length > 0 ? disputes.map((ride) => {
              const disputeStatus = String(ride?.dispute?.status || 'none');
              const isOpen = ['open', 'in_review'].includes(disputeStatus);
              return (
                <tr key={`dispute-${ride._id}`}>
                  <td>
                    <strong>{ride?.route || 'Ride'}</strong>
                    <br />
                    <small>{ride?.passenger?.email || '-'} / {ride?.captain?.email || '-'}</small>
                  </td>
                  <td>
                    <strong>{ride?.dispute?.reason || '-'}</strong>
                    {ride?.dispute?.evidenceText ? <><br /><small>{ride.dispute.evidenceText}</small></> : null}
                  </td>
                  <td>
                    {ride?.dispute?.openedByUserId?.email || ride?.dispute?.openedByRole || '-'}
                  </td>
                  <td>
                    <span className={`dispute-status-chip dispute-${disputeStatus}`}>{disputeStatus}</span>
                  </td>
                  <td>{formatDateTime(ride?.dispute?.openedAt)}</td>
                  <td>
                    {isOpen ? (
                      <div className="ride-action-stack">
                        <button
                          type="button"
                          className="ride-action-btn"
                          onClick={() => handleResolveDispute(ride._id, 'refund_passenger_full')}
                          disabled={disputeBusyRideId === String(ride._id)}
                        >
                          Refund Full
                        </button>
                        <button
                          type="button"
                          className="ride-action-btn"
                          onClick={() => handleResolveDispute(ride._id, 'refund_passenger_partial')}
                          disabled={disputeBusyRideId === String(ride._id)}
                        >
                          Refund Partial
                        </button>
                        <button
                          type="button"
                          className="ride-action-btn"
                          onClick={() => handleResolveDispute(ride._id, 'release_captain_full')}
                          disabled={disputeBusyRideId === String(ride._id)}
                        >
                          Captain Full
                        </button>
                        <button
                          type="button"
                          className="ride-action-btn"
                          onClick={() => handleResolveDispute(ride._id, 'release_captain_partial')}
                          disabled={disputeBusyRideId === String(ride._id)}
                        >
                          Captain Partial
                        </button>
                        <button
                          type="button"
                          className="ride-action-btn danger"
                          onClick={() => handleResolveDispute(ride._id, 'reject_dispute')}
                          disabled={disputeBusyRideId === String(ride._id)}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <small>{ride?.dispute?.resolution?.type || 'Closed'}</small>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ride-action-btn"
                      onClick={() => setSelectedDisputeRideId(String(ride._id))}
                    >
                      View Timeline
                    </button>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="7" className="ride-monitor-empty">No disputes for this filter.</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="ride-monitor-pagination dispute-pagination">
          <span>
            Page {disputePage} of {disputeTotalPages}
          </span>
          <div>
            <button
              type="button"
              className="ride-action-btn"
              onClick={() => setDisputePage((prev) => Math.max(1, prev - 1))}
              disabled={disputePage <= 1}
            >
              Previous
            </button>
            <button
              type="button"
              className="ride-action-btn"
              onClick={() => setDisputePage((prev) => Math.min(disputeTotalPages, prev + 1))}
              disabled={disputePage >= disputeTotalPages}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {selectedDisputeRide && (
        <div className="admin-card dispute-timeline-card">
          <div className="ride-monitor-header-row">
            <h2>Dispute Timeline</h2>
            <div className="ride-action-stack">
              <button
                type="button"
                className="ride-action-btn"
                onClick={() => copyDisputeTimeline(selectedDisputeRide)}
              >
                Copy Timeline
              </button>
              <button
                type="button"
                className="ride-action-btn"
                onClick={() => {
                  setSelectedDisputeRide(null);
                  setSelectedDisputeRideId('');
                }}
              >
                Close
              </button>
            </div>
          </div>

          <div className="ride-history-meta">
            <p><strong>Ride:</strong> {selectedDisputeRide?.route || '-'}</p>
            <p><strong>Passenger:</strong> {selectedDisputeRide?.passenger?.email || '-'}</p>
            <p><strong>Captain:</strong> {selectedDisputeRide?.captain?.email || '-'}</p>
            <p><strong>Status:</strong> {selectedDisputeRide?.dispute?.status || '-'}</p>
          </div>

          <div className="dispute-timeline-list">
            {buildDisputeTimeline(selectedDisputeRide).length > 0 ? buildDisputeTimeline(selectedDisputeRide).map((entry, idx) => (
              <div key={`${entry.type}-${entry.at}-${idx}`} className="dispute-timeline-row">
                <div>
                  <strong>{entry.title}</strong>
                  <p>{entry.detail}</p>
                </div>
                <div className="ride-history-actor">
                  <span>{entry.actor || 'system'}</span>
                  <small>{formatDateTime(entry.at)}</small>
                </div>
              </div>
            )) : (
              <p className="ride-monitor-empty">No timeline entries available.</p>
            )}
          </div>
        </div>
      )}

      <div className="admin-card ride-monitor-table-wrap">
        <div className="ride-monitor-header-row">
          <h2>Ride Queue ({monitorData.total || 0})</h2>
          <span>
            Page {page} of {monitorData.totalPages || 1}
          </span>
        </div>

        <table className="admin-table ride-monitor-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  checked={isAllEligibleSelected}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  aria-label="Select all rides"
                />
              </th>
              <th>Ride</th>
              <th>Status</th>
              <th>Passenger</th>
              <th>Captain</th>
              <th>Updated</th>
              <th>Settlement</th>
              <th>Flags</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(monitorData.rides) && monitorData.rides.length > 0 ? (
              monitorData.rides.map((ride) => (
                <tr key={ride._id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedRideIds.includes(ride._id)}
                      onChange={(e) => handleSelectRide(ride._id, e.target.checked)}
                      disabled={!isBulkEligible(ride.status) || anyBulkBusy}
                      aria-label="Select ride"
                    />
                  </td>
                  <td>
                    <strong>{ride.route}</strong>
                    <br />
                    <small>
                      Rs.{ride.price} | {ride.type}
                    </small>
                  </td>
                  <td>
                    <span className={`ride-status-chip ride-status-${ride.status}`}>{ride.status}</span>
                  </td>
                  <td>
                    {ride.passenger?.email || 'Unknown'}
                    <br />
                    <small>{ride.passenger?.phone || '-'}</small>
                  </td>
                  <td>
                    {ride.captain?.email || '-'}
                    <br />
                    <small>{ride.captain?.phone || '-'}</small>
                  </td>
                  <td>{formatDateTime(ride.updatedAt)}</td>
                  <td>
                    {ride?.settlement ? (
                      <div className="settlement-stack">
                        <small>Escrow: {formatCurrency(ride?.settlement?.adminEscrowAmount ?? ride?.price)}</small>
                        <small>Fee: {formatCurrency(ride?.settlement?.platformFeeAmount ?? ((Number(ride?.price) || 0) * 0.10))}</small>
                        <small className="settlement-payout">Payout: {formatCurrency(ride?.settlement?.captainPayoutAmount ?? ((Number(ride?.price) || 0) * 0.90))}</small>
                        <small>Credited: {formatDateTime(ride?.settlement?.adminEscrowCreditedAt)}</small>
                        <small>Released: {ride?.settlement?.captainPaidAt ? formatDateTime(ride.settlement.captainPaidAt) : 'Pending'}</small>
                      </div>
                    ) : (
                      <span className="settlement-empty">Not paid</span>
                    )}
                  </td>
                  <td>
                    {Array.isArray(ride.healthFlags) && ride.healthFlags.length > 0 ? (
                      <div className="flag-stack">
                        {ride.healthFlags.map((flag) => (
                          <span key={flag} className="risk-flag">{flag}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="risk-clear">Healthy</span>
                    )}

                    {Array.isArray(ride.adminActions) && ride.adminActions.length > 0 && (
                      <div className="admin-action-audit">
                        {(() => {
                          const latestAction = [...ride.adminActions].sort(
                            (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
                          )[0];
                          return (
                            <small>
                              Last Admin Action: <strong>{toActionLabel(latestAction?.action)}</strong>
                              {' by '}
                              {latestAction?.byEmail || 'admin'}
                              {' on '}
                              {formatDateTime(latestAction?.at)}
                            </small>
                          );
                        })()}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="ride-action-stack">
                      <button
                        type="button"
                        className="ride-action-btn"
                        onClick={() => {
                          setSelectedRideForHistory(ride);
                          setSelectedRideHistoryId(String(ride._id));
                        }}
                      >
                        View History
                      </button>

                      {['accepted', 'arrived'].includes(ride.status) && (
                        <button
                          type="button"
                          className="ride-action-btn"
                          onClick={() => handleRequeue(ride._id)}
                          disabled={actionBusyRideId === ride._id}
                        >
                          Requeue
                        </button>
                      )}
                      {!['completed', 'cancelled'].includes(ride.status) && (
                        <button
                          type="button"
                          className="ride-action-btn danger"
                          onClick={() => handleForceCancel(ride._id)}
                          disabled={actionBusyRideId === ride._id}
                        >
                          Force Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="ride-monitor-empty">No rides found for this filter.</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="ride-monitor-pagination">
          <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
            Previous
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(monitorData.totalPages || 1, prev + 1))}
            disabled={page >= (monitorData.totalPages || 1)}
          >
            Next
          </button>
        </div>
      </div>

      {selectedRideForHistory && (
        <div className="admin-card ride-history-card">
          <div className="ride-monitor-header-row">
            <h2>Action History</h2>
            <button
              type="button"
              className="ride-action-btn"
              onClick={() => {
                setSelectedRideForHistory(null);
                setSelectedRideHistoryId('');
              }}
            >
              Close
            </button>
          </div>

          <div className="ride-history-meta">
            <p><strong>Route:</strong> {selectedRideForHistory.route}</p>
            <p><strong>Status:</strong> {selectedRideForHistory.status}</p>
            <p><strong>Passenger:</strong> {selectedRideForHistory.passenger?.email || 'Unknown'}</p>
            <p><strong>Captain:</strong> {selectedRideForHistory.captain?.email || '-'}</p>
            <p><strong>Escrow:</strong> {formatCurrency(selectedRideForHistory?.settlement?.adminEscrowAmount ?? selectedRideForHistory?.price)}</p>
            <p><strong>Platform Fee:</strong> {formatCurrency(selectedRideForHistory?.settlement?.platformFeeAmount ?? ((Number(selectedRideForHistory?.price) || 0) * 0.10))}</p>
            <p><strong>Captain Payout:</strong> {formatCurrency(selectedRideForHistory?.settlement?.captainPayoutAmount ?? ((Number(selectedRideForHistory?.price) || 0) * 0.90))}</p>
            <p><strong>Escrow Credited:</strong> {formatDateTime(selectedRideForHistory?.settlement?.adminEscrowCreditedAt)}</p>
            <p><strong>Payout Released:</strong> {selectedRideForHistory?.settlement?.captainPaidAt ? formatDateTime(selectedRideForHistory.settlement.captainPaidAt) : 'Pending'}</p>
          </div>

          {Array.isArray(selectedRideForHistory.adminActions) && selectedRideForHistory.adminActions.length > 0 ? (
            <div className="ride-history-list">
              {[...selectedRideForHistory.adminActions]
                .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
                .map((item, idx) => (
                  <div key={`${item.at}-${idx}`} className="ride-history-row">
                    <div>
                      <strong>{toActionLabel(item.action)}</strong>
                      <p>{item.note || 'No note provided.'}</p>
                    </div>
                    <div className="ride-history-actor">
                      <span>{item.byEmail || 'admin'}</span>
                      <small>{formatDateTime(item.at)}</small>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="ride-monitor-empty">No admin intervention history on this ride yet.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default RideMonitor;
