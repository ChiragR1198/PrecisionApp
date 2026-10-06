import { createSlice } from '@reduxjs/toolkit';
import { clearAuth } from './authSlice';

const initialState = {
  selectedEventId: null,
  selectedEventIndex: 0,
  selectedEventDateFrom: null,
  selectedEventDateTo: null,
};

const eventSlice = createSlice({
  name: 'event',
  initialState,
  reducers: {
    setSelectedEvent: (state, action) => {
      state.selectedEventId = action.payload.eventId;
      state.selectedEventIndex = action.payload.index ?? 0;
      state.selectedEventDateFrom = action.payload.dateFrom ?? null;
      state.selectedEventDateTo = action.payload.dateTo ?? null;
    },
    clearSelectedEvent: () => initialState,
  },
  extraReducers: (builder) => {
    builder.addMatcher(clearAuth.match, () => initialState);
  },
});

export const { setSelectedEvent, clearSelectedEvent } = eventSlice.actions;
export default eventSlice.reducer;

