<template>
  <div>
    <template v-if="scope.row.isFilter">
      <el-input class='edit-filter' v-model="filterObj[scope.column.title]" :clearable='true' placeholder="Filter" @clear="filter(null,scope.column.title)" @keyup.enter.native="filter($event,scope.column.title)">
      </el-input>
    </template>
    <template v-else-if="!scope.row.isFilter && result.dbType=='ElasticSearch'">
      <div class="edit-column" :contenteditable="editable" style="height: 100%; line-height: 33px;" @input="editListen($event,scope)" @contextmenu.prevent="onContextmenu($event,scope)" v-html='dataformat(scope.row[scope.column.title])'></div>
    </template>
    <template v-else>
      <div class="edit-column" :contenteditable="editable" style="height: 100%; line-height: 33px;" @input="editListen($event,scope)" @contextmenu.prevent="onContextmenu($event,scope)">
        <template v-if="scope.row[scope.column.title]==null || scope.row[scope.column.title]==undefined">
          <span class='null-column'>(NULL)</span>
        </template>
        <template v-else>
          <span v-text='dataformat(scope.row[scope.column.title])'></span>
        </template>
      </div>
    </template>
  </div>
</template>

<script>
import { wrapByDb } from "@/common/wrapper";

export default {
  props: ["result", "scope", "editList","filterObj"],
  methods: {
    dataformat(origin) {
      if (origin == undefined || origin == null) {
        return "<span class='null-column'>(NULL)</span>";
      }
      if (origin.hasOwnProperty("type")) {
        return String.fromCharCode.apply(null, new Uint16Array(origin.data));
      }
      return origin;
    },
    editListen(event, scope) {
      const { row, column, rowIndex } = scope;
      const editList = this.editList.concat([]);
      if (!editList[rowIndex]) {
        editList[rowIndex] = { ...row };
        delete editList[rowIndex]._XID;
        console.log(editList[rowIndex]);
      }
      editList[rowIndex][column.title] = event.target.textContent;
      this.$emit("sendToVscode", "dataModify");
      this.$emit("update:editList", editList);
    },
    filter(event, column, operation) {
      if (!operation) operation = "=";
      const isNullCheck = operation === "IS NULL" || operation === "IS NOT NULL";
      let inputvalue = "" + (event ? event.target.value : "");
      if (this.result.dbType == "ElasticSearch") {
        this.$emit("sendToVscode", "esFilter", {
          match: { [column]: inputvalue },
        });
        return;
      }

      let filterSql =
        this.result.sql.replace(/\n/, " ").replace(";", " ") + " ";

      let existsCheck = new RegExp(
        `(WHERE|AND)?\\s*\`?${column}\`?\\s*(=|is|>=|<=|<>)\\s*.+?\\s`,
        "igm"
      );

      if (inputvalue || isNullCheck) {
        const condition = isNullCheck
          ? `${wrapByDb(column, this.result.dbType)} ${operation}`
          : inputvalue.toLowerCase() === "null"
            ? `${column} is null`
            : `${wrapByDb(
                column,
                this.result.dbType
              )} ${operation} '${inputvalue}'`;
        if (existsCheck.exec(filterSql)) {
          // condition present
          filterSql = filterSql.replace(existsCheck, `$1 ${condition} `);
        } else if (filterSql.match(/\bwhere\b/gi)) {
          //have where
          filterSql = filterSql.replace(
            /\b(where)\b/gi,
            `\$1 ${condition} AND `
          );
        } else {
          //have not where
          filterSql = filterSql.replace(
            new RegExp(`(from\\s*.+?)\\s`, "ig"),
            `\$1 WHERE ${condition} `
          );
        }
      } else {
        // empty value, clear filter
        let beforeAndCheck = new RegExp(
          `\\b${column}\\b\\s*(=|is)\\s*.+?\\s*AND`,
          "igm"
        );
        if (beforeAndCheck.exec(filterSql)) {
          filterSql = filterSql.replace(beforeAndCheck, "");
        } else {
          filterSql = filterSql.replace(existsCheck, " ");
        }
      }
      this.$emit("execute", filterSql + ";");
    },
    editCell(event) {
      const el = event.target;
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    },
    setNull(event, scope) {
      const { row, column, rowIndex } = scope;
      event.target.innerHTML = "<span class='null-column'>(NULL)</span>";
      const editList = this.editList.concat([]);
      if (!editList[rowIndex]) {
        editList[rowIndex] = { ...row };
        delete editList[rowIndex]._XID;
      }
      editList[rowIndex][column.title] = null;
      this.$emit("sendToVscode", "dataModify");
      this.$emit("update:editList", editList);
    },
    onContextmenu(event, scope) {
      const { row, column } = scope;
      const name = column.title;
      const value = event.target.textContent;
      event.target.value = value;
      this.$contextmenu({
        items: [
          {
            label: `Copy`,
            onClick: () => {
              this.$emit("sendToVscode", "copy", value);
            },
            divided: true,
          },
          {
            label: `Edit`,
            onClick: () => {
              this.editCell(event);
            },
          },
          {
            label: `Duplicate Rows`,
            onClick: () => {
              this.$emit("duplicateRows", row);
            },
            divided: true,
          },
          {
            label: `Edit (Dialog)`,
            onClick: () => {
              this.$emit("openEditor", row, false);
            },
          },
          {
            label: `Copy Row (Dialog)`,
            onClick: () => {
              this.$emit("openEditor", row, true);
            },
            divided: true,
          },
          {
            label: `Set NULL`,
            onClick: () => {
              this.setNull(event, scope);
            },
            divided: true,
          },
          {
            label: `Local Filter by ${name} = '${value}'`,
            onClick: () => {
              this.$emit("localFilter", name, value);
            },
          },
          {
            label: `Filter by ${name} = '${value}'`,
            onClick: () => {
              this.filter(event, name, "=");
            },
          },
          {
            label: "Filter by",
            children: [
              {
                label: `Filter by ${name} > '${value}'`,
                onClick: () => {
                  this.filter(event, name, ">");
                },
              },
              {
                label: `Filter by ${name} >= '${value}'`,
                onClick: () => {
                  this.filter(event, name, ">=");
                },
                divided: true,
              },
              {
                label: `Filter by ${name} < '${value}'`,
                onClick: () => {
                  this.filter(event, name, "<");
                },
              },
              {
                label: `Filter by ${name} <= '${value}'`,
                onClick: () => {
                  this.filter(event, name, "<=");
                },
                divided: true,
              },
              {
                label: `Filter by ${name} IS NULL`,
                onClick: () => {
                  this.filter(event, name, "IS NULL");
                },
              },
              {
                label: `Filter by ${name} IS NOT NULL`,
                onClick: () => {
                  this.filter(event, name, "IS NOT NULL");
                },
              },
            ],
          },
        ],
        event,
        customClass: "class-a",
        zIndex: 3,
        minWidth: 230,
      });
      return false;
    },
  },
  computed: {
    editable() {
      return this.result.primaryKey && this.result.tableCount == 1;
    },
  },
};
</script>

<style>
</style>