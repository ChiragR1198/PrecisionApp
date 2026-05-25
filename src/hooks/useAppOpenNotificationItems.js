import { useMemo } from 'react';
import {
  useGetAppOpenNotificationSummaryQuery,
  useGetDelegateMeetingRequestsQuery,
  useGetDelegateMessagesQuery,
  useGetSponsorMeetingRequestsQuery,
  useGetSponsorMessagesQuery,
} from '../store/api';
import { useAppSelector } from '../store/hooks';

function getThreadsListFromMessagesResponse(messagesData) {
  if (!messagesData) return [];
  if (Array.isArray(messagesData?.data)) return messagesData.data;
  if (Array.isArray(messagesData)) return messagesData;
  if (messagesData?.data && typeof messagesData.data === 'object') {
    const dataObj = messagesData.data;
    if (Array.isArray(dataObj.messages)) return dataObj.messages;
    if (Array.isArray(dataObj.data)) return dataObj.data;
  }
  return [];
}

function sumServerUnreadCount(messagesData) {
  const list = getThreadsListFromMessagesResponse(messagesData);
  return list.reduce(
    (sum, item) => sum + (Number(item.unread_count ?? item.unreadCount) || 0),
    0
  );
}

function extractMeetingList(response) {
  if (!response) return [];
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data?.data)) return response.data.data;
  return [];
}

function isPendingMeeting(row) {
  const accepted = row?.is_accepted ?? row?.isAccepted;
  if (accepted === null || accepted === undefined || accepted === '') return true;
  if (String(accepted).toUpperCase() === 'NULL') return true;
  return false;
}

function buildItems({ pendingMeetings, newAttendeesToday, unreadMessages }) {
  const items = [];
  if (pendingMeetings > 0) {
    items.push({
      type: 'meeting_requests',
      count: pendingMeetings,
      message:
        pendingMeetings === 1
          ? 'You have 1 pending meeting request'
          : `You have ${pendingMeetings} pending meeting requests`,
    });
  }
  if (newAttendeesToday > 0) {
    items.push({
      type: 'new_attendees',
      count: newAttendeesToday,
      message:
        newAttendeesToday === 1
          ? '1 new attendee joined today'
          : `${newAttendeesToday} new attendees joined today`,
    });
  }
  if (unreadMessages > 0) {
    items.push({
      type: 'messages',
      count: unreadMessages,
      message:
        unreadMessages === 1
          ? 'You have 1 new message'
          : `You have ${unreadMessages} new messages`,
    });
  }
  return items;
}

/**
 * Items for app-open notification banners. Uses app-summary API when available;
 * falls back to meeting-requests + messages endpoints.
 */
export function useAppOpenNotificationItems() {
  const { user, isAuthenticated } = useAppSelector((s) => s.auth);
  const selectedEventId = useAppSelector((s) => s.event.selectedEventId);
  const loginType = (user?.login_type || user?.user_type || '').toLowerCase();
  const isDelegate = loginType === 'delegate';
  const eventArg =
    selectedEventId != null && selectedEventId !== '' ? { event_id: selectedEventId } : undefined;

  const {
    data: summaryData,
    refetch: refetchSummary,
    isFetching: summaryFetching,
  } = useGetAppOpenNotificationSummaryQuery(eventArg, {
    skip: !isAuthenticated,
    refetchOnMountOrArgChange: true,
    keepUnusedDataFor: 0,
  });

  const summaryItems = summaryData?.data?.items;
  const hasSummaryItems =
    Array.isArray(summaryItems) &&
    summaryItems.length > 0 &&
    (Number(summaryData?.data?.pending_meeting_requests) > 0 ||
      Number(summaryData?.data?.new_attendees_today) > 0 ||
      Number(summaryData?.data?.unread_messages) > 0);

  const skipFallback = !isAuthenticated || hasSummaryItems;

  const { data: delegateMeetings } = useGetDelegateMeetingRequestsQuery(eventArg, {
    skip: skipFallback || !isDelegate,
    refetchOnMountOrArgChange: true,
    keepUnusedDataFor: 0,
  });
  const { data: sponsorMeetings } = useGetSponsorMeetingRequestsQuery(eventArg, {
    skip: skipFallback || isDelegate,
    refetchOnMountOrArgChange: true,
    keepUnusedDataFor: 0,
  });
  const { data: delegateMessages } = useGetDelegateMessagesQuery(undefined, {
    skip: skipFallback || !isDelegate,
    refetchOnMountOrArgChange: true,
    keepUnusedDataFor: 0,
  });
  const { data: sponsorMessages } = useGetSponsorMessagesQuery(undefined, {
    skip: skipFallback || isDelegate,
    refetchOnMountOrArgChange: true,
    keepUnusedDataFor: 0,
  });

  const items = useMemo(() => {
    if (hasSummaryItems) {
      return summaryItems.filter((row) => Number(row?.count) > 0);
    }

    const meetingsPayload = isDelegate ? delegateMeetings : sponsorMeetings;
    const pendingMeetings = extractMeetingList(meetingsPayload).filter(isPendingMeeting).length;
    const unreadMessages = sumServerUnreadCount(isDelegate ? delegateMessages : sponsorMessages);

    return buildItems({
      pendingMeetings,
      newAttendeesToday: 0,
      unreadMessages,
    });
  }, [
    hasSummaryItems,
    summaryItems,
    isDelegate,
    delegateMeetings,
    sponsorMeetings,
    delegateMessages,
    sponsorMessages,
  ]);

  const refetch = () => {
    refetchSummary();
  };

  return {
    items,
    refetch,
    isFetching: summaryFetching,
  };
}
