<template>
  <form @submit.prevent="tryConnect" class="flex flex-col mx-auto connect-container">
    <h1 class="py-4 text-2xl">Connect to Database Server</h1>

    <blockquote class="p-3 mb-2 panel error" v-if="connect.error">
      <section class="panel__text">
        <div class="inline-block w-32 mr-5 font-bold">Connection error!</div>
        <span>{{ connect.errorMessage }}</span>
      </section>
    </blockquote>

    <blockquote class="p-3 mb-2 panel success" v-if="connect.success">
      <section class="panel__text">
        <div class="inline-block mr-5 font-bold w-36">Success!</div>
        <span>
          {{ connect.successMessage }}
        </span>
      </section>
    </blockquote>

    <section class="flex flex-wrap items-center">
      <div class="inline-block mb-2 mr-10">
        <label class="inline-block mr-5 font-bold">Connection Name</label>
        <input
          class="field__input"
          style="min-width: 400px"
          placeholder="Connection name"
          v-model="connectionOption.name"
        />
      </div>
      <div class="inline-block mb-2 mr-10">
        <label class="inline-block mr-5 font-bold">Group</label>
        <input
          class="field__input"
          style="min-width: 220px"
          placeholder="Parent/Sub"
          title="Optional folder name used to organise connections, e.g. Prod/EU"
          v-model="connectionOption.group"
        />
      </div>
      <div class="inline-block mb-2 mr-10">
        <label class="inline-block mr-5 font-bold">Scope</label>
        <span class="seg">
          <button type="button" class="seg__item" :class="{ 'seg__item--active': connectionOption.global }"
            @click="connectionOption.global = true">Global</button>
          <button type="button" class="seg__item" :class="{ 'seg__item--active': !connectionOption.global }"
            @click="connectionOption.global = false">Workspace</button>
        </span>
      </div>
    </section>

    <section class="mt-5 server-type">
      <label class="block font-bold">Server Type</label>
      <div class="st-row">
        <span
          v-for="e in primary"
          :key="e.label"
          class="st-item"
          :class="{ 'st-item--active': isActive(e) }"
          :title="typeHint(e)"
          @click="pick(e)"
        ><i class="st-icon">{{ e.icon }}</i>{{ e.label }}</span>
      </div>
      <div class="st-row">
        <span
          v-for="e in secondary"
          :key="e.label"
          class="st-item"
          :class="{ 'st-item--active': isActive(e) }"
          :title="typeHint(e)"
          @click="pick(e)"
        ><i class="st-icon">{{ e.icon }}</i>{{ e.label }}</span>
        <span class="st-item st-more" :class="{ 'st-item--active': moreOpen }" @click="moreOpen = !moreOpen">
          <i class="st-icon">▦</i>More
        </span>
      </div>
      <div v-if="moreOpen" class="st-more-panel">
        <span
          v-for="e in more"
          :key="e.label"
          class="st-item"
          :class="{ 'st-item--active': isActive(e) }"
          :title="typeHint(e)"
          @click="pick(e); moreOpen = false"
        ><i class="st-icon">{{ e.icon }}</i>{{ e.label }}</span>
      </div>
      <div class="st-note" v-if="activeEntry && activeEntry.kind === 'jdbc'">
        <span v-if="activeEntry.bundled">Driver ships with the extension &mdash; nothing to download.</span>
        <span v-else>Needs a JDBC driver jar in the folder set by <code>database-client-jenishbh.binaryPath</code>. Run <b>Database Client: Check External Tools</b> to verify.</span>
      </div>
    </section>

    <section class="mt-4 cfg">
      <label class="cfg__label">Config</label>
      <span v-for="t in configTabs" :key="t.id" class="cfg__item"
        :class="{ 'cfg__item--active': configTab === t.id }" @click="configTab = t.id">
        <i class="cfg__icon">{{ t.icon }}</i>{{ t.label }}
      </span>
    </section>

    <div v-show="configTab === 'main'">
    <JDBC v-if="connectionOption.dbType == 'JDBC'" :connectionOption="connectionOption" />
    <ElasticSearch v-if="connectionOption.dbType == 'ElasticSearch'" :connectionOption="connectionOption" />
    <SQLite
      v-else-if="connectionOption.dbType == 'SQLite'"
      :connectionOption="connectionOption"
      :sqliteState="sqliteState"
      @choose="choose('sqlite')"
      @install="installSqlite"
    />
    <SSH
      v-else-if="connectionOption.dbType == 'SSH'"
      :connectionOption="connectionOption"
      @choose="choose('privateKey')"
    />
    <S3 v-else-if="connectionOption.dbType == 'S3'" :connectionOption="connectionOption" />

    <template v-else>
      <section class="mt-5">
        <div class="inline-block mb-2 mr-10" v-if="connectionOption.dbType != 'Redis' || !connectionOption.socketPath">
          <label class="inline-block w-32 mr-5 font-bold">
            <span>Host</span>
            <span class="mr-1 text-red-600" title="required" v-if="connectionOption.dbType != 'Redis'">*</span>
          </label>
          <input
            class="w-64 field__input"
            placeholder="The host of connection"
            :required="connectionOption.dbType != 'Redis'"
            v-model="connectionOption.host"
          />
        </div>
        <div class="inline-block mb-2 mr-10" v-if="connectionOption.dbType != 'Redis' || !connectionOption.socketPath">
          <label class="inline-block w-32 mr-5 font-bold">
            Port
            <span class="mr-1 text-red-600" title="required" v-if="connectionOption.dbType != 'Redis'">*</span>
          </label>
          <input
            class="w-64 field__input"
            placeholder="The port of connection"
            :required="connectionOption.dbType != 'Redis'"
            type="number"
            v-model="connectionOption.port"
          />
        </div>
        <div class="inline-block mb-2 mr-10" v-if="connectionOption.dbType == 'Redis'">
          <label class="inline-block w-32 mr-5 font-bold">Socket Path</label>
          <input
            class="w-64 field__input"
            placeholder="/tmp/redis.sock (optional)"
            v-model="connectionOption.socketPath"
          />
        </div>
      </section>

      <SQLServer :connectionOption="connectionOption" v-if="connectionOption.dbType == 'SQL Server'" />

      <section>
        <div class="inline-block mb-2 mr-10" v-if="connectionOption.dbType != 'Redis'">
          <label class="inline-block w-32 mr-5 font-bold">
            Username
            <span class="mr-1 text-red-600" title="required">*</span>
          </label>
          <input class="w-64 field__input" placeholder="Username" required v-model="connectionOption.user" />
        </div>
        <div class="inline-block mb-2 mr-10">
          <label class="inline-block w-32 mr-5 font-bold">Password</label>
          <input class="w-64 field__input" placeholder="Password" type="password" v-model="connectionOption.password" />
        </div>
      </section>

      <section v-if="connectionOption.dbType != 'FTP' && connectionOption.dbType != 'MongoDB'">
        <div class="inline-block mb-2 mr-10">
          <label class="inline-block w-32 mr-5 font-bold">Databases</label>
          <input
            class="w-64 field__input"
            placeholder="Special connection database"
            v-model="connectionOption.database"
          />
        </div>
        <div class="inline-block mb-2 mr-10" v-if="connectionOption.dbType != 'Redis'">
          <label class="inline-block w-32 mr-5 font-bold">Include Databases</label>
          <input
            class="w-64 field__input"
            placeholder="Example: mysql,information_schema"
            v-model="connectionOption.includeDatabases"
          />
        </div>
      </section>

      <FTP v-if="connectionOption.dbType == 'FTP'" :connectionOption="connectionOption" />

      <section>
        <div class="inline-block mb-2 mr-10">
          <label class="inline-block w-32 mr-5 font-bold">Connection Timeout</label>
          <input class="w-64 field__input" placeholder="5000" v-model="connectionOption.connectTimeout" />
        </div>
        <div class="inline-block mb-2 mr-10">
          <label class="inline-block w-32 mr-5 font-bold">Request Timeout</label>
          <input
            class="w-64 field__input"
            placeholder="10000"
            type="number"
            v-model="connectionOption.requestTimeout"
          />
        </div>
      </section>

      <section class="flex items-center mb-2" v-if="connectionOption.dbType == 'MySQL'">
        <div class="inline-block mb-2 mr-10">
          <label class="inline-block w-32 mr-5 font-bold">Timezone</label>
          <input class="w-64 field__input" placeholder="+HH:MM" v-model="connectionOption.timezone" />
        </div>
      </section>
    </template>

    <section class="flex items-center">
      <div
        class="inline-block mb-2 mr-10"
        v-if="connectionOption.dbType != 'SSH' && connectionOption.dbType != 'SQLite'"
      >
        <label class="mr-2 font-bold">SSH Tunnel</label>
        <el-switch v-model="connectionOption.usingSSH"></el-switch>
      </div>
      <div
        class="inline-block mb-2 mr-10"
        v-if="
          connectionOption.dbType == 'MySQL' ||
          connectionOption.dbType == 'PostgreSQL' ||
          connectionOption.dbType == 'MongoDB' ||
          connectionOption.dbType == 'Redis'
        "
      >
        <label class="inline-block mr-5 font-bold w-18">Use SSL</label>
        <el-switch v-model="connectionOption.useSSL"></el-switch>
      </div>
      <div class="inline-block mb-2 mr-10" v-if="connectionOption.dbType === 'MongoDB'">
        <label class="inline-block mr-5 font-bold w-18">SRV Record</label>
        <el-switch v-model="connectionOption.srv"></el-switch>
      </div>
      <div class="inline-block mb-2 mr-10" v-if="connectionOption.dbType === 'MongoDB'">
        <label class="inline-block mr-5 font-bold w-18">Use Connection String</label>
        <el-switch v-model="connectionOption.useConnectionString"></el-switch>
      </div>
    </section>
    <section class="flex items-center" v-if="connectionOption.useConnectionString">
      <div class="flex w-full mb-2 mr-10">
        <label class="inline-block w-32 mr-5 font-bold">Connection String</label>
        <input
          class="w-4/5 field__input"
          placeholder="e.g mongodb+srv://username:password@server-url/admin"
          v-model="connectionOption.connectionUrl"
        />
      </div>
    </section>

    <SSL
      :connectionOption="connectionOption"
      v-if="
        connectionOption.useSSL &&
        ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'ElasticSearch'].includes(connectionOption.dbType)
      "
    />
    </div>

    <div v-show="configTab === 'ssh'">
      <section class="flex items-center mt-4 mb-2">
        <label class="inline-block w-32 mr-5 font-bold">Enable</label>
        <el-switch v-model="connectionOption.usingSSH"></el-switch>
        <span class="cfg__hint ml-4">Route this connection through a jump host.</span>
      </section>
      <SSH :connectionOption="connectionOption" v-if="connectionOption.dbType != 'SSH'"
        @choose="choose('privateKey')" />
    </div>

    <div v-show="configTab === 'socks'">
      <section class="mt-4">
        <div class="cfg__notice">
          The form below is saved with the connection, but proxy routing is not implemented yet,
          so these values do not affect how the connection is made.
        </div>
        <div class="inline-block mb-2 mr-10">
          <label class="inline-block w-24 mr-5 font-bold">Host</label>
          <input class="field__input" placeholder="127.0.0.1" v-model="connectionOption.socksHost" />
        </div>
        <div class="inline-block mb-2 mr-10">
          <label class="inline-block w-24 mr-5 font-bold">Port</label>
          <input class="field__input" style="width: 8rem" placeholder="1080" v-model="connectionOption.socksPort" />
        </div>
        <div class="inline-block mb-2 mr-10">
          <label class="inline-block w-24 mr-5 font-bold">Username</label>
          <input class="field__input" v-model="connectionOption.socksUser" />
        </div>
        <div class="inline-block mb-2 mr-10">
          <label class="inline-block w-24 mr-5 font-bold">Password</label>
          <input class="field__input" type="password" v-model="connectionOption.socksPassword" />
        </div>
      </section>
    </div>

    <div v-show="configTab === 'http'">
      <section class="mt-4">
        <div class="cfg__notice">
          The form below is saved with the connection, but proxy routing is not implemented yet,
          so these values do not affect how the connection is made.
        </div>
        <div class="inline-block mb-2 mr-10">
          <label class="inline-block w-24 mr-5 font-bold">Host</label>
          <input class="field__input" placeholder="127.0.0.1" v-model="connectionOption.httpProxyHost" />
        </div>
        <div class="inline-block mb-2 mr-10">
          <label class="inline-block w-24 mr-5 font-bold">Port</label>
          <input class="field__input" style="width: 8rem" placeholder="8080" v-model="connectionOption.httpProxyPort" />
        </div>
        <div class="inline-block mb-2 mr-10">
          <label class="inline-block w-24 mr-5 font-bold">Username</label>
          <input class="field__input" v-model="connectionOption.httpProxyUser" />
        </div>
        <div class="inline-block mb-2 mr-10">
          <label class="inline-block w-24 mr-5 font-bold">Password</label>
          <input class="field__input" type="password" v-model="connectionOption.httpProxyPassword" />
        </div>
      </section>
    </div>

    <div class="mt-4">
      <button class="inline mr-4 button button--primary w-28" type="button" @click="save">Save</button>
      <button class="inline mr-4 button button--primary w-28" type="submit" v-loading="connect.loading">Connect</button>
      <button class="inline button button--primary w-28" type="button" @click="close">Close</button>
    </div>
  </form>
