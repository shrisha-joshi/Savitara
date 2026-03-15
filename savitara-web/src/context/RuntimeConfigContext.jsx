/* eslint-disable react-refresh/only-export-components */
import PropTypes from 'prop-types'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import api from '../services/api'

const RuntimeConfigContext = createContext({
  loading: false,
  configs: [],
  configMap: {},
  refreshConfigs: async () => {},
  getConfig: () => undefined,
})

export function RuntimeConfigProvider({ children }) {
  const [loading, setLoading] = useState(false)
  const [configs, setConfigs] = useState([])
  const [configMap, setConfigMap] = useState({})

  const refreshConfigs = async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setConfigs([])
      setConfigMap({})
      return
    }

    setLoading(true)
    try {
      const response = await api.get('/growth-configs/bootstrap', {
        _skipErrorToast: true,
      })
      const payload = response?.data?.data || {}
      setConfigs(Array.isArray(payload.configs) ? payload.configs : [])
      setConfigMap(payload.config_map && typeof payload.config_map === 'object' ? payload.config_map : {})
    } catch (error) {
      console.warn('Runtime config bootstrap unavailable, falling back to defaults', error?.response?.status || error?.message)
      setConfigs([])
      setConfigMap({})
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshConfigs()
  }, [])

  const value = useMemo(() => ({
    loading,
    configs,
    configMap,
    refreshConfigs,
    getConfig: (key, fallback = null) => {
      if (Object.hasOwn(configMap, key)) {
        return configMap[key]
      }
      return fallback
    },
  }), [loading, configs, configMap])

  return (
    <RuntimeConfigContext.Provider value={value}>
      {children}
    </RuntimeConfigContext.Provider>
  )
}

RuntimeConfigProvider.propTypes = {
  children: PropTypes.node.isRequired,
}

export function useRuntimeConfig() {
  return useContext(RuntimeConfigContext)
}
