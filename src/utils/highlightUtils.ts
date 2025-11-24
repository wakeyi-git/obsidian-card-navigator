import { SearchParser } from '../search/SearchParser';
import { ParsedQuery } from '../types';

/**
 * 하이라이트 옵션
 */
export interface HighlightOptions {
    /** 대소문자 구분 여부 */
    caseSensitive?: boolean;
    /** 하이라이트 CSS 클래스 */
    highlightClass?: string;
    /** HTML 이스케이프 여부 */
    escapeHtml?: boolean;
}

/**
 * HTML 텍스트를 이스케이프합니다
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 정규식 특수 문자를 이스케이프합니다
 */
function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 검색어를 추출합니다
 *
 * @param query - 원본 검색 쿼리
 * @returns 실제 검색어 배열
 *
 * @remarks
 * - "tag:mytag" → ["mytag"]
 * - "path:docs" → ["docs"]
 * - "content:hello world" → ["hello", "world"]
 * - "hello AND world" → ["hello", "world"]
 * - "complex query" → ["complex", "query"]
 */
export function extractSearchTerms(query: string): string[] {
    if (!query || query.trim() === '') {
        return [];
    }

    const parser = new SearchParser();
    let parsed: ParsedQuery;

    try {
        parsed = parser.parse(query);
    } catch {
        // 파싱 실패 시 단순 단어 분리
        return query
            .split(/\s+/)
            .filter(term => term.length > 0)
            .filter(term => !['AND', 'OR', 'NOT'].includes(term.toUpperCase()));
    }

    const terms: string[] = [];

    // ParsedQuery 트리를 순회하여 검색어 추출
    function extractFromTree(node: ParsedQuery): void {
        if (node.type === 'operator') {
            // 연산자 노드: 자식 노드들을 재귀적으로 처리
            if (node.operator === 'NOT') {
                // NOT 연산은 제외
                return;
            }
            if (node.left) {
                extractFromTree(node.left);
            }
            if (node.right) {
                extractFromTree(node.right);
            }
        } else if (node.type === 'search' && node.search) {
            // 검색 노드: 검색어 추출
            const q = node.search;

            // 검색 타입에 따라 처리
            switch (q.type) {
                case 'text':
                    // 기본 텍스트 검색
                    if (q.value && q.value.trim()) {
                        terms.push(q.value);
                    }
                    break;

                case 'tag':
                case 'path':
                case 'file':
                case 'content':
                case 'line':
                case 'section':
                    // 값만 추출
                    if (q.value && q.value.trim()) {
                        terms.push(q.value);
                    }
                    break;

                case 'property':
                    // 속성 값 추출
                    if (q.value && q.value.trim()) {
                        terms.push(q.value);
                    }
                    break;

                // 다른 검색 타입 (created, modified, task 등)은 하이라이트 대상이 아님
                default:
                    break;
            }
        }
    }

    extractFromTree(parsed);

    // 중복 제거 및 짧은 단어 필터링
    const uniqueTerms = [...new Set(terms)]
        .filter(term => term.length >= 2) // 최소 2글자 이상
        .sort((a, b) => b.length - a.length); // 긴 단어 우선 (부분 매칭 방지)

    return uniqueTerms;
}

/**
 * 텍스트에 검색어 하이라이트를 적용합니다
 *
 * @param text - 원본 텍스트
 * @param searchTerms - 하이라이트할 검색어 배열
 * @param options - 하이라이트 옵션
 * @returns 하이라이트가 적용된 HTML 문자열
 *
 * @example
 * ```typescript
 * const highlighted = highlightText('Hello world', ['world']);
 * // '<span class="search-highlight">world</span>'
 * ```
 */
