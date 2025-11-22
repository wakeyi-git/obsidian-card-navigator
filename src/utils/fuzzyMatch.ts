/**
 * 퍼지 매칭 유틸리티
 *
 * 검색어와 문자열 간의 유사도를 계산하고 퍼지 매칭을 수행합니다.
 */

/**
 * 퍼지 매칭 결과
 */
export interface FuzzyMatchResult {
    /** 매칭 여부 */
    matched: boolean;
    /** 매칭 점수 (0-1, 높을수록 좋음) */
    score: number;
    /** 매칭된 인덱스들 */
    indices: number[];
}

/**
 * 퍼지 매칭 옵션
 */
export interface FuzzyMatchOptions {
    /** 대소문자 구분 여부 (기본값: false) */
    caseSensitive?: boolean;
    /** 최소 점수 임계값 (기본값: 0.3) */
    threshold?: number;
    /** 연속 매칭 보너스 (기본값: 0.1) */
    sequentialBonus?: number;
    /** 시작 위치 보너스 (기본값: 0.1) */
    beginningBonus?: number;
}

const DEFAULT_OPTIONS: Required<FuzzyMatchOptions> = {
    caseSensitive: false,
    threshold: 0.3,
    sequentialBonus: 0.1,
    beginningBonus: 0.1
};

/**
 * 퍼지 매칭을 수행합니다
 *
 * @param pattern - 검색 패턴
 * @param text - 검색 대상 텍스트
 * @param options - 매칭 옵션
 * @returns 매칭 결과
 *
 * @example
 * ```typescript
 * fuzzyMatch('fb', 'foobar')        // { matched: true, score: 0.6, indices: [0, 3] }
 * fuzzyMatch('note', 'my-note')     // { matched: true, score: 0.7, indices: [3,4,5,6] }
 * fuzzyMatch('xyz', 'foobar')       // { matched: false, score: 0, indices: [] }
 * ```
 */
export function fuzzyMatch(
    pattern: string,
    text: string,
    options: FuzzyMatchOptions = {}
): FuzzyMatchResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (!pattern || !text) {
        return { matched: false, score: 0, indices: [] };
    }

    // 대소문자 구분 옵션 적용
    const searchPattern = opts.caseSensitive ? pattern : pattern.toLowerCase();
    const searchText = opts.caseSensitive ? text : text.toLowerCase();

    // 완전 일치 체크
    if (searchText === searchPattern) {
        return {
            matched: true,
            score: 1.0,
            indices: Array.from({ length: pattern.length }, (_, i) => i)
        };
    }

    // 포함 체크
    const exactIndex = searchText.indexOf(searchPattern);
    if (exactIndex !== -1) {
        const score = 0.9 + (exactIndex === 0 ? opts.beginningBonus : 0);
        return {
            matched: true,
            score: Math.min(score, 1.0),
            indices: Array.from({ length: pattern.length }, (_, i) => exactIndex + i)
        };
    }

    // 퍼지 매칭
    const result = fuzzyMatchInternal(searchPattern, searchText, opts);

    return result;
}

/**
 * 내부 퍼지 매칭 알고리즘
 *
 * @remarks
 * - 각 패턴 문자가 텍스트에서 순서대로 나타나야 함
 * - 연속된 매칭에 보너스 점수 부여
 * - 시작 위치 매칭에 보너스 점수 부여
 */
function fuzzyMatchInternal(
    pattern: string,
    text: string,
    options: Required<FuzzyMatchOptions>
): FuzzyMatchResult {
    const patternLen = pattern.length;
    const textLen = text.length;

    if (patternLen > textLen) {
        return { matched: false, score: 0, indices: [] };
    }

    const indices: number[] = [];
    let patternIdx = 0;
    let textIdx = 0;
    let totalScore = 0;

    // 각 패턴 문자를 순서대로 찾기
    while (patternIdx < patternLen && textIdx < textLen) {
        if (pattern[patternIdx] === text[textIdx]) {
            indices.push(textIdx);

            // 연속 매칭 보너스
            if (indices.length > 1 && indices[indices.length - 1] === indices[indices.length - 2] + 1) {
                totalScore += options.sequentialBonus;
            }

            // 시작 위치 보너스
            if (textIdx === 0) {
                totalScore += options.beginningBonus;
            }

            patternIdx++;
        }
        textIdx++;
    }

    // 모든 패턴 문자를 찾지 못한 경우
    if (patternIdx < patternLen) {
        return { matched: false, score: 0, indices: [] };
    }

    // 기본 점수 계산: 매칭 문자 수 / 텍스트 길이
    const baseScore = patternLen / textLen;

    // 최종 점수 = 기본 점수 + 보너스 점수
    const finalScore = Math.min(baseScore + totalScore, 1.0);

    // 임계값 체크
    if (finalScore < options.threshold) {
        return { matched: false, score: finalScore, indices: [] };
    }

    return {
        matched: true,
        score: finalScore,
        indices
    };
}

/**
 * 여러 텍스트에서 퍼지 매칭을 수행하고 점수순으로 정렬합니다
 *
 * @param pattern - 검색 패턴
 * @param items - 검색 대상 텍스트 배열
 * @param options - 매칭 옵션
 * @returns 매칭된 아이템과 점수 (점수 내림차순)
 *
 * @example
 * ```typescript
 * const items = ['foobar', 'foo', 'bar', 'baz'];
 * fuzzyFilter('fo', items);
 * // [
 * //   { text: 'foo', score: 0.8, indices: [0, 1] },
 * //   { text: 'foobar', score: 0.5, indices: [0, 1] }
 * // ]
 * ```
 */
export function fuzzyFilter<T>(
    pattern: string,
    items: T[],
    getText: (item: T) => string,
    options: FuzzyMatchOptions = {}
): Array<{ item: T; score: number; indices: number[] }> {
    const results: Array<{ item: T; score: number; indices: number[] }> = [];

    for (const item of items) {
        const text = getText(item);
        const match = fuzzyMatch(pattern, text, options);

        if (match.matched) {
            results.push({
                item,
                score: match.score,
                indices: match.indices
            });
        }
    }

    // 점수 내림차순 정렬
    results.sort((a, b) => b.score - a.score);

    return results;
}

/**
 * Levenshtein 거리를 계산합니다
 *
 * @param a - 첫 번째 문자열
 * @param b - 두 번째 문자열
 * @returns 편집 거리
 *
 * @remarks
 * 두 문자열 간의 최소 편집 횟수를 반환합니다.
 * 매우 긴 문자열의 경우 성능이 저하될 수 있습니다.
 */
export function levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];

    // 초기화
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    // 계산
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // 치환
                    matrix[i][j - 1] + 1,     // 삽입
                    matrix[i - 1][j] + 1      // 삭제
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * 유사도 점수를 계산합니다 (0-1)
 *
 * @param a - 첫 번째 문자열
 * @param b - 두 번째 문자열
 * @returns 유사도 점수 (1에 가까울수록 유사)
 *
 * @remarks
 * Levenshtein 거리를 기반으로 정규화된 유사도를 계산합니다.
 */
export function similarityScore(a: string, b: string): number {
    const distance = levenshteinDistance(a, b);
    const maxLen = Math.max(a.length, b.length);

    if (maxLen === 0) return 1.0;

    return 1 - (distance / maxLen);
}
