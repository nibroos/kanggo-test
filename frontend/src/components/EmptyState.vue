<script setup>
/**
 * Placeholder for "nothing here yet" and "nothing matched your filters".
 */
defineProps({
  icon: { type: String, default: 'mdi-clipboard-text-outline' },
  title: { type: String, required: true },
  message: { type: String, default: '' },
});
</script>

<template>
  <div class="text-center py-12 px-4">
    <v-avatar size="72" color="primary" variant="tonal" class="mb-4">
      <v-icon :icon="icon" size="36" />
    </v-avatar>
    <h3 class="text-h6 mb-2">{{ title }}</h3>
    <p v-if="message" class="text-body-2 text-medium-emphasis mb-4 mx-auto empty-state__message">
      {{ message }}
    </p>
    <slot />
  </div>
</template>

<style scoped>
.empty-state__message {
  max-width: 420px;
}
</style>
