
const mergeConfig = (defaults, overrides) => {

  const result = JSON.parse(JSON.stringify(defaults))
  
  Object.keys(overrides).forEach(key => {

    if (typeof defaults[key] === 'object' && typeof overrides[key] === 'object'
      && !Array.isArray(overrides[key]) && overrides[key] !== null
      && !Array.isArray(defaults[key]) && defaults[key] !== null) {
      result[key] = mergeConfig(defaults[key], overrides[key])
    } else {
      result[key] = overrides[key]
    }
  })

  return result
}

export default (defaults, overrides) => {

  // 1st merge
  let config = mergeConfig(defaults, overrides)

  // add some methods
  config.getActiveModel = () => {
    return config[config.llm.engine].models.chat
  }

  // done
  return config

}
