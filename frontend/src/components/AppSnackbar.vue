<script setup>
/**
 * The app's single toast. Anything that needs to tell the user something calls
 * `useUiStore().notify(message, color)`.
 */
import { computed } from 'vue';
import { useUiStore } from '@/stores/ui.js';

const ui = useUiStore();

const ICONS = {
  success: 'mdi-check-circle',
  error: 'mdi-alert-circle',
  warning: 'mdi-alert',
  info: 'mdi-information',
};

const icon = computed(() => ICONS[ui.snackbar.color] || ICONS.info);
</script>

<template>
  <v-snackbar
    v-model="ui.snackbar.show"
    :color="ui.snackbar.color"
    :timeout="ui.snackbar.color === 'error' ? 6000 : 3500"
    location="bottom"
    rounded="lg"
    role="status"
    aria-live="polite"
  >
    <div class="d-flex align-center ga-2">
      <v-icon :icon="icon" />
      <span>{{ ui.snackbar.message }}</span>
    </div>

    <template #actions>
      <v-btn variant="text" icon="mdi-close" aria-label="Dismiss" @click="ui.dismiss()" />
    </template>
  </v-snackbar>
</template>
