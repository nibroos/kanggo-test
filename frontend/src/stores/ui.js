import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * App-wide feedback. One snackbar, driven from anywhere, so success and error
 * messages look the same wherever they come from.
 */
export const useUiStore = defineStore('ui', () => {
  const snackbar = ref({ show: false, message: '', color: 'success' });

  function notify(message, color = 'success') {
    // Reset first so two messages in a row restart the timeout instead of the
    // second one inheriting the remainder of the first.
    snackbar.value = { show: false, message: '', color };
    requestAnimationFrame(() => {
      snackbar.value = { show: true, message, color };
    });
  }

  const notifyError = (message) => notify(message, 'error');
  const dismiss = () => {
    snackbar.value.show = false;
  };

  return { snackbar, notify, notifyError, dismiss };
});
