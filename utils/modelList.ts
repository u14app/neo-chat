export interface ParsedModelList {
  models: string[]
  defaultModel?: string
}

export function parseModelList(input: string, defaultModels: string[]): ParsedModelList {
  const tokens = input
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token !== '')

  if (tokens.length === 0) {
    return { models: [...defaultModels] }
  }

  const models: string[] = []
  let defaultModel: string | undefined

  const addModel = (name: string) => {
    if (name !== '' && !models.includes(name)) {
      models.push(name)
    }
  }

  const removeModel = (name: string) => {
    if (name === '') return
    const nextModels = models.filter((modelName) => modelName !== name)
    models.length = 0
    models.push(...nextModels)
  }

  const addAllDefaultModels = () => {
    defaultModels.forEach((name) => addModel(name))
  }

  tokens.forEach((token) => {
    if (token === 'all' || token === '+all') {
      addAllDefaultModels()
      return
    }

    if (token === '-all') {
      defaultModels.forEach((name) => removeModel(name))
      return
    }

    if (token.startsWith('@')) {
      const name = token.substring(1).trim()
      if (name !== '') {
        defaultModel = name
        addModel(name)
      }
      return
    }

    if (token.startsWith('-')) {
      removeModel(token.substring(1).trim())
      return
    }

    addModel(token.startsWith('+') ? token.substring(1).trim() : token)
  })

  return {
    models,
    defaultModel,
  }
}
