import AsyncStorage from '@react-native-async-storage/async-storage';
import PropTypes from 'prop-types';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { growthConfigAPI } from '../services/api';

const CACHE_KEY = 'runtimeConfigBootstrap';

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

  const applyPayload = useCallback((payload) => {
    const nextConfigs = Array.isArray(payload?.configs) ? payload.configs : [];
    const nextConfigMap = payload?.config_map && typeof payload.config_map === 'object'
      ? payload.config_map
      : {};
    setConfigs(nextConfigs);
    setConfigMap(nextConfigMap);
    return { nextConfigs, nextConfigMap };
  }, []);

  const loadCachedPayload = useCallback(async () => {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (!cached) {
      return false;
    }
    const parsed = JSON.parse(cached);
    applyPayload(parsed);
    return true;
  }, [applyPayload]);

  const refreshConfigs = useCallback(async () => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (!token) {
      setConfigs([]);
      setConfigMap({});
      return;
    }

    setLoading(true);
    try {
      const response = await growthConfigAPI.getBootstrap();
      const payload = response?.data?.data || {};
      const { nextConfigs, nextConfigMap } = applyPayload(payload);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ configs: nextConfigs, config_map: nextConfigMap }));
    } catch (error) {
      try {
        await loadCachedPayload();
      } catch (cacheError) {
        console.warn('Runtime config cache unavailable:', cacheError?.message);
      }
      console.warn('Runtime config bootstrap unavailable, using cache/defaults:', error?.response?.status || error?.message);
    } finally {
      setLoading(false);
    }
  }, [applyPayload, loadCachedPayload]);

  useEffect(() => {
    refreshConfigs();
  }, [refreshConfigs]);

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
  }), [loading, configs, configMap, refreshConfigs]);

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
