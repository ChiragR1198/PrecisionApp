import { createSlice } from '@reduxjs/toolkit';

const eventSlice = createSlice({
  name: 'event',
  initialState: {
    selectedEventId: null,
    selectedEventIndex: 0,
  },
  reducers: {
    setSelectedEvent: (state, action) => {
      state.selectedEventId = action.payload.eventId;
      state.selectedEventIndex = action.payload.index ?? 0;
    },
    clearSelectedEvent: (state) => {
      state.selectedEventId = null;
      state.selectedEventIndex = 0;
    },
  },
});

export const { setSelectedEvent, clearSelectedEvent } = eventSlice.actions;
export default eventSlice.reducer;

