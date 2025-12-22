import Icon from '@expo/vector-icons/Feather';
import { colors } from './theme';

// Centralized icon components for consistent styling across the app
// All icons use Feather icon set for consistency

export const Icons = {
  // Navigation & UI
  Menu: ({ color = colors.icon, size = 24 }) => (
    <Icon name="menu" size={size} color={color} />
  ),
  ChevronRight: ({ color = colors.primary, size = 20 }) => (
    <Icon name="chevron-right" size={size} color={color} />
  ),
  ChevronLeft: ({ color = colors.icon, size = 24 }) => (
    <Icon name="chevron-left" size={size} color={color} />
  ),
  ChevronDown: ({ color = colors.icon, size = 16 }) => (
    <Icon name="chevron-down" size={size} color={color} />
  ),
  ChevronUp: ({ color = colors.icon, size = 16 }) => (
    <Icon name="chevron-up" size={size} color={color} />
  ),
  X: ({ color = colors.icon, size = 24 }) => (
    <Icon name="x" size={size} color={color} />
  ),
  
  // Main features
  Calendar: ({ color = colors.white, size = 20 }) => (
    <Icon name="calendar" size={size} color={color} />
  ),
  CalendarPrimary: ({ color = colors.primary, size = 20 }) => (
    <Icon name="calendar" size={size} color={color} />
  ),
  Users: ({ color = '#22C55E', size = 20 }) => (
    <Icon name="users" size={size} color={color} />
  ),
  User: ({ color = colors.white, size = 18 }) => (
    <Icon name="user" size={size} color={color} />
  ),
  MessageSquare: ({ color = colors.primary, size = 20 }) => (
    <Icon name="message-square" size={size} color={color} />
  ),
  MessageCircle: ({ color = colors.icon, size = 20 }) => (
    <Icon name="message-circle" size={size} color={color} />
  ),
  Briefcase: ({ color = '#F97316', size = 20 }) => (
    <Icon name="briefcase" size={size} color={color} />
  ),
  
  // Actions
  Send: ({ color = colors.white, size = 20 }) => (
    <Icon name="send" size={size} color={color} />
  ),
  Search: ({ color = colors.icon, size = 20 }) => (
    <Icon name="search" size={size} color={color} />
  ),
  Filter: ({ color = colors.icon, size = 20 }) => (
    <Icon name="filter" size={size} color={color} />
  ),
  Edit: ({ color = colors.icon, size = 20 }) => (
    <Icon name="edit-2" size={size} color={color} />
  ),
  Check: ({ color = '#22C55E', size = 20 }) => (
    <Icon name="check" size={size} color={color} />
  ),
  CheckCircle: ({ color = '#22C55E', size = 20 }) => (
    <Icon name="check-circle" size={size} color={color} />
  ),
  XCircle: ({ color = '#EF4444', size = 20 }) => (
    <Icon name="x-circle" size={size} color={color} />
  ),
  Plus: ({ color = colors.white, size = 20 }) => (
    <Icon name="plus" size={size} color={color} />
  ),
  
  // Information
  MapPin: ({ color = colors.white, size = 14 }) => (
    <Icon name="map-pin" size={size} color={color} />
  ),
  Clock: ({ color = colors.icon, size = 16 }) => (
    <Icon name="clock" size={size} color={color} />
  ),
  Info: ({ color = colors.icon, size = 20 }) => (
    <Icon name="info" size={size} color={color} />
  ),
  AlertCircle: ({ color = '#EF4444', size = 20 }) => (
    <Icon name="alert-circle" size={size} color={color} />
  ),
  
  // Profile & Settings
  Settings: ({ color = colors.icon, size = 20 }) => (
    <Icon name="settings" size={size} color={color} />
  ),
  LogOut: ({ color = colors.icon, size = 20 }) => (
    <Icon name="log-out" size={size} color={color} />
  ),
  Lock: ({ color = colors.icon, size = 20 }) => (
    <Icon name="lock" size={size} color={color} />
  ),
  Eye: ({ color = colors.icon, size = 20 }) => (
    <Icon name="eye" size={size} color={color} />
  ),
  EyeOff: ({ color = colors.icon, size = 20 }) => (
    <Icon name="eye-off" size={size} color={color} />
  ),
  Mail: ({ color = colors.icon, size = 20 }) => (
    <Icon name="mail" size={size} color={color} />
  ),
  Phone: ({ color = colors.icon, size = 20 }) => (
    <Icon name="phone" size={size} color={color} />
  ),
  
  // Lists & Organization
  List: ({ color = '#3B82F6', size = 24 }) => (
    <Icon name="list" size={size} color={color} />
  ),
  Grid: ({ color = colors.icon, size = 20 }) => (
    <Icon name="grid" size={size} color={color} />
  ),
  
  // Media
  Image: ({ color = colors.icon, size = 20 }) => (
    <Icon name="image" size={size} color={color} />
  ),
  Camera: ({ color = colors.icon, size = 20 }) => (
    <Icon name="camera" size={size} color={color} />
  ),
};
