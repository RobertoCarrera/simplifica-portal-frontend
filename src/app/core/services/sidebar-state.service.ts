import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SidebarStateService {
  private _isCollapsed = signal(false);
  private _isOpen = signal(false); // mobile

  readonly isCollapsed = this._isCollapsed.asReadonly();
  readonly isOpen = this._isOpen.asReadonly();

  readonly sidebarWidth = computed(() => {
    return this._isCollapsed() ? '4rem' : '16rem';
  });

  toggleCollapse() {
    this._isCollapsed.update(current => !current);
    localStorage.setItem('sidebar-collapsed', JSON.stringify(this._isCollapsed()));
  }

  setCollapsed(collapsed: boolean) {
    this._isCollapsed.set(collapsed);
    localStorage.setItem('sidebar-collapsed', JSON.stringify(collapsed));
  }

  toggleOpen() {
    this._isOpen.update(current => !current);
  }

  setOpen(open: boolean) {
    this._isOpen.set(open);
  }

  loadSavedState() {
    try {
      const saved = localStorage.getItem('sidebar-collapsed');
      if (saved !== null) {
        this._isCollapsed.set(JSON.parse(saved));
      }
    } catch {
      // corrupted localStorage — ignore
    }
  }
}