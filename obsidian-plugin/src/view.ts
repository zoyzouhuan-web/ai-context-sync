import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import { ProjectContext, ProjectSummary } from './types';
import { parseContextFile, serializeContextFile } from './parser';
import type ContextBridgePlugin from './main';

export const VIEW_TYPE = 'context-bridge-view';
const CONTEXT_DIR = 'ContextBridge';

export class ContextBridgeView extends ItemView {
  plugin: ContextBridgePlugin;
  private selectedProject: string | null = null;
  private projects: ProjectSummary[] = [];
  private currentContext: ProjectContext | null = null;
  private editing = false;

  constructor(leaf: WorkspaceLeaf, plugin: ContextBridgePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'ContextBridge'; }
  getIcon() { return 'brain-circuit'; }

  async onOpen() {
    await this.render();
  }

  async onClose() {}

  async render() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('context-bridge-container');

    await this.loadProjects();
    this.renderHeader(container);
    this.renderProjectSelector(container);

    if (this.selectedProject && this.currentContext) {
      this.renderCurrentStatus(container);
      this.renderHistory(container);
    } else if (this.projects.length === 0) {
      container.createEl('p', { text: '暂无项目上下文记录。', cls: 'cb-empty' });
    }
  }

  private async loadProjects() {
    this.projects = [];
    const vault = this.app.vault;
    const dirPath = CONTEXT_DIR;

    const files = vault.getFiles().filter(f =>
      f.path.startsWith(dirPath + '/') && f.extension === 'md'
    );

    for (const file of files) {
      const content = await vault.read(file);
      const ctx = parseContextFile(content, file.path);
      this.projects.push({
        name: file.basename,
        filePath: file.path,
        project: ctx.project,
        last_updated: ctx.last_updated,
        current_status: ctx.current_status?.slice(0, 60) + (ctx.current_status?.length > 60 ? '...' : ''),
        history_count: ctx.history.length,
      });
    }

    this.projects.sort((a, b) => b.last_updated.localeCompare(a.last_updated));

    // Auto-select first if none selected or selected no longer exists
    if (this.projects.length > 0) {
      const stillExists = this.projects.find(p => p.filePath === this.selectedProject);
      if (!stillExists) this.selectedProject = this.projects[0].filePath;
      await this.loadContext(this.selectedProject!);
    }
  }

  private async loadContext(filePath: string) {
    this.selectedProject = filePath;
    const file = this.app.vault.getAbstractFileByPath(filePath) as TFile;
    if (!file) return;
    const content = await this.app.vault.read(file);
    this.currentContext = parseContextFile(content, filePath);
    this.editing = false;
  }

  private renderHeader(container: HTMLElement) {
    const header = container.createDiv({ cls: 'cb-header' });
    header.createEl('span', { text: 'ContextBridge', cls: 'cb-title' });
    const refreshBtn = header.createEl('button', { cls: 'cb-icon-btn', title: '刷新' });
    refreshBtn.innerHTML = '↻';
    refreshBtn.addEventListener('click', () => this.render());
  }

  private renderProjectSelector(container: HTMLElement) {
    if (this.projects.length === 0) return;

    const section = container.createDiv({ cls: 'cb-section' });
    const select = section.createEl('select', { cls: 'cb-select' });

    this.projects.forEach(p => {
      const label = p.project
        ? p.project.replace(/.*\//, '') + ' · ' + this.formatDate(p.last_updated)
        : p.name;
      const opt = select.createEl('option', { value: p.filePath, text: label });
      if (p.filePath === this.selectedProject) opt.selected = true;
    });

    select.addEventListener('change', async () => {
      await this.loadContext(select.value);
      this.rerender(container);
    });
  }

  private renderCurrentStatus(container: HTMLElement) {
    const ctx = this.currentContext!;
    const section = container.createDiv({ cls: 'cb-section' });

    // Project path
    section.createEl('div', {
      text: ctx.project,
      cls: 'cb-project-path',
    });

    // Current status
    section.createEl('div', { text: '当前任务状态', cls: 'cb-label' });

    if (this.editing) {
      const textarea = section.createEl('textarea', { cls: 'cb-textarea' });
      textarea.value = ctx.current_status;
      textarea.rows = 4;

      // Key decisions
      section.createEl('div', { text: '关键决策', cls: 'cb-label' });
      const decisionsArea = section.createEl('textarea', { cls: 'cb-textarea' });
      decisionsArea.value = ctx.key_decisions.join('\n');
      decisionsArea.rows = 4;
      decisionsArea.placeholder = '每行一条决策';

      // Buttons
      const btnRow = section.createDiv({ cls: 'cb-btn-row' });
      const saveBtn = btnRow.createEl('button', { text: '保存', cls: 'cb-btn cb-btn-primary' });
      const cancelBtn = btnRow.createEl('button', { text: '取消', cls: 'cb-btn' });

      saveBtn.addEventListener('click', async () => {
        ctx.current_status = textarea.value.trim();
        ctx.key_decisions = decisionsArea.value.split('\n').map(l => l.trim()).filter(Boolean);
        await this.saveContext(ctx);
        this.editing = false;
        this.rerender(container);
        new Notice('已保存');
      });

      cancelBtn.addEventListener('click', () => {
        this.editing = false;
        this.rerender(container);
      });
    } else {
      const statusEl = section.createDiv({ cls: 'cb-status-text' });
      statusEl.setText(ctx.current_status || '（无）');

      // Key decisions
      if (ctx.key_decisions.length > 0) {
        section.createEl('div', { text: '关键决策', cls: 'cb-label' });
        const list = section.createEl('ul', { cls: 'cb-decisions' });
        ctx.key_decisions.forEach(d => list.createEl('li', { text: d }));
      }

      const btnRow = section.createDiv({ cls: 'cb-btn-row' });
      const editBtn = btnRow.createEl('button', { text: '编辑', cls: 'cb-btn' });
      editBtn.addEventListener('click', () => {
        this.editing = true;
        this.rerender(container);
      });
    }
  }

  private renderHistory(container: HTMLElement) {
    const ctx = this.currentContext!;
    if (ctx.history.length === 0) return;

    const section = container.createDiv({ cls: 'cb-section' });
    section.createEl('div', { text: '历史记录', cls: 'cb-label' });

    const list = section.createDiv({ cls: 'cb-history' });

    ctx.history.forEach((entry, i) => {
      const item = list.createDiv({ cls: 'cb-history-item' });
      const header = item.createDiv({ cls: 'cb-history-header' });

      const toolTag = header.createEl('span', {
        text: entry.tool,
        cls: `cb-tool-tag cb-tool-${entry.tool.toLowerCase().replace(/\s+/g, '-')}`,
      });
      header.createEl('span', { text: entry.date, cls: 'cb-history-date' });

      const body = item.createDiv({ cls: 'cb-history-body' + (i > 2 ? ' cb-collapsed' : '') });
      body.createEl('p', { text: entry.summary, cls: 'cb-history-summary' });
      if (entry.todo && entry.todo !== '无') {
        body.createEl('p', { text: '未完成：' + entry.todo, cls: 'cb-history-todo' });
      }
      if (entry.decision && entry.decision !== '无') {
        body.createEl('p', { text: '决策：' + entry.decision, cls: 'cb-history-decision' });
      }

      // Toggle collapse for items > 3
      if (i > 2) {
        header.style.cursor = 'pointer';
        header.addEventListener('click', () => {
          body.toggleClass('cb-collapsed', !body.hasClass('cb-collapsed'));
        });
      }
    });
  }

  private async saveContext(ctx: ProjectContext) {
    const file = this.app.vault.getAbstractFileByPath(ctx.filePath) as TFile;
    if (!file) return;
    await this.app.vault.modify(file, serializeContextFile(ctx));
    this.currentContext = ctx;
  }

  private rerender(container: HTMLElement) {
    container.empty();
    this.renderHeader(container);
    this.renderProjectSelector(container);
    if (this.selectedProject && this.currentContext) {
      this.renderCurrentStatus(container);
      this.renderHistory(container);
    }
  }

  private formatDate(iso: string): string {
    if (!iso) return '';
    try {
      return iso.slice(0, 10);
    } catch {
      return iso;
    }
  }

  async refresh() {
    await this.render();
  }
}
