import { colors } from '../constants/theme';

/** Same palette as list cards — soft tints aligned with primary purple */
export const AGENDA_CARD_SURFACE_COLORS = [
  '#F5F0FA',
  '#EDE9FE',
  '#E0E7FF',
  '#DBEAFE',
  '#D1FAE5',
  '#CCFBF1',
  '#FEF3C7',
  '#FCE7F3',
  '#F3E8FF',
  '#E9D5FF',
  '#EFF6FF',
  '#FFF7ED',
];

export const AGENDA_SECTION_ACCENTS = {
  morning: '#FACC15',
  afternoon: '#FB923C',
  evening: '#C084FC',
};

export function agendaSurfaceIndexForId(id) {
  const s = String(id ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % AGENDA_CARD_SURFACE_COLORS.length;
}

/** Match AgendaScreen `groupAgendaByTime` — "HH:MM:SS" or leading hour */
export function agendaSectionAccentFromTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return AGENDA_SECTION_ACCENTS.evening;
  const hour = parseInt(String(timeStr).split(':')[0] || '0', 10);
  if (Number.isNaN(hour)) return AGENDA_SECTION_ACCENTS.evening;
  if (hour < 12) return AGENDA_SECTION_ACCENTS.morning;
  if (hour < 17) return AGENDA_SECTION_ACCENTS.afternoon;
  return AGENDA_SECTION_ACCENTS.evening;
}

/** Border for card body (list + detail) */
export function agendaCardBorderStyle(sectionAccent) {
  return {
    borderLeftWidth: 5,
    borderLeftColor: sectionAccent,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: colors.gray100,
    borderRightColor: colors.gray100,
    borderBottomColor: colors.gray100,
  };
}
