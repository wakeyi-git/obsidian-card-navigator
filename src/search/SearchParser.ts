import { SearchQuery, ParsedQuery } from '../types';

/**
 * 검색 쿼리 파서
 * 
 * 고급 검색 쿼리를 파싱하여 ParsedQuery 트리로 변환합니다.
 * Boolean 연산자(OR, NOT, 괄호)를 지원합니다.
 * 
 * @example
 * ```typescript
 * const parser = new SearchParser();
 * const parsed = parser.parse('tag:#project OR path:2025');
 * ```
 */
export class SearchParser {
    /**
     * 검색 쿼리를 파싱합니다
     * 
     * @param query - 검색 쿼리 문자열
     * @returns 파싱된 ParsedQuery 트리
     * 
     * @remarks
     * - Boolean 연산자가 없으면 단순 SearchQuery 배열을 AND로 연결한 트리를 반환
     * - 연산자 우선순위: () > NOT > AND > OR
     * - 공백은 AND 연산자로 처리
     */
    parse(query: string): ParsedQuery {
        if (!query || query.trim() === '') {
            return {
                type: 'search',
                search: { type: 'text', value: '' }
            };
        }

        // 1. 대소문자 구분 플래그 추출
        let caseSensitive: boolean | undefined;
        if (query.includes('match-case:')) {
            caseSensitive = true;
            query = query.replace(/match-case:/g, '').trim();
        }
        if (query.includes('ignore-case:')) {
            caseSensitive = false;
            query = query.replace(/ignore-case:/g, '').trim();
        }

        // 2. Boolean 연산자가 없으면 단순 파싱
        if (!this.hasBoolean(query)) {
            const searches = this.parseSimple(query);
            if (searches.length === 0) {
                return {
                    type: 'search',
                    search: { type: 'text', value: query },
                    caseSensitive
                };
            }
            if (searches.length === 1) {
                return {
                    type: 'search',
                    search: searches[0],
                    caseSensitive
                };
            }
            // 여러 검색어 = AND 연산
            return this.buildANDTree(searches, caseSensitive);
        }

        // 3. Boolean 표현식 파싱
        const parsed = this.parseExpression(query);
        if (caseSensitive !== undefined) {
            parsed.caseSensitive = caseSensitive;
        }
        
        return parsed;
    }

    /**
     * Boolean 연산자 포함 여부 확인
     */
    private hasBoolean(query: string): boolean {
        return /\bOR\b|^-|\s-|\(|\)/.test(query);
    }

    /**
     * Boolean 표현식을 파싱합니다
     * 
     * 우선순위: () > NOT > AND > OR
     */
    private parseExpression(query: string): ParsedQuery {
        return this.parseOR(query);
    }

    /**
     * OR 연산자 파싱 (가장 낮은 우선순위)
     */
    private parseOR(query: string): ParsedQuery {
        const parts = this.splitByOR(query);
        
        if (parts.length === 1) {
            return this.parseAND(parts[0]);
        }

        let root = this.parseAND(parts[0]);
        
        for (let i = 1; i < parts.length; i++) {
            root = {
                type: 'operator',
                operator: 'OR',
                left: root,
                right: this.parseAND(parts[i])
            };
        }

        return root;
    }

    /**
     * AND 연산자 파싱 (공백으로 구분)
     */
    private parseAND(query: string): ParsedQuery {
        const parts = this.splitByAND(query);
        
        if (parts.length === 1) {
            return this.parseNOT(parts[0]);
        }

        let root = this.parseNOT(parts[0]);
        
        for (let i = 1; i < parts.length; i++) {
            root = {
                type: 'operator',
                operator: 'AND',
                left: root,
                right: this.parseNOT(parts[i])
            };
        }

        return root;
    }

    /**
     * NOT 연산자 파싱
     */
    private parseNOT(query: string): ParsedQuery {
        query = query.trim();
        
        // -로 시작하면 NOT
        if (query.startsWith('-')) {
            return {
                type: 'operator',
                operator: 'NOT',
                right: this.parseTerm(query.substring(1).trim())
            };
        }

        return this.parseTerm(query);
    }