</template>

<script>
import ElasticSearch from "./component/ElasticSearch.vue";
import SQLite from "./component/SQLite.vue";
import SQLServer from "./component/SQLServer.vue";
import SSH from "./component/SSH.vue";
import FTP from "./component/FTP.vue";
import S3 from "./component/S3.vue";
import JDBC from "./component/JDBC.vue";
import { PRIMARY, SECONDARY, MORE, applyServerType, matchServerType } from "./serverTypes";
import SSL from "./component/SSL.vue";
import { getVscodeEvent } from "../util/vscode";
let vscodeEvent;
export default {
  name: "Connect",
  components: { ElasticSearch, SQLite, SQLServer, SSH, SSL, FTP, S3, JDBC },
  data() {
    return {
      connectionOption: {
        host: "127.0.0.1",
        dbPath: "",
        port: "3306",
        user: "root",
        authType: "default",
        password: "",
        encoding: "utf8",
        database: null,
        usingSSH: false,
        showHidden: false,
        includeDatabases: null,
        dbType: "MySQL",
        encrypt: true,
        connectionUrl: "",
        socketPath: "",
        srv: false,
        esAuth: "none",
        s3Endpoint: "",
        s3AccessKey: "",
        s3SecretKey: "",
        s3Region: "us-east-1",
        s3ForcePathStyle: true,
        global: true,
        key: null,
        // scheme: "http",
        timezone: "+00:00",
        ssh: {
          host: "",
          privateKeyPath: "",
          port: 22,
          username: "root",
          type: "password",
          watingTime: 5000,
          algorithms: {
            cipher: [],
          },
        },
      },
      sqliteState: false,
      type: "password",
      primary: PRIMARY,
      secondary: SECONDARY,
      more: MORE,
      moreOpen: false,
      configTab: "main",
      configTabs: [
        { id: "main", label: "Main", icon: "⚙" },
        { id: "ssh", label: "SSH Tunnel", icon: "✂" },
        { id: "socks", label: "Socks Proxy", icon: "⇄" },
        { id: "http", label: "HTTP Proxy", icon: "☷" },
      ],
      connect: {
        loading: false,
        success: false,
        successMessage: "",
        error: false,
        errorMessage: "",
      },
      editModel: false,
    };
  },
  mounted() {
    vscodeEvent = getVscodeEvent();
    vscodeEvent
      .on("edit", (node) => {
        this.editModel = true;
        console.log(node);
        this.connectionOption = node;
      })
      .on("connect", (node) => {
        this.editModel = false;
      })
      .on("choose", ({ event, path }) => {
        switch (event) {
          case "sqlite":
            this.connectionOption.dbPath = path;
            break;
          case "privateKey":
            this.connectionOption.ssh.privateKeyPath = path;
            break;
        }
        this.$forceUpdate();
      })
      .on("sqliteState", (sqliteState) => {
        this.sqliteState = sqliteState;
      })
      .on("error", (err) => {
        this.connect.loading = false;
        this.connect.success = false;
        this.connect.error = true;
        this.connect.errorMessage = err;
      })
      .on("success", (res) => {
        this.connect.loading = false;
        this.connect.error = false;
        this.connect.success = true;
        this.connect.successMessage = res.message;
        this.connectionOption.connectionKey = res.connectionKey;
        this.connectionOption.key = res.key;
        this.connectionOption.isGlobal = this.connectionOption.global;
      });
    vscodeEvent.emit("route-" + this.$route.name);
  },
  destroyed() {
    vscodeEvent.destroy();
  },
  computed: {
    activeEntry() {
      return matchServerType(this.connectionOption);
    },
  },
  methods: {
    save() {
      // persist without opening a connection
      this.emit("save", { connectionOption: this.connectionOption });
    },
    pick(entry) {
      applyServerType(entry, this.connectionOption);
    },
    isActive(entry) {
      const m = matchServerType(this.connectionOption);
      return !!m && m.label === entry.label;
    },
    typeHint(entry) {
      if (entry.kind === "native") return entry.label + " (built in driver)";
      return entry.label + (entry.bundled ? " (JDBC, driver bundled)" : " (JDBC, supply driver jar)");
    },
    installSqlite() {
      vscodeEvent.emit("installSqlite");
      this.sqliteState = true;
    },
    tryConnect() {
      this.connect.loading = true;
      vscodeEvent.emit("connecting", {
        connectionOption: this.connectionOption,
      });
    },
    choose(event) {
      let filters = {};
      switch (event) {
        case "sqlite":
          filters["SQLiteDb"] = ["db"];
          break;
        case "privateKey":
          filters["PrivateKey"] = ["key", "cer", "crt", "der", "pub", "pem", "pk"];
          break;
      }
      filters["File"] = ["*"];
      vscodeEvent.emit("choose", {
        event,
        filters,
      });
    },
    close() {
      vscodeEvent.emit("close");
    },
  },
  watch: {
    "connectionOption.dbType"(value) {
      if (this.editModel) {
        return;
      }
      this.connectionOption.host = "127.0.0.1";
      switch (value) {
        case "MySQL":
          this.connectionOption.user = "root";
          this.connectionOption.port = 3306;
          this.connectionOption.database = null;
          break;
        case "PostgreSQL":
          this.connectionOption.user = "postgres";
          this.connectionOption.encrypt = false;
          this.connectionOption.port = 5432;
          this.connectionOption.database = "postgres";
          break;
        case "Oracle":
          this.connectionOption.user = "system";
          this.connectionOption.port = 1521;
          break;
        case "SqlServer":
          this.connectionOption.user = "sa";
          this.connectionOption.encrypt = true;
          this.connectionOption.port = 1433;
          this.connectionOption.database = "master";
          break;
        case "ElasticSearch":
          this.connectionOption.host = "127.0.0.1:9200";
          this.connectionOption.user = null;
          this.connectionOption.port = null;
          this.connectionOption.database = null;
          break;
        case "Redis":
          this.connectionOption.port = 6379;
          this.connectionOption.user = null;
          this.connectionOption.database = "0";
          break;
        case "MongoDB":
          this.connectionOption.user = null;
          this.connectionOption.password = null;
          this.connectionOption.port = 27017;
          break;
        case "FTP":
          this.connectionOption.port = 21;
          this.connectionOption.user = null;
          break;
        case "SSH":
          break;
        case "S3":
          this.connectionOption.s3Endpoint = this.connectionOption.s3Endpoint || "http://127.0.0.1:9000";
          this.connectionOption.s3Region = this.connectionOption.s3Region || "us-east-1";
          if (this.connectionOption.s3ForcePathStyle === undefined) this.connectionOption.s3ForcePathStyle = true;
          this.connectionOption.user = null;
          this.connectionOption.password = null;
          break;
        case "Exasol":
          this.connectionOption.user = "sys";
          this.connectionOption.port = 8563;
          this.connectionOption.database = null;
          break;
      }
      this.$forceUpdate();
    },
    "connectionOption.connectionUrl"(value) {
      let connectionUrl = this.connectionOption.connectionUrl;

      const srvRegex = /(?<=mongodb\+).+?(?=:\/\/)/;
      const srv = connectionUrl.match(srvRegex);
      if (srv) {
        this.connectionOption.srv = true;
        connectionUrl = connectionUrl.replace(srvRegex, "");
      }
      const userRegex = /(?<=\/\/).+?(?=\:)/;
      const user = connectionUrl.match(userRegex);
      if (user) {
        this.connectionOption.user = user[0];
        connectionUrl = connectionUrl.replace(userRegex, "");
      }
      const passwordRegex = /(?<=\/\/:).+?(?=@)/;
      const password = connectionUrl.match(passwordRegex);
      if (password) {
        this.connectionOption.password = password[0];
        connectionUrl = connectionUrl.replace(passwordRegex, "");
      }

      const hostRegex = /(?<=@).+?(?=[:\/])/;
      const host = connectionUrl.match(hostRegex);
      if (host) {
        this.connectionOption.host = host[0];
        connectionUrl = connectionUrl.replace(hostRegex, "");
      }

      if (!this.connectionOption.srv) {
        const portRegex = /(?<=\:).\d+/;
        const port = connectionUrl.match(portRegex);
        if (port) {
          this.connectionOption.port = port[0];
          connectionUrl = connectionUrl.replace(portRegex, "");
        }
      }

      this.$forceUpdate();
    },
  },
};
</script>

