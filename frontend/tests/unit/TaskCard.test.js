import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TaskCard from '@/components/TaskCard.vue';

/**
 * Component test (spec §18.4): the card must show every field the spec lists and
 * emit the actions the task page listens for.
 */

const baseTask = {
  id: 1,
  user_id: 1,
  title: 'Write the README',
  description: 'Include setup instructions',
  status: 'pending',
  deadline: '2026-09-01',
  version: 1,
  created_at: '2026-08-01T10:00:00.000Z',
  updated_at: '2026-08-01T10:00:00.000Z',
};

const mountCard = (task = {}, props = {}) =>
  mount(TaskCard, { props: { task: { ...baseTask, ...task }, ...props } });

describe('TaskCard', () => {
  it('renders title, description, status and deadline', () => {
    const text = mountCard().text();
    expect(text).toContain('Write the README');
    expect(text).toContain('Include setup instructions');
    expect(text).toContain('Pending');
    // Month abbreviations vary by locale data ("Sep" / "Sept").
    expect(text).toMatch(/1 Sept? 2026/);
  });

  it('shows a placeholder when there is no description or deadline', () => {
    const text = mountCard({ description: null, deadline: null }).text();
    expect(text).toContain('No description');
    expect(text).toContain('No deadline');
  });

  it('labels a past deadline as overdue', () => {
    expect(mountCard({ deadline: '2000-01-01' }).text()).toContain('Overdue');
  });

  it('does not nag about an overdue deadline once the task is done', () => {
    expect(mountCard({ deadline: '2000-01-01', status: 'done' }).text()).not.toContain('Overdue');
  });

  it('emits edit when the edit button is pressed', async () => {
    const wrapper = mountCard();
    await wrapper.find('[aria-label="Edit Write the README"]').trigger('click');
    expect(wrapper.emitted('edit')).toHaveLength(1);
  });

  it('emits delete rather than deleting directly, so the page can confirm first', async () => {
    const wrapper = mountCard();
    await wrapper.find('[aria-label="Delete Write the README"]').trigger('click');
    expect(wrapper.emitted('delete')).toHaveLength(1);
  });

  it('marks the delete button busy while a delete is in flight', () => {
    const wrapper = mountCard({}, { deleting: true });
    const button = wrapper.find('[aria-label="Delete Write the README"]');
    expect(button.classes().join(' ')).toContain('v-btn--loading');
  });
});