export function highlightText(
    text: string,
    searchTerms: string[],
    options: HighlightOptions = {}
): string {
    if (!text || searchTerms.length === 0) {
        return options.escapeHtml ? escapeHtml(text) : text;
    }

    const {
        caseSensitive = false,
        highlightClass = 'search-highlight',
        escapeHtml: shouldEscape = true
    } = options;

    // 텍스트를 먼저 이스케이프
    let result = shouldEscape ? escapeHtml(text) : text;

    // 각 검색어에 대해 하이라이트 적용
    for (const term of searchTerms) {
        if (!term || term.trim() === '') continue;

        const escapedTerm = escapeRegex(term);
        const flags = caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(`(${escapedTerm})`, flags);

        result = result.replace(regex, `<mark class="${highlightClass}">$1</mark>`);
    }

    return result;
}

/**
 * HTML 요소 내의 텍스트 노드에 하이라이트를 적용합니다
 *
 * @param element - 대상 HTML 요소
 * @param searchTerms - 하이라이트할 검색어 배열
 * @param options - 하이라이트 옵션
 *
 * @remarks
 * DOM 트리를 순회하며 텍스트 노드에만 하이라이트를 적용합니다.
 * 기존 마크업을 보존하면서 안전하게 하이라이트를 추가합니다.
 *
 * @example
 * ```typescript
 * const div = document.createElement('div');
 * div.innerHTML = 'Hello <b>world</b>';
 * highlightInElement(div, ['world']);
 * // 결과: Hello <b><mark>world</mark></b>
 * ```
 */
export function highlightInElement(
    element: HTMLElement,
    searchTerms: string[],
    options: HighlightOptions = {}
): void {
    if (searchTerms.length === 0) return;

    const {
        caseSensitive = false,
        highlightClass = 'search-highlight'
    } = options;

    // 텍스트 노드만 처리
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null
    );

    const nodesToReplace: Array<{ node: Node; parent: Node }> = [];

    // 먼저 모든 텍스트 노드를 수집
    let node: Node | null = walker.nextNode();
    while (node) {
        if (node.nodeValue && node.nodeValue.trim()) {
            nodesToReplace.push({ node, parent: node.parentNode! });
        }
        node = walker.nextNode();
    }

    // 각 텍스트 노드에 하이라이트 적용
    for (const { node, parent } of nodesToReplace) {
        const text = node.nodeValue!;
        let hasMatch = false;
        let highlightedHtml = text;

        // 각 검색어 확인
        for (const term of searchTerms) {
            if (!term || term.trim() === '') continue;

            const escapedTerm = escapeRegex(term);
            const flags = caseSensitive ? 'g' : 'gi';
            const regex = new RegExp(`(${escapedTerm})`, flags);

            // test() 대신 직접 replace()를 사용하여 매칭 확인
            const replaced = highlightedHtml.replace(
                regex,
                `<mark class="${highlightClass}">$1</mark>`
            );

            if (replaced !== highlightedHtml) {
                hasMatch = true;
                highlightedHtml = replaced;
            }
        }

        // 매칭이 있으면 HTML로 교체
        if (hasMatch) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = highlightedHtml;

            // 텍스트 노드를 새 노드들로 교체
            while (tempDiv.firstChild) {
                parent.insertBefore(tempDiv.firstChild, node);
            }
            parent.removeChild(node);
        }
    }
}

/**
 * 요소에서 모든 하이라이트를 제거합니다
 *
 * @param element - 대상 HTML 요소
 * @param highlightClass - 제거할 하이라이트 CSS 클래스
 */
export function removeHighlights(element: HTMLElement, highlightClass: string = 'search-highlight'): void {
    const highlights = element.querySelectorAll(`mark.${highlightClass}`);

    highlights.forEach(mark => {
        const parent = mark.parentNode;
        if (parent) {
            // mark 태그의 내용을 텍스트 노드로 교체
            const textNode = document.createTextNode(mark.textContent || '');
            parent.replaceChild(textNode, mark);

            // 인접한 텍스트 노드 병합
            parent.normalize();
        }
    });
}
