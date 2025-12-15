const DEFAULT_CONTACTS = [
  {
    id: 'alice',
    name: 'Alice Johnson',
    phone: '+1 (555) 123-4567',
    color: '#9333EA',
    initials: 'A',
  },
  {
    id: 'alex',
    name: 'Alex Smith',
    phone: '+1 (555) 987-6543',
    color: '#2563EB',
    initials: 'A',
  },
  {
    id: 'bob',
    name: 'Bob Wilson',
    phone: '+1 (555) 246-8135',
    color: '#22C55E',
    initials: 'B',
  },
  {
    id: 'betty',
    name: 'Betty Davis',
    phone: '+1 (555) 369-2580',
    color: '#EC4899',
    initials: 'B',
  },
  {
    id: 'charlie',
    name: 'Charlie Brown',
    phone: '+1 (555) 147-2583',
    color: '#F59E0B',
    initials: 'C',
  },
  {
    id: 'catherine',
    name: 'Catherine Lee',
    phone: '+1 (555) 741-9630',
    color: '#8B5CF6',
    initials: 'C',
  },
];

let contacts = [...DEFAULT_CONTACTS];
const listeners = new Set();

const notify = () => {
  listeners.forEach((listener) => {
    try {
      listener(contacts);
    } catch (error) {
      console.warn('contactStore listener error', error);
    }
  });
};

const palette = ['#9333EA', '#2563EB', '#22C55E', '#EC4899', '#F59E0B', '#8B5CF6', '#14B8A6'];

const getInitials = (name = '') => {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return 'C';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const normalizeContact = (contact) => {
  const initials = contact.initials || getInitials(contact.name);
  const color =
    contact.color || palette[Math.abs(initials.charCodeAt(0) + initials.charCodeAt(initials.length - 1)) % palette.length];

  return {
    id: contact.id || `${Date.now()}`,
    name: contact.name || 'Unnamed Contact',
    phone: contact.phone || 'N/A',
    email: contact.email || '',
    initials,
    color,
  };
};

export const contactStore = {
  getContacts: () => contacts,
  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  addContact: (contact) => {
    const normalized = normalizeContact(contact);

    const exists = contacts.some(
      (item) =>
        item.name.toLowerCase() === normalized.name.toLowerCase() &&
        item.phone.replace(/\D/g, '') === normalized.phone.replace(/\D/g, '')
    );
    if (exists) {
      notify();
      return normalized;
    }

    contacts = [...contacts, normalized].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
    notify();
    return normalized;
  },
  removeContact: (id) => {
    contacts = contacts.filter((item) => item.id !== id);
    notify();
  },
};

export default contactStore;

