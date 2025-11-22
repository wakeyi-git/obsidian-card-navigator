/**
 * Type Guards 테스트
 */

import {
    isDefined,
    isValidFile,
    hasParent,
    isTFile,
    isTFolder,
    isNonEmptyArray,
    isNonEmptyString,
    isValidElement,
    isInRange,
    hasProperty
} from '../../src/utils/typeGuards';
import { TFile, TFolder } from 'obsidian';

describe('typeGuards', () => {
    describe('isDefined', () => {
        it('should return true for defined values', () => {
            expect(isDefined('')).toBe(true);
            expect(isDefined(0)).toBe(true);
            expect(isDefined(false)).toBe(true);
            expect(isDefined([])).toBe(true);
            expect(isDefined({})).toBe(true);
        });
        
        it('should return false for null and undefined', () => {
            expect(isDefined(null)).toBe(false);
            expect(isDefined(undefined)).toBe(false);
        });
    });
    
    describe('isValidFile', () => {
        it('should return true for valid TFile', () => {
            const file = new TFile();
            file.path = 'test.md';
            expect(isValidFile(file)).toBe(true);
        });
        
        it('should return false for null and undefined', () => {
            expect(isValidFile(null)).toBe(false);
            expect(isValidFile(undefined)).toBe(false);
        });
    });
    
    describe('hasParent', () => {
        it('should return true when file has parent', () => {
            const file = new TFile();
            file.path = 'folder/test.md';
            const folder = new TFolder();
            folder.path = 'folder';
            file.parent = folder;
            
            expect(hasParent(file)).toBe(true);
        });
        
        it('should return false when file has no parent', () => {
            const file = new TFile();
            file.path = 'test.md';
            file.parent = null;
            
            expect(hasParent(file)).toBe(false);
        });
    });
    
    describe('isTFile', () => {
        it('should return true for TFile instance', () => {
            const file = new TFile();
            file.path = 'test.md';
            expect(isTFile(file)).toBe(true);
        });
        
        it('should return false for TFolder instance', () => {
            const folder = new TFolder();
            folder.path = 'folder';
            expect(isTFile(folder)).toBe(false);
        });
        
        it('should return false for null and undefined', () => {
            expect(isTFile(null)).toBe(false);
            expect(isTFile(undefined)).toBe(false);
        });
    });
    
    describe('isTFolder', () => {
        it('should return true for TFolder instance', () => {
            const folder = new TFolder();
            folder.path = 'folder';
            expect(isTFolder(folder)).toBe(true);
        });
        
        it('should return false for TFile instance', () => {
            const file = new TFile();
            file.path = 'test.md';
            expect(isTFolder(file)).toBe(false);
        });
        
        it('should return false for null and undefined', () => {
            expect(isTFolder(null)).toBe(false);
            expect(isTFolder(undefined)).toBe(false);
        });
    });
    
    describe('isNonEmptyArray', () => {
        it('should return true for non-empty arrays', () => {
            expect(isNonEmptyArray([1])).toBe(true);
            expect(isNonEmptyArray([1, 2, 3])).toBe(true);
            expect(isNonEmptyArray(['a', 'b'])).toBe(true);
        });
        
        it('should return false for empty arrays', () => {
            expect(isNonEmptyArray([])).toBe(false);
        });
        
        it('should return false for null and undefined', () => {
            expect(isNonEmptyArray(null)).toBe(false);
            expect(isNonEmptyArray(undefined)).toBe(false);
        });
        
        it('should return false for non-arrays', () => {
            expect(isNonEmptyArray('not an array' as any)).toBe(false);
            expect(isNonEmptyArray(123 as any)).toBe(false);
            expect(isNonEmptyArray({} as any)).toBe(false);
        });
    });
    
    describe('isNonEmptyString', () => {
        it('should return true for non-empty strings', () => {
            expect(isNonEmptyString('hello')).toBe(true);
            expect(isNonEmptyString('  text  ')).toBe(true);  // 공백 포함
        });
        
        it('should return false for empty or whitespace strings', () => {
            expect(isNonEmptyString('')).toBe(false);
            expect(isNonEmptyString('   ')).toBe(false);  // 공백만
            expect(isNonEmptyString('\t')).toBe(false);
            expect(isNonEmptyString('\n')).toBe(false);
        });
        
        it('should return false for null and undefined', () => {
            expect(isNonEmptyString(null)).toBe(false);
            expect(isNonEmptyString(undefined)).toBe(false);
        });
        
        it('should return false for non-strings', () => {
            expect(isNonEmptyString(123 as any)).toBe(false);
            expect(isNonEmptyString([] as any)).toBe(false);
            expect(isNonEmptyString({} as any)).toBe(false);
        });
    });
    
    describe('isValidElement', () => {
        it('should return true for valid HTMLElement-like object', () => {
            // Mock HTMLElement (node 환경에서는 실제 DOM이 없으므로 mock 사용)
            const mockElement = Object.create(HTMLElement.prototype);
            expect(isValidElement(mockElement)).toBe(true);
        });
        
        it('should return false for null and undefined', () => {
            expect(isValidElement(null)).toBe(false);
            expect(isValidElement(undefined)).toBe(false);
        });
        
        it('should return false for non-HTMLElement objects', () => {
            expect(isValidElement({} as any)).toBe(false);
            expect(isValidElement({ nodeType: 1 } as any)).toBe(false);
        });
    });
    
    describe('isInRange', () => {
        it('should return true for values in range', () => {
            expect(isInRange(5, 0, 10)).toBe(true);
            expect(isInRange(0, 0, 10)).toBe(true);  // 경계값 (하한)
            expect(isInRange(10, 0, 10)).toBe(true); // 경계값 (상한)
        });
        
        it('should return false for values out of range', () => {
            expect(isInRange(-1, 0, 10)).toBe(false);
            expect(isInRange(11, 0, 10)).toBe(false);
        });
        
        it('should return false for NaN', () => {
            expect(isInRange(NaN, 0, 10)).toBe(false);
        });
        
        it('should handle negative ranges', () => {
            expect(isInRange(-5, -10, 0)).toBe(true);
            expect(isInRange(-11, -10, 0)).toBe(false);
        });
        
        it('should handle decimal numbers', () => {
            expect(isInRange(0.5, 0, 1)).toBe(true);
            expect(isInRange(1.5, 0, 1)).toBe(false);
        });
    });
    
    describe('hasProperty', () => {
        it('should return true when object has property', () => {
            const obj = { name: 'test', value: 123 };
            
            expect(hasProperty(obj, 'name')).toBe(true);
            expect(hasProperty(obj, 'value')).toBe(true);
        });
        
        it('should return false when object does not have property', () => {
            const obj = { name: 'test' };
            
            expect(hasProperty(obj, 'nonexistent')).toBe(false);
        });
        
        it('should work with different types of keys', () => {
            const obj = {
                stringKey: 'value',
                123: 'numeric key',
                [Symbol('test')]: 'symbol key'
            };
            
            expect(hasProperty(obj, 'stringKey')).toBe(true);
            expect(hasProperty(obj, 123)).toBe(true);
        });
        
        it('should work with nested objects', () => {
            const obj = {
                nested: {
                    deep: 'value'
                }
            };
            
            expect(hasProperty(obj, 'nested')).toBe(true);
            
            if (hasProperty(obj, 'nested') && typeof obj.nested === 'object') {
                expect(hasProperty(obj.nested, 'deep')).toBe(true);
            }
        });
        
        it('should return true for inherited properties from prototype', () => {
            const obj = Object.create({ inherited: 'value' });
            
            // 'inherited'는 프로토타입 체인에 있음
            expect(hasProperty(obj, 'inherited')).toBe(true); // 'in' 연산자는 프로토타입 체인도 검사
        });
    });
});
