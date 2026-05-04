const { isValidEmail, isValidDni, isValidDate, isValidLoc } = require('../validation');

describe('Validation Functions', () => {
  describe('isValidEmail', () => {
    test('should return true for valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+alias@gmail.com')).toBe(true);
    });

    test('should return false for invalid email addresses', () => {
      expect(isValidEmail('plainaddress')).toBe(false);
      expect(isValidEmail('@missinguser.com')).toBe(false);
      expect(isValidEmail('user@missingdomain')).toBe(false);
      expect(isValidEmail('user@domain..com')).toBe(false);
      expect(isValidEmail('user @domain.com')).toBe(false);
    });

    test('should return false for empty or null/undefined input', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
    });
  });

  describe('isValidDni', () => {
    test('should return true for valid DNI formats', () => {
      expect(isValidDni('12345678A')).toBe(true);
      expect(isValidDni('87654321Z')).toBe(true);
      expect(isValidDni('00000000X')).toBe(true);
    });

    test('should return false for invalid DNI formats', () => {
      expect(isValidDni('1234567A')).toBe(false); // 7 digits
      expect(isValidDni('123456789A')).toBe(false); // 9 digits
      expect(isValidDni('12345678')).toBe(false); // missing letter
      expect(isValidDni('A12345678')).toBe(false); // letter at start
      expect(isValidDni('123456789')).toBe(false); // all digits
      expect(isValidDni('12.345.678A')).toBe(false); // dots
    });

    test('should return false for empty or null/undefined input', () => {
      expect(isValidDni('')).toBe(false);
      expect(isValidDni(null)).toBe(false);
      expect(isValidDni(undefined)).toBe(false);
    });
  });

  describe('isValidDate', () => {
    test('should return true for valid date format YYYY-MM-DD', () => {
      expect(isValidDate('2023-10-27')).toBe(true);
      expect(isValidDate('1990-01-01')).toBe(true);
      expect(isValidDate('2099-12-31')).toBe(true);
    });

    test('should return false for invalid date formats', () => {
      expect(isValidDate('27-10-2023')).toBe(false);
      expect(isValidDate('2023/10/27')).toBe(false);
      expect(isValidDate('2023.10.27')).toBe(false);
      expect(isValidDate('23-10-27')).toBe(false);
      expect(isValidDate('2023-1-1')).toBe(false);
      expect(isValidDate('not-a-date')).toBe(false);
    });

    test('should return false for empty or null/undefined input', () => {
      expect(isValidDate('')).toBe(false);
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
    });
  });

  describe('isValidLoc', () => {
    test('should return true for valid localizador formats', () => {
      expect(isValidLoc('ABC123')).toBe(true);
      expect(isValidLoc('XYZ7890123')).toBe(true);
      expect(isValidLoc('XYZ7890123'.slice(0, 10))).toBe(true);
      expect(isValidLoc('A')).toBe(true);
      expect(isValidLoc('1234567890')).toBe(true);
    });

    test('should return false for invalid localizador formats', () => {
      expect(isValidLoc('TOO-LONG-LOC')).toBe(false); // Hyphen
      expect(isValidLoc('loc with space')).toBe(false);
      expect(isValidLoc('lowercase')).toBe(false);
      expect(isValidLoc('ABC12345678')).toBe(false); // 11 chars
    });

    test('should return false for empty or null/undefined input', () => {
      expect(isValidLoc('')).toBe(false);
      expect(isValidLoc(null)).toBe(false);
      expect(isValidLoc(undefined)).toBe(false);
    });
  });
});
