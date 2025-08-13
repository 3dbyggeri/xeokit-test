/**
 * Base class for toolbar controllers
 * Based on xeokit-bim-viewer Controller pattern
 */
class Controller {
    constructor(parent, cfg = {}) {
        this.parent = parent;
        this.viewer = parent ? parent.viewer : null;
        this._enabled = true;
        this._active = false;
        this._events = {};
    }

    /**
     * Subscribe to an event
     */
    on(event, callback) {
        if (!this._events[event]) {
            this._events[event] = [];
        }
        this._events[event].push(callback);
    }

    /**
     * Unsubscribe from an event
     */
    off(event, callback) {
        if (!this._events[event]) return;
        const index = this._events[event].indexOf(callback);
        if (index > -1) {
            this._events[event].splice(index, 1);
        }
    }

    /**
     * Fire an event
     */
    fire(event, ...args) {
        if (!this._events[event]) return;
        this._events[event].forEach(callback => callback(...args));
    }

    /**
     * Set enabled state
     */
    setEnabled(enabled) {
        if (this._enabled === enabled) return;
        this._enabled = enabled;
        this.fire("enabled", enabled);
    }

    /**
     * Get enabled state
     */
    getEnabled() {
        return this._enabled;
    }

    /**
     * Set active state
     */
    setActive(active, callback) {
        if (this._active === active) {
            if (callback) callback();
            return;
        }
        this._active = active;
        this.fire("active", active);
        if (callback) callback();
    }

    /**
     * Get active state
     */
    getActive() {
        return this._active;
    }

    /**
     * Destroy the controller
     */
    destroy() {
        this._events = {};
    }
}

export { Controller };
