<template>
  <div class="segmented-control">
    <div
      v-for="option in options"
      :key="option.value"
      class="segmented-item"
      :class="{ active: value === option.value }"
      @click="$emit('input', option.value)"
    >{{ option.label }}</div>
  </div>
</template>

<script>
export default {
  props: ["value", "options"],
};
</script>

<style scoped>
.segmented-control {
  display: inline-flex;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  overflow: hidden;
  vertical-align: middle;
}
.segmented-item {
  padding: 3px 10px;
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background: var(--vscode-editorWidget-background);
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}
.segmented-item + .segmented-item {
  border-left: 1px solid var(--vscode-panel-border);
}
.segmented-item:hover {
  background: var(--vscode-list-hoverBackground);
}
.segmented-item.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}
</style>
