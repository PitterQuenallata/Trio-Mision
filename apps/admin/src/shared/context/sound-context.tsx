import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { sound } from '../lib/sound';

interface SoundContextType {
  soundEnabled: boolean;
  toggleSound: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  play: (type?: 'click' | 'pop' | 'tab' | 'toggle' | 'switch' | 'success' | 'alert') => void;
  volume: number;
  setVolume: (v: number) => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export const SoundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => sound.isEnabled());
  const [volume, setVolumeState] = useState<number>(() => sound.getVolume());

  useEffect(() => {
    setSoundEnabledState(sound.isEnabled());
    setVolumeState(sound.getVolume());
  }, []);

  const toggleSound = useCallback(() => {
    const next = sound.toggle();
    setSoundEnabledState(next);
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    sound.setEnabled(enabled);
    setSoundEnabledState(enabled);
  }, []);

  const setVolume = useCallback((v: number) => {
    sound.setVolume(v);
    setVolumeState(v);
  }, []);

  const play = useCallback((type: 'click' | 'pop' | 'tab' | 'toggle' | 'switch' | 'success' | 'alert' = 'click') => {
    sound.play(type);
  }, []);

  return (
    <SoundContext.Provider
      value={{
        soundEnabled,
        toggleSound,
        setSoundEnabled,
        play,
        volume,
        setVolume,
      }}
    >
      {children}
    </SoundContext.Provider>
  );
};

export const useSound = (): SoundContextType => {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
};
