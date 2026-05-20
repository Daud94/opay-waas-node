import { v4 as uuidv4 } from 'uuid';

export class OPaySanitizer {
  /**
   * Sanitizes refId to ensure it is exactly 15 alphanumeric characters.
   * Strips out any hyphens, underscores, or non-alphanumeric characters.
   */
  static sanitizeRefId(refId?: string): string {
    const rawRefId = refId || uuidv4();
    const cleanRefId = rawRefId.replace(/[^a-zA-Z0-9]/g, '');
    return cleanRefId.slice(0, 15).padEnd(15, '0');
  }

  /**
   * Truncates customer name strictly under 20 characters and cuts at a word
   * boundary to ensure OPay gateway doesn't reject it.
   */
  static sanitizeName(firstName: string, lastName: string): string {
    const fullName = `${firstName} ${lastName}`.trim();
    let name = fullName;
    
    if (name.length > 20) {
      const truncated = name.slice(0, 20);
      const lastSpace = truncated.lastIndexOf(' ');
      name = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
    }
    
    return name.trim();
  }

  /**
   * Strips all non-digit characters from the phone number (such as leading "+").
   */
  static sanitizePhone(phone?: string): string {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
  }

  /**
   * Strips out any plus signs (+) from the email string to prevent API validation failure.
   */
  static sanitizeEmail(email?: string): string {
    if (!email) return '';
    return email.replace(/\+/g, '');
  }
}
