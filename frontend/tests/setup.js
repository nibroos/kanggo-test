import { config } from '@vue/test-utils';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';

/**
 * Vuetify has to be installed globally for component tests: its components read
 * theme and display state from plugin-provided injections.
 */
const vuetify = createVuetify({ components, directives });

config.global.plugins = [vuetify];

// Vuetify's display composable relies on matchMedia, which jsdom does not implement.
global.matchMedia =
  global.matchMedia ||
  function matchMedia(query) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
  };

global.ResizeObserver =
  global.ResizeObserver ||
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

global.visualViewport = global.visualViewport || null;