<style scoped>
.connect-container {
  width: 100%;
  max-width: 1300px;
}

.tab {
  border-bottom: 1px solid var(--vscode-dropdown-border);
  display: flex;
  padding: 0;
}

.tab__item {
  list-style: none;
  cursor: pointer;
  font-size: 13px;
  padding: 7px 10px;
  color: var(--vscode-foreground);
  border-bottom: 1px solid transparent;
}

.tab__item:hover {
  color: var(--vscode-panelTitle-activeForeground);
}

.tab__item--active {
  color: var(--vscode-panelTitle-activeForeground);
  border-bottom-color: var(--vscode-panelTitle-activeForeground);
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.button {
  padding: 4px 14px;
  border: 0;
  display: inline-block;
  outline: none;
  @apply font-bold;
  cursor: pointer;
}

.button--primary {
  color: var(--vscode-button-foreground);
  background-color: var(--vscode-button-background);
}

.button--primary:hover {
  background-color: var(--vscode-button-hoverBackground);
}

.panel {
  border-left-width: 5px;
  border-left-style: solid;
  background: var(--vscode-textBlockQuote-background);
}

.error {
  border-color: var(--vscode-inputValidation-errorBorder);
}

.success {
  border-color: green;
}

.panel__text {
  line-height: 2;
}

/* server type picker: two dense rows plus an expandable More panel, using
   the editor's own theme colours so it matches whatever theme is active */
.server-type .st-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 0;
  margin-top: 6px;
}
.server-type .st-item {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  margin-right: 2px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  font-size: 13px;
  color: var(--vscode-foreground);
  border: 1px solid transparent;
}
.server-type .st-item:hover {
  background: var(--vscode-list-hoverBackground);
}
.server-type .st-item--active {
  color: var(--vscode-textLink-foreground);
  border-bottom: 2px solid var(--vscode-textLink-foreground);
  border-radius: 4px 4px 0 0;
}
.server-type .st-icon {
  margin-right: 5px;
  font-style: normal;
}
.server-type .st-more-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 0;
  margin-top: 6px;
  padding: 8px;
  border: 1px solid var(--vscode-panel-border, rgba(128,128,128,.35));
  border-radius: 6px;
  background: var(--vscode-editorWidget-background, rgba(128,128,128,.08));
}
.server-type .st-note {
  margin-top: 8px;
  font-size: 12px;
  opacity: .8;
}

