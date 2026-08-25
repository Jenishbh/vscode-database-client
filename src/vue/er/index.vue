<template>
  <div class="er-root">
    <div class="er-toolbar">
      <el-button size="mini" @click="refresh" title="Refresh">Refresh</el-button>
      <button class="er-icon-btn" @click="zoomIn" title="Zoom In">
        <svg viewBox="0 0 16 16" width="16" height="16">
          <circle cx="7" cy="7" r="4.3" /><line x1="10.2" y1="10.2" x2="14" y2="14" />
          <line x1="7" y1="4.8" x2="7" y2="9.2" /><line x1="4.8" y1="7" x2="9.2" y2="7" />
        </svg>
      </button>
      <button class="er-icon-btn" @click="zoomOut" title="Zoom Out">
        <svg viewBox="0 0 16 16" width="16" height="16">
          <circle cx="7" cy="7" r="4.3" /><line x1="10.2" y1="10.2" x2="14" y2="14" />
          <line x1="4.8" y1="7" x2="9.2" y2="7" />
        </svg>
      </button>
      <button class="er-icon-btn" @click="resetView" title="Reset View">
        <svg viewBox="0 0 16 16" width="16" height="16">
          <path d="M2 6 V2 H6 M10 2 H14 V6 M14 10 V14 H10 M6 14 H2 V10" />
        </svg>
      </button>
      <button class="er-icon-btn" @click="exportDiagram" title="Export">
        <svg viewBox="0 0 16 16" width="16" height="16">
          <path d="M8 2 V10 M4.5 6.5 L8 10 L11.5 6.5 M2.5 13.5 H13.5" />
        </svg>
      </button>
    </div>

    <div class="er-message" v-if="overlayText">{{ overlayText }}</div>

    <div class="er-canvas-wrap" ref="wrap" v-else
         :class="{ 'is-panning': isPanning }"
         :style="{ backgroundPosition: pan.x + 'px ' + pan.y + 'px' }"
         @wheel.prevent="onWheel"
         @mousedown="onPanStart">
      <svg class="er-canvas" :width="viewport.width" :height="viewport.height">
        <defs>
          <marker id="er-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" class="er-arrow-head" />
          </marker>
        </defs>
        <g :transform="`translate(${pan.x},${pan.y}) scale(${zoom})`">
          <g class="er-content" ref="content">
            <path v-for="edge in edges" :key="edge.key" :d="edge.path" class="er-edge" marker-end="url(#er-arrow)" />
            <g v-for="t in layoutTables" :key="t.name" :transform="`translate(${t.x},${t.y})`" class="er-card">
              <rect :width="t.width" :height="t.height" rx="6" ry="6" class="er-card-bg" />
              <line x1="0" :x2="t.width" :y1="headerHeight" :y2="headerHeight" class="er-card-header-line" />
              <rect x="10" y="10" width="10" height="10" rx="1.5" class="er-table-icon-bg" />
              <line x1="10" y1="13.3" x2="20" y2="13.3" class="er-table-icon-line" />
              <line x1="10" y1="16.6" x2="20" y2="16.6" class="er-table-icon-line" />
              <text x="28" y="19" class="er-card-title">{{ t.name }}</text>
              <g v-for="(c, ci) in t.columns" :key="c.name" :transform="`translate(0, ${headerHeight + ci * rowHeight})`">
                <g v-if="c.isPrimaryKey" class="er-key-icon" transform="translate(9,4)">
                  <circle cx="4.3" cy="4.3" r="3" />
                  <line x1="6.5" y1="6.5" x2="12" y2="12" />
                  <line x1="9.3" y1="9.3" x2="9.3" y2="11.6" />
                  <line x1="10.7" y1="10.7" x2="12" y2="10.7" />
                </g>
                <g v-else-if="c.isForeignKey" class="er-fk-icon" transform="translate(9,3.5)">
                  <rect x="1" y="0" width="9" height="12" rx="1.5" />
                  <line x1="3" y1="4" x2="8" y2="4" />
                  <line x1="3" y1="7" x2="8" y2="7" />
                </g>
                <text x="28" :y="rowHeight / 2 + 4" class="er-col-name">{{ c.name }}</text>
                <text :x="t.width - 10" :y="rowHeight / 2 + 4" text-anchor="end" class="er-col-type">{{ c.type }}</text>
              </g>
            </g>
          </g>
        </g>
      </svg>

      <div class="er-minimap" @mousedown.stop>
        <svg :width="minimapWidth" :height="minimapHeight">
          <rect x="0" y="0" :width="minimapWidth" :height="minimapHeight" class="er-minimap-bg" />
          <rect v-for="t in layoutTables" :key="'m' + t.name"
                :x="8 + (t.x - contentBBox.minX) * minimapScale" :y="8 + (t.y - contentBBox.minY) * minimapScale"
                :width="t.width * minimapScale" :height="t.height * minimapScale" class="er-minimap-card" />
          <rect :x="minimapViewportRect.x" :y="minimapViewportRect.y"
                :width="minimapViewportRect.width" :height="minimapViewportRect.height" class="er-minimap-viewport" />
        </svg>
      </div>
    </div>
  </div>
