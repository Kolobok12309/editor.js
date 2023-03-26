import Module from '../__module';
import Block from '../block';
import SelectionUtils from '../selection';
import * as _ from '../utils';

/**
 *
 */
export default class CrossBlockSelection extends Module {
  /**
   * Block where selection is started
   */
  private firstSelectedBlock: Block;

  /**
   * Last selected Block
   */
  private lastSelectedBlock: Block;

  private ignoreMouseOver: boolean = false;

  private selection: SelectionUtils;

  /**
   * Module preparation
   *
   * @returns {Promise}
   */
  public async prepare(): Promise<void> {
    this.selection = new SelectionUtils();
    // @ts-ignore
    window.selectionUtils = this.selection;
    // return;
    this.listeners.on(document, 'mousedown', (event: MouseEvent) => {
      this.enableCrossBlockSelection(event);
    });
  }

  /**
   * Sets up listeners
   *
   * @param {MouseEvent} event - mouse down event
   */
  public watchSelection(event: MouseEvent): void {
    if (event.button !== _.mouseButtons.LEFT) {
      return;
    }

    const { BlockManager } = this.Editor;

    this.firstSelectedBlock = BlockManager.getBlock(event.target as HTMLElement);
    this.lastSelectedBlock = this.firstSelectedBlock;

    this.listeners.on(document, 'mouseover', this.onMouseOver);
    this.listeners.on(document, 'mouseup', this.onMouseUp);
  }

  /**
   * return boolean is cross block selection started
   */
  public get isCrossBlockSelectionStarted(): boolean {
    return !!this.firstSelectedBlock &&
      !!this.lastSelectedBlock;
  }

  /**
   * Change selection state of the next Block
   * Used for CBS via Shift + arrow keys
   *
   * @param {boolean} next - if true, toggle next block. Previous otherwise
   */
  public toggleBlockSelectedState(next = true): void {
    const { BlockManager, BlockSelection } = this.Editor;

    if (!this.lastSelectedBlock) {
      this.lastSelectedBlock = this.firstSelectedBlock = BlockManager.currentBlock;
    }

    if (this.firstSelectedBlock === this.lastSelectedBlock) {
      this.firstSelectedBlock.selected = true;

      BlockSelection.clearCache();
      SelectionUtils.get().removeAllRanges();
    }

    const nextBlockIndex = BlockManager.blocks.indexOf(this.lastSelectedBlock) + (next ? 1 : -1);
    const nextBlock = BlockManager.blocks[nextBlockIndex];

    if (!nextBlock) {
      return;
    }

    if (this.lastSelectedBlock.selected !== nextBlock.selected) {
      nextBlock.selected = true;

      BlockSelection.clearCache();
    } else {
      this.lastSelectedBlock.selected = false;

      BlockSelection.clearCache();
    }

    this.lastSelectedBlock = nextBlock;

    /** close InlineToolbar when Blocks selected */
    this.Editor.InlineToolbar.close();

    nextBlock.holder.scrollIntoView({
      block: 'nearest',
    });
  }

  /**
   * Clear saved state
   *
   * @param {Event} reason - event caused clear of selection
   */
  public clear(reason?: Event): void {
    console.log('crossBlockSelection clear', reason);
    const { BlockManager, BlockSelection, Caret, ReadOnly } = this.Editor;
    const fIndex = BlockManager.blocks.indexOf(this.firstSelectedBlock);
    const lIndex = BlockManager.blocks.indexOf(this.lastSelectedBlock);

    if (this.firstSelectedBlock && this.lastSelectedBlock) {
      for (let i = Math.min(fIndex, lIndex); i <= Math.max(fIndex, lIndex); i++) {
        const block = BlockManager.blocks[i];

        ReadOnly.toggleForBlock(block, false);
        block.selected = false;
        BlockSelection.clearCache();
      }
    }
    // if (BlockSelection.anyBlockSelected && fIndex > -1 && lIndex > -1) {
    //   if (reason && reason instanceof KeyboardEvent) {
    //     /**
    //      * Set caret depending on pressed key if pressed key is an arrow.
    //      */
    //     switch (reason.keyCode) {
    //       case _.keyCodes.DOWN:
    //       case _.keyCodes.RIGHT:
    //         Caret.setToBlock(BlockManager.blocks[Math.max(fIndex, lIndex)], Caret.positions.END);
    //         break;
    //
    //       case _.keyCodes.UP:
    //       case _.keyCodes.LEFT:
    //         Caret.setToBlock(BlockManager.blocks[Math.min(fIndex, lIndex)], Caret.positions.START);
    //         break;
    //       default:
    //         Caret.setToBlock(BlockManager.blocks[Math.max(fIndex, lIndex)], Caret.positions.END);
    //     }
    //   } else {
    //     /**
    //      * By default set caret at the end of the last selected block
    //      */
    //     Caret.setToBlock(BlockManager.blocks[Math.max(fIndex, lIndex)], Caret.positions.END);
    //   }
    // }

    this.firstSelectedBlock = this.lastSelectedBlock = null;
  }

