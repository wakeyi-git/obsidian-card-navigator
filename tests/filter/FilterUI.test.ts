import { FilterUI } from '../../src/filter/FilterUI';
import { FilterOptions } from '../../src/types';
import { App } from 'obsidian';

describe('FilterUI', () => {
    let filterUI: FilterUI;
    let mockApp: App;
    let containerEl: HTMLElement;
    let onApplyCallback: jest.Mock;

    beforeEach(() => {
        // Mock App
        mockApp = {} as App;

        // Create container
        containerEl = document.createElement('div');
        document.body.appendChild(containerEl);

        // Create callback
        onApplyCallback = jest.fn();

        // Create FilterUI instance
        filterUI = new FilterUI(mockApp, containerEl, onApplyCallback);
    });

    afterEach(() => {
        // Clean up DOM
        filterUI.hide();
        document.body.innerHTML = '';
    });

    describe('Constructor', () => {
        it('should initialize with empty filters', () => {
            const filters = filterUI.getCurrentFilters();

            expect(filters.tags).toEqual([]);
            expect(filters.properties).toEqual({});
        });

        it('should initialize without callback', () => {
            const uiWithoutCallback = new FilterUI(mockApp, containerEl);

            expect(() => uiWithoutCallback.show()).not.toThrow();
        });
    });

    describe('show', () => {
        it('should create modal elements', () => {
            filterUI.show();

            const backdrop = document.querySelector('.filter-modal-backdrop');
            const modal = document.querySelector('.filter-modal');
            const header = document.querySelector('.filter-modal-header');
            const body = document.querySelector('.filter-modal-body');
            const footer = document.querySelector('.filter-modal-footer');

            expect(backdrop).toBeTruthy();
            expect(modal).toBeTruthy();
            expect(header).toBeTruthy();
            expect(body).toBeTruthy();
            expect(footer).toBeTruthy();
        });

        it('should create close button', () => {
            filterUI.show();

            const closeBtn = document.querySelector('.filter-modal-close');

            expect(closeBtn).toBeTruthy();
            expect(closeBtn?.textContent).toBe('×');
        });

        it('should create filter sections', () => {
            filterUI.show();

            const sections = document.querySelectorAll('.filter-section');

            expect(sections.length).toBe(3); // 태그, 날짜, 속성
        });

        it('should create action buttons', () => {
            filterUI.show();

            const applyBtn = document.querySelector('.filter-modal-footer .mod-cta');
            const cancelBtn = document.querySelector('.filter-modal-footer button:not(.mod-cta)');

            expect(applyBtn?.textContent).toBe('Apply');
            expect(cancelBtn).toBeTruthy();
        });

        it('should remove existing modal before showing new one', () => {
            filterUI.show();
            const firstBackdrop = document.querySelector('.filter-modal-backdrop');

            filterUI.show();
            const backdrops = document.querySelectorAll('.filter-modal-backdrop');

            expect(backdrops.length).toBe(1);
        });
    });

    describe('hide', () => {
        it('should remove modal elements', () => {
            filterUI.show();

            expect(document.querySelector('.filter-modal-backdrop')).toBeTruthy();

            filterUI.hide();

            expect(document.querySelector('.filter-modal-backdrop')).toBeFalsy();
        });

        it('should handle hide without showing first', () => {
            expect(() => filterUI.hide()).not.toThrow();
        });
    });

    describe('Tag filter', () => {
        it('should update tags on input', () => {
            filterUI.show();

            const tagInput = document.querySelector('.filter-input') as HTMLInputElement;

            expect(tagInput).toBeTruthy();

            // Simulate input
            tagInput.value = 'tag1, tag2, tag3';
            tagInput.dispatchEvent(new Event('input'));

            const filters = filterUI.getCurrentFilters();

            expect(filters.tags).toEqual(['tag1', 'tag2', 'tag3']);
        });

        it('should handle empty tags', () => {
            filterUI.show();

            const tagInput = document.querySelector('.filter-input') as HTMLInputElement;

            tagInput.value = '';
            tagInput.dispatchEvent(new Event('input'));

            const filters = filterUI.getCurrentFilters();

            expect(filters.tags).toEqual([]);
        });

        it('should trim whitespace from tags', () => {
            filterUI.show();

            const tagInput = document.querySelector('.filter-input') as HTMLInputElement;

            tagInput.value = '  tag1  ,  tag2  ,  tag3  ';
            tagInput.dispatchEvent(new Event('input'));

            const filters = filterUI.getCurrentFilters();

            expect(filters.tags).toEqual(['tag1', 'tag2', 'tag3']);
        });

        it('should display existing tag filters', () => {
            filterUI.setFilters({
                tags: ['existing1', 'existing2'],
                properties: {}
            });

            filterUI.show();

            const tagInput = document.querySelector('.filter-input') as HTMLInputElement;

            expect(tagInput.value).toBe('existing1, existing2');
        });
    });

    describe('Date filters', () => {
        it('should update created date filters', () => {
            filterUI.show();

            const dateInputs = document.querySelectorAll('.filter-date-input') as NodeListOf<HTMLInputElement>;
            const createdFrom = dateInputs[0];
            const createdTo = dateInputs[1];

            createdFrom.value = '2024-01-01';
            createdFrom.dispatchEvent(new Event('change'));

            createdTo.value = '2024-12-31';
            createdTo.dispatchEvent(new Event('change'));

            const filters = filterUI.getCurrentFilters();

            expect(filters.createdAfter).toEqual(new Date('2024-01-01'));
            expect(filters.createdBefore).toEqual(new Date('2024-12-31'));
        });

        it('should update modified date filters', () => {
            filterUI.show();

            const dateInputs = document.querySelectorAll('.filter-date-input') as NodeListOf<HTMLInputElement>;
            const modifiedFrom = dateInputs[2];
            const modifiedTo = dateInputs[3];

            modifiedFrom.value = '2024-06-01';
            modifiedFrom.dispatchEvent(new Event('change'));

            modifiedTo.value = '2024-06-30';
            modifiedTo.dispatchEvent(new Event('change'));

            const filters = filterUI.getCurrentFilters();

            expect(filters.modifiedAfter).toEqual(new Date('2024-06-01'));
            expect(filters.modifiedBefore).toEqual(new Date('2024-06-30'));
        });

        it('should remove date filter when cleared', () => {
            filterUI.show();

            const dateInputs = document.querySelectorAll('.filter-date-input') as NodeListOf<HTMLInputElement>;
            const createdFrom = dateInputs[0];

            createdFrom.value = '2024-01-01';
            createdFrom.dispatchEvent(new Event('change'));

            let filters = filterUI.getCurrentFilters();
            expect(filters.createdAfter).toBeDefined();

            createdFrom.value = '';
            createdFrom.dispatchEvent(new Event('change'));

            filters = filterUI.getCurrentFilters();
            expect(filters.createdAfter).toBeUndefined();
        });
    });

    describe('Property filter', () => {
        it('should update properties on input', () => {
            filterUI.show();

            const propertyInput = document.querySelector('.filter-textarea') as HTMLTextAreaElement;

            propertyInput.value = 'status:완료\npriority:high\nauthor:홍길동';
            propertyInput.dispatchEvent(new Event('input'));

            const filters = filterUI.getCurrentFilters();

            expect(filters.properties).toEqual({
                status: '완료',
                priority: 'high',
                author: '홍길동'
            });
        });

        it('should handle empty properties', () => {
            filterUI.show();

            const propertyInput = document.querySelector('.filter-textarea') as HTMLTextAreaElement;

            propertyInput.value = '';
            propertyInput.dispatchEvent(new Event('input'));

            const filters = filterUI.getCurrentFilters();

            expect(filters.properties).toEqual({});
        });

        it('should ignore malformed property lines', () => {
            filterUI.show();

            const propertyInput = document.querySelector('.filter-textarea') as HTMLTextAreaElement;

            propertyInput.value = 'status:완료\ninvalid line\npriority:high\n:nokey\nnovalue:';
            propertyInput.dispatchEvent(new Event('input'));

            const filters = filterUI.getCurrentFilters();

            expect(filters.properties).toEqual({
                status: '완료',
                priority: 'high'
            });
        });
    });

    describe('Apply filters', () => {
        it('should call callback with current filters', () => {
            filterUI.show();

            const tagInput = document.querySelector('.filter-input') as HTMLInputElement;
            tagInput.value = 'test';
            tagInput.dispatchEvent(new Event('input'));

            const applyBtn = document.querySelector('.filter-modal-footer .mod-cta') as HTMLButtonElement;
            applyBtn.click();

            expect(onApplyCallback).toHaveBeenCalledWith({
                tags: ['test'],
                properties: {}
            });
        });

        it('should hide modal after applying', () => {
            filterUI.show();

            const applyBtn = document.querySelector('.filter-modal-footer .mod-cta') as HTMLButtonElement;
            applyBtn.click();

            expect(document.querySelector('.filter-modal-backdrop')).toBeFalsy();
        });
    });

    describe('Cancel', () => {
        it('should close modal without applying', () => {
            filterUI.show();

            const cancelBtn = Array.from(document.querySelectorAll('.filter-modal-footer button'))
                .find(btn => btn.textContent === 'Cancel') as HTMLButtonElement;

            cancelBtn.click();

            expect(document.querySelector('.filter-modal-backdrop')).toBeFalsy();
            expect(onApplyCallback).not.toHaveBeenCalled();
        });

        it('should close on backdrop click', () => {
            filterUI.show();

            const backdrop = document.querySelector('.filter-modal-backdrop') as HTMLElement;
            backdrop.click();

            expect(document.querySelector('.filter-modal-backdrop')).toBeFalsy();
        });

        it('should not close on modal content click', () => {
            filterUI.show();

            const modal = document.querySelector('.filter-modal') as HTMLElement;
            modal.click();

            expect(document.querySelector('.filter-modal-backdrop')).toBeTruthy();
        });
    });

    describe('Reset', () => {
        it('should reset filters and rerender', () => {
            filterUI.setFilters({
                tags: ['test'],
                properties: { key: 'value' }
            });

            filterUI.show();

            const resetBtn = Array.from(document.querySelectorAll('.filter-modal-footer button'))
                .find(btn => btn.textContent === 'Reset') as HTMLButtonElement;

            resetBtn.click();

            // Should reopen with empty filters
            expect(document.querySelector('.filter-modal-backdrop')).toBeTruthy();

            const filters = filterUI.getCurrentFilters();
            expect(filters.tags).toEqual([]);
            expect(filters.properties).toEqual({});
        });
    });

    describe('Close button', () => {
        it('should close modal on close button click', () => {
            filterUI.show();

            const closeBtn = document.querySelector('.filter-modal-close') as HTMLButtonElement;
            closeBtn.click();

            expect(document.querySelector('.filter-modal-backdrop')).toBeFalsy();
        });
    });

    describe('onApply', () => {
        it('should set callback function', () => {
            const newCallback = jest.fn();

            filterUI.onApply(newCallback);
            filterUI.show();

            const applyBtn = document.querySelector('.filter-modal-footer .mod-cta') as HTMLButtonElement;
            applyBtn.click();

            expect(newCallback).toHaveBeenCalled();
            expect(onApplyCallback).not.toHaveBeenCalled();
        });
    });

    describe('getCurrentFilters', () => {
        it('should return current filter state', () => {
            const filters = filterUI.getCurrentFilters();

            expect(filters).toBeDefined();
            expect(filters.tags).toEqual([]);
            expect(filters.properties).toEqual({});
        });
    });

    describe('setFilters', () => {
        it('should update current filters', () => {
            const newFilters: FilterOptions = {
                tags: ['tag1', 'tag2'],
                properties: { status: 'done' },
                createdAfter: new Date('2024-01-01'),
                modifiedBefore: new Date('2024-12-31')
            };

            filterUI.setFilters(newFilters);

            const filters = filterUI.getCurrentFilters();

            expect(filters).toEqual(newFilters);
        });
    });
});
