<template>
  <el-tooltip class="item" effect="dark" :content="getTip(result.columnList[index],scope.column)" placement="left-start">
    <div>
      <span>
        <span v-if="result.columnList[index]&& (result.columnList[index].nullable != 'YES')" style="color: #f94e4e; position: relative; top: .2em;">
          *
        </span>
        <span class="column-name">
          {{ scope.column.title }}<br />
        </span>
      </span>
      <span class="column-type" v-if="result.columnList[index]">
        {{result.columnList[index].type}}
      </span>
      <ColumnFilter :column="scope.column.title" :rows="result.data"
        :active="activeFilters.includes(scope.column.title)"
        @filter="$emit('columnFilter', $event)" />
    </div>
  </el-tooltip>
</template>

<script>
import ColumnFilter from "./ColumnFilter.vue";
export default {
  components: { ColumnFilter },
  props: ["scope", "result", "index", "activeFilters"],
  methods: {
    getTip(column, scopeColumn) {
      if (!column || !column.comment) return scopeColumn.title;
      return column.comment;
    },
  },
};
</script>

<style>
</style>