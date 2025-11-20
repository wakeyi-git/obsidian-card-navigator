import { TFile, TFolder, TAbstractFile } from 'obsidian';

/**
 * 타입 가드 유틸리티 함수들
 * 
 * TypeScript의 타입 narrowing을 활용하여 안전한 타입 체크를 제공합니다.
 * 이 함수들을 사용하면 null 체크를 간결하게 하고 타입 안정성을 향상시킬 수 있습니다.
 */

/**
 * 값이 null이나 undefined가 아닌지 확인합니다
 * 
 * @param value - 확인할 값
 * @returns value가 null이나 undefined가 아니면 true
 * 
 * @example
 * const value: string | null | undefined = getSomeValue();
 * if (isDefined(value)) {
 *     // value는 string 타입으로 좁혀짐
 *     console.log(value.length);
 * }
 */
export function isDefined<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}

/**
 * 파일이 유효한 TFile인지 확인합니다
 * 
 * @param file - 확인할 파일
 * @returns file이 유효한 TFile이면 true
 * 
 * @example
 * const file = this.app.workspace.getActiveFile();
 * if (isValidFile(file)) {
 *     // file은 TFile 타입으로 좁혀짐
 *     console.log(file.path);
 * }
 */
export function isValidFile(file: TFile | null | undefined): file is TFile {
    return file !== null && file !== undefined;
}

/**
 * 파일이 parent를 가지고 있는지 확인합니다
 * 
 * @param file - 확인할 파일
 * @returns file이 parent를 가지고 있으면 true
 * 
 * @example
 * if (isValidFile(file) && hasParent(file)) {
 *     // file.parent는 TFolder 타입으로 보장됨
 *     const folderPath = file.parent.path;
 * }
 */
export function hasParent(file: TFile): file is TFile & { parent: TFolder } {
    return file.parent !== null && file.parent !== undefined;
}

/**
 * Abstract 파일이 실제 TFile인지 확인합니다
 * 
 * @param file - 확인할 파일
 * @returns file이 TFile이면 true
 * 
 * @example
 * const abstractFile = this.app.vault.getAbstractFileByPath(path);
 * if (isTFile(abstractFile)) {
 *     // abstractFile은 TFile 타입으로 좁혀짐
 *     await this.app.vault.read(abstractFile);
 * }
 */
export function isTFile(file: TAbstractFile | null | undefined): file is TFile {
    return file instanceof TFile;
}

/**
 * Abstract 파일이 TFolder인지 확인합니다
 * 
 * @param file - 확인할 파일
 * @returns file이 TFolder이면 true
 * 
 * @example
 * const abstractFile = this.app.vault.getAbstractFileByPath(path);
 * if (isTFolder(abstractFile)) {
 *     // abstractFile은 TFolder 타입으로 좁혀짐
 *     const children = abstractFile.children;
 * }
 */
export function isTFolder(file: TAbstractFile | null | undefined): file is TFolder {
    return file instanceof TFolder;
}

/**
 * 배열이 비어있지 않은지 확인합니다
 * 
 * @param array - 확인할 배열
 * @returns 배열이 비어있지 않으면 true
 * 
 * @example
 * const items: Item[] | null = getItems();
 * if (isNonEmptyArray(items)) {
 *     // items는 [Item, ...Item[]] 타입으로 좁혀짐 (최소 1개 보장)
 *     const firstItem = items[0]; // 안전!
 * }
 */
export function isNonEmptyArray<T>(array: T[] | null | undefined): array is [T, ...T[]] {
    return Array.isArray(array) && array.length > 0;
}

/**
 * 문자열이 비어있지 않은지 확인합니다
 * 
 * @param str - 확인할 문자열
 * @returns 문자열이 비어있지 않으면 true
 * 
 * @example
 * const query: string | null = getSearchQuery();
 * if (isNonEmptyString(query)) {
 *     // query는 string 타입으로 좁혀지고, 빈 문자열이 아님이 보장됨
 *     performSearch(query);
 * }
 */
export function isNonEmptyString(str: string | null | undefined): str is string {
    return typeof str === 'string' && str.trim().length > 0;
}

/**
 * HTMLElement가 유효한지 확인합니다
 * 
 * @param element - 확인할 요소
 * @returns element가 유효한 HTMLElement이면 true
 * 
 * @example
 * const container = document.querySelector('.container');
 * if (isValidElement(container)) {
 *     // container는 HTMLElement 타입으로 좁혀짐
 *     container.appendChild(newElement);
 * }
 */
export function isValidElement(element: HTMLElement | null | undefined): element is HTMLElement {
    return element !== null && element !== undefined && element instanceof HTMLElement;
}

/**
 * 숫자가 유효한 범위 내에 있는지 확인합니다
 * 
 * @param value - 확인할 값
 * @param min - 최소값 (포함)
 * @param max - 최대값 (포함)
 * @returns 값이 범위 내에 있으면 true
 * 
 * @example
 * const index = getUserInput();
 * if (isInRange(index, 0, items.length - 1)) {
 *     // index는 유효한 범위 내에 있음
 *     const item = items[index];
 * }
 */
export function isInRange(value: number, min: number, max: number): boolean {
    return !isNaN(value) && value >= min && value <= max;
}

/**
 * 객체가 특정 속성을 가지고 있는지 확인합니다
 * 
 * @param obj - 확인할 객체
 * @param key - 속성 키
 * @returns 객체가 해당 속성을 가지고 있으면 true
 * 
 * @example
 * const data: unknown = JSON.parse(jsonString);
 * if (hasProperty(data, 'name') && typeof data.name === 'string') {
 *     // data.name을 안전하게 사용 가능
 *     console.log(data.name);
 * }
 */
export function hasProperty<T extends object, K extends PropertyKey>(
    obj: T,
    key: K
): obj is T & Record<K, unknown> {
    return key in obj;
}