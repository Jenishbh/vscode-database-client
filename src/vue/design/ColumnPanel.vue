<template>
  <div>
    <div class="design-toolbar">
      <el-button @click="openAdd()" type="primary" title="Add column" icon="el-icon-circle-plus-outline" size="mini" circle> </el-button>
    </div>
    <ux-grid :data="designData.editColumnList" stripe style="width: 100%" :cell-style="{height: '25px'}" :height="remainHeight()">
      <ux-table-column align="center" field="name" title="Name" show-overflow-tooltip="true"></ux-table-column>
      <ux-table-column align="center" field="type" title="Type" show-overflow-tooltip="true"></ux-table-column>
      <ux-table-column align="center" field="comment" title="Comment" show-overflow-tooltip="true"></ux-table-column>
      <ux-table-column align="center" field="maxLength" width="80" title="Length" show-overflow-tooltip="true"></ux-table-column>
      <ux-table-column align="center" field="defaultValue" width="120" title="Default" show-overflow-tooltip="true"></ux-table-column>
      <ux-table-column align="center" title="Primary Key" width="100" show-overflow-tooltip="true">
        <template v-slot="{ row }">
          <el-checkbox disabled :checked="row.isPrimary" title="From the table definition. Use the pencil to change a column."></el-checkbox>
        </template>
      </ux-table-column>
      <ux-table-column align="center" title="Unique" width="80" show-overflow-tooltip="true">
        <template v-slot="{ row }">
          <el-checkbox disabled :checked="row.isUnique" title="From the table definition. Add or drop a unique index in the Index tab."></el-checkbox>
        </template>
      </ux-table-column>
      <ux-table-column align="center" title="Not Null" width="80" show-overflow-tooltip="true">
        <template v-slot="{ row }">
          <el-checkbox disabled :checked="row.nullable=='NO'" title="From the table definition. Use the pencil to change a column."></el-checkbox>
        </template>
      </ux-table-column>
      <ux-table-column align="center" title="Auto Incrment" width="140" show-overflow-tooltip="true">
        <template v-slot="{ row }">
          <el-checkbox disabled :checked="row.isAutoIncrement" title="From the table definition. Set when the column is created."></el-checkbox>
        </template>
      </ux-table-column>
      <ux-table-column title="Operation" width="120">
        <template v-slot="{ row }">
          <el-button @click="openEdit(row)" title="edit" size="mini" icon="el-icon-edit" circle> </el-button>
          <el-button @click="deleteConfirm(row)" title="delete" type="danger" size="mini" icon="el-icon-delete" circle> </el-button>
        </template>
      </ux-table-column>
    </ux-grid>
    <el-dialog :title="'Update Column'" :visible.sync="column.editVisible" top="3vh" size="mini">
      <el-form :inline='true'>
        <el-form-item label="Name">
          <el-input v-model="editColumn.name"></el-input>
        </el-form-item>
        <el-form-item label="Type">
          <el-input v-model="editColumn.type" placeholder="e.g. nvarchar"></el-input>
        </el-form-item>
        <el-form-item label="Length">
          <el-input v-model="editColumn.maxLength" placeholder="e.g. 120" style="width: 120px"></el-input>
        </el-form-item>
        <el-form-item label="Comment">
          <el-input v-model="editColumn.comment"></el-input>
        </el-form-item>
        <el-form-item label="Not Null">
          <el-checkbox v-model="editColumn.isNotNull"></el-checkbox>
        </el-form-item>
      </el-form>
      <div class="dialog-note">
        Primary key, unique and auto increment are constraints rather than
        column properties, and changing them is a different statement on every
        engine. They are shown in the grid but not editable here yet.
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button type="primary" :loading="column.editloading" @click="updateColumn">Update</el-button>
        <el-button @click="column.editVisible=false">Cancel</el-button>
      </span>
    </el-dialog>
    <el-dialog :title="'Add Column'" :visible.sync="column.visible" top="3vh" size="mini">
      <el-form :inline='true'>
        <el-form-item label="Name">
          <el-input v-model="column.name" placeholder="Column name"></el-input>
        </el-form-item>
        <el-form-item label="Type">
          <el-input v-model="column.type" placeholder="e.g. nvarchar"></el-input>
        </el-form-item>
        <el-form-item label="Length">
          <el-input v-model="column.maxLength" placeholder="e.g. 120" style="width: 120px"></el-input>
        </el-form-item>
        <el-form-item label="Default">
          <el-input v-model="column.defaultValue" placeholder="e.g. 0 or 'n/a'"></el-input>
        </el-form-item>
        <el-form-item label="Not Null">
          <el-checkbox v-model="column.isNotNull"></el-checkbox>
        </el-form-item>
      </el-form>
      <div class="dialog-note" v-if="column.isNotNull && !column.defaultValue">
        A NOT NULL column added to a table that already has rows needs a
        default, or the engine will reject the statement.
      </div>
      <span slot="footer" class="dialog-footer">
        <el-button type="primary" :loading="column.loading" @click="createcolumn">Create</el-button>
        <el-button @click="column.visible=false">Cancel</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { inject } from "../mixin/vscodeInject";
