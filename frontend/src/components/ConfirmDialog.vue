<script setup>
/**
 * Reusable confirmation prompt for destructive actions (spec §5.4, policy §21).
 *
 * Usage:
 *   <ConfirmDialog v-model="show" title="Delete task?" :loading="busy" @confirm="run" />
 */
defineProps({
  title: { type: String, default: 'Are you sure?' },
  message: { type: String, default: 'This action cannot be undone.' },
  confirmText: { type: String, default: 'Confirm' },
  cancelText: { type: String, default: 'Cancel' },
  confirmColor: { type: String, default: 'error' },
  icon: { type: String, default: 'mdi-alert-circle-outline' },
  loading: { type: Boolean, default: false },
});

const emit = defineEmits(['confirm', 'cancel']);
const model = defineModel({ type: Boolean, default: false });

function cancel() {
  model.value = false;
  emit('cancel');
}
</script>

<template>
  <v-dialog v-model="model" max-width="440" :persistent="loading">
    <v-card>
      <v-card-item>
        <template #prepend>
          <v-avatar :color="confirmColor" variant="tonal" size="42">
            <v-icon :icon="icon" />
          </v-avatar>
        </template>
        <v-card-title class="text-h6">{{ title }}</v-card-title>
      </v-card-item>

      <v-card-text class="text-body-2 text-medium-emphasis pt-0">
        {{ message }}
        <slot />
      </v-card-text>

      <v-card-actions class="px-4 pb-4">
        <v-spacer />
        <v-btn variant="text" :disabled="loading" @click="cancel">{{ cancelText }}</v-btn>
        <!-- Disabled while in flight: prevents a double submit (policy §21). -->
        <v-btn
          :color="confirmColor"
          variant="flat"
          :loading="loading"
          :disabled="loading"
          @click="emit('confirm')"
        >
          {{ confirmText }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