    /**
     * 개별 term 파싱 (괄호 또는 검색어)
     */
    private parseTerm(query: string): ParsedQuery {
        query = query.trim();

        // 괄호로 시작하면 괄호 안을 재귀 파싱
        if (query.startsWith('(')) {
            const endIndex = this.findMatchingParen(query, 0);
            if (endIndex !== -1) {
                const inner = query.substring(1, endIndex);
                return this.parseExpression(inner);
            }
        }

        // 단순 검색어
        const searches = this.parseSimple(query);
        if (searches.length === 0) {
            return {
                type: 'search',
                search: { type: 'text', value: query }
            };
        }
        if (searches.length === 1) {
            return {
                type: 'search',
                search: searches[0]
            };
        }
        
        return this.buildANDTree(searches, undefined);
    }

    /**
     * OR 연산자로 분리
     * 
     * @remarks
     * 괄호 안의 OR은 무시합니다
     */
    private splitByOR(query: string): string[] {
        const parts: string[] = [];
        let current = '';
        let depth = 0;
        let i = 0;

        while (i < query.length) {
            if (query[i] === '(') {
                depth++;
                current += query[i];
                i++;
            } else if (query[i] === ')') {
                depth--;
                current += query[i];
                i++;
            } else if (depth === 0 && query.substring(i, i + 3) === ' OR' && query[i + 3] === ' ') {
                if (current.trim()) {
                    parts.push(current.trim());
                }
                current = '';
                i += 4; // ' OR '를 건너뜀
            } else {
                current += query[i];
                i++;
            }
        }

        if (current.trim()) {
            parts.push(current.trim());
        }

        return parts.length > 0 ? parts : [query];
    }

