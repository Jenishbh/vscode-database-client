<template>
  <div>
    <ux-grid v-if="designData.checks" :data="designData.checks" stripe style="width: 100%" :cell-style="{height: '25px'}">
      <ux-table-column align="center" field="constraint_name" title="Constraint Name" show-overflow-tooltip="true"></ux-table-column>
      <ux-table-column align="center" field="check_clause" title="Check Clause" show-overflow-tooltip="true"></ux-table-column>
    </ux-grid>
    <div v-else class="design-empty">{{ designData.checksMessage || 'Loading...' }}</div>
  </div>
</template>

<script>
import { inject } from "../mixin/vscodeInject";
export default {
  mixins: [inject],
  data() {
    return {
      designData: { checks: null, checksMessage: null, dbType: null },
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
.design-empty {
  padding: 10px 2px;
  color: var(--vscode-descriptionForeground, var(--vscode-foreground));
}
</style>
