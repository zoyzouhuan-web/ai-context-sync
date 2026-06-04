import { Plugin, WorkspaceLeaf } from 'obsidian';
import { ContextBridgeView, VIEW_TYPE } from './view';

export default class ContextBridgePlugin extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, (leaf) => new ContextBridgeView(leaf, this));

    this.addRibbonIcon('brain-circuit', 'ContextBridge', () => {
      this.activateView();
    });

    this.addCommand({
      id: 'open-context-bridge',
      name: '打开 ContextBridge 面板',
      callback: () => this.activateView(),
    });

    // Watch for file changes in ContextBridge dir and refresh view
    this.registerEvent(
      this.app.vault.on('modify', (file) => {
        if (file.path.startsWith('ContextBridge/')) {
          this.refreshView();
        }
      })
    );

    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (file.path.startsWith('ContextBridge/')) {
          this.refreshView();
        }
      })
    );
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async activateView() {
    const { workspace } = this.app;
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }

    if (leaf) workspace.revealLeaf(leaf);
  }

  private refreshView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    leaves.forEach(leaf => {
      if (leaf.view instanceof ContextBridgeView) {
        leaf.view.refresh();
      }
    });
  }
}
