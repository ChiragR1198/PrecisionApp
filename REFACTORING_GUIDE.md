# PrecisionGlobe App Refactoring Guide

## Overview
This document outlines the refactoring improvements made to the PrecisionGlobe app to improve code maintainability, reusability, and consistency.

## Key Improvements

### 1. Custom Hook for Responsive Sizing
**Location:** `src/hooks/useResponsiveSizes.js`

**Problem:** The responsive sizing logic (`getResponsiveValue`) was duplicated across 16+ screen files, leading to code duplication and maintenance issues.

**Solution:** Created a reusable custom hook `useResponsiveSizes` that:
- Handles platform-specific (Android/iOS) and device-specific (Phone/Tablet) sizing
- Provides a clean API for responsive values
- Includes predefined common sizes for consistency

**Usage:**
```jsx
import { useResponsiveSizes, commonSizes } from '../../hooks/useResponsiveSizes';

const { SIZES, isTablet } = useResponsiveSizes({
  headerIconSize: commonSizes.headerIconSize,
  paddingHorizontal: commonSizes.paddingHorizontal,
  // ... other sizes
});
```

### 2. API Service Layer
**Location:** `src/services/api/`

**Problem:** API calls were scattered across components, making it difficult to manage and maintain.

**Solution:** Created dedicated service files for each module:
- `agendaService.js` - Agenda-related API calls
- `attendeesService.js` - Attendees/delegates API calls
- `sponsorsService.js` - Sponsors API calls
- `messagesService.js` - Messages/chat API calls
- `meetingRequestsService.js` - Meeting requests API calls
- `profileService.js` - User profile API calls

**Benefits:**
- Centralized API logic
- Consistent error handling
- Easy to test and mock
- Reusable across components

**Usage:**
```jsx
import { agendaService } from '../../services/api/agendaService';

const result = await agendaService.getAgenda();
if (result.success) {
  // Handle success
} else {
  // Handle error
}
```

### 3. Common UI Components
**Location:** `src/components/common/`

**Problem:** Loading, error, and empty states were implemented differently across screens.

**Solution:** Created reusable components:
- `LoadingState.jsx` - Consistent loading indicator
- `ErrorState.jsx` - Error display with retry option
- `EmptyState.jsx` - Empty state display

**Usage:**
```jsx
import { LoadingState, ErrorState, EmptyState } from '../../components/common';

{isLoading && <LoadingState message="Loading agenda..." />}
{error && <ErrorState message={error} onRetry={handleRetry} />}
{isEmpty && <EmptyState title="No items" message="No agenda items found" />}
```

### 4. Utility Functions
**Location:** `src/utils/helpers.js`

**Problem:** Common utility functions were duplicated or missing.

**Solution:** Created a centralized utilities file with:
- `formatDate()` - Date formatting
- `formatTime()` - Time formatting
- `truncateText()` - Text truncation
- `debounce()` - Function debouncing
- `getInitials()` - Get initials from name
- `organizeAgendaByTime()` - Organize agenda by time periods
- `safeJsonParse()` - Safe JSON parsing

**Usage:**
```jsx
import { formatDate, truncateText, getInitials } from '../../utils/helpers';

const formattedDate = formatDate(date);
const shortText = truncateText(longText, 100);
const initials = getInitials('John Doe'); // "JD"
```

## Migration Guide

### For Existing Screens

1. **Replace responsive sizing logic:**
   ```jsx
   // Before
   const { SIZES, isTablet } = useMemo(() => {
     const isAndroid = Platform.OS === 'android';
     // ... duplicate logic
   }, [SCREEN_WIDTH]);

   // After
   import { useResponsiveSizes, commonSizes } from '../../hooks/useResponsiveSizes';
   const { SIZES, isTablet } = useResponsiveSizes({
     headerIconSize: commonSizes.headerIconSize,
     // ... other sizes
   });
   ```

2. **Use API services:**
   ```jsx
   // Before
   const response = await fetch('/api/agenda');
   
   // After
   import { agendaService } from '../../services/api/agendaService';
   const result = await agendaService.getAgenda();
   ```

3. **Use common components:**
   ```jsx
   // Before
   {isLoading && <ActivityIndicator />}
   
   // After
   import { LoadingState } from '../../components/common';
   {isLoading && <LoadingState message="Loading..." />}
   ```

## Next Steps

1. **Refactor remaining screens** to use the new hook and services
2. **Add TypeScript** for better type safety
3. **Create unit tests** for hooks, services, and utilities
4. **Add error boundaries** for better error handling
5. **Implement caching** for API responses
6. **Add loading skeletons** for better UX

## Files Created

- `src/hooks/useResponsiveSizes.js` - Responsive sizing hook
- `src/services/api/agendaService.js` - Agenda API service
- `src/services/api/attendeesService.js` - Attendees API service
- `src/services/api/sponsorsService.js` - Sponsors API service
- `src/services/api/messagesService.js` - Messages API service
- `src/services/api/meetingRequestsService.js` - Meeting requests API service
- `src/services/api/profileService.js` - Profile API service
- `src/components/common/LoadingState.jsx` - Loading component
- `src/components/common/ErrorState.jsx` - Error component
- `src/components/common/EmptyState.jsx` - Empty state component
- `src/utils/helpers.js` - Utility functions

## Benefits

1. **Reduced Code Duplication:** ~250+ lines of duplicate code removed
2. **Better Maintainability:** Changes to responsive logic only need to be made in one place
3. **Consistency:** All screens use the same patterns and components
4. **Testability:** Services and hooks can be easily tested
5. **Scalability:** Easy to add new features and screens

