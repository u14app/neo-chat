import { useMemo, useCallback, memo, useLayoutEffect } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSettingStore, useEnvStore } from '@/store/setting'
import { useModelStore } from '@/store/model'
import { fetchModels } from '@/utils/models'
import { parseModelList } from '@/utils/modelList'
import { getRandomKey } from '@/utils/common'
import { Model } from '@/constant/model'
import { values, keys, find } from 'lodash-es'

type Props = {
  className?: string
  defaultModel: string
}

let cachedModelList = false

function filterModel(models: Model[] = []) {
  return models.filter((model) => model.name.startsWith('models/gemini-'))
}

function ModelSelect({ className, defaultModel }: Props) {
  const { models } = useModelStore()
  const { update } = useSettingStore()
  const { modelList: MODEL_LIST, isProtected } = useEnvStore()

  const modelOptions = useMemo(() => {
    if (models.length > 0) {
      const systemModels = values(Model)
      models.forEach((item) => {
        const modelName = item.name.replace('models/', '')
        if (!systemModels.includes(modelName)) {
          Model[modelName] = item.displayName
        }
      })
    }

    const defaultModelList: string[] = keys(Model)
    const parsedModelList = parseModelList(MODEL_LIST, defaultModelList)

    return parsedModelList.models
  }, [models, MODEL_LIST])

  const handleModelChange = useCallback(
    (name: string) => {
      const currentModel = find(models, { name: `models/${name}` })
      if (currentModel) {
        const values: Record<string, number> = {}
        const { topP, topK, temperature, outputTokenLimit } = currentModel
        if (topP) values.topP = topP
        if (topK) values.topK = topK
        if (temperature) values.temperature = temperature
        if (outputTokenLimit) values.maxOutputTokens = outputTokenLimit
        update({ model: name, ...values })
      } else {
        update({ model: name })
      }
    },
    [update, models],
  )

  const uploadModelList = useCallback(() => {
    const { update: updateModelList } = useModelStore.getState()
    const { apiKey, apiProxy, password } = useSettingStore.getState()
    if (apiKey || password || !isProtected) {
      const key = getRandomKey(apiKey)
      fetchModels({ apiKey: key, apiProxy, password }).then((result) => {
        const models = filterModel(result.models)
        if (models.length > 0) {
          updateModelList(models)
          cachedModelList = true
        }
      })
    }
  }, [isProtected])

  useLayoutEffect(() => {
    if (!cachedModelList) {
      uploadModelList()
    }
  }, [uploadModelList])

  return (
    <Select
      value={defaultModel}
      onValueChange={(value) => {
        handleModelChange(value)
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder="Model" />
      </SelectTrigger>
      <SelectContent>
        {modelOptions.map((name) => {
          return (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

export default memo(ModelSelect)
