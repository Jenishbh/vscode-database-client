<template>
  <div class="reverse-view" :style="{ maxHeight: height ? height + 'px' : null }">
    <table class="reverse-table" v-if="fields && fields.length">
      <thead>
        <tr>
          <th class="field-col">Field</th>
          <th v-for="(row, index) in rows" :key="index">#{{ index + 1 }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="field in fields" :key="field.name">
          <td class="field-col">{{ field.name }}</td>
          <td v-for="(row, index) in rows" :key="index">
            <span v-if="row[field.name] == null" class="null-value">(NULL)</span>
            <span v-else>{{ formatValue(row[field.name]) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <div v-else class="empty">No Data</div>
  </div>
</template>

<script>
export default {
  props: ["fields", "rows", "height"],
  methods: {
    formatValue(value) {
      if (value && typeof value === "object" && value.hasOwnProperty("type")) {
        return String.fromCharCode.apply(null, new Uint16Array(value.data));
      }
      return value;
    },
  },
};
</script>

<style scoped>
.reverse-view {
  overflow: auto;
  border: 1px solid var(--vscode-panel-border);
}
.reverse-table {
  border-collapse: collapse;
  width: 100%;
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
}
.reverse-table th,
.reverse-table td {
  border: 1px solid var(--vscode-panel-border);
  padding: 4px 8px;
  text-align: left;
  white-space: nowrap;
}
.reverse-table thead th {
  background: var(--vscode-editorWidget-background);
  position: sticky;
  top: 0;
  z-index: 1;
}
.reverse-table .field-col {
  background: var(--vscode-editorWidget-background);
  font-weight: bold;
  position: sticky;
  left: 0;
}
.reverse-table tbody tr:hover td {
  background: var(--vscode-list-hoverBackground);
}
.null-value {
  opacity: 0.6;
  font-style: italic;
}
.empty {
  padding: 16px;
  color: var(--vscode-foreground);
  opacity: 0.7;
}
</style>
