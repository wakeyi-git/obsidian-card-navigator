/**
 * 디바운스 유틸리티
 * 
 * 짧은 시간 내 여러 번 호출되는 함수를 마지막 호출만 실행되도록 합니다.
 * 
 * @remarks
 * 드래그 앤 드롭 시 여러 파일 이벤트가 동시에 발생하여
 * 중복 렌더링이 일어나는 것을 방지합니다.
 * 
 * @example
 * ```typescript
 * const debouncedRender = debounce(async () => {
 *     await this.renderCards();
 * }, 500);
 * 
 * // 여러 번 호출해도 마지막 한 번만 실행됨
 * debouncedRender();
 * debouncedRender();
 * debouncedRender();
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return function(this: any, ...args: Parameters<T>) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const context = this;

        if (timeout) {
            clearTimeout(timeout);
        }

        timeout = setTimeout(() => {
            func.apply(context, args);
            timeout = null;
        }, wait);
    };
}

/**
 * 즉시 실행 디바운스
 * 
 * @param func - 디바운스할 함수
 * @param wait - 대기 시간 (밀리초)
 * @param immediate - true면 첫 호출 시 즉시 실행, false면 일반 디바운스
 * 
 * @remarks
 * immediate=true: 첫 호출은 즉시 실행, 이후 wait 시간 동안은 무시
 * immediate=false: 일반 debounce와 동일
 * 
 * @example
 * ```typescript
 * // 더블클릭 방지 (첫 클릭만 처리)
 * const handleClick = debounceImmediate(() => {
 *     console.log('Clicked!');
 * }, 1000, true);
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounceImmediate<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate: boolean = false
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return function(this: any, ...args: Parameters<T>) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const context = this;

        const callNow = immediate && !timeout;

        if (timeout) {
            clearTimeout(timeout);
        }

        timeout = setTimeout(() => {
            timeout = null;
            if (!immediate) {
                func.apply(context, args);
            }
        }, wait);

        if (callNow) {
            func.apply(context, args);
        }
    };
}

/**
 * 프로미스를 반환하는 비동기 함수용 디바운스
 * 
 * @remarks
 * debounce()와 다르게 async 함수에 최적화되어 있으며,
 * 마지막 호출의 결과를 Promise로 반환합니다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
    func: T,
    wait: number
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
    let timeout: NodeJS.Timeout | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let latestResolve: ((value: any) => void) | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let latestReject: ((reason?: any) => void) | null = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return function(this: any, ...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const context = this;

        // 이전 타임아웃 취소
        if (timeout) {
            clearTimeout(timeout);
            // 이전 프로미스는 취소됨을 알림
            if (latestReject) {
                latestReject(new Error('Debounced call cancelled'));
            }
        }

        // 새 프로미스 생성
        return new Promise((resolve, reject) => {
            latestResolve = resolve;
            latestReject = reject;

            timeout = setTimeout(async () => {
                try {
                    const result = await func.apply(context, args);
                    if (latestResolve) {
                        latestResolve(result);
                    }
                } catch (error) {
                    if (latestReject) {
                        latestReject(error);
                    }
                } finally {
                    timeout = null;
                    latestResolve = null;
                    latestReject = null;
                }
            }, wait);
        });
    };
}
