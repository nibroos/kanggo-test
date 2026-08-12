<script setup>
/**
 * Status badge. Single source of truth for how a status looks, so the card, the
 * filter bar and the form dialog can never drift apart.
 */
import { computed } from 'vue';
import { statusMeta } from '@/utils/task.js';

const props = defineProps({
  status: { type: String, required: true },
  size: { type: String, default: 'small' },
});

const meta = computed(() => statusMeta(props.status));
</script>

<template>
  <v-chip :color="meta.color" :size="size" variant="tonal" label>
    <v-icon :icon="meta.icon" start :size="size === 'x-small' ? 14 : 16" />
    {{ meta.label }}
  </v-chip>
</template>
