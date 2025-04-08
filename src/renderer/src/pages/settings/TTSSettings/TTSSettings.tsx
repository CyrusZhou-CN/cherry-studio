import { PlusOutlined, ReloadOutlined, SoundOutlined } from '@ant-design/icons'
import { useTheme } from '@renderer/context/ThemeProvider'
import store, { useAppDispatch } from '@renderer/store'
import {
  addTtsCustomModel,
  addTtsCustomVoice,
  removeTtsCustomModel,
  removeTtsCustomVoice,
  resetTtsCustomValues,
  setTtsApiKey,
  setTtsApiUrl,
  setTtsEdgeVoice,
  setTtsEnabled,
  setTtsFilterOptions,
  setTtsModel,
  setTtsServiceType,
  setTtsVoice
} from '@renderer/store/settings'
import { Button, Form, Input, Select, Space, Switch, Tag, message } from 'antd'
import { FC, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import styled from 'styled-components'

import { SettingContainer, SettingDivider, SettingGroup, SettingHelpText, SettingRow, SettingRowTitle, SettingTitle } from '..'
import TTSService from '@renderer/services/TTSService'

const CustomVoiceInput = styled.div`
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  margin-bottom: 16px;
`

const EmptyText = styled.div`
  color: rgba(0, 0, 0, 0.45);
  padding: 4px 0;
`

const InputGroup = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
`

const FlexContainer = styled.div`
  display: flex;
  gap: 8px;
`

const FilterOptionItem = styled.div`
  margin-bottom: 16px;
`

const LengthLabel = styled.span`
  margin-right: 8px;
`

const LoadingText = styled.div`
  margin-top: 8px;
  color: #999;
`

const VoiceSelectContainer = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
`

const TTSSettings: FC = () => {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const dispatch = useAppDispatch()

  // 从Redux获取TTS设置
  const ttsEnabled = useSelector((state: any) => state.settings.ttsEnabled)
  const ttsServiceType = useSelector((state: any) => state.settings.ttsServiceType || 'openai')
  const ttsApiKey = useSelector((state: any) => state.settings.ttsApiKey)
  const ttsApiUrl = useSelector((state: any) => state.settings.ttsApiUrl)
  const ttsVoice = useSelector((state: any) => state.settings.ttsVoice)
  const ttsModel = useSelector((state: any) => state.settings.ttsModel)
  const ttsEdgeVoice = useSelector((state: any) => state.settings.ttsEdgeVoice || 'zh-CN-XiaoxiaoNeural')
  const ttsCustomVoices = useSelector((state: any) => state.settings.ttsCustomVoices || [])
  const ttsCustomModels = useSelector((state: any) => state.settings.ttsCustomModels || [])
  const ttsFilterOptions = useSelector((state: any) => state.settings.ttsFilterOptions || {
    filterThinkingProcess: true,
    filterMarkdown: true,
    filterCodeBlocks: true,
    filterHtmlTags: true,
    maxTextLength: 4000
  })

  // 新增自定义音色和模型的状态
  const [newVoice, setNewVoice] = useState('')
  const [newModel, setNewModel] = useState('')

  // 浏览器可用的语音列表
  const [availableVoices, setAvailableVoices] = useState<{ label: string; value: string }[]>([])

  // 预定义的Edge TTS音色列表
  const predefinedVoices = [
    { label: '小晓 (女声, 中文)', value: 'zh-CN-XiaoxiaoNeural' },
    { label: '云扬 (男声, 中文)', value: 'zh-CN-YunyangNeural' },
    { label: '晓晓 (女声, 中文)', value: 'zh-CN-XiaoxiaoNeural' },
    { label: '晓涵 (女声, 中文)', value: 'zh-CN-XiaohanNeural' },
    { label: '晓诗 (女声, 中文)', value: 'zh-CN-XiaoshuangNeural' },
    { label: '晓瑞 (女声, 中文)', value: 'zh-CN-XiaoruiNeural' },
    { label: '晓墨 (女声, 中文)', value: 'zh-CN-XiaomoNeural' },
    { label: '晓然 (男声, 中文)', value: 'zh-CN-XiaoranNeural' },
    { label: '晓坤 (男声, 中文)', value: 'zh-CN-XiaokunNeural' },
    { label: 'Aria (Female, English)', value: 'en-US-AriaNeural' },
    { label: 'Guy (Male, English)', value: 'en-US-GuyNeural' },
    { label: 'Jenny (Female, English)', value: 'en-US-JennyNeural' },
    { label: 'Ana (Female, Spanish)', value: 'es-ES-ElviraNeural' },
    { label: 'Ichiro (Male, Japanese)', value: 'ja-JP-KeitaNeural' },
    { label: 'Nanami (Female, Japanese)', value: 'ja-JP-NanamiNeural' },
    // 添加更多常用的语音
    { label: 'Microsoft David (en-US)', value: 'Microsoft David Desktop - English (United States)' },
    { label: 'Microsoft Zira (en-US)', value: 'Microsoft Zira Desktop - English (United States)' },
    { label: 'Microsoft Mark (en-US)', value: 'Microsoft Mark Online (Natural) - English (United States)' },
    { label: 'Microsoft Aria (en-US)', value: 'Microsoft Aria Online (Natural) - English (United States)' },
    { label: 'Google US English', value: 'Google US English' },
    { label: 'Google UK English Female', value: 'Google UK English Female' },
    { label: 'Google UK English Male', value: 'Google UK English Male' },
    { label: 'Google 日本語', value: 'Google 日本語' },
    { label: 'Google 普通话（中国大陆）', value: 'Google 普通话（中国大陆）' },
    { label: 'Google 粤語（香港）', value: 'Google 粤語（香港）' }
  ]

  // 获取浏览器可用的语音列表
  const getVoices = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // 先触发一下语音合成引擎，确保它已经初始化
      window.speechSynthesis.cancel()

      // 获取浏览器可用的语音列表
      const voices = window.speechSynthesis.getVoices()
      console.log('获取到的语音列表:', voices)
      console.log('语音列表长度:', voices.length)

      // 转换浏览器语音列表为选项格式
      const browserVoices = voices.map(voice => ({
        label: `${voice.name} (${voice.lang})${voice.default ? ' - 默认' : ''}`,
        value: voice.name,
        lang: voice.lang,
        isNative: true // 标记为浏览器原生语音
      }))

      // 添加语言信息到预定义语音
      const enhancedPredefinedVoices = predefinedVoices.map(voice => ({
        ...voice,
        lang: voice.value.split('-').slice(0, 2).join('-'),
        isNative: false // 标记为非浏览器原生语音
      }))

      // 合并所有语音列表
      let allVoices = [...browserVoices]

      // 如果浏览器语音少于5个，添加预定义语音
      if (browserVoices.length < 5) {
        allVoices = [...browserVoices, ...enhancedPredefinedVoices]
      }

      // 去除重复项，优先保留浏览器原生语音
      const uniqueVoices = allVoices.filter((voice, index, self) => {
        const firstIndex = self.findIndex(v => v.value === voice.value)
        // 如果是原生语音或者是第一次出现，则保留
        return voice.isNative || firstIndex === index
      })

      // 按语言分组并排序
      const groupedVoices = uniqueVoices.sort((a, b) => {
        // 先按语言排序
        if (a.lang !== b.lang) {
          return a.lang.localeCompare(b.lang)
        }
        // 同语言下，原生语音优先
        if (a.isNative !== b.isNative) {
          return a.isNative ? -1 : 1
        }
        // 最后按名称排序
        return a.label.localeCompare(b.label)
      })

      setAvailableVoices(groupedVoices)
      console.log('设置可用语音列表:', groupedVoices)
    } else {
      // 如果浏览器不支持Web Speech API，使用预定义的语音列表
      console.log('浏览器不支持Web Speech API，使用预定义的语音列表')
      setAvailableVoices(predefinedVoices)
    }
  }

  // 刷新语音列表
  const refreshVoices = () => {
    console.log('手动刷新语音列表')
    message.loading({ content: t('settings.tts.edge_voice.refreshing', { defaultValue: '正在刷新语音列表...' }), key: 'refresh-voices' })

    // 先清空当前列表
    setAvailableVoices([])

    // 强制重新加载语音列表
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()

      // 尝试多次获取语音列表
      setTimeout(() => {
        getVoices()
        setTimeout(() => {
          getVoices()
          message.success({ content: t('settings.tts.edge_voice.refreshed', { defaultValue: '语音列表已刷新' }), key: 'refresh-voices' })
        }, 1000)
      }, 500)
    } else {
      // 如果浏览器不支持Web Speech API，使用预定义的语音列表
      setAvailableVoices(predefinedVoices)
      message.success({ content: t('settings.tts.edge_voice.refreshed', { defaultValue: '语音列表已刷新' }), key: 'refresh-voices' })
    }
  }

  useEffect(() => {
    // 初始化语音合成引擎
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // 触发语音合成引擎初始化
      window.speechSynthesis.cancel()

      // 设置voiceschanged事件处理程序
      const voicesChangedHandler = () => {
        console.log('检测到voiceschanged事件，重新获取语音列表')
        getVoices()
      }

      // 添加事件监听器
      window.speechSynthesis.onvoiceschanged = voicesChangedHandler

      // 立即获取可用的语音
      getVoices()

      // 创建多个定时器，在不同时间点尝试获取语音列表
      // 这是因为不同浏览器加载语音列表的时间不同
      const timers = [
        setTimeout(() => getVoices(), 500),
        setTimeout(() => getVoices(), 1000),
        setTimeout(() => getVoices(), 2000)
      ]

      return () => {
        // 清理事件监听器和定时器
        window.speechSynthesis.onvoiceschanged = null
        timers.forEach(timer => clearTimeout(timer))
      }
    } else {
      // 如果浏览器不支持Web Speech API，使用预定义的语音列表
      setAvailableVoices(predefinedVoices)
      return () => {}
    }
  }, [])

  // 测试TTS功能
  const testTTS = async () => {
    if (!ttsEnabled) {
      window.message.error({ content: t('settings.tts.error.not_enabled'), key: 'tts-test' })
      return
    }

    // 获取最新的服务类型设置
    const latestSettings = store.getState().settings
    const currentServiceType = latestSettings.ttsServiceType || 'openai'
    console.log('测试TTS时使用的服务类型:', currentServiceType)
    console.log('测试时完整TTS设置:', {
      ttsEnabled: latestSettings.ttsEnabled,
      ttsServiceType: latestSettings.ttsServiceType,
      ttsApiKey: latestSettings.ttsApiKey ? '已设置' : '未设置',
      ttsVoice: latestSettings.ttsVoice,
      ttsModel: latestSettings.ttsModel,
      ttsEdgeVoice: latestSettings.ttsEdgeVoice
    })

    // 根据服务类型检查必要的参数
    if (currentServiceType === 'openai') {
      if (!ttsApiKey) {
        window.message.error({ content: t('settings.tts.error.no_api_key'), key: 'tts-test' })
        return
      }

      if (!ttsVoice) {
        window.message.error({ content: t('settings.tts.error.no_voice'), key: 'tts-test' })
        return
      }

      if (!ttsModel) {
        window.message.error({ content: t('settings.tts.error.no_model'), key: 'tts-test' })
        return
      }
    } else if (currentServiceType === 'edge') {
      if (!ttsEdgeVoice) {
        window.message.error({ content: t('settings.tts.error.no_edge_voice'), key: 'tts-test' })
        return
      }
    }

    await TTSService.speak('这是一段测试语音，用于测试TTS功能是否正常工作。')
  }

  // 添加自定义音色
  const handleAddVoice = () => {
    if (!newVoice) {
      window.message.error({ content: '请输入音色', key: 'add-voice' })
      return
    }

    // 确保添加的是字符串
    const voiceStr = typeof newVoice === 'string' ? newVoice : String(newVoice);
    dispatch(addTtsCustomVoice(voiceStr))
    setNewVoice('')
  }

  // 添加自定义模型
  const handleAddModel = () => {
    if (!newModel) {
      window.message.error({ content: '请输入模型', key: 'add-model' })
      return
    }

    // 确保添加的是字符串
    const modelStr = typeof newModel === 'string' ? newModel : String(newModel);
    dispatch(addTtsCustomModel(modelStr))
    setNewModel('')
  }

  // 删除自定义音色
  const handleRemoveVoice = (voice: string) => {
    // 确保删除的是字符串
    const voiceStr = typeof voice === 'string' ? voice : String(voice);
    dispatch(removeTtsCustomVoice(voiceStr))
  }

  // 删除自定义模型
  const handleRemoveModel = (model: string) => {
    // 确保删除的是字符串
    const modelStr = typeof model === 'string' ? model : String(model);
    dispatch(removeTtsCustomModel(modelStr))
  }

  return (
    <SettingContainer theme={theme}>
      <SettingTitle>
        <Space>
          <SoundOutlined />
          {t('settings.tts.title')}
        </Space>
      </SettingTitle>

      <SettingDivider />

      <SettingGroup>
        <SettingRow>
          <SettingRowTitle>{t('settings.tts.enable')}</SettingRowTitle>
          <Switch checked={ttsEnabled} onChange={(checked) => dispatch(setTtsEnabled(checked))} />
        </SettingRow>
        <SettingHelpText>{t('settings.tts.enable.help')}</SettingHelpText>
      </SettingGroup>

      {/* 重置按钮 */}
      <SettingGroup>
        <SettingRow>
          <SettingRowTitle>{t('settings.tts.reset_title')}</SettingRowTitle>
          <Button
            danger
            onClick={() => {
              if (window.confirm(t('settings.tts.reset_confirm'))) {
                dispatch(resetTtsCustomValues());
                window.message.success({ content: t('settings.tts.reset_success'), key: 'reset-tts' });
              }
            }}
          >
            {t('settings.tts.reset')}
          </Button>
        </SettingRow>
        <SettingHelpText>{t('settings.tts.reset_help')}</SettingHelpText>
      </SettingGroup>

      <SettingDivider />

      <SettingGroup>
        <SettingRowTitle>{t('settings.tts.api_settings')}</SettingRowTitle>
        <Form layout="vertical" style={{ width: '100%' }}>
          {/* TTS服务类型选择 */}
          <Form.Item label={t('settings.tts.service_type')} style={{ marginBottom: 16 }}>
            <FlexContainer>
              <Select
                value={ttsServiceType}
                onChange={(value: string) => {
                  console.log('切换TTS服务类型为:', value)
                  // 先将新的服务类型写入Redux状态
                  dispatch(setTtsServiceType(value))

                  // 等待一下，确保状态已更新
                  setTimeout(() => {
                    // 验证状态是否正确更新
                    const currentType = store.getState().settings.ttsServiceType
                    console.log('更新后的TTS服务类型:', currentType)

                    // 如果状态没有正确更新，再次尝试
                    if (currentType !== value) {
                      console.log('状态未正确更新，再次尝试')
                      dispatch(setTtsServiceType(value))
                    }
                  }, 100)
                }}
                options={[
                  { label: t('settings.tts.service_type.openai'), value: 'openai' },
                  { label: t('settings.tts.service_type.edge'), value: 'edge' }
                ]}
                disabled={!ttsEnabled}
                style={{ flex: 1 }}
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  // 强制刷新当前服务类型设置
                  const currentType = store.getState().settings.ttsServiceType
                  console.log('强制刷新TTS服务类型:', currentType)
                  dispatch(setTtsServiceType(currentType))
                  window.message.success({ content: t('settings.tts.service_type.refreshed', { defaultValue: '已刷新TTS服务类型设置' }), key: 'tts-refresh' })
                }}
                disabled={!ttsEnabled}
                title={t('settings.tts.service_type.refresh', { defaultValue: '刷新TTS服务类型设置' })}
              />
            </FlexContainer>
          </Form.Item>

          {/* OpenAI TTS设置 */}
          {ttsServiceType === 'openai' && (
            <>
              <Form.Item label={t('settings.tts.api_key')} style={{ marginBottom: 16 }}>
                <Input.Password
                  value={ttsApiKey}
                  onChange={(e) => dispatch(setTtsApiKey(e.target.value))}
                  placeholder={t('settings.tts.api_key.placeholder')}
                  disabled={!ttsEnabled}
                />
              </Form.Item>
              <Form.Item label={t('settings.tts.api_url')} style={{ marginBottom: 16 }}>
                <Input
                  value={ttsApiUrl}
                  onChange={(e) => dispatch(setTtsApiUrl(e.target.value))}
                  placeholder={t('settings.tts.api_url.placeholder')}
                  disabled={!ttsEnabled}
                />
              </Form.Item>
            </>
          )}

          {/* Edge TTS设置 */}
          {ttsServiceType === 'edge' && (
            <Form.Item label={t('settings.tts.edge_voice')} style={{ marginBottom: 16 }}>
              <VoiceSelectContainer>
                <Select
                  value={ttsEdgeVoice}
                  onChange={(value) => dispatch(setTtsEdgeVoice(value))}
                  options={availableVoices.length > 0 ? availableVoices : [
                    { label: t('settings.tts.edge_voice.loading'), value: '' }
                  ]}
                  disabled={!ttsEnabled}
                  style={{ flex: 1 }}
                  showSearch
                  optionFilterProp="label"
                  placeholder={availableVoices.length === 0 ? t('settings.tts.edge_voice.loading') : t('settings.tts.voice.placeholder')}
                  notFoundContent={availableVoices.length === 0 ? t('settings.tts.edge_voice.loading') : t('settings.tts.edge_voice.not_found')}
                />
                <Button
                  icon={<ReloadOutlined />}
                  onClick={refreshVoices}
                  disabled={!ttsEnabled}
                  title={t('settings.tts.edge_voice.refresh')}
                />
              </VoiceSelectContainer>
              {availableVoices.length === 0 && (
                <LoadingText>
                  {t('settings.tts.edge_voice.loading')}
                </LoadingText>
              )}
            </Form.Item>
          )}

          {/* OpenAI TTS的音色和模型设置 */}
          {ttsServiceType === 'openai' && (
            <>
              {/* 音色选择 */}
              <Form.Item label={t('settings.tts.voice')} style={{ marginBottom: 8 }}>
                <Select
                  value={ttsVoice}
                  onChange={(value) => dispatch(setTtsVoice(value))}
                  options={ttsCustomVoices.map((voice: any) => {
                    // 确保voice是字符串
                    const voiceStr = typeof voice === 'string' ? voice : String(voice);
                    return { label: voiceStr, value: voiceStr };
                  })}
                  disabled={!ttsEnabled}
                  style={{ width: '100%' }}
                  placeholder={t('settings.tts.voice.placeholder')}
                  showSearch
                  optionFilterProp="label"
                  allowClear
                />
              </Form.Item>

              {/* 自定义音色列表 */}
              <TagsContainer>
                {ttsCustomVoices && ttsCustomVoices.length > 0 ? (
                  ttsCustomVoices.map((voice: any, index: number) => {
                    // 确保voice是字符串
                    const voiceStr = typeof voice === 'string' ? voice : String(voice);
                    return (
                      <Tag
                        key={`${voiceStr}-${index}`}
                        closable
                        onClose={() => handleRemoveVoice(voiceStr)}
                        style={{ padding: '4px 8px' }}
                      >
                        {voiceStr}
                      </Tag>
                    );
                  })
                ) : (
                  <EmptyText>
                    {t('settings.tts.voice_empty')}
                  </EmptyText>
                )}
              </TagsContainer>

              {/* 添加自定义音色 */}
              <CustomVoiceInput>
                <InputGroup>
                  <Input
                    placeholder={t('settings.tts.voice_input_placeholder')}
                    value={newVoice}
                    onChange={(e) => setNewVoice(e.target.value)}
                    disabled={!ttsEnabled}
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAddVoice}
                    disabled={!ttsEnabled || !newVoice}
                  >
                    {t('settings.tts.voice_add')}
                  </Button>
                </InputGroup>
              </CustomVoiceInput>

              {/* 模型选择 */}
              <Form.Item label={t('settings.tts.model')} style={{ marginBottom: 8, marginTop: 16 }}>
                <Select
                  value={ttsModel}
                  onChange={(value) => dispatch(setTtsModel(value))}
                  options={ttsCustomModels.map((model: any) => {
                    // 确保model是字符串
                    const modelStr = typeof model === 'string' ? model : String(model);
                    return { label: modelStr, value: modelStr };
                  })}
                  disabled={!ttsEnabled}
                  style={{ width: '100%' }}
                  placeholder={t('settings.tts.model.placeholder')}
                  showSearch
                  optionFilterProp="label"
                  allowClear
                />
              </Form.Item>

              {/* 自定义模型列表 */}
              <TagsContainer>
                {ttsCustomModels && ttsCustomModels.length > 0 ? (
                  ttsCustomModels.map((model: any, index: number) => {
                    // 确保model是字符串
                    const modelStr = typeof model === 'string' ? model : String(model);
                    return (
                      <Tag
                        key={`${modelStr}-${index}`}
                        closable
                        onClose={() => handleRemoveModel(modelStr)}
                        style={{ padding: '4px 8px' }}
                      >
                        {modelStr}
                      </Tag>
                    );
                  })
                ) : (
                  <EmptyText>
                    {t('settings.tts.model_empty')}
                  </EmptyText>
                )}
              </TagsContainer>

              {/* 添加自定义模型 */}
              <CustomVoiceInput>
                <InputGroup>
                  <Input
                    placeholder={t('settings.tts.model_input_placeholder')}
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    disabled={!ttsEnabled}
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAddModel}
                    disabled={!ttsEnabled || !newModel}
                  >
                    {t('settings.tts.model_add')}
                  </Button>
                </InputGroup>
              </CustomVoiceInput>
            </>
          )}

          {/* TTS过滤选项 */}
          <Form.Item label={t('settings.tts.filter_options')} style={{ marginTop: 24, marginBottom: 8 }}>
            <FilterOptionItem>
              <Switch
                checked={ttsFilterOptions.filterThinkingProcess}
                onChange={(checked) => dispatch(setTtsFilterOptions({ filterThinkingProcess: checked }))}
                disabled={!ttsEnabled}
              /> {t('settings.tts.filter.thinking_process')}
            </FilterOptionItem>
            <FilterOptionItem>
              <Switch
                checked={ttsFilterOptions.filterMarkdown}
                onChange={(checked) => dispatch(setTtsFilterOptions({ filterMarkdown: checked }))}
                disabled={!ttsEnabled}
              /> {t('settings.tts.filter.markdown')}
            </FilterOptionItem>
            <FilterOptionItem>
              <Switch
                checked={ttsFilterOptions.filterCodeBlocks}
                onChange={(checked) => dispatch(setTtsFilterOptions({ filterCodeBlocks: checked }))}
                disabled={!ttsEnabled}
              /> {t('settings.tts.filter.code_blocks')}
            </FilterOptionItem>
            <FilterOptionItem>
              <Switch
                checked={ttsFilterOptions.filterHtmlTags}
                onChange={(checked) => dispatch(setTtsFilterOptions({ filterHtmlTags: checked }))}
                disabled={!ttsEnabled}
              /> {t('settings.tts.filter.html_tags')}
            </FilterOptionItem>
            <FilterOptionItem>
              <LengthLabel>{t('settings.tts.max_text_length')}:</LengthLabel>
              <Select
                value={ttsFilterOptions.maxTextLength}
                onChange={(value) => dispatch(setTtsFilterOptions({ maxTextLength: value }))}
                disabled={!ttsEnabled}
                style={{ width: 120 }}
                options={[
                  { label: '1000', value: 1000 },
                  { label: '2000', value: 2000 },
                  { label: '4000', value: 4000 },
                  { label: '8000', value: 8000 },
                  { label: '16000', value: 16000 },
                ]}
              />
            </FilterOptionItem>
          </Form.Item>

          <Form.Item style={{ marginTop: 16 }}>
            <Button
              type="primary"
              onClick={testTTS}
              disabled={
                !ttsEnabled ||
                (ttsServiceType === 'openai' && (!ttsApiKey || !ttsVoice || !ttsModel)) ||
                (ttsServiceType === 'edge' && !ttsEdgeVoice)
              }
            >
              {t('settings.tts.test')}
            </Button>
          </Form.Item>
        </Form>
      </SettingGroup>

      <SettingDivider />

      <SettingHelpText>
        {t('settings.tts.help')}
        <br />
        <a href="https://platform.openai.com/docs/guides/text-to-speech" target="_blank" rel="noopener noreferrer">
          {t('settings.tts.learn_more')}
        </a>
      </SettingHelpText>
    </SettingContainer>
  )
}

export default TTSSettings
