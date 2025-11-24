/**
 * ⭐ 렌더링 성능 모니터링 (Phase 4.1)
 *
 * 렌더링 성능을 측정하고 bottleneck을 감지합니다.
 *
 * @remarks
 * - 렌더링 시간 측정 (60fps 기준 16.67ms 초과 시 경고)
 * - Layout thrashing 감지 (연속된 reflow 횟수 추적)
 * - 성능 메트릭 수집 및 리포트 생성
 * - Phase 3 최적화 효과 측정용 인프라
 */

export interface RenderMetrics {
    /** 렌더링 시작 시간 (performance.now()) */
    startTime: number;

    /** 렌더링 종료 시간 (performance.now()) */
    endTime: number;

    /** 렌더링 소요 시간 (ms) */
    duration: number;

    /** 렌더링된 카드 수 */
    cardCount: number;

    /** 렌더링된 그룹 수 */
    groupCount: number;

    /** 렌더링 유형 */
    renderType: 'standard' | 'viewport' | 'group-expand' | 'incremental';

    /** 레이아웃 thrashing 발생 여부 */
    layoutThrashing: boolean;

    /** Reflow 횟수 (추정) */
    estimatedReflows: number;

    /** 60fps 기준 초과 여부 (16.67ms) */
    exceeds60fps: boolean;

    /** 타임스탬프 */
    timestamp: number;
}

export interface PerformanceReport {
    /** 전체 렌더링 횟수 */
    totalRenders: number;

    /** 평균 렌더링 시간 (ms) */
    avgDuration: number;

    /** 최소 렌더링 시간 (ms) */
    minDuration: number;

    /** 최대 렌더링 시간 (ms) */
    maxDuration: number;

    /** 60fps 기준 초과 횟수 */
    slowRenderCount: number;

    /** Layout thrashing 발생 횟수 */
    layoutThrashingCount: number;

    /** 렌더링 유형별 통계 */
    byType: Record<RenderMetrics['renderType'], {
        count: number;
        avgDuration: number;
        slowCount: number;
    }>;

    /** 최근 10개 렌더링 메트릭 */
    recentMetrics: RenderMetrics[];
}

export class RenderProfiler {
    /** 수집된 메트릭 (최대 100개 유지) */
    private metrics: RenderMetrics[] = [];

    /** 최대 메트릭 보관 개수 */
    private readonly MAX_METRICS = 100;

    /** 60fps 기준 프레임 시간 (ms) */
    private readonly TARGET_FRAME_TIME = 16.67;

    /** Layout thrashing 감지 임계값 (연속 reflow 횟수) */
    private readonly THRASHING_THRESHOLD = 5;

    /** 프로파일링 활성화 여부 */
    private enabled = false;

    /** 현재 측정 중인 렌더링 */
    private currentMeasurement: {
        startTime: number;
        renderType: RenderMetrics['renderType'];
        cardCount: number;
        groupCount: number;
        reflows: number;
    } | null = null;

    /**
     * 프로파일러를 활성화합니다
     */
    enable(): void {
        this.enabled = true;
    }

    /**
     * 프로파일러를 비활성화합니다
     */
    disable(): void {
        this.enabled = false;
    }

    /**
     * 프로파일러가 활성화되어 있는지 확인합니다
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * ⭐ 렌더링 측정을 시작합니다
     *
     * @param renderType - 렌더링 유형
     * @param cardCount - 렌더링할 카드 수
     * @param groupCount - 렌더링할 그룹 수
     */
    startMeasure(
        renderType: RenderMetrics['renderType'],
        cardCount: number,
        groupCount: number
    ): void {
        if (!this.enabled) return;

        this.currentMeasurement = {
            startTime: performance.now(),
            renderType,
            cardCount,
            groupCount,
            reflows: 0
        };
    }

    /**
     * ⭐ 렌더링 측정을 종료하고 메트릭을 저장합니다
     */
    endMeasure(): void {
        if (!this.enabled || !this.currentMeasurement) return;

        const endTime = performance.now();
        const duration = endTime - this.currentMeasurement.startTime;
        const estimatedReflows = this.currentMeasurement.reflows;
        const layoutThrashing = estimatedReflows > this.THRASHING_THRESHOLD;
        const exceeds60fps = duration > this.TARGET_FRAME_TIME;

        const metric: RenderMetrics = {
            startTime: this.currentMeasurement.startTime,
            endTime,
            duration,
            cardCount: this.currentMeasurement.cardCount,
            groupCount: this.currentMeasurement.groupCount,
            renderType: this.currentMeasurement.renderType,
            layoutThrashing,
            estimatedReflows,
            exceeds60fps,
            timestamp: Date.now()
        };

        // 메트릭 저장 (최대 개수 유지)
        this.metrics.push(metric);
        if (this.metrics.length > this.MAX_METRICS) {
            this.metrics.shift();
        }

        // 성능 이슈 경고
        if (exceeds60fps) {
            console.warn(
                `[RenderProfiler] Slow render detected: ${duration.toFixed(2)}ms ` +
                `(${this.currentMeasurement.renderType}, ${this.currentMeasurement.cardCount} cards)`
            );
        }

        if (layoutThrashing) {
            console.warn(
                `[RenderProfiler] Layout thrashing detected: ${estimatedReflows} reflows ` +
                `(${this.currentMeasurement.renderType})`
            );
        }

        this.currentMeasurement = null;
    }

