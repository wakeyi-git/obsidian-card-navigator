/**
 * SearchParser Boolean 연산자 테스트
 *
 * Boolean 연산자(OR, NOT, 괄호)를 지원하는 새로운 parse() API를 테스트합니다.
 */

import { SearchParser } from '../../src/search/SearchParser';
import { ParsedQuery } from '../../src/types';

describe('SearchParser - Boolean Operators', () => {
    let parser: SearchParser;

    beforeEach(() => {
        parser = new SearchParser();
    });

    describe('Simple queries without boolean operators', () => {
        it('should parse single search term', () => {
            const result = parser.parse('path:Projects');

            expect(result.type).toBe('search');
            expect(result.search).toMatchObject({
                type: 'path',
                value: 'Projects'
            });
        });

        it('should parse AND query (implicit with spaces)', () => {
            const result = parser.parse('path:Projects tag:#important');

            expect(result.type).toBe('operator');
            expect(result.operator).toBe('AND');
        });
    });

    describe('OR operator', () => {
        it('should parse simple OR query', () => {
            const result = parser.parse('tag:#work OR tag:#personal');

            expect(result.type).toBe('operator');
            expect(result.operator).toBe('OR');
            expect(result.left?.type).toBe('search');
            expect(result.right?.type).toBe('search');
        });

        it('should handle multiple OR operators', () => {
            const result = parser.parse('tag:#a OR tag:#b OR tag:#c');

            expect(result.type).toBe('operator');
            expect(result.operator).toBe('OR');
            // Left should be an OR tree, right should be search
            expect(result.left?.type).toBe('operator');
            expect(result.right?.type).toBe('search');
        });
    });

    describe('NOT operator', () => {
        it('should parse NOT with -', () => {
            const result = parser.parse('-tag:#archived');

            expect(result.type).toBe('operator');
            expect(result.operator).toBe('NOT');
            expect(result.right?.type).toBe('search');
        });

        it('should combine NOT with AND', () => {
            const result = parser.parse('path:Projects -tag:#done');

            expect(result.type).toBe('operator');
            expect(result.operator).toBe('AND');
        });
    });

    describe('Parentheses', () => {
        it('should parse grouped query', () => {
            const result = parser.parse('(tag:#work OR tag:#personal)');

            expect(result.type).toBe('operator');
            expect(result.operator).toBe('OR');
        });

        it('should combine groups with AND', () => {
            const result = parser.parse('(tag:#work OR tag:#personal) path:2024');

            expect(result.type).toBe('operator');
            expect(result.operator).toBe('AND');
            expect(result.left?.type).toBe('operator'); // grouped OR
            expect(result.right?.type).toBe('search'); // path search
        });
    });

    describe('Complex queries', () => {
        it('should handle complex nested boolean expression', () => {
            const result = parser.parse('(tag:#important OR file:urgent) -tag:#done path:Projects');

            expect(result.type).toBe('operator');
            // Should create a tree structure
        });

        it('should respect operator precedence', () => {
            // NOT > AND > OR
            const result = parser.parse('tag:#a OR tag:#b -tag:#c');

            expect(result.type).toBe('operator');
            expect(result.operator).toBe('OR');
        });
    });

    describe('Case sensitivity flags', () => {
        it('should parse match-case flag', () => {
            const result = parser.parse('match-case: test');

            expect(result.caseSensitive).toBe(true);
        });

        it('should parse ignore-case flag', () => {
            const result = parser.parse('ignore-case: TEST');

            expect(result.caseSensitive).toBe(false);
        });
    });

    describe('New search operators', () => {
        it('should parse task: operator', () => {
            const result = parser.parse('task:');

            expect(result.type).toBe('search');
            expect(result.search?.type).toBe('task');
        });

        it('should parse task-todo: operator', () => {
            const result = parser.parse('task-todo:meeting');

            expect(result.type).toBe('search');
            expect(result.search?.type).toBe('task-todo');
            expect(result.search?.value).toBe('meeting');
        });

        it('should parse block: operator', () => {
            const result = parser.parse('block:important');

            expect(result.type).toBe('search');
            expect(result.search?.type).toBe('block');
        });

        it('should parse content: operator', () => {
            const result = parser.parse('content:keyword');

            expect(result.type).toBe('search');
            expect(result.search?.type).toBe('content');
        });

        it('should parse link: operator', () => {
            const result = parser.parse('link:target-file');

            expect(result.type).toBe('search');
            expect(result.search?.type).toBe('link');
        });

        it('should parse outgoing-link: operator', () => {
            const result = parser.parse('outgoing-link:source-file');

            expect(result.type).toBe('search');
            expect(result.search?.type).toBe('outgoing-link');
        });
    });
});