import { wrapByDb } from "@/common/wrapper";
export default {
  mixins: [inject],
  data() {
    return {
      designData: {
        table: null,
        dbType: null,
        columnList: [],
        editColumnList: [],
      },
      editColumn: {},
      originalName: null,
      column: {
        visible: false,
        editVisible: false,
        loading: false,
        editLoading: false,

        column: null,
        type: null,
        nullable: false,
      },
    };
  },
  mounted() {
    this.on("design-data", (data) => {
      this.designData = data;
      this.designData.editColumnList = [...this.designData.columnList];
    })
      .on("success", () => {
        this.column.loading = false;
        this.column.editLoading = false;
        this.column.visible = false;
        this.column.editVisible = false;
        this.init();
      })
      .on("error", (msg) => {
        this.$message.error(msg);
      })
      .init();
  },
  methods: {
    remainHeight() {
      return window.outerHeight - 280;
    },
    updateColumn() {
      this.column.editLoading = true;
      this.emit("updateColumn", {
        newColumnName: this.editColumn.name,
        columnType: this.fullType(this.editColumn),
        comment: this.editColumn.comment,
        nullable: !this.editColumn.isNotNull,
        table: this.designData.table,
        columnName: this.originalName,
      });
    },
    /** "nvarchar" plus the length and default the form collected. */
    fullType(column) {
      let type = (column.type || "").trim();
      const length = ("" + (column.maxLength == null ? "" : column.maxLength)).trim();
      if (length && !type.includes("(")) {
        type += `(${length})`;
      }
      return type;
    },
    createcolumn() {
      if (!this.column.name || !this.column.type) {
        this.$message.error("A name and a type are both required.");
        return;
      }
      this.column.loading = true;
      const table = wrapByDb(this.designData.table, this.designData.dbType);
      const name = wrapByDb(this.column.name, this.designData.dbType);
      let sql = `ALTER TABLE ${table} ADD ${name} ${this.fullType(this.column)}`;
      if (this.column.defaultValue) {
        sql += ` DEFAULT ${this.column.defaultValue}`;
      }
      // NOT NULL on an existing table needs a default for the rows already
      // there, so only offer it together with one.
      if (this.column.isNotNull) {
        sql += ` NOT NULL`;
      }
      this.execute(sql);
    },
    openEdit(row) {
      // originalName, not column.name: that one belongs to the Add Column
      // form, and writing it here left "Add Column" pre-filled with this name.
      this.originalName = row.name;
      this.editColumn = { ...row, isNotNull: row.nullable == "NO" };
      this.column.editVisible = true;
      this.column.editLoading = false;
    },
    openAdd() {
      this.column = { ...this.column, visible: true, name: "", type: "", maxLength: "", defaultValue: "", isNotNull: false };
    },
    deleteConfirm(row) {
      this.$confirm("Are you sure you want to delete this column?", "Warning", {
        confirmButtonText: "OK",
        cancelButtonText: "Cancel",
        type: "warning",
      }).then(() => {
        this.execute(
          `ALTER TABLE ${wrapByDb(
            this.designData.table,
            this.designData.dbType
          )} DROP COLUMN ${row.name}`
        );
      });
    },
    execute(sql) {
      if (!sql) return;
      this.emit("execute", sql);
    },
  },
};
</script>

<style>
.dialog-note {
  opacity: 0.75;
  font-size: 12px;
  line-height: 1.5;
  margin-top: 4px;
  max-width: 640px;
}

</style>