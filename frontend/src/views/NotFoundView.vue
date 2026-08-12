<script setup>
import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth.js';

const auth = useAuthStore();
const target = computed(() => (auth.isAuthenticated ? { name: 'tasks' } : { name: 'login' }));
</script>

<template>
  <v-container class="fill-height" fluid>
    <v-row justify="center" align="center" class="w-100">
      <v-col cols="12" sm="8" md="5" class="text-center">
        <v-icon icon="mdi-map-marker-question-outline" size="72" color="primary" class="mb-4" />
        <h1 class="text-h4 font-weight-bold mb-2">Page not found</h1>
        <p class="text-body-1 text-medium-emphasis mb-6">
          The page you were looking for does not exist or has moved.
        </p>
        <v-btn color="primary" size="large" :to="target">
          {{ auth.isAuthenticated ? 'Back to my tasks' : 'Go to sign in' }}
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>