    /**
     * AND 연산자로 분리 (공백으로 구분)
     * 
     * @remarks
     * - 괄호 안의 공백은 무시합니다
     * - 따옴표 안의 공백은 무시합니다
     * - 연산자 키워드(path:, tag: 등) 뒤의 값은 하나로 유지합니다
     */
    private splitByAND(query: string): string[] {
        const parts: string[] = [];
        let current = '';
        let depth = 0;
        let inQuotes = false;
        let quoteChar = '';

        for (let i = 0; i < query.length; i++) {
            const char = query[i];

            if (char === '"' || char === "'") {
                if (!inQuotes) {
                    inQuotes = true;
                    quoteChar = char;
                } else if (char === quoteChar) {
                    inQuotes = false;
                    quoteChar = '';
                }
                current += char;
            } else if (char === '(' && !inQuotes) {
                depth++;
                current += char;
            } else if (char === ')' && !inQuotes) {
                depth--;
                current += char;
            } else if (char === ' ' && depth === 0 && !inQuotes) {
                // 공백으로 분리
                if (current.trim()) {
                    parts.push(current.trim());
                    current = '';
                }
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            parts.push(current.trim());
        }

        return parts.length > 0 ? parts : [query];
    }

    /**
     * 매칭되는 닫는 괄호 찾기
     */
    private findMatchingParen(query: string, startIndex: number): number {
        let depth = 0;
        
        for (let i = startIndex; i < query.length; i++) {
            if (query[i] === '(') {
                depth++;
            } else if (query[i] === ')') {
                depth--;
                if (depth === 0) {
                    return i;
                }
            }
        }

        return -1; // 매칭되는 괄호 없음
    }

    /**
     * SearchQuery 배열을 AND 트리로 변환
     */
    private buildANDTree(searches: SearchQuery[], caseSensitive: boolean | undefined): ParsedQuery {
        if (searches.length === 1) {
            return {
                type: 'search',
                search: searches[0],
                caseSensitive
            };
        }

        let root: ParsedQuery = {
            type: 'search',
            search: searches[0],
            caseSensitive
        };

        for (let i = 1; i < searches.length; i++) {
            root = {
                type: 'operator',
                operator: 'AND',
                left: root,
                right: {
                    type: 'search',
                    search: searches[i],
                    caseSensitive
                },
                caseSensitive
            };
        }

        return root;
    }

    /**
     * 단순 검색어 파싱 (Boolean 연산자 없음)
     * 
     * @remarks
     * 기존 parse() 메서드의 로직을 유지합니다
     */
    private parseSimple(query: string): SearchQuery[] {
        const queries: SearchQuery[] = [];
        
        if (this.isAdvancedSearch(query)) {
            const tokens = this.tokenize(query);
            
            for (const token of tokens) {
                const parsed = this.parseToken(token);
                if (parsed) {
                    queries.push(parsed);
                }
            }
        } else {
            queries.push({
                type: 'text',
                value: query.trim()
            });
        }

        return queries;
    }

    /**
     * 고급 검색 여부를 판단합니다
     *
     * @param query - 검색 쿼리
     * @returns 고급 검색이면 true
     */
    isAdvancedSearch(query: string): boolean {
        const advancedPatterns = [
            /\bpath:/i,
            /\bfile:/i,
            /\btag:/i,
            /\bline:/i,
            /\bsection:/i,
            /\[[\w-]+\]:/,
            /\bcreated:/i,
            /\bmodified:/i,
            /\btask:/i,
            /\btask-todo:/i,
            /\btask-done:/i,
            /\bblock:/i,
            /\bcontent:/i,
            /\blink:/i,
            /\boutgoing-link:/i
        ];

        return advancedPatterns.some(pattern => pattern.test(query));
    }

    /**
     * 쿼리를 토큰으로 분리합니다
     */
    private tokenize(query: string): string[] {
        const tokens: string[] = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';

        for (let i = 0; i < query.length; i++) {
            const char = query[i];

            if (char === '"' || char === "'") {
                if (!inQuotes) {
                    inQuotes = true;
                    quoteChar = char;
                    current += char;
                } else if (char === quoteChar) {
                    inQuotes = false;
                    quoteChar = '';
                    current += char;
                } else {
                    current += char;
                }
            } else if (char === ' ' && !inQuotes) {
                if (current.trim()) {
                    tokens.push(current.trim());
                    current = '';
                }
            } else {
                current += char;
            }
        }

        if (current.trim()) {
            tokens.push(current.trim());
        }

        return tokens;
    }

    /**
     * 개별 토큰을 SearchQuery로 파싱합니다
     */
    private parseToken(token: string): SearchQuery | null {
        if (token.startsWith('path:')) {
            return {
                type: 'path',
                value: this.removeQuotes(token.substring(5))
            };
        }

        if (token.startsWith('file:')) {
            return {
                type: 'file',
                value: this.removeQuotes(token.substring(5))
            };
        }

        if (token.startsWith('tag:')) {
            let tagValue = this.removeQuotes(token.substring(4));
            if (!tagValue.startsWith('#')) {
                tagValue = '#' + tagValue;
            }
            return {
                type: 'tag',
                value: tagValue
            };
        }

        if (token.startsWith('line:')) {
            return {
                type: 'line',
                value: this.removeQuotes(token.substring(5))
            };
        }

        if (token.startsWith('section:')) {
            return {
                type: 'section',
                value: this.removeQuotes(token.substring(8))
            };
        }

        if (token.startsWith('created:')) {
            return {
                type: 'created',
                value: this.removeQuotes(token.substring(8))
            };
        }

        if (token.startsWith('modified:')) {
            return {
                type: 'modified',
                value: this.removeQuotes(token.substring(9))
            };
        }

        if (token.startsWith('task:')) {
            return {
                type: 'task',
                value: this.removeQuotes(token.substring(5))
            };
        }

        if (token.startsWith('task-todo:')) {
            return {
                type: 'task-todo',
                value: this.removeQuotes(token.substring(10))
            };
        }

        if (token.startsWith('task-done:')) {
            return {
                type: 'task-done',
                value: this.removeQuotes(token.substring(10))
            };
        }

        if (token.startsWith('block:')) {
            return {
                type: 'block',
                value: this.removeQuotes(token.substring(6))
            };
        }

        if (token.startsWith('content:')) {
            return {
                type: 'content',
                value: this.removeQuotes(token.substring(8))
            };
        }

        if (token.startsWith('link:')) {
            return {
                type: 'link',
                value: this.removeQuotes(token.substring(5))
            };
        }

        if (token.startsWith('outgoing-link:')) {
            return {
                type: 'outgoing-link',
                value: this.removeQuotes(token.substring(14))
            };
        }

        const propertyMatch = token.match(/^\[([\w-]+)\]:(.+)$/);
        if (propertyMatch) {
            return {
                type: 'property',
                propertyName: propertyMatch[1],
                value: this.removeQuotes(propertyMatch[2])
            };
        }

        return {
            type: 'text',
            value: this.removeQuotes(token)
        };
    }

    /**
     * 따옴표를 제거합니다
     */
    private removeQuotes(str: string): string {
        if ((str.startsWith('"') && str.endsWith('"')) ||
            (str.startsWith("'") && str.endsWith("'"))) {
            return str.slice(1, -1);
        }
        return str;
    }

    /**
     * 날짜 문자열을 Date 객체로 변환합니다
     * 
     * @param dateStr - 날짜 문자열 (YYYY-MM-DD, YYYY-MM, YYYY)
     * @returns Date 객체 또는 null
     * 
     * @remarks
     * - 유효하지 않은 날짜(예: 2025-13-01, 2025-02-30)는 null 반환
     * - Date 객체 생성 후 유효성 검증 수행
     */
    parseDate(dateStr: string): Date | null {
        try {
            let date: Date | null = null;
            let originalYear: number | null = null;
            let originalMonth: number | null = null;
            let originalDay: number | null = null;

            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                const [year, month, day] = dateStr.split('-').map(Number);
                originalYear = year;
                originalMonth = month;
                originalDay = day;
                date = new Date(dateStr);
            } else if (/^\d{4}-\d{2}$/.test(dateStr)) {
                const [year, month] = dateStr.split('-').map(Number);
                originalYear = year;
                originalMonth = month;
                originalDay = 1;
                date = new Date(dateStr + '-01');
            } else if (/^\d{4}$/.test(dateStr)) {
                originalYear = Number(dateStr);
                originalMonth = 1;
                originalDay = 1;
                date = new Date(dateStr + '-01-01');
            } else {
                return null;
            }

            // Date 객체가 유효한지 확인 (Invalid Date 체크)
            if (isNaN(date.getTime())) {
                return null;
            }

            // 입력한 날짜와 생성된 Date 객체의 날짜가 일치하는지 확인
            // (예: 2025-02-30은 2025-03-01로 변환되므로 invalid로 처리)
            if (originalYear !== null && originalMonth !== null && originalDay !== null) {
                if (
                    date.getFullYear() !== originalYear ||
                    date.getMonth() + 1 !== originalMonth ||  // getMonth()는 0-based
                    date.getDate() !== originalDay
                ) {
                    return null;
                }
            }

            return date;
        } catch (error) {
            return null;
        }
    }

    /**
     * 날짜 범위를 파싱합니다
     * 
     * @param rangeStr - 날짜 범위 문자열 (YYYY-MM-DD..YYYY-MM-DD)
     * @returns [시작일, 종료일] 또는 null
     */
    parseDateRange(rangeStr: string): [Date, Date] | null {
        const parts = rangeStr.split('..');
        if (parts.length !== 2) {
            return null;
        }

        const start = this.parseDate(parts[0].trim());
        const end = this.parseDate(parts[1].trim());

        if (!start || !end) {
            return null;
        }

        return [start, end];
    }
}
