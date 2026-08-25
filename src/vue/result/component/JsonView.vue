<template>
  <div class="json-view" :style="{ maxHeight: height ? height + 'px' : null }">
    <pre class="json-block" v-for="(row, index) in rows" :key="index">{{ formatRow(row) }}</pre>
    <div v-if="!rows || !rows.length" class="empty">No Data</div>
  </div>
</template>

<script>
export default {
  props: ["rows", "height"],
  methods: {
    formatRow(row) {
      return JSON.stringify(
        row,
        (k, v) => {
          if (v && typeof v === "object" && v.hasOwnProperty("type") && v.hasOwnProperty("data")) {
            return String.fromCharCode.apply(null, new Uint16Array(v.data));
          }
          return v;
        },
        2
      );
    },
  },
};
</script>

<style scoped>
.json-view {
  overflow: auto;
  border: 1px solid var(--vscode-panel-border);
  padding: 4px;
  box-sizing: border-box;
}
.json-block {
  margin: 4px 0;
  padding: 8px;
  background: var(--vscode-editorWidget-background);
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 3px;
  font-family: var(--vscode-editor-font-family, monospace);
  font-size: var(--vscode-font-size);
  white-space: pre-wrap;
  word-break: break-all;
}
.json-block:hover {
  background: var(--vscode-list-hoverBackground);
}
.empty {
  padding: 16px;
  color: var(--vscode-foreground);
  opacity: 0.7;
}
</style>
