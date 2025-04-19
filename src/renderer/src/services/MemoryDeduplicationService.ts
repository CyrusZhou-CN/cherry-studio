// 记忆去重与合并服务
import { fetchGenerate } from '@renderer/services/ApiService'
import store from '@renderer/store'
import {
  addMemory,
  addShortMemory,
  deleteMemory,
  deleteShortMemory,
  saveLongTermMemoryData,
  saveMemoryData
} from '@renderer/store/memory'

// 记忆去重与合并的结果接口
export interface DeduplicationResult {
  similarGroups: {
    groupId: string
    memoryIds: string[]
    mergedContent: string
    category?: string
    importance?: number // 新增重要性评分
    keywords?: string[] // 新增关键词
  }[]
  independentMemories: string[]
  rawResponse: string
}

/**
 * 分析记忆库中的相似记忆，提供智能合并建议
 * @param listId 可选的列表ID，如果不提供则处理所有列表
 * @param isShortMemory 是否处理短期记忆
 * @param topicId 当处理短期记忆时，可选的话题ID
 * @returns 去重分析结果
 */
export const deduplicateAndMergeMemories = async (
  listId?: string,
  isShortMemory: boolean = false,
  topicId?: string
): Promise<DeduplicationResult | null> => {
  // 获取需要处理的记忆
  const state = store.getState()

  let targetMemories: any[] = []

  if (isShortMemory) {
    // 处理短期记忆
    const shortMemories = state.memory?.shortMemories || []
    targetMemories = topicId ? shortMemories.filter((memory) => memory.topicId === topicId) : shortMemories
  } else {
    // 处理长期记忆
    const memories = state.memory?.memories || []
    targetMemories = listId ? memories.filter((memory) => memory.listId === listId) : memories
  }

  if (targetMemories.length < 2) {
    console.log('[Memory Deduplication] Not enough memories to deduplicate')
    return null
  }

  const memoryType = isShortMemory ? 'short memories' : 'memories'
  console.log(`[Memory Deduplication] Starting deduplication for ${targetMemories.length} ${memoryType}`)

  // 构建去重提示词
  const memoriesToCheck = targetMemories
    .map((memory, index) => {
      if (isShortMemory) {
        return `${index + 1}. 短期记忆: ${memory.content}`
      } else {
        return `${index + 1}. ${memory.category || '其他'}: ${memory.content}`
      }
    })
    .join('\n')

  const prompt = `
请仔细分析以下记忆项，识别语义相似或包含重复信息的条目，并提供智能合并建议。

相似度判断标准：
1. 语义相似：即使表述不同，但表达相同或非常相似的意思
2. 内容重叠：一个记忆项包含另一个记忆项的大部分信息
3. 主题相同：描述同一个主题或事件的不同方面

记忆项列表:
${memoriesToCheck}

例如，以下记忆应被视为相似：
- "用户喜欢简洁的界面设计"和"用户偏好简单直观的UI"
- "用户正在开发一个网站项目"和"用户在进行网站开发工作"
- "用户正在准备完成一个项目"和"用户正在进行一个项目的工作"

请按以下格式返回结果:
1. 识别出的相似组:
   - 组1: [记忆项编号，如"1,5,8"] - 合并建议: "合并后的内容" - 分类: "最合适的分类"
   - 组2: [记忆项编号] - 合并建议: "合并后的内容" - 分类: "最合适的分类"
   ...

2. 独立记忆项: [不需要合并的记忆项编号]

合并建议要求：
- 保留所有非重复的有价值信息
- 使用简洁清晰的语言
- 确保合并后的内容比原始记忆更加全面和准确
- 如果记忆项之间有细微差异，请在合并内容中保留这些差异

如果没有发现相似记忆，请返回"未发现相似记忆"。
`

  try {
    // 使用AI模型进行去重分析
    const analyzeModel = state.memory?.analyzeModel
    if (!analyzeModel) {
      console.log('[Memory Deduplication] No analyze model set')
      return null
    }

    console.log('[Memory Deduplication] Calling AI model for analysis...')
    const result = await fetchGenerate({
      prompt: prompt,
      content: memoriesToCheck,
      modelId: analyzeModel
    })

    if (!result) {
      console.log('[Memory Deduplication] No result from AI analysis')
      return null
    }

    console.log('[Memory Deduplication] Analysis result:', result)

    // 输出更详细的日志信息以便调试
    console.log('[Memory Deduplication] Attempting to parse result with format:', {
      hasGroupSection: result.includes('识别出的相似组'),
      hasIndependentSection: result.includes('独立记忆项'),
      containsGroupKeyword: result.includes('组'),
      resultLength: result.length
    })

    // 解析结果
    const similarGroups: DeduplicationResult['similarGroups'] = []
    const independentMemories: string[] = []

    // 检查是否没有发现相似记忆
    if (result.includes('未发现相似记忆')) {
      console.log('[Memory Deduplication] No similar memories found')
      return {
        similarGroups: [],
        independentMemories: targetMemories.map((_, index) => String(index + 1)),
        rawResponse: result
      }
    }

    // 解析相似组
    const similarGroupsMatch = result.match(/1\.\s*识别出的相似组:([\s\S]*?)(?=2\.\s*独立记忆项:|$)/i)
    if (similarGroupsMatch && similarGroupsMatch[1]) {
      const groupsText = similarGroupsMatch[1].trim()
      // 更新正则表达式以匹配新的格式，包括重要性和关键词
      // 输出原始文本以便调试
      console.log('[Memory Deduplication] Group text to parse:', groupsText)

      // 原始正则表达式
      const originalGroupRegex =
        /-\s*组(\d+)?:\s*\[([\d,\s]+)\]\s*-\s*合并建议:\s*"([^"]+)"\s*-\s*分类:\s*"([^"]+)"\s*(?:-\s*重要性:\s*"([^"]+)")?\s*(?:-\s*关键词:\s*"([^"]+)")?/g

      // 新增正则表达式，匹配AI返回的不同格式
      const alternativeGroupRegex =
        /-\s*组(\d+)?:\s*(?:\*\*)?["[]?([\d,\s]+)["]?(?:\*\*)?\s*-\s*合并建议:\s*(?:\*\*)?["']?([^"'\n-]+)["']?(?:\*\*)?\s*-\s*分类:\s*(?:\*\*)?["']?([^"'\n-]+)["']?(?:\*\*)?/g

      // 简化的正则表达式，直接匹配组号和方括号内的数字
      const simpleGroupRegex =
        /-\s*组(\d+)?:\s*\[([\d,\s]+)\]\s*-\s*合并建议:\s*(.+?)\s*-\s*分类:\s*(.+?)(?=\s*$|\s*-\s*组|\s*\n)/gm

      // 尝试所有正则表达式
      const regexesToTry = [simpleGroupRegex, alternativeGroupRegex, originalGroupRegex]

      // 逐个尝试正则表达式
      for (const regex of regexesToTry) {
        let match: RegExpExecArray | null
        let found = false

        // 重置正则表达式的lastIndex
        regex.lastIndex = 0

        while ((match = regex.exec(groupsText)) !== null) {
          found = true
          const groupId = match[1] || String(similarGroups.length + 1)
          // 清理引号和方括号
          const memoryIndicesStr = match[2].replace(/["'[\]]/g, '')
          const memoryIndices = memoryIndicesStr.split(',').map((s: string) => s.trim())
          const mergedContent = match[3].trim().replace(/^["']|["']$/g, '') // 移除首尾的引号
          const category = match[4]?.trim().replace(/^["']|["']$/g, '') // 移除首尾的引号

          console.log(`[Memory Deduplication] Found group with regex ${regex.toString().substring(0, 30)}...`, {
            groupId,
            memoryIndices,
            mergedContent,
            category
          })

          similarGroups.push({
            groupId,
            memoryIds: memoryIndices,
            mergedContent,
            category: category || '其他'
          })
        }

        // 如果找到了匹配项，就不再尝试其他正则表达式
        if (found) break
      }

      // 旧的解析代码已被上面的新代码替代
    }

    // 解析独立记忆项
    console.log('[Memory Deduplication] Attempting to parse independent memories')

    // 尝试多种正则表达式匹配独立记忆项
    const independentRegexes = [
      /2\.\s*独立记忆项:\s*(?:\*\*)?\s*\[?([\d,\s"]+)\]?(?:\*\*)?/i,
      /2\.\s*独立记忆项\s*:\s*([\d,\s]+)/i,
      /独立记忆项\s*:\s*([\d,\s]+)/i
    ]

    let independentFound = false

    for (const regex of independentRegexes) {
      const independentMatch = result.match(regex)
      if (independentMatch && independentMatch[1]) {
        // 处理可能包含引号的情况
        const cleanedIndependentStr = independentMatch[1].replace(/["'[\]]/g, '')
        const items = cleanedIndependentStr.split(',').map((s: string) => s.trim())

        console.log(
          `[Memory Deduplication] Found independent memories with regex ${regex.toString().substring(0, 30)}...`,
          items
        )

        independentMemories.push(...items)
        independentFound = true
        break
      }
    }

    // 如果没有找到独立记忆项，尝试直接从结果中提取数字
    if (!independentFound) {
      // 尝试直接提取数字
      const numberMatches = result.match(/\b(\d+)\b/g)
      if (numberMatches) {
        // 过滤出不在相似组中的数字
        const usedIndices = new Set()
        similarGroups.forEach((group) => {
          group.memoryIds.forEach((id) => usedIndices.add(id))
        })

        const unusedIndices = numberMatches.filter((num) => !usedIndices.has(num))
        if (unusedIndices.length > 0) {
          console.log('[Memory Deduplication] Extracted independent memories from numbers in result:', unusedIndices)
          independentMemories.push(...unusedIndices)
        }
      }
    }

    // 如果没有解析到相似组和独立记忆项，但结果中包含“组”字样，尝试使用更宽松的正则表达式
    if (similarGroups.length === 0 && independentMemories.length === 0 && result.includes('组')) {
      // 尝试使用更宽松的正则表达式提取组信息
      const looseGroupRegex =
        /-\s*组\s*(\d+)?\s*:\s*["[]?\s*([\d,\s"]+)\s*["]?\s*-\s*合并建议\s*:\s*["']?([^"'\n-]+)["']?/g

      let looseMatch: RegExpExecArray | null
      while ((looseMatch = looseGroupRegex.exec(result)) !== null) {
        const groupId = looseMatch[1] || String(similarGroups.length + 1)
        // 清理引号和方括号
        const memoryIndicesStr = looseMatch[2].replace(/["'[\]]/g, '')
        const memoryIndices = memoryIndicesStr.split(',').map((s: string) => s.trim())
        const mergedContent = looseMatch[3].trim()

        similarGroups.push({
          groupId,
          memoryIds: memoryIndices,
          mergedContent,
          category: '其他' // 默认类别
        })
      }
    }

    // 如果仍然没有解析到任何内容，尝试直接从原始结果中提取信息
    if (similarGroups.length === 0 && independentMemories.length === 0) {
      console.log('[Memory Deduplication] No groups or independent memories found, attempting direct extraction')

      // 尝试提取所有数字作为独立记忆项
      const allNumbers = result.match(/\b(\d+)\b/g)
      if (allNumbers && allNumbers.length > 0) {
        console.log('[Memory Deduplication] Extracted all numbers as independent memories:', allNumbers)
        independentMemories.push(...allNumbers)
      }
    }

    console.log('[Memory Deduplication] Parsed result:', { similarGroups, independentMemories })

    return {
      similarGroups,
      independentMemories,
      rawResponse: result
    }
  } catch (error) {
    console.error('[Memory Deduplication] Error during deduplication:', error)
    return null
  }
}

// 已在顶部导入saveMemoryData和saveLongTermMemoryData

/**
 * 应用去重结果，合并相似记忆
 * @param result 去重分析结果
 * @param autoApply 是否自动应用合并结果
 * @param isShortMemory 是否处理短期记忆
 */
export const applyDeduplicationResult = async (
  result: DeduplicationResult,
  autoApply: boolean = false,
  isShortMemory: boolean = false
) => {
  if (!result || !result.similarGroups || result.similarGroups.length === 0) {
    console.log('[Memory Deduplication] No similar groups to apply')
    return
  }

  const state = store.getState()
  const memories = isShortMemory ? state.memory?.shortMemories || [] : state.memory?.memories || []

  // 处理每个相似组
  for (const group of result.similarGroups) {
    // 获取组中的记忆
    const memoryIndices = group.memoryIds.map((id) => parseInt(id) - 1)
    const groupMemories = memoryIndices.map((index) => memories[index]).filter(Boolean)

    if (groupMemories.length < 2) continue

    // 获取第一个记忆的列表ID和其他属性
    const firstMemory = groupMemories[0]

    // 收集所有已分析过的消息ID
    const allAnalyzedMessageIds = new Set<string>()
    groupMemories.forEach((memory) => {
      if (memory.analyzedMessageIds) {
        memory.analyzedMessageIds.forEach((id) => allAnalyzedMessageIds.add(id))
      }
    })

    // 找出最新的lastMessageId
    let lastMessageId: string | undefined
    groupMemories.forEach((memory) => {
      if (memory.lastMessageId) {
        if (!lastMessageId || new Date(memory.createdAt) > new Date(lastMessageId)) {
          lastMessageId = memory.lastMessageId
        }
      }
    })

    // 找出所有关联的话题ID
    const topicIds = new Set<string>()
    groupMemories.forEach((memory) => {
      if (memory.topicId) {
        topicIds.add(memory.topicId)
      }
    })

    // 如果自动应用，则添加合并后的记忆并删除原记忆
    if (autoApply) {
      if (isShortMemory) {
        // 处理短期记忆
        // 添加合并后的短期记忆
        const topicId = topicIds.size === 1 ? Array.from(topicIds)[0] : undefined
        if (topicId) {
          store.dispatch(
            addShortMemory({
              content: group.mergedContent,
              topicId: topicId,
              analyzedMessageIds: Array.from(allAnalyzedMessageIds),
              lastMessageId: lastMessageId,
              importance: group.importance, // 添加重要性评分
              keywords: group.keywords // 添加关键词
            })
          )

          // 删除原短期记忆
          for (const memory of groupMemories) {
            store.dispatch(deleteShortMemory(memory.id))
          }
        }
      } else {
        // 处理长期记忆
        // 安全地获取 listId 和 category，因为它们只存在于 Memory 类型
        const listId = 'listId' in firstMemory ? firstMemory.listId : undefined
        const memoryCategory = 'category' in firstMemory ? firstMemory.category : undefined

        // 添加合并后的记忆
        store.dispatch(
          addMemory({
            content: group.mergedContent,
            source: '自动合并',
            category: group.category || memoryCategory || '其他', // 使用安全获取的 category
            listId: listId, // 使用安全获取的 listId
            analyzedMessageIds: Array.from(allAnalyzedMessageIds),
            lastMessageId: lastMessageId,
            topicId: topicIds.size === 1 ? Array.from(topicIds)[0] : undefined,
            importance: group.importance, // 添加重要性评分
            keywords: group.keywords // 添加关键词
          })
        )

        // 删除原记忆
        for (const memory of groupMemories) {
          store.dispatch(deleteMemory(memory.id))
        }
      }

      console.log(`[Memory Deduplication] Applied group ${group.groupId}: merged ${groupMemories.length} memories`)
    }
  }

  // 合并完成后，将更改保存到文件
  if (autoApply) {
    try {
      // 获取最新的状态
      const currentState = store.getState().memory

      // 保存到文件
      if (isShortMemory) {
        // 短期记忆使用saveMemoryData
        await store
          .dispatch(
            saveMemoryData({
              shortMemories: currentState.shortMemories
            })
          )
          .unwrap()
        console.log('[Memory Deduplication] Short memories saved to file after merging')
      } else {
        // 长期记忆使用saveLongTermMemoryData
        await store
          .dispatch(
            saveLongTermMemoryData({
              memories: currentState.memories,
              memoryLists: currentState.memoryLists,
              currentListId: currentState.currentListId,
              analyzeModel: currentState.analyzeModel
            })
          )
          .unwrap()
        console.log('[Memory Deduplication] Long-term memories saved to file after merging')
      }
    } catch (error) {
      console.error('[Memory Deduplication] Failed to save memory data after merging:', error)
    }
  }
}