  /**
   * Enables Cross Block Selection
   *
   * @param {MouseEvent} event - mouse down event
   */
  private enableCrossBlockSelection(event: MouseEvent): void {
    const { UI } = this.Editor;

    /**
     * Each mouse down on must disable selectAll state
     */
    if (!SelectionUtils.isCollapsed) {
      this.Editor.BlockSelection.clearSelection(event);
    }

    /**
     * If mouse down is performed inside the editor, we should watch CBS
     */
    if (UI.nodes.redactor.contains(event.target as Node)) {
      this.watchSelection(event);
    } else {
      /**
       * Otherwise, clear selection
       */
      this.Editor.BlockSelection.clearSelection(event);
    }
  }

  /**
   * Mouse up event handler.
   * Removes the listeners
   */
  private onMouseUp = (): void => {
    this.listeners.off(document, 'mouseover', this.onMouseOver);
    this.listeners.off(document, 'mouseup', this.onMouseUp);
  };

  /**
   * Mouse over event handler
   * Gets target and related blocks and change selected state for blocks in between
   *
   * @param {MouseEvent} event - mouse over event
   */
  private onMouseOver = async (event: MouseEvent): Promise<void> => {
    if (this.ignoreMouseOver) return;

    const { BlockManager, BlockSelection, ReadOnly } = this.Editor;

    const relatedBlock = BlockManager.getBlockByChildNode(event.relatedTarget as Node) || this.lastSelectedBlock;
    const targetBlock = BlockManager.getBlockByChildNode(event.target as Node);

    if (!relatedBlock || !targetBlock) {
      return;
    }

    if (targetBlock === relatedBlock) {
      // For blocks like nested-list with multiple contentEditable fields
      if ((event.relatedTarget as HTMLElement).contentEditable === 'true') {
        await ReadOnly.toggleForBlock(targetBlock, true);

        // BlockSelection.clearCache();
      }

      return;
    }

    if (relatedBlock === this.firstSelectedBlock) {
      // SelectionUtils.get().removeAllRanges();

      console.log('mouseOver on', targetBlock, relatedBlock);
      // this.ignoreMouseOver = true;
      // await ReadOnly.toggle(true);
      await Promise.all([
        ReadOnly.toggleForBlock(relatedBlock, true),
        ReadOnly.toggleForBlock(targetBlock, true),
      ]);


      // this.ignoreMouseOver = false;
      // relatedBlock.selected = true;
      // targetBlock.selected = true;

      // BlockSelection.clearCache();

      return;
    }

    if (targetBlock === this.firstSelectedBlock) {
      console.log('mouseOver off', targetBlock, relatedBlock);
      await Promise.all([
        ReadOnly.toggleForBlock(relatedBlock, false),
        ReadOnly.toggleForBlock(targetBlock, false),
      ]);
      // await ReadOnly.toggle(false);
      // relatedBlock.selected = false;
      // targetBlock.selected = false;

      // BlockSelection.clearCache();

      return;
    }

    this.Editor.InlineToolbar.close();

    this.toggleBlocksSelectedState(relatedBlock, targetBlock);
    this.lastSelectedBlock = targetBlock;
  };

  /**
   * Change blocks selection state between passed two blocks.
   *
   * @param {Block} firstBlock - first block in range
   * @param {Block} lastBlock - last block in range
   */
  private toggleBlocksSelectedState(firstBlock: Block, lastBlock: Block): void {
    const { BlockManager, BlockSelection } = this.Editor;
    const fIndex = BlockManager.blocks.indexOf(firstBlock);
    const lIndex = BlockManager.blocks.indexOf(lastBlock);

    // @ts-ignore
    window.BlockSelection = BlockSelection;
    // @ts-ignore
    window.BlockManager = BlockManager;

    /**
     * If first and last block have the different selection state
     * it means we should't toggle selection of the first selected block.
     * In the other case we shouldn't toggle the last selected block.
     */
    /**
     * Селект новых блоков
     */
    const shouldntSelectFirstBlock = firstBlock.readOnly !== lastBlock.readOnly;

    for (let i = Math.min(fIndex, lIndex); i <= Math.max(fIndex, lIndex); i++) {
      const block = BlockManager.blocks[i];

      if (
        block !== this.firstSelectedBlock &&
        block !== (shouldntSelectFirstBlock ? firstBlock : lastBlock)
      ) {
        console.log('block change readOnly', block);
        block.readOnly = !block.readOnly;
      }

      if (
        block !== this.firstSelectedBlock &&
        block !== (shouldntSelectFirstBlock ? lastBlock : firstBlock)
      ) {
        console.log('set selected', block, !block.selected, window.getSelection());
        block.selected = !block.selected;
        BlockSelection.clearCache();
      }
    }
  }
}
