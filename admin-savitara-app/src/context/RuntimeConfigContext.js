import AsyncStorage from '@react-native-async-storage/async-storage';
import PropTypes from 'prop-types';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { growthConfigAPI } from '../services/api';

const CACHE_KEY = 'adminRuntimeConfigBootstrap';

const RuntimeConfigContext = createContext({
  loading: false,
  configs: [],
  configMap: {},
  refreshConfigs: async () => {},
  getConfig: () => undefined,
});

export const RuntimeConfigProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [configMap, setConfigMap] = useState({});

  const refreshConfigs = async () => {
    setLoading(true);
    try {
      const response = await growthConfigAPI.getBootstrap();
      const payload = response?.data?.data || {};
      const nextConfigs = Array.isArray(payload.configs) ? payload.configs : [];
      const nextConfigMap = payload.config_map && typeof payload.config_map === 'object' ? payload.config_map : {};
      setConfigs(nextConfigs);
      setConfigMap(nextConfigMap);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ configs: nextConfigs, config_map: nextConfigMap }));
    } catch (error) {
      try {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          setConfigs(Array.isArray(parsed.configs) ? parsed.configs : []);
          setConfigMap(parsed.config_map && typeof parsed.config_map === 'object' ? parsed.config_map : {});
        }
      } catch (cacheError) {
        console.warn('Admin runtime config cache unavailable:', cacheError?.message);
      }
      console.warn('Admin runtime config bootstrap unavailable, using cache/defaults:', error?.response?.status || error?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshConfigs();
  }, []);

  const value = useMemo(() => ({
    loading,
    configs,
    configMap,
    refreshConfigs,
    getConfig: (key, fallback = null) => {
      if (Object.hasOwn(configMap, key)) {
        return configMap[key];
      }
      return fallback;
    },
  }), [loading, configs, configMap]);

  return (
    <RuntimeConfigContext.Provider value={value}>
      {children}
    </RuntimeConfigContext.Provider>
  );
};

RuntimeConfigProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useRuntimeConfig = () => useContext(RuntimeConfigContext);
