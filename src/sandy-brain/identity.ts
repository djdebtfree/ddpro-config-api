import { config } from './config';
import { GhlContact, ContactRole, SandyBrainContact } from './types';

/**
 * Checks if a given email address belongs to an internal domain.
 * @param email The email address to check.
 * @returns True if the email's domain is in the INTERNAL_DOMAINS list, false otherwise.
 */
export function isInternalDomain(email?: string): boolean {
  if (!email) return false;
  const domain = email.split('@')[1];
  return config.INTERNAL_DOMAINS.includes(domain);
}

/**
 * Checks if a given phone number is an owner's phone number.
 * @param phone The phone number to check.
 * @returns True if the phone number is in the OWNER_PHONES list, false otherwise.
 */
export function isOwnerPhone(phone?: string): boolean {
  if (!phone) return false;
  // Normalize phone numbers for comparison (e.g., remove non-digits)
  const normalizedPhone = phone.replace(/\D/g, '');
  return config.OWNER_PHONES.some(ownerPhone => ownerPhone.replace(/\D/g, '') === normalizedPhone);
}

/**
 * Checks if a given email is an owner's email address.
 * @param email The email address to check.
 * @returns True if the email is in the OWNER_EMAILS list, false otherwise.
 */
export function isOwnerEmail(email?: string): boolean {
  if (!email) return false;
  return config.OWNER_EMAILS.includes(email.toLowerCase());
}

/**
 * Resolves the role of a contact based on their GHL data and internal configuration.
 * @param contact The GHL contact object.
 * @returns A SandyBrainContact object with the resolved role and flags.
 */
export function resolveContactRole(contact: GhlContact): SandyBrainContact {
  const isOwner = isOwnerPhone(contact.phone) || isOwnerEmail(contact.email);
  const isInternal = isInternalDomain(contact.email);

  let role: ContactRole = 'unknown';

  if (isOwner) {
    role = 'owner';
  } else if (isInternal) {
    role = 'internal';
  } else if (contact.tags?.includes('customer')) {
    role = 'customer';
  } else if (contact.tags?.includes('prospect')) {
    role = 'prospect';
  } else if (contact.tags?.includes('admin')) {
    role = 'admin';
  } else {
    // Default to prospect if no other role is determined and they have an email/phone
    if (contact.email || contact.phone) {
      role = 'prospect';
    }
  }

  return {
    ...contact,
    role,
    isOwner,
    isAdmin: role === 'admin',
    isInternal,
    isCustomer: role === 'customer',
    isProspect: role === 'prospect',
  };
}
