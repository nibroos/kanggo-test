<script setup>
/**
 * Status filter, title search and sorting (spec §6, §18.1).
 *
 * Tabs on wide screens, a select on narrow ones — both drive the same
 * `update:status` event, so the parent has one code path.
 */
import { ref, watch, onBeforeUnmount, computed } from 'vue';
import { FILTER_OPTIONS } from '@/utils/task.js';

const props = defineProps({
  status: { type: String, default: 'all' },
  search: { type: String, default: '' },
  sortBy: { type: String, default: 'deadline' },
  sortDir: { type: String, default: 'asc' },
  counts: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
});

const emit = defineEmits(['update:status', 'update:search', 'update:sort']);

// Deadline first: it is the default order, and undated tasks are placed last.
const SORT_OPTIONS = [
  { title: 'Deadline (soonest)', value: 'deadline:asc' },
  { title: 'Deadline (latest)', value: 'deadline:desc' },
  { title: 'Newest first', value: 'created_at:desc' },
  { title: 'Oldest first', value: 'created_at:asc' },
  { title: 'Title (A-Z)', value: 'title:asc' },
  { title: 'Title (Z-A)', value: 'title:desc' },
];

const searchTerm = ref(props.search);
const sortValue = computed({
  get: () => `${props.sortBy}:${props.sortDir}`,
  set: (value) => {
    const [sortBy, sortDir] = value.split(':');
    emit('update:sort', { sortBy, sortDir });
  },
});

// Live search, debounced: one request when typing stops rather than one per key.
let debounceTimer = null;
watch(searchTerm, (value) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => emit('update:search', value.trim()), 350);
});

// Keep in step when the parent resets the filters.
watch(
  () => props.search,
  (value) => {
    if (value !== searchTerm.value) searchTerm.value = value;
  },
);

onBeforeUnmount(() => clearTimeout(debounceTimer));

function submitSearch() {
  clearTimeout(debounceTimer);
  emit('update:search', searchTerm.value.trim());
}

const countFor = (value) => props.counts?.[value] ?? 0;
</script>

<template>
  <div>
    <!-- Wide screens: tabs with a count badge per status. -->
    <v-tabs
      :model-value="status"
      class="d-none d-sm-flex mb-4"
      color="primary"
      density="comfortable"
      show-arrows
      @update:model-value="emit('update:status', $event)"
    >
      <v-tab v-for="option in FILTER_OPTIONS" :key="option.value" :value="option.value" class="text-none">
        <v-icon :icon="option.icon" start size="18" />
        {{ option.label }}
        <v-chip size="x-small" class="ml-2" variant="tonal" label>{{ countFor(option.value) }}</v-chip>
      </v-tab>
    </v-tabs>

    <!-- Narrow screens: a select saves horizontal space. -->
    <v-select
      :model-value="status"
      class="d-sm-none mb-3"
      label="Status"
      :items="FILTER_OPTIONS.map((option) => ({ title: `${option.label} (${countFor(option.value)})`, value: option.value }))"
      prepend-inner-icon="mdi-filter-variant"
      @update:model-value="emit('update:status', $event)"
    />

    <v-row dense align="center">
      <v-col cols="12" sm="7" md="8">
        <v-text-field
          v-model="searchTerm"
          label="Search by title"
          placeholder="e.g. deploy"
          prepend-inner-icon="mdi-magnify"
          clearable
          :loading="loading"
          autocomplete="off"
          @keyup.enter="submitSearch"
          @click:clear="emit('update:search', '')"
        />
      </v-col>

      <v-col cols="12" sm="5" md="4">
        <v-select v-model="sortValue" label="Sort by" :items="SORT_OPTIONS" prepend-inner-icon="mdi-sort" />
      </v-col>
    </v-row>
  </div>
</template>
