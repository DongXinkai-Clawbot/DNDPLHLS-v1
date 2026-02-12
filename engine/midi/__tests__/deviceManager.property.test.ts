import fc from 'fast-check';
import { isCompatibleDevice } from '../deviceManager';

describe('MIDI Device Manager - Property Tests', () => {
  
  describe('Property 1: Device Name Pattern Matching', () => {
    test('should identify devices with ARIUS in name as compatible', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          fc.string(),
          (prefix, suffix, caseVariant) => {
            
            const ariusVariants = ['ARIUS', 'Arius', 'arius', 'ArIuS', 'aRiUs'];
            const arius = ariusVariants[Math.floor(Math.random() * ariusVariants.length)];
            const deviceName = `${prefix}${arius}${suffix}`;
            
            const result = isCompatibleDevice(deviceName);
            
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should identify devices with "Digital Piano" in name as compatible', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          (prefix, suffix) => {
            
            const variants = [
              'Digital Piano',
              'digital piano',
              'DIGITAL PIANO',
              'Digital  Piano', 
              'DigitalPiano',
            ];
            const variant = variants[Math.floor(Math.random() * variants.length)];
            const deviceName = `${prefix}${variant}${suffix}`;
            
            const result = isCompatibleDevice(deviceName);
            
            const hasPattern = /Digital\s+Piano/i.test(deviceName);
            return result === hasPattern;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should identify devices with "Yamaha USB" in name as compatible', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          (prefix, suffix) => {
            
            const variants = [
              'Yamaha USB',
              'yamaha usb',
              'YAMAHA USB',
              'Yamaha  USB', 
              'YamahaUSB',
            ];
            const variant = variants[Math.floor(Math.random() * variants.length)];
            const deviceName = `${prefix}${variant}${suffix}`;
            
            const result = isCompatibleDevice(deviceName);
            
            const hasPattern = /Yamaha\s+USB/i.test(deviceName);
            return result === hasPattern;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should reject devices without compatible patterns', () => {
      fc.assert(
        fc.property(
          fc.string().filter(s => {
            
            const hasARIUS = /ARIUS/i.test(s);
            const hasDigitalPiano = /Digital\s+Piano/i.test(s);
            const hasYamahaUSB = /Yamaha\s+USB/i.test(s);
            return !hasARIUS && !hasDigitalPiano && !hasYamahaUSB;
          }),
          (deviceName) => {
            const result = isCompatibleDevice(deviceName);
            
            return result === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should handle empty strings correctly', () => {
      const result = isCompatibleDevice('');
      expect(result).toBe(false);
    });

    test('should handle whitespace-only strings correctly', () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 }),
          (whitespaceChars) => {
            const whitespace = whitespaceChars.join('');
            const result = isCompatibleDevice(whitespace);
            return result === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should be case-insensitive for all patterns', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('ARIUS', 'Digital Piano', 'Yamaha USB'),
          fc.boolean(),
          fc.boolean(),
          (pattern, upperPrefix, upperSuffix) => {
            
            const prefix = upperPrefix ? 'TEST_' : 'test_';
            const suffix = upperSuffix ? '_DEVICE' : '_device';
            
            const lowerCase = `${prefix}${pattern.toLowerCase()}${suffix}`;
            const upperCase = `${prefix}${pattern.toUpperCase()}${suffix}`;
            const mixedCase = `${prefix}${pattern}${suffix}`;
            
            const resultLower = isCompatibleDevice(lowerCase);
            const resultUpper = isCompatibleDevice(upperCase);
            const resultMixed = isCompatibleDevice(mixedCase);
            
            return resultLower === resultUpper && resultUpper === resultMixed && resultMixed === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    describe('Specific device examples', () => {
      test('should recognize Yamaha ARIUS YDP-144', () => {
        expect(isCompatibleDevice('Yamaha ARIUS YDP-144')).toBe(true);
      });

      test('should recognize generic Digital Piano', () => {
        expect(isCompatibleDevice('Roland Digital Piano')).toBe(true);
      });

      test('should recognize Yamaha USB MIDI', () => {
        expect(isCompatibleDevice('Yamaha USB MIDI Interface')).toBe(true);
      });

      test('should reject generic MIDI keyboard', () => {
        expect(isCompatibleDevice('Generic MIDI Keyboard')).toBe(false);
      });

      test('should reject Roland FP-30', () => {
        expect(isCompatibleDevice('Roland FP-30')).toBe(false);
      });

      test('should reject Korg microKEY', () => {
        expect(isCompatibleDevice('Korg microKEY')).toBe(false);
      });
    });
  });
});

