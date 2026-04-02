import { describe, it, expect, beforeEach } from 'vitest';
import { useUIStore } from '../ui-store';

describe('UI store', () => {
  beforeEach(() => {
    useUIStore.setState({
      focusMode: false,
      sidebarOpen: false,
      activeModal: null,
      toasts: [],
    });
  });

  it('has correct initial state', () => {
    const state = useUIStore.getState();
    expect(state.focusMode).toBe(false);
    expect(state.sidebarOpen).toBe(false);
    expect(state.activeModal).toBeNull();
    expect(state.toasts).toEqual([]);
  });

  it('addToast adds a toast to the array', () => {
    const { addToast } = useUIStore.getState();

    addToast('Hello world', 'success');

    const state = useUIStore.getState();
    expect(state.toasts.length).toBe(1);
    expect(state.toasts[0].message).toBe('Hello world');
    expect(state.toasts[0].type).toBe('success');
    expect(state.toasts[0].id).toBeDefined();
  });

  it('addToast defaults to info type', () => {
    const { addToast } = useUIStore.getState();

    addToast('Default toast');

    const state = useUIStore.getState();
    expect(state.toasts[0].type).toBe('info');
  });

  it('addToast generates unique ids', () => {
    const { addToast } = useUIStore.getState();

    addToast('First');
    addToast('Second');

    const state = useUIStore.getState();
    expect(state.toasts[0].id).not.toBe(state.toasts[1].id);
  });

  it('removeToast removes a toast by id', () => {
    const { addToast, removeToast } = useUIStore.getState();

    addToast('First', 'info');
    addToast('Second', 'error');

    const state = useUIStore.getState();
    const firstId = state.toasts[0].id;

    removeToast(firstId);

    const updatedState = useUIStore.getState();
    expect(updatedState.toasts.length).toBe(1);
    expect(updatedState.toasts[0].message).toBe('Second');
  });

  it('removeToast does nothing if id not found', () => {
    const { addToast, removeToast } = useUIStore.getState();

    addToast('Only toast');

    removeToast('non-existent-id');

    const state = useUIStore.getState();
    expect(state.toasts.length).toBe(1);
  });

  it('toggleFocusMode toggles focus mode', () => {
    const { toggleFocusMode } = useUIStore.getState();

    expect(useUIStore.getState().focusMode).toBe(false);

    toggleFocusMode();
    expect(useUIStore.getState().focusMode).toBe(true);

    toggleFocusMode();
    expect(useUIStore.getState().focusMode).toBe(false);
  });

  it('setSidebarOpen updates sidebar state', () => {
    const { setSidebarOpen } = useUIStore.getState();

    setSidebarOpen(true);
    expect(useUIStore.getState().sidebarOpen).toBe(true);

    setSidebarOpen(false);
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });

  it('openModal sets active modal', () => {
    const { openModal } = useUIStore.getState();

    openModal('settings');
    expect(useUIStore.getState().activeModal).toBe('settings');
  });

  it('closeModal clears active modal', () => {
    const { openModal, closeModal } = useUIStore.getState();

    openModal('settings');
    closeModal();
    expect(useUIStore.getState().activeModal).toBeNull();
  });
});
