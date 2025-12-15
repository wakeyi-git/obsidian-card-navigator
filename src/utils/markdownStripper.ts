/**
 * 마크다운 문법 제거 유틸리티
 *
 * 마크다운 문법을 제거하고 순수 텍스트만 남깁니다.
 * 사용자 정의 필터도 지원합니다.
 */

/**
 * 마크다운 문법을 제거합니다
 *
 * @param text - 원본 텍스트
 * @param customFilters - 사용자 정의 필터 패턴 목록
 * @returns 마크다운 문법이 제거된 텍스트
 *
 * @remarks
 * 제거되는 문법:
 * - 헤더 마커 (#, ##, ###, etc.)
 * - 굵게 (**text** 또는 __text__)
 * - 기울임 (*text* 또는 _text_)
 * - 취소선 (~~text~~)
 * - 하이라이트 (==text==)
 * - 인라인 코드 (`code`)
 * - 위키 링크 ([[link]] 또는 [[link|alias]])
 * - 마크다운 링크 ([text](url))
 * - 이미지 (![alt](url))
 * - HTML 태그 (<tag>content</tag>)
 * - 코드 블록 (```code```)
 * - 블록 인용 (> text)
 * - 목록 마커 (-, *, 1.)
 * - 수평선 (---, ***, ___)
 * - 각주 ([^1])
 */
export function stripMarkdownSyntax(text: string, customFilters?: string[]): string {
    if (!text) return '';

    let result = text;

    // 1. 코드 블록 제거 (```...```) - 가장 먼저 처리
    result = result.replace(/```[\s\S]*?```/g, '');

    // 2. 인라인 코드 제거 (`code`) - 내용 유지
    result = result.replace(/`([^`]*)`/g, '$1');

    // 3. 이미지 제거 (![alt](url)) - 완전히 제거
    result = result.replace(/!\[[^\]]*\]\([^)]*\)/g, '');

    // 4. 위키 링크 처리 ([[link]] 또는 [[link|alias]])
    // [[link|alias]] -> alias (별칭이 있는 경우)
    result = result.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2');
    // [[link]] -> link (별칭이 없는 경우)
    result = result.replace(/\[\[([^\]]+)\]\]/g, '$1');

    // 5. 마크다운 링크 처리 ([text](url)) - 텍스트만 유지
    result = result.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');

    // 6. 굵게+기울임 제거 (***text*** 또는 ___text___) - 먼저 처리
    result = result.replace(/\*\*\*(.+?)\*\*\*/g, '$1');
    result = result.replace(/___(.+?)___/g, '$1');

    // 7. 굵게 제거 (**text** 또는 __text__)
    result = result.replace(/\*\*(.+?)\*\*/g, '$1');
    result = result.replace(/__(.+?)__/g, '$1');

    // 8. 기울임 제거 (*text* 또는 _text_)
    // 단어 중간의 _ (예: some_variable_name)는 유지
    result = result.replace(/\*(.+?)\*/g, '$1');
    // _text_ 패턴: 공백이나 줄 시작/끝 근처의 _만 처리
    result = result.replace(/(^|[\s])_([^_\s][^_]*[^_\s])_([\s]|$)/g, '$1$2$3');
    result = result.replace(/(^|[\s])_([^_\s])_([\s]|$)/g, '$1$2$3');

    // 9. 취소선 제거 (~~text~~)
    result = result.replace(/~~(.+?)~~/g, '$1');

    // 10. 하이라이트 제거 (==text==)
    result = result.replace(/==(.+?)==/g, '$1');

    // 11. 헤더 마커 제거 (# ## ### etc.)
    // 줄 시작 또는 공백 뒤의 헤더 마커 제거 (콘텐츠가 한 줄로 합쳐질 수 있음)
    result = result.replace(/^#{1,6}\s+/gm, '');
    result = result.replace(/\s#{1,6}\s+/g, ' ');

    // 12. 블록 인용 제거 (> text) - 줄 시작에서만
    result = result.replace(/^>\s*/gm, '');

    // 13. 목록 마커 제거
    // 순서 없는 목록 (-, *, +)
    result = result.replace(/^[\t ]*[-*+]\s+/gm, '');
    // 순서 있는 목록 (1. 2. 등)
    result = result.replace(/^[\t ]*\d+\.\s+/gm, '');

    // 14. 체크박스 제거 (- [ ] 또는 - [x])
    result = result.replace(/\[[ x]\]\s*/gi, '');

    // 15. 수평선 제거 (---, ***, ___)
    result = result.replace(/^[-*_]{3,}\s*$/gm, '');

    // 16. 각주 참조 제거 ([^1], [^note])
    result = result.replace(/\[\^[^\]]+\]/g, '');

    // 17. HTML 태그 제거 (<tag>, </tag>, <tag/>, <tag attr="value">)
    result = result.replace(/<\/?[a-zA-Z][^>]*\/?>/g, '');

    // 18. HTML 주석 제거 (<!-- comment -->)
    result = result.replace(/<!--[\s\S]*?-->/g, '');

    // 19. 사용자 정의 필터 적용
    if (customFilters && customFilters.length > 0) {
        for (const filter of customFilters) {
            if (filter && filter.trim()) {
                try {
                    // 특수 문자 이스케이프
                    const escapedFilter = escapeRegExp(filter.trim());
                    const regex = new RegExp(escapedFilter, 'g');
                    result = result.replace(regex, '');
                } catch {
                    // 잘못된 패턴은 무시
                }
            }
        }
    }

    // 20. 연속된 빈 줄을 하나로
    result = result.replace(/\n{3,}/g, '\n\n');

    // 21. 연속된 공백을 하나로 (줄바꿈은 유지)
    result = result.replace(/[^\S\n]+/g, ' ');

    // 22. 각 줄의 앞뒤 공백 제거
    result = result.split('\n').map(line => line.trim()).join('\n');

    // 23. 앞뒤 공백 제거
    result = result.trim();

    return result;
}

/**
 * 정규식 특수 문자를 이스케이프합니다
 *
 * @param string - 이스케이프할 문자열
 * @returns 이스케이프된 문자열
 */
function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 사용자 정의 필터 문자열을 파싱합니다
 *
 * @param filterString - 쉼표 또는 줄바꿈으로 구분된 필터 문자열
 * @returns 필터 배열
 */
export function parseCustomFilters(filterString: string): string[] {
    if (!filterString) return [];

    return filterString
        .split(/[,\n]/)
        .map(f => f.trim())
        .filter(f => f.length > 0);
}
