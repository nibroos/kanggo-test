<script setup>
/**
 * One task in the list (spec §10.3: title, description, status, deadline plus
 * edit and delete actions). The status menu allows a one-click change without
 * opening the full form.
 */
import { computed } from 'vue';
import TaskStatusChip from './TaskStatusChip.vue';
import { STATUS_OPTIONS, deadlineLabel, formatDate } from '@/utils/task.js';

const props = defineProps({
  task: { type: Object, required: true },
  updatingStatus: { type: Boolean, default: false },
  deleting: { type: Boolean, default: false },
});

const emit = defineEmits(['edit', 'delete', 'status-change']);

const deadline = computed(() => (props.task.deadline ? deadlineLabel(props.task) : null));
const isDone = computed(() => props.task.status === 'done');
const createdAt = computed(() => formatDate(props.task.created_at));
</script>

<template>
  <v-card
    border
    flat
    class="task-card h-100 d-flex flex-column"
    :class="{ 'task-card--done': isDone }"
  >
    <v-card-item class="pb-2">
      <v-card-title class="text-body-1 font-weight-bold task-card__title">
        {{ task.title }}
      </v-card-title>

      <template #append>
        <!-- Quick status switch: one click instead of opening the edit form. -->
        <v-menu location="bottom end">
          <template #activator="{ props: menuProps }">
            <v-btn
              v-bind="menuProps"
              icon="mdi-dots-vertical"
              variant="text"
              size="small"
              density="comfortable"
              :loading="updatingStatus"
              :aria-label="`Actions for ${task.title}`"
            />
          </template>

          <v-list density="compact" min-width="200">
            <v-list-subheader>Set status</v-list-subheader>
            <v-list-item
              v-for="option in STATUS_OPTIONS"
              :key="option.value"
              :prepend-icon="option.icon"
              :title="option.label"
              :active="option.value === task.status"
              :disabled="option.value === task.status"
              @click="emit('status-change', option.value)"
            />
            <v-divider class="my-1" />
            <v-list-item prepend-icon="mdi-pencil" title="Edit" @click="emit('edit')" />
            <v-list-item
              prepend-icon="mdi-delete-outline"
              title="Delete"
              base-color="error"
              @click="emit('delete')"
            />
          </v-list>
        </v-menu>
      </template>
    </v-card-item>

    <v-card-text class="pt-0 flex-grow-1">
      <p v-if="task.description" class="text-body-2 text-medium-emphasis task-card__description">
        {{ task.description }}
      </p>
      <p v-else class="text-body-2 text-disabled font-italic">No description</p>

      <div class="d-flex flex-wrap ga-2 mt-3">
        <TaskStatusChip :status="task.status" />

        <v-chip
          v-if="deadline"
          size="small"
          variant="tonal"
          label
          :color="deadline.color === 'default' ? undefined : deadline.color"
        >
          <v-icon icon="mdi-calendar-clock" start size="16" />
          {{ deadline.text }}
        </v-chip>

        <v-chip v-else size="small" variant="text" label class="text-disabled">
          <v-icon icon="mdi-calendar-blank-outline" start size="16" />
          No deadline
        </v-chip>
      </div>
    </v-card-text>

    <v-divider />

    <v-card-actions class="px-4 py-2">
      <span class="text-caption text-disabled">Created {{ createdAt }}</span>
      <v-spacer />
      <v-btn
        size="small"
        variant="text"
        prepend-icon="mdi-pencil"
        :aria-label="`Edit ${task.title}`"
        @click="emit('edit')"
      >
        Edit
      </v-btn>
      <v-btn
        size="small"
        variant="text"
        color="error"
        prepend-icon="mdi-delete-outline"
        :loading="deleting"
        :aria-label="`Delete ${task.title}`"
        @click="emit('delete')"
      >
        Delete
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<style scoped>
.task-card {
  transition: box-shadow 160ms ease, transform 160ms ease;
}

.task-card:hover {
  box-shadow: 0 6px 18px rgb(0 0 0 / 8%);
}

.task-card--done .task-card__title {
  text-decoration: line-through;
  opacity: 0.65;
}

/* Long descriptions are clamped so cards in a row keep a comparable height. */
.task-card__description {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-line;
  word-break: break-word;
}

.task-card__title {
  white-space: normal;
  word-break: break-word;
}
</style>
