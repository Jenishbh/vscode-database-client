<template>
  <div>
    <ux-grid v-if="designData.foreignKeys" :data="designData.foreignKeys" stripe style="width: 100%" :cell-style="{height: '25px'}">
      <ux-table-column align="center" field="constraint_name" title="Constraint Name" show-overflow-tooltip="true"></ux-table-column>
      <ux-table-column align="center" field="column_name" title="Column" show-overflow-tooltip="true"></ux-table-column>
      <ux-table-column align="center" field="referenced_table" title="Referenced Table" show-overflow-tooltip="true"></ux-table-column>
      <ux-table-column align="center" field="referenced_column" title="Referenced Column" show-overflow-tooltip="true"></ux-table-column>
      <ux-table-column align="center" field="update_rule" title="On Update" show-overflow-tooltip="true"></ux-table-column>
      <ux-table-column align="center" field="delete_rule" title="On Delete" show-overflow-tooltip="true"></ux-table-column>
    </ux-grid>
    <div v-else class="design-empty">{{ designData.foreignKeysMessage || 'Loading...' }}</div>
  </div>
</template>

<script>
import { inject } from "../mixin/vscodeInject";
export default {
  mixins: [inject],
  data() {
    return {
      designData: { foreignKeys: null, foreignKeysMessage: null, dbType: null },
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