</template>

<script>
import { inject } from "../mixin/vscodeInject";

export default {
  mixins: [inject],
  data() {
    return {
      loading: false,
      supported: true,
      message: null,
      database: '',
      tables: [],
      relationships: [],

      zoom: 1,
      pan: { x: 40, y: 40 },
      viewport: { width: 0, height: 0 },
      isPanning: false,
      panStart: { x: 0, y: 0, panX: 0, panY: 0 },

      cardWidth: 220,
      headerHeight: 30,
      rowHeight: 22,
      minimapWidth: 180,
      minimapHeight: 130,
    };
  },
  computed: {
    overlayText() {
      if (!this.supported) return this.message || 'ER diagram is not supported for this database.';
      if (this.message) return this.message;
      if (this.loading) return 'Loading schema...';
      if (!this.tables.length) return 'No tables found in this schema.';
      return null;
    },
    layoutTables() {
      const cols = Math.max(1, Math.ceil(Math.sqrt(this.tables.length || 1)));
      const gapX = 70, gapY = 50;
      let x = 0, y = 0, colIndex = 0, rowMaxHeight = 0;
      const list = [];
      for (const t of this.tables) {
        const height = this.headerHeight + t.columns.length * this.rowHeight + 8;
        list.push({ name: t.name, columns: t.columns, x, y, width: this.cardWidth, height });
        rowMaxHeight = Math.max(rowMaxHeight, height);
        colIndex++;
        if (colIndex >= cols) {
          colIndex = 0; x = 0; y += rowMaxHeight + gapY; rowMaxHeight = 0;
        } else {
          x += this.cardWidth + gapX;
        }
      }
      return list;
    },
    tableMap() {
      const map = {};
      for (const t of this.layoutTables) map[t.name] = t;
      return map;
    },
    edges() {
      const map = this.tableMap;
      const list = [];
      for (const rel of this.relationships) {
        const from = map[rel.fromTable];
        const to = map[rel.toTable];
        if (!from || !to || from === to) continue;
        const fromIdx = from.columns.findIndex(c => c.name === rel.fromColumn);
        const toIdx = to.columns.findIndex(c => c.name === rel.toColumn);
        const fromY = from.y + this.headerHeight + Math.max(0, fromIdx) * this.rowHeight + this.rowHeight / 2;
        const toY = to.y + this.headerHeight + Math.max(0, toIdx) * this.rowHeight + this.rowHeight / 2;
        const leftToRight = (from.x + from.width / 2) < (to.x + to.width / 2);
        const fromX = leftToRight ? from.x + from.width : from.x;
        const toX = leftToRight ? to.x : to.x + to.width;
        const dx = Math.max(Math.abs(toX - fromX) / 2, 50);
        const c1x = leftToRight ? fromX + dx : fromX - dx;
        const c2x = leftToRight ? toX - dx : toX + dx;
        list.push({
          key: `${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`,
          path: `M ${fromX} ${fromY} C ${c1x} ${fromY}, ${c2x} ${toY}, ${toX} ${toY}`,
        });
      }
      return list;
    },
    contentBBox() {
      if (!this.layoutTables.length) return { minX: 0, minY: 0, maxX: 400, maxY: 300 };
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const t of this.layoutTables) {
        minX = Math.min(minX, t.x); minY = Math.min(minY, t.y);
        maxX = Math.max(maxX, t.x + t.width); maxY = Math.max(maxY, t.y + t.height);
      }
      return { minX, minY, maxX, maxY };
    },
    minimapScale() {
      const bb = this.contentBBox;
      const w = Math.max(1, bb.maxX - bb.minX), h = Math.max(1, bb.maxY - bb.minY);
      return Math.min((this.minimapWidth - 16) / w, (this.minimapHeight - 16) / h, 1);
    },
    minimapViewportRect() {
      const s = this.minimapScale;
      const bb = this.contentBBox;
      const worldX = -this.pan.x / this.zoom;
      const worldY = -this.pan.y / this.zoom;
      const worldW = (this.viewport.width || 0) / this.zoom;
      const worldH = (this.viewport.height || 0) / this.zoom;
      return {
        x: 8 + (worldX - bb.minX) * s,
        y: 8 + (worldY - bb.minY) * s,
        width: Math.max(2, worldW * s),
        height: Math.max(2, worldH * s),
      };
    },
  },
  mounted() {
    this.on("er-data", (data) => {
      this.loading = false;
      this.supported = data.supported;
      this.message = data.message;
      this.database = data.database;
      this.tables = data.tables || [];
      this.relationships = data.relationships || [];
      this.$nextTick(() => this.fitView());
    });
    this.$nextTick(() => this.measureViewport());
    window.addEventListener('resize', this.measureViewport);
    this.refresh();
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.measureViewport);
    window.removeEventListener('mousemove', this.onPanMove);
    window.removeEventListener('mouseup', this.onPanEnd);
  },
  methods: {
    refresh() {
      this.loading = true;
      this.init();
    },
    measureViewport() {
      const el = this.$refs.wrap;
      if (!el) return;
      this.viewport.width = el.clientWidth;
      this.viewport.height = el.clientHeight;
    },
    clampZoom(z) {
      return Math.min(3, Math.max(0.15, z));
    },
    zoomAt(factor, cx, cy) {
      const newZoom = this.clampZoom(this.zoom * factor);
      const worldX = (cx - this.pan.x) / this.zoom;
      const worldY = (cy - this.pan.y) / this.zoom;
      this.pan.x = cx - worldX * newZoom;
      this.pan.y = cy - worldY * newZoom;
      this.zoom = newZoom;
    },
    zoomIn() {
      this.zoomAt(1.2, this.viewport.width / 2, this.viewport.height / 2);
    },
    zoomOut() {
      this.zoomAt(1 / 1.2, this.viewport.width / 2, this.viewport.height / 2);
    },
    onWheel(e) {
      const rect = this.$refs.wrap.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      this.zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
    },
    onPanStart(e) {
      this.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY, panX: this.pan.x, panY: this.pan.y };
      window.addEventListener('mousemove', this.onPanMove);
      window.addEventListener('mouseup', this.onPanEnd);
    },
    onPanMove(e) {
      if (!this.isPanning) return;
      this.pan.x = this.panStart.panX + (e.clientX - this.panStart.x);
      this.pan.y = this.panStart.panY + (e.clientY - this.panStart.y);
    },
    onPanEnd() {
      this.isPanning = false;
      window.removeEventListener('mousemove', this.onPanMove);
      window.removeEventListener('mouseup', this.onPanEnd);
    },
    fitView() {
      this.measureViewport();
      if (!this.viewport.width || !this.viewport.height || !this.layoutTables.length) {
        this.zoom = 1; this.pan = { x: 40, y: 40 };
        return;
      }
      const bb = this.contentBBox;
      const w = Math.max(1, bb.maxX - bb.minX);
      const h = Math.max(1, bb.maxY - bb.minY);
      const pad = 60;
      const scale = Math.min((this.viewport.width - pad) / w, (this.viewport.height - pad) / h, 1.25);
      this.zoom = this.clampZoom(scale > 0 ? scale : 1);
      this.pan = {
        x: (this.viewport.width - w * this.zoom) / 2 - bb.minX * this.zoom,
        y: (this.viewport.height - h * this.zoom) / 2 - bb.minY * this.zoom,
      };
    },
    resetView() {
      this.fitView();
    },
    exportDiagram() {
      const svgNS = 'http://www.w3.org/2000/svg';
      const bb = this.contentBBox;
      const pad = 40;
      const width = (bb.maxX - bb.minX) + pad * 2;
      const height = (bb.maxY - bb.minY) + pad * 2;
      const style = getComputedStyle(document.body);
      const resolve = (name, fallback) => (style.getPropertyValue(name) || '').trim() || fallback;
      const vars = {
        '--vscode-foreground': resolve('--vscode-foreground', '#cccccc'),
        '--vscode-panel-border': resolve('--vscode-panel-border', 'rgba(128,128,128,.35)'),
        '--vscode-editor-background': resolve('--vscode-editor-background', '#1e1e1e'),
        '--vscode-editorWidget-background': resolve('--vscode-editorWidget-background', '#252526'),
        '--vscode-charts-yellow': resolve('--vscode-charts-yellow', '#d6b64a'),
        '--vscode-charts-blue': resolve('--vscode-charts-blue', '#3794ff'),
      };
      const rootVars = Object.keys(vars).map(k => `${k}:${vars[k]};`).join('');
      const css = `:root{${rootVars}}`
        + `text{font-family:var(--vscode-font-family,sans-serif);}`
        + `.er-card-bg{fill:var(--vscode-editorWidget-background);stroke:var(--vscode-panel-border);stroke-width:1;}`
        + `.er-card-header-line{stroke:var(--vscode-panel-border);stroke-width:1;}`
        + `.er-table-icon-bg,.er-table-icon-line{fill:none;stroke:var(--vscode-foreground);stroke-width:1;}`
        + `.er-card-title{fill:var(--vscode-foreground);font-size:12px;font-weight:600;}`
        + `.er-col-name{fill:var(--vscode-foreground);font-size:12px;}`
        + `.er-col-type{fill:var(--vscode-foreground);font-size:12px;opacity:.6;}`
        + `.er-edge{fill:none;stroke:var(--vscode-panel-border);stroke-width:1.5;}`
        + `.er-arrow-head{fill:var(--vscode-panel-border);}`
        + `.er-key-icon{stroke:var(--vscode-charts-yellow);stroke-width:1.3;fill:none;}`
        + `.er-fk-icon{stroke:var(--vscode-charts-blue);stroke-width:1.3;fill:none;}`;

      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('xmlns', svgNS);
      svg.setAttribute('viewBox', `${bb.minX - pad} ${bb.minY - pad} ${width} ${height}`);
      svg.setAttribute('width', String(width));
      svg.setAttribute('height', String(height));

      const styleEl = document.createElementNS(svgNS, 'style');
      styleEl.textContent = css;
      svg.appendChild(styleEl);

      const bgRect = document.createElementNS(svgNS, 'rect');
      bgRect.setAttribute('x', String(bb.minX - pad));
      bgRect.setAttribute('y', String(bb.minY - pad));
      bgRect.setAttribute('width', String(width));
      bgRect.setAttribute('height', String(height));
      bgRect.setAttribute('fill', 'var(--vscode-editor-background)');
      svg.appendChild(bgRect);

      const defs = document.createElementNS(svgNS, 'defs');
      defs.innerHTML = '<marker id="er-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="er-arrow-head" /></marker>';
      svg.appendChild(defs);

      svg.appendChild(this.$refs.content.cloneNode(true));

      const xml = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([xml], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `er-diagram-${this.database || 'schema'}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  },
};
</script>

<style scoped>
.er-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--vscode-editor-background);
  color: var(--vscode-foreground);
}

.er-toolbar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, .35));
}

.er-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--vscode-foreground);
  cursor: pointer;
}

.er-icon-btn:hover {
  border-color: var(--vscode-panel-border, rgba(128, 128, 128, .35));
}

.er-icon-btn svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.er-message {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--vscode-foreground);
  opacity: .75;
  padding: 24px;
  text-align: center;
}

.er-canvas-wrap {
  position: relative;
  flex: 1 1 auto;
  overflow: hidden;
  cursor: grab;
  background-color: var(--vscode-editor-background);
  background-image: radial-gradient(var(--vscode-panel-border, rgba(128, 128, 128, .35)) 1px, transparent 1px);
  background-size: 18px 18px;
  user-select: none;
}

.er-canvas-wrap.is-panning {
  cursor: grabbing;
}

.er-canvas {
  display: block;
}

.er-card-bg {
  fill: var(--vscode-editorWidget-background);
  stroke: var(--vscode-panel-border, rgba(128, 128, 128, .35));
  stroke-width: 1;
}

.er-card-header-line {
  stroke: var(--vscode-panel-border, rgba(128, 128, 128, .35));
  stroke-width: 1;
}

.er-table-icon-bg,
.er-table-icon-line {
  fill: none;
  stroke: var(--vscode-foreground);
  stroke-width: 1;
}

.er-card-title {
  fill: var(--vscode-foreground);
  font-size: 12px;
  font-weight: 600;
  dominant-baseline: middle;
}

.er-col-name {
  fill: var(--vscode-foreground);
  font-size: 12px;
}

.er-col-type {
  fill: var(--vscode-foreground);
  font-size: 12px;
  opacity: .6;
}

.er-edge {
  fill: none;
  stroke: var(--vscode-panel-border, rgba(128, 128, 128, .6));
  stroke-width: 1.5;
}

.er-arrow-head {
  fill: var(--vscode-panel-border, rgba(128, 128, 128, .6));
}

.er-key-icon {
  stroke: var(--vscode-charts-yellow, #d6b64a);
  stroke-width: 1.3;
  fill: none;
}

.er-fk-icon {
  stroke: var(--vscode-charts-blue, #3794ff);
  stroke-width: 1.3;
  fill: none;
}

.er-minimap {
  position: absolute;
  right: 12px;
  bottom: 12px;
  border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, .35));
  background: var(--vscode-editorWidget-background);
  border-radius: 4px;
  overflow: hidden;
  cursor: default;
}

.er-minimap-bg {
  fill: var(--vscode-editorWidget-background);
}

.er-minimap-card {
  fill: var(--vscode-editor-background);
  stroke: var(--vscode-panel-border, rgba(128, 128, 128, .35));
  stroke-width: 1;
}

.er-minimap-viewport {
  fill: var(--vscode-textLink-foreground);
  fill-opacity: .15;
  stroke: var(--vscode-textLink-foreground);
  stroke-width: 1;
}
</style>