    /**
     * Reflow 횟수를 기록합니다 (DOM read-write 패턴 감지)
     */
    recordReflow(): void {
        if (!this.enabled || !this.currentMeasurement) return;

        this.currentMeasurement.reflows++;
    }

    /**
     * ⭐ 성능 리포트를 생성합니다
     *
     * @returns 성능 통계 리포트
     */
    exportReport(): PerformanceReport {
        if (this.metrics.length === 0) {
            return {
                totalRenders: 0,
                avgDuration: 0,
                minDuration: 0,
                maxDuration: 0,
                slowRenderCount: 0,
                layoutThrashingCount: 0,
                byType: {
                    'standard': { count: 0, avgDuration: 0, slowCount: 0 },
                    'viewport': { count: 0, avgDuration: 0, slowCount: 0 },
                    'group-expand': { count: 0, avgDuration: 0, slowCount: 0 },
                    'incremental': { count: 0, avgDuration: 0, slowCount: 0 }
                },
                recentMetrics: []
            };
        }

        const durations = this.metrics.map(m => m.duration);
        const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
        const minDuration = Math.min(...durations);
        const maxDuration = Math.max(...durations);
        const slowRenderCount = this.metrics.filter(m => m.exceeds60fps).length;
        const layoutThrashingCount = this.metrics.filter(m => m.layoutThrashing).length;

        // 렌더링 유형별 통계
        const byType: PerformanceReport['byType'] = {
            'standard': { count: 0, avgDuration: 0, slowCount: 0 },
            'viewport': { count: 0, avgDuration: 0, slowCount: 0 },
            'group-expand': { count: 0, avgDuration: 0, slowCount: 0 },
            'incremental': { count: 0, avgDuration: 0, slowCount: 0 }
        };

        for (const metric of this.metrics) {
            const typeStats = byType[metric.renderType];
            typeStats.count++;
            typeStats.avgDuration = (
                (typeStats.avgDuration * (typeStats.count - 1) + metric.duration) /
                typeStats.count
            );
            if (metric.exceeds60fps) {
                typeStats.slowCount++;
            }
        }

        // 최근 10개 메트릭
        const recentMetrics = this.metrics.slice(-10);

        return {
            totalRenders: this.metrics.length,
            avgDuration,
            minDuration,
            maxDuration,
            slowRenderCount,
            layoutThrashingCount,
            byType,
            recentMetrics
        };
    }

    /**
     * 수집된 메트릭을 초기화합니다
     */
    clearMetrics(): void {
        this.metrics = [];
        this.currentMeasurement = null;
    }

    /**
     * 성능 리포트를 콘솔에 출력합니다
     */
    printReport(): void {
        const report = this.exportReport();

        console.group('[RenderProfiler] Performance Report');
        console.log(`Total Renders: ${report.totalRenders}`);
        console.log(`Average Duration: ${report.avgDuration.toFixed(2)}ms`);
        console.log(`Min Duration: ${report.minDuration.toFixed(2)}ms`);
        console.log(`Max Duration: ${report.maxDuration.toFixed(2)}ms`);
        console.log(`Slow Renders (>16.67ms): ${report.slowRenderCount} (${((report.slowRenderCount / report.totalRenders) * 100).toFixed(1)}%)`);
        console.log(`Layout Thrashing: ${report.layoutThrashingCount} (${((report.layoutThrashingCount / report.totalRenders) * 100).toFixed(1)}%)`);

        console.group('By Render Type:');
        for (const [type, stats] of Object.entries(report.byType)) {
            if (stats.count > 0) {
                console.log(
                    `  ${type}: ${stats.count} renders, ` +
                    `avg ${stats.avgDuration.toFixed(2)}ms, ` +
                    `${stats.slowCount} slow`
                );
            }
        }
        console.groupEnd();

        console.group('Recent Metrics (last 10):');
        for (const metric of report.recentMetrics) {
            const warning = metric.exceeds60fps ? ' ⚠️' : '';
            const thrashing = metric.layoutThrashing ? ' 🔄' : '';
            console.log(
                `  ${metric.renderType}: ${metric.duration.toFixed(2)}ms ` +
                `(${metric.cardCount} cards)${warning}${thrashing}`
            );
        }
        console.groupEnd();

        console.groupEnd();
    }
}
