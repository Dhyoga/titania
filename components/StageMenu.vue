<script setup lang="ts">
// The stage's menu: one icon in the top-right corner that opens a row of buttons to its left. Only the show/hide rules live here;
// the buttons are the slot's, so Playground and Display share these rules with their own rows.
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import IconButton from './IconButton.vue'

const props = defineProps<{
  /** One of the menu's popovers is open: the menu stays shown. */
  popoverOpen: boolean
}>()
const emit = defineEmits<{
  /** The menu was closed (the X, or Esc): close any open popover. */
  dismiss: []
}>()

const trigger = ref<InstanceType<typeof IconButton> | null>(null)
/** The menu with its popovers: a press inside it does not unpin. */
const root = ref<HTMLElement | null>(null)
/** The icon and its row, as one hover and focus area (no gaps: the padding and gaps belong to it). */
const group = ref<HTMLElement | null>(null)

// ------ Visibility ------
// visible = (hovering || keyFocused || pinned || popoverOpen) && !dismissed
// A press on the icon while visible hides the menu at once (dismissed, until the pointer leaves the group); while hidden it pins it
// open (the way to open it on a touch screen, which has no hover).
const hovering = ref(false)
const keyFocused = ref(false)
const pinned = ref(false)
const dismissed = ref(false)
/** Set while `close` moves focus to the icon, which must not count as keyboard focus arriving. */
let movingFocus = false

const visible = computed(() => (hovering.value || keyFocused.value || pinned.value || props.popoverOpen) && !dismissed.value)

/** Hide the menu now (the X, `Esc`), closing its popover and unpinning it. */
function close(): void {
  const hadFocus = group.value?.contains(document.activeElement) ?? false
  pinned.value = false
  dismissed.value = true
  emit('dismiss')
  // The row is gone from the layout, so a focused button in it would lose focus: give it to the icon.
  if (hadFocus) {
    movingFocus = true
    void nextTick(() => {
      ;(trigger.value?.$el as HTMLElement | undefined)?.focus()
      movingFocus = false
    })
  }
}

function onTriggerClick(): void {
  if (visible.value) {
    close()
  } else {
    dismissed.value = false
    pinned.value = true
  }
}

// A touch has no hover: its pointerenter comes with the press and would open the menu just before the press pins it (and the
// press would then close it).
function onPointerEnter(event: PointerEvent): void {
  if (event.pointerType === 'touch') return
  hovering.value = true
  dismissed.value = false // arriving anew (also after `Esc` closed the menu while the pointer was elsewhere)
}

function onPointerLeave(): void {
  hovering.value = false
  dismissed.value = false
}

// Only keyboard focus shows the menu: after a mouse press the icon is focused but not `:focus-visible`, and must not bring the
// menu back when the pointer leaves.
function onFocusIn(event: FocusEvent): void {
  if (movingFocus) return
  keyFocused.value = event.target instanceof Element && event.target.matches(':focus-visible')
  if (keyFocused.value) dismissed.value = false // tabbing back to the icon after `Esc`
}

function onFocusOut(event: FocusEvent): void {
  if (!(event.relatedTarget instanceof Node && group.value?.contains(event.relatedTarget))) keyFocused.value = false
}

// A press outside the menu and its popovers unpins it.
function onDocumentPointerDown(event: PointerEvent): void {
  if (!(event.target instanceof Element)) return
  if (root.value?.contains(event.target) || event.target.closest('[data-popover]')) return
  pinned.value = false
}
watch(pinned, (on) => {
  if (on) document.addEventListener('pointerdown', onDocumentPointerDown, true)
  else document.removeEventListener('pointerdown', onDocumentPointerDown, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
})

defineExpose({
  /** Whether the row of buttons is showing, for `Esc`. */
  isOpen: () => visible.value,
  /** Whether the menu is pinned open by a press on its icon (the next press elsewhere unpins it). */
  isPinned: () => pinned.value,
  close,
})
</script>

<template>
  <!--
    One icon in the top-right corner; hover, keyboard focus or a press opens a row of buttons to its left. The wrapper takes no
    pointer input (so the canvas keeps the area beside the icon); the group (icon and row, padding and gaps included) does, so the
    pointer can cross the row without the menu closing. The row is out of the layout while hidden, so the group is just the icon.
  -->
  <div ref="root" class="pointer-events-none absolute inset-x-2 top-0 z-20">
    <div
      ref="group"
      class="pointer-events-auto ml-auto flex w-fit flex-row-reverse items-start gap-1 p-1"
      @pointerenter="onPointerEnter"
      @pointerleave="onPointerLeave"
      @focusin="onFocusIn"
      @focusout="onFocusOut"
    >
      <!-- The icon: three lines while the menu is hidden, a close mark while it shows -->
      <IconButton
        ref="trigger"
        size="sm"
        :icon="visible ? 'x' : 'menu'"
        :label="visible ? 'Close menu' : 'Open menu'"
        title="Viewer menu"
        :pressed="visible"
        :aria-expanded="visible"
        aria-controls="stage-menu-row"
        @click="onTriggerClick"
      />
      <!-- Its own left-to-right group: the outer row is reversed only to put the icon (first in the DOM, so first in Tab order) on the right. -->
      <div v-show="visible" id="stage-menu-row" class="flex gap-1">
        <!-- The mode's buttons (Playground and Display each pass their own row). -->
        <slot />
      </div>
    </div>
    <!-- Popovers belong to the menu but are not part of the hover group; they take clicks again. -->
    <div class="pointer-events-auto contents">
      <slot name="popover" />
    </div>
  </div>
</template>
