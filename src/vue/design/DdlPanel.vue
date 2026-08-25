<template>
  <div>
    <pre v-if="designData.ddl" class="ddl-source">{{ designData.ddl }}</pre>
    <div v-else class="design-empty">{{ designData.ddlMessage || 'Loading...' }}</div>
  </div>
</template>

<script>
import { inject } from "../mixin/vscodeInject";
export default {
  mixins: [inject],
  data() {
    return {
      designData: { ddl: null, ddlMessage: null, dbType: null },
    };
  },
  mounted() {
    this.on("design-data", (data) => {
      this.designData = data;
    }).init();
  },
};
</script>

<style scoped>
.ddl-source {
  background: var(--vscode-textCodeBlock-background, rgba(128, 128, 128, 0.08));
  border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
  border-radius: 4px;
  padding: 10px;
  white-space: pre-wrap;
  word-break: break-all;
  font-family: var(--vscode-editor-font-family, monospace);
  color: var(--vscode-foreground);
}

.design-empty {
  padding: 10px 2px;
  color: var(--vscode-descriptionForeground, var(--vscode-foreground));
}
</style>
