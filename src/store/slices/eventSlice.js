import { createSlice } from '@reduxjs/toolkit';

const eventSlice = createSlice({
  name: 'event',
  initialState: {
    selectedEventId: null,
    selectedEventIndex: 0,
    selectedEventDateFrom: null,
    selectedEventDateTo: null,
  },
  reducers: {
    setSelectedEvent: (state, action) => {
      state.selectedEventId = action.payload.eventId;
      state.selectedEventIndex = action.payload.index ?? 0;
      state.selectedEventDateFrom = action.payload.dateFrom ?? null;
      state.selectedEventDateTo = action.payload.dateTo ?? null;
    },
    clearSelectedEvent: (state) => {
      state.selectedEventId = null;
      state.selectedEventIndex = 0;
      state.selectedEventDateFrom = null;
      state.selectedEventDateTo = null;
    },
  },
});

export const { setSelectedEvent, clearSelectedEvent } = eventSlice.actions;
export default eventSlice.reducer;