/* config tab strip and the segmented Scope control */
.cfg {
  display: flex;
  align-items: center;
  gap: 2px;
  border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
  padding-bottom: 0;
}
.cfg__label {
  font-weight: 700;
  margin-right: 14px;
  opacity: 0.75;
}
.cfg__item {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  cursor: pointer;
  font-size: 13px;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 5px 5px 0 0;
  color: var(--vscode-foreground);
  margin-bottom: -1px;
}
.cfg__item:hover {
  background: var(--vscode-list-hoverBackground);
}
.cfg__item--active {
  border-color: var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
  border-bottom: 1px solid var(--vscode-editor-background);
  background: var(--vscode-editor-background);
  color: var(--vscode-textLink-foreground);
}
.cfg__icon {
  margin-right: 6px;
  font-style: normal;
}
.cfg__hint {
  font-size: 12px;
  opacity: 0.7;
}
.cfg__notice {
  margin-bottom: 12px;
  padding: 8px 12px;
  border-radius: 5px;
  font-size: 12px;
  border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
  background: var(--vscode-editorWidget-background, rgba(128, 128, 128, 0.08));
}
.seg {
  display: inline-flex;
  border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
  border-radius: 5px;
  overflow: hidden;
}
.seg__item {
  padding: 4px 16px;
  cursor: pointer;
  font-size: 13px;
  background: transparent;
  color: var(--vscode-foreground);
  border: none;
}
.seg__item:hover {
  background: var(--vscode-list-hoverBackground);
}
.seg__item--active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}
</style>
