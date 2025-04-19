import { Extension } from '@codemirror/state'
import { search, openSearchPanel } from '@codemirror/search'
import { EditorView } from '@codemirror/view'

// 创建中文搜索面板
export function createChineseSearchPanel(): Extension {
  return search({
    top: true
  })
}

// 打开中文搜索面板
export function openChineseSearchPanel(view: EditorView) {
  openSearchPanel(view)
}
